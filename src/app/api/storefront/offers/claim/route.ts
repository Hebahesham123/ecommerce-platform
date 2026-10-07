import { claimFromRequest } from "@/lib/offer-routes";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A code made for this shopper, in the app. */
export async function POST(request: Request) {
  const res = await claimFromRequest(request, "app");
  return res.ok ? ok({ code: res.code }) : fail(res.error, 400);
}
