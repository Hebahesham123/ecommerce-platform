-- =============================================================================
-- Each visitor's whole journey: who they are, where they first came from,
-- every page they opened and how long they looked at it, what they searched
-- for and which buttons they pressed.
--
--   analytics_visitors  → one row per visitor id (a browser, or an install of
--                         the app): the first visit (when, which page it
--                         landed on, where it came from — source, platform,
--                         campaign, ad click), where the latest visit came
--                         from, and running totals: visits, pages, seconds,
--                         searches, clicks. The phone it belongs to, once
--                         known, is in shopper_visitors (linked on sign-in or
--                         order) and joined when it is read.
--   analytics_pageviews → every page or app screen opened, with how long it
--                         was actually on screen (time with the tab hidden is
--                         not counted) and how far down it was scrolled.
--   shopper_events      → searches ('search', the words in meta.term and the
--                         number of results in quantity) and button presses
--                         ('click', the button's words in meta.label and
--                         meta.important when it is one that matters: bag,
--                         buy, checkout, order, payment, coupon, WhatsApp,
--                         sign-in, delete…). What was typed into a field is
--                         never recorded — only which button was pressed.
--
-- Needs 0058_analytics_sessions.sql first. Safe to run more than once.
-- =============================================================================

create table if not exists public.analytics_visitors (
  visitor_id         text primary key,
  first_seen         timestamptz not null default now(),
  last_seen          timestamptz not null default now(),
  first_landing      text,
  first_source       text,
  first_network      text,
  first_referrer     text,
  first_utm_source   text,
  first_utm_medium   text,
  first_utm_campaign text,
  first_click_id     text,
  last_source        text,
  last_network       text,
  last_utm_campaign  text,
  channel            text,
  platform           text,
  device             text,
  browser            text,
  os                 text,
  country            text,
  region             text,
  city               text,
  sessions           integer not null default 0,
  pageviews          integer not null default 0,
  seconds            integer not null default 0,
  searches           integer not null default 0,
  clicks             integer not null default 0
);
create index if not exists analytics_visitors_last_seen_idx on public.analytics_visitors (last_seen desc);

create table if not exists public.analytics_pageviews (
  id          text primary key,
  session_id  text not null,
  visitor_id  text not null,
  channel     text not null default 'web',
  path        text,
  title       text,
  entered_at  timestamptz not null default now(),
  seconds     integer not null default 0,
  scroll      integer not null default 0
);
create index if not exists analytics_pageviews_visitor_idx on public.analytics_pageviews (visitor_id, entered_at desc);
create index if not exists analytics_pageviews_entered_idx on public.analytics_pageviews (entered_at desc);

-- Visitors who came before this file: their first and latest visits, from the sessions already kept.
insert into public.analytics_visitors (
  visitor_id, first_seen, last_seen, first_landing, first_source, first_network, first_referrer,
  first_utm_source, first_utm_medium, first_utm_campaign, first_click_id,
  channel, platform, device, browser, os, country, region, city, sessions, pageviews
)
select distinct on (visitor_id)
       visitor_id, started_at, started_at, landing_path, source, network, referrer_host,
       utm_source, utm_medium, utm_campaign, click_id,
       channel, platform, device, browser, os, country, region, city, 0, 0
  from public.analytics_sessions
 order by visitor_id, started_at asc
on conflict (visitor_id) do nothing;
update public.analytics_visitors v
   set sessions  = s.n,
       pageviews = s.pages,
       last_seen = greatest(v.last_seen, s.last)
  from (select visitor_id, count(*) as n, sum(pageviews) as pages, max(last_seen) as last
          from public.analytics_sessions group by visitor_id) s
 where s.visitor_id = v.visitor_id and v.sessions = 0;

-- ---- Recording ----------------------------------------------------------------

