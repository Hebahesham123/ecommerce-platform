-- =============================================================================
-- Exclusive offers and targeted popups.
--
--   customer_offers   → an offer made for one named customer from her page in
--                       the dashboard: a code only her phone can use, and
--                       whether it should pop up for her the next time she
--                       browses.
--   nudge_campaigns   → several campaigns at once, each aimed at an audience
--                       (everyone, guests, signed-in shoppers, named customers,
--                       shoppers with a basket), at products or collections,
--                       at the website, the theme storefront and/or the app,
--                       and handing out either one shared code or a code made
--                       for each shopper.
--
-- Safe to run more than once. Needs 0020_nudges.sql and 0053.
-- =============================================================================

create table if not exists public.customer_offers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  code          text not null,
  -- "15% off", "EGP 200 off" — what the dashboard and the popup call it.
  label         text not null default '',
  -- The merchant's own words to her.
  message       text not null default '',
  value_type    text not null default 'percentage',
  value         numeric(12,2) not null default 0,
  min_amount    numeric(12,2),
  ends_at       timestamptz not null,
  -- Show it in a popup the next time she is browsing.
  popup         boolean not null default true,
  -- Seconds on a page before it appears.
  popup_seconds integer not null default 8,
  created_at    timestamptz not null default now(),
  shown_at      timestamptz,
  claimed_at    timestamptz,
  cancelled_at  timestamptz
);
create index if not exists customer_offers_phone_idx on public.customer_offers (phone, created_at desc);
create index if not exists customer_offers_code_idx  on public.customer_offers (code);

alter table public.customer_offers enable row level security;
drop policy if exists "customer_offers_auth_all" on public.customer_offers;
create policy "customer_offers_auth_all" on public.customer_offers
  for all to authenticated using (true) with check (true);

-- ---- Campaign targeting -------------------------------------------------------
alter table public.nudge_campaigns add column if not exists priority integer not null default 0;
-- web | shop | app
alter table public.nudge_campaigns add column if not exists channels jsonb not null default '["web","shop","app"]'::jsonb;
-- everyone | guests | signed_in | customers | with_cart
alter table public.nudge_campaigns add column if not exists audience text not null default 'everyone';
alter table public.nudge_campaigns add column if not exists audience_phones jsonb not null default '[]'::jsonb;
-- Empty means any product / any collection.
alter table public.nudge_campaigns add column if not exists product_ids jsonb not null default '[]'::jsonb;
alter table public.nudge_campaigns add column if not exists collection_handles jsonb not null default '[]'::jsonb;
-- shared: the campaign's own code. unique: a code made for each shopper.
alter table public.nudge_campaigns add column if not exists code_mode text not null default 'shared';
alter table public.nudge_campaigns add column if not exists unique_value_type text not null default 'percentage';
alter table public.nudge_campaigns add column if not exists unique_value numeric(12,2) not null default 10;
alter table public.nudge_campaigns add column if not exists unique_hours integer not null default 24;
alter table public.nudge_campaigns add column if not exists unique_min_amount numeric(12,2);

-- The style list grew a scratch card after the first migration.
alter table public.nudge_campaigns drop constraint if exists nudge_campaigns_style_check;
alter table public.nudge_campaigns add constraint nudge_campaigns_style_check
  check (style in ('card', 'wheel', 'capture', 'scratch'));

create index if not exists nudge_events_code_idx on public.nudge_events (lower(code));
