-- =============================================================================
-- Shopper tracking: what each customer looks at, adds and leaves behind.
--
--   shopper_visitors → one row per browser or phone. Anonymous until the
--                      shopper signs in or orders, then tied to her phone, and
--                      everything recorded before that joins her profile.
--   shopper_events   → what she did: products and collections viewed,
--                      searches, adds and removes, checkout started, orders,
--                      offers shown and claimed.
--   shopper_carts    → the basket as she last left it, so the dashboard can
--                      see an abandoned cart and who it belongs to.
--
-- Pageviews stay in site_events; a customer's timeline reads both, through
-- the visitor ids linked to her phone.
--
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.shopper_visitors (
  visitor_id  text primary key,
  -- The customer this browser or phone belongs to, once known.
  phone       text,
  -- web | app | shop
  channel     text not null default 'web',
  -- ios | android | web
  platform    text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  linked_at   timestamptz
);
create index if not exists shopper_visitors_phone_idx on public.shopper_visitors (phone);
create index if not exists shopper_visitors_seen_idx  on public.shopper_visitors (last_seen desc);

create table if not exists public.shopper_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  visitor_id   text not null,
  phone        text,
  channel      text not null default 'web',
  -- product_view | collection_view | search | add_to_cart | remove_from_cart
  -- | checkout_start | order | offer_shown | offer_claimed
  type         text not null,
  path         text,
  product_id   text,
  product_name text,
  image_url    text,
  value        numeric(12,2),
  quantity     integer,
  meta         jsonb not null default '{}'::jsonb
);
create index if not exists shopper_events_phone_idx   on public.shopper_events (phone, created_at desc);
create index if not exists shopper_events_visitor_idx on public.shopper_events (visitor_id, created_at desc);
create index if not exists shopper_events_type_idx    on public.shopper_events (type, created_at desc);
create index if not exists shopper_events_product_idx on public.shopper_events (product_id);

create table if not exists public.shopper_carts (
  visitor_id   text primary key,
  phone        text,
  channel      text not null default 'web',
  -- [{ itemId, name, imageUrl, price, quantity }]
  items        jsonb not null default '[]'::jsonb,
  item_count   integer not null default 0,
  subtotal     numeric(12,2) not null default 0,
  updated_at   timestamptz not null default now(),
  -- Set when an order was placed after the basket last changed.
  ordered_at   timestamptz,
  order_number text
);
create index if not exists shopper_carts_phone_idx   on public.shopper_carts (phone);
create index if not exists shopper_carts_updated_idx on public.shopper_carts (updated_at desc);

-- ---- One call per beacon: seen now, and tied to a phone if one is known -------
-- Returns the phone this visitor belongs to (which may be one learned earlier),
-- and the first time a phone is learned it is written back onto everything the
-- visitor did before signing in.
create or replace function public.shopper_touch(
  p_visitor text,
  p_phone text,
  p_channel text,
  p_platform text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prev  text;
  known text;
begin
  select phone into prev from shopper_visitors where visitor_id = p_visitor;

  insert into shopper_visitors (visitor_id, phone, channel, platform, linked_at)
  values (
    p_visitor,
    nullif(p_phone, ''),
    coalesce(nullif(p_channel, ''), 'web'),
    nullif(p_platform, ''),
    case when nullif(p_phone, '') is not null then now() end
  )
  on conflict (visitor_id) do update
    set last_seen = now(),
        platform  = coalesce(excluded.platform, shopper_visitors.platform),
        phone     = coalesce(excluded.phone, shopper_visitors.phone),
        linked_at = case
                      when excluded.phone is not null
                       and excluded.phone is distinct from shopper_visitors.phone
                      then now()
                      else shopper_visitors.linked_at
                    end
  returning phone into known;

  if known is not null and known is distinct from prev then
    update shopper_events set phone = known where visitor_id = p_visitor and phone is null;
    update shopper_carts  set phone = known where visitor_id = p_visitor and phone is null;
  end if;

  return known;
end $$;

-- Only the server may tie a visitor to a phone. Callable by the public key, it
-- would let anyone attach any browser's history to any customer.
revoke all on function public.shopper_touch(text, text, text, text) from public, anon, authenticated;
grant execute on function public.shopper_touch(text, text, text, text) to service_role;

-- ---- RLS ----------------------------------------------------------------------
-- Written by the storefront through the service role; read by the dashboard.
alter table public.shopper_visitors enable row level security;
alter table public.shopper_events   enable row level security;
alter table public.shopper_carts    enable row level security;

drop policy if exists "shopper_visitors_auth_all" on public.shopper_visitors;
create policy "shopper_visitors_auth_all" on public.shopper_visitors
  for all to authenticated using (true) with check (true);

drop policy if exists "shopper_events_auth_all" on public.shopper_events;
create policy "shopper_events_auth_all" on public.shopper_events
  for all to authenticated using (true) with check (true);

drop policy if exists "shopper_carts_auth_all" on public.shopper_carts;
create policy "shopper_carts_auth_all" on public.shopper_carts
  for all to authenticated using (true) with check (true);
