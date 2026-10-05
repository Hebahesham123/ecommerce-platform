"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";
import {
  setCourierSession,
  clearCourierSession,
  getCourierId,
  verifyPin,
} from "@/lib/courier-session";
import { logCourierAction } from "@/lib/courier-log";
import { COLLECTED_STATUSES, type Courier, type Shipment, type ShipmentItem, type ShipmentPayment, type ReportStatus, type ShipmentStatus } from "@/lib/courier";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

/** Log the courier in by phone + PIN and start their session. */
export async function courierLogin(phone: string, pin: string): Promise<ActionResult<{ name: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ph = phone.trim();
  if (!ph || !pin.trim()) return { ok: false, error: "missing_fields" };
  try {
    const supabase = getServerSupabase();
    const variants = Array.from(new Set([ph, ...phoneVariants(ph)]));
    const { data } = await supabase.from("couriers").select("id,name,pin_hash,active").in("phone", variants).maybeSingle();
    if (!data || data.active === false) return { ok: false, error: "invalid_login" };
    if (!verifyPin(pin.trim(), s(data.pin_hash))) return { ok: false, error: "invalid_login" };
    await setCourierSession(s(data.id));
    return { ok: true, data: { name: s(data.name) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function courierLogout(): Promise<ActionResult> {
  await clearCourierSession();
  return { ok: true, data: undefined };
}

export type CourierHome = { courier: Courier; shipments: Shipment[] };

/** The signed-in courier's profile and their assigned orders. */
export async function getMyAssignments(): Promise<ActionResult<CourierHome>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const courierId = await getCourierId();
  if (!courierId) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data: c } = await supabase.from("couriers").select("*").eq("id", courierId).maybeSingle();
    if (!c) return { ok: false, error: "not_signed_in" };

    const { data: ships } = await supabase
      .from("courier_shipments")
      .select("*, store_orders(total,amount_paid,discount_amount,discount_code,shipping,customer_name,address,city,governorate,phone)")
      .eq("courier_id", courierId)
      .order("assigned_at", { ascending: false });

    // The real order the courier delivers: line items (with images) per order,
    // and the split-payment plan / collected parts per shipment. Both are
    // best-effort — a missing migration or empty order simply shows nothing.
    const orderIds = Array.from(new Set((ships ?? []).map((r: Row) => s(r.order_id)).filter(Boolean)));
    const shipIds = Array.from(new Set((ships ?? []).map((r: Row) => s(r.id)).filter(Boolean)));

    const itemsByOrder = new Map<string, Row[]>();
    if (orderIds.length) {
      const { data: items } = await supabase
        .from("store_order_items")
        .select("order_id,product_name,variant_title,sku,image_url,price,quantity,fulfilled_quantity")
        .in("order_id", orderIds);
      for (const it of (items ?? []) as Row[]) {
        const oid = s(it.order_id);
        const arr = itemsByOrder.get(oid) ?? [];
        arr.push(it);
        itemsByOrder.set(oid, arr);
      }
    }

    const paymentsByShip = new Map<string, ShipmentPayment[]>();
    if (shipIds.length) {
      const { data: pays } = await supabase
        .from("shipment_payments")
        .select("shipment_id,amount,method,kind,actor")
        .in("shipment_id", shipIds);
      for (const p of (pays ?? []) as Row[]) {
        const sid = s(p.shipment_id);
        const arr = paymentsByShip.get(sid) ?? [];
        arr.push({ amount: n(p.amount), method: s(p.method) || "cash", kind: (s(p.kind) as ShipmentPayment["kind"]) || "payment", actor: sn(p.actor) });
        paymentsByShip.set(sid, arr);
      }
    }

    const shipments: Shipment[] = (ships ?? []).map((r: Row): Shipment => {
      const o = (r.store_orders ?? null) as Row | null;

      // Build the delivered line items. If anything on the order is fulfilled,
      // the courier delivers ONLY the fulfilled lines (shown at their fulfilled
      // quantity) and collects just that amount. Otherwise it's a normal COD:
      // the whole order, collecting the outstanding balance. Zero-qty lines drop.
      const allLines: ShipmentItem[] = (itemsByOrder.get(s(r.order_id)) ?? [])
        .map((it): ShipmentItem => ({
          productName: s(it.product_name) || "—",
          variantTitle: sn(it.variant_title),
          sku: sn(it.sku),
          imageUrl: sn(it.image_url),
          price: n(it.price),
          quantity: n(it.quantity),
          fulfilledQuantity: n(it.fulfilled_quantity),
        }))
        .filter((it) => it.quantity > 0);
      const anyFulfilled = allLines.some((it) => it.fulfilledQuantity > 0);
      let items: ShipmentItem[];
      let collectAmount: number;
      if (anyFulfilled) {
        items = allLines
          .filter((it) => it.fulfilledQuantity > 0)
          .map((it) => ({ ...it, quantity: it.fulfilledQuantity }));
        collectAmount = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      } else {
        items = allLines;
        collectAmount = Math.max(0, n(o?.total) - n(o?.amount_paid));
      }

      return {
        id: s(r.id),
        orderId: s(r.order_id),
        orderNumber: s(r.order_number),
        courierId: sn(r.courier_id),
        courierName: null,
        fee: n(r.fee),
        status: (s(r.status) as ShipmentStatus) || "assigned",
        cashCollected: n(r.cash_collected),
        collectedMethod: sn(r.collected_method),
        proofUrl: sn(r.proof_url),
        holdFee: n(r.hold_fee),
        holdActive: r.hold_active === true,
        holdRemovedAt: sn(r.hold_removed_at),
        depositFee: n(r.deposit_fee),
        tags: Array.isArray(r.tags) ? (r.tags as unknown[]).map(String) : [],
        adminComment: sn(r.admin_comment),
        images: Array.isArray(r.images) ? (r.images as unknown[]).map(String) : [],
        reportedStatus: (sn(r.reported_status) as ReportStatus | null) ?? null,
        reportedCash: r.reported_cash == null ? null : n(r.reported_cash),
        reportedMethod: sn(r.reported_method),
        reportedNote: sn(r.reported_note),
        reportedProofUrl: sn(r.reported_proof_url),
        reportedImages: Array.isArray(r.reported_images) ? (r.reported_images as unknown[]).map(String) : [],
        reportedAt: sn(r.reported_at),
        confirmedAt: sn(r.confirmed_at),
        settledAt: sn(r.settled_at),
        assignedAt: s(r.assigned_at),
        orderTotal: o ? n(o.total) : undefined,
        customerName: o ? s(o.customer_name) : undefined,
        address: o ? sn(o.address) : null,
        city: o ? sn(o.city) : null,
        governorate: o ? sn(o.governorate) : null,
        phone: o ? sn(o.phone) : null,
        items,
        discountAmount: o ? n(o.discount_amount) : 0,
        discountCode: o ? sn(o.discount_code) : null,
        shipping: o ? n(o.shipping) : 0,
        collectAmount,
        payments: paymentsByShip.get(s(r.id)) ?? [],
        depositPlanned: n(r.deposit_fee),
      };
    });

    const courier: Courier = { id: s(c.id), name: s(c.name), phone: s(c.phone), zone: sn(c.zone), active: c.active !== false, createdAt: s(c.created_at) };
    return { ok: true, data: { courier, shipments } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * The courier reports an outcome. It lands as a PENDING report on the shipment
 * — the admin confirms it before it touches the order or accounting. The
 * shipment must belong to the signed-in courier.
 */
export async function submitMyReport(
  shipmentId: string,
  input: {
    status: ReportStatus;
    cashCollected: number;
    method?: string;
    note?: string;
    proofUrl?: string | null;
    images?: string[];
    tags?: string[];
    /** When present, the collection is split into these parts (each its own method). */
    payments?: { amount: number; method: string }[];
  },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const courierId = await getCourierId();
  if (!courierId) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data: ship } = await supabase
      .from("courier_shipments")
      .select("id,courier_id,order_number,tags, couriers(name)")
      .eq("id", shipmentId)
      .maybeSingle();
    if (!ship || s(ship.courier_id) !== courierId) return { ok: false, error: "not_your_shipment" };

    const collected = COLLECTED_STATUSES.includes(input.status as ShipmentStatus);

    // A split collection: each part its own method. Sanitise, then the report's
    // cash is their sum and the back-compat single method is the first part's.
    const parts = (Array.isArray(input.payments) ? input.payments : [])
      .map((p) => ({ amount: Math.max(0, n(p.amount)), method: String(p.method || "cash") }))
      .filter((p) => p.amount > 0);
    const hasParts = collected && parts.length > 0;
    const cash = collected
      ? hasParts
        ? parts.reduce((sum, p) => sum + p.amount, 0)
        : Math.max(0, n(input.cashCollected))
      : 0;
    const method = collected ? (hasParts ? parts[0].method : input.method || "cash") : null;

    // Record the courier's split in shipment_payments: replace any previous
    // courier parts for this shipment with the new ones. Best-effort — a missing
    // migration (0051) must never block a plain report.
    if (collected) {
      try {
        await supabase.from("shipment_payments").delete().eq("shipment_id", shipmentId).eq("actor", "courier");
        if (hasParts) {
          await supabase.from("shipment_payments").insert(
            parts.map((p) => ({
              shipment_id: shipmentId,
              order_number: s(ship.order_number),
              amount: p.amount,
              method: p.method,
              kind: "payment",
              actor: "courier",
            })),
          );
        }
      } catch {
        /* split payments are additive; never fail the report on them */
      }
    }

    // Multiple courier photos → reported_images; the first also fills the single
    // proof field so the existing proof display keeps working.
    const images = Array.isArray(input.images) ? input.images.map(String).filter(Boolean) : [];
    const proof = input.proofUrl || images[0] || null;

    // Tags merge with whatever is already on the shipment (admin tags + courier).
    const existingTags = Array.isArray(ship.tags) ? (ship.tags as unknown[]).map(String) : [];
    const inputTags = Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    const mergedTags = Array.from(new Set([...existingTags, ...inputTags]));

    const { error } = await supabase
      .from("courier_shipments")
      .update({
        reported_status: input.status,
        reported_cash: cash,
        reported_method: method,
        reported_note: input.note?.trim() || null,
        reported_proof_url: proof,
        reported_images: images,
        tags: mergedTags,
        reported_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);
    if (error) return { ok: false, error: error.message };
    const rel = ship.couriers as unknown;
    const relRow = (Array.isArray(rel) ? rel[0] : rel) as Row | null;
    const courierName = relRow ? s(relRow.name) : "";
    await logCourierAction({
      actor: courierName || "courier",
      action: "courier_report",
      targetType: "shipment",
      targetId: shipmentId,
      orderNumber: s(ship.order_number),
      detail: `${input.status}${collected ? ` · cash ${cash}` : ""}`,
    });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Upload a proof-of-delivery photo (data URL) to the courier-proofs bucket. */
export async function uploadCourierProof(dataUrl: string, filename: string): Promise<ActionResult<{ url: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const courierId = await getCourierId();
  if (!courierId) return { ok: false, error: "not_signed_in" };
  try {
    const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "bad_image" };
    const contentType = m[1] || "image/jpeg";
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 8 * 1024 * 1024) return { ok: false, error: "too_large" };
    const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const safe = (filename || "proof").replace(/[^\w.-]+/g, "_").slice(0, 40);
    const path = `${courierId}/${Date.now()}-${safe}.${ext}`;
    const sb = getServerSupabase();
    const { error: upErr } = await sb.storage.from("courier-proofs").upload(path, bytes, { contentType, upsert: true });
    if (upErr) return { ok: false, error: upErr.message };
    const { data } = sb.storage.from("courier-proofs").getPublicUrl(path);
    return { ok: true, data: { url: data.publicUrl } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
