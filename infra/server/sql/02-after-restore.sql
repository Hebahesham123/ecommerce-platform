-- Run AFTER every restore of the Supabase dump.
--   docker compose exec -T postgres psql -U postgres -d app < sql/02-after-restore.sql

-- The server (service key) can do everything, like Supabase's service_role.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- anon (the public browser key) gets NO table access. Today the browser key is only used for
-- live-chat realtime and storage, and both move off this server. This is safer than Supabase's
-- default, where the public key can reach every table without row-level security.

-- created_by in these two tables pointed at Supabase logins and is unused. Drop the links.
alter table if exists public.entities        drop constraint if exists entities_created_by_fkey;
alter table if exists public.journal_entries drop constraint if exists journal_entries_created_by_fkey;

-- Refresh statistics so the first queries are fast.
analyze;

-- Tell PostgREST to re-read the tables and functions.
notify pgrst, 'reload schema';
