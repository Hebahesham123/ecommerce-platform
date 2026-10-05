-- =============================================================================
-- Native Courier System operations.
--
-- The suite under /courier-system turns the old embedded iframe app into first
-- party screens: a customer-requests inbox, a returns/failed warehouse intake,
-- an audit log of every courier edit, and a unified couriers + staff directory.
--
-- Confirming a courier report that came back "returned" or "failed" auto-files
-- the order's line items into warehouse_items; every courier mutation is also
-- journaled into courier_logs (best-effort, see src/lib/courier-log.ts).
-- =============================================================================

-- Customer requests / inquiries inbox (CourierPro-style).
create table if not exists public.courier_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  comment     text,
  image_url   text,
  video_url   text,
  status      text not null default 'pending'
                check (status in ('pending','process','approved','cancelled')),
  assignee    text,
  created_by  text default 'admin',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists courier_requests_status_idx on public.courier_requests (status, created_at desc);

-- Threaded notes on a request.
create table if not exists public.courier_request_notes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references public.courier_requests (id) on delete cascade,
  note        text not null,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists courier_request_notes_req_idx on public.courier_request_notes (request_id, created_at desc);

-- Returned / failed / manual stock sitting in the warehouse.
create table if not exists public.warehouse_items (
  id            uuid primary key default gen_random_uuid(),
  order_number  text,
  product_name  text not null,
  sku           text,
  quantity      integer not null default 1,
  source        text default 'returned' check (source in ('returned','failed','other')),
  condition     text default 'unknown'  check (condition in ('good','damaged','unknown')),
  status        text not null default 'in_warehouse'
                  check (status in ('in_warehouse','restocked','needs_repair','scrapped')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists warehouse_items_status_idx on public.warehouse_items (status, created_at desc);
create index if not exists warehouse_items_order_idx  on public.warehouse_items (order_number);

-- Audit log of courier edits (assignments, confirmations, settlements, …).
create table if not exists public.courier_logs (
  id           uuid primary key default gen_random_uuid(),
  actor        text,
  action       text not null,
  target_type  text,
  target_id    text,
  order_number text,
  detail       text,
  created_at   timestamptz not null default now()
);
create index if not exists courier_logs_created_idx on public.courier_logs (created_at desc);

-- Back-office staff directory (distinct from couriers, who sign in to /courier).
create table if not exists public.staff_users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text unique,
  role        text not null default 'manager'
                check (role in ('admin','accountant','warehouse','manager')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at triggers where the shared helper exists.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists courier_requests_set_updated_at on public.courier_requests;
    create trigger courier_requests_set_updated_at before update on public.courier_requests
      for each row execute function public.set_updated_at();
    drop trigger if exists warehouse_items_set_updated_at on public.warehouse_items;
    create trigger warehouse_items_set_updated_at before update on public.warehouse_items
      for each row execute function public.set_updated_at();
    drop trigger if exists staff_users_set_updated_at on public.staff_users;
    create trigger staff_users_set_updated_at before update on public.staff_users
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.courier_requests      enable row level security;
alter table public.courier_request_notes enable row level security;
alter table public.warehouse_items        enable row level security;
alter table public.courier_logs           enable row level security;
alter table public.staff_users            enable row level security;

drop policy if exists "courier_requests_auth_all" on public.courier_requests;
create policy "courier_requests_auth_all" on public.courier_requests for all to authenticated using (true) with check (true);
drop policy if exists "courier_request_notes_auth_all" on public.courier_request_notes;
create policy "courier_request_notes_auth_all" on public.courier_request_notes for all to authenticated using (true) with check (true);
drop policy if exists "warehouse_items_auth_all" on public.warehouse_items;
create policy "warehouse_items_auth_all" on public.warehouse_items for all to authenticated using (true) with check (true);
drop policy if exists "courier_logs_auth_all" on public.courier_logs;
create policy "courier_logs_auth_all" on public.courier_logs for all to authenticated using (true) with check (true);
drop policy if exists "staff_users_auth_all" on public.staff_users;
create policy "staff_users_auth_all" on public.staff_users for all to authenticated using (true) with check (true);