-- The page hit now also opens the page's own row (with its id and title) and
-- keeps the visitor's record: its first visit once, its latest one every time.
drop function if exists public.analytics_touch(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
create or replace function public.analytics_touch(
  p_session text, p_visitor text, p_channel text, p_platform text, p_path text,
  p_referrer_host text, p_source text, p_network text,
  p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_content text, p_utm_term text,
  p_click_id text, p_device text, p_browser text, p_os text,
  p_country text, p_region text, p_city text,
  p_pageview text default null, p_title text default null
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_new boolean := false;
begin
  if p_pageview is not null then
    insert into public.analytics_pageviews (id, session_id, visitor_id, channel, path, title)
    values (p_pageview, p_session, p_visitor, coalesce(p_channel, 'web'), p_path, p_title)
    on conflict (id) do nothing;
  end if;

  update public.analytics_sessions
     set last_seen = now(), pageviews = pageviews + 1, last_path = coalesce(p_path, last_path)
   where session_id = p_session;
  if not found then
    v_new := true;
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
  end if;

  insert into public.analytics_visitors (
    visitor_id, first_landing, first_source, first_network, first_referrer,
    first_utm_source, first_utm_medium, first_utm_campaign, first_click_id,
    last_source, last_network, last_utm_campaign,
    channel, platform, device, browser, os, country, region, city, sessions, pageviews
  ) values (
    p_visitor, p_path, coalesce(p_source, 'direct'), p_network, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_click_id,
    coalesce(p_source, 'direct'), p_network, p_utm_campaign,
    coalesce(p_channel, 'web'), p_platform, p_device, p_browser, p_os, p_country, p_region, p_city, 1, 1
  )
  on conflict (visitor_id) do update set
    last_seen         = now(),
    pageviews         = public.analytics_visitors.pageviews + 1,
    sessions          = public.analytics_visitors.sessions + case when v_new then 1 else 0 end,
    last_source       = case when v_new then coalesce(p_source, 'direct') else public.analytics_visitors.last_source end,
    last_network      = case when v_new then p_network else public.analytics_visitors.last_network end,
    last_utm_campaign = case when v_new then p_utm_campaign else public.analytics_visitors.last_utm_campaign end,
    channel           = coalesce(p_channel, public.analytics_visitors.channel),
    platform          = coalesce(p_platform, public.analytics_visitors.platform),
    device            = coalesce(p_device, public.analytics_visitors.device),
    browser           = coalesce(p_browser, public.analytics_visitors.browser),
    os                = coalesce(p_os, public.analytics_visitors.os),
    country           = coalesce(p_country, public.analytics_visitors.country),
    region            = coalesce(p_region, public.analytics_visitors.region),
    city              = coalesce(p_city, public.analytics_visitors.city);
end
$fn$;

-- A page was left (or hidden): how long it was on screen, and how far it was scrolled.
create or replace function public.analytics_page_leave(p_pageview text, p_seconds int, p_scroll int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_old  int;
  v_new  int;
  v_who  text;
  v_sess text;
begin
  select seconds, visitor_id, session_id into v_old, v_who, v_sess from public.analytics_pageviews where id = p_pageview;
  if v_who is null then
    return;
  end if;
  v_new := greatest(v_old, least(greatest(coalesce(p_seconds, 0), 0), 3600));
  update public.analytics_pageviews
     set seconds = v_new, scroll = greatest(scroll, least(greatest(coalesce(p_scroll, 0), 0), 100))
   where id = p_pageview;
  if v_new > v_old then
    update public.analytics_visitors set seconds = seconds + (v_new - v_old), last_seen = now() where visitor_id = v_who;
    update public.analytics_sessions set last_seen = now() where session_id = v_sess;
  end if;
end
$fn$;

-- Steps on the visit now also count the visitor's searches and button presses.
create or replace function public.analytics_step(p_visitor text, p_step text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_session text;
begin
  if p_step = 'search' or p_step = 'click' then
    update public.analytics_visitors
       set searches = searches + case when p_step = 'search' then 1 else 0 end,
           clicks   = clicks   + case when p_step = 'click'  then 1 else 0 end,
           last_seen = now()
     where visitor_id = p_visitor;
    return;
  end if;
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

-- ---- Reading ------------------------------------------------------------------

-- One visitor's journey — or a customer's, across every browser and phone she used.
create or replace function public.analytics_journey(p_visitors text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
select jsonb_build_object(
  'visitors', (select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object('phone', sv.phone) order by v.first_seen), '[]'::jsonb)
                 from public.analytics_visitors v
                 left join public.shopper_visitors sv on sv.visitor_id = v.visitor_id
                where v.visitor_id = any (p_visitors)),
  'sessions', (select coalesce(jsonb_agg(r order by r.started_at desc), '[]'::jsonb) from (
                 select session_id, visitor_id, channel, started_at, last_seen, pageviews, landing_path, source, network,
                        utm_campaign, referrer_host, device, browser, city, product_views, added_to_cart, reached_checkout,
                        ordered, order_number, revenue,
                        (select coalesce(sum(p.seconds), 0) from public.analytics_pageviews p where p.session_id = s.session_id) as seconds
                   from public.analytics_sessions s
                  where s.visitor_id = any (p_visitors)
                  order by started_at desc
                  limit 50) r),
  'pages',    (select coalesce(jsonb_agg(r order by r.entered_at desc), '[]'::jsonb) from (
                 select id, session_id, channel, path, title, entered_at, seconds, scroll
                   from public.analytics_pageviews
                  where visitor_id = any (p_visitors)
                  order by entered_at desc
                  limit 300) r),
  'searches', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
                 select created_at, channel, meta->>'term' as term, quantity as results, path
                   from public.shopper_events
                  where visitor_id = any (p_visitors) and type = 'search'
                  order by created_at desc
                  limit 200) r),
  'clicks',   (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
                 select created_at, channel, meta->>'label' as label, coalesce((meta->>'important')::boolean, false) as important,
                        meta->>'target' as target, path
                   from public.shopper_events
                  where visitor_id = any (p_visitors) and type = 'click'
                  order by created_at desc
                  limit 300) r)
);
$fn$;

