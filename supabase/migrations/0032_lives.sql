-- =============================================================================
-- Live shopping.
--
-- A live is a scheduled event that becomes a broadcast and then a replay, so
-- one row carries all three states rather than three tables that have to agree.
--
-- The video itself is NOT here. A phone sends one feed to a streaming provider
-- (Cloudflare Stream), which fans it out to every viewer from servers near
-- them; this table only keeps the handles that provider gives back — what to
-- broadcast to, what to play, what the recording is. That split is deliberate:
-- 300 viewers for an hour is ~300GB of video, which is the provider's job and
-- would flatten ours.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.live_streams (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  subtitle           text,
  host_name          text,
  cover_url          text,

  -- scheduled -> live -> ended. `cancelled` is for one called off before air.
  status             text not null default 'scheduled'
                       check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at       timestamptz,
  started_at         timestamptz,
  ended_at           timestamptz,

  -- Handles from the streaming provider. Created when the merchant presses
  -- "Prepare", so the key exists before air and the phone can be set up calmly.
  provider           text not null default 'cloudflare',
  provider_stream_id text,
  ingest_url         text,          -- what the phone broadcasts to
  stream_key         text,          -- secret: never leaves the dashboard
  playback_url       text,          -- what viewers play
  recording_url      text,          -- the replay, once the provider has it

  -- Replays keep selling after the stream ends, but only if we say they may.
  replay_enabled     boolean not null default true,

  -- Filled from the chat channel's presence while live, then frozen.
  peak_viewers       integer not null default 0,

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists live_streams_status_idx    on public.live_streams (status);
create index if not exists live_streams_scheduled_idx on public.live_streams (scheduled_at desc);

-- What is being sold on air. Ordered, because the host works down a list.
create table if not exists public.live_stream_products (
  id            uuid primary key default gen_random_uuid(),
  live_id       uuid not null references public.live_streams (id) on delete cascade,
  item_id       uuid references public.inventory_items (id) on delete set null,
  product_name  text not null,
  image_url     text,
  price         numeric(12,2),
  -- A code that only works while this live is on, if the merchant wants one.
  discount_code text,
  -- The item the host is holding up right now: exactly one per live.
  pinned        boolean not null default false,
  sort_order    integer not null default 0
);

create index if not exists live_stream_products_live_idx on public.live_stream_products (live_id, sort_order);
create unique index if not exists live_stream_products_one_pinned_idx
  on public.live_stream_products (live_id) where pinned;

-- Chat is persisted rather than kept only in Realtime: it is moderated, it is
-- replayed alongside the recording, and a question left unanswered on air is
-- worth answering afterwards.
create table if not exists public.live_stream_messages (
  id          uuid primary key default gen_random_uuid(),
  live_id     uuid not null references public.live_streams (id) on delete cascade,
  phone       text,                      -- null for a guest
  author_name text not null,
  body        text not null,
  -- Seconds from the start of the stream, so the replay can show chat in time.
  offset_ms   integer,
  hidden      boolean not null default false,
  is_host     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists live_stream_messages_live_idx on public.live_stream_messages (live_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists live_streams_set_updated_at on public.live_streams;
create trigger live_streams_set_updated_at
  before update on public.live_streams
  for each row execute function public.set_updated_at();

alter table public.live_streams          enable row level security;
alter table public.live_stream_products  enable row level security;
alter table public.live_stream_messages  enable row level security;

drop policy if exists "live_streams_auth_all" on public.live_streams;
create policy "live_streams_auth_all" on public.live_streams
  for all to authenticated using (true) with check (true);

drop policy if exists "live_stream_products_auth_all" on public.live_stream_products;
create policy "live_stream_products_auth_all" on public.live_stream_products
  for all to authenticated using (true) with check (true);

drop policy if exists "live_stream_messages_auth_all" on public.live_stream_messages;
create policy "live_stream_messages_auth_all" on public.live_stream_messages
  for all to authenticated using (true) with check (true);

-- Chat is the one thing viewers read directly from the database, over Realtime,
-- so that 300 phones do not poll an API instead. They may read visible messages
-- on a stream that is on air or replayable — nothing else, and never the
-- stream_key sitting on live_streams.
drop policy if exists "live_stream_messages_public_read" on public.live_stream_messages;
create policy "live_stream_messages_public_read" on public.live_stream_messages
  for select to anon
  using (
    hidden = false
    and exists (
      select 1 from public.live_streams s
       where s.id = live_id
         and (s.status = 'live' or (s.status = 'ended' and s.replay_enabled))
    )
  );
