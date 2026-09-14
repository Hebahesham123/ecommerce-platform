import { getHistory, LoyaltyUnavailable } from "@/lib/loyalty/service";
import { ok, fail, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in shopper's full signature history. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 100));
  try {
    return ok(await getHistory(viewer, limit));
  } catch (e) {
    if (e instanceof LoyaltyUnavailable) return fail(e.reason, 503);
    return fail((e as Error).message, 500);
  }
}
