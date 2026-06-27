-- =============================================================================
-- Content · Files — media library backed by Supabase Storage
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- File kind enum ---------------------------------------------------------
do $$ begin
  create type file_kind as enum ('image', 'video', 'document', 'audio', 'other');
exception when duplicate_object then null; end $$;

-- ---- Metadata table ---------------------------------------------------------
create table if not exists public.content_files (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  alt           text,
  mime_type     text,
  kind          file_kind not null default 'other',
  size_bytes    bigint,
  width         integer,
  height        integer,
  url           text not null,              -- public URL (storage or external)
  storage_path  text,                       -- null when is_external = true
  is_external   boolean not null default false,
  folder        text not null default '',
  reference_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists content_files_kind_idx    on public.content_files (kind);
create index if not exists content_files_created_idx  on public.content_files (created_at desc);
create index if not exists content_files_name_idx     on public.content_files (lower(name));

-- ---- updated_at trigger -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists content_files_set_updated_at on public.content_files;
create trigger content_files_set_updated_at
  before update on public.content_files
  for each row execute function public.set_updated_at();

-- ---- RLS on metadata table --------------------------------------------------
alter table public.content_files enable row level security;

drop policy if exists "content_files_authenticated_all" on public.content_files;
create policy "content_files_authenticated_all"
  on public.content_files for all
  to authenticated using (true) with check (true);

-- =============================================================================
-- Storage bucket — public read so uploaded files serve via CDN URLs.
-- The admin app writes through the service-role key (bypasses RLS).
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do update set public = true;

-- Public read of objects in the 'files' bucket
drop policy if exists "files_public_read" on storage.objects;
create policy "files_public_read"
  on storage.objects for select
  using (bucket_id = 'files');

-- Authenticated dashboard users may manage objects (service role bypasses anyway)
drop policy if exists "files_authenticated_write" on storage.objects;
create policy "files_authenticated_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'files') with check (bucket_id = 'files');
