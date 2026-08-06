-- =============================================================================
-- Theme customization — where every link/button in an uploaded theme points.
--
-- Themes express links two ways, so we store both:
--
--   settings  → overrides for GLOBAL theme settings (config/settings_schema.json)
--   sections  → overrides per section instance, keyed "<scope>::<instanceId>",
--               e.g. "templates/index::featured" → { settings, blocks }
--               These cover schema-declared settings of type url / collection /
--               product / collection_list / product_list.
--   links     → [{ from, to, label }] rewrites for anchors hardcoded in Liquid
--               that have no setting behind them. Matched on the raw href in
--               the theme source, so they hold across mounts (/shop, preview).
--
-- One row per theme; deleting a theme drops its customization.
-- Non-destructive; safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.theme_customizations (
  theme_id   uuid primary key references public.themes (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  sections   jsonb not null default '{}'::jsonb,
  links      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists theme_customizations_set_updated_at on public.theme_customizations;
create trigger theme_customizations_set_updated_at
  before update on public.theme_customizations
  for each row execute function public.set_updated_at();

alter table public.theme_customizations enable row level security;

drop policy if exists "theme_customizations_auth_all" on public.theme_customizations;
create policy "theme_customizations_auth_all" on public.theme_customizations
  for all to authenticated using (true) with check (true);
