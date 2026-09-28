-- =============================================================================
-- Lives · a count of who liked the replay
-- =============================================================================
-- A reel with no way to say anything about it is a video in a list. The like is
-- the smallest thing a viewer can do, and the only one that costs her nothing —
-- so it is the one that actually gets done, and the number it produces is the
-- merchant's clearest signal of which live was worth making again.
--
-- One integer on the live. There is no table of who liked what: that would be
-- a row per tap for something nobody ever queries per person, and it would
-- attach a shopper's identity to a gesture she made without signing in. The
-- browser remembers its own taps so it does not count twice; the shop only
-- ever learns the total.
-- =============================================================================

alter table public.live_streams
  add column if not exists likes integer not null default 0;

-- Counting in the database rather than by reading and writing back: two people
-- tapping at the same moment on a phone each would otherwise overwrite each
-- other and one of them would silently not count.
create or replace function public.live_like(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  update public.live_streams
     set likes = coalesce(likes, 0) + 1
   where id = p_id
  returning likes into v_total;
  return coalesce(v_total, 0);
end $$;

grant execute on function public.live_like(uuid) to anon, authenticated;
