"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ActionResult } from "../../store/actions";

/**
 * General customer requests — the "something else" branch of the storefront's
 * Requests page. Returns and exchanges have their own screen; these are the
 * enquiries that carry no stock or money, so all an admin does here is read
 * them, note what was agreed, and close them out.
 */

export type RequestStatus = "new" | "open" | "resolved" | "closed";

export type RequestAttachment = { url: string; kind: "image" | "video"; name: string };

export type StoreRequest = {
  id: string;
  reference: string;
  name: string;
  email: string | null;
  phone: string | null;
  sessionPhone: string | null;
  subject: string | null;
  message: string;
  orderNumber: string | null;
  attachments: RequestAttachment[];
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

function mapRequest(r: Row): StoreRequest {
  const raw = Array.isArray(r.attachments) ? (r.attachments as Row[]) : [];
  return {
    id: String(r.id),
    reference: String(r.reference ?? ""),
    name: String(r.name ?? ""),
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    sessionPhone: (r.session_phone as string) ?? null,
    subject: (r.subject as string) ?? null,
    message: String(r.message ?? ""),
    orderNumber: (r.order_number as string) ?? null,
    attachments: raw
      .filter((a) => a && typeof a.url === "string")
      .map((a) => ({
        url: String(a.url),
        kind: a.kind === "video" ? "video" : "image",
        name: String(a.name ?? ""),
      })),
    status: (r.status as RequestStatus) ?? "new",
    adminNote: (r.admin_note as string) ?? null,
    createdAt: String(r.created_at ?? ""),
  };
}

/** The table ships with its own migration; say so plainly rather than leaking a
 *  PostgREST code into the UI. */
function mapError(message: string): string {
  return /store_requests/i.test(message) ? "migration_missing" : message;
}

/**
 * Returns and exchanges live in their own table and on their own page, because
 * they move stock and money. A shopper choosing "Return" on the storefront and
 * a merchant looking for it under Requests is the obvious way to be confused,
 * so this page points at the other one rather than leaving a dead end.
 */
export type ReturnsSummary = { waiting: number; total: number };

export async function returnsSummary(): Promise<ActionResult<ReturnsSummary>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const [all, open] = await Promise.all([
      supabase.from("return_requests").select("id", { count: "exact", head: true }),
      supabase
        .from("return_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "approved"]),
    ]);
    if (all.error) return { ok: false, error: all.error.message };
    return { ok: true, data: { waiting: open.count ?? 0, total: all.count ?? 0 } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listRequests(): Promise<ActionResult<StoreRequest[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: (data ?? []).map(mapRequest) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function setRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("store_requests").update({ status }).eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** A private note — what was agreed, why it was closed. Never shown to the shopper. */
export async function setRequestAdminNote(id: string, note: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("store_requests")
      .update({ admin_note: note.trim() || null })
      .eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function deleteRequest(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("store_requests").delete().eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
