-- =============================================================================
-- admin_audit: an append-only record of the dangerous things staff do.
--
-- Who did it, what, when, and the before and after values — for refunds,
-- discounts, gift cards and order edits (security plan step 3.4).
--
-- APPEND-ONLY IS ENFORCED BY A TRIGGER, NOT BY GRANTS
--
-- Grants alone would not hold here. 02-after-restore.sql runs
-- `grant all on all tables in schema public to service_role` and sets the same
-- as a default privilege, so a rebuild would hand UPDATE and DELETE straight
-- back. The dump is also restored with --no-privileges, which throws away
-- whatever this file revoked (that is what reopened every function and needed
-- 0064). A trigger survives both: it is part of the schema, it is restored
-- with the table, and no grant can talk it out of refusing.
--
-- The revokes are still here as the outer layer. Neither is load-bearing alone.
--
-- Retention: there is deliberately no way to delete a row. If the table ever
-- needs trimming, that is a migration that drops the trigger, trims, and puts
-- it back — which leaves a record of the trimming in the migration history.
-- =============================================================================

create table if not exists public.admin_audit (
  id          bigserial primary key,
  at          timestamptz not null default now(),

  -- Who. Null until staff sign-ins exist (plan 3.1/3.3): today it is filled
  -- from the X-Admin-User header that Caddy sets from the dashboard password,
  -- and that header is only trustworthy once steps 1.0 and 1.1 are live. Null
  -- means "we genuinely do not know", which is worth recording honestly.
  actor       text,

  -- What, as a stable key: 'order.edit', 'order.customer_edit', 'order.refund'.
  action      text not null,
  -- What it was done to, in the merchant's terms: usually the order number.
  subject     text,
  -- One line a person can read without decoding the json.
  summary     text,

  -- The values on either side of the change. Keep them small and relevant:
  -- the fields that moved, not a dump of the row.
  before_data jsonb,
  after_data  jsonb,

  -- Anything else worth keeping (reason, amounts, ids).
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_at_idx      on public.admin_audit (at desc);
create index if not exists admin_audit_action_idx  on public.admin_audit (action, at desc);
create index if not exists admin_audit_subject_idx on public.admin_audit (subject, at desc);

-- ---- append-only ------------------------------------------------------------
-- Plain SECURITY INVOKER on purpose: it needs no privileges of its own, and a
-- definer function here would be one more thing for 0064 to have to close.
create or replace function public.admin_audit_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit is append-only (attempted %)', tg_op using errcode = 'P0001';
end $$;

drop trigger if exists admin_audit_no_change on public.admin_audit;
create trigger admin_audit_no_change
  before update or delete on public.admin_audit
  for each row execute function public.admin_audit_append_only();

drop trigger if exists admin_audit_no_truncate on public.admin_audit;
create trigger admin_audit_no_truncate
  before truncate on public.admin_audit
  for each statement execute function public.admin_audit_append_only();

-- ---- who can reach it -------------------------------------------------------
alter table public.admin_audit enable row level security;
-- No policies at all. service_role was created with BYPASSRLS, so the server
-- reads and writes normally; anon and authenticated have no way through.

revoke all on table public.admin_audit from public, anon, authenticated;
grant insert, select on table public.admin_audit to service_role;
grant usage, select on sequence public.admin_audit_id_seq to service_role;

-- ---- prove it, here, on first apply -----------------------------------------
-- This SQL has never run anywhere, so the first apply is also the test. It
-- writes a row, tries to tamper with it both ways, and requires both to be
-- refused.
--
-- The row is undone by rolling back rather than deleting it, because deleting
-- it is exactly what the trigger forbids — there is no way to take a row out
-- of an append-only log, which is the whole idea. Raising inside the block
-- discards the insert and everything with it; plpgsql variables are not
-- transactional, so the two results survive the rollback and can be checked
-- afterwards.
do $$
declare
  v_id          bigint;
  update_refused boolean := false;
  delete_refused boolean := false;
begin
  begin
    insert into public.admin_audit (actor, action, subject, summary)
    values (null, 'audit.selftest', '-', '0065 self-test — rolled back')
    returning id into v_id;

    begin
      update public.admin_audit set summary = 'tampered with' where id = v_id;
    exception when others then
      update_refused := true;
    end;

    begin
      delete from public.admin_audit where id = v_id;
    exception when others then
      delete_refused := true;
    end;

    -- Undo the test row.
    raise exception using errcode = 'P0001', message = '__selftest_rollback__';
  exception when others then
    if sqlerrm <> '__selftest_rollback__' then
      raise;                       -- a real failure: let it out
    end if;
  end;

  if not update_refused then
    raise exception '0065 self-test FAILED: UPDATE on admin_audit was not refused';
  end if;
  if not delete_refused then
    raise exception '0065 self-test FAILED: DELETE on admin_audit was not refused';
  end if;

  raise notice '0065 self-test: UPDATE and DELETE both refused, test row rolled back';
end $$;

-- Nothing should remain from the self-test.
do $$
declare
  n integer;
begin
  select count(*) into n from public.admin_audit where action = 'audit.selftest';
  if n <> 0 then
    raise exception '0065: the self-test left % row(s) behind', n;
  end if;
  raise notice '0065: admin_audit is empty and append-only';
end $$;

-- PostgREST caches the schema; without this the table is invisible until a
-- restart.
notify pgrst, 'reload schema';
