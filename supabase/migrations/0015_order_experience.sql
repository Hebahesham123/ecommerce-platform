-- =============================================================================
-- Post-purchase experience: the customer's preferred delivery date/time and a
-- 1–5 star rating of the store, captured on the thank-you page.
-- =============================================================================
alter table public.store_orders
  add column if not exists preferred_delivery_date date,
  add column if not exists preferred_delivery_slot text,
  add column if not exists rating smallint;
