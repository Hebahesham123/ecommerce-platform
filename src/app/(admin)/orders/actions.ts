"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  adminCreateReturn,
  returnableLinesForOrder,
  listReturnsForOrder,
  type AdminReturnPayload,
  type ReturnableLine,
} from "@/lib/returns-service";
import type { ReturnRequest } from "@/lib/returns";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return err.code === "42P01" || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

export type OrderLine = {
  id: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  fulfilledQuantity: number;
};
export type OrderPaymentRow = {
  id: string;
  kind: "payment" | "refund";
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
};
export type OrderFulfillmentRow = {
  id: string;
  tracking: string | null;
  carrier: string | null;
  note: string | null;
  createdAt: string;
  items: { productName: string; quantity: number }[];
};
export type OrderDetail = {
  orderNumber: string;
  customerName: string;
  phone: string;
  governorate: string | null;
  city: string | null;
  address: string | null;
  note: string | null;
  /** What the shopper picked on the thank-you page, if anything. */
  preferredDeliveryDate: string | null;
  preferredDeliverySlot: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  lifecycle: string;
  paymentMethod: string;
  createdAt: string;
  items: OrderLine[];
  payments: OrderPaymentRow[];
  fulfillments: OrderFulfillmentRow[];
};

/** The full Shopify-style order view: money ledger + per-item fulfillment. */
export async function getOrderDetail(orderNumber: string): Promise<ActionResult<OrderDetail>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("order_number", orderNumber)
      .single();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (!order) return { ok: false, error: "order_not_found" };

    const orderId = s(order.id);
    const [{ data: payments, error: pErr }, { data: fulfillments }] = await Promise.all([
      supabase.from("order_payments").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("order_fulfillments").select("*, order_fulfillment_items(*)").eq("order_id", orderId).order("created_at"),
    ]);
    // A missing payments table means the migration hasn't been applied.
    if (pErr && missing(pErr)) return { ok: false, error: "migration_missing" };

    const items = (Array.isArray(order.store_order_items) ? order.store_order_items : []) as Row[];
    const total = n(order.total);
    const amountPaid = n(order.amount_paid);

    return {
      ok: true,
      data: {
        orderNumber: s(order.order_number),
        customerName: s(order.customer_name),
        phone: s(order.phone),
        governorate: sn(order.governorate),
        city: sn(order.city),
        address: sn(order.address),
        note: sn(order.note),
        preferredDeliveryDate: sn(order.preferred_delivery_date),
        preferredDeliverySlot: sn(order.preferred_delivery_slot),
        subtotal: n(order.subtotal),
        shipping: n(order.shipping),
        total,
        amountPaid,
        balance: Math.max(0, total - amountPaid),
        paymentStatus: s(order.payment_status) || "pending",
        fulfillmentStatus: s(order.fulfillment_status) || "unfulfilled",
        lifecycle: s(order.lifecycle) || "placed",
        paymentMethod: s(order.payment_method) || "cod",
        createdAt: s(order.created_at),
        items: items.map((li): OrderLine => ({
          id: s(li.id),
          productName: s(li.product_name),
          variantTitle: sn(li.variant_title),
          sku: sn(li.sku),
          imageUrl: sn(li.image_url),
          price: n(li.price),
          quantity: n(li.quantity),
          fulfilledQuantity: n(li.fulfilled_quantity),
        })),
        payments: ((payments ?? []) as Row[]).map((p): OrderPaymentRow => ({
          id: s(p.id),
          kind: (s(p.kind) as "payment" | "refund") || "payment",
          amount: n(p.amount),
          method: s(p.method),
          reference: sn(p.reference),
          note: sn(p.note),
          createdAt: s(p.created_at),
        })),
        fulfillments: ((fulfillments ?? []) as Row[]).map((f): OrderFulfillmentRow => ({
          id: s(f.id),
          tracking: sn(f.tracking),
          carrier: sn(f.carrier),
          note: sn(f.note),
          createdAt: s(f.created_at),
          items: (Array.isArray(f.order_fulfillment_items) ? f.order_fulfillment_items : []).map((fi: Row) => ({
            productName: s(fi.product_name),
            quantity: n(fi.quantity),
          })),
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type PaymentResult = { amountPaid: number; balance: number; paymentStatus: string };

function mapRpcError(message: string): string {
  const m = (message || "").toLowerCase();
  for (const code of ["order_not_found", "invalid_amount", "invalid_kind", "refund_exceeds_paid", "nothing_to_fulfill"]) {
    if (m.includes(code)) return code;
  }
  if (missing({ message })) return "migration_missing";
  return message;
}

/** Record a payment against the order (partial allowed → partially_paid). */
export async function collectPayment(
  orderNumber: string,
  input: { amount: number; method: string; reference?: string; note?: string },
): Promise<ActionResult<PaymentResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc("order_record_payment", {
      p_order_number: orderNumber,
      p_kind: "payment",
      p_amount: input.amount,
      p_method: input.method || "cash",
      p_reference: input.reference || null,
      p_note: input.note || null,
    });
    if (error) return { ok: false, error: mapRpcError(error.message) };
    return { ok: true, data: { amountPaid: n((data as Row).amount_paid), balance: n((data as Row).balance), paymentStatus: s((data as Row).payment_status) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Refund part or all of what's been paid. */
export async function refundPayment(
  orderNumber: string,
  input: { amount: number; method: string; note?: string },
): Promise<ActionResult<PaymentResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc("order_record_payment", {
      p_order_number: orderNumber,
      p_kind: "refund",
      p_amount: input.amount,
      p_method: input.method || "cash",
      p_reference: null,
      p_note: input.note || null,
    });
    if (error) return { ok: false, error: mapRpcError(error.message) };
    return { ok: true, data: { amountPaid: n((data as Row).amount_paid), balance: n((data as Row).balance), paymentStatus: s((data as Row).payment_status) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Fulfill line items (partial supported). Omit `items` to fulfill everything left. */
export async function fulfillOrder(
  orderNumber: string,
  input?: { items?: { orderItemId: string; quantity: number }[]; tracking?: string; carrier?: string; note?: string },
): Promise<ActionResult<{ fulfillmentStatus: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const items = input?.items?.length
      ? input.items.filter((i) => i.quantity > 0).map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity }))
      : null;
    const { data, error } = await supabase.rpc("order_fulfill", {
      p_order_number: orderNumber,
      p_items: items,
      p_tracking: input?.tracking || null,
      p_carrier: input?.carrier || null,
      p_note: input?.note || null,
    });
    if (error) return { ok: false, error: mapRpcError(error.message) };
    return { ok: true, data: { fulfillmentStatus: s((data as Row).fulfillment_status) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Undo a fulfillment (returns its units to unfulfilled). */
export async function undoFulfillment(fulfillmentId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.rpc("order_unfulfill", { p_fulfillment_id: fulfillmentId });
    if (error) return { ok: false, error: mapRpcError(error.message) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Returns & exchanges, from inside the order -----------------------------

/** Line items still returnable on this order (nothing already sent back). */
export async function getReturnableLines(orderNumber: string): Promise<ActionResult<ReturnableLine[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (!order) return { ok: false, error: "order_not_found" };
    return returnableLinesForOrder(String(order.id));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** All returns / exchanges opened against this order. */
export async function getOrderReturns(orderNumber: string): Promise<ActionResult<ReturnRequest[]>> {
  return listReturnsForOrder(orderNumber);
}

export type OrderReturnSummary = {
  reference: string;
  kind: "return" | "exchange";
  returnCount: number;
  refunded: number;
  extraDue: number;
};

/**
 * Open a return or exchange from the order screen and apply it end to end:
 * create the request, complete it (returned goods restocked, replacements
 * pulled from stock under the same locks checkout uses), then refund the paid
 * portion. A COD order that was never paid restocks with nothing to give back.
 */
export async function createOrderReturn(
  orderNumber: string,
  payload: AdminReturnPayload,
): Promise<ActionResult<OrderReturnSummary>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const created = await adminCreateReturn(orderNumber, payload);
    if (!created.ok) return { ok: false, error: created.error };

    const supabase = getServerSupabase();
    // Move stock. If a replacement went out of stock in the meantime this
    // rejects and the request stays open rather than half-applying.
    const { error: completeErr } = await supabase.rpc("complete_return_request", { p_request: created.data.id });
    if (completeErr) return { ok: false, error: mapRpcError(completeErr.message) };

    // Refund the money that was actually collected, capped so it can never
    // exceed what was paid (a partly-paid or COD order refunds only that much).
    let refunded = 0;
    if (created.data.refundAmount > 0) {
      const { data: order } = await supabase
        .from("store_orders")
        .select("amount_paid,payment_method")
        .eq("order_number", orderNumber)
        .maybeSingle();
      const paid = n(order?.amount_paid);
      const refundable = Math.min(created.data.refundAmount, paid);
      if (refundable > 0) {
        const { error: refErr } = await supabase.rpc("order_record_payment", {
          p_order_number: orderNumber,
          p_kind: "refund",
          p_amount: refundable,
          p_method: s(order?.payment_method) || "cash",
          p_reference: created.data.reference,
          p_note: `${created.data.kind === "exchange" ? "Exchange" : "Return"} ${created.data.reference}`,
        });
        if (!refErr) refunded = refundable;
      }
    }

    return {
      ok: true,
      data: {
        reference: created.data.reference,
        kind: created.data.kind,
        returnCount: created.data.returnCount,
        refunded,
        extraDue: created.data.extraAmount,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
