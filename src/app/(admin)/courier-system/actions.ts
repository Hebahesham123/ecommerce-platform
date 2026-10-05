"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { logCourierAction } from "@/lib/courier-log";
import { COLLECTION_METHODS, COLLECTED_STATUSES, COD_METHODS, type ShipmentStatus } from "@/lib/courier";
import type {
  CourierRequest,
  RequestNote,
  RequestStatus,
  WarehouseItem,
  WarehouseStatus,
  WarehouseCondition,
  WarehouseSource,
  CourierLog,
  StaffUser,
  StaffRole,
} from "@/lib/courier-ops";

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

// ---- Mappers ----------------------------------------------------------------
function mapRequest(r: Row): CourierRequest {
  return {
    id: s(r.id),
    name: s(r.name),
    email: sn(r.email),
    phone: sn(r.phone),
    comment: sn(r.comment),
    imageUrl: sn(r.image_url),
    videoUrl: sn(r.video_url),
    status: (s(r.status) as RequestStatus) || "pending",
    assignee: sn(r.assignee),
    createdBy: s(r.created_by) || "admin",
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

function mapNote(r: Row): RequestNote {
  return { id: s(r.id), requestId: s(r.request_id), note: s(r.note), author: sn(r.author), createdAt: s(r.created_at) };
}

function mapWarehouse(r: Row): WarehouseItem {
  return {
    id: s(r.id),
    orderNumber: sn(r.order_number),
    productName: s(r.product_name),
    sku: sn(r.sku),
    quantity: n(r.quantity),
    source: (s(r.source) as WarehouseSource) || "other",
    condition: (s(r.condition) as WarehouseCondition) || "unknown",
    status: (s(r.status) as WarehouseStatus) || "in_warehouse",
    note: sn(r.note),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

function mapLog(r: Row): CourierLog {
  return {
    id: s(r.id),
    actor: sn(r.actor),
    action: s(r.action),
    targetType: sn(r.target_type),
    targetId: sn(r.target_id),
    orderNumber: sn(r.order_number),
    detail: sn(r.detail),
    createdAt: s(r.created_at),
  };
}

function mapStaff(r: Row): StaffUser {
  return {
    id: s(r.id),
    name: s(r.name),
    phone: sn(r.phone),
    role: (s(r.role) as StaffRole) || "manager",
    active: r.active !== false,
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

// =============================================================================
// Requests
// =============================================================================
export async function listRequests(status?: RequestStatus): Promise<ActionResult<CourierRequest[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    let q = getServerSupabase().from("courier_requests").select("*").order("created_at", { ascending: false }).limit(1000);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapRequest) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createRequest(input: {
  name: string;
  email?: string;
  phone?: string;
  comment?: string;
  imageUrl?: string;
  videoUrl?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };
  try {
    const { data, error } = await getServerSupabase()
      .from("courier_requests")
      .insert({
        name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        comment: input.comment?.trim() || null,
        image_url: input.imageUrl?.trim() || null,
        video_url: input.videoUrl?.trim() || null,
        status: "pending",
        created_by: "admin",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logCourierAction({ action: "request_create", targetType: "request", targetId: s(data.id), detail: name });
    return { ok: true, data: { id: s(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { error } = await getServerSupabase().from("courier_requests").update({ status }).eq("id", id);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logCourierAction({ action: "request_status", targetType: "request", targetId: id, detail: status });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setRequestAssignee(id: string, assignee: string | null): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const value = assignee?.trim() || null;
    const { error } = await getServerSupabase().from("courier_requests").update({ assignee: value }).eq("id", id);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logCourierAction({ action: "request_assign", targetType: "request", targetId: id, detail: value || "unassigned" });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listRequestNotes(requestId: string): Promise<ActionResult<RequestNote[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("courier_request_notes")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapNote) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addRequestNote(requestId: string, note: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const text = note.trim();
  if (!text) return { ok: false, error: "note_required" };
  try {
    const { error } = await getServerSupabase()
      .from("courier_request_notes")
      .insert({ request_id: requestId, note: text, author: "admin" });
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Warehouse
// =============================================================================
export async function listWarehouse(filter?: { status?: WarehouseStatus; source?: WarehouseSource }): Promise<ActionResult<WarehouseItem[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    let q = getServerSupabase().from("warehouse_items").select("*").order("created_at", { ascending: false }).limit(1000);
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.source) q = q.eq("source", filter.source);
    const { data, error } = await q;
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapWarehouse) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createWarehouseItem(input: {
  orderNumber?: string;
  productName: string;
  sku?: string;
  quantity?: number;
  source?: WarehouseSource;
  condition?: WarehouseCondition;
  note?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const productName = input.productName.trim();
  if (!productName) return { ok: false, error: "product_required" };
  try {
    const { data, error } = await getServerSupabase()
      .from("warehouse_items")
      .insert({
        order_number: input.orderNumber?.trim() || null,
        product_name: productName,
        sku: input.sku?.trim() || null,
        quantity: Math.max(1, Math.round(input.quantity ?? 1) || 1),
        source: input.source ?? "other",
        condition: input.condition ?? "unknown",
        status: "in_warehouse",
        note: input.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logCourierAction({ action: "warehouse_intake", targetType: "warehouse", targetId: s(data.id), orderNumber: input.orderNumber?.trim() || undefined, detail: productName });
    return { ok: true, data: { id: s(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateWarehouseItem(
  id: string,
  patch: { status?: WarehouseStatus; condition?: WarehouseCondition; note?: string | null },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const update: Row = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.condition !== undefined) update.condition = patch.condition;
    if (patch.note !== undefined) update.note = patch.note?.trim() || null;
    if (Object.keys(update).length === 0) return { ok: true, data: undefined };
    const { error } = await getServerSupabase().from("warehouse_items").update(update).eq("id", id);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    await logCourierAction({ action: "warehouse_update", targetType: "warehouse", targetId: id, detail: patch.status ?? patch.condition ?? "note" });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Audit log
// =============================================================================
export async function listLogs(filter?: { action?: string; from?: string; to?: string }): Promise<ActionResult<CourierLog[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    let q = getServerSupabase().from("courier_logs").select("*").order("created_at", { ascending: false }).limit(1000);
    if (filter?.action) q = q.eq("action", filter.action);
    if (filter?.from) q = q.gte("created_at", filter.from);
    if (filter?.to) q = q.lte("created_at", filter.to);
    const { data, error } = await q;
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapLog) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Staff
// =============================================================================
export async function listStaff(): Promise<ActionResult<StaffUser[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase().from("staff_users").select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapStaff) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createStaff(input: { name: string; phone?: string; role: StaffRole }): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };
  try {
    const { data, error } = await getServerSupabase()
      .from("staff_users")
      .insert({ name, phone: input.phone?.trim() || null, role: input.role, active: true })
      .select("id")
      .single();
    if (error) {
      if (missing(error)) return { ok: false, error: "migration_missing" };
      if ((error.message || "").toLowerCase().includes("duplicate")) return { ok: false, error: "phone_taken" };
      return { ok: false, error: error.message };
    }
    await logCourierAction({ action: "staff_create", targetType: "staff", targetId: s(data.id), detail: `${name} · ${input.role}` });
    return { ok: true, data: { id: s(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateStaff(
  id: string,
  patch: { name?: string; phone?: string | null; role?: StaffRole; active?: boolean },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const update: Row = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.phone !== undefined) update.phone = patch.phone?.trim() || null;
    if (patch.role !== undefined) update.role = patch.role;
    if (patch.active !== undefined) update.active = patch.active;
    if (Object.keys(update).length === 0) return { ok: true, data: undefined };
    const { error } = await getServerSupabase().from("staff_users").update(update).eq("id", id);
    if (error) {
      if (missing(error)) return { ok: false, error: "migration_missing" };
      if ((error.message || "").toLowerCase().includes("duplicate")) return { ok: false, error: "phone_taken" };
      return { ok: false, error: error.message };
    }
    await logCourierAction({ action: "staff_update", targetType: "staff", targetId: id, detail: patch.name?.trim() || patch.role || "update" });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Courier accounting — CourierPro-style per-courier Detailed Accounting
// =============================================================================
// Join courier_shipments → store_orders, filter by date range (confirmed_at,
// falling back to assigned_at) and courier, then roll the shipments up into the
// numbers the dashboard reads: an orders summary per outcome, actually-collected
// vs not-delivered, a payment breakdown by method, hold fees, and the final
// "handed to accounting" figure (collected minus the cash still on hold).

/** One cell of the Orders Summary: how many, their order value, what was taken. */
export type AccountingBucket = { count: number; originalValue: number; collected: number };
export type PaymentBreakdownLine = { method: string; amount: number; count: number };
export type HoldFeesSummary = {
  activeCount: number;
  activeAmount: number;
  lastAddedAt: string | null;
  removedCount: number;
  lastRemovedAt: string | null;
};

/** The buckets shown as cards in the Orders Summary section. */
export type OrdersSummaryKey =
  | "total"
  | "assigned"
  | "delivered"
  | "canceled"
  | "partial"
  | "postponed"
  | "part_pickup"
  | "hand_to_hand"
  | "returned";

export type CourierAccounting = {
  /** null = grand total across every courier. */
  courierId: string | null;
  courierName: string | null;
  ordersSummary: Record<OrdersSummaryKey, AccountingBucket>;
  totalActuallyCollected: { amount: number; count: number };
  totalNotDelivered: { count: number; originalValue: number };
  paymentBreakdown: PaymentBreakdownLine[];
  totalCod: number;
  holdFees: HoldFeesSummary;
  courierFee: number;
  deposits: number;
  totalHandedToAccounting: number;
};

export type CourierAccountingListItem = {
  id: string;
  name: string;
  active: boolean;
  delivered: number;
  collected: number;
  handedToAccounting: number;
};

export type OrderLine = {
  orderNumber: string;
  customer: string | null;
  phone: string | null;
  address: string | null;
  orderTotal: number;
  collected: number;
  status: ShipmentStatus;
  method: string | null;
};

/** Non-collected, non-assigned outcomes that count as "not delivered". */
const NOT_DELIVERED_STATUSES: ShipmentStatus[] = ["canceled", "postponed", "returned", "failed"];

/** A shipment flattened with just the fields the accounting rollups need. */
type AccRow = {
  courierId: string | null;
  courierName: string | null;
  status: ShipmentStatus;
  orderNumber: string;
  orderTotal: number;
  cashCollected: number;
  collectedMethod: string | null;
  holdFee: number;
  holdActive: boolean;
  holdRemovedAt: string | null;
  depositFee: number;
  fee: number;
  when: string; // confirmed_at ?? assigned_at — what the date range filters on
  customerName: string | null;
  phone: string | null;
  address: string | null;
};

/** Fetch the shipments (joined to their order) and apply the courier/date filters. */
async function fetchAccountingRows(input: {
  courierId?: string;
  from?: string;
  to?: string;
}): Promise<{ ok: true; rows: AccRow[] } | { ok: false; error: string }> {
  const supabase = getServerSupabase();
  let q = supabase
    .from("courier_shipments")
    .select("*, couriers(name), store_orders(total,customer_name,phone,address)")
    .order("assigned_at", { ascending: false })
    .limit(5000);
  if (input.courierId && input.courierId !== "all") q = q.eq("courier_id", input.courierId);
  const { data, error } = await q;
  if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };

  const from = input.from || "";
  const to = input.to || "";
  const rows: AccRow[] = [];
  for (const r of (data ?? []) as Row[]) {
    const confirmedAt = sn(r.confirmed_at);
    const assignedAt = s(r.assigned_at);
    const when = confirmedAt || assignedAt;
    const day = (when || "").slice(0, 10);
    if (from && day < from) continue;
    if (to && day > to) continue;
    const courier = (r.couriers ?? null) as Row | null;
    const o = (r.store_orders ?? null) as Row | null;
    rows.push({
      courierId: sn(r.courier_id),
      courierName: courier ? sn(courier.name) : null,
      status: (s(r.status) as ShipmentStatus) || "assigned",
      orderNumber: s(r.order_number),
      orderTotal: o ? n(o.total) : 0,
      cashCollected: n(r.cash_collected),
      collectedMethod: sn(r.collected_method),
      holdFee: n(r.hold_fee),
      holdActive: r.hold_active === true,
      holdRemovedAt: sn(r.hold_removed_at),
      depositFee: n(r.deposit_fee),
      fee: n(r.fee),
      when,
      customerName: o ? sn(o.customer_name) : null,
      phone: o ? sn(o.phone) : null,
      address: o ? sn(o.address) : null,
    });
  }
  return { ok: true, rows };
}

/** Roll a set of shipment rows up into the full accounting picture. */
function computeAccounting(
  rows: AccRow[],
  opts: { courierId: string | null; courierName: string | null; includeHoldFees: boolean },
): CourierAccounting {
  const bucket = (pred: (r: AccRow) => boolean): AccountingBucket => {
    let count = 0;
    let originalValue = 0;
    let collected = 0;
    for (const r of rows) {
      if (!pred(r)) continue;
      count += 1;
      originalValue += r.orderTotal;
      collected += r.cashCollected;
    }
    return { count, originalValue, collected };
  };

  const ordersSummary: Record<OrdersSummaryKey, AccountingBucket> = {
    total: bucket(() => true),
    assigned: bucket((r) => r.status === "assigned" || r.status === "out_for_delivery"),
    delivered: bucket((r) => r.status === "delivered"),
    canceled: bucket((r) => r.status === "canceled"),
    partial: bucket((r) => r.status === "partial"),
    postponed: bucket((r) => r.status === "postponed"),
    part_pickup: bucket((r) => r.status === "part_pickup"),
    hand_to_hand: bucket((r) => r.status === "hand_to_hand"),
    returned: bucket((r) => r.status === "returned"),
  };

  // Actually collected: cash taken on any hand-over outcome.
  let collectedAmount = 0;
  let collectedCount = 0;
  for (const r of rows) {
    if (COLLECTED_STATUSES.includes(r.status)) {
      collectedAmount += r.cashCollected;
      collectedCount += 1;
    }
  }

  // Not delivered: the order value that never reached the customer.
  let ndCount = 0;
  let ndValue = 0;
  for (const r of rows) {
    if (NOT_DELIVERED_STATUSES.includes(r.status)) {
      ndCount += 1;
      ndValue += r.orderTotal;
    }
  }

  // Payment breakdown: one line per collection method. With hold fees excluded,
  // each order's hold is netted out of the amount counted for its method.
  const paymentBreakdown: PaymentBreakdownLine[] = COLLECTION_METHODS.map((m) => {
    let amount = 0;
    let count = 0;
    for (const r of rows) {
      if (r.collectedMethod !== m.value) continue;
      amount += r.cashCollected - (opts.includeHoldFees ? 0 : r.holdFee);
      count += 1;
    }
    return { method: m.value, amount, count };
  });
  const totalCod = paymentBreakdown
    .filter((p) => COD_METHODS.includes(p.method))
    .reduce((sum, p) => sum + p.amount, 0);

  // Hold fees. We don't store a dedicated "added" timestamp, so the active hold's
  // last-added date is approximated by the latest handled date in the active set.
  let activeCount = 0;
  let activeAmount = 0;
  let removedCount = 0;
  let lastAddedAt: string | null = null;
  let lastRemovedAt: string | null = null;
  for (const r of rows) {
    if (r.holdActive && r.holdFee > 0) {
      activeCount += 1;
      activeAmount += r.holdFee;
      if (r.when && (!lastAddedAt || r.when > lastAddedAt)) lastAddedAt = r.when;
    }
    if (r.holdRemovedAt) {
      removedCount += 1;
      if (!lastRemovedAt || r.holdRemovedAt > lastRemovedAt) lastRemovedAt = r.holdRemovedAt;
    }
  }

  const courierFee = rows.reduce((sum, r) => sum + r.fee, 0);
  const deposits = rows.reduce((sum, r) => sum + r.depositFee, 0);
  const totalHandedToAccounting = collectedAmount - activeAmount;

  return {
    courierId: opts.courierId,
    courierName: opts.courierName,
    ordersSummary,
    totalActuallyCollected: { amount: collectedAmount, count: collectedCount },
    totalNotDelivered: { count: ndCount, originalValue: ndValue },
    paymentBreakdown,
    totalCod,
    holdFees: { activeCount, activeAmount, lastAddedAt, removedCount, lastRemovedAt },
    courierFee,
    deposits,
    totalHandedToAccounting,
  };
}

/**
 * The per-courier (or grand-total) Detailed Accounting Dashboard figures.
 * `courierId` omitted or "all" sums every courier together.
 */
export async function courierAccounting(input: {
  courierId?: string;
  from?: string;
  to?: string;
  includeHoldFees?: boolean;
}): Promise<ActionResult<CourierAccounting>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetchAccountingRows(input);
    if (!res.ok) return { ok: false, error: res.error };
    const courierId = input.courierId && input.courierId !== "all" ? input.courierId : null;
    let courierName: string | null = null;
    if (courierId) {
      courierName = res.rows.find((r) => r.courierId === courierId)?.courierName ?? null;
      if (!courierName) {
        const { data } = await getServerSupabase().from("couriers").select("name").eq("id", courierId).maybeSingle();
        courierName = data ? s(data.name) : null;
      }
    }
    const data = computeAccounting(res.rows, { courierId, courierName, includeHoldFees: input.includeHoldFees ?? true });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The "Couriers List" entry screen: a grand total plus a light per-courier row. */
export async function courierAccountingList(input: {
  from?: string;
  to?: string;
}): Promise<ActionResult<{ grand: CourierAccounting; couriers: CourierAccountingListItem[] }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const res = await fetchAccountingRows({ from: input.from, to: input.to });
    if (!res.ok) return { ok: false, error: res.error };
    const grand = computeAccounting(res.rows, { courierId: null, courierName: null, includeHoldFees: true });

    const byCourier = new Map<string, AccRow[]>();
    for (const r of res.rows) {
      if (!r.courierId) continue;
      const arr = byCourier.get(r.courierId) ?? [];
      arr.push(r);
      byCourier.set(r.courierId, arr);
    }

    // Every active/known courier shows, even with no activity in the range.
    const { data: couriersData } = await supabase.from("couriers").select("id,name,active").order("name");
    const meta = new Map<string, { name: string; active: boolean }>();
    for (const c of (couriersData ?? []) as Row[]) meta.set(s(c.id), { name: s(c.name), active: c.active !== false });

    const ids = new Set<string>([...meta.keys(), ...byCourier.keys()]);
    const couriers: CourierAccountingListItem[] = [];
    for (const id of ids) {
      const rows = byCourier.get(id) ?? [];
      const m = meta.get(id);
      const acc = computeAccounting(rows, { courierId: id, courierName: m?.name ?? rows[0]?.courierName ?? null, includeHoldFees: true });
      couriers.push({
        id,
        name: m?.name ?? rows[0]?.courierName ?? "—",
        active: m?.active ?? true,
        delivered: acc.ordersSummary.delivered.count,
        collected: acc.totalActuallyCollected.amount,
        handedToAccounting: acc.totalHandedToAccounting,
      });
    }
    couriers.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, data: { grand, couriers } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The orders behind a payment-breakdown card, for the drill-in modal. */
export async function ordersByMethod(input: {
  courierId?: string;
  method: string;
  from?: string;
  to?: string;
}): Promise<ActionResult<OrderLine[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetchAccountingRows({ courierId: input.courierId, from: input.from, to: input.to });
    if (!res.ok) return { ok: false, error: res.error };
    // "cod" is the rolled-up card → every cash-on-delivery method.
    const methods = input.method === "cod" ? COD_METHODS : [input.method];
    const lines: OrderLine[] = res.rows
      .filter((r) => r.collectedMethod != null && methods.includes(r.collectedMethod))
      .map((r) => ({
        orderNumber: r.orderNumber,
        customer: r.customerName,
        phone: r.phone,
        address: r.address,
        orderTotal: r.orderTotal,
        collected: r.cashCollected,
        status: r.status,
        method: r.collectedMethod,
      }));
    return { ok: true, data: lines };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
