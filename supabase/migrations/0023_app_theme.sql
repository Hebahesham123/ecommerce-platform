-- =============================================================================
-- The app's theme.
--
-- The website's look lives in an uploaded Liquid theme: files, sections, CSS.
-- None of that is any use to an app, which draws its own screens in native
-- code and needs to be *told* what to draw rather than handed markup.
--
-- So the app's theme is data. `settings` is the brand — name, logo, accent
-- colour, the announcement bar. `blocks` is the home screen: an ordered list
-- of typed blocks, each with its own settings, exactly as a theme's
-- templates/index.json would be, minus the rendering.
--
-- One row, like meta_connection. A store has one app.
-- =============================================================================

create table if not exists public.app_theme (
  id          text primary key default 'default',
  settings    jsonb not null default '{}'::jsonb,
  -- [{ id, type, settings: {...} }] — order in the array is order on screen.
  blocks      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.app_theme (id) values ('default') on conflict (id) do nothing;

alter table public.app_theme enable row level security;

-- Read-only to anyone: the app fetches this before a shopper has signed in,
-- and none of it is private — it is the shop's own branding. Writes go through
-- the service role from the dashboard.
drop policy if exists app_theme_read on public.app_theme;
create policy app_theme_read on public.app_theme for select using (true);
