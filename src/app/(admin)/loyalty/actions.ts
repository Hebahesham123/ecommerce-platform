"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { awardSignatures } from "@/lib/loyalty/service";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return err.code === "42P01" || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table");
}

export type LoyaltyLevelRow = { key: string; sort: number; name_en: string; name_ar: string; threshold: number; color: string | null };
export type EarningRuleRow = { id: string; action_type: string; title: string | null; signatures: number; rate_per_egp: number; multiplier: number; active: boolean };
export type RewardRow = {
  id: string; title_en: string; title_ar: string | null; type: string; signature_cost: number;
  min_level: string | null; discount_kind: string | null; discount_value: number | null; active: boolean; per_user_limit: number | null;
};
export type VaultRow = { id: string; vault_type: string; title_en: string; required_progress: number; level_required: string | null; active: boolean };
export type EventRow = { id: string; title_en: string; event_type: string; multiplier: number; start_date: string; end_date: string; active: boolean };

export type LoyaltyOverview = {
  levels: LoyaltyLevelRow[];
  rules: EarningRuleRow[];
  rewards: RewardRow[];
  vaults: VaultRow[];
  events: EventRow[];
  stats: {
    members: number;
    signaturesIssued: number;
    signaturesSpent: number;
    rewardsClaimed: number;
    membersByLevel: Record<string, number>;
  };
};

export async function getLoyaltyOverview(): Promise<ActionResult<LoyaltyOverview>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const [levels, rules, rewards, vaults, events, profiles, claims] = await Promise.all([
      supabase.from("loyalty_levels").select("key,sort,name_en,name_ar,threshold,color").order("sort"),
      supabase.from("loyalty_earning_rules").select("id,action_type,title,signatures,rate_per_egp,multiplier,active").order("action_type"),
      supabase.from("loyalty_rewards").select("id,title_en,title_ar,type,signature_cost,min_level,discount_kind,discount_value,active,per_user_limit").order("signature_cost"),
      supabase.from("loyalty_vaults").select("id,vault_type,title_en,required_progress,level_required,active").order("sort"),
      supabase.from("loyalty_events").select("id,title_en,event_type,multiplier,start_date,end_date,active").order("start_date", { ascending: false }),
      supabase.from("loyalty_profiles").select("current_level,lifetime_earned,lifetime_spent"),
      supabase.from("user_rewards").select("id", { count: "exact", head: true }),
    ]);

    if (levels.error && missing(levels.error)) return { ok: false, error: "migration_missing" };
    if (levels.error) return { ok: false, error: levels.error.message };

    const profRows = (profiles.data ?? []) as Row[];
    const membersByLevel: Record<string, number> = {};
    let issued = 0;
    let spent = 0;
    for (const p of profRows) {
      const lvl = String(p.current_level ?? "discovery");
      membersByLevel[lvl] = (membersByLevel[lvl] ?? 0) + 1;
      issued += Number(p.lifetime_earned) || 0;
      spent += Number(p.lifetime_spent) || 0;
    }

    return {
      ok: true,
      data: {
        levels: (levels.data ?? []) as LoyaltyLevelRow[],
        rules: (rules.data ?? []) as EarningRuleRow[],
        rewards: (rewards.data ?? []) as RewardRow[],
        vaults: (vaults.data ?? []) as VaultRow[],
        events: (events.data ?? []) as EventRow[],
        stats: {
          members: profRows.length,
          signaturesIssued: issued,
          signaturesSpent: spent,
          rewardsClaimed: claims.count ?? 0,
          membersByLevel,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type MemberRow = {
  phone: string;
  name: string | null;
  level: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  joinedAt: string;
};

export async function listLoyaltyMembers(): Promise<ActionResult<MemberRow[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("loyalty_profiles")
      .select("phone,current_level,available_balance,lifetime_earned,lifetime_spent,joined_at")
      .order("lifetime_earned", { ascending: false })
      .limit(1000);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };

    const phones = (data ?? []).map((r: Row) => String(r.phone));
    const names = new Map<string, string>();
    if (phones.length) {
      const { data: cust } = await supabase.from("store_customers").select("phone,name").in("phone", phones);
      for (const c of (cust ?? []) as Row[]) names.set(String(c.phone), String(c.name ?? ""));
    }

    return {
      ok: true,
      data: (data ?? []).map((r: Row): MemberRow => ({
        phone: String(r.phone),
        name: names.get(String(r.phone)) || null,
        level: String(r.current_level ?? "discovery"),
        balance: Number(r.available_balance) || 0,
        lifetimeEarned: Number(r.lifetime_earned) || 0,
        lifetimeSpent: Number(r.lifetime_spent) || 0,
        joinedAt: String(r.joined_at ?? ""),
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Toggle a reward on/off in the catalogue. */
export async function setRewardActive(id: string, active: boolean): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("loyalty_rewards").update({ active }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Update a reward's signature cost. */
export async function setRewardCost(id: string, cost: number): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("loyalty_rewards").update({ signature_cost: Math.max(0, Math.trunc(cost)) }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Change the lifetime threshold for a level. */
export async function setLevelThreshold(key: string, threshold: number): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("loyalty_levels").update({ threshold: Math.max(0, Math.trunc(threshold)) }).eq("key", key);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Set the colour a level is shown in.
 *
 * One hex value per level; every shade a screen needs is mixed from it, so
 * this is the only thing to choose. Anything that is not a colour is stored
 * as none, and the storefront falls back to its own default rather than
 * rendering something broken.
 */
export async function setLevelColor(key: string, color: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const hex = color.trim();
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("loyalty_levels")
      .update({ color: valid ? hex.toLowerCase() : null })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Manually credit or debit a member's signatures (recorded as an adjustment). */
export async function adjustMemberSignatures(
  phone: string,
  amount: number,
  note: string,
): Promise<ActionResult<{ balance: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!phone || !Number.isFinite(amount) || amount === 0) return { ok: false, error: "invalid" };
  try {
    const res = await awardSignatures(phone, {
      direction: "adjustment",
      amount,
      sourceType: "admin",
      description: note?.trim() || "Manual adjustment",
      metadata: { admin: true, delta: amount },
    });
    return { ok: true, data: { balance: res.balance } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
