-- =============================================================================
-- Lives · replay storage — a bucket sized for video
-- =============================================================================
-- Browser recordings were being written into the media-library bucket, which
-- has no size of its own and so inherits the project's limit — fifty megabytes
-- by default. A recording passes that in about five minutes, and the upload is
-- refused with "The object exceeded the maximum allowed size" after the live is
-- already over, which is the worst possible moment to find out.
--
-- Replays get their own bucket instead: a limit measured in gigabytes, and a
-- lifecycle of their own, so clearing out old product photos can never take a
-- replay with it and a huge video can never be mistaken for a media asset.
--
-- NOTE: a bucket's limit cannot exceed the project-wide one. If uploads are
-- still refused after this runs, raise it in the Supabase dashboard under
-- Storage → Settings → "Upload file size limit".
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('live-recordings', 'live-recordings', true, 5368709120) -- 5 GB
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit;

-- Replays are watched from the storefront by people who are not signed in.
drop policy if exists "live_recordings_public_read" on storage.objects;
create policy "live_recordings_public_read"
  on storage.objects for select
  using (bucket_id = 'live-recordings');

-- The dashboard writes here; the service role bypasses this anyway, and the
-- browser's own upload goes through a signed URL rather than a session.
drop policy if exists "live_recordings_authenticated_write" on storage.objects;
create policy "live_recordings_authenticated_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'live-recordings') with check (bucket_id = 'live-recordings');
