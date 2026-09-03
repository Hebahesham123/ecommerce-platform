-- =============================================================================
-- General customer requests — the "something else" branch of the Requests page.
--
-- Returns and exchanges have their own tables (0016) because they move stock and
-- money. Everything else a shopper writes in — a question, a complaint, a
-- change of address — has no such machinery and lands here.
--
-- This replaces public/widgets/requests.html, which posted straight into a
-- SEPARATE Supabase project using an anon key hardcoded into a public page.
-- Nothing submitted through it ever reached this dashboard, which is the same
-- fault the reviews form had before 0017. Submissions now arrive through a
-- server action on the service role, so no key is exposed and the request is
-- readable here.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.store_requests (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,            -- RQ12345678, shown to the shopper

  -- Who is asking. Phone is the account here, so a signed-in shopper is
  -- recorded from their session rather than from anything the page claims.
  name          text not null,
  email         text,
  phone         text,
  session_phone text,

  -- What they are asking. `order_number` is free text: a shopper referencing an
  -- order they can no longer return is still a request worth reading.
  subject       text,
  message       text not null,
  order_number  text,

  -- [{ url, kind, name }] — photos/videos uploaded to the public `files` bucket.
  attachments   jsonb not null default '[]'::jsonb,

  status        text not null default 'new'
                  check (status in ('new', 'open', 'resolved', 'closed')),
  admin_note    text,

  source        text not null default 'storefront',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists store_requests_status_idx  on public.store_requests (status);
create index if not exists store_requests_created_idx on public.store_requests (created_at desc);
create index if not exists store_requests_phone_idx   on public.store_requests (phone);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists store_requests_set_updated_at on public.store_requests;
create trigger store_requests_set_updated_at
  before update on public.store_requests
  for each row execute function public.set_updated_at();

-- Submissions arrive through a server action on the service role, so the only
-- policy needed is the admin's own read/write.
alter table public.store_requests enable row level security;
drop policy if exists "store_requests_auth_all" on public.store_requests;
create policy "store_requests_auth_all" on public.store_requests
  for all to authenticated using (true) with check (true);