-- Everyone who visited in a period, newest first: who they are (if known),
-- where they first came from and landed, and how much they did.
create or replace function public.analytics_visitor_list(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_who text default 'all',
  p_search text default '', p_limit int default 50, p_offset int default 0
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
select jsonb_build_object(
  'total', (select count(*) from public.analytics_visitors v
              left join public.shopper_visitors sv on sv.visitor_id = v.visitor_id
             where v.last_seen >= p_from and v.last_seen < p_to
               and (p_channel = 'all' or v.channel = p_channel)
               and (p_who = 'all' or (p_who = 'known' and sv.phone is not null) or (p_who = 'anonymous' and sv.phone is null))
               and (p_search = '' or v.visitor_id ilike '%' || p_search || '%' or coalesce(sv.phone, '') ilike '%' || p_search || '%'
                    or coalesce(v.first_landing, '') ilike '%' || p_search || '%' or coalesce(v.city, '') ilike '%' || p_search || '%')),
  'rows', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
             select v.visitor_id, sv.phone, c.name, v.first_seen, v.last_seen, v.first_landing, v.first_source, v.first_network,
                    v.first_utm_campaign, v.last_source, v.last_network, v.channel, v.device, v.os, v.city,
                    v.sessions, v.pageviews, v.seconds, v.searches, v.clicks,
                    (select count(*) from public.store_orders o where sv.phone is not null and o.phone = sv.phone
                        and coalesce(o.lifecycle, '') <> 'cancelled') as orders
               from public.analytics_visitors v
               left join public.shopper_visitors sv on sv.visitor_id = v.visitor_id
               left join public.store_customers c on c.phone = sv.phone
              where v.last_seen >= p_from and v.last_seen < p_to
                and (p_channel = 'all' or v.channel = p_channel)
                and (p_who = 'all' or (p_who = 'known' and sv.phone is not null) or (p_who = 'anonymous' and sv.phone is null))
                and (p_search = '' or v.visitor_id ilike '%' || p_search || '%' or coalesce(sv.phone, '') ilike '%' || p_search || '%'
                     or coalesce(v.first_landing, '') ilike '%' || p_search || '%' or coalesce(v.city, '') ilike '%' || p_search || '%')
              order by v.last_seen desc
              limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)) r)
);
$fn$;

