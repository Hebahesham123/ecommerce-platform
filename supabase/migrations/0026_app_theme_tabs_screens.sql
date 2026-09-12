-- =============================================================================
-- Tabs and screens belong in the row too.
--
-- The app's theme is four things: the brand, the home screen's blocks, the tab
-- bar, and the wording of the screens below home. Only the first two had
-- columns, so the editor let a merchant arrange their tabs and rename their
-- checkout, said "Saved", and dropped both on the floor. A Live tab could
-- never stay on.
--
-- Defaults are empty rather than the app's own defaults on purpose: an empty
-- array means "never chosen", which is exactly what normalizeTheme already
-- treats as "use the defaults". A store that has not touched its tabs keeps
-- behaving the way it does today.
-- =============================================================================

alter table public.app_theme
  add column if not exists tabs    jsonb not null default '[]'::jsonb,
  add column if not exists screens jsonb not null default '{}'::jsonb;