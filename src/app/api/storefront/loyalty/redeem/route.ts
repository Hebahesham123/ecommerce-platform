import { redeemReward } from "@/lib/loyalty/service";
import { ok, fail, viewerOf, bodyOf, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  insufficient_signatures: 409,
  level_too_low: 403,
  already_redeemed: 409,
  reward_unavailable: 409,
  invalid_reward: 404,
  migration_missing: 503,
};

/** Redeem a signature reward. Validation + spend are atomic in the database. */
export async function POST(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);
  const body = await bodyOf(request);
  const rewardId = str(body.rewardId);
  if (!rewardId) return fail("invalid_reward", 400);
  try {
    const res = await redeemReward(viewer, rewardId);
    return ok({ balance: res.balance, userReward: res.user_reward });
  } catch (e) {
    const msg = (e as Error).message;
    return fail(msg, STATUS[msg] ?? 400);
  }
}
