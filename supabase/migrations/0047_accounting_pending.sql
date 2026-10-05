-- =============================================================================
-- Accountant approval queue + courier collection method.
--
-- A confirmed order payment no longer posts straight to the double-entry books.
-- It lands here as a PENDING entry; the accountant opens the Pending screen in
-- Accounting and confirms "add this line" (which posts the journal entry) or
-- rejects it. This keeps a human gate between operations and the ledger.
--
-- Couriers also say HOW they collected (cash / InstaPay / card / wallet), so the
-- books — and the per-method totals — reflect the real channel, not just "COD".
-- =============================================================================

create table if not exists public.pending_entries (
  id               uuid primary key default gen_random_uuid(),
  order_number     text,
  source           text not null default 'payment',   -- cod | card | paymob | payment | manual
  method           text,                               -- cash | instapay | card | wallet | bank_transfer | cod
  amount           numeric(12,2) not null default 0,
  courier_id       uuid references public.couriers (id) on delete set null,
  note             text,
  status           text not null default 'pending'
                     check (status in ('pending','posted','rejected')),
  journal_entry_id uuid references public.journal_entries (id) on delete set null,
  decided_by       text,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

create index if not exists pending_entries_status_idx  on public.pending_entries (status, created_at desc);
create index if not exists pending_entries_method_idx  on public.pending_entries (method);
create index if not exists pending_entries_order_idx   on public.pending_entries (order_number);

alter table public.pending_entries enable row level security;
drop policy if exists "pending_entries_auth_all" on public.pending_entries;
create policy "pending_entries_auth_all" on public.pending_entries
  for all to authenticated using (true) with check (true);

-- How the courier actually collected (their reported method + the confirmed one).
alter table public.courier_shipments
  add column if not exists reported_method  text,
  add column if not exists collected_method text;
