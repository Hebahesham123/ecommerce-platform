-- =============================================================================
-- Collections — merchandising groups the storefront theme renders.
--
--   collections          → the collection itself (title, handle, image, rule)
--   collection_products  → which products belong to a MANUAL collection
--
-- A "product" in this platform is the set of inventory_items sharing a
-- product_name, so a membership row stores both a representative item_id (for
-- referential integrity + rename-safety) and the product_name (as a fallback
-- if that particular variant is later deleted).
--
-- Automatic collections skip the join table and match live on a rule instead
-- (category / vendor / tag), which is how the storefront behaved before.
-- Non-destructive; safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.collections (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  handle       text not null unique,
  description  text,
  image_url    text,
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  -- 'manual' uses collection_products; the others match products live.
  rule_type    text not null default 'manual',
  rule_value   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint collections_rule_type_check
    check (rule_type in ('manual', 'category', 'vendor', 'tag'))
);

create index if not exists collections_published_idx
  on public.collections (is_published, sort_order);

create table if not exists public.collection_products (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id       uuid references public.inventory_items (id) on delete set null,
  product_name  text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (collection_id, product_name)
);

create index if not exists collection_products_collection_idx
  on public.collection_products (collection_id, position);
create index if not exists collection_products_item_idx
  on public.collection_products (item_id);

-- ---- updated_at trigger -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- ---- RLS (admin/authenticated; storefront reads via service role) -----------
alter table public.collections         enable row level security;
alter table public.collection_products enable row level security;

drop policy if exists "collections_auth_all" on public.collections;
create policy "collections_auth_all" on public.collections
  for all to authenticated using (true) with check (true);

drop policy if exists "collection_products_auth_all" on public.collection_products;
create policy "collection_products_auth_all" on public.collection_products
  for all to authenticated using (true) with check (true);
