-- =============================================================================
-- Discounts schema — Shopify-parity discount engine
-- Supports the four Shopify discount types:
--   amount_off_products | amount_off_order | buy_x_get_y | free_shipping
-- Method: code | automatic
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- Enums -------------------------------------------------------------------
do $$ begin
  create type discount_method as enum ('code', 'automatic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_type as enum (
    'amount_off_products',
    'amount_off_order',
    'buy_x_get_y',
    'free_shipping'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_value_type as enum ('percentage', 'fixed_amount');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_status as enum ('active', 'scheduled', 'expired', 'draft');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'all' | 'collections' | 'products'
  create type discount_applies_to as enum ('all', 'collections', 'products');
exception when duplicate_object then null; end $$;

do $$ begin
  -- none | minimum_amount | minimum_quantity
  create type discount_min_req as enum ('none', 'minimum_amount', 'minimum_quantity');
exception when duplicate_object then null; end $$;

do $$ begin
  -- all | segments | customers
  create type discount_eligibility as enum ('all', 'segments', 'customers');
exception when duplicate_object then null; end $$;

-- ---- Table -------------------------------------------------------------------
create table if not exists public.discounts (
  id              uuid primary key default gen_random_uuid(),

  -- Identity / method
  title           text not null,                         -- code value OR automatic-discount title
  method          discount_method not null default 'code',
  code            text,                                  -- present when method = 'code'
  discount_type   discount_type not null,
  status          discount_status not null default 'draft',

  -- Value (amount_off_products / amount_off_order / buy_x_get_y "gets")
  value_type      discount_value_type,                   -- percentage | fixed_amount
  value           numeric(12,2),                         -- percent (0-100) or EGP amount

  -- Applies to (amount_off_products / free_shipping scope)
  applies_to      discount_applies_to not null default 'all',
  applies_to_ids  jsonb not null default '[]'::jsonb,    -- collection/product ids + labels

  -- Buy X Get Y --------------------------------------------------------------
  buy_type            discount_min_req,                  -- minimum_quantity | minimum_amount
  buy_value           numeric(12,2),                     -- qty or EGP customer must buy
  buy_item_scope      discount_applies_to,               -- products | collections
  buy_item_ids        jsonb default '[]'::jsonb,
  get_quantity        integer,                           -- qty customer gets
  get_item_scope      discount_applies_to,
  get_item_ids        jsonb default '[]'::jsonb,
  get_value_type      discount_value_type,               -- percentage | fixed_amount (or 100% = free)
  get_value           numeric(12,2),
  get_is_free         boolean not null default false,
  max_uses_per_order  integer,                           -- cap on "gets" per order

  -- Free shipping --------------------------------------------------------------
  ship_countries          jsonb not null default '[]'::jsonb, -- [] = all countries
  ship_exclude_over_amount numeric(12,2),                -- exclude shipping rates over X

  -- Minimum purchase requirements
  min_requirement   discount_min_req not null default 'none',
  min_amount        numeric(12,2),
  min_quantity      integer,

  -- Customer eligibility
  eligibility       discount_eligibility not null default 'all',
  eligibility_ids   jsonb not null default '[]'::jsonb,

  -- Maximum discount uses
  usage_limit_total            integer,                  -- null = unlimited
  usage_limit_once_per_customer boolean not null default false,

  -- Combinations
  combine_product   boolean not null default false,
  combine_order     boolean not null default false,
  combine_shipping  boolean not null default false,

  -- Active dates
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,                          -- null = no end

  -- Counters / audit
  used_count        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists discounts_status_idx  on public.discounts (status);
create index if not exists discounts_method_idx  on public.discounts (method);
create index if not exists discounts_type_idx    on public.discounts (discount_type);
create index if not exists discounts_created_idx on public.discounts (created_at desc);
create unique index if not exists discounts_code_uniq
  on public.discounts (lower(code)) where code is not null;

-- ---- updated_at trigger ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists discounts_set_updated_at on public.discounts;
create trigger discounts_set_updated_at
  before update on public.discounts
  for each row execute function public.set_updated_at();

-- ---- Row Level Security ------------------------------------------------------
-- The admin app talks to Supabase with the service-role key (server-side only),
-- which bypasses RLS. We still enable RLS so the anon/public key is locked down.
alter table public.discounts enable row level security;

-- Allow authenticated dashboard users full access (adjust to your auth model).
drop policy if exists "discounts_authenticated_all" on public.discounts;
create policy "discounts_authenticated_all"
  on public.discounts for all
  to authenticated
  using (true) with check (true);

-- =============================================================================
-- Seed data (mirrors the Shopify screenshot so the UI has rows on first load)
-- =============================================================================
insert into public.discounts
  (title, method, code, discount_type, status, value_type, value, applies_to,
   min_requirement, eligibility, usage_limit_total, combine_order, starts_at, used_count)
values
  ('BB26', 'code', 'BB26', 'amount_off_order', 'active', 'percentage', 10, 'all',
   'none', 'all', null, false, now() - interval '10 days', 0),
  ('5ZN98AWYWZAF', 'code', '5ZN98AWYWZAF', 'amount_off_order', 'active', 'percentage', 30, 'all',
   'none', 'all', null, false, now() - interval '8 days', 1),
  ('TESTCLUBPOINTS-550', 'code', 'CLUB550', 'amount_off_order', 'active', 'fixed_amount', 550, 'all',
   'none', 'all', 1, false, now() - interval '6 days', 0),
  ('TESTCLUBPOINTS-2699', 'code', 'CLUB2699', 'amount_off_order', 'active', 'fixed_amount', 2699.70, 'all',
   'none', 'all', 1, false, now() - interval '6 days', 1),
  ('TESTCLUBPOINTS-2575', 'code', 'CLUB2575', 'amount_off_order', 'active', 'fixed_amount', 2575, 'all',
   'none', 'all', 1, false, now() - interval '5 days', 0)
on conflict do nothing;

-- Buy X Get Y (automatic, expired) — matches B2G2P row in the screenshot
insert into public.discounts
  (title, method, discount_type, status, buy_type, buy_value, buy_item_scope,
   get_quantity, get_item_scope, get_is_free, eligibility, starts_at, ends_at)
values
  ('Buy 2 items, get 2 items free', 'automatic', 'buy_x_get_y', 'expired',
   'minimum_quantity', 2, 'all', 2, 'all', true, 'all',
   now() - interval '30 days', now() - interval '2 days')
on conflict do nothing;
