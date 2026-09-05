-- =============================================================================
-- Make the discounts table mean something at checkout.
--
-- 0001 built a full Shopify-parity discount engine and an admin to manage it,
-- but nothing ever read it: checkout priced against a hardcoded list of four
-- codes in src/lib/offers.ts, so every code a merchant created was silently
-- rejected at the till. This migration adds the two things the table was
-- missing to be usable — a record of which order used which code, and a
-- race-safe way to burn one use.
-- =============================================================================

-- ---- What an order actually paid ------------------------------------------
-- The coupon used to be folded into store_orders.note as Arabic prose, which
-- is unreadable to any query. Reporting on "did the discount pay for itself"
-- needs both halves as numbers.
alter table public.store_orders
  add column if not exists discount_code   text,
  add column if not exists discount_amount numeric(12,2) not null default 0;

create index if not exists store_orders_discount_code_idx
  on public.store_orders (lower(discount_code)) where discount_code is not null;

-- ---- Burning one use, atomically -------------------------------------------
-- Checking `used_count < usage_limit_total` in the app and updating afterwards
-- lets two shoppers past the last use of a code. Doing both in one statement
-- means the loser of the race gets no row back and is told the code is spent.
--
-- Returns the new used_count, or null when the code is unknown or exhausted.
create or replace function public.redeem_discount(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if p_code is null or btrim(p_code) = '' then
    return null;
  end if;

  update discounts
     set used_count = used_count + 1
   where lower(code) = lower(btrim(p_code))
     and (usage_limit_total is null or used_count < usage_limit_total)
  returning used_count into v_used;

  return v_used;  -- null when unknown or already at its limit
end $$;

-- ---- Has this shopper already used this code? ------------------------------
-- Backs `usage_limit_once_per_customer`. Phone is the account on this store,
-- and orders placed before phones were normalised are still the same shopper,
-- so the caller passes every spelling of the number.
create or replace function public.discount_used_by(p_code text, p_phones text[])
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from store_orders
   where lower(discount_code) = lower(btrim(p_code))
     and phone = any(p_phones);
$$;
