-- =============================================================================
-- Broadcasting from the browser.
--
-- The same Cloudflare live input accepts video two ways: RTMPS, which a phone
-- app like Larix speaks, and WebRTC (WHIP), which a browser speaks natively.
-- Storing the WHIP address next to the RTMPS one means the host can go live
-- from the dashboard on her phone — see herself, press one button — without
-- installing anything, and the viewers, the playback URL and the recording are
-- exactly the same either way.
-- =============================================================================

alter table public.live_streams
  add column if not exists whip_url text;
