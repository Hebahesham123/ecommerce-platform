-- =============================================================================
-- Native blog: a CMS table the admin writes to and the storefront reads from.
--
-- A post is a draft until it is published; publishing stamps `published_at`
-- (the storefront orders by it, newest first) and flips `status`. `slug` is the
-- storefront URL key and is unique. `body` holds HTML the editor authored and
-- the article page renders as-is. `tags` is a JSON array of strings.
-- =============================================================================

create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  excerpt         text,
  body            text,
  cover_image     text,
  status          text not null default 'draft' check (status in ('draft','published')),
  tags            jsonb not null default '[]'::jsonb,
  seo_title       text,
  seo_description text,
  author          text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- The storefront list query: published posts, newest first.
create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc);
-- Slug lookups for the article page (also enforced unique by the column).
create unique index if not exists blog_posts_slug_key
  on public.blog_posts (slug);

alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts_auth_all" on public.blog_posts;
create policy "blog_posts_auth_all" on public.blog_posts
  for all to authenticated using (true) with check (true);

-- Keep updated_at fresh on every write, but only if the shared trigger function
-- exists (earlier migrations define it; guard so this file is safe standalone).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
    create trigger blog_posts_set_updated_at
      before update on public.blog_posts
      for each row execute function public.set_updated_at();
  end if;
end $$;
