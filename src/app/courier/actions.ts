"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";
import {
  setCourierSession,
  clearCourierSession,
  getCourierId,
  verifyPin,
} from "@/lib/courier-session";
import type { Courier, Shipment, ReportStatus, ShipmentStatus } from "@/lib/courier";

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
      .select("*, store_orders(total,customer_name,address,city,governorate,phone)")
      .eq("courier_id", courierId)
      .order("assigned_at", { ascending: false });

    const shipments: Shipment[] = (ships ?? []).map((r: Row): Shipment => {
      const o = (r.store_orders ?? null) as Row | null;
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
        reportedStatus: (sn(r.reported_status) as ReportStatus | null) ?? null,
        reportedCash: r.reported_cash == null ? null : n(r.reported_cash),
        reportedMethod: sn(r.reported_method),
        reportedNote: sn(r.reported_note),
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
  input: { status: ReportStatus; cashCollected: number; method?: string; note?: string },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const courierId = await getCourierId();
  if (!courierId) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data: ship } = await supabase.from("courier_shipments").select("id,courier_id").eq("id", shipmentId).maybeSingle();
    if (!ship || s(ship.courier_id) !== courierId) return { ok: false, error: "not_your_shipment" };

    const delivered = input.status === "delivered";
    const cash = delivered ? Math.max(0, n(input.cashCollected)) : 0;
    const { error } = await supabase
      .from("courier_shipments")
      .update({
        reported_status: input.status,
        reported_cash: cash,
        reported_method: delivered ? input.method || "cash" : null,
        reported_note: input.note?.trim() || null,
        reported_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
