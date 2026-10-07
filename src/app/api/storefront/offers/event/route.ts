import { eventFromRequest } from "@/lib/offer-routes";
import { ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What a shopper did with a popup in the app. */
export async function POST(request: Request) {
  try {
    await eventFromRequest(request, "app");
  } catch {
    /* bookkeeping only */
  }
  return ok(null);
}
