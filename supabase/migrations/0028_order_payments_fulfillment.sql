-- =============================================================================
-- Shopify-style order money & fulfillment.
--
-- Before this, an order carried a single payment_status flag (pending|paid) and
-- fulfillment_status was always 'unfulfilled' — the "Collect payment" and
-- "Mark fulfilled" buttons did nothing. This adds the two things a real order
-- desk needs:
--
--   • PAYMENTS as a ledger. An order can be paid in parts (split payment), by
--     different methods, over time, and refunded. amount_paid is recomputed from
--     the ledger, never set by hand, and payment_status becomes one of
--     pending | partially_paid | paid | partially_refunded | refunded.
--
--   • FULFILLMENT per line item. You can fulfill some items now and the rest
--     later (partial), each fulfillment stamped with time + optional tracking.
--     fulfillment_status becomes unfulfilled | partial | fulfilled, derived from
--     how many units of each line have shipped.
--
-- Every mutation is a SECURITY DEFINER function that locks the order row, so two
-- people working the same order can't corrupt the totals. Matches the project
-- convention: RLS on, one authenticated admin policy, service role from server.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- New columns ------------------------------------------------------------
alter table public.store_orders
  add column if not exists amount_paid numeric(12,2) not null default 0;

alter table public.store_order_items
  add column if not exists fulfilled_quantity integer not null default 0;

-- ---- Payment ledger ---------------------------------------------------------
create table if not exists public.order_payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.store_orders(id) on delete cascade,
  order_number text not null,
  kind         text not null default 'payment' check (kind in ('payment','refund')),
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null default 'cash',   -- cash | card | instapay | wallet | bank_transfer | cod | other
  reference    text,                            -- transaction id / receipt no.
  note         text,
  created_by   text not null default 'admin',
  created_at   timestamptz not null default now()
);
create index if not exists order_payments_order_idx on public.order_payments (order_id, created_at);

-- ---- Fulfillments (a shipment covering some line items) ---------------------
create table if not exists public.order_fulfillments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.store_orders(id) on delete cascade,
  order_number text not null,
  tracking     text,
  carrier      text,
  note         text,
  status       text not null default 'fulfilled' check (status in ('fulfilled','cancelled')),
  created_by   text not null default 'admin',
  created_at   timestamptz not null default now()
);
create index if not exists order_fulfillments_order_idx on public.order_fulfillments (order_id, created_at);

create table if not exists public.order_fulfillment_items (
  id             uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete cascade,
  order_item_id  uuid not null references public.store_order_items(id) on delete cascade,
  product_name   text,
  quantity       integer not null check (quantity > 0)
);
create index if not exists order_fulfillment_items_f_idx on public.order_fulfillment_items (fulfillment_id);