-- What was searched for, most often first, and how often nothing was found.
create or replace function public.analytics_top_searches(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 30
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
select coalesce(jsonb_agg(r), '[]'::jsonb) from (
  select lower(trim(meta->>'term')) as term, count(*) as searches, count(distinct visitor_id) as visitors,
         count(*) filter (where quantity = 0) as empty
    from public.shopper_events
   where type = 'search' and created_at >= p_from and created_at < p_to and coalesce(meta->>'term', '') <> ''
     and (p_channel = 'all' or (case when channel = 'shop' then 'web' else channel end) = p_channel)
   group by 1
   order by 2 desc
   limit greatest(1, least(p_limit, 200))
) r;
$fn$;

-- Which buttons were pressed, most often first; the ones that matter flagged.
create or replace function public.analytics_top_clicks(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_important_only boolean default false, p_limit int default 30
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
select coalesce(jsonb_agg(r), '[]'::jsonb) from (
  select meta->>'label' as label, bool_or(coalesce((meta->>'important')::boolean, false)) as important,
         count(*) as clicks, count(distinct visitor_id) as visitors
    from public.shopper_events
   where type = 'click' and created_at >= p_from and created_at < p_to and coalesce(meta->>'label', '') <> ''
     and (p_channel = 'all' or (case when channel = 'shop' then 'web' else channel end) = p_channel)
     and (not p_important_only or coalesce((meta->>'important')::boolean, false))
   group by 1
   order by 3 desc
   limit greatest(1, least(p_limit, 200))
) r;
$fn$;

-- Pages by how long they hold attention.
create or replace function public.analytics_page_time(
  p_from timestamptz, p_to timestamptz, p_channel text default 'all', p_limit int default 30
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
select coalesce(jsonb_agg(r), '[]'::jsonb) from (
  select coalesce(path, '') as path, count(*) as views, count(distinct visitor_id) as visitors,
         round(avg(seconds) filter (where seconds > 0))::int as avg_seconds,
         coalesce(sum(seconds), 0) as seconds,
         round(avg(scroll) filter (where scroll > 0))::int as avg_scroll
    from public.analytics_pageviews
   where entered_at >= p_from and entered_at < p_to and (p_channel = 'all' or channel = p_channel)
   group by 1
   order by 2 desc
   limit greatest(1, least(p_limit, 200))
) r;
$fn$;

-- Only the server calls these.
revoke all on function public.analytics_touch(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.analytics_page_leave(text, int, int) from public, anon, authenticated;
revoke all on function public.analytics_step(text, text) from public, anon, authenticated;
revoke all on function public.analytics_journey(text[]) from public, anon, authenticated;
revoke all on function public.analytics_visitor_list(timestamptz, timestamptz, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.analytics_top_searches(timestamptz, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.analytics_top_clicks(timestamptz, timestamptz, text, boolean, int) from public, anon, authenticated;
revoke all on function public.analytics_page_time(timestamptz, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.analytics_touch(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.analytics_page_leave(text, int, int) to service_role;
grant execute on function public.analytics_step(text, text) to service_role;
grant execute on function public.analytics_journey(text[]) to service_role;
grant execute on function public.analytics_visitor_list(timestamptz, timestamptz, text, text, text, int, int) to service_role;
grant execute on function public.analytics_top_searches(timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_top_clicks(timestamptz, timestamptz, text, boolean, int) to service_role;
grant execute on function public.analytics_page_time(timestamptz, timestamptz, text, int) to service_role;

-- ---- RLS ----------------------------------------------------------------------
alter table public.analytics_visitors  enable row level security;
alter table public.analytics_pageviews enable row level security;
drop policy if exists "analytics_visitors_auth_all" on public.analytics_visitors;
create policy "analytics_visitors_auth_all" on public.analytics_visitors for all to authenticated using (true) with check (true);
drop policy if exists "analytics_pageviews_auth_all" on public.analytics_pageviews;
create policy "analytics_pageviews_auth_all" on public.analytics_pageviews for all to authenticated using (true) with check (true);
