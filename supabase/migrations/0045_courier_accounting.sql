-- =============================================================================
-- Native Courier + Accounting.
--
-- The merchant assigns an order to a courier (with a fee set per assignment).
-- The courier logs into their own portal and reports the outcome (delivered /
-- failed / returned) and the cash they collected — this lands as a PENDING
-- report. The admin confirms it on the order screen; confirming records the
-- payment on the order and posts a cash-in entry to Accounting.
-- =============================================================================

-- Couriers (their own login: phone + PIN, hashed).
create table if not exists public.couriers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null unique,
  zone        text,
  pin_hash    text,                                  -- scrypt "salt:hashhex"
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One shipment per order: who it's assigned to, the fee, the confirmed outcome,
-- and the courier's pending report awaiting the admin's confirmation.
create table if not exists public.courier_shipments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.store_orders (id) on delete cascade unique,
  order_number   text not null,
  courier_id     uuid references public.couriers (id) on delete set null,
  fee            numeric(12,2) not null default 0,

  -- Admin-confirmed state.
  status         text not null default 'assigned'
                   check (status in ('assigned','out_for_delivery','delivered','failed','returned')),
  cash_collected numeric(12,2) not null default 0,
  confirmed_at   timestamptz,
  settled_at     timestamptz,                        -- when this courier's cash was reconciled

  -- The courier's pending report (set in the portal, cleared on confirm).
  reported_status text
                   check (reported_status in ('out_for_delivery','delivered','failed','returned')),
  reported_cash   numeric(12,2),
  reported_note   text,
  reported_at     timestamptz,

  assigned_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists courier_shipments_courier_idx on public.courier_shipments (courier_id);
create index if not exists courier_shipments_order_idx   on public.courier_shipments (order_number);
create index if not exists courier_shipments_pending_idx on public.courier_shipments (reported_at) where reported_at is not null;

-- The accounting ledger: cash in from confirmed deliveries and card payments.
create table if not exists public.accounting_entries (
  id            uuid primary key default gen_random_uuid(),
  order_number  text,
  type          text not null default 'cash_in',     -- cash_in (extensible later)
  method        text,                                -- cod | card | manual
  amount        numeric(12,2) not null default 0,    -- money in
  courier_id    uuid references public.couriers (id) on delete set null,
  courier_fee   numeric(12,2) not null default 0,
  net           numeric(12,2) not null default 0,    -- amount - courier_fee
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists accounting_entries_created_idx on public.accounting_entries (created_at desc);
create index if not exists accounting_entries_courier_idx on public.accounting_entries (courier_id);
create index if not exists accounting_entries_order_idx   on public.accounting_entries (order_number);

-- updated_at triggers where the shared helper exists.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists couriers_set_updated_at on public.couriers;
    create trigger couriers_set_updated_at before update on public.couriers
      for each row execute function public.set_updated_at();
    drop trigger if exists courier_shipments_set_updated_at on public.courier_shipments;
    create trigger courier_shipments_set_updated_at before update on public.courier_shipments
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.couriers            enable row level security;
alter table public.courier_shipments   enable row level security;
alter table public.accounting_entries  enable row level security;

drop policy if exists "couriers_auth_all" on public.couriers;
create policy "couriers_auth_all" on public.couriers for all to authenticated using (true) with check (true);
drop policy if exists "courier_shipments_auth_all" on public.courier_shipments;
create policy "courier_shipments_auth_all" on public.courier_shipments for all to authenticated using (true) with check (true);
drop policy if exists "accounting_entries_auth_all" on public.accounting_entries;
create policy "accounting_entries_auth_all" on public.accounting_entries for all to authenticated using (true) with check (true);
