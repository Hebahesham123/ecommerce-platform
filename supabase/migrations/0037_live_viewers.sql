-- =============================================================================
-- Who is watching, counted plainly.
--
-- The count came from Realtime presence, which is elegant and gives nothing
-- at all when the channel does not connect: the host read 0 watching through
-- a live with an audience, and could not tell that from an empty room.
--
-- Each watching page says it is still here every few seconds. Watching now is
-- the rows seen recently. Presence remains for the instant feel where it
-- works; this is the number that is always right.
-- =============================================================================

create table if not exists public.live_viewers (
  live_id    uuid not null references public.live_streams (id) on delete cascade,
  viewer_key text not null,
  last_seen  timestamptz not null default now(),
  primary key (live_id, viewer_key)
);

create index if not exists live_viewers_seen_idx
  on public.live_viewers (live_id, last_seen desc);

alter table public.live_viewers enable row level security;
drop policy if exists "live_viewers_auth_all" on public.live_viewers;
create policy "live_viewers_auth_all" on public.live_viewers
  for all to authenticated using (true) with check (true);
