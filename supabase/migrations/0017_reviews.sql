-- =============================================================================
-- Customer reviews, in THIS project.
--
-- The review form used to write straight into a separate Supabase project with
-- its own anon key, which is why nothing a customer submitted ever reached this
-- dashboard. The form now posts to /api/reviews and lands here, where reviews
-- can be read, moderated, and picked out for the Happy Customers page.
--
-- `featured` is that pick: published says a review may be shown at all,
-- featured says it earns a place on the Happy Customers page.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.store_reviews (
  id               uuid primary key default gen_random_uuid(),
  reviewer_name    text not null,
  product_rating   integer check (product_rating between 1 and 5),
  shipping_rating  integer check (shipping_rating between 1 and 5),
  support_rating   integer check (support_rating between 1 and 5),
  experience_level text,                                  -- Easy | Medium | Hard
  comment          text,

  -- Nothing shows on the storefront until someone here says so.
  status           text not null default 'pending'
                     check (status in ('pending', 'published', 'hidden')),
  featured         boolean not null default false,        -- Happy Customers page
  featured_order   integer,                              -- optional manual order

  -- Where it came from, and who wrote it when we can tell (the form is open to
  -- anonymous shoppers, so both may be null).
  source           text not null default 'storefront',
  phone            text,
  order_number     text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists store_reviews_status_idx   on public.store_reviews (status);
create index if not exists store_reviews_featured_idx on public.store_reviews (featured) where featured;
create index if not exists store_reviews_created_idx  on public.store_reviews (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists store_reviews_set_updated_at on public.store_reviews;
create trigger store_reviews_set_updated_at
  before update on public.store_reviews
  for each row execute function public.set_updated_at();

-- Submissions arrive through a server route on the service role, so the only
-- policy needed is the admin's own read/write.
alter table public.store_reviews enable row level security;
drop policy if exists "store_reviews_auth_all" on public.store_reviews;
create policy "store_reviews_auth_all" on public.store_reviews
  for all to authenticated using (true) with check (true);
