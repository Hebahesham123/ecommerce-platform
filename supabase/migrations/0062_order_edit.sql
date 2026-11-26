-- =============================================================================
-- Edit a placed order: change quantities and prices, add lines, remove lines,
-- and set the order discount — in one transaction.
--
-- Why a function rather than a handful of queries from the app: an edit moves
-- stock AND rewrites the order's money at the same time. Done as separate
-- round trips, a failure halfway leaves stock returned for a line that is
-- still on the order, or a total that no longer matches its lines. Here either
-- the whole edit lands or none of it does, which is the same reason
-- order_fulfill and order_restock are functions.
--
-- What it deliberately does NOT do:
--   * re-quote shipping. The customer was told a shipping price; an edit is
--     not the moment to silently change it.
--   * drop the fees already folded into the total (COD fee, tax). Those have
--     no columns of their own, so they are carried across as the difference
--     the old total had over its own lines. An edit never quietly makes a
--     quoted total cheaper or dearer than the parts it is made of.
--   * refuse to oversell. A merchant adding a line to an order is recording
--     something that is happening, not asking permission.
-- =============================================================================

-- Move stock for one line. A positive delta returns units (a line shrank or
-- went away), a negative delta takes them (a line grew or was added).
-- Mirrors order_restock's choice of location: where the most stock sits, and
-- failing that the default location.
create or replace function public.order_edit_stock(
  p_item  uuid,
  p_delta integer,
  p_apply boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracked boolean;
  v_target  uuid;
begin
  if p_item is null or coalesce(p_delta, 0) = 0 or coalesce(p_apply, false) = false then
    return;
  end if;

  select tracked into v_tracked from inventory_items where id = p_item;
  if coalesce(v_tracked, false) = false then
    return;                       -- untracked products have no stock to move
  end if;

  select location_id into v_target
    from inventory_levels
   where item_id = p_item
   order by on_hand desc
   limit 1;
  if v_target is null then
    select id into v_target from locations order by is_default desc, created_at asc limit 1;
  end if;
  if v_target is null then
    return;
  end if;

  insert into inventory_levels (item_id, location_id, on_hand)
  values (p_item, v_target, p_delta)
  on conflict (item_id, location_id)
    do update set on_hand = inventory_levels.on_hand + excluded.on_hand;
end $$;


create or replace function public.order_edit(
  p_order_number text,
  p_lines        jsonb,
  p_discount     numeric default null
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
begin
  select * into v_order from store_orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

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
