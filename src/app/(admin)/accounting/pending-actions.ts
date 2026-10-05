"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { postOrderSaleToJournal } from "@/lib/accounting/post-order";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return err.code === "42P01" || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

export type PendingEntry = {
  id: string;
  orderNumber: string | null;
  source: string;
  method: string;
  amount: number;
  courierId: string | null;
  courierName: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
};

export type MethodTotal = { method: string; amount: number; count: number };

export type PendingResult = { entries: PendingEntry[]; totals: MethodTotal[]; total: number };

function mapEntry(r: Row): PendingEntry {
  const courier = (r.couriers ?? null) as Row | null;
  return {
    id: s(r.id),
    orderNumber: sn(r.order_number),
    source: s(r.source) || "payment",
    method: s(r.method) || "cash",
    amount: n(r.amount),
    courierId: sn(r.courier_id),
    courierName: courier ? sn(courier.name) : null,
    note: sn(r.note),
    status: s(r.status) || "pending",
    createdAt: s(r.created_at),
    decidedAt: sn(r.decided_at),
  };
}

/** Entries awaiting the accountant (or a given status), with per-method totals. */
export async function listPendingEntries(status = "pending"): Promise<ActionResult<PendingResult>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("pending_entries")
      .select("*, couriers(name)")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    const entries = (data ?? []).map(mapEntry);
    const byMethod = new Map<string, MethodTotal>();
    let total = 0;
    for (const e of entries) {
      total += e.amount;
      const t = byMethod.get(e.method) ?? { method: e.method, amount: 0, count: 0 };
      t.amount += e.amount;
      t.count += 1;
      byMethod.set(e.method, t);
    }
    return {
      ok: true,
      data: { entries, total, totals: [...byMethod.values()].sort((a, b) => b.amount - a.amount) },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Accountant approves: post the balanced journal entry and mark it posted. */
export async function confirmPendingEntry(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row, error } = await supabase.from("pending_entries").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    if (!row) return { ok: false, error: "not_found" };
    if (s(row.status) !== "pending") return { ok: false, error: "already_decided" };

    const journalId = await postOrderSaleToJournal({
      method: s(row.method) || "cash",
      amount: n(row.amount),
      orderNumber: sn(row.order_number),
      note: sn(row.note) || "تحصيل طلب",
    });
    if (!journalId) return { ok: false, error: "no_entity_or_chart" };

    await supabase
      .from("pending_entries")
      .update({ status: "posted", journal_entry_id: journalId, decided_at: new Date().toISOString() })
      .eq("id", id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Accountant rejects: the line never hits the books. */
export async function rejectPendingEntry(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { error } = await getServerSupabase()
      .from("pending_entries")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
