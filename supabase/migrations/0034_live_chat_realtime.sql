-- =============================================================================
-- Live chat over Realtime.
--
-- Viewers read comments straight from the database rather than asking our API
-- for them. At 500 concurrent that is the difference between one subscription
-- each and 500 phones polling a route — which would be ~250 requests a second,
-- for an hour, to deliver messages that mostly have not changed.
--
-- Writes still go through the server (moderation, rate limits); this only opens
-- the read path. Which rows may be read is already decided by the policy in
-- 0032: visible messages, on a stream that is on air or replayable.
--
-- Capacity note: every watching phone holds one Realtime connection, and the
-- Supabase Pro plan includes 500 concurrent peers. A 500-viewer live sits
-- exactly on that ceiling, so buy additional peers before the first big one —
-- the page degrades to a static list rather than breaking, but nobody sees new
-- comments once the cap is hit.
-- =============================================================================

alter publication supabase_realtime add table public.live_stream_messages;
