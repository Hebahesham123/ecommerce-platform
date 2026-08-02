-- =============================================================================
-- Inventory items: richer product fields — description + image.
-- (product_name already acts as the title.) Non-destructive; safe to re-run.
-- =============================================================================

alter table public.inventory_items
  add column if not exists description text,
  add column if not exists image_url   text;
