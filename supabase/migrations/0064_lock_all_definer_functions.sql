-- =============================================================================
-- Every SECURITY DEFINER function in `public` becomes service_role only.
--
-- WHY THERE WERE STILL 20 OPEN AFTER 0063
--
-- 0063 named the functions whose migrations never had a REVOKE. But functions
-- whose migrations DO have one — the analytics and tracking families in 0042,
-- 0053, 0055, 0056, 0058, 0059, 0060 and 0061 — were open too, and that looked
-- impossible until you see how this database was built:
--
--     pg_dump   ... --no-owner --no-privileges
--     pg_restore ... --no-owner --no-privileges
--
-- --no-privileges strips every GRANT and REVOKE from the dump. So the revokes
-- those migrations had already applied on Supabase never arrived here, and
-- each function came back at the PostgreSQL default — EXECUTE to PUBLIC, which
-- anon inherits. 02-after-restore.sql then granted service_role what it needed
-- but never re-applied the revokes.
--
-- Tables survived the same stripping safely, because their default is no
-- access rather than access for everyone. Functions default the other way, so
-- the restore quietly opened all of them. SECURITY DEFINER means RLS does not
-- stop them either.
--
-- This file therefore does not name functions. It reads the catalogue and
-- closes anything that is both SECURITY DEFINER and reachable by PUBLIC, anon
-- or authenticated, so it also catches whatever the next restore reopens. It
-- is safe to run repeatedly.
--
-- THE ALLOWLIST IS EMPTY, DELIBERATELY
--
-- Nothing in a browser talks to this database. Every RPC caller in the app is
-- a file that begins `import "server-only"` and goes through
-- getServerSupabase(), which uses DATABASE_API_KEY — a service_role key. The
-- storefront and the phone app reach Next.js API routes, and those routes make
-- the call server-side; the generated app contains no database client at all.
-- n8n uses the same service key. The event recorders (analytics_touch,
-- shopper_touch, live_view, live_like, app_notification_opened …) look like
-- they are called from the storefront, and they are — but by the server
-- handling the storefront's request, never by the visitor's browser.
--
-- If a function ever does need to be callable without a key, add it here with
-- a reason, so that it is a decision rather than an oversight.
-- =============================================================================

do $$
declare
  f record;
  n integer := 0;
  allow text[] := array[]::text[];   -- see above; empty on purpose
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prosecdef
       and not (p.proname = any (allow))
       and (
            has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('public', p.oid, 'execute')
       )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    n := n + 1;
    raise notice 'locked %', f.sig;
  end loop;

  raise notice '0064: closed % security-definer function(s)', n;
end $$;

-- What should be left: nothing.
do $$
declare
  leftover integer;
begin
  select count(*) into leftover
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));
  if leftover > 0 then
    raise exception '0064: % security-definer function(s) are still reachable by anon', leftover;
  end if;
  raise notice '0064: verified — no security-definer function is reachable by anon';
end $$;
