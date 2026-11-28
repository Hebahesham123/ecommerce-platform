-- =============================================================================
-- order_edit writes its own audit row, inside its own transaction.
--
-- THE BUG THIS FIXES
--
-- The audit was written by the app after the function returned. With
-- AUDIT_ENFORCE on, a failed audit write would return an error for a change
-- that had already been saved — so the merchant sees "something went wrong",
-- presses again, and edits the order twice. An audit that turns one refund
-- into two is worse than no audit at all.
--
-- Moving the insert inside the function makes it both or neither: if the
-- audit cannot be written the whole edit rolls back, the money never moved,
-- and pressing again is the right thing to do.
--
-- WHAT CHANGED BESIDES THAT
--
-- A p_actor parameter, because the function can no longer read the request's
-- header. The app passes what Caddy told it, and null when it does not know —
-- see src/lib/audit.ts for why null is recorded honestly.
--
-- The old three-argument version is dropped rather than left beside this one.
-- Two overloads would mean PostgREST choosing between them by the arguments
-- sent, and an older caller silently getting the unaudited one.
--
-- ⚠️ This changes the database. Take a backup first.
-- =============================================================================

drop function if exists public.order_edit(text, jsonb, numeric);

create or replace function public.order_edit(
  p_order_number text,
  p_lines        jsonb,
  p_discount     numeric default null,
  p_actor        text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    record;
  v_line     record;
  v_in       jsonb;
  v_id       uuid;
  v_item     uuid;
  v_qty      integer;
  v_price    numeric;
  v_keep     uuid[] := '{}';
  v_changes  text[] := '{}';
  v_subtotal numeric := 0;
  v_extras   numeric;
  v_discount numeric;
  v_total    numeric;
  v_move     boolean;
  v_name     text;
  v_i_name    text;
  v_i_variant text;
  v_i_sku     text;
  v_i_image   text;
  v_before   jsonb;
begin
  select * into v_order from store_orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  -- Captured before anything moves, for the audit row at the end.
  v_before := jsonb_build_object(
    'subtotal', coalesce(v_order.subtotal, 0),
    'discount', coalesce(v_order.discount_amount, 0),
    'total',    coalesce(v_order.total, 0)
  );

  -- The order's stock was already handed back when it was restocked; moving it
  -- again here would count the same units twice.
  v_move := v_order.restocked_at is null;

  -- ---- existing lines that stay, and brand new ones ------------------------
  for v_in in select * from jsonb_array_elements(p_lines) loop
    v_qty   := greatest(0, coalesce((v_in->>'quantity')::integer, 0));
    v_price := greatest(0, coalesce((v_in->>'price')::numeric, 0));
    v_id    := nullif(v_in->>'id', '')::uuid;

    if v_id is not null then
      select * into v_line from store_order_items where id = v_id and order_id = v_order.id;
      if not found then
        raise exception 'line_not_found' using errcode = 'P0001';
      end if;
      -- Units already shipped cannot be taken off the order; undo the
      -- fulfillment first. Otherwise the order would claim to hold less than
      -- what physically left the building.
      if v_qty < coalesce(v_line.fulfilled_quantity, 0) then
        raise exception 'line_fulfilled' using errcode = 'P0001';
      end if;

      if v_qty = 0 then
        continue;                 -- dropped: handled with the removals below
      end if;

      v_keep := v_keep || v_id;

      if v_qty <> v_line.quantity then
        perform order_edit_stock(v_line.item_id, v_line.quantity - v_qty, v_move);
        v_changes := v_changes
          || format('%s · qty %s → %s', v_line.product_name, v_line.quantity, v_qty);
      end if;
      if v_price <> v_line.price then
        v_changes := v_changes
          || format('%s · price %s → %s', v_line.product_name, v_line.price, v_price);
      end if;

      update store_order_items set quantity = v_qty, price = v_price where id = v_id;
      v_subtotal := v_subtotal + (v_price * v_qty);

    else
      if v_qty = 0 then
        continue;                 -- a new line of nothing is not a line
      end if;
      v_item := nullif(v_in->>'item_id', '')::uuid;

      -- Fill in whatever the client did not send from the product itself.
      -- Plain scalars rather than a record variable: a lookup that matches
      -- nothing simply leaves these null for coalesce to step over, with no
      -- unassigned record to trip over.
      v_i_name := null; v_i_variant := null; v_i_sku := null; v_i_image := null;
      if v_item is not null then
        select product_name, variant_title, sku, image_url
          into v_i_name, v_i_variant, v_i_sku, v_i_image
          from inventory_items
         where id = v_item;
      end if;

      v_name := coalesce(nullif(v_in->>'product_name', ''), v_i_name, 'Item');

      insert into store_order_items
        (order_id, item_id, product_name, variant_title, sku, image_url, price, quantity)
      values (
        v_order.id,
        v_item,
        v_name,
        -- "Default Title" is Shopify's placeholder for a product with no
        -- variants. Order lines store a real variant or nothing, so copying
        -- the placeholder across would put it on the packing slip.
        coalesce(
          nullif(v_in->>'variant_title', ''),
          case when lower(coalesce(v_i_variant, '')) = 'default title' then null else v_i_variant end
        ),
        coalesce(nullif(v_in->>'sku', ''), v_i_sku),
        coalesce(nullif(v_in->>'image_url', ''), v_i_image),
        v_price,
        v_qty
      );

      perform order_edit_stock(v_item, -v_qty, v_move);
      v_changes := v_changes || format('added %s ×%s', v_name, v_qty);
      v_subtotal := v_subtotal + (v_price * v_qty);
    end if;
  end loop;

  -- ---- lines that are gone --------------------------------------------------
  for v_line in
    select * from store_order_items
     where order_id = v_order.id and not (id = any(v_keep))
  loop
    if coalesce(v_line.fulfilled_quantity, 0) > 0 then
      raise exception 'line_fulfilled' using errcode = 'P0001';
    end if;
    perform order_edit_stock(v_line.item_id, v_line.quantity, v_move);
    v_changes := v_changes || format('removed %s ×%s', v_line.product_name, v_line.quantity);
    delete from store_order_items where id = v_line.id;
  end loop;

  if v_subtotal <= 0 and not exists (select 1 from store_order_items where order_id = v_order.id) then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  -- ---- the money -----------------------------------------------------------
  -- Whatever the old total held beyond its own lines — the COD fee, tax — has
  -- no column to live in, so it is carried across rather than lost.
  v_extras := greatest(
    0,
    coalesce(v_order.total, 0)
      - (coalesce(v_order.subtotal, 0) - coalesce(v_order.discount_amount, 0) + coalesce(v_order.shipping, 0))
  );

  v_discount := coalesce(p_discount, v_order.discount_amount, 0);
  v_discount := least(greatest(0, v_discount), v_subtotal);
  if v_discount <> coalesce(v_order.discount_amount, 0) then
    v_changes := v_changes
      || format('discount %s → %s', coalesce(v_order.discount_amount, 0), v_discount);
  end if;

  v_total := greatest(0, v_subtotal - v_discount + coalesce(v_order.shipping, 0) + v_extras);

  if v_subtotal <> coalesce(v_order.subtotal, 0) or v_total <> coalesce(v_order.total, 0) then
    v_changes := v_changes
      || format('total %s → %s', coalesce(v_order.total, 0), v_total);
  end if;

  update store_orders
     set subtotal        = v_subtotal,
         discount_amount = v_discount,
         total           = v_total
   where id = v_order.id;

  -- ---- the audit row, in the same transaction as the money -----------------
  -- Last, so it records what actually happened; inside, so a failure here
  -- takes the edit with it rather than leaving a change nobody can account
  -- for. Only when something moved: an edit that changes nothing is not an
  -- event worth keeping.
  if array_length(v_changes, 1) is not null then
    insert into admin_audit (actor, action, subject, summary, before_data, after_data, meta)
    values (
      nullif(btrim(coalesce(p_actor, '')), ''),
      'order.edit',
      p_order_number,
      array_to_string(v_changes, ' · '),
      v_before,
      jsonb_build_object('subtotal', v_subtotal, 'discount', v_discount, 'total', v_total),
      jsonb_build_object('changes', to_jsonb(v_changes))
    );
  end if;

  return jsonb_build_object(
    'changes',  to_jsonb(v_changes),
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping', coalesce(v_order.shipping, 0),
    'extras',   v_extras,
    'total',    v_total,
    'stock_moved', v_move
  );
end $$;

-- Dropping the function dropped its grants with it.
revoke all on function public.order_edit(text, jsonb, numeric, text) from public, anon, authenticated;
grant execute on function public.order_edit(text, jsonb, numeric, text) to service_role;

-- There must be exactly one order_edit, or PostgREST could route a caller to
-- an older, unaudited overload.
do $$
declare
  n integer;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'order_edit';
  if n <> 1 then
    raise exception '0066: expected exactly one order_edit, found %', n;
  end if;
  raise notice '0066: order_edit now audits itself, in one transaction';
end $$;

notify pgrst, 'reload schema';
