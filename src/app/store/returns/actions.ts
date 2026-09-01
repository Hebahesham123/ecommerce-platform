"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSessionPhone } from "@/lib/store-session";
import { phoneVariants } from "@/lib/phone";
import {
  RETURN_WINDOW_DAYS,
  isWithinWindow,
  mapRequestRow,
  round2,
  settle,
  windowExpiryOf,
  type RequestKind,
  type ReturnRequest,
} from "@/lib/returns";
import type { ActionResult } from "../actions";

/** A line the shopper still has, and how much of it is still returnable. */
export type ReturnableLine = {
  orderItemId: string;
  itemId: string | null;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  /** quantity minus whatever is already tied up in an open or completed request */
  returnable: number;
};

export type ReturnableOrder = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  windowExpiresAt: string;
  total: number;
  lines: ReturnableLine[];
};

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * The signed-in shopper's orders that are still inside the 14-day window,
 * with the quantities they can still send back.
 *
 * Only their own orders are ever read: the phone comes from the signed session,
 * never from the page, so nobody can pull up someone else's order by number.
 */
export async function listReturnableOrders(): Promise<ActionResult<ReturnableOrder[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };

  try {
    const supabase = getServerSupabase();
    const since = new Date(Date.now() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("store_orders")
      .select("id,order_number,created_at,total")
      // Orders written before phones were normalized are still this shopper's.
      .in("phone", phoneVariants(phone))
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    if (!orders?.length) return { ok: true, data: [] };

    const orderIds = orders.map((o) => String(o.id));
    const [{ data: items }, { data: claimed }] = await Promise.all([
      supabase
        .from("store_order_items")
        .select("id,order_id,item_id,product_name,variant_title,sku,image_url,price,quantity")
        .in("order_id", orderIds),
      // Anything already requested is spoken for — a shopper shouldn't be able
      // to return the same unit twice by opening a second request.
      supabase
        .from("return_request_items")
        .select("order_item_id,quantity,direction,return_requests!inner(order_id,status)")
        .eq("direction", "return")
        .in("return_requests.order_id", orderIds),
    ]);

    const spoken = new Map<string, number>();
    for (const row of (claimed ?? []) as Row[]) {
      const req = row.return_requests as Row | null;
      const status = String(req?.status ?? "");
      // Rejected and cancelled requests release their hold.
      if (status === "rejected" || status === "cancelled") continue;
      const key = String(row.order_item_id ?? "");
      if (!key) continue;
      spoken.set(key, (spoken.get(key) ?? 0) + n(row.quantity));
    }

    const byOrder = new Map<string, ReturnableLine[]>();
    for (const it of (items ?? []) as Row[]) {
      const id = String(it.id);
      const already = spoken.get(id) ?? 0;
      const line: ReturnableLine = {
        orderItemId: id,
        itemId: it.item_id ? String(it.item_id) : null,
        productName: String(it.product_name ?? ""),
        variantTitle: (it.variant_title as string) ?? null,
        sku: (it.sku as string) ?? null,
        imageUrl: (it.image_url as string) ?? null,
        price: n(it.price),
        quantity: n(it.quantity),
        returnable: Math.max(0, n(it.quantity) - already),
      };
      const key = String(it.order_id);
      if (!byOrder.has(key)) byOrder.set(key, []);
      byOrder.get(key)!.push(line);
    }

    const out: ReturnableOrder[] = orders
      .map((o) => ({
        orderId: String(o.id),
        orderNumber: String(o.order_number),
        createdAt: String(o.created_at),
        windowExpiresAt: windowExpiryOf(String(o.created_at)).toISOString(),
        total: n(o.total),
        lines: byOrder.get(String(o.id)) ?? [],
      }))
      // An order with nothing left to send back is only noise on the page.
      .filter((o) => o.lines.some((l) => l.returnable > 0));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type SubmitPayload = {
  kind: RequestKind;
  orderId: string;
  /** orderItemId → quantity being sent back */
  returnLines: { orderItemId: string; quantity: number }[];
  /** exchanges only: inventory item ids the shopper wants instead */
  replacementLines: { itemId: string; quantity: number }[];
  reason: string;
  note: string;
};

/**
 * Open a request. Everything that matters is recomputed here from the database:
 * the 14-day window from the order's own timestamp, the returned value from
 * what was actually paid, and the replacement value from today's prices — the
 * page's arithmetic is only ever a preview.
 */
export async function submitReturnRequest(
  payload: SubmitPayload,
): Promise<ActionResult<{ reference: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };

  const kind: RequestKind = payload.kind === "exchange" ? "exchange" : "return";
  const wanted = payload.returnLines.filter((l) => l.quantity > 0);
  if (wanted.length === 0) return { ok: false, error: "no_items" };
  if (kind === "exchange" && payload.replacementLines.filter((l) => l.quantity > 0).length === 0) {
    return { ok: false, error: "no_replacement" };
  }

  try {
    const supabase = getServerSupabase();

    // The order must be the shopper's own, and still in time.
    const { data: order } = await supabase
      .from("store_orders")
      .select("id,order_number,phone,customer_name,created_at")
      .eq("id", payload.orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "order_not_found" };
    if (!phoneVariants(phone).includes(String(order.phone))) {
      return { ok: false, error: "not_your_order" };
    }
    if (!isWithinWindow(String(order.created_at))) return { ok: false, error: "window_expired" };

    // Re-derive what may be returned, so a tampered page can't over-return.
    const available = await listReturnableOrders();
    if (!available.ok) return { ok: false, error: available.error };
    const thisOrder = available.data.find((o) => o.orderId === payload.orderId);
    if (!thisOrder) return { ok: false, error: "nothing_returnable" };

    const returnRows: Row[] = [];
    let returnedValue = 0;
    for (const req of wanted) {
      const line = thisOrder.lines.find((l) => l.orderItemId === req.orderItemId);
      if (!line) return { ok: false, error: "line_not_found" };
      const qty = Math.min(Math.max(1, Math.floor(req.quantity)), line.returnable);
      if (qty <= 0) return { ok: false, error: "already_requested" };
      returnedValue += line.price * qty;
      returnRows.push({
        direction: "return",
        item_id: line.itemId,
        order_item_id: line.orderItemId,
        product_name: line.productName,
        variant_title: line.variantTitle,
        sku: line.sku,
        image_url: line.imageUrl,
        price: line.price,
        quantity: qty,
      });
    }

    // Replacements are priced now, from stock — not from anything the page sent.
    const replacementRows: Row[] = [];
    let replacementValue = 0;
    if (kind === "exchange") {
      const ids = payload.replacementLines.filter((l) => l.quantity > 0).map((l) => l.itemId);
      const { data: stock } = await supabase
        .from("inventory_items")
        .select("id,product_name,variant_title,sku,image_url,price")
        .in("id", ids);
      const byId = new Map((stock ?? []).map((s: Row) => [String(s.id), s]));

      for (const want of payload.replacementLines) {
        if (want.quantity <= 0) continue;
        const it = byId.get(want.itemId);
        if (!it) return { ok: false, error: "replacement_not_found" };
        const qty = Math.max(1, Math.floor(want.quantity));
        const price = n(it.price);
        replacementValue += price * qty;
        replacementRows.push({
          direction: "replacement",
          item_id: String(it.id),
          order_item_id: null,
          product_name: String(it.product_name ?? ""),
          variant_title: (it.variant_title as string) ?? null,
          sku: (it.sku as string) ?? null,
          image_url: (it.image_url as string) ?? null,
          price,
          quantity: qty,
        });
      }
    }

    returnedValue = round2(returnedValue);
    replacementValue = round2(replacementValue);
    // A plain return refunds everything coming back; an exchange only settles
    // the difference between the two baskets.
    const money =
      kind === "return"
        ? { difference: round2(-returnedValue), refundAmount: returnedValue, extraAmount: 0 }
        : settle(returnedValue, replacementValue);

    const reference = `RX${Date.now().toString().slice(-8)}`;
    const { data: created, error: insErr } = await supabase
      .from("return_requests")
      .insert({
        reference,
        kind,
        status: "pending",
        order_id: String(order.id),
        order_number: String(order.order_number),
        phone: String(order.phone),
        customer_name: (order.customer_name as string) ?? null,
        reason: payload.reason.trim() || null,
        note: payload.note.trim() || null,
        returned_value: returnedValue,
        replacement_value: replacementValue,
        difference: money.difference,
        refund_amount: money.refundAmount,
        extra_amount: money.extraAmount,
        order_created_at: String(order.created_at),
        window_expires_at: windowExpiryOf(String(order.created_at)).toISOString(),
      })
      .select("id")
      .single();
    if (insErr) return { ok: false, error: insErr.message };

    const { error: linesErr } = await supabase
      .from("return_request_items")
      .insert([...returnRows, ...replacementRows].map((r) => ({ ...r, request_id: created.id })));
    if (linesErr) {
      // Without its lines the request is meaningless — don't leave a husk behind.
      await supabase.from("return_requests").delete().eq("id", created.id);
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, data: { reference } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The shopper's own requests, newest first, so they can follow the status. */
export async function listMyRequests(): Promise<ActionResult<ReturnRequest[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("return_requests")
      .select("*, return_request_items(*)")
      .in("phone", phoneVariants(phone))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(mapRequestRow) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
