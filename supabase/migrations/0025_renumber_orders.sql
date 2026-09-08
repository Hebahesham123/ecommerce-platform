-- =============================================================================
-- Renumber the orders that came before the counter.
--
-- 0024 makes new orders count from 1. This makes the twenty-odd already in the
-- book count too, oldest first, so the whole list reads 1, 2, 3 rather than a
-- run of clock numbers followed by a fresh start.
--
-- This rewrites numbers that have already been said out loud — a customer
-- holding "BB88239602" from a WhatsApp message will not find it after this
-- runs. That is the trade: one readable book, at the cost of the receipts
-- already issued. Nothing inside the platform is left dangling; every table
-- that carries an order number is carried across with it.
--
-- Run 0024 first. Run this once.
-- =============================================================================

do $$
begin
  if to_regclass('public.store_order_counter') is null then
    raise exception
      'Run 0024_order_numbers.sql first — there is no counter to set afterwards.';
  end if;
end $$;

-- Who becomes what. Oldest order is 1; `id` breaks ties so two orders placed in
-- the same instant still get a stable, repeatable answer.
create temp table renumber on commit drop as
select
  id,
  order_number as old_number,
  (row_number() over (order by created_at, id))::text as new_number
from public.store_orders;

-- Numbers are unique, so they cannot be swapped in place — 3 cannot become 1
-- while some other row is still holding 1. Park them all somewhere no real
-- number can collide with, then write the real ones.
update public.store_orders o
   set order_number = 'renumbering-' || o.id::text;

update public.store_orders o
   set order_number = r.new_number
  from renumber r
 where r.id = o.id;

-- Every other table that references an order by its number, whichever of them
-- this database happens to have. Returns, reviews, requests and nudge
-- conversions all store the number as text; naming them by hand here would
-- mean this file quietly rotting the next time one is added.
do $$
declare
  t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name = 'order_number'
       and c.table_name <> 'store_orders'
  loop
    execute format(
      'update public.%I x set order_number = r.new_number
         from renumber r
        where x.order_number = r.old_number',
      t.table_name
    );
  end loop;
end $$;

-- Carry on from the end of the book.
update public.store_order_counter
   set next_number = coalesce(
         (select max(order_number::bigint) + 1
            from public.store_orders
           where order_number ~ '^[0-9]+$'),
         1
       ),
       updated_at = now()
 where id;

-- What the book looks like now, and what the next order will be called.
select
  (select count(*) from public.store_orders) as orders,
  (select min(order_number::bigint) from public.store_orders
    where order_number ~ '^[0-9]+$') as first_number,
  (select max(order_number::bigint) from public.store_orders
    where order_number ~ '^[0-9]+$') as last_number,
  (select next_number from public.store_order_counter) as next_order_will_be;
