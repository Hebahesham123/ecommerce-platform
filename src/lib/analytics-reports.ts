import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * The Analytics page's figures, computed in the database
 * (supabase/migrations/0058_analytics_sessions.sql) so the page stays fast as
 * visits grow: one call per question, not every row brought here to count.
 */

export type ReportChannel = "all" | "web" | "app";
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type Overview = {
  sessions: number;
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  pageviews: number;
  bounced: number;
  withProductView: number;
  addedToCart: number;
  reachedCheckout: number;
  converted: number;
  orders: number;
  sales: number;
  customers: number;
  returningOrders: number;
  series: { day: string; sessions: number; orders: number; sales: number }[];
};

/** A row of a breakdown: sessions (and how many of them got to the bag and bought), or orders. */
export type Slice = { key: string; sessions?: number; carts?: number; orders: number; sales: number };
export type ProductRow = { name: string; image: string | null; views: number; adds: number; units: number; sales: number };
export type Live = {
  visitors: number;
  web: number;
  app: number;
  carts: number;
  checkouts: number;
  ordered: number;
  pages: { key: string; sessions: number }[];
  sources: { key: string; sessions: number }[];
  cities: { key: string; sessions: number }[];
};

export type Breakdowns = {
  sessionsBy: Record<"source" | "network" | "campaign" | "landing" | "device" | "browser" | "os" | "city" | "country" | "referrer", Slice[]>;
  salesBy: Record<"source" | "network" | "campaign" | "city" | "channel", Slice[]>;
};

const missing = (msg: string) => /analytics_(overview|breakdown|sales_by|products|live)|analytics_sessions|attr_source/.test(msg);
const fail = (msg: string): { ok: false; error: string } => ({ ok: false, error: missing(msg) ? "migration_missing" : msg });

const numbers = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v]));

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getServerSupabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function cleanSlices(rows: unknown): Slice[] {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const o = numbers(r as Record<string, unknown>) as Record<string, unknown>;
    return {
      key: String(o.key ?? ""),
      sessions: o.sessions === undefined ? undefined : Number(o.sessions) || 0,
      carts: o.carts === undefined ? undefined : Number(o.carts) || 0,
      orders: Number(o.orders) || 0,
      sales: Number(o.sales) || 0,
    };
  });
}

/** This period and the one of the same length just before it, for the deltas. */
export async function getOverview(from: string, to: string, channel: ReportChannel): Promise<Result<{ now: Overview; before: Overview }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const span = new Date(to).getTime() - new Date(from).getTime();
  const prevFrom = new Date(new Date(from).getTime() - span).toISOString();
  try {
    const [now, before] = await Promise.all([
      rpc<Record<string, unknown>>("analytics_overview", { p_from: from, p_to: to, p_channel: channel }),
      rpc<Record<string, unknown>>("analytics_overview", { p_from: prevFrom, p_to: from, p_channel: channel }),
    ]);
    const shape = (o: Record<string, unknown>): Overview => {
      const n = numbers(o) as Record<string, unknown>;
      return {
        ...(n as unknown as Overview),
        series: (Array.isArray(o.series) ? o.series : []).map((d) => {
          const x = numbers(d as Record<string, unknown>) as Record<string, unknown>;
          return { day: String(x.day), sessions: Number(x.sessions) || 0, orders: Number(x.orders) || 0, sales: Number(x.sales) || 0 };
        }),
      };
    };
    return { ok: true, data: { now: shape(now), before: shape(before) } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "failed");
  }
}

export async function getBreakdowns(from: string, to: string, channel: ReportChannel): Promise<Result<Breakdowns>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const sessionDims = ["source", "network", "campaign", "landing", "device", "browser", "os", "city", "country", "referrer"] as const;
  const salesDims = ["source", "network", "campaign", "city", "channel"] as const;
  try {
    const [sessions, sales] = await Promise.all([
      Promise.all(sessionDims.map((d) => rpc<unknown>("analytics_breakdown", { p_dim: d, p_from: from, p_to: to, p_channel: channel, p_limit: 25 }))),
      Promise.all(salesDims.map((d) => rpc<unknown>("analytics_sales_by", { p_dim: d, p_from: from, p_to: to, p_channel: channel, p_limit: 25 }))),
    ]);
    return {
      ok: true,
      data: {
        sessionsBy: Object.fromEntries(sessionDims.map((d, i) => [d, cleanSlices(sessions[i])])) as Breakdowns["sessionsBy"],
        salesBy: Object.fromEntries(salesDims.map((d, i) => [d, cleanSlices(sales[i])])) as Breakdowns["salesBy"],
      },
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "failed");
  }
}

export async function getTopProducts(from: string, to: string, channel: ReportChannel): Promise<Result<ProductRow[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const rows = await rpc<unknown>("analytics_products", { p_from: from, p_to: to, p_channel: channel, p_limit: 25 });
    return {
      ok: true,
      data: (Array.isArray(rows) ? rows : []).map((r) => {
        const o = numbers(r as Record<string, unknown>) as Record<string, unknown>;
        return {
          name: String(o.name ?? ""),
          image: (o.image as string | null) ?? null,
          views: Number(o.views) || 0,
          adds: Number(o.adds) || 0,
          units: Number(o.units) || 0,
          sales: Number(o.sales) || 0,
        };
      }),
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "failed");
  }
}

export async function getLive(): Promise<Result<Live>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const o = await rpc<Record<string, unknown>>("analytics_live", { p_minutes: 5 });
    const n = numbers(o) as Record<string, unknown>;
    const list = (v: unknown) =>
      (Array.isArray(v) ? v : []).map((r) => ({ key: String((r as { key?: unknown }).key ?? ""), sessions: Number((r as { sessions?: unknown }).sessions) || 0 }));
    return {
      ok: true,
      data: {
        visitors: Number(n.visitors) || 0,
        web: Number(n.web) || 0,
        app: Number(n.app) || 0,
        carts: Number(n.carts) || 0,
        checkouts: Number(n.checkouts) || 0,
        ordered: Number(n.ordered) || 0,
        pages: list(o.pages),
        sources: list(o.sources),
        cities: list(o.cities),
      },
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "failed");
  }
}
