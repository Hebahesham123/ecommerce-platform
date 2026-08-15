-- =============================================================================
-- 0013_supplier_mapping.sql
-- Maps a local catalog item to its counterpart on the SUPPLIER Shopify store,
-- so the n8n "order relay" flow can create a draft order there and email the
-- customer a checkout link (manual-payment / dropship model).
--
-- Matching modes supported by the flow (see docs/n8n-order-relay.md):
--   1. Exact  → supplier_variant_id is set  → used directly, no guessing.
--   2. Search → left null                    → n8n searches the supplier store
--                                               by the cleaned product title
--                                               (brand/vendor stripped).
-- supplier_title optionally overrides the auto-generated search term.
-- =============================================================================

alter table public.inventory_items
  add column if not exists supplier_variant_id text,  -- Shopify variant id (numeric or gid://)
  add column if not exists supplier_url         text,  -- human-friendly supplier product URL
  add column if not exists supplier_title       text;  -- optional search-term override

comment on column public.inventory_items.supplier_variant_id is
  'Supplier Shopify ProductVariant id. When set, the order-relay flow uses it directly instead of searching.';
comment on column public.inventory_items.supplier_url is
  'Supplier product page URL (reference / fallback for manual mapping).';
comment on column public.inventory_items.supplier_title is
  'Optional override for the supplier search term. When null the flow strips the vendor/brand from product_name.';
