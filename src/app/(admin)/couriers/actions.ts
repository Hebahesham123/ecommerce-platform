"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { hashPin } from "@/lib/courier-session";
import { queuePendingEntry } from "@/lib/accounting/post-order";
import { logCourierAction } from "@/lib/courier-log";
import type { Courier, Shipment, ShipmentStatus } from "@/lib/courier";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return err.code === "42P01" || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function mapCourier(r: Row): Courier {
  return { id: s(r.id), name: s(r.name), phone: s(r.phone), zone: sn(r.zone), active: r.active !== false, createdAt: s(r.created_at) };
}

function mapShipment(r: Row): Shipment {
  const courier = (r.couriers ?? null) as Row | null;
  return {
    id: s(r.id),
    orderId: s(r.order_id),
    orderNumber: s(r.order_number),
    courierId: sn(r.courier_id),
    courierName: courier ? sn(courier.name) : null,
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
    reportedStatus: (sn(r.reported_status) as Shipment["reportedStatus"]) ?? null,
    reportedCash: r.reported_cash == null ? null : n(r.reported_cash),
    reportedMethod: sn(r.reported_method),
    reportedNote: sn(r.reported_note),
    reportedProofUrl: sn(r.reported_proof_url),
    reportedImages: Array.isArray(r.reported_images) ? (r.reported_images as unknown[]).map(String) : [],
    reportedAt: sn(r.reported_at),
    confirmedAt: sn(r.confirmed_at),
    settledAt: sn(r.settled_at),
    assignedAt: s(r.assigned_at),
  };
}

async function logOrderEvent(supabase: ReturnType<typeof getServerSupabase>, orderId: string, type: string, message: string) {
  try {
    await supabase.from("order_events").insert({ order_id: orderId, actor: "staff", type, message });
  } catch {
    /* timeline is a log; never fail the action on it */
  }
}

