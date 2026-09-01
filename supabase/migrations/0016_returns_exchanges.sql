-- =============================================================================
-- Returns & exchanges.
--
-- A shopper opens a request against one of their own orders within 14 days of
-- it being placed. A return sends items back for a refund; an exchange sends
-- items back AND picks replacements, so the request also carries the price
-- difference (positive = the shopper owes us, negative = we refund them).
--
-- Stock is deliberately NOT touched when the request is created: goods are
-- still in the shopper's hands and the replacement isn't picked yet. The
-- inventory move happens exactly once, when an admin marks the request
-- completed — see complete_return_request() at the bottom.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.return_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,               -- RX12345678, shown to the shopper
  kind                 text not null check (kind in ('return', 'exchange')),
  status               text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled')),

  order_id             uuid not null references public.store_orders (id) on delete cascade,
  order_number         text not null,
  phone                text not null,
  customer_name        text,

  reason               text,
  note                 text,
  admin_note           text,

  -- Money, all computed server-side from what was actually paid / is priced now.
  returned_value       numeric(12,2) not null default 0,   -- value of the goods coming back
  replacement_value    numeric(12,2) not null default 0,   -- exchange only: value going out
  difference           numeric(12,2) not null default 0,   -- replacement - returned
  refund_amount        numeric(12,2) not null default 0,   -- owed to the shopper (>= 0)
  extra_amount         numeric(12,2) not null default 0,   -- owed by the shopper (>= 0)

  -- The 14-day clock, frozen at request time so a later policy change can't
  -- retroactively invalidate a request that was in time when it was made.
  order_created_at     timestamptz not null,
  window_expires_at    timestamptz not null,

  -- Set once, by complete_return_request(). Its presence is what makes the
  -- stock move idempotent — completing twice can never double-count.
  inventory_applied_at timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists return_requests_status_idx  on public.return_requests (status);
create index if not exists return_requests_phone_idx   on public.return_requests (phone);
create index if not exists return_requests_order_idx   on public.return_requests (order_id);
create index if not exists return_requests_created_idx on public.return_requests (created_at desc);

-- One row per line, both directions:
--   'return'      — coming back from the shopper, goes into stock on completion
--   'replacement' — going out to the shopper, comes out of stock on completion
create table if not exists public.return_request_items (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.return_requests (id) on delete cascade,
  direction     text not null check (direction in ('return', 'replacement')),
  item_id       uuid references public.inventory_items (id) on delete set null,
  order_item_id uuid references public.store_order_items (id) on delete set null,
  product_name  text not null,
  variant_title text,
  sku           text,
  image_url     text,
  price         numeric(12,2) not null default 0,
  quantity      integer not null default 1 check (quantity > 0)
);

create index if not exists return_request_items_request_idx on public.return_request_items (request_id);

-- Defined here rather than leaned on from an earlier migration, so this file
-- applies cleanly on its own.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at
  before update on public.return_requests
  for each row execute function public.set_updated_at();

alter table public.return_requests      enable row level security;
alter table public.return_request_items enable row level security;

drop policy if exists "return_requests_auth_all" on public.return_requests;
create policy "return_requests_auth_all" on public.return_requests
  for all to authenticated using (true) with check (true);

drop policy if exists "return_request_items_auth_all" on public.return_request_items;
create policy "return_request_items_auth_all" on public.return_request_items
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- Completing a request: the ONLY thing that moves stock.
--
-- Returned goods go back on the shelf; replacements come off it, under the same
-- row locks and the same insufficient_stock rejection that checkout uses, so a
-- replacement can never oversell. Either the whole request applies or none of
-- it does. Calling it twice is a no-op guarded by inventory_applied_at.
-- =============================================================================
create or replace function public.complete_return_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req       record;
  v_line      record;
  v_tracked   boolean;
  v_avail     integer;
  v_remaining integer;
  v_take      integer;
  v_target    uuid;
  v_lvl       record;
begin
  -- Lock the request so two admins clicking "completed" together can't both apply.
  select * into v_req from return_requests where id = p_request for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
  if v_req.inventory_applied_at is not null then
    return v_req.id;  -- already applied; completing again changes nothing
  end if;
  if v_req.status = 'rejected' or v_req.status = 'cancelled' then
    raise exception 'request_closed' using errcode = 'P0001';
  end if;

  -- 1) Replacements first: if stock is short the whole thing rolls back before
  --    anything has been put back on the shelf.
  for v_line in
    select * from return_request_items
     where request_id = p_request and direction = 'replacement' and item_id is not null
  loop
    select tracked into v_tracked from inventory_items where id = v_line.item_id;
    if coalesce(v_tracked, false) = false then
      continue;
    end if;

    perform 1 from inventory_levels where item_id = v_line.item_id for update;

    select coalesce(sum(greatest(0, on_hand - committed)), 0)
      into v_avail
      from inventory_levels
     where item_id = v_line.item_id;

    if v_avail < v_line.quantity then
      raise exception 'insufficient_stock:%', v_line.item_id using errcode = 'P0001';
    end if;

    v_remaining := v_line.quantity;
    for v_lvl in
      select id, greatest(0, on_hand - committed) as avail
        from inventory_levels
       where item_id = v_line.item_id and (on_hand - committed) > 0
       order by (on_hand - committed) desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_lvl.avail);
      update inventory_levels set on_hand = on_hand - v_take where id = v_lvl.id;
      v_remaining := v_remaining - v_take;
    end loop;
  end loop;

  -- 2) Returned goods back into stock, at the location that already stocks the
  --    item, else the default location.
  for v_line in
    select * from return_request_items
     where request_id = p_request and direction = 'return' and item_id is not null
  loop
    select tracked into v_tracked from inventory_items where id = v_line.item_id;
    if coalesce(v_tracked, false) = false then
      continue;
    end if;

    select location_id into v_target
      from inventory_levels
     where item_id = v_line.item_id
     order by on_hand desc
     limit 1;

    if v_target is null then
      select id into v_target from locations order by is_default desc, created_at asc limit 1;
    end if;
    if v_target is null then
      continue;  -- no locations configured at all; nothing sensible to credit
    end if;

    insert into inventory_levels (item_id, location_id, on_hand)
    values (v_line.item_id, v_target, v_line.quantity)
    on conflict (item_id, location_id)
      do update set on_hand = inventory_levels.on_hand + excluded.on_hand;
  end loop;

  update return_requests
     set status = 'completed',
         completed_at = now(),
         inventory_applied_at = now()
   where id = p_request;

  return p_request;
end $$;
