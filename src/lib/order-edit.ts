/**
 * What an edited order comes to.
 *
 * The same arithmetic runs twice: here, to preview the new total while the
 * merchant is still typing, and again inside the `order_edit` database
 * function when they press Save. A preview that disagrees with what is saved
 * is worse than no preview at all, so this is the version under test
 * (`npm run check:order-edit`) and migration 0062 mirrors it.
 *
 * Two things it deliberately does not touch:
 *
 *   * shipping — the customer was quoted a delivery price, and an edit to the
 *     basket is not the moment to silently change it.
 *   * the fees already inside the total. A COD fee and tax are folded into
 *     `total` at checkout and have no columns of their own, so recomputing
 *     the total from lines alone would quietly drop them. `feesIn` recovers
 *     them as the part of the old total its own lines never explained, and
 *     they are carried across untouched.
 */

/** Money is stored as numeric(12,2); keep the preview on the same grid. */
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export type EditLineMoney = { price: number; quantity: number };

/**
 * How an order's discount came about, and what to call it.
 *
 * There is no column for this and none is needed: a coupon writes its code
 * onto the order, so an amount with no code is money somebody took off by
 * hand. Before this, both rendered as a bare "Discount" — a manual reduction
 * was indistinguishable from a coupon whose code had gone missing, which is
 * exactly the pair a merchant needs to tell apart when the total looks wrong.
 *
 * This is staff language. The order screen and the timeline use it; the
 * packing slip and the emailed invoice do not, because "manual" tells the
 * customer holding the parcel nothing except that the shop has internal
 * categories. Those name a coupon when there is one and otherwise just say
 * "Discount".
 */
export function discountLabel(
  order: { discountAmount: number; discountCode?: string | null },
  ar = false,
): string | null {
  if (!(order.discountAmount > 0)) return null;
  const code = (order.discountCode ?? "").trim();
  if (code) return code;
  return ar ? "يدوي" : "manual";
}

export type OrderMoney = {
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
};

/**
 * The part of a stored total that its lines, discount and shipping do not
 * account for — in practice the COD fee and tax. Never negative: a total that
 * is somehow *less* than its parts means something else is wrong, and
 * inventing a negative fee would spread it rather than contain it.
 */
export function feesIn(o: OrderMoney): number {
  return Math.max(0, round2(o.total - (o.subtotal - o.discount + o.shipping)));
}

export function editedTotals(input: {
  lines: EditLineMoney[];
  discount: number;
  shipping: number;
  fees: number;
}): { subtotal: number; discount: number; total: number } {
  const subtotal = round2(
    input.lines.reduce(
      (sum, l) => sum + Math.max(0, l.price || 0) * Math.max(0, Math.trunc(l.quantity || 0)),
      0,
    ),
  );
  // A discount can never exceed the goods: the shipping and the fees are not
  // the shop's to give away, and a negative subtotal is not a refund.
  const discount = Math.min(Math.max(0, input.discount || 0), subtotal);
  const total = Math.max(
    0,
    round2(subtotal - discount + Math.max(0, input.shipping || 0) + Math.max(0, input.fees || 0)),
  );
  return { subtotal, discount, total };
}
