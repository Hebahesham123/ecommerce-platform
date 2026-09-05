"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/orders";

/**
 * The numbers behind the App section.
 *
 * Everything here is counted twice — once for the app and once for the whole
 * store — because the only useful question about a new channel is not "how
 * much did it sell?" but "how much of the business is it?". A month where the
 * app takes a fifth of the orders and a month where it takes a fiftieth look
 * identical if you only ever see the app's own total.
 */

export type ChannelStat = { app: number; total: number };

export type AppOverview = {
  /** True once any order, return or request has carried the app label. */
  live: boolean;
  /** False until migration 0022 runs — the section is honest about why it is empty. */
  ready: boolean;
  orders30: ChannelStat;
  revenue30: ChannelStat;
  orders7: ChannelStat;
  revenue7: ChannelStat;
  customers: number;
  returnsWaiting: number;
  requestsOpen: number;
  averageOrder: number;
  recent: {
    orderNumber: string;
    customer: string;
    total: number;
    createdAt: string;
    lifecycle: string;
  }[];
  /** Orders per day for the last 30 days, app and store, oldest first. */
  series: { date: string; app: number; total: number }[];
  meta: { datasetId: string | null; capiEnabled: boolean };
};

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));
const dayOf = (v: unknown) => String(v ?? "").slice(0, 10);

export async function getAppOverview(): Promise<ActionResult<AppOverview>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };

  try {
    const supabase = getServerSupabase();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: orders, error } = await supabase
      .from("store_orders")
      .select("order_number,customer_name,phone,total,created_at,lifecycle,channel")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(5000);

    // The channel column arrives with migration 0022. Until it does, the whole
    // section would show zeroes with no explanation — so say which it is.
    if (error) {
      const missing = /channel/i.test(error.message);
      return { ok: false, error: missing ? "migration_missing" : error.message };
    }

    const rows = (orders ?? []) as Row[];
    const isApp = (r: Row) => String(r.channel ?? "web") === "app";
    const appRows = rows.filter(isApp);

    const sum = (list: Row[]) => list.reduce((s, r) => s + n(r.total), 0);
    const within7 = (r: Row) => String(r.created_at) >= since7;

    // Counted per day so a run of quiet days is visible as a flat line rather
    // than hidden inside a monthly average.
    const byDay = new Map<string, { app: number; total: number }>();
    for (let i = 29; i >= 0; i--) {
      byDay.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), {
        app: 0,
        total: 0,
      });
    }
    for (const r of rows) {
      const bucket = byDay.get(dayOf(r.created_at));
      if (!bucket) continue;
      bucket.total += 1;
      if (isApp(r)) bucket.app += 1;
    }

    const [returnsRes, requestsRes, metaRes] = await Promise.all([
      supabase
        .from("return_requests")
        .select("id", { count: "exact", head: true })
        .eq("channel", "app")
        .eq("status", "pending"),
      supabase
        .from("store_requests")
        .select("id", { count: "exact", head: true })
        .eq("channel", "app")
        .in("status", ["new", "open"]),
      supabase
        .from("meta_connection")
        .select("app_dataset_id,app_capi_enabled")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    const appRevenue30 = sum(appRows);

    return {
      ok: true,
      data: {
        live: appRows.length > 0,
        ready: true,
        orders30: { app: appRows.length, total: rows.length },
        revenue30: { app: appRevenue30, total: sum(rows) },
        orders7: {
          app: appRows.filter(within7).length,
          total: rows.filter(within7).length,
        },
        revenue7: {
          app: sum(appRows.filter(within7)),
          total: sum(rows.filter(within7)),
        },
        customers: new Set(appRows.map((r) => String(r.phone ?? ""))).size,
        returnsWaiting: returnsRes.count ?? 0,
        requestsOpen: requestsRes.count ?? 0,
        averageOrder: appRows.length ? appRevenue30 / appRows.length : 0,
        recent: appRows.slice(0, 8).map((r) => ({
          orderNumber: String(r.order_number),
          customer: String(r.customer_name ?? ""),
          total: n(r.total),
          createdAt: String(r.created_at),
          lifecycle: String(r.lifecycle ?? "placed"),
        })),
        series: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
        meta: {
          datasetId: (metaRes.data?.app_dataset_id as string) ?? null,
          capiEnabled: Boolean(metaRes.data?.app_capi_enabled),
        },
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
