-- Rate limits (OTP send / verify, phone login).
--
-- One row per key (e.g. "otp-send:phone:+2010..."). rate_limit_hit() counts a hit and says whether
-- the caller is still within the limit, atomically, so two requests at the same moment can't both
-- slip through. Plain Postgres: works on Supabase today and on the self-hosted server later.
-- The Garnet cache can take this over later without changing callers (src/lib/rate-limit.ts).

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer     not null default 0
);

-- Server-only table: no public access at all.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Count one hit for p_key. Returns true while hits in the current window <= p_max.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.hits + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning hits into v_hits;

  -- Tidy up old keys now and then (about 1 call in 200), so the table stays small.
  if random() < 0.005 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_max;
end;
$$;

-- Forget a key (e.g. after a correct code).
create or replace function public.rate_limit_reset(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where key = p_key;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_reset(text) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_reset(text) to service_role;
