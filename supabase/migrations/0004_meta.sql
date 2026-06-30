-- =============================================================================
-- Meta (Facebook/Instagram) integration — Commerce Manager: Pixel, Catalog, Events
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- Connection (single row, key = 'default') -------------------------------
create table if not exists public.meta_connection (
  id                  text primary key default 'default',
  connected           boolean not null default false,

  -- OAuth identity + token
  fb_user_id          text,
  fb_user_name        text,
  access_token        text,          -- long-lived user/system token (sensitive)
  token_expires_at    timestamptz,
  scopes              text,

  -- Selected assets
  business_id         text,
  business_name       text,
  pixel_id            text,          -- a.k.a. dataset id (used by Pixel + CAPI)
  pixel_name          text,
  catalog_id          text,
  catalog_name        text,
  page_id             text,
  instagram_id        text,

  -- Fetched options for the selection UI: { businesses:[], pixels:[], catalogs:[] }
  available           jsonb not null default '{}'::jsonb,

  -- Settings
  pixel_enabled       boolean not null default true,
  capi_enabled        boolean not null default false,
  test_event_code     text,

  -- Catalog sync bookkeeping
  last_catalog_sync_at timestamptz,
  last_sync_count      integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Seed the singleton row.
insert into public.meta_connection (id) values ('default')
on conflict (id) do nothing;

-- ---- Event log (test/CAPI sends made from this app) -------------------------
create table if not exists public.meta_events (
  id          uuid primary key default gen_random_uuid(),
  event_name  text not null,
  event_id    text,
  source      text not null default 'test',   -- test | capi | pixel
  status      text not null default 'sent',   -- sent | error
  payload     jsonb,
  response    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists meta_events_created_idx on public.meta_events (created_at desc);

-- ---- updated_at trigger -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists meta_connection_set_updated_at on public.meta_connection;
create trigger meta_connection_set_updated_at
  before update on public.meta_connection
  for each row execute function public.set_updated_at();

-- ---- RLS --------------------------------------------------------------------
alter table public.meta_connection enable row level security;
alter table public.meta_events enable row level security;

drop policy if exists "meta_connection_auth_all" on public.meta_connection;
create policy "meta_connection_auth_all" on public.meta_connection
  for all to authenticated using (true) with check (true);

drop policy if exists "meta_events_auth_all" on public.meta_events;
create policy "meta_events_auth_all" on public.meta_events
  for all to authenticated using (true) with check (true);
