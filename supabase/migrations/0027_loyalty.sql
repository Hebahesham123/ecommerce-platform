-- =============================================================================
-- BEAUTY BAR SOCIETY — loyalty program.
--
-- Currency: SIGNATURES (✦). A customer IS a normalized phone (same identity the
-- rest of the store uses), so every per-user table keys on `phone` → an FK to
-- store_customers is intentionally NOT enforced (a shopper can earn before a
-- profile row exists), but the column matches.
--
-- Integrity rules that live in the database, not the app:
--   • balance is only ever changed by loyalty_award / loyalty_redeem /
--     loyalty_open_vault, each of which writes an immutable transaction row and
--     recomputes the balance under a row lock — atomic by construction.
--   • idempotency (an order/review/one-time bonus can only pay out once) is a
--     UNIQUE constraint, so a retried event cannot double-award.
--   • level is derived from LIFETIME earned and never falls when signatures are
--     spent.
--
-- All tables mirror the project convention: RLS on, one "authenticated" admin
-- policy, and every mutation runs server-side on the service role (which
-- bypasses RLS). Shoppers reach their own data only through server code that
-- resolves their phone from the session cookie / bearer token.
-- =============================================================================

create extension if not exists "pgcrypto";

-- set_updated_at() already exists from 0017; recreate defensively.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =============================================================================
-- CONFIG (admin-editable — change business rules without code)
-- =============================================================================

