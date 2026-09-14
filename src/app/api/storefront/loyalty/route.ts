import { getLoyaltySummary, LoyaltyUnavailable } from "@/lib/loyalty/service";
import { ok, fail, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The full Beauty Bar Society dashboard for the signed-in shopper. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);
  try {
    return ok(await getLoyaltySummary(viewer));
  } catch (e) {
    if (e instanceof LoyaltyUnavailable) return fail(e.reason, 503);
    return fail((e as Error).message, 500);
  }
}
