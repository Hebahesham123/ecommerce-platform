"use server";

import { getSessionPhone } from "@/lib/store-session";
import {
  getLoyaltySummary,
  getHistory,
  redeemReward,
  openVault,
  LoyaltyUnavailable,
} from "@/lib/loyalty/service";
import type { LoyaltySummary, Transaction } from "@/lib/loyalty/types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Map a thrown error into the structured code the UI switches on. */
function toError(e: unknown): string {
  if (e instanceof LoyaltyUnavailable) return e.reason;
  return (e as Error)?.message || "error";
}

/** The full Society dashboard for the signed-in shopper. */
export async function getMyLoyalty(): Promise<ActionResult<LoyaltySummary>> {
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    return { ok: true, data: await getLoyaltySummary(phone) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Full signature history for the activity screen. */
export async function getMyLoyaltyHistory(limit = 100): Promise<ActionResult<Transaction[]>> {
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    return { ok: true, data: await getHistory(phone, limit) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Redeem a signature reward. Atomic + idempotent on the server. */
export async function redeemMyReward(
  rewardId: string,
): Promise<ActionResult<{ balance: number; code: string | null }>> {
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const res = await redeemReward(phone, rewardId);
    const code = (res.user_reward?.code as string) ?? null;
    return { ok: true, data: { balance: res.balance, code } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Open a ready vault. The server assigns the reward; the client is told what it got. */
export async function openMyVault(
  userVaultId: string,
): Promise<ActionResult<{ rewardTitle: string; code: string | null; type: string }>> {
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const res = await openVault(phone, userVaultId);
    const reward = (res.reward ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        rewardTitle: String(reward.title_en ?? "Your reward"),
        code: (res.user_reward?.code as string) ?? null,
        type: String(reward.type ?? "product"),
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
