-- ============================================================================
--  0046 — NEW ACCOUNTING SYSTEM (double-entry) ported into the admin.
--
--  Ported from the standalone newaccounting app. Service-role server actions
--  do all reads/writes, so the auth-bound bits (profiles, is_admin(),
--  handle_new_user(), the on_auth_user_created trigger) are intentionally
--  OMITTED here. The RLS policies below keep the "authenticated" grants from
--  the original so the tables behave the same if ever queried with a user JWT.
--
--  This is SEPARATE from the `accounting_entries` table (migration 0045) used
--  by orders/couriers/paymob — that table is untouched.
--
--  Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE throughout, and the seed
--  at the bottom is guarded so it only populates once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENTITIES (companies / branches)
-- ----------------------------------------------------------------------------
create table if not exists public.entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_name  text,
  currency    text not null default 'EGP',
  logo_url    text,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ACCOUNTS — chart of accounts TREE (adjacency list)
--   type: 'category' (top) -> 'group' -> 'account' (postable leaf)
--   report_category: asset | liability | equity | income | expense
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references public.entities(id) on delete cascade,
  code            text not null,
  name            text not null,
  type            text not null default 'account' check (type in ('category','group','account')),
  report_category text check (report_category in ('asset','liability','equity','income','expense')),
  group_name      text,
  category_name   text,
  parent_id       uuid references public.accounts(id) on delete set null,
  is_postable     boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (entity_id, code)
);
create index if not exists accounts_entity_idx on public.accounts(entity_id);
create index if not exists accounts_parent_idx on public.accounts(parent_id);

-- ----------------------------------------------------------------------------
-- PROJECTS (cost centers)
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.entities(id) on delete cascade,
  name        text not null,
  code        text,
  status      text not null default 'active' check (status in ('active','closed')),
  budget      numeric(18,2),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (entity_id, name)
);
create index if not exists projects_entity_idx on public.projects(entity_id);

-- ----------------------------------------------------------------------------
-- JOURNAL ENTRIES + LINES (double-entry)
-- ----------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.entities(id) on delete cascade,
  entry_no    int not null,
  ref_no      text,
  date        date not null,
  description text,
  is_posted   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (entity_id, entry_no)
);
create index if not exists je_entity_date_idx on public.journal_entries(entity_id, date);

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  account_id  uuid not null references public.accounts(id),
  project_id  uuid references public.projects(id) on delete set null,
  debit       numeric(18,2) not null default 0,
  credit      numeric(18,2) not null default 0,
  description text,
  line_no     int not null default 0
);
create index if not exists jl_entry_idx  on public.journal_lines(entry_id);
create index if not exists jl_account_idx on public.journal_lines(account_id);
create index if not exists jl_project_idx on public.journal_lines(project_id);

-- Convenience: next entry number for an entity
create or replace function public.next_entry_no(p_entity uuid)
returns int language sql stable as $$
  select coalesce(max(entry_no), 0) + 1 from public.journal_entries where entity_id = p_entity;
$$;

-- ============================================================================
--  REPORTING VIEW — flattens every posting with its classification.
-- ============================================================================
create or replace view public.v_ledger as
  select
    e.id            as entity_id,
    je.id           as entry_id,
    je.entry_no,
    je.date,
    je.description  as entry_description,
    a.id            as account_id,
    a.code          as account_code,
    a.name          as account_name,
    a.report_category,
    a.group_name,
    a.category_name,
    p.id            as project_id,
    p.name          as project_name,
    jl.debit,
    jl.credit,
    (jl.debit - jl.credit) as amount,
    jl.description  as line_description
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  join public.entities e         on e.id = je.entity_id
  join public.accounts a         on a.id = jl.account_id
  left join public.projects p    on p.id = jl.project_id;

-- ============================================================================
--  ROW LEVEL SECURITY — any authenticated user can read/write the shared books.
--  (Service-role server actions bypass RLS entirely; these keep behaviour sane
--  if the tables are ever hit with a user JWT.)
-- ============================================================================
alter table public.entities        enable row level security;
alter table public.accounts        enable row level security;
alter table public.projects        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['entities','accounts','projects','journal_entries','journal_lines']
  loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format('create policy "%s read"  on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s write" on public.%I for all    to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================================
--  STORAGE — bucket for entity logos / images.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('entity-images', 'entity-images', true)
on conflict (id) do nothing;

drop policy if exists "entity images read"  on storage.objects;
drop policy if exists "entity images write" on storage.objects;
create policy "entity images read"  on storage.objects for select using (bucket_id = 'entity-images');
create policy "entity images write" on storage.objects for all to authenticated
  using (bucket_id = 'entity-images') with check (bucket_id = 'entity-images');

-- ============================================================================
--  SEED — one entity ('Beauty Bar', EGP) + a starter Arabic chart of accounts.
--  Idempotent: the entity is reused if it already exists, and the chart is only
--  inserted when that entity has no accounts yet.
-- ============================================================================
do $$
declare
  v_entity  uuid;
  v_assets  uuid;
  v_income  uuid;
  v_expense uuid;
begin
  select id into v_entity from public.entities where name = 'Beauty Bar' limit 1;
  if v_entity is null then
    insert into public.entities (name, currency)
    values ('Beauty Bar', 'EGP')
    returning id into v_entity;
  end if;

  if not exists (select 1 from public.accounts where entity_id = v_entity) then
    -- Top-level categories (non-postable)
    insert into public.accounts (entity_id, code, name, type, report_category, category_name, is_postable, sort_order)
    values (v_entity, '1', 'الأصول', 'category', 'asset', 'الأصول', false, 1)
    returning id into v_assets;

    insert into public.accounts (entity_id, code, name, type, report_category, category_name, is_postable, sort_order)
    values (v_entity, '4', 'الإيرادات', 'category', 'income', 'الإيرادات', false, 2)
    returning id into v_income;

    insert into public.accounts (entity_id, code, name, type, report_category, category_name, is_postable, sort_order)
    values (v_entity, '5', 'المصروفات', 'category', 'expense', 'المصروفات', false, 3)
    returning id into v_expense;

    -- Postable leaf accounts (category -> account)
    insert into public.accounts
      (entity_id, code, name, type, report_category, category_name, parent_id, is_postable, sort_order)
    values
      (v_entity, '101', 'خزينة',          'account', 'asset',   'الأصول',    v_assets,  true, 10),
      (v_entity, '102', 'بنك',            'account', 'asset',   'الأصول',    v_assets,  true, 11),
      (v_entity, '103', 'تحصيل البطاقات', 'account', 'asset',   'الأصول',    v_assets,  true, 12),
      (v_entity, '401', 'المبيعات',       'account', 'income',  'الإيرادات', v_income,  true, 20),
      (v_entity, '501', 'تكلفة البضاعة',  'account', 'expense', 'المصروفات', v_expense, true, 30),
      (v_entity, '502', 'الشحن والتوصيل', 'account', 'expense', 'المصروفات', v_expense, true, 31);
  end if;
end $$;