-- ---- Recompute helpers ------------------------------------------------------
-- Payment status from the ledger. net = captured − refunded.
create or replace function public.order_recompute_payment(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total     numeric(12,2);
  v_captured  numeric(12,2);
  v_refunded  numeric(12,2);
  v_net       numeric(12,2);
  v_status    text;
begin
  select total into v_total from public.store_orders where id = p_order_id;
  select
    coalesce(sum(amount) filter (where kind = 'payment'), 0),
    coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_captured, v_refunded
    from public.order_payments where order_id = p_order_id;

  v_net := greatest(v_captured - v_refunded, 0);

  if v_refunded > 0 and v_net <= 0 then
    v_status := 'refunded';
  elsif v_refunded > 0 then
    v_status := 'partially_refunded';
  elsif v_net >= v_total and v_total > 0 then
    v_status := 'paid';
  elsif v_net > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'pending';
  end if;

  update public.store_orders
     set amount_paid = v_net, payment_status = v_status
   where id = p_order_id;
end $$;

-- Fulfillment status from the line items.
create or replace function public.order_recompute_fulfillment(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ordered   integer;
  v_fulfilled integer;
  v_status    text;
begin
  select coalesce(sum(quantity), 0), coalesce(sum(fulfilled_quantity), 0)
    into v_ordered, v_fulfilled
    from public.store_order_items where order_id = p_order_id;

  if v_ordered = 0 or v_fulfilled = 0 then
    v_status := 'unfulfilled';
  elsif v_fulfilled >= v_ordered then
    v_status := 'fulfilled';
  else
    v_status := 'partial';
  end if;

  update public.store_orders set fulfillment_status = v_status where id = p_order_id;
end $$;

-- ---- Record a payment or refund (atomic) -----------------------------------
create or replace function public.order_record_payment(
  p_order_number text,
  p_kind         text,
  p_amount       numeric,
  p_method       text default 'cash',
  p_reference    text default null,
  p_note         text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order     public.store_orders%rowtype;
  v_captured  numeric(12,2);
  v_refunded  numeric(12,2);
  v_net       numeric(12,2);
begin
  select * into v_order from public.store_orders where order_number = p_order_number for update;
  if not found then raise exception 'order_not_found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_kind not in ('payment','refund') then raise exception 'invalid_kind'; end if;

  if p_kind = 'refund' then
    select greatest(
      coalesce(sum(amount) filter (where kind='payment'),0) - coalesce(sum(amount) filter (where kind='refund'),0), 0)
      into v_net from public.order_payments where order_id = v_order.id;
    if p_amount > v_net then raise exception 'refund_exceeds_paid'; end if;
  end if;

  insert into public.order_payments (order_id, order_number, kind, amount, method, reference, note)
  values (v_order.id, p_order_number, p_kind, round(p_amount, 2), coalesce(nullif(p_method,''),'cash'), p_reference, p_note);

  perform public.order_recompute_payment(v_order.id);

  select amount_paid into v_net from public.store_orders where id = v_order.id;
  select payment_status into v_order.payment_status from public.store_orders where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'amount_paid', v_net,
    'balance', greatest(v_order.total - v_net, 0),
    'payment_status', v_order.payment_status
  );
end $$;

-- ---- Fulfill line items (atomic; partial supported) ------------------------
-- p_items: [{ "order_item_id": uuid, "quantity": int }]. Null/empty = fulfill
-- everything still outstanding.
create or replace function public.order_fulfill(
  p_order_number text,
  p_items        jsonb default null,
  p_tracking     text default null,
  p_carrier      text default null,
  p_note         text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order   public.store_orders%rowtype;
  v_fid     uuid;
  v_item    jsonb;
  v_row     public.store_order_items%rowtype;
  v_take    integer;
  v_any     boolean := false;
begin
  select * into v_order from public.store_orders where order_number = p_order_number for update;
  if not found then raise exception 'order_not_found'; end if;

  insert into public.order_fulfillments (order_id, order_number, tracking, carrier, note)
  values (v_order.id, p_order_number, nullif(p_tracking,''), nullif(p_carrier,''), nullif(p_note,''))
  returning id into v_fid;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    -- Fulfill all outstanding units.
    for v_row in
      select * from public.store_order_items
      where order_id = v_order.id and quantity > fulfilled_quantity
      for update
    loop
      v_take := v_row.quantity - v_row.fulfilled_quantity;
      update public.store_order_items set fulfilled_quantity = quantity where id = v_row.id;
      insert into public.order_fulfillment_items (fulfillment_id, order_item_id, product_name, quantity)
      values (v_fid, v_row.id, v_row.product_name, v_take);
      v_any := true;
    end loop;
  else
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      select * into v_row from public.store_order_items
        where id = nullif(v_item->>'order_item_id','')::uuid and order_id = v_order.id
        for update;
      if not found then continue; end if;
      v_take := least(coalesce((v_item->>'quantity')::int, 0), v_row.quantity - v_row.fulfilled_quantity);
      if v_take <= 0 then continue; end if;
      update public.store_order_items set fulfilled_quantity = fulfilled_quantity + v_take where id = v_row.id;
      insert into public.order_fulfillment_items (fulfillment_id, order_item_id, product_name, quantity)
      values (v_fid, v_row.id, v_row.product_name, v_take);
      v_any := true;
    end loop;
  end if;

  if not v_any then
    delete from public.order_fulfillments where id = v_fid;
    raise exception 'nothing_to_fulfill';
  end if;

  perform public.order_recompute_fulfillment(v_order.id);
  select fulfillment_status into v_order.fulfillment_status from public.store_orders where id = v_order.id;

  return jsonb_build_object('ok', true, 'fulfillment_id', v_fid, 'fulfillment_status', v_order.fulfillment_status);
end $$;

-- Undo a fulfillment (returns its units to outstanding).
create or replace function public.order_unfulfill(p_fulfillment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_fi       record;
begin
  select order_id into v_order_id from public.order_fulfillments where id = p_fulfillment_id;
  if v_order_id is null then raise exception 'not_found'; end if;

  for v_fi in select order_item_id, quantity from public.order_fulfillment_items where fulfillment_id = p_fulfillment_id
  loop
    update public.store_order_items
       set fulfilled_quantity = greatest(fulfilled_quantity - v_fi.quantity, 0)
     where id = v_fi.order_item_id;
  end loop;

  delete from public.order_fulfillments where id = p_fulfillment_id;
  perform public.order_recompute_fulfillment(v_order_id);
  return jsonb_build_object('ok', true);
end $$;

-- ---- Backfill existing orders ----------------------------------------------
-- Orders already marked paid keep that: seed a single payment row so the ledger
-- and amount_paid agree with the flag they carried.
insert into public.order_payments (order_id, order_number, kind, amount, method, note)
select o.id, o.order_number, 'payment', o.total, coalesce(o.payment_method,'cod'), 'Backfilled from legacy paid flag'
from public.store_orders o
where o.payment_status = 'paid' and o.total > 0
  and not exists (select 1 from public.order_payments p where p.order_id = o.id);

update public.store_orders o set amount_paid = o.total where o.payment_status = 'paid';

-- Normalize any legacy fulfillment value that isn't in the new vocabulary.
update public.store_orders
   set fulfillment_status = 'unfulfilled'
 where fulfillment_status not in ('unfulfilled','partial','fulfilled');

-- ---- RLS --------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['order_payments','order_fulfillments','order_fulfillment_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_auth_all" on public.%I', t, t);
    execute format('create policy "%s_auth_all" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
