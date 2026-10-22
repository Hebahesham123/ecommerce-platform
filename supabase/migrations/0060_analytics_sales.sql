-- =============================================================================
-- Analytics, the rest of what Shopify's overview shows:
--
--   - the sales breakdown: gross sales, discounts, sales reversals (cancelled
--     orders and refunds on completed returns), net sales, shipping, total;
--   - orders fulfilled;
--   - per day: conversion rate and average order value, beside sessions and sales;
--   - total sales by referrer (and by governorate, where Shopify has POS location);
--   - customer cohorts: of the customers whose first order was in a month,
--     how many ordered again in each month after;
--   - products by sell-through rate: of what was available, how much sold.
--
-- Needs 0058_analytics_sessions.sql first. Safe to run more than once.
-- =============================================================================

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
placed as (
  -- Every order placed in the period, cancelled ones included: a cancellation is a reversal of a sale.
  select * from public.store_orders
   where created_at >= p_from and created_at < p_to
     and (p_channel = 'all' or coalesce(channel, 'web') = p_channel)
),
o as (
  select * from placed where coalesce(lifecycle, '') <> 'cancelled'
),
refunds as (
  select coalesce(sum(r.refund_amount), 0) as amount, count(*) as n
    from public.return_requests r
    join public.store_orders so on so.id = r.order_id
   where r.status = 'completed' and r.completed_at >= p_from and r.completed_at < p_to
     and (p_channel = 'all' or coalesce(so.channel, 'web') = p_channel)
),
money as (
  select
    (select coalesce(sum(subtotal), 0) from placed) as gross,
    (select coalesce(sum(discount_amount), 0) from o) as discounts,
    (select coalesce(sum(subtotal - coalesce(discount_amount, 0)), 0) from placed where coalesce(lifecycle, '') = 'cancelled') as cancelled,
    (select amount from refunds) as refunded,
    (select coalesce(sum(shipping), 0) from o) as shipping
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
  'fulfilled',         (select count(*) from o where coalesce(fulfillment_status, 'unfulfilled') not in ('unfulfilled', 'partial')),
  'cancelledOrders',   (select count(*) from placed where coalesce(lifecycle, '') = 'cancelled'),
  'refundCount',       (select n from refunds),
  'breakdown', (select jsonb_build_object(
                  'gross',     m.gross,
                  'discounts', m.discounts,
                  'reversals', m.cancelled + m.refunded,
                  'cancelled', m.cancelled,
                  'refunded',  m.refunded,
                  'net',       m.gross - m.discounts - m.cancelled - m.refunded,
                  'shipping',  m.shipping,
                  'total',     m.gross - m.discounts - m.cancelled - m.refunded + m.shipping
                ) from money m),
  'series', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'sessions',  (select count(*) from s where (s.started_at at time zone p_tz)::date = d.day),
      'converted', (select count(*) from s where s.ordered and (s.started_at at time zone p_tz)::date = d.day),
      'orders',    (select count(*) from o where (o.created_at at time zone p_tz)::date = d.day),
      'sales',     (select coalesce(sum(total), 0) from o where (o.created_at at time zone p_tz)::date = d.day)
    ) order by d.day), '[]'::jsonb)
    from days d
  )
);
$fn$;

-- Sales grouped by where the orders came from; now also by referring site.
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
    when 'referrer' then 'attr_referrer'
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

-- Customer cohorts: customers grouped by the month of their first order, and
-- the share of each group that ordered again in each month after (month 0 is
-- the first month itself: a second order in the same month).
create or replace function public.analytics_cohorts(p_months int default 8, p_tz text default 'Africa/Cairo')
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with o as (
  -- One customer, however her number was spelled on her orders.
  select right(regexp_replace(phone, '\D', '', 'g'), 10) as who,
         date_trunc('month', created_at at time zone p_tz)::date as month,
         created_at
    from public.store_orders
   where coalesce(lifecycle, '') <> 'cancelled' and phone is not null
),
firsts as (
  select who, min(created_at) as first_at, date_trunc('month', min(created_at) at time zone p_tz)::date as cohort
    from o group by who
),
cohorts as (
  select cohort, count(*) as customers from firsts
   where cohort >= (date_trunc('month', now() at time zone p_tz) - make_interval(months => greatest(1, least(p_months, 24)) - 1))::date
   group by cohort
),
again as (
  -- Who ordered again, and in which month after their first.
  select f.cohort,
         ((extract(year from o.month) - extract(year from f.cohort)) * 12 + (extract(month from o.month) - extract(month from f.cohort)))::int as k,
         count(distinct o.who) as n
    from o join firsts f on f.who = o.who
   where o.created_at > f.first_at
   group by 1, 2
)
select coalesce(jsonb_agg(jsonb_build_object(
  'cohort', c.cohort,
  'customers', c.customers,
  'months', (
    select coalesce(jsonb_agg(jsonb_build_object('k', g.k, 'customers', coalesce(a.n, 0)) order by g.k), '[]'::jsonb)
      from generate_series(0, ((extract(year from now() at time zone p_tz) - extract(year from c.cohort)) * 12
                               + (extract(month from now() at time zone p_tz) - extract(month from c.cohort)))::int) as g(k)
      left join again a on a.cohort = c.cohort and a.k = g.k
  )
) order by c.cohort), '[]'::jsonb)
from cohorts c;
$fn$;

-- Products by sell-through: of what there was to sell (sold in the period plus
-- what is on hand now), the share that sold.
create or replace function public.analytics_sell_through(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 20
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with sold as (
  select i.product_name as name, max(i.image_url) as image, sum(i.quantity) as units
    from public.store_order_items i
    join public.store_orders o on o.id = i.order_id
   where o.created_at >= p_from and o.created_at < p_to and coalesce(o.lifecycle, '') <> 'cancelled'
     and (p_channel = 'all' or coalesce(o.channel, 'web') = p_channel)
   group by 1
),
stock as (
  select it.product_name as name, sum(greatest(lv.on_hand, 0)) as on_hand
    from public.inventory_items it
    join public.inventory_levels lv on lv.item_id = it.id
   group by 1
)
select coalesce(jsonb_agg(r order by r.rate desc, r.units desc), '[]'::jsonb) from (
  select s.name, s.image, s.units, coalesce(st.on_hand, 0) as on_hand,
         round(s.units::numeric * 100 / nullif(s.units + coalesce(st.on_hand, 0), 0), 1) as rate
    from sold s left join stock st on st.name = s.name
   order by 5 desc nulls last, 3 desc
   limit greatest(1, least(p_limit, 200))
) r;
$fn$;

revoke all on function public.analytics_overview(timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.analytics_sales_by(text, timestamptz, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.analytics_cohorts(int, text) from public, anon, authenticated;
revoke all on function public.analytics_sell_through(timestamptz, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.analytics_overview(timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.analytics_sales_by(text, timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_cohorts(int, text) to service_role;
grant execute on function public.analytics_sell_through(timestamptz, timestamptz, text, int) to service_role;
