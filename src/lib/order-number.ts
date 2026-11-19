/**
 * How an order number is written out.
 *
 * `order_prefix` and `order_suffix` on Settings → General are a label, not a
 * change to the number itself. The number is handed out by the database
 * inside the transaction that reserves the stock, and it is the key in
 * `/orders/1234`, in `/store/order/1234` and in every courier and accounting
 * lookup — so prefixing it at the source would break those the moment the
 * merchant typed into the box.
 *
 * With nothing set this returns "#1234", exactly what the screens printed
 * before, so an unset prefix changes nothing anywhere.
 */

export function orderNumberLabel(
  orderNumber: unknown,
  general: Record<string, unknown> | null | undefined,
): string {
  const n = String(orderNumber ?? "").trim();
  if (!n) return "";
  const g = general ?? {};
  const prefix = String(g.order_prefix ?? "").trim();
  const suffix = String(g.order_suffix ?? "").trim();
  return (prefix || "#") + n + suffix;
}
