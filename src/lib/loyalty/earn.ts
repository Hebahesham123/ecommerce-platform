import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { awardSignatures, addVaultProgress, touchStreak, activeMultiplier } from "./service";
import type { LevelKey } from "./types";

/**
 * Where loyalty meets the rest of the store.
 *
 * Every function here is:
 *  • idempotent — it carries a dedupe key, so the same order/review/bonus can be
 *    processed any number of times and only ever pays out once (enforced by a DB
 *    unique index, not just this code);
 *  • non-throwing at the call site — loyalty must never fail a checkout or a
 *    review, so callers await these but the errors are swallowed here.
 */

async function currentLevel(phone: string): Promise<LevelKey> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase.from("loyalty_profiles").select("current_level").eq("phone", phone).maybeSingle();
    return ((data?.current_level as LevelKey) ?? "discovery") as LevelKey;
  } catch {
    return "discovery";
  }
}

async function orderRule(): Promise<{ rate: number; multiplier: number; min: number; max: number | null; active: boolean } | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("loyalty_earning_rules")
      .select("rate_per_egp, multiplier, min_order_amount, max_reward, active")
      .eq("action_type", "order")
      .maybeSingle();
    if (!data || data.active === false) return null;
    return {
      rate: Number(data.rate_per_egp) || 0,
      multiplier: Number(data.multiplier) || 1,
      min: Number(data.min_order_amount) || 0,
      max: data.max_reward == null ? null : Number(data.max_reward),
      active: true,
    };
  } catch {
    return null;
  }
}

async function signatureVaultId(): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("loyalty_vaults")
      .select("id")
      .eq("vault_type", "signature")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

/** How many signatures an order is worth right now, after event multipliers. */
export async function calculateOrderSignatures(
  phone: string,
  total: number,
): Promise<{ signatures: number; eventMultiplier: number; eventId: string | null }> {
  const rule = await orderRule();
  if (!rule || total < rule.min) return { signatures: 0, eventMultiplier: 1, eventId: null };
  const level = await currentLevel(phone);
  const { multiplier: eventMultiplier, eventId } = await activeMultiplier(level);
  let signatures = Math.floor(total * rule.rate * rule.multiplier * eventMultiplier);
  if (rule.max != null) signatures = Math.min(signatures, rule.max);
  return { signatures: Math.max(0, signatures), eventMultiplier, eventId };
}

export type OrderEarnResult =
  | { ok: true; awarded: number; duplicate: boolean; levelChanged: boolean; level: LevelKey }
  | { ok: false; error: string };

/**
 * Award signatures for an order, advance the Signature Vault, and count the
 * month toward the streak. Safe to call from placement AND from a later
 * status change — the dedupe key (order:<number>) guarantees a single payout.
 */
export async function awardOrderSignatures(
  phone: string,
  order: { orderNumber: string; total: number },
): Promise<OrderEarnResult> {
  if (!isSupabaseConfigured() || !phone) return { ok: false, error: "not_configured" };
  try {
    const { signatures, eventMultiplier, eventId } = await calculateOrderSignatures(phone, order.total);
    if (signatures <= 0) return { ok: true, awarded: 0, duplicate: false, levelChanged: false, level: await currentLevel(phone) };

    const res = await awardSignatures(phone, {
      direction: "earn",
      amount: signatures,
      sourceType: "order",
      sourceId: order.orderNumber,
      description: `Order #${order.orderNumber}`,
      dedupeKey: `order:${order.orderNumber}`,
      metadata: { total: order.total, eventMultiplier, eventId },
    });

    // Only advance the vault / streak the first time this order pays out.
    if (res.applied) {
      const vaultId = await signatureVaultId();
      if (vaultId) await addVaultProgress(phone, vaultId, 1, `order:${order.orderNumber}`).catch(() => {});
      await touchStreak(phone, new Date().toISOString().slice(0, 7), "order").catch(() => {});
    }

    return {
      ok: true,
      awarded: res.applied ? signatures : 0,
      duplicate: res.duplicate,
      levelChanged: res.level_changed,
      level: res.level,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** One-time profile-completion bonus (dedupe on the phone). */
export async function awardProfileCompletion(phone: string): Promise<void> {
  if (!isSupabaseConfigured() || !phone) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("loyalty_earning_rules")
      .select("signatures, active")
      .eq("action_type", "profile_complete")
      .maybeSingle();
    const amount = Number(data?.signatures) || 0;
    if (!data || data.active === false || amount <= 0) return;
    await awardSignatures(phone, {
      direction: "bonus",
      amount,
      sourceType: "profile",
      sourceId: phone,
      description: "Profile completed",
      dedupeKey: "profile_complete",
    });
  } catch {
    /* never blocks the profile save */
  }
}

/** Award for a review once (dedupe on the review id). */
export async function awardReview(phone: string, reviewId: string): Promise<void> {
  if (!isSupabaseConfigured() || !phone || !reviewId) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("loyalty_earning_rules")
      .select("signatures, active")
      .eq("action_type", "review")
      .maybeSingle();
    const amount = Number(data?.signatures) || 0;
    if (!data || data.active === false || amount <= 0) return;
    await awardSignatures(phone, {
      direction: "earn",
      amount,
      sourceType: "review",
      sourceId: reviewId,
      description: "Product review",
      dedupeKey: `review:${reviewId}`,
    });
  } catch {
    /* never blocks review submission */
  }
}

/** Birthday bonus, once per calendar year. */
export async function awardBirthday(phone: string): Promise<void> {
  if (!isSupabaseConfigured() || !phone) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("loyalty_earning_rules")
      .select("signatures, active")
      .eq("action_type", "birthday")
      .maybeSingle();
    const amount = Number(data?.signatures) || 0;
    if (!data || data.active === false || amount <= 0) return;
    const year = new Date().getFullYear();
    await awardSignatures(phone, {
      direction: "bonus",
      amount,
      sourceType: "birthday",
      sourceId: String(year),
      description: `Birthday bonus ${year}`,
      dedupeKey: `birthday:${year}`,
    });
  } catch {
    /* best effort */
  }
}
