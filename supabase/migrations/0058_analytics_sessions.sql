-- =============================================================================
-- Analytics, the way a shop owner reads it: sessions, where they came from,
-- how far they got, and which of them bought.
--
--   analytics_sessions → one row per visit (website or app). Where it came
--                        from — the referrer, its source and social network,
--                        the campaign tags and ad click it arrived with, the
--                        page it landed on — what it was on (device, browser,
--                        system), roughly where (country, region, city, from
--                        the server's own lookup of the connection), whether
--                        the visitor had been before, and how far it went:
--                        products seen, added to the bag, checkout, order.
--   store_orders.attr_* → where the order came from, copied from the session
--                        that bought (or, when that one came straight in, the
--                        last one before it that did not: a visitor who first
--                        came from an Instagram ad and came back by typing the
--                        address is still an Instagram sale).
--
-- Reports are computed here, in the database, so the dashboard stays fast as
-- the shop grows: analytics_overview, analytics_breakdown, analytics_sales_by,
-- analytics_products and analytics_live.
--
-- Written and read by the server only (service role).
--
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.analytics_sessions (
  session_id       text primary key,
  visitor_id       text not null,
  channel          text not null default 'web',          -- web | app
  platform         text,                                  -- web | ios | android
  started_at       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  pageviews        integer not null default 1,
  landing_path     text,
  last_path        text,
  referrer_host    text,
  source           text not null default 'direct',        -- direct | search | social | paid | email | whatsapp | referral | app
  network          text,                                  -- facebook | instagram | tiktok | snapchat | google | youtube | whatsapp | x | pinterest | …
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  click_id         text,                                  -- fbclid | gclid | ttclid | sccid | msclkid | wbraid | gbraid
  device           text,                                  -- mobile | tablet | desktop
  browser          text,
  os               text,
  country          text,
  region           text,
  city             text,
  is_returning     boolean not null default false,
  product_views    integer not null default 0,
  added_to_cart    boolean not null default false,
  reached_checkout boolean not null default false,
  ordered          boolean not null default false,
  order_number     text,
  revenue          numeric(12,2) not null default 0
);
create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at desc);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id, last_seen desc);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen desc);

alter table public.store_orders add column if not exists attr_source       text;
alter table public.store_orders add column if not exists attr_network      text;
alter table public.store_orders add column if not exists attr_utm_source   text;
alter table public.store_orders add column if not exists attr_utm_medium   text;
alter table public.store_orders add column if not exists attr_utm_campaign text;
alter table public.store_orders add column if not exists attr_landing      text;
alter table public.store_orders add column if not exists attr_referrer     text;
alter table public.store_orders add column if not exists attr_session_id   text;
alter table public.store_orders add column if not exists attr_device       text;
alter table public.store_orders add column if not exists attr_city         text;

-- ---- Recording ----------------------------------------------------------------

