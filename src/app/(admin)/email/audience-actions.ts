"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AudienceCustomer } from "@/lib/segments";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

/**
 * The email audience: every known customer (from store_customers) enriched with
 * their real order history (from store_orders), keyed by phone. Customers
 * without an email are still returned but flagged (email === null) so the UI can
 * show how many of a segment are actually reachable by email.
 */
export async function listEmailAudience(): Promise<ActionResult<AudienceCustomer[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();

    const [{ data: custRows, error: cErr }, { data: orderRows, error: oErr }] = await Promise.all([
      supabase.from("store_customers").select("phone,name,email,governorate,birthday"),
      supabase.from("store_orders").select("phone,total,created_at"),
    ]);
    if (cErr) return { ok: false, error: cErr.message };
    if (oErr) return { ok: false, error: oErr.message };

    // Roll up orders per phone.
    type Roll = { count: number; spent: number; first: string; last: string };
    const roll = new Map<string, Roll>();
    for (const o of (orderRows ?? []) as Row[]) {
      const phone = String(o.phone ?? "");
      if (!phone) continue;
      const date = String(o.created_at ?? "").slice(0, 10);
      const total = Number(o.total ?? 0) || 0;
      const cur = roll.get(phone);
      if (!cur) {
        roll.set(phone, { count: 1, spent: total, first: date, last: date });
      } else {
        cur.count += 1;
        cur.spent += total;
        if (date && date < cur.first) cur.first = date;
        if (date && date > cur.last) cur.last = date;
      }
    }

    const out: AudienceCustomer[] = ((custRows ?? []) as Row[]).map((c) => {
      const phone = String(c.phone ?? "");
      const r = roll.get(phone);
      return {
        phone,
        name: String(c.name ?? "").trim() || "—",
        email: (c.email as string) ? String(c.email).trim() : null,
        governorate: (c.governorate as string) ?? null,
        birthday: c.birthday ? String(c.birthday) : null,
        ordersCount: r?.count ?? 0,
        totalSpent: r?.spent ?? 0,
        lastOrderDate: r?.last ?? null,
        firstOrderDate: r?.first ?? null,
      };
    });

    // Also include phones that have orders but somehow no customer row.
    const known = new Set(out.map((c) => c.phone));
    for (const [phone, r] of roll) {
      if (known.has(phone)) continue;
      out.push({
        phone,
        name: "—",
        email: null,
        governorate: null,
        birthday: null,
        ordersCount: r.count,
        totalSpent: r.spent,
        lastOrderDate: r.last,
        firstOrderDate: r.first,
      });
    }

    // Best customers first.
    out.sort((a, b) => b.totalSpent - a.totalSpent);
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
