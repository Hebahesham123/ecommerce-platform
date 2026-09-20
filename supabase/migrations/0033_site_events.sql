-- First-party analytics: what the website and the app are actually doing.
--
-- Until now the dashboard had no idea how many people visit, what they look
-- at, or where they came from - the only traces were popup events and orders.
-- This is the smallest table that answers those questions honestly: one row
-- per pageview or app session, no names, no phone numbers, no cookies beyond
-- an id the browser keeps for itself.
--
-- Safe to run more than once.

create table if not exists site_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- "pageview" (a screen was seen) or "session" (an app opened).
  kind text not null default 'pageview',
  -- "web" or "app", so the two analytics pages never mix.
  channel text not null default 'web',
  -- Random per browser/device, kept in its own storage. Not a person.
  visitor_id text not null,
  -- Random per visit; a new one after 30 quiet minutes.
  session_id text not null,
  path text,
  -- Where the visit came from, grouped by the server: direct, search, social…
  source text,
  referrer_host text,
  -- App only: ios | android | web.
  platform text,
  app_version text
);

-- Columns for a table that already existed in an earlier shape.
alter table site_events add column if not exists kind text not null default 'pageview';
alter table site_events add column if not exists channel text not null default 'web';
alter table site_events add column if not exists visitor_id text;
alter table site_events add column if not exists session_id text;
alter table site_events add column if not exists path text;
alter table site_events add column if not exists source text;
alter table site_events add column if not exists referrer_host text;
alter table site_events add column if not exists platform text;
alter table site_events add column if not exists app_version text;

-- Every question the analytics pages ask is "what happened between these two
-- dates", so that is what is indexed.
create index if not exists site_events_created_idx on site_events (created_at desc);
create index if not exists site_events_channel_idx on site_events (channel, created_at desc);
create index if not exists site_events_visitor_idx on site_events (visitor_id, created_at desc);
create index if not exists site_events_session_idx on site_events (session_id);

-- Written only by the server (service role), read only by the dashboard.
alter table site_events enable row level security;
