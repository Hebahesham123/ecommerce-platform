-- =============================================================================
-- Inventory items: professional product fields
--   pricing:      compare_at_price (for sale/RRP)
--   status:       active | draft | archived
--   organization: vendor, product_type, tags[]
--   media:        images[] gallery (image_url stays the primary/first image)
-- Non-destructive; safe to re-run.
-- =============================================================================

alter table public.inventory_items
  add column if not exists compare_at_price numeric(12,2),
  add column if not exists status           text not null default 'active',
  add column if not exists vendor           text,
  add column if not exists product_type     text,
  add column if not exists tags             jsonb not null default '[]'::jsonb,
  add column if not exists images           jsonb not null default '[]'::jsonb;

create index if not exists inventory_items_status_idx on public.inventory_items (status);
