-- =============================================================================
-- Race-safe order placement.
--
-- The old flow inserted the order, then called decrement_stock() which floored
-- on_hand at 0 and never rejected — so two concurrent buyers of the last unit
-- could BOTH check out (overselling), and a sold-out item could still be
-- ordered server-side.
--
-- place_store_order() does the whole thing in ONE transaction:
--   1. For each tracked line, lock that item's inventory rows (FOR UPDATE),
--      re-read availability (sum of on_hand - committed across locations), and
--      RAISE if it's short — which rolls back the entire order.
--   2. Deduct on_hand across locations (most-available first).
--   3. Insert the order + line items.
-- Concurrent checkouts serialize on the row locks, so availability can never go
-- negative and the last unit is sold exactly once.
-- =============================================================================

create or replace function public.place_store_order(
  p_order_number  text,
  p_customer_name text,
  p_phone         text,
  p_governorate   text,
  p_city          text,
  p_address       text,
  p_note          text,
  p_subtotal      numeric,
  p_shipping      numeric,
  p_total         numeric,
  p_items         jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_item      jsonb;
  v_item_id   uuid;
  v_qty       integer;
  v_tracked   boolean;
  v_avail     integer;
  v_remaining integer;
  v_take      integer;
  v_lvl       record;
begin
  -- 1) Reserve stock for each tracked line under row locks; reject if short.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(v_item->>'item_id', '')::uuid;
    v_qty     := coalesce((v_item->>'quantity')::int, 0);
    if v_item_id is null or v_qty <= 0 then
      continue;
    end if;

    select tracked into v_tracked from inventory_items where id = v_item_id;
    if coalesce(v_tracked, false) = false then
      continue;  -- untracked (or unknown) items are not stock-limited
    end if;

    -- Lock every location row for this item so concurrent checkouts serialize.
    perform 1 from inventory_levels where item_id = v_item_id for update;

    select coalesce(sum(greatest(0, on_hand - committed)), 0)
      into v_avail
      from inventory_levels
     where item_id = v_item_id;

    if v_avail < v_qty then
      raise exception 'insufficient_stock:%', v_item_id using errcode = 'P0001';
    end if;

    -- Deduct on_hand across locations, most-available first.
    v_remaining := v_qty;
    for v_lvl in
      select id, greatest(0, on_hand - committed) as avail
        from inventory_levels
       where item_id = v_item_id and (on_hand - committed) > 0
       order by (on_hand - committed) desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_lvl.avail);
      update inventory_levels set on_hand = on_hand - v_take where id = v_lvl.id;
      v_remaining := v_remaining - v_take;
    end loop;
  end loop;

  -- 2) Create the order (only reached if every line reserved successfully).
  insert into store_orders (
    order_number, customer_name, phone, governorate, city, address, note,
    subtotal, shipping, total, payment_method, payment_status,
    fulfillment_status, lifecycle
  ) values (
    p_order_number, p_customer_name, p_phone, p_governorate, p_city, p_address, p_note,
    p_subtotal, p_shipping, p_total, 'cod', 'pending', 'unfulfilled', 'placed'
  ) returning id into v_order_id;

  -- 3) Insert the line items.
  insert into store_order_items (
    order_id, item_id, product_name, variant_title, sku, image_url, price, quantity
  )
  select
    v_order_id,
    nullif(it->>'item_id', '')::uuid,
    it->>'product_name',
    it->>'variant_title',
    it->>'sku',
    it->>'image_url',
    coalesce((it->>'price')::numeric, 0),
    coalesce((it->>'quantity')::int, 1)
  from jsonb_array_elements(p_items) as it;

  return v_order_id;
end $$;
