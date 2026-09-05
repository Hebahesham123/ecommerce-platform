import { getOrderByNumber } from "@/app/store/actions";
import { fail, fromResult, ok, viewerOf } from "@/lib/api/http";
import { phoneVariants } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One order with its lines.
 *
 * Order numbers are short and sequential-looking, so this must not be a lookup
 * anyone can walk: the row is only returned when its phone matches the token's.
 * `phoneVariants` is used because orders written before numbers were
 * normalized are still the same shopper's.
 */
export async function GET(request: Request, ctx: { params: Promise<{ number: string }> }) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const { number } = await ctx.params;
  if (!number) return fail("missing_order_number");

  const res = await getOrderByNumber(number);
  if (!res.ok) return fromResult(res);

  if (!phoneVariants(viewer).includes(String(res.data.phone ?? ""))) {
    return fail("not_your_order", 403);
  }
  return ok(res.data);
}
