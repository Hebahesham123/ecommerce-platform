"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapRequestRow, type ReturnRequest, type RequestStatus } from "@/lib/returns";
import type { ActionResult } from "../../store/actions";

/** Every return and exchange request, newest first. */
export async function listReturnRequests(): Promise<ActionResult<ReturnRequest[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("return_requests")
      .select("*, return_request_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      // The feature ships with its own migration; say so plainly rather than
      // showing a raw PostgREST code.
      if ((error.message || "").includes("return_requests")) {
        return { ok: false, error: "migration_missing" };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data: (data ?? []).map(mapRequestRow) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Move a request along.
 *
 * Completing is the only status that touches stock, and it does it through
 * complete_return_request() — one transaction that puts the returned goods back
 * on the shelf and takes the replacements off, or fails without doing either.
 * Every other status is just a label.
 */
export async function setRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<ActionResult<ReturnRequest>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();

    if (status === "completed") {
      const { error: rpcErr } = await supabase.rpc("complete_return_request", { p_request: id });
      if (rpcErr) {
        const msg = rpcErr.message || "";
        if (msg.includes("insufficient_stock")) return { ok: false, error: "insufficient_stock" };
        if (msg.includes("request_closed")) return { ok: false, error: "request_closed" };
        if (msg.includes("complete_return_request")) return { ok: false, error: "migration_missing" };
        return { ok: false, error: msg };
      }
    } else {
      const { error } = await supabase
        .from("return_requests")
        .update({ status })
        .eq("id", id)
        // Completed requests have already moved stock; reopening one would put
        // the shelf out of step with reality, so the database refuses too.
        .neq("status", "completed");
      if (error) return { ok: false, error: error.message };
    }

    const { data, error: readErr } = await supabase
      .from("return_requests")
      .select("*, return_request_items(*)")
      .eq("id", id)
      .single();
    if (readErr) return { ok: false, error: readErr.message };
    return { ok: true, data: mapRequestRow(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** A private note on the request — why it was rejected, what was agreed. */
export async function setRequestNote(id: string, note: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("return_requests")
      .update({ admin_note: note.trim() || null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
