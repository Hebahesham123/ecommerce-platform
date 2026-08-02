-- =============================================================================
-- Online Store · Themes — uploadable site themes with live preview
-- =============================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type theme_status as enum ('published', 'unpublished', 'draft');
exception when duplicate_object then null; end $$;

create table if not exists public.themes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  version       text,
  status        theme_status not null default 'unpublished',
  is_current    boolean not null default false,    -- the live/published theme
  preview_url   text,                              -- entry HTML public URL
  entry_path    text,                              -- e.g. index.html
  storage_path  text,                              -- folder prefix in bucket (themes/<id>)
  source_kind   text not null default 'zip',       -- zip | html
  size_bytes    bigint,
  file_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists themes_status_idx  on public.themes (status);
create index if not exists themes_current_idx on public.themes (is_current);
create index if not exists themes_created_idx on public.themes (created_at desc);

-- updated_at trigger (shared function)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists themes_set_updated_at on public.themes;
create trigger themes_set_updated_at
  before update on public.themes
  for each row execute function public.set_updated_at();

-- Only one theme can be current at a time
create or replace function public.themes_single_current()
returns trigger language plpgsql as $$
begin
  if new.is_current then
    update public.themes set is_current = false, status = 'unpublished'
    where id <> new.id and is_current;
  end if;
  return new;
end $$;

drop trigger if exists themes_single_current_trg on public.themes;
create trigger themes_single_current_trg
  before insert or update of is_current on public.themes
  for each row when (new.is_current) execute function public.themes_single_current();

alter table public.themes enable row level security;
drop policy if exists "themes_authenticated_all" on public.themes;
create policy "themes_authenticated_all"
  on public.themes for all to authenticated using (true) with check (true);

-- =============================================================================
-- Storage bucket for theme files (public so preview iframes can load assets)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('themes', 'themes', true)
on conflict (id) do update set public = true;

drop policy if exists "themes_public_read" on storage.objects;
create policy "themes_public_read"
  on storage.objects for select using (bucket_id = 'themes');

drop policy if exists "themes_authenticated_write" on storage.objects;
create policy "themes_authenticated_write"
  on storage.objects for all to authenticated
  using (bucket_id = 'themes') with check (bucket_id = 'themes');
