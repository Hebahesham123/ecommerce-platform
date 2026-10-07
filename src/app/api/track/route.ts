import { handleBeacon } from "@/lib/shopper-beacon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a shopper did on the website or the theme storefront: products and
 * collections viewed, searches, the basket as she left it.
 *
 * Always answers 204: tracking must never slow a shopper down or show her an
 * error.
 */
export async function POST(request: Request) {
  await handleBeacon(request, "web");
  return new Response(null, { status: 204 });
}
