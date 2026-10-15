-- =============================================================================
-- App notifications: messages written in the dashboard, shown in a bell inside
-- the app and popped up on the phone.
--
--   app_devices            → every install of the app, by its visitor id: the
--                            phone it is signed in as (if any) and the token
--                            the phone gave for pop-ups (if it allowed them).
--                            An install that refused pop-ups still has a bell.
--   app_notifications      → each message: what it says, what it opens, who it
--                            was for, and how it went — how many installs it
--                            reached, how many phones it popped up on, how
--                            many opened it.
--   app_notification_inbox → who each message was delivered to, which is the
--                            bell's list, with when it was read and opened.
--                            Written once, when the message is sent: an install
--                            made afterwards does not inherit old messages.
--
-- Written by the server only (service role); read by the dashboard.
--
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.app_devices (
  visitor_id     text primary key,
  phone          text,
  platform       text,                       -- ios | android
  push_token     text unique,                -- ExponentPushToken[...]; null until allowed
  push_enabled   boolean not null default false,
  push_failed_at timestamptz,                -- the push service said the token is dead
  created_at     timestamptz not null default now(),
  last_seen      timestamptz not null default now()
);
create index if not exists app_devices_phone_idx on public.app_devices (phone);

create table if not exists public.app_notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null default '',
  image_url       text,
  -- What a tap opens, in the app's own link shape:
  -- {"productId": ...} | {"handle": ...} | {"url": ...} | {"screen": ...} | {}
  link            jsonb not null default '{}'::jsonb,
  audience        text not null default 'all'
                  check (audience in ('all', 'signed_in', 'buyers', 'cart', 'phones')),
  audience_phones text[] not null default '{}',
  status          text not null default 'draft'
                  check (status in ('draft', 'sending', 'sent', 'failed')),
  recipients      integer not null default 0,  -- installs it was delivered to (the bell)
  pushed          integer not null default 0,  -- phones it popped up on
  push_failed     integer not null default 0,
  opened          integer not null default 0,
  error           text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index if not exists app_notifications_created_idx on public.app_notifications (created_at desc);

create table if not exists public.app_notification_inbox (
  notification_id uuid not null references public.app_notifications (id) on delete cascade,
  visitor_id      text not null,
  delivered_at    timestamptz not null default now(),
  read_at         timestamptz,
  opened_at       timestamptz,
  primary key (notification_id, visitor_id)
);
create index if not exists app_notification_inbox_visitor_idx
  on public.app_notification_inbox (visitor_id, delivered_at desc);

-- One open per install per message, counted once.
create or replace function public.app_notification_opened(p_id uuid, p_visitor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.app_notification_inbox
     set opened_at = now(), read_at = coalesce(read_at, now())
   where notification_id = p_id and visitor_id = p_visitor and opened_at is null;
  if not found then
    return false;
  end if;
  update public.app_notifications set opened = opened + 1 where id = p_id;
  return true;
end
$fn$;

revoke all on function public.app_notification_opened(uuid, text) from public, anon, authenticated;
grant execute on function public.app_notification_opened(uuid, text) to service_role;

-- ---- RLS ----------------------------------------------------------------------
alter table public.app_devices            enable row level security;
alter table public.app_notifications      enable row level security;
alter table public.app_notification_inbox enable row level security;

drop policy if exists "app_devices_auth_all" on public.app_devices;
create policy "app_devices_auth_all" on public.app_devices
  for all to authenticated using (true) with check (true);

drop policy if exists "app_notifications_auth_all" on public.app_notifications;
create policy "app_notifications_auth_all" on public.app_notifications
  for all to authenticated using (true) with check (true);

drop policy if exists "app_notification_inbox_auth_all" on public.app_notification_inbox;
create policy "app_notification_inbox_auth_all" on public.app_notification_inbox
  for all to authenticated using (true) with check (true);
