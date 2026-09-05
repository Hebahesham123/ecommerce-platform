import { listReturnableOrders } from "@/app/store/returns/actions";
import { RETURN_WINDOW_DAYS } from "@/lib/returns";
import { fail, fromResult, ok, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the shopper can still send back.
 *
 * The window and the remaining quantities are computed on the server from the
 * order's own timestamp and any requests already open against it, so the app
 * never has to know the rule — and cannot get it wrong when the merchant
 * changes it.
 */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const res = await listReturnableOrders(viewer);
  if (!res.ok) return fromResult(res);
  return ok({ orders: res.data, windowDays: RETURN_WINDOW_DAYS });
}
