import { openVault } from "@/lib/loyalty/service";
import { ok, fail, viewerOf, bodyOf, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  vault_not_ready: 409,
  vault_already_opened: 409,
  not_your_vault: 403,
  vault_empty: 409,
  migration_missing: 503,
};

/** Open a ready vault. The server assigns and records the reward exactly once. */
export async function POST(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);
  const body = await bodyOf(request);
  const userVaultId = str(body.userVaultId);
  if (!userVaultId) return fail("not_your_vault", 400);
  try {
    const res = await openVault(viewer, userVaultId);
    return ok({ reward: res.reward, userReward: res.user_reward });
  } catch (e) {
    const msg = (e as Error).message;
    return fail(msg, STATUS[msg] ?? 400);
  }
}