-- A page (or app screen) was seen: the session's first page opens it, every
-- later one moves it along. Where it came from is decided by its first page.
create or replace function public.analytics_touch(
  p_session text, p_visitor text, p_channel text, p_platform text, p_path text,
  p_referrer_host text, p_source text, p_network text,
  p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_content text, p_utm_term text,
  p_click_id text, p_device text, p_browser text, p_os text,
  p_country text, p_region text, p_city text
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.analytics_sessions
     set last_seen = now(), pageviews = pageviews + 1, last_path = coalesce(p_path, last_path)
   where session_id = p_session;
  if found then
    return;
  end if;
  insert into public.analytics_sessions (
    session_id, visitor_id, channel, platform, landing_path, last_path, referrer_host, source, network,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id,
    device, browser, os, country, region, city, is_returning
  ) values (
    p_session, p_visitor, coalesce(p_channel, 'web'), p_platform, p_path, p_path, p_referrer_host,
    coalesce(p_source, 'direct'), p_network,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_click_id,
    p_device, p_browser, p_os, p_country, p_region, p_city,
    exists (select 1 from public.analytics_sessions s where s.visitor_id = p_visitor)
  )
  on conflict (session_id) do update
     set last_seen = now(), pageviews = public.analytics_sessions.pageviews + 1;
end
$fn$;

-- A step towards buying, on the visitor's current session (seen in the last
-- half hour): a product opened, something added, the checkout reached.
create or replace function public.analytics_step(p_visitor text, p_step text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session text;
begin
  select session_id into v_session
    from public.analytics_sessions
   where visitor_id = p_visitor and last_seen > now() - interval '30 minutes'
   order by last_seen desc
   limit 1;
  if v_session is null then
    return;
  end if;
  update public.analytics_sessions
     set product_views    = product_views + case when p_step = 'product_view' then 1 else 0 end,
         added_to_cart    = added_to_cart or p_step = 'add_to_cart',
         reached_checkout = reached_checkout or p_step = 'checkout_start',
         last_seen        = now()
   where session_id = v_session;
end
$fn$;

-- An order: the session that bought is marked, and the order is told where it
-- came from — that session, or the last one in thirty days that did not come
-- straight in.
create or replace function public.analytics_order(p_visitor text, p_order_number text, p_revenue numeric)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_buy  public.analytics_sessions%rowtype;
  v_from public.analytics_sessions%rowtype;
begin
  select * into v_buy
    from public.analytics_sessions
   where visitor_id = p_visitor and last_seen > now() - interval '6 hours'
   order by last_seen desc
   limit 1;
  if v_buy.session_id is not null then
    update public.analytics_sessions
       set ordered = true, reached_checkout = true, added_to_cart = true,
           order_number = p_order_number, revenue = revenue + coalesce(p_revenue, 0), last_seen = now()
     where session_id = v_buy.session_id;
  end if;

  v_from := v_buy;
  if v_buy.session_id is null or v_buy.source = 'direct' then
    select * into v_from
      from public.analytics_sessions
     where visitor_id = p_visitor and source <> 'direct' and started_at > now() - interval '30 days'
     order by started_at desc
     limit 1;
    if v_from.session_id is null then
      v_from := v_buy;
    end if;
  end if;
  if v_from.session_id is null then
    return;
  end if;

  update public.store_orders
     set attr_source       = v_from.source,
         attr_network      = v_from.network,
         attr_utm_source   = v_from.utm_source,
         attr_utm_medium   = v_from.utm_medium,
         attr_utm_campaign = v_from.utm_campaign,
         attr_landing      = v_from.landing_path,
         attr_referrer     = v_from.referrer_host,
         attr_session_id   = v_from.session_id,
         attr_device       = coalesce(v_buy.device, v_from.device),
         attr_city         = coalesce(v_buy.city, v_from.city)
   where order_number = p_order_number;
end
$fn$;

-- ---- Reports --------------------------------------------------------------------
-- p_channel: 'all' | 'web' | 'app'. Days are counted in Cairo time.

create or replace function public.analytics_overview(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_tz text default 'Africa/Cairo'
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with s as (
  select * from public.analytics_sessions
   where started_at >= p_from and started_at < p_to
     and (p_channel = 'all' or channel = p_channel)
),
o as (
  select * from public.store_orders
   where created_at >= p_from and created_at < p_to
     and coalesce(lifecycle, '') <> 'cancelled'
     and (p_channel = 'all' or coalesce(channel, 'web') = p_channel)
),
days as (
  select generate_series(
    date_trunc('day', p_from at time zone p_tz),
    date_trunc('day', (p_to - interval '1 second') at time zone p_tz),
    interval '1 day'
  )::date as day
)
select jsonb_build_object(
  'sessions',          (select count(*) from s),
  'visitors',          (select count(distinct visitor_id) from s),
  'newVisitors',       (select count(distinct visitor_id) from s where not is_returning),
  'returningVisitors', (select count(distinct visitor_id) from s where is_returning),
  'pageviews',         (select coalesce(sum(pageviews), 0) from s),
  'bounced',           (select count(*) from s where pageviews <= 1 and product_views = 0 and not added_to_cart),
  'withProductView',   (select count(*) from s where product_views > 0),
  'addedToCart',       (select count(*) from s where added_to_cart),
  'reachedCheckout',   (select count(*) from s where reached_checkout),
  'converted',         (select count(*) from s where ordered),
  'orders',            (select count(*) from o),
  'sales',             (select coalesce(sum(total), 0) from o),
  'customers',         (select count(distinct phone) from o),
  'returningOrders',   (select count(*) from o where exists (
                          select 1 from public.store_orders p
                           where p.phone = o.phone and p.created_at < o.created_at
                             and coalesce(p.lifecycle, '') <> 'cancelled')),
  'series', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'sessions', (select count(*) from s where (s.started_at at time zone p_tz)::date = d.day),
      'orders',   (select count(*) from o where (o.created_at at time zone p_tz)::date = d.day),
      'sales',    (select coalesce(sum(total), 0) from o where (o.created_at at time zone p_tz)::date = d.day)
    ) order by d.day), '[]'::jsonb)
    from days d
  )
);
$fn$;

