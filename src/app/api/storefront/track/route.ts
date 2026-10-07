import { handleBeacon } from "@/lib/shopper-beacon";
import { ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a shopper did in the app. The same record as the website's, with the
 * shopper known from her token rather than a cookie. Answers like every other
 * Storefront API route, so the app's request helper reads it without fuss.
 */
export async function POST(request: Request) {
  await handleBeacon(request, "app");
  return ok(null);
}
