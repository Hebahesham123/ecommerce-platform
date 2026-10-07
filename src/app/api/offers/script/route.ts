import { offerScriptBody } from "@/lib/offer-script";

export const runtime = "nodejs";

/**
 * The popup program for the website at /store, as a file the store layout can
 * load. It is the same for everyone — which offer a shopper gets is asked for
 * once it runs — so it can be cached like any other script.
 */
export async function GET() {
  return new Response(offerScriptBody("/store"), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
