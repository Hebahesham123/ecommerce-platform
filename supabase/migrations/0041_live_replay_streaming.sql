-- =============================================================================
-- Lives · replays that start in a second
-- =============================================================================
-- A replay is one file, served whole. Nothing can play until enough of the
-- front of it has arrived, a phone on a thin connection waits for the same
-- bytes a laptop does, and a long live is a long wait — none of which is
-- fixable by fetching it sooner, only by fetching it differently.
--
-- So each recording is also handed to the streaming provider, which cuts it
-- into a few seconds at a time at several qualities. That is what a reel needs:
-- playback begins on the first short segment, and the quality follows the
-- connection instead of the connection having to meet the file.
--
-- Two columns. `stream_uid` is the provider's handle for the copy, kept so we
-- can ask whether it is ready and delete it with the live. `stream_url` is the
-- playlist to play, and is null until the transcode finishes — the original
-- file stays exactly where it is and keeps working meanwhile, so nothing is
-- ever unwatchable while it converts.
-- =============================================================================

alter table public.live_streams
  add column if not exists stream_uid text,
  add column if not exists stream_url text;

comment on column public.live_streams.stream_uid is
  'Provider id for the transcoded replay, used to poll and to delete it.';
comment on column public.live_streams.stream_url is
  'Adaptive playlist for the replay. Null until the transcode is ready; the original recording_url plays until then.';
