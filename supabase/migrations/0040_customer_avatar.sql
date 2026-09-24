-- =============================================================================
-- Customers · a face to go with the name
-- =============================================================================
-- The account page drew two initials in a circle, which is what you show when
-- you have nothing — and there was no way to give it anything. A customer can
-- now set her own picture.
--
-- Only the URL is kept here. The image itself goes to the files bucket under a
-- random name, so the address of a customer's photo gives away nothing about
-- who she is — a path built from her phone number would have published it to
-- anyone the link reached.
--
-- The table this adds to comes from 0012_customers.sql, and it is repeated
-- below because a store can reach this migration without ever having run that
-- one: the storefront treats the customer profile as optional and falls back to
-- whatever the last order said. That fallback hides the absence rather than
-- fixing it — a shop with no store_customers table cannot save a profile, a
-- birthday, or anything else a customer types about herself. Both statements
-- are "if not exists", so this is a no-op where 0012 has already run and the
-- repair where it has not.
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

-- The shared trigger from 0002_content_files.sql. Guarded, because a store that
-- has not run that one either should get a table rather than an error.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists store_customers_set_updated_at on public.store_customers;
    create trigger store_customers_set_updated_at
      before update on public.store_customers
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.store_customers enable row level security;
drop policy if exists "store_customers_auth_all" on public.store_customers;
create policy "store_customers_auth_all" on public.store_customers
  for all to authenticated using (true) with check (true);

-- ---- The picture ------------------------------------------------------------
alter table public.store_customers
  add column if not exists avatar_url text;
