import { eventFromRequest } from "@/lib/offer-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What a shopper did with a popup. Always 204: it must never cost her anything. */
export async function POST(request: Request) {
  try {
    await eventFromRequest(request, "web");
  } catch {
    /* bookkeeping only */
  }
  return new Response(null, { status: 204 });
}
