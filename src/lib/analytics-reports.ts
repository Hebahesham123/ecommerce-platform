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

/* ------------------------------------------------------------------ */
/* Visitors and their journeys (supabase/migrations/0059)             */
/* ------------------------------------------------------------------ */

export type VisitorRow = {
  visitor_id: string;
  phone: string | null;
  name: string | null;
  first_seen: string;
  last_seen: string;
  first_landing: string | null;
  first_source: string | null;
  first_network: string | null;
  first_utm_campaign: string | null;
  last_source: string | null;
  last_network: string | null;
  channel: string | null;
  device: string | null;
  os: string | null;
  city: string | null;
  sessions: number;
  pageviews: number;
  seconds: number;
  searches: number;
  clicks: number;
  orders: number;
};

export type Journey = {
  visitors: (Omit<VisitorRow, "name" | "orders"> & {
    first_referrer: string | null;
    first_utm_source: string | null;
    first_utm_medium: string | null;
    first_click_id: string | null;
    last_utm_campaign: string | null;
    platform: string | null;
    browser: string | null;
    country: string | null;
    region: string | null;
  })[];
  sessions: {
    session_id: string;
    visitor_id: string;
    channel: string;
    started_at: string;
    last_seen: string;
    pageviews: number;
    landing_path: string | null;
    source: string;
    network: string | null;
    utm_campaign: string | null;
    referrer_host: string | null;
    device: string | null;
    browser: string | null;
    city: string | null;
    product_views: number;
    added_to_cart: boolean;
    reached_checkout: boolean;
    ordered: boolean;
    order_number: string | null;
    revenue: number;
    seconds: number;
  }[];
  pages: { id: string; session_id: string; channel: string; path: string | null; title: string | null; entered_at: string; seconds: number; scroll: number }[];
  searches: { created_at: string; channel: string; term: string | null; results: number | null; path: string | null }[];
  clicks: { created_at: string; channel: string; label: string | null; important: boolean; target: string | null; path: string | null }[];
};

export type SearchRow = { term: string; searches: number; visitors: number; empty: number };
export type ClickRow = { label: string; important: boolean; clicks: number; visitors: number };
export type PageTimeRow = { path: string; views: number; visitors: number; avg_seconds: number | null; seconds: number; avg_scroll: number | null };

const missingJourney = (msg: string) => /analytics_(journey|visitor_list|top_searches|top_clicks|page_time)|analytics_visitors|analytics_pageviews/.test(msg);
const failJourney = (msg: string): { ok: false; error: string } => ({ ok: false, error: missingJourney(msg) ? "migration_missing" : msg });

/** Numbers that arrive as text (counts, money) made numbers again, all the way down. */
function deep<T>(v: unknown): T {
  if (Array.isArray(v)) return v.map((x) => deep(x)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) as T;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v) as T;
  return v as T;
}

export async function getVisitorList(input: {
  from: string;
  to: string;
  channel: ReportChannel;
  who: "all" | "known" | "anonymous";
  search: string;
  limit: number;
  offset: number;
}): Promise<Result<{ total: number; rows: VisitorRow[] }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const r = await rpc<{ total: number; rows: VisitorRow[] }>("analytics_visitor_list", {
      p_from: input.from,
      p_to: input.to,
      p_channel: input.channel,
      p_who: input.who,
      p_search: input.search.trim().slice(0, 60),
      p_limit: input.limit,
      p_offset: input.offset,
    });
    const d = deep<{ total: number; rows: VisitorRow[] }>(r);
    // Ids and phones stay text even when they look like numbers.
    const rows = ((r as { rows?: VisitorRow[] }).rows ?? []).map((raw, i) => ({ ...d.rows[i], visitor_id: raw.visitor_id, phone: raw.phone }));
    return { ok: true, data: { total: Number(d.total) || 0, rows } };
  } catch (e) {
    return failJourney(e instanceof Error ? e.message : "failed");
  }
}

/** One visitor id, or every id a customer's phone has been seen on. */
export async function getJourney(visitorIds: string[]): Promise<Result<Journey>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ids = [...new Set(visitorIds.map((v) => v.slice(0, 64)).filter(Boolean))].slice(0, 50);
  if (!ids.length) return { ok: true, data: { visitors: [], sessions: [], pages: [], searches: [], clicks: [] } };
  try {
    const r = await rpc<Journey>("analytics_journey", { p_visitors: ids });
    const d = deep<Journey>(r);
    d.visitors = d.visitors.map((v, i) => ({ ...v, visitor_id: r.visitors[i].visitor_id, phone: r.visitors[i].phone }));
    d.sessions = d.sessions.map((x, i) => ({ ...x, session_id: r.sessions[i].session_id, visitor_id: r.sessions[i].visitor_id, order_number: r.sessions[i].order_number }));
    d.searches = d.searches.map((x, i) => ({ ...x, term: r.searches[i].term }));
    d.clicks = d.clicks.map((x, i) => ({ ...x, label: r.clicks[i].label }));
    return { ok: true, data: d };
  } catch (e) {
    return failJourney(e instanceof Error ? e.message : "failed");
  }
}

/** Every visitor id a phone has been seen on (in any of the spellings orders were saved with). */
export async function visitorIdsForPhone(phones: string[]): Promise<string[]> {
  if (!isSupabaseConfigured() || !phones.length) return [];
  const { data } = await getServerSupabase().from("shopper_visitors").select("visitor_id").in("phone", phones).limit(50);
  return (data ?? []).map((r) => String((r as { visitor_id: string }).visitor_id));
}

export async function getTopSearches(from: string, to: string, channel: ReportChannel): Promise<Result<SearchRow[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const r = await rpc<SearchRow[]>("analytics_top_searches", { p_from: from, p_to: to, p_channel: channel, p_limit: 30 });
    return { ok: true, data: deep<SearchRow[]>(r).map((x, i) => ({ ...x, term: String(r[i].term ?? "") })) };
  } catch (e) {
    return failJourney(e instanceof Error ? e.message : "failed");
  }
}

export async function getTopClicks(from: string, to: string, channel: ReportChannel, importantOnly: boolean): Promise<Result<ClickRow[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const r = await rpc<ClickRow[]>("analytics_top_clicks", { p_from: from, p_to: to, p_channel: channel, p_important_only: importantOnly, p_limit: 30 });
    return { ok: true, data: deep<ClickRow[]>(r).map((x, i) => ({ ...x, label: String(r[i].label ?? "") })) };
  } catch (e) {
    return failJourney(e instanceof Error ? e.message : "failed");
  }
}

export async function getPageTime(from: string, to: string, channel: ReportChannel): Promise<Result<PageTimeRow[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const r = await rpc<PageTimeRow[]>("analytics_page_time", { p_from: from, p_to: to, p_channel: channel, p_limit: 30 });
    return { ok: true, data: deep<PageTimeRow[]>(r).map((x, i) => ({ ...x, path: String(r[i].path ?? "") })) };
  } catch (e) {
    return failJourney(e instanceof Error ? e.message : "failed");
  }
}
