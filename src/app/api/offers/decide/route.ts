import { decideFromRequest } from "@/lib/offer-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which popup, if any, this shopper should be armed with on this page. */
export async function POST(request: Request) {
  const offer = await decideFromRequest(request, "web");
  return Response.json({ offer }, { headers: { "Cache-Control": "no-store" } });
}
