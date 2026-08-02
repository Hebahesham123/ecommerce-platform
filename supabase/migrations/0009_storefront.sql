-- =============================================================================
-- Storefront: real orders placed from the shop (COD), phone verification memory.
-- The storefront reads/writes through server actions (service role), so these
-- tables only need RLS for the authenticated admin.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- Orders -----------------------------------------------------------------
create table if not exists public.store_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique,
  customer_name      text not null,
  phone              text not null,
  governorate        text,
  city               text,
  address            text,
  note               text,
  subtotal           numeric(12,2) not null default 0,
  shipping           numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  payment_method     text not null default 'cod',
  payment_status     text not null default 'pending',   -- pending | paid | refunded
  fulfillment_status text not null default 'unfulfilled',
  lifecycle          text not null default 'placed',
  created_at         timestamptz not null default now()
);
create index if not exists store_orders_created_idx on public.store_orders (created_at desc);
create index if not exists store_orders_phone_idx on public.store_orders (phone);

create table if not exists public.store_order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.store_orders (id) on delete cascade,
  item_id       uuid references public.inventory_items (id) on delete set null,
  product_name  text not null,
  variant_title text,
  sku           text,
  image_url     text,
  price         numeric(12,2) not null default 0,
  quantity      integer not null default 1
);
create index if not exists store_order_items_order_idx on public.store_order_items (order_id);

-- ---- Phone verification memory ---------------------------------------------
create table if not exists public.verified_phones (
  phone       text primary key,
  name        text,
  verified_at timestamptz not null default now()
);

create table if not exists public.otp_codes (
  phone      text primary key,
  code       text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---- RLS (admin/authenticated; storefront uses service role) ----------------
alter table public.store_orders      enable row level security;
alter table public.store_order_items enable row level security;
alter table public.verified_phones   enable row level security;
alter table public.otp_codes         enable row level security;

drop policy if exists "store_orders_auth_all" on public.store_orders;
create policy "store_orders_auth_all" on public.store_orders for all to authenticated using (true) with check (true);
drop policy if exists "store_order_items_auth_all" on public.store_order_items;
create policy "store_order_items_auth_all" on public.store_order_items for all to authenticated using (true) with check (true);
drop policy if exists "verified_phones_auth_all" on public.verified_phones;
create policy "verified_phones_auth_all" on public.verified_phones for all to authenticated using (true) with check (true);
drop policy if exists "otp_codes_auth_all" on public.otp_codes;
create policy "otp_codes_auth_all" on public.otp_codes for all to authenticated using (true) with check (true);

-- ---- Atomic stock decrement helper -----------------------------------------
-- Reduces on_hand for an item at its default (or any) location, floored at 0.
create or replace function public.decrement_stock(p_item uuid, p_qty integer)
returns void language plpgsql security definer as $$
declare
  target uuid;
begin
  select location_id into target
  from public.inventory_levels
  where item_id = p_item
  order by on_hand desc
  limit 1;
  if target is not null then
    update public.inventory_levels
    set on_hand = greatest(0, on_hand - p_qty)
    where item_id = p_item and location_id = target;
  end if;
end $$;
