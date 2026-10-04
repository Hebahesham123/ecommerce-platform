-- =============================================================================
-- Order admin detail: the pieces the Shopify-style order screen needs.
--
--   * tags            — free labels the merchant files an order under (GIZA,
--                       "OUT CAIRO", chatbot-order, payment:instapay …), shown
--                       as a column on the list and edited on the order page.
--   * admin_note      — the staff note ("Notes" card), distinct from the
--                       customer's own `note`.
--   * cancelled/archived — order lifecycle actions from "More actions".
--   * invoice_sent_at — stamped when an invoice email goes out.
--   * order_events    — the Timeline: system events (order placed, email sent,
--                       payment pending, fulfilled) and staff comments, in one
--                       ordered stream.
-- =============================================================================

alter table public.store_orders
  add column if not exists tags             jsonb not null default '[]'::jsonb,
  add column if not exists admin_note       text,
  add column if not exists cancelled_at     timestamptz,
  add column if not exists cancel_reason    text,
  add column if not exists archived_at      timestamptz,
  add column if not exists invoice_sent_at  timestamptz,
  -- Stamped by order_restock() so a cancelled order can't be restocked twice.
  add column if not exists restocked_at     timestamptz,
  -- null | 'in_progress' | 'on_hold' — the fulfillment dropdown's soft states,
  -- which sit alongside fulfillment_status without changing what's shipped.
  add column if not exists fulfillment_hold text;

create index if not exists store_orders_archived_idx
  on public.store_orders (archived_at) where archived_at is not null;

-- The timeline. One row per thing that happened to the order.
--   actor   'system' | 'staff'
--   type    'placed' | 'comment' | 'payment' | 'refund' | 'fulfilled'
--           | 'unfulfilled' | 'invoice_sent' | 'cancelled' | 'archived'
--           | 'unarchived' | 'restocked' | 'return' | 'note'
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.store_orders (id) on delete cascade,
  actor       text not null default 'system',
  type        text not null,
  message     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;
drop policy if exists "order_events_auth_all" on public.order_events;
create policy "order_events_auth_all" on public.order_events
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- Restock a cancelled/returned order's items back onto the shelf, once.
--
-- Mirrors complete_return_request's credit side: each tracked line goes back to
-- the location that already stocks it, else the default. restocked_at makes it
-- idempotent — a second call returns 0 and moves nothing.
-- =============================================================================
create or replace function public.order_restock(p_order_number text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   record;
  v_line    record;
  v_tracked boolean;
  v_target  uuid;
  v_count   integer := 0;
begin
  select * into v_order from store_orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.restocked_at is not null then
    return 0;  -- already restocked; do nothing
  end if;

  for v_line in
    select item_id, quantity, product_name
      from store_order_items
     where order_id = v_order.id and item_id is not null
  loop
    select tracked into v_tracked from inventory_items where id = v_line.item_id;
    if coalesce(v_tracked, false) = false then
      continue;
    end if;

    select location_id into v_target
      from inventory_levels
     where item_id = v_line.item_id
     order by on_hand desc
     limit 1;
    if v_target is null then
      select id into v_target from locations order by is_default desc, created_at asc limit 1;
    end if;
    if v_target is null then
      continue;
    end if;

    insert into inventory_levels (item_id, location_id, on_hand)
    values (v_line.item_id, v_target, v_line.quantity)
    on conflict (item_id, location_id)
      do update set on_hand = inventory_levels.on_hand + excluded.on_hand;

    v_count := v_count + v_line.quantity;
  end loop;

  update store_orders set restocked_at = now() where id = v_order.id;
  return v_count;
end $$;
