-- =============================================================================
-- Passwordless customer accounts, keyed by phone.
--
-- The verified phone IS the account. A profile row is upserted on every placed
-- order, and read back to autofill returning (verified) customers at checkout.
-- Birthday is captured optionally and used to celebrate + unlock a birthday
-- coupon. Storefront writes via the service role; admin reads via RLS.
-- =============================================================================

create table if not exists public.store_customers (
  phone        text primary key,
  name         text,
  email        text,
  birthday     date,
  governorate  text,
  city         text,
  address      text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Reuse the shared updated_at trigger from 0006_inventory.sql.
drop trigger if exists store_customers_set_updated_at on public.store_customers;
create trigger store_customers_set_updated_at
  before update on public.store_customers
  for each row execute function public.set_updated_at();

alter table public.store_customers enable row level security;
drop policy if exists "store_customers_auth_all" on public.store_customers;
create policy "store_customers_auth_all" on public.store_customers
  for all to authenticated using (true) with check (true);
