-- =============================================================================
-- Make redeemed loyalty rewards actually work at checkout.
--
-- loyalty_redeem already spends the signatures and hands back a BB… code, but
-- that code existed nowhere the checkout could see it — the discount engine
-- validates against public.discounts, and nothing was written there. So a
-- redeemed "10% off" did nothing when the shopper typed it in.
--
-- This replaces loyalty_redeem so that, for a discount or delivery reward, it
-- ALSO mints a matching single-use row in public.discounts using the SAME code,
-- in the same transaction as the spend. Percent/amount become an
-- amount_off_order code; a free-delivery reward becomes a free_shipping code.
-- Product / access / experience / signature rewards are unchanged (they carry a
-- claim the staff fulfils, not a checkout code).
-- =============================================================================

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
     jsonb_build_object('type', v_reward.type, 'title', v_reward.title_en))
  returning * into v_ur;

  -- A discount / delivery reward becomes a real, single-use code the checkout
  -- honours. Wrapped so a store without the discounts table still redeems.
  if v_reward.type in ('discount', 'delivery') then
    begin
      insert into public.discounts (
        title, method, code, discount_type, status, value_type, value,
        applies_to, min_requirement, min_amount, eligibility,
        usage_limit_total, usage_limit_once_per_customer, combine_shipping,
        starts_at, ends_at
      ) values (
        'Society · ' || v_reward.title_en,
        'code',
        v_code,
        case when v_reward.type = 'delivery' or v_reward.discount_kind = 'free_shipping'
             then 'free_shipping'::public.discount_type
             else 'amount_off_order'::public.discount_type end,
        'active'::public.discount_status,
        case when v_reward.discount_kind = 'amount'
             then 'fixed_amount'::public.discount_value_type
             else 'percentage'::public.discount_value_type end,
        v_reward.discount_value,
        'all'::public.discount_applies_to,
        case when v_reward.min_order_value is not null
             then 'minimum_amount'::public.discount_min_req
             else 'none'::public.discount_min_req end,
        v_reward.min_order_value,
        'all'::public.discount_eligibility,
        1,      -- single use: this shopper redeemed it once
        false,
        true,   -- a Society reward may stack with free shipping
        now(),
        case when v_reward.expiry_days is not null then now() + (v_reward.expiry_days || ' days')::interval else null end
      );
    exception when undefined_table then
      -- No discounts table in this environment — the claim still stands.
      null;
    end;
  end if;

  select * into v_profile from public.loyalty_profiles where phone = p_phone;

  return jsonb_build_object(
    'ok', true,
    'balance', v_profile.available_balance,
    'code', v_code,
    'user_reward', to_jsonb(v_ur)
  );
end $$;
