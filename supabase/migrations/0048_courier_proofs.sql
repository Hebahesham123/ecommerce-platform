-- =============================================================================
-- Courier upgrades: proof-of-delivery photo + partial delivery.
--
-- Couriers attach a photo when they deliver, and can report a PARTIAL delivery
-- (some of the order handed over, part of the cash collected). Both the
-- courier's reported photo and the admin-confirmed one are kept.
-- =============================================================================

alter table public.courier_shipments
  add column if not exists proof_url          text,   -- confirmed proof-of-delivery image
  add column if not exists reported_proof_url text;   -- the courier's submitted photo

-- Allow 'partial' alongside the existing statuses.
alter table public.courier_shipments drop constraint if exists courier_shipments_status_check;
alter table public.courier_shipments
  add constraint courier_shipments_status_check
  check (status in ('assigned','out_for_delivery','delivered','partial','failed','returned'));

alter table public.courier_shipments drop constraint if exists courier_shipments_reported_status_check;
alter table public.courier_shipments
  add constraint courier_shipments_reported_status_check
  check (reported_status in ('out_for_delivery','delivered','partial','failed','returned'));

-- Public bucket for proof images (same pattern as entity-images).
insert into storage.buckets (id, name, public)
values ('courier-proofs', 'courier-proofs', true)
on conflict (id) do nothing;

drop policy if exists "courier proofs read"  on storage.objects;
drop policy if exists "courier proofs write" on storage.objects;
create policy "courier proofs read"  on storage.objects for select using (bucket_id = 'courier-proofs');
create policy "courier proofs write" on storage.objects for all to authenticated
  using (bucket_id = 'courier-proofs') with check (bucket_id = 'courier-proofs');
