/**
 * The orders list's discount, date and tag filters.
 *
 * Pure, and out of the component, because the interesting part is the edges:
 * "yesterday" is a closed window and not simply "before today", "this month"
 * starts on the 1st and not 30 days ago, and every comparison is made against
 * the order's real timestamp rather than its day string — a day cannot tell
 * two orders an hour apart from each other, which is the same reason the list
 * shows the clock time.
 *
 * `now` is a parameter so the boundaries can be tested rather than hoped for.
 */

export type DateKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month";

/** The window a preset covers: `from` inclusive, `to` exclusive. */
export function dateWindow(key: DateKey, now: Date = new Date()): { from: number; to: number } | null {
  if (key === "all") return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  switch (key) {
    case "today":     return { from: startOfToday, to: Infinity };
    // Closed at both ends: yesterday is a day, not "everything before today".
    case "yesterday": return { from: startOfToday - day, to: startOfToday };
    // Inclusive of today, so "last 7 days" is 7 days of orders, not 8.
    case "7d":        return { from: startOfToday - 6 * day, to: Infinity };
    case "30d":       return { from: startOfToday - 29 * day, to: Infinity };
    case "month":     return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Infinity };
  }
}

export function inDateWindow(createdAt: string, key: DateKey, now: Date = new Date()): boolean {
  const win = dateWindow(key, now);
  if (!win) return true;
  const at = new Date(createdAt).getTime();
  // An unparseable timestamp is not evidence that an order belongs in the
  // window, so it drops out of a filtered view rather than floating into it.
  if (Number.isNaN(at)) return false;
  return at >= win.from && at < win.to;
}

/**
 * `all` keeps everything, `any` keeps discounted orders, `none` keeps the
 * rest, and anything else is a discount code to match exactly.
 *
 * An order counts as discounted if money came off it OR it carries a code —
 * a manual discount typed into the order editor has an amount and no code,
 * and a code that resolved to zero is still a code that was used.
 */
export function matchesDiscount(
  filter: string,
  order: { discountAmount: number; discountCode: string | null },
): boolean {
  const discounted = order.discountAmount > 0 || Boolean(order.discountCode);
  if (filter === "all") return true;
  if (filter === "any") return discounted;
  if (filter === "none") return !discounted;
  return order.discountCode === filter;
}
