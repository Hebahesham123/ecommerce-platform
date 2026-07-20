-- =============================================================================
-- Inventory & Locations — Shopify-parity multi-location inventory
--
--   locations         → physical/virtual places that hold stock
--   inventory_items   → a stock-keeping unit (product variant + SKU)
--   inventory_levels  → quantity of one item at one location
--
-- Available is derived: available = on_hand - committed. Committed is the qty
-- reserved by open (unfulfilled) orders; incoming is on a purchase order.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- Locations --------------------------------------------------------------
create table if not exists public.locations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  code                    text,                       -- short label e.g. "CAI-01"
  address                 text,
  city                    text,
  governorate             text,
  country                 text not null default 'EG',
  phone                   text,
  is_active               boolean not null default true,
  is_default              boolean not null default false,   -- one default location
  fulfills_online_orders  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Only one default location at a time.
create unique index if not exists locations_one_default_idx
  on public.locations (is_default) where is_default;

-- ---- Inventory items (SKUs / variants) --------------------------------------
create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  product_name  text not null,
  variant_title text,                                 -- e.g. "M / أحمر"
  sku           text,
  barcode       text,
  category      text,
  price         numeric(12,2),
  cost          numeric(12,2),
  tracked       boolean not null default true,        -- Shopify "track quantity"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists inventory_items_sku_idx on public.inventory_items (sku);

-- ---- Inventory levels (item × location) -------------------------------------
create table if not exists public.inventory_levels (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.inventory_items (id) on delete cascade,
  location_id  uuid not null references public.locations (id) on delete cascade,
  on_hand      integer not null default 0,
  committed    integer not null default 0,
  incoming     integer not null default 0,
  -- available is what you can actually sell right now
  available    integer generated always as (on_hand - committed) stored,
  updated_at   timestamptz not null default now(),
  unique (item_id, location_id)
);

create index if not exists inventory_levels_item_idx on public.inventory_levels (item_id);
create index if not exists inventory_levels_location_idx on public.inventory_levels (location_id);

-- ---- updated_at triggers ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_levels_set_updated_at on public.inventory_levels;
create trigger inventory_levels_set_updated_at
  before update on public.inventory_levels
  for each row execute function public.set_updated_at();

-- When a brand new item is created, seed a zero level at every location so it
-- shows up everywhere in the inventory grid.
create or replace function public.seed_inventory_levels()
returns trigger language plpgsql as $$
begin
  insert into public.inventory_levels (item_id, location_id, on_hand)
  select new.id, l.id, 0 from public.locations l
  on conflict (item_id, location_id) do nothing;
  return new;
end $$;

drop trigger if exists inventory_items_seed_levels on public.inventory_items;
create trigger inventory_items_seed_levels
  after insert on public.inventory_items
  for each row execute function public.seed_inventory_levels();

-- Likewise, a new location gets a zero level for every existing item.
create or replace function public.seed_location_levels()
returns trigger language plpgsql as $$
begin
  insert into public.inventory_levels (item_id, location_id, on_hand)
  select i.id, new.id, 0 from public.inventory_items i
  on conflict (item_id, location_id) do nothing;
  return new;
end $$;

drop trigger if exists locations_seed_levels on public.locations;
create trigger locations_seed_levels
  after insert on public.locations
  for each row execute function public.seed_location_levels();

-- ---- RLS --------------------------------------------------------------------
alter table public.locations        enable row level security;
alter table public.inventory_items  enable row level security;
alter table public.inventory_levels enable row level security;

drop policy if exists "locations_auth_all" on public.locations;
create policy "locations_auth_all" on public.locations
  for all to authenticated using (true) with check (true);

drop policy if exists "inventory_items_auth_all" on public.inventory_items;
create policy "inventory_items_auth_all" on public.inventory_items
  for all to authenticated using (true) with check (true);

drop policy if exists "inventory_levels_auth_all" on public.inventory_levels;
create policy "inventory_levels_auth_all" on public.inventory_levels
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- Seed data — two locations + the demo fashion catalog, so the UI is populated
-- on a fresh database. Safe to re-run (guarded by NOT EXISTS).
-- =============================================================================
do $$
declare
  loc_cairo uuid;
  loc_alex  uuid;
begin
  if exists (select 1 from public.locations) then
    return; -- already seeded
  end if;

  insert into public.locations (name, code, city, governorate, is_default, fulfills_online_orders)
    values ('المخزن الرئيسي', 'CAI-01', 'القاهرة', 'القاهرة', true, true)
    returning id into loc_cairo;

  insert into public.locations (name, code, city, governorate, is_default, fulfills_online_orders)
    values ('فرع الإسكندرية', 'ALX-01', 'الإسكندرية', 'الإسكندرية', false, true)
    returning id into loc_alex;

  -- Catalog items (mirrors src/lib/data.ts demo products). The seed_levels
  -- trigger already created zero rows at both locations; we set real numbers.
  with seeded as (
    insert into public.inventory_items (product_name, sku, category, price)
    values
      ('فستان كتان صيفي',  'DR-LIN-01', 'فساتين',  850),
      ('بلوزة حرير',       'TP-SLK-04', 'بلوزات',  540),
      ('بنطلون واسع',      'PT-WID-02', 'بناطيل',  690),
      ('جاكيت دنيم',       'JK-DNM-03', 'جاكيتات', 1200),
      ('تنورة ميدي',       'SK-MID-07', 'تنانير',  480),
      ('عباية مطرزة',      'AB-EMB-09', 'عبايات',  1650)
    returning id, sku
  )
  update public.inventory_levels lv
  set on_hand = v.on_hand, committed = v.committed
  from seeded s
  join (values
    ('DR-LIN-01', 30, 2),
    ('TP-SLK-04',  6, 1),
    ('PT-WID-02',  0, 0),
    ('JK-DNM-03', 18, 0),
    ('SK-MID-07',  4, 1),
    ('AB-EMB-09', 24, 3)
  ) as v(sku, on_hand, committed) on v.sku = s.sku
  where lv.item_id = s.id and lv.location_id = loc_cairo;

  -- Alexandria branch holds a smaller buffer stock.
  update public.inventory_levels lv
  set on_hand = v.on_hand
  from public.inventory_items i
  join (values
    ('DR-LIN-01', 12),
    ('TP-SLK-04',  2),
    ('PT-WID-02',  5),
    ('JK-DNM-03',  5),
    ('SK-MID-07',  1),
    ('AB-EMB-09',  7)
  ) as v(sku, on_hand) on v.sku = i.sku
  where lv.item_id = i.id and lv.location_id = loc_alex;
end $$;