-- ---- Levels -----------------------------------------------------------------
create table if not exists public.loyalty_levels (
  key         text primary key,            -- discovery | curated | insider | icon | muse
  sort        integer not null,            -- 1..5, the progression order
  name_en     text not null,
  name_ar     text not null,
  tagline_en  text,
  tagline_ar  text,
  threshold   integer not null,            -- lifetime signatures to reach this level
  icon        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---- Earning rules ----------------------------------------------------------
create table if not exists public.loyalty_earning_rules (
  id                uuid primary key default gen_random_uuid(),
  action_type       text not null unique,  -- order | profile_complete | review | birthday | new_category
  title             text,
  signatures        integer not null default 0,   -- flat award (profile/review/birthday…)
  rate_per_egp      numeric not null default 0,    -- for orders: ✦ per 1 EGP
  multiplier        numeric not null default 1,
  min_order_amount  numeric,
  max_reward        integer,
  trigger_status    text,                  -- for orders: which lifecycle pays out (placed|completed|delivered)
  one_time          boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Rewards catalogue ------------------------------------------------------
create table if not exists public.loyalty_rewards (
  id                uuid primary key default gen_random_uuid(),
  title_en          text not null,
  title_ar          text,
  description_en    text,
  description_ar    text,
  type              text not null default 'discount'
                      check (type in ('discount','delivery','product','access','experience','signatures')),
  signature_cost    integer not null default 0,   -- 0 = not signature-purchasable (level/vault reward)
  min_level         text references public.loyalty_levels(key),
  discount_kind     text check (discount_kind in ('percent','amount','free_shipping')),
  discount_value    numeric,                        -- percent (10) or EGP amount
  bonus_signatures  integer,                        -- for type 'signatures'
  min_order_value   numeric,
  expiry_days       integer,                        -- user_reward lifetime once claimed
  usage_limit       integer,                        -- global claims cap (null = unlimited)
  per_user_limit    integer default 1,              -- claims per phone (null = unlimited)
  image             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Privileges (level-gated perks, not necessarily discounts) --------------
create table if not exists public.loyalty_privileges (
  id                uuid primary key default gen_random_uuid(),
  title_en          text not null,
  title_ar          text,
  description_en    text,
  description_ar    text,
  type              text not null default 'perk',
  level_required    text not null references public.loyalty_levels(key),
  active            boolean not null default true,
  start_date        timestamptz,
  end_date          timestamptz,
  usage_limit       integer,
  user_usage_limit  integer,
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Vaults -----------------------------------------------------------------
create table if not exists public.loyalty_vaults (
  id                uuid primary key default gen_random_uuid(),
  vault_type        text not null check (vault_type in ('daily','signature','private','gold')),
  title_en          text not null,
  title_ar          text,
  description_en    text,
  description_ar    text,
  required_progress integer not null default 10,
  level_required    text references public.loyalty_levels(key),
  icon              text,
  active            boolean not null default true,
  start_date        timestamptz,
  end_date          timestamptz,
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Vault reward pool (server-side weighted assignment) --------------------
create table if not exists public.vault_rewards (
  id          uuid primary key default gen_random_uuid(),
  vault_id    uuid not null references public.loyalty_vaults(id) on delete cascade,
  reward_id   uuid not null references public.loyalty_rewards(id) on delete cascade,
  weight      integer not null default 1,   -- relative probability
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists vault_rewards_vault_idx on public.vault_rewards (vault_id) where active;

-- ---- Society events (multipliers / windows) --------------------------------
create table if not exists public.loyalty_events (
  id            uuid primary key default gen_random_uuid(),
  title_en      text not null,
  title_ar      text,
  description_en text,
  description_ar text,
  event_type    text not null default 'multiplier'
                  check (event_type in ('multiplier','offer','drop','moment')),
  multiplier    numeric not null default 1,
  target_levels text[],                       -- null/empty = everyone
  reward_id     uuid references public.loyalty_rewards(id),
  start_date    timestamptz not null,
  end_date      timestamptz not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists loyalty_events_window_idx on public.loyalty_events (start_date, end_date) where active;

-- ---- Streak milestones ------------------------------------------------------
create table if not exists public.loyalty_streak_milestones (
  months            integer primary key,
  title_en          text not null,
  title_ar          text,
  reward_id         uuid references public.loyalty_rewards(id),
  bonus_signatures  integer,
  active            boolean not null default true
);

-- =============================================================================
-- PER-USER STATE
-- =============================================================================

-- ---- Profile: the maintained balance + lifetime totals ----------------------
create table if not exists public.loyalty_profiles (
  phone                 text primary key,
  available_balance     integer not null default 0 check (available_balance >= 0),
  lifetime_earned       integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent        integer not null default 0 check (lifetime_spent >= 0),
  current_level         text not null default 'discovery' references public.loyalty_levels(key),
  profile_bonus_at      timestamptz,          -- one-time profile-completion bonus
  last_birthday_year    integer,              -- birthday bonus, once per calendar year
  joined_at             timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---- Immutable transaction ledger ------------------------------------------
create table if not exists public.signature_transactions (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null,
  direction      text not null check (direction in ('earn','spend','expire','adjustment','bonus')),
  amount         integer not null check (amount >= 0),
  balance_before integer not null,
  balance_after  integer not null,
  source_type    text not null default 'admin'
                   check (source_type in ('order','review','profile','birthday','event','streak','vault','reward','category','admin','signup')),
  source_id      text,
  description    text,
  metadata       jsonb not null default '{}'::jsonb,
  -- Idempotency: an event that carries a dedupe key can only ever post once.
  dedupe_key     text,
  created_at     timestamptz not null default now()
);
create index if not exists sig_tx_phone_idx on public.signature_transactions (phone, created_at desc);
create unique index if not exists sig_tx_dedupe_uidx
  on public.signature_transactions (phone, dedupe_key) where dedupe_key is not null;

-- ---- Claimed rewards --------------------------------------------------------
create table if not exists public.user_rewards (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  reward_id    uuid not null references public.loyalty_rewards(id),
  status       text not null default 'claimed'
                 check (status in ('available','locked','claimed','redeemed','expired')),
  code         text,
  source       text not null default 'reward',  -- reward | vault | streak | event | admin
  source_id    text,
  signatures_spent integer not null default 0,
  expires_at   timestamptz,
  redeemed_at  timestamptz,
  used_at      timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists user_rewards_phone_idx on public.user_rewards (phone, created_at desc);

-- ---- Vault progress / state per user ---------------------------------------
create table if not exists public.user_vaults (
  id                    uuid primary key default gen_random_uuid(),
  phone                 text not null,
  vault_id              uuid not null references public.loyalty_vaults(id) on delete cascade,
  current_progress      integer not null default 0,
  status                text not null default 'locked'
                          check (status in ('locked','ready_to_open','opened','expired')),
  assigned_reward_id    uuid references public.loyalty_rewards(id),
  assigned_user_reward_id uuid references public.user_rewards(id),
  unlocked_at           timestamptz,
  opened_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (phone, vault_id)
);

-- Dedupe vault progress increments (one per source event, e.g. an order).
create table if not exists public.user_vault_events (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  vault_id      uuid not null references public.loyalty_vaults(id) on delete cascade,
  dedupe_key    text not null,
  created_at    timestamptz not null default now(),
  unique (phone, vault_id, dedupe_key)
);

-- ---- Streaks ----------------------------------------------------------------
create table if not exists public.loyalty_streaks (
  phone                text primary key,
  current_streak       integer not null default 0,
  longest_streak       integer not null default 0,
  last_qualified_month text,                 -- 'YYYY-MM'
  updated_at           timestamptz not null default now()
);
create table if not exists public.loyalty_streak_history (
  phone        text not null,
  year_month   text not null,               -- 'YYYY-MM'
  qualified_at timestamptz not null default now(),
  source       text,
  primary key (phone, year_month)
);

-- =============================================================================
-- HELPERS + ATOMIC OPERATIONS
-- =============================================================================

-- The level a lifetime-earned total qualifies for (highest threshold reached).
create or replace function public.loyalty_level_for(p_lifetime integer)
returns text language sql stable as $$
  select key from public.loyalty_levels
  where active and threshold <= greatest(p_lifetime, 0)
  order by threshold desc, sort desc
  limit 1
$$;

-- Ensure a profile row exists; safe to call repeatedly.
create or replace function public.loyalty_ensure_profile(p_phone text)
returns void language plpgsql as $$
begin
  insert into public.loyalty_profiles (phone)
  values (p_phone)
  on conflict (phone) do nothing;
end $$;

-- The one function that moves signatures. Writes a ledger row + updates the
-- balance and lifetime totals atomically, and recomputes the level. Returns
-- what happened so callers can fire notifications (level-up etc.).
create or replace function public.loyalty_award(
  p_phone       text,
  p_direction   text,
  p_amount      integer,
  p_source_type text,
  p_source_id   text default null,
  p_description text default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_dedupe_key  text default null
) returns jsonb
language plpgsql as $$
declare
  v_profile   public.loyalty_profiles%rowtype;
  v_credit    boolean;
  v_amt       integer := abs(coalesce(p_amount, 0));
  v_before    integer;
  v_after     integer;
  v_level_before text;
  v_level_after  text;
begin
  if p_phone is null or p_phone = '' then
    raise exception 'invalid_phone';
  end if;

  perform public.loyalty_ensure_profile(p_phone);
  select * into v_profile from public.loyalty_profiles where phone = p_phone for update;

  -- Idempotent events short-circuit rather than double-posting.
  if p_dedupe_key is not null and exists (
    select 1 from public.signature_transactions
    where phone = p_phone and dedupe_key = p_dedupe_key
  ) then
    return jsonb_build_object(
      'applied', false, 'duplicate', true,
      'balance', v_profile.available_balance,
      'lifetime_earned', v_profile.lifetime_earned,
      'level', v_profile.current_level, 'level_changed', false
    );
  end if;

  v_credit := (p_direction in ('earn','bonus')) or (p_direction = 'adjustment' and coalesce(p_amount,0) >= 0);
  v_before := v_profile.available_balance;

  if not v_credit and v_before < v_amt then
    raise exception 'insufficient_signatures';
  end if;

  v_after := v_before + (case when v_credit then v_amt else -v_amt end);
  v_level_before := v_profile.current_level;

  insert into public.signature_transactions
    (phone, direction, amount, balance_before, balance_after, source_type, source_id, description, metadata, dedupe_key)
  values
    (p_phone, p_direction, v_amt, v_before, v_after, coalesce(p_source_type,'admin'), p_source_id, p_description, coalesce(p_metadata,'{}'::jsonb), p_dedupe_key);

  update public.loyalty_profiles
     set available_balance = v_after,
         lifetime_earned = lifetime_earned + (case when v_credit then v_amt else 0 end),
         lifetime_spent  = lifetime_spent  + (case when v_credit then 0 else v_amt end),
         updated_at = now()
   where phone = p_phone
   returning * into v_profile;

  v_level_after := public.loyalty_level_for(v_profile.lifetime_earned);
  if v_level_after is not null and v_level_after <> v_profile.current_level then
    update public.loyalty_profiles set current_level = v_level_after, updated_at = now() where phone = p_phone;
  end if;

  return jsonb_build_object(
    'applied', true, 'duplicate', false,
    'balance', v_profile.available_balance,
    'lifetime_earned', v_profile.lifetime_earned,
    'level', coalesce(v_level_after, v_profile.current_level),
    'level_before', v_level_before,
    'level_changed', coalesce(v_level_after, v_profile.current_level) <> v_level_before
  );
end $$;

-- Atomic reward redemption: validate, spend, record the claim — all or nothing.
create or replace function public.loyalty_redeem(p_phone text, p_reward_id uuid)
returns jsonb language plpgsql as $$
declare
  v_reward   public.loyalty_rewards%rowtype;
  v_profile  public.loyalty_profiles%rowtype;
  v_lvl_req  integer := 0;
  v_lvl_have integer := 0;
  v_global   integer;
  v_mine     integer;
  v_code     text;
  v_ur       public.user_rewards%rowtype;
begin
  perform public.loyalty_ensure_profile(p_phone);
  select * into v_profile from public.loyalty_profiles where phone = p_phone for update;

  select * into v_reward from public.loyalty_rewards where id = p_reward_id;
  if not found or not v_reward.active then raise exception 'invalid_reward'; end if;

  if v_reward.min_level is not null then
    select sort into v_lvl_req from public.loyalty_levels where key = v_reward.min_level;
    select sort into v_lvl_have from public.loyalty_levels where key = v_profile.current_level;
    if coalesce(v_lvl_have,0) < coalesce(v_lvl_req,0) then raise exception 'level_too_low'; end if;
  end if;

  if v_reward.usage_limit is not null then
    select count(*) into v_global from public.user_rewards where reward_id = p_reward_id;
    if v_global >= v_reward.usage_limit then raise exception 'reward_unavailable'; end if;
  end if;
  if v_reward.per_user_limit is not null then
    select count(*) into v_mine from public.user_rewards where reward_id = p_reward_id and phone = p_phone;
    if v_mine >= v_reward.per_user_limit then raise exception 'already_redeemed'; end if;
  end if;

  if v_reward.signature_cost > 0 then
    if v_profile.available_balance < v_reward.signature_cost then raise exception 'insufficient_signatures'; end if;
    perform public.loyalty_award(
      p_phone, 'spend', v_reward.signature_cost, 'reward', p_reward_id::text,
      'Redeemed: ' || v_reward.title_en, jsonb_build_object('reward_id', p_reward_id), null
    );
  end if;

  v_code := 'BB' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.user_rewards
    (phone, reward_id, status, code, source, signatures_spent, expires_at, metadata)
  values
    (p_phone, p_reward_id, 'claimed', v_code, 'reward', v_reward.signature_cost,
     case when v_reward.expiry_days is not null then now() + (v_reward.expiry_days || ' days')::interval else null end,
     jsonb_build_object('type', v_reward.type))
  returning * into v_ur;

  select * into v_profile from public.loyalty_profiles where phone = p_phone;

  return jsonb_build_object(
    'ok', true,
    'balance', v_profile.available_balance,
    'user_reward', to_jsonb(v_ur)
  );
end $$;

-- Add progress to a user's vault (idempotent per source event), flipping it to
-- ready_to_open when it fills.
create or replace function public.loyalty_add_vault_progress(
  p_phone text, p_vault_id uuid, p_amount integer default 1, p_dedupe_key text default null
) returns jsonb language plpgsql as $$
declare
  v_req integer;
  v_uv  public.user_vaults%rowtype;
begin
  select required_progress into v_req from public.loyalty_vaults where id = p_vault_id and active;
  if v_req is null then return jsonb_build_object('applied', false); end if;

  if p_dedupe_key is not null then
    begin
      insert into public.user_vault_events (phone, vault_id, dedupe_key)
      values (p_phone, p_vault_id, p_dedupe_key);
    exception when unique_violation then
      return jsonb_build_object('applied', false, 'duplicate', true);
    end;
  end if;

  insert into public.user_vaults (phone, vault_id, current_progress, status)
  values (p_phone, p_vault_id, 0, 'locked')
  on conflict (phone, vault_id) do nothing;

  update public.user_vaults
     set current_progress = least(current_progress + greatest(p_amount,0), v_req),
         status = case when least(current_progress + greatest(p_amount,0), v_req) >= v_req
                       and status = 'locked' then 'ready_to_open' else status end,
         unlocked_at = case when least(current_progress + greatest(p_amount,0), v_req) >= v_req
                            and unlocked_at is null then now() else unlocked_at end,
         updated_at = now()
   where phone = p_phone and vault_id = p_vault_id
   returning * into v_uv;

  return jsonb_build_object('applied', true, 'progress', v_uv.current_progress,
    'required', v_req, 'status', v_uv.status);
end $$;

-- Atomic vault open: the SERVER assigns the reward (weighted random), once.
create or replace function public.loyalty_open_vault(p_phone text, p_user_vault_id uuid)
returns jsonb language plpgsql as $$
declare
  v_uv     public.user_vaults%rowtype;
  v_req    integer;
  v_reward public.loyalty_rewards%rowtype;
  v_code   text;
  v_ur     public.user_rewards%rowtype;
begin
  select * into v_uv from public.user_vaults where id = p_user_vault_id for update;
  if not found or v_uv.phone <> p_phone then raise exception 'not_your_vault'; end if;
  if v_uv.status = 'opened' then raise exception 'vault_already_opened'; end if;

  select required_progress into v_req from public.loyalty_vaults where id = v_uv.vault_id;
  if v_uv.current_progress < coalesce(v_req, 999999) then raise exception 'vault_not_ready'; end if;

  -- Reuse an already-assigned reward if somehow re-entered; else pick now.
  if v_uv.assigned_reward_id is not null then
    select * into v_reward from public.loyalty_rewards where id = v_uv.assigned_reward_id;
  else
    select r.* into v_reward
    from public.vault_rewards vr
    join public.loyalty_rewards r on r.id = vr.reward_id and r.active
    where vr.vault_id = v_uv.vault_id and vr.active
    order by power(random(), 1.0 / greatest(vr.weight, 1)) desc
    limit 1;
    if not found then raise exception 'vault_empty'; end if;
  end if;

  v_code := 'BB' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.user_rewards (phone, reward_id, status, code, source, source_id, expires_at, metadata)
  values (p_phone, v_reward.id, 'claimed', v_code, 'vault', v_uv.vault_id::text,
     case when v_reward.expiry_days is not null then now() + (v_reward.expiry_days || ' days')::interval else null end,
     jsonb_build_object('type', v_reward.type))
  returning * into v_ur;

  update public.user_vaults
     set status = 'opened', assigned_reward_id = v_reward.id,
         assigned_user_reward_id = v_ur.id, opened_at = now(), updated_at = now()
   where id = p_user_vault_id;

  return jsonb_build_object('ok', true, 'reward', to_jsonb(v_reward), 'user_reward', to_jsonb(v_ur));
end $$;

-- Count a qualifying month toward the streak (idempotent per month).
create or replace function public.loyalty_touch_streak(p_phone text, p_month text, p_source text default 'order')
returns jsonb language plpgsql as $$
declare
  v_new   boolean := false;
  v_prev  text;
  v_row   public.loyalty_streaks%rowtype;
  v_prev_month text := to_char((to_date(p_month || '-01','YYYY-MM-DD') - interval '1 month'), 'YYYY-MM');
begin
  insert into public.loyalty_streak_history (phone, year_month, source)
  values (p_phone, p_month, p_source)
  on conflict (phone, year_month) do nothing;
  get diagnostics v_new = row_count;

  insert into public.loyalty_streaks (phone) values (p_phone) on conflict (phone) do nothing;
  select * into v_row from public.loyalty_streaks where phone = p_phone for update;

  if v_new then
    v_prev := v_row.last_qualified_month;
    if v_prev = v_prev_month then
      v_row.current_streak := v_row.current_streak + 1;
    elsif v_prev = p_month then
      -- already counted this month (defensive; row_count said new though)
      null;
    else
      v_row.current_streak := 1;
    end if;
    update public.loyalty_streaks
       set current_streak = v_row.current_streak,
           longest_streak = greatest(longest_streak, v_row.current_streak),
           last_qualified_month = p_month,
           updated_at = now()
     where phone = p_phone
     returning * into v_row;
  end if;

  return jsonb_build_object('current_streak', v_row.current_streak,
    'longest_streak', v_row.longest_streak, 'month_counted', v_new,
    'last_month', v_row.last_qualified_month);
end $$;

-- =============================================================================
-- RLS — admin (Supabase-auth) reads/writes; server uses the service role.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'loyalty_levels','loyalty_earning_rules','loyalty_rewards','loyalty_privileges',
    'loyalty_vaults','vault_rewards','loyalty_events','loyalty_streak_milestones',
    'loyalty_profiles','signature_transactions','user_rewards','user_vaults',
    'user_vault_events','loyalty_streaks','loyalty_streak_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_auth_all" on public.%I', t, t);
    execute format('create policy "%s_auth_all" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- updated_at triggers on the mutable tables
do $$
declare t text;
begin
  foreach t in array array[
    'loyalty_levels','loyalty_earning_rules','loyalty_rewards','loyalty_privileges',
    'loyalty_vaults','loyalty_events','loyalty_profiles','user_rewards','user_vaults'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =============================================================================
-- SEED — the Beauty Bar Society defaults (safe to re-run)
-- =============================================================================
insert into public.loyalty_levels (key, sort, name_en, name_ar, tagline_en, tagline_ar, threshold, icon) values
  ('discovery', 1, 'The Discovery', 'الاكتشاف',  'Every great collection starts somewhere.', 'كل مجموعة رائعة تبدأ من مكان ما.', 0,     '✦'),
  ('curated',   2, 'The Curated',   'المنتقاة',   'Your taste is taking shape.',              'ذوقك يتشكّل.',                      500,   '✦'),
  ('insider',   3, 'The Insider',   'من الداخل',  'You know where the good things are.',      'أنتِ تعرفين أين الأشياء الجميلة.',  1500,  '✦'),
  ('icon',      4, 'The Icon',      'الأيقونة',   'More than a member. Part of the story.',    'أكثر من عضو. جزء من القصة.',        4000,  '✦'),
  ('muse',      5, 'The Muse',      'المُلهِمة',   'The highest expression of exceptional taste.', 'أرقى تعبير عن ذوق استثنائي.',    10000, '✦')
on conflict (key) do nothing;

insert into public.loyalty_earning_rules (action_type, title, signatures, rate_per_egp, trigger_status, one_time) values
  ('order',            'Signatures per order',   0,   1, 'placed', false),
  ('profile_complete', 'Profile completion',     100, 0, null,     true),
  ('review',           'Product review',         50,  0, null,     false),
  ('birthday',         'Birthday bonus',         200, 0, null,     false),
  ('new_category',     'New category discovery', 100, 0, null,     false)
on conflict (action_type) do nothing;

-- Rewards catalogue
insert into public.loyalty_rewards (title_en, title_ar, type, signature_cost, min_level, discount_kind, discount_value, expiry_days, per_user_limit) values
  ('Free delivery',        'توصيل مجاني',      'delivery',   300,  'discovery', 'free_shipping', null, 30, 5),
  ('5% off your order',    'خصم ٥٪',           'discount',   500,  'discovery', 'percent', 5,  30, 5),
  ('10% off your order',   'خصم ١٠٪',          'discount',   900,  'curated',   'percent', 10, 30, 5),
  ('15% off your order',   'خصم ١٥٪',          'discount',   1500, 'insider',   'percent', 15, 30, 5),
  ('Free gift with purchase','هدية مع الطلب',  'product',    1200, 'curated',   null, null, 30, 3),
  ('Mystery gift',         'هدية غامضة',        'product',    0,    null,        null, null, 30, null),
  ('Early access',         'وصول مبكر',         'access',     0,    'insider',   null, null, 14, null),
  ('Bonus 100 signatures', 'مئة توقيع إضافية',  'signatures', 0,    null,        null, null, null, null),
  ('Choose your reward',   'اختاري مكافأتك',    'experience', 0,    'muse',      null, null, 30, 1)
on conflict do nothing;

update public.loyalty_rewards set bonus_signatures = 100 where title_en = 'Bonus 100 signatures' and bonus_signatures is null;

insert into public.loyalty_privileges (title_en, title_ar, description_en, level_required, sort) values
  ('Birthday surprise',            'مفاجأة عيد الميلاد', 'A little something on your birthday.',        'discovery', 1),
  ('Private offers',               'عروض خاصة',          'Members-only deals.',                        'curated',   2),
  ('Free delivery events',         'أيام التوصيل المجاني','Free delivery on our society days.',         'curated',   3),
  ('Early access to new drops',    'وصول مبكر',           'Shop new collections before everyone.',      'insider',   4),
  ('Priority support',             'دعم ذو أولوية',       'Skip the line when you need us.',            'icon',      5),
  ('The Muse Box',                 'صندوق المُلهِمة',      'A curated box, just for you.',               'muse',      6),
  ('Choose your reward',           'اختاري مكافأتك',       'Pick the reward you actually want.',         'muse',      7)
on conflict do nothing;

insert into public.loyalty_vaults (vault_type, title_en, title_ar, description_en, required_progress, level_required, icon, sort) values
  ('daily',     'The Daily Vault',     'الخزنة اليومية', 'Small rewards, big joy.',            5,  null,      '🕐', 1),
  ('signature', 'The Signature Vault', 'خزنة التواقيع',  'For our most loved members.',        10, null,      '🎁', 2),
  ('private',   'The Private Vault',   'الخزنة الخاصة',  'Reserved for Insiders and above.',   10, 'insider', '👑', 3),
  ('gold',      'The Gold Vault',      'الخزنة الذهبية', 'The ultimate experience.',           15, 'muse',    '✨', 4)
on conflict do nothing;

-- Populate the Signature Vault's reward pool from the catalogue.
insert into public.vault_rewards (vault_id, reward_id, weight)
select v.id, r.id, w.weight
from public.loyalty_vaults v
join (values
  ('Mystery gift', 40),
  ('Free delivery', 30),
  ('Bonus 100 signatures', 20),
  ('10% off your order', 10)
) as w(title, weight) on true
join public.loyalty_rewards r on r.title_en = w.title
where v.vault_type = 'signature'
  and not exists (select 1 from public.vault_rewards x where x.vault_id = v.id and x.reward_id = r.id);

insert into public.loyalty_streak_milestones (months, title_en, title_ar, bonus_signatures) values
  (3,  '3-month streak',  'ثلاثة أشهر متتالية', 200),
  (6,  '6-month streak',  'ستة أشهر متتالية',   500),
  (12, '12-month streak', 'سنة كاملة',          1500)
on conflict (months) do nothing;

-- A live demo event so multipliers are visible immediately (30-day window).
insert into public.loyalty_events (title_en, title_ar, description_en, event_type, multiplier, start_date, end_date)
select 'Signature Weekend', 'عطلة التواقيع', 'Double signatures on every eligible order.', 'multiplier', 2, now() - interval '1 day', now() + interval '30 days'
where not exists (select 1 from public.loyalty_events where title_en = 'Signature Weekend');
