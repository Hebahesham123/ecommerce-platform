-- =============================================================================
-- The Beauty Bar Society's look.
--
-- The Society pages were built with their palette written into the markup -
-- the brown and beige from the design, about a hundred and fifty times over.
-- That is fine until somebody wants to change it, at which point it is a
-- hundred and fifty edits and a deploy. So the colours became named roles the
-- pages read as CSS variables, and this is where the merchant's answers live.
--
-- A table of its own rather than a key in store_settings, which this database
-- does not have: 0005 was never run here, and a feature that only works after
-- an unrelated migration somebody forgot is a feature that looks broken.
--
-- One row, like app_theme. A store has one Society.
--
-- Every statement below is safe to run again. The first attempt at this file
-- reached the database with only part of itself -- the table arrived without
-- its settings column -- so this one repairs whatever is already there rather
-- than assuming it is starting from nothing.
--
-- Note what that repair cannot do: a table that already existed keeps the key
-- column it was built with, because "create table if not exists" skips the
-- whole definition rather than reconciling it. One real database ended up with
-- an identity integer here instead of the text below. That is why the reader
-- takes the first row and the writer updates the row it finds, rather than
-- addressing 'default' by name -- a settings document nobody looks up by id has
-- no reason to care what its id is called.
-- =============================================================================

create table if not exists public.loyalty_theme (
  id text primary key default 'default'
);

-- { colours: {...}, words: {...}, tabLabels: {...} } -- the shape is defined and
-- checked in src/lib/loyalty/theme.ts, on the way in and on the way out.
alter table public.loyalty_theme
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.loyalty_theme
  add column if not exists updated_at timestamptz not null default now();

insert into public.loyalty_theme (id) values ('default')
  on conflict (id) do nothing;

alter table public.loyalty_theme enable row level security;

-- Read-only to anyone, the same as app_theme: the Society page draws this
-- before a shopper has signed in, and none of it is private - it is the shop's
-- own branding. Writes go through the service role, from the dashboard.
drop policy if exists loyalty_theme_read on public.loyalty_theme;
create policy loyalty_theme_read on public.loyalty_theme for select using (true);
