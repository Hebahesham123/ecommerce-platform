-- =============================================================================
-- Two sales channels, one store.
--
-- Everything a shopper does can now arrive from the website or from a mobile
-- app, and the dashboard has to be able to tell them apart — in orders, in
-- returns, in enquiries, in reviews — without any of it becoming a second copy
-- of the store. There is deliberately no second inventory, no second order
-- table and no second checkout: a channel is a label on the same row, written
-- by whichever surface created it.
--
-- 'web' is the default everywhere, so every row that already exists is
-- correctly attributed to the website without a backfill.
-- =============================================================================

-- ---- Where each thing came from --------------------------------------------
alter table public.store_orders
  add column if not exists channel text not null default 'web';
alter table public.return_requests
  add column if not exists channel text not null default 'web';
alter table public.store_requests
  add column if not exists channel text not null default 'web';
alter table public.store_reviews
  add column if not exists channel text not null default 'web';

-- Kept as free text rather than an enum: a third surface (a kiosk, a WhatsApp
-- catalogue) should not need a migration and a deploy to start reporting.
create index if not exists store_orders_channel_idx    on public.store_orders (channel, created_at desc);
create index if not exists return_requests_channel_idx on public.return_requests (channel);
create index if not exists store_requests_channel_idx  on public.store_requests (channel);
create index if not exists store_reviews_channel_idx   on public.store_reviews (channel);

-- ---- Meta, per channel ------------------------------------------------------
-- A pixel measures a website and an app dataset measures an app; Meta treats
-- them as different data sources with different tokens. Reusing one set of
-- credentials for both would file app purchases as web traffic and corrupt the
-- attribution the merchant is paying for.
--
-- The existing pixel_id / capi_token stay the WEBSITE's, so nothing already
-- connected has to be re-entered.
alter table public.meta_connection
  add column if not exists app_dataset_id  text,
  add column if not exists app_capi_token  text,
  add column if not exists app_capi_enabled boolean not null default false;

comment on column public.meta_connection.app_dataset_id is
  'Meta dataset id for the mobile app (Events Manager treats an app as its own data source).';
comment on column public.meta_connection.app_capi_token is
  'Conversions API token for the app dataset. Server-only.';
