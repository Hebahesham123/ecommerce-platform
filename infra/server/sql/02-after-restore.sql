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

-- ---------------------------------------------------------------------------
-- Close the SECURITY DEFINER functions. MUST stay in this file.
--
-- The dump is taken and restored with --no-privileges, which throws away every
-- GRANT and REVOKE. Tables survive that safely, because their default is no
-- access. Functions do not: the default is EXECUTE to PUBLIC, which anon
-- inherits, and SECURITY DEFINER then runs them as the owner, past RLS. So a
-- restore silently reopens every function whose migration had revoked it —
-- which is exactly what happened on 2026-11, and what migration 0064 cleaned
-- up. Without these lines the next rebuild would do it again.
--
-- Same rule as 0064: nothing in a browser talks to this database, so every
-- security-definer function is service_role only.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  n integer := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prosecdef
       and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('public', p.oid, 'execute'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    n := n + 1;
  end loop;
  raise notice 'after-restore: closed % security-definer function(s)', n;
end $$;

-- created_by in these two tables pointed at Supabase logins and is unused. Drop the links.
alter table if exists public.entities        drop constraint if exists entities_created_by_fkey;
alter table if exists public.journal_entries drop constraint if exists journal_entries_created_by_fkey;

-- Refresh statistics so the first queries are fast.
analyze;

-- Tell PostgREST to re-read the tables and functions.
notify pgrst, 'reload schema';
