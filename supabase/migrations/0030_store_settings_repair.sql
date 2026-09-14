-- =============================================================================
-- Put store_settings back into the shape the Settings screen expects.
--
-- 0005 declares this table as (id text, data jsonb, created_at, updated_at),
-- and the Settings screen reads and writes it that way: it selects "data" and
-- addresses the row as id = 'default'.
--
-- What is actually in this database is (id integer, settings jsonb,
-- updated_at). A table of that name was already there when 0005 was run, and
-- "create table if not exists" skips the entire definition rather than
-- reconciling it -- so 0005 did nothing, twice, and every save has been
-- failing on a column that is not there.
--
-- Dropping is safe here and only here: the Settings screen has never written
-- anything, because the column it writes to does not exist. The guard below
-- checks exactly that. A table that does have a "data" column may well hold
-- real settings, so this file leaves it alone and is safe to run again.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'store_settings'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_settings'
      and column_name = 'data'
  ) then
    drop table public.store_settings cascade;
  end if;
end $$;

create extension if not exists "pgcrypto";

create table if not exists public.store_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values ('default')
  on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

drop policy if exists "store_settings_auth_all" on public.store_settings;
create policy "store_settings_auth_all" on public.store_settings
  for all to authenticated using (true) with check (true);
