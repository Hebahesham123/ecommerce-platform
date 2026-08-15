-- =============================================================================
-- Theme file edits — makes editing a theme's source reversible.
--
-- The edited file itself is written straight back to storage, so rendering
-- needs no extra lookup. This table keeps the ORIGINAL text of each file the
-- first time it is edited, which gives us two things:
--
--   * "Revert" restores the uploaded original, even after many edits
--   * the editor can flag which files have been changed since upload
--
-- Only text files are editable, so the stored originals stay small.
-- Non-destructive; safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.theme_file_edits (
  id               uuid primary key default gen_random_uuid(),
  theme_id         uuid not null references public.themes (id) on delete cascade,
  -- Path relative to the theme's storage prefix, e.g. "sections/header.liquid".
  path             text not null,
  original_content text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (theme_id, path)
);

create index if not exists theme_file_edits_theme_idx
  on public.theme_file_edits (theme_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists theme_file_edits_set_updated_at on public.theme_file_edits;
create trigger theme_file_edits_set_updated_at
  before update on public.theme_file_edits
  for each row execute function public.set_updated_at();

alter table public.theme_file_edits enable row level security;

drop policy if exists "theme_file_edits_auth_all" on public.theme_file_edits;
create policy "theme_file_edits_auth_all" on public.theme_file_edits
  for all to authenticated using (true) with check (true);
