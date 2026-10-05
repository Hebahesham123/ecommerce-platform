"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { logCourierAction } from "@/lib/courier-log";
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
