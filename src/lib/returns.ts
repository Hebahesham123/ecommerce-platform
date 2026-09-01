/**
 * Returns & exchanges — the vocabulary both halves of the app share.
 *
 * The storefront uses it to decide what a shopper may still send back and what
 * that is worth; the dashboard uses it to label and filter the requests that
 * come out the other side. Keeping the window and the money in one file is
 * what stops the two sides from disagreeing about either.
 */

export type RequestKind = "return" | "exchange";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

/** Lines coming back from the shopper, and (exchanges only) going out to them. */
export type LineDirection = "return" | "replacement";

export type RequestLine = {
  id: string;
  direction: LineDirection;
  itemId: string | null;
  orderItemId: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
};

export type ReturnRequest = {
  id: string;
  reference: string;
  kind: RequestKind;
  status: RequestStatus;
  orderId: string;
  orderNumber: string;
  phone: string;
  customerName: string | null;
  reason: string | null;
  note: string | null;
  adminNote: string | null;
  returnedValue: number;
  replacementValue: number;
  /** replacement − returned: positive means the shopper pays us. */
  difference: number;
  refundAmount: number;
  extraAmount: number;
  orderCreatedAt: string;
  windowExpiresAt: string;
  inventoryAppliedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  lines: RequestLine[];
};

/** How long after an order is placed it can still be returned or exchanged. */
export const RETURN_WINDOW_DAYS = 14;

export function windowExpiryOf(orderCreatedAt: string | Date): Date {
  const start = new Date(orderCreatedAt);
  return new Date(start.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function msLeftInWindow(orderCreatedAt: string | Date, now: Date = new Date()): number {
  return windowExpiryOf(orderCreatedAt).getTime() - now.getTime();
}

export function isWithinWindow(orderCreatedAt: string | Date, now: Date = new Date()): boolean {
  return msLeftInWindow(orderCreatedAt, now) > 0;
}

/** "6d 3h left" / "2h 14m left" — the shopper-facing countdown. */
export function formatCountdown(ms: number, ar: boolean): string {
  if (ms <= 0) return ar ? "انتهت المهلة" : "Window closed";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((ms % 60000) / 1000);

  if (days > 0) {
    return ar ? `${days} يوم و ${hours} ساعة متبقية` : `${days}d ${hours}h left`;
  }
  if (hours > 0) {
    return ar ? `${hours} ساعة و ${minutes} دقيقة متبقية` : `${hours}h ${minutes}m left`;
  }
  return ar ? `${minutes} دقيقة و ${seconds} ثانية متبقية` : `${minutes}m ${seconds}s left`;
}

/**
 * What the request is worth, from the two sides of the swap.
 *
 * Returned goods are valued at what the shopper actually paid; replacements at
 * today's price. A positive difference is collected on delivery, a negative one
 * is refunded — never both.
 */
export function settle(returnedValue: number, replacementValue: number) {
  const difference = round2(replacementValue - returnedValue);
  return {
    difference,
    extraAmount: difference > 0 ? difference : 0,
    refundAmount: difference < 0 ? Math.abs(difference) : 0,
  };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const statusLabel: Record<RequestStatus, { ar: string; en: string }> = {
  pending: { ar: "قيد المراجعة", en: "Pending" },
  approved: { ar: "تمت الموافقة", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

export const kindLabel: Record<RequestKind, { ar: string; en: string }> = {
  return: { ar: "استرجاع", en: "Return" },
  exchange: { ar: "استبدال", en: "Exchange" },
};

/** Statuses an admin can still move a request to from where it is now. */
export function nextStatuses(current: RequestStatus): RequestStatus[] {
  switch (current) {
    // Completed is terminal: the stock has already moved and un-moving it
    // silently would put the shelf out of step with reality.
    case "completed":
      return [];
    case "rejected":
    case "cancelled":
      return ["pending"];
    default:
      return (["pending", "approved", "rejected", "completed", "cancelled"] as RequestStatus[])
        .filter((s) => s !== current);
  }
}

export const isTerminal = (s: RequestStatus) => s === "completed";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Database row (with its joined lines) → the shape both UIs render. */
export function mapRequestRow(r: Row): ReturnRequest {
  const lines = Array.isArray(r.return_request_items) ? (r.return_request_items as Row[]) : [];
  return {
    id: String(r.id),
    reference: String(r.reference),
    kind: (r.kind as RequestKind) ?? "return",
    status: (r.status as RequestStatus) ?? "pending",
    orderId: String(r.order_id),
    orderNumber: String(r.order_number),
    phone: String(r.phone),
    customerName: (r.customer_name as string) ?? null,
    reason: (r.reason as string) ?? null,
    note: (r.note as string) ?? null,
    adminNote: (r.admin_note as string) ?? null,
    returnedValue: num(r.returned_value),
    replacementValue: num(r.replacement_value),
    difference: num(r.difference),
    refundAmount: num(r.refund_amount),
    extraAmount: num(r.extra_amount),
    orderCreatedAt: String(r.order_created_at),
    windowExpiresAt: String(r.window_expires_at),
    inventoryAppliedAt: r.inventory_applied_at ? String(r.inventory_applied_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
    createdAt: String(r.created_at),
    lines: lines.map(
      (l): RequestLine => ({
        id: String(l.id),
        direction: l.direction === "replacement" ? "replacement" : "return",
        itemId: l.item_id ? String(l.item_id) : null,
        orderItemId: l.order_item_id ? String(l.order_item_id) : null,
        productName: String(l.product_name ?? ""),
        variantTitle: (l.variant_title as string) ?? null,
        sku: (l.sku as string) ?? null,
        imageUrl: (l.image_url as string) ?? null,
        price: num(l.price),
        quantity: num(l.quantity),
      }),
    ),
  };
}