-- Sessions grouped by one dimension, with how many of them bought and for how much.
create or replace function public.analytics_breakdown(
  p_dim text, p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 20
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_col text;
  v_out jsonb;
begin
  v_col := case p_dim
    when 'source' then 'source' when 'network' then 'network' when 'referrer' then 'referrer_host'
    when 'campaign' then 'utm_campaign' when 'utm_source' then 'utm_source' when 'utm_medium' then 'utm_medium'
    when 'landing' then 'landing_path' when 'device' then 'device' when 'browser' then 'browser'
    when 'os' then 'os' when 'country' then 'country' when 'city' then 'city' when 'platform' then 'platform'
    else null end;
  if v_col is null then
    return '[]'::jsonb;
  end if;
  execute format($q$
    select coalesce(jsonb_agg(r order by r.sessions desc), '[]'::jsonb) from (
      select coalesce(%1$I, '') as key,
             count(*) as sessions,
             count(*) filter (where added_to_cart) as carts,
             count(*) filter (where ordered) as orders,
             coalesce(sum(revenue), 0) as sales
        from public.analytics_sessions
       where started_at >= $1 and started_at < $2 and ($3 = 'all' or channel = $3)
       group by 1
       order by 2 desc
       limit $4
    ) r $q$, v_col)
  into v_out
  using p_from, p_to, p_channel, greatest(1, least(p_limit, 200));
  return v_out;
end
$fn$;

-- Sales grouped by where the orders came from.
create or replace function public.analytics_sales_by(
  p_dim text, p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 20
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_col text;
  v_out jsonb;
begin
  v_col := case p_dim
    when 'source' then 'attr_source' when 'network' then 'attr_network' when 'campaign' then 'attr_utm_campaign'
    when 'utm_source' then 'attr_utm_source' when 'landing' then 'attr_landing' when 'device' then 'attr_device'
    when 'city' then 'city' when 'governorate' then 'governorate' when 'channel' then 'channel'
    when 'payment' then 'payment_method'
    else null end;
  if v_col is null then
    return '[]'::jsonb;
  end if;
  execute format($q$
    select coalesce(jsonb_agg(r order by r.sales desc), '[]'::jsonb) from (
      select coalesce(%1$I, '') as key, count(*) as orders, coalesce(sum(total), 0) as sales
        from public.store_orders
       where created_at >= $1 and created_at < $2 and coalesce(lifecycle, '') <> 'cancelled'
         and ($3 = 'all' or coalesce(channel, 'web') = $3)
       group by 1
       order by 3 desc
       limit $4
    ) r $q$, v_col)
  into v_out
  using p_from, p_to, p_channel, greatest(1, least(p_limit, 200));
  return v_out;
end
$fn$;

-- Products: how often each was opened, added to a bag, and sold.
create or replace function public.analytics_products(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 20
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with ev as (
  select coalesce(product_name, '') as name, max(image_url) as image,
         count(*) filter (where type = 'product_view') as views,
         count(*) filter (where type = 'add_to_cart') as adds
    from public.shopper_events
   where created_at >= p_from and created_at < p_to
     and type in ('product_view', 'add_to_cart') and product_name is not null
     and (p_channel = 'all' or (case when channel = 'shop' then 'web' else channel end) = p_channel)
   group by 1
),
sold as (
  select i.product_name as name, max(i.image_url) as image, sum(i.quantity) as units, sum(i.price * i.quantity) as sales
    from public.store_order_items i
    join public.store_orders o on o.id = i.order_id
   where o.created_at >= p_from and o.created_at < p_to and coalesce(o.lifecycle, '') <> 'cancelled'
     and (p_channel = 'all' or coalesce(o.channel, 'web') = p_channel)
   group by 1
)
select coalesce(jsonb_agg(r order by r.sales desc, r.views desc), '[]'::jsonb) from (
  select coalesce(sold.name, ev.name) as name,
         coalesce(sold.image, ev.image) as image,
         coalesce(ev.views, 0) as views,
         coalesce(ev.adds, 0) as adds,
         coalesce(sold.units, 0) as units,
         coalesce(sold.sales, 0) as sales
    from ev full outer join sold on sold.name = ev.name
   order by 6 desc, 3 desc
   limit greatest(1, least(p_limit, 200))
) r;
$fn$;

-- Right now: who is on the site or the app, where, from where, and how far along.
create or replace function public.analytics_live(p_minutes int default 5)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with s as (
  select * from public.analytics_sessions where last_seen > now() - make_interval(mins => greatest(1, least(p_minutes, 60)))
)
select jsonb_build_object(
  'visitors',  (select count(distinct visitor_id) from s),
  'web',       (select count(*) from s where channel = 'web'),
  'app',       (select count(*) from s where channel = 'app'),
  'carts',     (select count(*) from s where added_to_cart and not ordered),
  'checkouts', (select count(*) from s where reached_checkout and not ordered),
  'ordered',   (select count(*) from s where ordered),
  'pages',     (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                  select coalesce(last_path, '') as key, count(*) as sessions from s group by 1 order by 2 desc limit 10) r),
  'sources',   (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                  select coalesce(network, source) as key, count(*) as sessions from s group by 1 order by 2 desc limit 10) r),
  'cities',    (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                  select coalesce(city, '') as key, count(*) as sessions from s group by 1 order by 2 desc limit 10) r)
);
$fn$;

-- Only the server calls these.
revoke all on function public.analytics_touch(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.analytics_step(text, text) from public, anon, authenticated;
revoke all on function public.analytics_order(text, text, numeric) from public, anon, authenticated;
revoke all on function public.analytics_overview(timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.analytics_breakdown(text, timestamptz, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.analytics_sales_by(text, timestamptz, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.analytics_products(timestamptz, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.analytics_live(int) from public, anon, authenticated;
grant execute on function public.analytics_touch(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.analytics_step(text, text) to service_role;
grant execute on function public.analytics_order(text, text, numeric) to service_role;
grant execute on function public.analytics_overview(timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.analytics_breakdown(text, timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_sales_by(text, timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_products(timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_live(int) to service_role;

-- ---- RLS ----------------------------------------------------------------------
alter table public.analytics_sessions enable row level security;
drop policy if exists "analytics_sessions_auth_all" on public.analytics_sessions;
create policy "analytics_sessions_auth_all" on public.analytics_sessions
  for all to authenticated using (true) with check (true);
