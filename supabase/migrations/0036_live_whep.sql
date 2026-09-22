-- =============================================================================
-- Watching without the wait.
--
-- HLS cuts the stream into segments and a player holds a few before it starts,
-- which is what puts viewers 15-20 seconds behind the host. That is fine for
-- a broadcast and wrong for a shop: she holds something up, and the question
-- about it arrives after she has moved on.
--
-- The same Cloudflare live input can also be played over WebRTC (WHEP), which
-- is sub-second. Storing that address next to the HLS one lets the viewer page
-- prefer it while the stream is on air and fall back to HLS for the replay,
-- which has no reason to be low-latency.
-- =============================================================================

alter table public.live_streams
  add column if not exists whep_url text;
