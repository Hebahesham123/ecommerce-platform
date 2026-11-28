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
import { sendOrderInvoiceEmail } from "@/lib/order-invoice";
import { isMailerReady } from "@/lib/mailer";
import { phoneVariants } from "@/lib/phone";
import { queuePendingEntry } from "@/lib/accounting/post-order";
import { isEditableEntry } from "@/lib/order-timeline";
import { writeAudit, currentActor } from "@/lib/audit";
import { maskedChange } from "@/lib/mask";

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
  customerEmail: string | null;
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
  /** null | 'in_progress' | 'on_hold' — the fulfillment dropdown's soft state. */
  fulfillmentHold: string | null;
  lifecycle: string;
  paymentMethod: string;
  discountCode: string | null;
  discountAmount: number;
  tags: string[];
  adminNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  archivedAt: string | null;
  invoiceSentAt: string | null;
  channel: string;
  createdAt: string;
  items: OrderLine[];
  payments: OrderPaymentRow[];
  fulfillments: OrderFulfillmentRow[];
};

function toTags(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

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
    const [{ data: payments, error: pErr }, { data: fulfillments }, { data: customer }] = await Promise.all([
      supabase.from("order_payments").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("order_fulfillments").select("*, order_fulfillment_items(*)").eq("order_id", orderId).order("created_at"),
      supabase.from("store_customers").select("email").in("phone", phoneVariants(s(order.phone))).maybeSingle(),
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
        customerEmail: sn(customer?.email),
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
        fulfillmentHold: sn(order.fulfillment_hold),
        lifecycle: s(order.lifecycle) || "placed",
        paymentMethod: s(order.payment_method) || "cod",
        discountCode: sn(order.discount_code),
        discountAmount: n(order.discount_amount),
        tags: toTags(order.tags),
        adminNote: sn(order.admin_note),
        cancelledAt: sn(order.cancelled_at),
        cancelReason: sn(order.cancel_reason),
        archivedAt: sn(order.archived_at),
        invoiceSentAt: sn(order.invoice_sent_at),
        channel: s(order.channel) || "web",
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
  for (const code of [
    "order_not_found", "invalid_amount", "invalid_kind", "refund_exceeds_paid", "nothing_to_fulfill",
    "line_fulfilled", "line_not_found", "no_items",
  ]) {
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
    // Every payment is cash in — queue it for the accountant to confirm into the
    // books (tagged by method). Courier COD queues on confirm instead.
    await queuePendingEntry({ source: "payment", method: input.method || "cash", amount: input.amount, orderNumber, note: input.note || "تحصيل طلب" });
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

// ---- Order lifecycle, tags, notes, timeline ---------------------------------

type OrderRow = { id: string; order_number: string } & Row;

async function loadOrder(
  supabase: ReturnType<typeof getServerSupabase>,
  orderNumber: string,
  cols = "*",
): Promise<{ ok: true; order: OrderRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("store_orders")
    .select(cols)
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
  if (!data) return { ok: false, error: "order_not_found" };
  return { ok: true, order: data as unknown as OrderRow };
}

async function logEvent(
  supabase: ReturnType<typeof getServerSupabase>,
  orderId: string,
  ev: { actor?: "system" | "staff"; type: string; message: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabase.from("order_events").insert({
      order_id: orderId,
      actor: ev.actor ?? "staff",
      type: ev.type,
      message: ev.message,
      meta: ev.meta ?? {},
    });
  } catch {
    /* the timeline is a log, never the thing that fails the action */
  }
}

export type TimelineEntry = {
  id: string;
  type: string;
  actor: "system" | "staff";
  message: string;
  createdAt: string;
  amount?: number | null;
  /** The text was corrected after the entry was written. */
  edited?: boolean;
  /**
   * For a note change: the wording before and after it. The order keeps only
   * the current note, so this is the only record of what a note used to say —
   * and the only way to read one that was deleted.
   */
  note?: { before: string; after: string };
  /** For an order edit: one line per thing that changed. */
  changes?: string[];
};

/**
 * The order's timeline, newest first. Built by merging the money ledger and the
 * fulfillment log (so even orders from before this feature show their history)
 * with the explicit events — comments, invoices, cancels, holds.
 */
export async function getOrderTimeline(orderNumber: string): Promise<ActionResult<TimelineEntry[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id,order_number,customer_name,channel,payment_method,created_at");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const order = loaded.order;
    const orderId = s(order.id);

    const [{ data: payments }, { data: fulfillments }, { data: events }] = await Promise.all([
      supabase.from("order_payments").select("*").eq("order_id", orderId),
      supabase.from("order_fulfillments").select("*, order_fulfillment_items(*)").eq("order_id", orderId),
      supabase.from("order_events").select("*").eq("order_id", orderId),
    ]);

    const entries: TimelineEntry[] = [];

    entries.push({
      id: `placed-${orderId}`,
      type: "placed",
      actor: "system",
      message: `${s(order.customer_name) || "Customer"} placed this order`,
      createdAt: s(order.created_at),
    });

    for (const p of (payments ?? []) as Row[]) {
      const kind = s(p.kind) || "payment";
      entries.push({
        id: `pay-${s(p.id)}`,
        type: kind === "refund" ? "refund" : "payment",
        actor: "system",
        message: kind === "refund" ? "A refund was issued" : "A payment was recorded",
        amount: n(p.amount),
        createdAt: s(p.created_at),
      });
    }

    for (const f of (fulfillments ?? []) as Row[]) {
      const items = Array.isArray(f.order_fulfillment_items) ? (f.order_fulfillment_items as Row[]) : [];
      const qty = items.reduce((sum, i) => sum + n(i.quantity), 0);
      entries.push({
        id: `ful-${s(f.id)}`,
        type: "fulfilled",
        actor: "staff",
        message: `${qty} item${qty === 1 ? "" : "s"} fulfilled${f.tracking ? ` · ${s(f.tracking)}` : ""}`,
        createdAt: s(f.created_at),
      });
    }

    for (const e of (events ?? []) as Row[]) {
      const meta = (e.meta as Row | null) ?? {};
      const type = s(e.type);
      entries.push({
        id: s(e.id),
        type,
        actor: (s(e.actor) as "system" | "staff") || "system",
        message: s(e.message),
        createdAt: s(e.created_at),
        edited: Boolean(meta.edited_at),
        note:
          type === "note_edited"
            ? { before: s(meta.note_before), after: s(meta.note_after) }
            : undefined,
        changes: Array.isArray(meta.changes) ? (meta.changes as unknown[]).map(s) : undefined,
      });
    }

    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: entries };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Post a staff comment onto the timeline. */
export async function addOrderComment(orderNumber: string, text: string): Promise<ActionResult<TimelineEntry>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const body = text.trim();
  if (!body) return { ok: false, error: "empty_comment" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { data, error } = await supabase
      .from("order_events")
      .insert({ order_id: s(loaded.order.id), actor: "staff", type: "comment", message: body })
      .select("*")
      .single();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return {
      ok: true,
      data: { id: s(data.id), type: "comment", actor: "staff", message: body, createdAt: s(data.created_at) },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Correct the text of a timeline entry.
 *
 * This is the only way a timeline line ever changes: there is no delete, so a
 * correction is the whole of what anyone can do to the record.
 *
 * The id arrives from the browser, so it is matched against the order in the
 * URL as well as against itself: a staff member looking at one order cannot
 * reach another order's log by changing the id. The original wording is kept
 * nowhere, but `meta.edited_at` records that the line was touched, which the
 * screen shows — a log that can be rewritten invisibly is worse than one that
 * cannot be rewritten at all. An empty edit is refused, so a line cannot be
 * blanked as a way around the missing delete.
 */
export async function updateOrderEvent(
  orderNumber: string,
  eventId: string,
  text: string,
): Promise<ActionResult<TimelineEntry>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const body = text.trim();
  if (!body) return { ok: false, error: "empty_comment" };
  if (!isEditableEntry(eventId)) return { ok: false, error: "entry_not_editable" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const orderId = s(loaded.order.id);

    const { data: found, error: readErr } = await supabase
      .from("order_events")
      .select("id,type,actor,meta,created_at")
      .eq("id", eventId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (readErr) return { ok: false, error: missing(readErr) ? "migration_missing" : readErr.message };
    if (!found) return { ok: false, error: "entry_not_found" };
    const row = found as Row;

    const meta = { ...((row.meta as Row | null) ?? {}), edited_at: new Date().toISOString() };
    const { error } = await supabase
      .from("order_events")
      .update({ message: body, meta })
      .eq("id", eventId)
      .eq("order_id", orderId);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };

    return {
      ok: true,
      data: {
        id: s(row.id),
        type: s(row.type),
        actor: (s(row.actor) as "system" | "staff") || "system",
        message: body,
        createdAt: s(row.created_at),
        edited: true,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/*
 * There is deliberately no action that deletes a timeline entry.
 *
 * The timeline is the order's record: what was promised, when it shipped, what
 * a note used to say. Nothing removes a line from it, by design — a log that
 * can be emptied is not a log. Correcting the wording is enough, and an edit
 * says so on the line itself.
 *
 * This is enforced by the action not existing rather than by hiding a button.
 * Server actions are POST endpoints whose ids ship in the public page bundle,
 * so while this admin has no login, any action that can delete is one that
 * anyone who finds the page can call.
 */

export type OrderListMarks = {
  /** How many staff comments the order carries. */
  comments: number;
  /** The admin note, or "" when there is none. Shown as the icon's tooltip. */
  note: string;
};

/**
 * The two markers the list draws beside an order number: a note and a count of
 * timeline comments.
 *
 * Only `comment` rows are counted, not the whole log. Nearly every order has
 * system events — shipped, cancelled, invoice sent — so counting those would
 * put the bubble on every row and tell the merchant nothing. A comment is
 * something a person chose to write, which is the thing worth flagging.
 *
 * Two queries for a whole page rather than two per row, and the note rides
 * along in the lookup the counts already need. The event cap is generous for a
 * 30-row page; an order with a thousand comments would crowd the others out of
 * the count, which costs an icon, not correctness.
 */
export async function getOrderListMarks(
  orderNumbers: string[],
): Promise<ActionResult<Record<string, OrderListMarks>>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const wanted = Array.from(new Set(orderNumbers.map(s).filter(Boolean))).slice(0, 200);
  if (!wanted.length) return { ok: true, data: {} };
  try {
    const supabase = getServerSupabase();
    const { data: orders, error: oErr } = await supabase
      .from("store_orders")
      .select("id,order_number,admin_note")
      .in("order_number", wanted);
    if (oErr) return { ok: false, error: missing(oErr) ? "migration_missing" : oErr.message };

    const numberById = new Map<string, string>();
    const out: Record<string, OrderListMarks> = {};
    for (const o of (orders ?? []) as Row[]) {
      const orderNo = s(o.order_number);
      numberById.set(s(o.id), orderNo);
      out[orderNo] = { comments: 0, note: s(o.admin_note).trim().slice(0, 300) };
    }
    if (!numberById.size) return { ok: true, data: {} };

    const { data: events, error: eErr } = await supabase
      .from("order_events")
      .select("order_id")
      .eq("type", "comment")
      .in("order_id", [...numberById.keys()])
      .limit(2000);
    if (eErr) return { ok: false, error: missing(eErr) ? "migration_missing" : eErr.message };

    for (const e of (events ?? []) as Row[]) {
      const orderNo = numberById.get(s(e.order_id));
      if (orderNo && out[orderNo]) out[orderNo].comments += 1;
    }
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type OrderCustomerEdit = {
  customerName: string;
  email: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
};

/**
 * Correct who the order is for and where it is going.
 *
 * Name, phone and the address belong to the order itself — a customer who
 * moved house should not have last month's parcels retrospectively sent
 * somewhere new, so these are edited per order and nothing else is touched.
 * The email is the exception: it lives on the customer profile, keyed by
 * phone, and is where invoices are sent, so it is written there.
 *
 * Shipping is NOT re-quoted when the governorate changes, for the same reason
 * the order editor leaves it alone: the customer was quoted a delivery price
 * and a correction to their address is not the moment to change what they owe.
 * Charge or refund the difference deliberately if a new zone really applies.
 */
export async function updateOrderCustomer(
  orderNumber: string,
  input: OrderCustomerEdit,
): Promise<ActionResult<{ changes: string[]; entry: TimelineEntry | null }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };

  const next = {
    customer_name: s(input.customerName).trim().slice(0, 200),
    phone: s(input.phone).trim().slice(0, 40),
    governorate: s(input.governorate).trim().slice(0, 120),
    city: s(input.city).trim().slice(0, 120),
    address: s(input.address).trim().slice(0, 500),
  };
  const email = s(input.email).trim().slice(0, 200);
  if (!next.customer_name) return { ok: false, error: "name_required" };
  if (!next.phone) return { ok: false, error: "phone_required" };

  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(
      supabase,
      orderNumber,
      "id,customer_name,phone,governorate,city,address",
    );
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const before = loaded.order;

    const { data: profile } = await supabase
      .from("store_customers")
      .select("phone,email")
      .in("phone", phoneVariants(s(before.phone)))
      .maybeSingle();
    const oldEmail = s((profile as Row | null)?.email).trim();

    const changes: string[] = [];
    const note = (label: string, was: string, now: string) => {
      if (was === now) return;
      changes.push(`${label}: ${was || "—"} → ${now || "—"}`);
    };
    note("Name", s(before.customer_name).trim(), next.customer_name);
    note("Phone", s(before.phone).trim(), next.phone);
    note("Email", oldEmail, email);
    note("Governorate", s(before.governorate).trim(), next.governorate);
    note("City", s(before.city).trim(), next.city);
    note("Address", s(before.address).trim(), next.address);
    if (!changes.length) return { ok: true, data: { changes: [], entry: null } };

    const { error } = await supabase
      .from("store_orders")
      .update({
        customer_name: next.customer_name,
        phone: next.phone,
        governorate: next.governorate || null,
        city: next.city || null,
        address: next.address || null,
      })
      .eq("order_number", orderNumber);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };

    // The profile is keyed by phone, so a changed phone writes the email
    // against the new one — that is the record this order now points at.
    if (email !== oldEmail) {
      try {
        await supabase
          .from("store_customers")
          .upsert({ phone: next.phone, email: email || null }, { onConflict: "phone" });
      } catch {
        /* the order is saved either way; the profile is a convenience */
      }
    }

    let entry: TimelineEntry | null = null;
    const message = "Customer details edited";
    try {
      const { data: ev } = await supabase
        .from("order_events")
        .insert({
          order_id: s(before.id),
          actor: "staff",
          type: "customer_edited",
          message,
          meta: { changes },
        })
        .select("id,created_at")
        .single();
      if (ev) {
        entry = {
          id: s(ev.id),
          type: "customer_edited",
          actor: "staff",
          message,
          createdAt: s(ev.created_at),
          changes,
        };
      }
    } catch {
      /* the timeline is a log; it never fails the save */
    }

    // Masked, not plain. admin_audit cannot be deleted from, and a customer
    // has the right to have their data erased (law 151/2020), so this records
    // which fields moved and enough to recognise the values — never the
    // values. The readable before/after stays on the order's timeline, which
    // is an ordinary table and can be erased on request.
    const masked = [
      maskedChange("name", s(before.customer_name), next.customer_name),
      maskedChange("phone", s(before.phone), next.phone),
      maskedChange("email", oldEmail, email),
      maskedChange("governorate", s(before.governorate), next.governorate),
      maskedChange("city", s(before.city), next.city),
      maskedChange("address", s(before.address), next.address),
    ].filter(Boolean);

    await writeAudit({
      action: "order.customer_edit",
      subject: orderNumber,
      summary: masked.map((m) => m!.field).join(", ") + " changed",
      before: Object.fromEntries(masked.map((m) => [m!.field, m!.before])),
      after: Object.fromEntries(masked.map((m) => [m!.field, m!.after])),
      meta: { fields: masked.map((m) => m!.field) },
    });

    return { ok: true, data: { changes, entry } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type OrderEditLine = {
  /** An existing line being kept. Omit it for a line being added. */
  id?: string;
  /** The inventory item, for a line being added. */
  itemId?: string;
  productName?: string;
  price: number;
  quantity: number;
};

export type OrderEditResult = {
  changes: string[];
  subtotal: number;
  discount: number;
  total: number;
  /** The timeline line this wrote, so the screen can show it without reloading. */
  entry: TimelineEntry | null;
};

/**
 * Edit a placed order: quantities, prices, which products are on it, and the
 * discount.
 *
 * The work happens in the `order_edit` function because an edit moves stock
 * and rewrites the order's money together — half of that landing would leave
 * stock returned for a line still on the order. Lines absent from `lines` are
 * removed; lines with an id are updated; lines without one are added.
 *
 * Shipping is left alone and the fees already inside the total are carried
 * across; see the migration for why.
 */
export async function editOrder(
  orderNumber: string,
  input: { lines: OrderEditLine[]; discount?: number; reason?: string },
): Promise<ActionResult<OrderEditResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const before = loaded.order;

    const lines = (input.lines ?? [])
      .map((l) => ({
        id: l.id || null,
        item_id: l.itemId || null,
        product_name: (l.productName || "").slice(0, 200) || null,
        price: Math.max(0, Number(l.price) || 0),
        quantity: Math.max(0, Math.trunc(Number(l.quantity) || 0)),
      }))
      // A new line of nothing is not a line; an existing one at zero is a removal.
      .filter((l) => l.id || l.quantity > 0);
    if (!lines.length) return { ok: false, error: "no_items" };

    // The audit row is written inside order_edit, in the same transaction as
    // the money (migration 0066). Written out here instead, a failed audit
    // would report an error for a change that had already been saved — and
    // the merchant would press again and edit the order twice.
    const { data, error } = await supabase.rpc("order_edit", {
      p_order_number: orderNumber,
      p_lines: lines,
      p_discount: input.discount == null ? null : Math.max(0, Number(input.discount) || 0),
      p_actor: await currentActor(),
    });
    if (error) {
      // Name the migration this feature needs, rather than the generic
      // "run migration 0028" every other action points at.
      const code = mapRpcError(error.message);
      return { ok: false, error: code === "migration_missing" ? "edit_migration_missing" : code };
    }

    const res = (data ?? {}) as Row;
    const changes = Array.isArray(res.changes) ? (res.changes as unknown[]).map(s) : [];
    const reason = (input.reason || "").trim().slice(0, 200);

    let entry: TimelineEntry | null = null;
    if (changes.length) {
      const message = reason ? `Order edited · ${reason}` : "Order edited";
      try {
        // What changed is kept on the event: the order now holds only its new
        // shape, so this is the only record of what it looked like before.
        const { data: ev } = await supabase
          .from("order_events")
          .insert({
            order_id: s(before.id),
            actor: "staff",
            type: "order_edited",
            message,
            meta: { changes, reason, subtotal: n(res.subtotal), discount: n(res.discount), total: n(res.total) },
          })
          .select("id,created_at")
          .single();
        if (ev) {
          entry = {
            id: s(ev.id),
            type: "order_edited",
            actor: "staff",
            message,
            createdAt: s(ev.created_at),
            changes,
          };
        }
      } catch {
        /* the timeline is a log; it never fails the edit itself */
      }
    }

    return {
      ok: true,
      data: { changes, subtotal: n(res.subtotal), discount: n(res.discount), total: n(res.total), entry },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Replace the order's tags. */
export async function updateOrderTags(orderNumber: string, tags: string[]): Promise<ActionResult<{ tags: string[] }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 40);
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("store_orders").update({ tags: clean }).eq("order_number", orderNumber);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: { tags: clean } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Save the staff-facing note. */
/**
 * Save the order's staff note, and record the change on the timeline.
 *
 * Returns the timeline entry it wrote so the screen can show it without
 * reloading, or null when the note did not actually change (saving the same
 * text twice should not fill the log with noise).
 */
export async function saveAdminNote(
  orderNumber: string,
  note: string,
): Promise<ActionResult<TimelineEntry | null>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const after = note.trim();
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id,admin_note");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const before = s(loaded.order.admin_note).trim();

    const { error } = await supabase
      .from("store_orders")
      .update({ admin_note: after || null })
      .eq("order_number", orderNumber);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (after === before) return { ok: true, data: null };

    const message = !before ? "Note added" : !after ? "Note removed" : "Note edited";
    try {
      // The column keeps only the latest text, so both wordings are kept here.
      // A note that is written and then deleted is still readable afterwards.
      const { data } = await supabase
        .from("order_events")
        .insert({
          order_id: s(loaded.order.id),
          actor: "staff",
          type: "note_edited",
          message,
          meta: { note_before: before, note_after: after },
        })
        .select("id,created_at")
        .single();
      if (data) {
        return {
          ok: true,
          data: {
            id: s(data.id),
            type: "note_edited",
            actor: "staff",
            message,
            createdAt: s(data.created_at),
            note: { before, after },
          },
        };
      }
    } catch {
      /* the timeline is a log; it never fails the save itself */
    }
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The fulfillment dropdown's "in progress" / "on hold" / clear. */
export async function setOrderHold(orderNumber: string, hold: "in_progress" | "on_hold" | null): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { error } = await supabase.from("store_orders").update({ fulfillment_hold: hold }).eq("order_number", orderNumber);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logEvent(supabase, s(loaded.order.id), {
      type: "note",
      message: hold === "in_progress" ? "Marked as in progress" : hold === "on_hold" ? "Placed on hold" : "Hold removed",
    });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Cancel the order, optionally restocking its items. */
export async function cancelOrder(
  orderNumber: string,
  input?: { reason?: string; restock?: boolean },
): Promise<ActionResult<{ restocked: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id,lifecycle");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const orderId = s(loaded.order.id);

    let restocked = 0;
    if (input?.restock) {
      const { data, error } = await supabase.rpc("order_restock", { p_order_number: orderNumber });
      if (error) return { ok: false, error: mapRpcError(error.message) };
      restocked = Number(data ?? 0);
    }

    const { error: upErr } = await supabase
      .from("store_orders")
      .update({ lifecycle: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: input?.reason?.trim() || null })
      .eq("order_number", orderNumber);
    if (upErr) return { ok: false, error: upErr.message };

    await logEvent(supabase, orderId, {
      type: "cancelled",
      message: `Order cancelled${input?.reason ? ` · ${input.reason}` : ""}${restocked > 0 ? ` · restocked ${restocked}` : ""}`,
    });
    return { ok: true, data: { restocked } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Archive / unarchive (hides from the default list, Shopify-style). */
export async function archiveOrder(orderNumber: string, archived: boolean): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { error } = await supabase
      .from("store_orders")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("order_number", orderNumber);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logEvent(supabase, s(loaded.order.id), {
      type: archived ? "archived" : "unarchived",
      message: archived ? "Order archived" : "Order unarchived",
    });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Restock every tracked line back to stock (idempotent via restocked_at). */
export async function restockOrder(orderNumber: string): Promise<ActionResult<{ restocked: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { data, error } = await supabase.rpc("order_restock", { p_order_number: orderNumber });
    if (error) return { ok: false, error: mapRpcError(error.message) };
    const restocked = Number(data ?? 0);
    await logEvent(supabase, s(loaded.order.id), { type: "restocked", message: `Restocked ${restocked} item${restocked === 1 ? "" : "s"}` });
    return { ok: true, data: { restocked } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** "Mark as paid" — record the whole outstanding balance as a manual payment. */
export async function markOrderPaid(orderNumber: string, method = "manual"): Promise<ActionResult<PaymentResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("total,amount_paid")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (!order) return { ok: false, error: "order_not_found" };
    const balance = Math.max(0, n(order.total) - n(order.amount_paid));
    if (balance <= 0) return { ok: false, error: "invalid_amount" };
    return collectPayment(orderNumber, { amount: balance, method, note: "Marked as paid" });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type OrderConversion = {
  orderIndex: number;      // 1-based: this is their Nth order
  totalOrders: number;
  totalSpent: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  risk: "low" | "medium" | "high";
  riskReason: string;
};

/**
 * The "Conversion summary" + "Order risk" cards, from data we actually have:
 * how many orders this phone has placed and their spend, and a simple risk read
 * from the order's own signals (a fraud flag, or a first-time COD order).
 */
export async function getOrderConversion(orderNumber: string): Promise<ActionResult<OrderConversion>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const loaded = await loadOrder(supabase, orderNumber, "id,phone,payment_method,created_at,total");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const order = loaded.order;

    const { data: theirs } = await supabase
      .from("store_orders")
      .select("order_number,total,created_at")
      .eq("phone", s(order.phone))
      .order("created_at", { ascending: true });

    const rows = (theirs ?? []) as Row[];
    const totalOrders = rows.length || 1;
    const totalSpent = rows.reduce((sum, r) => sum + n(r.total), 0);
    const idx = Math.max(1, rows.findIndex((r) => s(r.order_number) === orderNumber) + 1);
    const firstOrderAt = rows.length ? s(rows[0].created_at) : null;
    const lastOrderAt = rows.length ? s(rows[rows.length - 1].created_at) : null;

    // Risk: a returning customer who pays is low; a brand-new COD order carries
    // the most chargeback/bounce risk this shop actually sees.
    const isCod = (s(order.payment_method) || "cod").toLowerCase().includes("cod");
    let risk: OrderConversion["risk"] = "low";
    let riskReason = "Returning customer";
    if (idx === 1 && isCod && n(order.total) >= 5000) {
      risk = "high";
      riskReason = "First order, high-value, cash on delivery";
    } else if (idx === 1) {
      risk = "medium";
      riskReason = "First-time customer";
    }

    return {
      ok: true,
      data: { orderIndex: idx, totalOrders, totalSpent, firstOrderAt, lastOrderAt, risk, riskReason },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Is the shop's mailbox set up, so "Send invoice" can actually deliver? */
export async function getMailerStatus(): Promise<ActionResult<{ ready: boolean }>> {
  try {
    return { ok: true, data: { ready: await isMailerReady() } };
  } catch {
    return { ok: true, data: { ready: false } };
  }
}

/** Email the customer this order's invoice, then stamp it on the timeline. */
export async function sendOrderInvoice(orderNumber: string): Promise<ActionResult<{ to: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await sendOrderInvoiceEmail(orderNumber);
    if (!res.ok) return { ok: false, error: res.error };

    const supabase = getServerSupabase();
    await supabase.from("store_orders").update({ invoice_sent_at: new Date().toISOString() }).eq("order_number", orderNumber);
    const loaded = await loadOrder(supabase, orderNumber, "id");
    if (loaded.ok) {
      await logEvent(supabase, s(loaded.order.id), {
        type: "invoice_sent",
        message: `Invoice email sent to ${res.to}`,
        meta: { to: res.to },
      });
    }
    return { ok: true, data: { to: res.to } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
