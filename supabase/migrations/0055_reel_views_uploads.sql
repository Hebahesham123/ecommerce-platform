-- =============================================================================
-- Reels: views, and reels uploaded straight from the dashboard.
--
--   views → how many times a reel was actually watched: counted once a viewer
--           has let it play for two seconds, at most once per viewer per half
--           hour. A real count, read by the dashboard and shown on the tiles.
--   kind  → "live" for a kept live, "upload" for a video uploaded as a reel.
--           An uploaded reel is the same row a kept live is, so the app, the
--           website, likes and products all treat it the same way; the kind
--           only keeps it out of the Lives list.
--
-- Safe to run more than once.
-- =============================================================================

alter table public.live_streams add column if not exists views integer not null default 0;
alter table public.live_streams add column if not exists kind text not null default 'live';

create or replace function public.live_view(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_total integer;
begin
  update public.live_streams
     set views = coalesce(views, 0) + 1
   where id = p_id
  returning views into v_total;
  return coalesce(v_total, 0);
end
$fn$;

-- Counted by the server, which first checks the viewer has not just been
-- counted; callable by the public key, the number would be anyone's to set.
revoke all on function public.live_view(uuid) from public, anon, authenticated;
grant execute on function public.live_view(uuid) to service_role;
