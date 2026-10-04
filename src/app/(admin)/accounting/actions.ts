"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AccountingEntry } from "@/lib/courier";

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

function mapEntry(r: Row): AccountingEntry {
  const courier = (r.couriers ?? null) as Row | null;
  return {
    id: s(r.id),
    orderNumber: sn(r.order_number),
    type: s(r.type) || "cash_in",
    method: sn(r.method),
    amount: n(r.amount),
    courierId: sn(r.courier_id),
    courierName: courier ? sn(courier.name) : null,
    courierFee: n(r.courier_fee),
    net: n(r.net),
    note: sn(r.note),
    createdAt: s(r.created_at),
  };
}

export async function listAccountingEntries(limit = 200): Promise<ActionResult<AccountingEntry[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("accounting_entries")
      .select("*, couriers(name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map(mapEntry) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type AccountingSummary = {
  cashIn: number;
  courierFees: number;
  net: number;
  byMethod: { method: string; amount: number }[];
  daily: { day: string; amount: number }[];
  count: number;
};

export async function accountingSummary(days = 30): Promise<ActionResult<AccountingSummary>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getServerSupabase()
      .from("accounting_entries")
      .select("amount,courier_fee,net,method,created_at")
      .gte("created_at", since);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };

    const rows = (data ?? []) as Row[];
    let cashIn = 0, courierFees = 0, net = 0;
    const method = new Map<string, number>();
    const daily = new Map<string, number>();
    for (const r of rows) {
      const amt = n(r.amount);
      cashIn += amt;
      courierFees += n(r.courier_fee);
      net += n(r.net);
      const m = s(r.method) || "other";
      method.set(m, (method.get(m) ?? 0) + amt);
      const day = s(r.created_at).slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + amt);
    }
    return {
      ok: true,
      data: {
        cashIn,
        courierFees,
        net,
        count: rows.length,
        byMethod: [...method.entries()].map(([m, a]) => ({ method: m, amount: a })).sort((a, b) => b.amount - a.amount),
        daily: [...daily.entries()].map(([day, amount]) => ({ day, amount })).sort((a, b) => a.day.localeCompare(b.day)),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** A manual cash-in line, if the merchant wants to log one by hand. */
export async function addAccountingEntry(input: { amount: number; method?: string; note?: string; orderNumber?: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "invalid_amount" };
  try {
    const { error } = await getServerSupabase().from("accounting_entries").insert({
      type: "cash_in",
      method: input.method || "manual",
      amount: input.amount,
      net: input.amount,
      note: input.note?.trim() || null,
      order_number: input.orderNumber?.trim() || null,
    });
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
