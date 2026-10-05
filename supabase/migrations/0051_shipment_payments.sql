-- =============================================================================
-- Split payments + deposit for courier shipments.
--
-- A single collection can now be made of several parts, each with its own
-- method (cash / instapay / visa machine / …), plus an optional deposit. Both
-- the admin (planning the split on the order) and the courier (recording the
-- real split in their portal) write rows here:
--   kind  = 'payment' (a collected part) | 'deposit'
--   actor = 'admin'   (the planned split) | 'courier' (what was collected)
-- The courier parts are what accounting attributes to each method; the admin
-- parts are the plan shown to the courier in their portal.
-- =============================================================================

create table if not exists public.shipment_payments (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid references public.courier_shipments(id) on delete cascade,
  order_number text,
  amount       numeric(12,2) not null default 0,
  method       text not null default 'cash',
  kind         text not null default 'payment' check (kind in ('payment','deposit')),
  actor        text,
  created_at   timestamptz not null default now()
);

create index if not exists shipment_payments_shipment_idx on public.shipment_payments (shipment_id);

alter table public.shipment_payments enable row level security;

drop policy if exists "shipment_payments_auth_all" on public.shipment_payments;
create policy "shipment_payments_auth_all" on public.shipment_payments
  for all to authenticated using (true) with check (true);
