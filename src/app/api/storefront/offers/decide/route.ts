import { decideFromRequest } from "@/lib/offer-routes";
import { ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The app's question: which popup, if any, for this shopper on this screen. */
export async function POST(request: Request) {
  return ok({ offer: await decideFromRequest(request, "app") });
}
