-- =============================================================================
-- Navigation — the menus a theme renders (header drawer, mega menu, footer).
--
--   navigation_menus  → one menu per handle ('main-menu', 'footer', …). Themes
--                       look menus up by handle, e.g. linklists[settings.menu].
--   navigation_items  → a self-referencing tree. parent_id NULL is a top-level
--                       entry; children nest arbitrarily deep (the editor caps
--                       at three levels: BAGS → FOOTWEAR → FOR WOMEN → …).
--
-- `url` holds a storefront path ('/collections/bags', '/products/x', '/cart',
-- or anything custom), so an item can point at absolutely anything.
-- Non-destructive; safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.navigation_menus (
  id         uuid primary key default gen_random_uuid(),
  handle     text not null unique,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.navigation_items (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references public.navigation_menus (id) on delete cascade,
  parent_id  uuid references public.navigation_items (id) on delete cascade,
  title      text not null,
  url        text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists navigation_items_menu_idx
  on public.navigation_items (menu_id, parent_id, position);

-- ---- updated_at trigger -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists navigation_menus_set_updated_at on public.navigation_menus;
create trigger navigation_menus_set_updated_at
  before update on public.navigation_menus
  for each row execute function public.set_updated_at();

-- ---- RLS (admin/authenticated; storefront reads via service role) -----------
alter table public.navigation_menus enable row level security;
alter table public.navigation_items enable row level security;

drop policy if exists "navigation_menus_auth_all" on public.navigation_menus;
create policy "navigation_menus_auth_all" on public.navigation_menus
  for all to authenticated using (true) with check (true);

drop policy if exists "navigation_items_auth_all" on public.navigation_items;
create policy "navigation_items_auth_all" on public.navigation_items
  for all to authenticated using (true) with check (true);

-- ---- Seed the two menus every theme expects --------------------------------
insert into public.navigation_menus (handle, title)
values ('main-menu', 'Main menu'), ('footer', 'Footer')
on conflict (handle) do nothing;