// ---- Couriers ---------------------------------------------------------------
export async function listCouriers(): Promise<ActionResult<Courier[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase().from("couriers").select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapCourier) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createCourier(input: { name: string; phone: string; zone?: string; pin: string }): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const name = input.name.trim();
  const phone = input.phone.trim();
  const pin = input.pin.trim();
  if (!name || !phone) return { ok: false, error: "name_phone_required" };
  if (pin.length < 4) return { ok: false, error: "pin_too_short" };
  try {
    const { data, error } = await getServerSupabase()
      .from("couriers")
      .insert({ name, phone, zone: input.zone?.trim() || null, pin_hash: hashPin(pin), active: true })
      .select("id")
      .single();
    if (error) {
      if (missing(error)) return { ok: false, error: "migration_missing" };
      if ((error.message || "").toLowerCase().includes("duplicate")) return { ok: false, error: "phone_taken" };
      return { ok: false, error: error.message };
    }
    await logCourierAction({ actor: "staff", action: "courier_create", targetType: "courier", targetId: s(data.id), detail: name });
    return { ok: true, data: { id: s(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateCourier(
  id: string,
  input: { name?: string; zone?: string | null; active?: boolean; pin?: string },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const patch: Row = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.zone !== undefined) patch.zone = input.zone?.trim() || null;
    if (input.active !== undefined) patch.active = input.active;
    if (input.pin && input.pin.trim().length >= 4) patch.pin_hash = hashPin(input.pin.trim());
    const { error } = await getServerSupabase().from("couriers").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await logCourierAction({ actor: "staff", action: "courier_update", targetType: "courier", targetId: id, detail: input.name?.trim() || undefined });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Shipments (assignment + confirmation) ----------------------------------
export async function listShipments(): Promise<ActionResult<Shipment[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("courier_shipments")
      .select("*, couriers(name)")
      .order("assigned_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapShipment) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getShipmentForOrder(orderNumber: string): Promise<ActionResult<Shipment | null>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("courier_shipments")
      .select("*, couriers(name)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: data ? mapShipment(data as Row) : null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Assign (or re-assign) an order to a courier with a per-assignment fee. */
export async function assignOrderToCourier(orderNumber: string, courierId: string, fee: number): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error: oErr } = await supabase.from("store_orders").select("id").eq("order_number", orderNumber).maybeSingle();
    if (oErr) return { ok: false, error: missing(oErr) ? "migration_missing" : oErr.message };
    if (!order) return { ok: false, error: "order_not_found" };
    const { data: courier } = await supabase.from("couriers").select("name").eq("id", courierId).maybeSingle();
    if (!courier) return { ok: false, error: "courier_not_found" };

    const { error } = await supabase.from("courier_shipments").upsert(
      {
        order_id: s(order.id),
        order_number: orderNumber,
        courier_id: courierId,
        fee: Math.max(0, fee),
        status: "assigned",
        reported_status: null,
        reported_cash: null,
        reported_note: null,
        reported_at: null,
        confirmed_at: null,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "order_id" },
    );
    if (error) return { ok: false, error: error.message };
    await logOrderEvent(supabase, s(order.id), "courier", `Assigned to courier ${s(courier.name)} · fee ${Math.max(0, fee)}`);
    await logCourierAction({ actor: "staff", action: "assign", targetType: "shipment", orderNumber, detail: `${s(courier.name)} · fee ${Math.max(0, fee)}` });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type ConfirmResult = { status: ShipmentStatus; recorded: number; accounted: boolean };

/**
 * Confirm the courier's pending report: apply it to the shipment, and on a
 * delivery record the collected cash on the order and post a cash-in entry to
 * accounting (net of the courier's fee).
 */
export async function confirmCourierReport(orderNumber: string): Promise<ActionResult<ConfirmResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: ship, error } = await supabase.from("courier_shipments").select("*").eq("order_number", orderNumber).maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (!ship) return { ok: false, error: "not_assigned" };
    if (!ship.reported_status) return { ok: false, error: "nothing_to_confirm" };

    const newStatus = s(ship.reported_status) as ShipmentStatus;
    const cash = n(ship.reported_cash);
    const method = s(ship.reported_method) || "cash";
    const orderId = s(ship.order_id);
    const collected = newStatus === "delivered" || newStatus === "partial";

    await supabase
      .from("courier_shipments")
      .update({
        status: newStatus,
        cash_collected: collected ? cash : 0,
        collected_method: collected ? method : null,
        proof_url: sn(ship.reported_proof_url),
        confirmed_at: new Date().toISOString(),
        reported_status: null,
        reported_cash: null,
        reported_method: null,
        reported_note: null,
        reported_proof_url: null,
        reported_at: null,
      })
      .eq("id", s(ship.id));

    let recorded = 0;
    let accounted = false;

    if (collected) {
      const { data: order } = await supabase.from("store_orders").select("total,amount_paid").eq("order_number", orderNumber).maybeSingle();
      const balance = Math.max(0, n(order?.total) - n(order?.amount_paid));
      const pay = Math.min(cash, balance);
      if (pay > 0) {
        const { error: payErr } = await supabase.rpc("order_record_payment", {
          p_order_number: orderNumber,
          p_kind: "payment",
          p_amount: pay,
          p_method: "cod",
          p_reference: `COD-${s(ship.id).slice(0, 8)}`,
          p_note: "Cash on delivery via courier",
        });
        if (!payErr) recorded = pay;
      }
      await supabase
        .from("store_orders")
        .update({ fulfillment_status: newStatus === "delivered" ? "delivered" : "partial" })
        .eq("order_number", orderNumber);

      // Queue the collected cash for the accountant to confirm into the books,
      // tagged by how the courier collected it (cash / visa / wallet / …).
      if (cash > 0) {
        await queuePendingEntry({ source: "cod", method, amount: cash, orderNumber, courierId: sn(ship.courier_id), note: "تحصيل عند التسليم" });
        accounted = true;
      }
    } else if (newStatus === "returned") {
      await supabase.from("store_orders").update({ fulfillment_status: "returned" }).eq("order_number", orderNumber);
    }

    // A returned / failed delivery comes back to us: file each line of the order
    // into the warehouse so the returns desk can triage it. Best-effort.
    if (newStatus === "returned" || newStatus === "failed") {
      try {
        const { data: items } = await supabase
          .from("store_order_items")
          .select("product_name,sku,quantity")
          .eq("order_id", orderId);
        const intake = (items ?? []).map((it: Row) => ({
          order_number: orderNumber,
          product_name: s(it.product_name) || "—",
          sku: sn(it.sku),
          quantity: Math.max(1, n(it.quantity) || 1),
          source: newStatus,
          status: "in_warehouse",
        }));
        if (intake.length) {
          await supabase.from("warehouse_items").insert(intake);
          await logCourierAction({ actor: "staff", action: "warehouse_intake", targetType: "order", orderNumber, detail: `${intake.length} ${newStatus === "returned" ? "returned" : "failed"} item(s)` });
        }
      } catch {
        /* warehouse intake is a convenience; never fail the confirmation on it */
      }
    }

    await logOrderEvent(supabase, orderId, "courier", `Courier report confirmed · ${newStatus}${newStatus === "delivered" && cash > 0 ? ` · collected ${cash}` : ""}`);
    await logCourierAction({ actor: "staff", action: "confirm_report", targetType: "shipment", orderNumber, detail: `${newStatus}${collected && cash > 0 ? ` · ${method} ${cash}` : ""}` });
    return { ok: true, data: { status: newStatus, recorded, accounted } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type CourierCash = { courierId: string; name: string; zone: string | null; active: number; delivered: number; cashPending: number; cashCollected: number };

/** Per-courier cash picture for the Couriers screen (collected vs not-yet-settled). */
export async function courierCashSummary(): Promise<ActionResult<CourierCash[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const [{ data: couriers, error: cErr }, { data: ships }] = await Promise.all([
      supabase.from("couriers").select("*").order("name"),
      supabase.from("courier_shipments").select("courier_id,status,cash_collected,settled_at"),
    ]);
    if (cErr) return { ok: false, error: missing(cErr) ? "migration_missing" : cErr.message };

    const byId = new Map<string, CourierCash>();
    for (const c of (couriers ?? []) as Row[]) {
      byId.set(s(c.id), { courierId: s(c.id), name: s(c.name), zone: sn(c.zone), active: 0, delivered: 0, cashPending: 0, cashCollected: 0 });
    }
    for (const sh of (ships ?? []) as Row[]) {
      const cc = byId.get(s(sh.courier_id));
      if (!cc) continue;
      const st = s(sh.status);
      if (st === "assigned" || st === "out_for_delivery") cc.active += 1;
      if (st === "delivered") {
        cc.delivered += 1;
        const cash = n(sh.cash_collected);
        if (sh.settled_at) cc.cashCollected += cash;
        else cc.cashPending += cash; // delivered but not yet handed in / settled
      }
    }
    return { ok: true, data: [...byId.values()] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Settle (hand-in) all of a courier's delivered-but-unsettled cash. */
export async function settleCourier(courierId: string): Promise<ActionResult<{ settled: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: rows } = await supabase
      .from("courier_shipments")
      .select("id,cash_collected")
      .eq("courier_id", courierId)
      .eq("status", "delivered")
      .is("settled_at", null);
    const ids = (rows ?? []).map((r: Row) => s(r.id));
    const settled = (rows ?? []).reduce((sum: number, r: Row) => sum + n(r.cash_collected), 0);
    if (ids.length) {
      await supabase.from("courier_shipments").update({ settled_at: new Date().toISOString() }).in("id", ids);
    }
    await logCourierAction({ actor: "staff", action: "settle", targetType: "courier", targetId: courierId, detail: `settled ${settled} (${ids.length} shipment(s))` });
    return { ok: true, data: { settled } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
