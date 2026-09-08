-- =============================================================================
-- Order numbers a person can say out loud.
--
-- Numbers used to be "BB" and the tail of a millisecond clock, which is unique
-- and nothing else: it cannot be read down a phone, it sorts by nothing useful,
-- and two orders a minute apart look unrelated. This makes them count — 1, 2,
-- 3 — the way a shop's order book does.
--
-- Counted, not sequenced. A Postgres sequence is not transactional, so an order
-- that fails at the stock check still burns its number and the book gets holes
-- in it. A counter row is transactional: the number is handed out inside the
-- same transaction that reserves the stock, so it is taken only if the order is
-- actually placed, and a rolled-back order gives its number back. The cost is
-- that concurrent orders queue for one row lock at the moment of numbering,
-- which is a lock held for microseconds in a transaction already serialising on
-- inventory rows.
--
-- Existing orders keep the numbers they were given. They are on receipts, in
-- WhatsApp threads and against returns; renumbering them would be rewriting
-- history that other people are holding a copy of.
-- =============================================================================

create table if not exists public.store_order_counter (
  -- One row, forever: `true` is the only value the check allows.
  id          boolean primary key default true check (id),
  next_number bigint  not null default 1,
  updated_at  timestamptz not null default now()
);

-- Start at 1, unless plainly-numbered orders already exist — in which case
-- carry on after the highest of them rather than colliding with it.
insert into public.store_order_counter (id, next_number)
select true, coalesce(
  (select max(order_number::bigint) + 1
     from public.store_orders
    where order_number ~ '^[0-9]+$'),
  1
)
on conflict (id) do nothing;

alter table public.store_order_counter enable row level security;

-- The return type changes, so the old one has to go first.
drop function if exists public.place_store_order(
  text, text, text, text, text, text, text, numeric, numeric, numeric, jsonb
);

create function public.place_store_order(
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
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_number    text;
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

  -- 2) Take the next number, only now that every line is reserved. A caller
  --    that supplies its own number (an import, a backfill) keeps it.
  v_number := nullif(btrim(coalesce(p_order_number, '')), '');
  if v_number is null then
    update store_order_counter
       set next_number = next_number + 1,
           updated_at  = now()
     where id
    returning (next_number - 1)::text into v_number;

    -- No counter row means the migration was applied by hand and half-run;
    -- better to say so than to file an order with no number.
    if v_number is null then
      raise exception 'order_counter_missing' using errcode = 'P0001';
    end if;
  end if;

  -- 3) Create the order.
  insert into store_orders (
    order_number, customer_name, phone, governorate, city, address, note,
    subtotal, shipping, total, payment_method, payment_status,
    fulfillment_status, lifecycle
  ) values (
    v_number, p_customer_name, p_phone, p_governorate, p_city, p_address, p_note,
    p_subtotal, p_shipping, p_total, 'cod', 'pending', 'unfulfilled', 'placed'
  ) returning id into v_order_id;

  -- 4) Insert the line items.
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

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_number);
end $$;
