-- =============================================================================
-- Take SECURITY DEFINER functions away from the public API.
--
-- PostgREST publishes every function in `public` at /rest/v1/rpc/<name>, and a
-- new function is EXECUTEable by PUBLIC unless told otherwise. SECURITY
-- DEFINER then runs it as the owner, so RLS and table grants do not stop it.
-- Together that means anyone who could reach the API could place an order,
-- record a payment, fulfil, restock, redeem a discount or edit an order —
-- without any key at all, because `anon` inherits PUBLIC.
--
-- This was found on the server, not here: 0062 shipped SECURITY DEFINER with
-- no REVOKE, following the same omission in 0009, 0011, 0016, 0019, 0024,
-- 0028 and 0043. The REVOKE/GRANT below was already applied by hand to
-- order_edit and order_edit_stock; this file is what makes the repo say the
-- same thing as the database, and closes the rest at the same time.
--
-- Safe for this app: nothing in a browser talks to this database. The only
-- browser client (src/lib/chat/supabase-browser.ts) points at the separate
-- chat project. Every call here comes from Next.js server code through
-- getServerSupabase(), which uses DATABASE_API_KEY — a service_role key — and
-- from n8n, which uses the same key. Both keep working.
--
-- Re-runnable: it reads the catalogue rather than naming signatures, so it
-- covers every overload (place_store_order has more than one) and does
-- nothing surprising if run twice.
-- =============================================================================

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
       and p.prosecdef                     -- SECURITY DEFINER only
       and p.proname = any (array[
         -- stock and orders
         'decrement_stock',
         'place_store_order',
         'order_record_payment',
         'order_recompute_payment',
         'order_recompute_fulfillment',
         'order_fulfill',
         'order_unfulfill',
         'order_restock',
         'order_edit',
         'order_edit_stock',
         -- returns and discounts
         'complete_return_request',
         'redeem_discount',
         'discount_used_by',
         -- the shared updated_at trigger (triggers do not need EXECUTE, so
         -- taking it away costs nothing and leaves one less entry point)
         'set_updated_at'
       ])
  loop
    -- anon and authenticated are named as well as PUBLIC: a Supabase dump
    -- grants them directly, and losing PUBLIC does not drop a direct grant.
    -- This is the same pair of statements 0053 onwards already use.
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    n := n + 1;
    raise notice 'locked %', f.sig;
  end loop;

  raise notice '0063: % security-definer function(s) are now service_role only', n;
end $$;
