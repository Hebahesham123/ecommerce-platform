-- =============================================================================
-- Hesitation nudges — catching a shopper who is stalling and offering them a
-- reason to finish.
--
--   nudge_campaigns → the merchant's configuration: which signals count as
--                     hesitation, how the popup looks, and which discount it
--                     hands out. Everything is a column rather than code so
--                     the dashboard owns it.
--   nudge_events    → what actually happened, so "did the popup pay for the
--                     discount it gave away" is answerable rather than assumed.
--
-- The storefront reads the campaign server-side and bakes it into the page.
-- That is safe for the CDN because a campaign is merchant configuration, not
-- shopper data: every visitor gets byte-identical HTML, which is what keeps
-- catalogue pages cacheable.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.nudge_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null default 'Hesitation offer',
  enabled             boolean not null default false,

  -- ---- What counts as hesitation ------------------------------------------
  -- Each signal is independent: a merchant selling considered purchases wants
  -- a long dwell, one selling impulse buys wants exit intent and nothing else.
  dwell_enabled       boolean not null default true,
  dwell_seconds       integer not null default 45,
  exit_enabled        boolean not null default true,
  idle_enabled        boolean not null default false,
  idle_seconds        integer not null default 30,
  cart_enabled        boolean not null default false,
  cart_seconds        integer not null default 20,

  -- Which kinds of page may fire it: product | collection | cart | index | search
  pages               jsonb not null default '["product","collection","cart"]'::jsonb,

  -- ---- How often a shopper may see it --------------------------------------
  -- Without a ceiling the popup becomes the reason people leave.
  max_per_session     integer not null default 1,
  cooldown_hours      integer not null default 24,
  -- Never interrupt someone who is already converting.
  skip_if_cart_empty  boolean not null default false,

  -- ---- How it looks ---------------------------------------------------------
  style               text not null default 'card'
                        check (style in ('card', 'wheel', 'capture')),
  position            text not null default 'center'
                        check (position in ('center', 'bottom-right', 'bottom-left', 'bottom-bar')),
  headline            text not null default 'Still thinking it over?',
  body                text not null default 'Here is a little something to help you decide.',
  button_label        text not null default 'Copy code and continue',
  dismiss_label       text not null default 'No thanks',
  capture_label       text not null default 'Enter your phone or email to unlock it',
  accent_color        text not null default '#e11d48',
  background_color    text not null default '#ffffff',
  text_color          text not null default '#0f172a',
  image_url           text,

  -- ---- What it gives away ---------------------------------------------------
  -- A code from public.discounts. Held as text rather than a foreign key so a
  -- deleted discount degrades to "no offer" instead of deleting the campaign.
  discount_code       text,
  -- Wheel only: [{ label, code, weight }] — weight biases the landing segment.
  wheel_segments      jsonb not null default '[]'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists nudge_campaigns_enabled_idx
  on public.nudge_campaigns (enabled, updated_at desc);

-- ---- What happened ----------------------------------------------------------
create table if not exists public.nudge_events (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references public.nudge_campaigns (id) on delete set null,

  -- Anonymous, cookie-scoped, and deliberately not tied to an identity: this
  -- measures behaviour, not people.
  visitor_id   text not null,
  session_id   text,

  type         text not null
                 check (type in ('hesitation', 'shown', 'dismissed', 'claimed', 'converted')),
  -- Which signal fired: dwell | exit | idle | cart
  trigger      text,
  path         text,
  dwell_ms     integer,
  code         text,
  -- The "email or phone first" style is pointless if the contact is thrown
  -- away: this is the shopper the merchant can still follow up with.
  contact      text,
  order_number text,
  order_total  numeric(12,2),

  created_at   timestamptz not null default now()
);

create index if not exists nudge_events_created_idx  on public.nudge_events (created_at desc);
create index if not exists nudge_events_type_idx     on public.nudge_events (type, created_at desc);
create index if not exists nudge_events_visitor_idx  on public.nudge_events (visitor_id);
create index if not exists nudge_events_campaign_idx on public.nudge_events (campaign_id);
-- The results page groups hesitation by page to answer "where do people stall".
create index if not exists nudge_events_path_idx     on public.nudge_events (path);

-- ---- updated_at -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists nudge_campaigns_set_updated_at on public.nudge_campaigns;
create trigger nudge_campaigns_set_updated_at
  before update on public.nudge_campaigns
  for each row execute function public.set_updated_at();

-- ---- RLS --------------------------------------------------------------------
-- Events arrive through a storefront route on the service role, so the only
-- policy either table needs is the admin's own.
alter table public.nudge_campaigns enable row level security;
alter table public.nudge_events    enable row level security;

drop policy if exists "nudge_campaigns_auth_all" on public.nudge_campaigns;
create policy "nudge_campaigns_auth_all" on public.nudge_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "nudge_events_auth_all" on public.nudge_events;
create policy "nudge_events_auth_all" on public.nudge_events
  for all to authenticated using (true) with check (true);

-- ---- One campaign to edit, switched off ------------------------------------
-- Seeded disabled: a popup that starts showing itself the moment a migration
-- runs is a nasty surprise on a live store.
insert into public.nudge_campaigns (name, enabled)
select 'Hesitation offer', false
where not exists (select 1 from public.nudge_campaigns);
