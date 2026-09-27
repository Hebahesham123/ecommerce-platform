-- =============================================================================
-- Paymob online card payments.
--
-- One row per checkout we start with Paymob, keyed by the unique reference we
-- send them (special_reference). The webhook, which arrives later and out of
-- band, uses it to find which order was paid — and transaction_id makes
-- recording idempotent, so Paymob retrying the callback can't pay an order
-- twice.
--
-- Credentials themselves are NOT here; they live in store_settings.data.paymob
-- (entered on the Payment integration screen) or in env.
-- =============================================================================

create table if not exists public.paymob_payments (
  special_reference text primary key,
  order_number      text not null,
  amount            numeric(12,2) not null default 0,
  status            text not null default 'pending',  -- pending | paid | failed
  transaction_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists paymob_payments_order_idx on public.paymob_payments (order_number);
create index if not exists paymob_payments_txn_idx   on public.paymob_payments (transaction_id) where transaction_id is not null;

alter table public.paymob_payments enable row level security;
drop policy if exists "paymob_payments_auth_all" on public.paymob_payments;
create policy "paymob_payments_auth_all" on public.paymob_payments
  for all to authenticated using (true) with check (true);
