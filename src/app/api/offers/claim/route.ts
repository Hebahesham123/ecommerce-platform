import { claimFromRequest } from "@/lib/offer-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A code made for this shopper, for a campaign that hands out one per person. */
export async function POST(request: Request) {
  const res = await claimFromRequest(request, "web");
  return Response.json(res, { status: res.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
