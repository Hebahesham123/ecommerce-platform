-- =============================================================================
-- Courier accounting detail — CourierPro-style.
--
-- Richer delivery outcomes (canceled / postponed / part pickup / hand-to-hand),
-- per-order hold & deposit fees, tags, an admin comment, and multiple courier
-- photos — everything the per-courier Detailed Accounting Dashboard reads.
-- =============================================================================

-- Expand the confirmed + reported status vocabularies.
alter table public.courier_shipments drop constraint if exists courier_shipments_status_check;
alter table public.courier_shipments
  add constraint courier_shipments_status_check
  check (status in ('assigned','out_for_delivery','delivered','partial','canceled','postponed','part_pickup','hand_to_hand','failed','returned'));

alter table public.courier_shipments drop constraint if exists courier_shipments_reported_status_check;
alter table public.courier_shipments
  add constraint courier_shipments_reported_status_check
  check (reported_status in ('out_for_delivery','delivered','partial','canceled','postponed','part_pickup','hand_to_hand','failed','returned'));

alter table public.courier_shipments
  add column if not exists hold_fee        numeric(12,2) not null default 0,   -- amount held from this order's cash
  add column if not exists hold_active     boolean not null default false,     -- is the hold still in force
  add column if not exists hold_removed_at timestamptz,
  add column if not exists deposit_fee     numeric(12,2) not null default 0,   -- deposit the courier owes/paid
  add column if not exists tags            jsonb not null default '[]'::jsonb,
  add column if not exists admin_comment   text,
  add column if not exists images          jsonb not null default '[]'::jsonb, -- confirmed photo gallery
  add column if not exists reported_images jsonb not null default '[]'::jsonb; -- courier-submitted gallery

create index if not exists courier_shipments_hold_idx on public.courier_shipments (hold_active) where hold_active = true;
