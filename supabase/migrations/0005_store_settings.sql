-- =============================================================================
-- Store settings — Shopify-style settings, stored as a single JSON document.
-- =============================================================================
create extension if not exists "pgcrypto";

create table if not exists public.store_settings (
  id         text primary key default 'default',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values ('default') on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;
drop policy if exists "store_settings_auth_all" on public.store_settings;
create policy "store_settings_auth_all" on public.store_settings
  for all to authenticated using (true) with check (true);
