import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * First-party analytics.
 *
 * Every figure the two analytics pages show is counted from rows this shop
 * wrote itself - a pageview when a screen is seen, a session when the app
 * opens. No third-party tag, no sampling, and nothing about a person: a
 * visitor is a random id their own browser keeps.
 *
 * Where a metric has no source at all (installs from the stores, crash
 * reports), the pages say so instead of printing a number nobody measured.
 */

export type Channel = "web" | "app";
export type Platform = "ios" | "android" | "web";

export type SiteEvent = {
  kind: "pageview" | "session";
  channel: Channel;
  visitorId: string;
  sessionId: string;
  path?: string | null;
  source?: string | null;
  referrerHost?: string | null;
  platform?: Platform | null;
  appVersion?: string | null;
};

/** Traffic sources, grouped the way a shopkeeper thinks about them. */
export function sourceOf(referrer: string | null | undefined): { source: string; host: string | null } {
  const raw = String(referrer ?? "").trim();
  if (!raw) return { source: "direct", host: null };
  let host = "";
  try {
    host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { source: "direct", host: null };
  }
  if (/google|bing|yahoo|duckduckgo|yandex/.test(host)) return { source: "search", host };
  if (/facebook|instagram|tiktok|snapchat|twitter|x\.com|pinterest|linkedin|threads/.test(host)) {
    return { source: "social", host };
  }
  if (/mail|gmail|outlook|klaviyo|mailchimp/.test(host)) return { source: "email", host };
  if (/wa\.me|whatsapp/.test(host)) return { source: "whatsapp", host };
  return { source: "referral", host };
}

/** True when the table is missing - the migration has not been run yet. */
const missingTable = (message: string) => /relation .*site_events.* does not exist|could not find the table/i.test(message);

export async function recordSiteEvent(event: SiteEvent): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { error } = await getServerSupabase().from("site_events").insert({
      kind: event.kind,
      channel: event.channel,
      visitor_id: event.visitorId.slice(0, 64),
      session_id: event.sessionId.slice(0, 64),
      path: event.path?.slice(0, 300) ?? null,
      source: event.source?.slice(0, 40) ?? null,
      referrer_host: event.referrerHost?.slice(0, 120) ?? null,
      platform: event.platform ?? null,
      app_version: event.appVersion?.slice(0, 40) ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type Row = {
  created_at: string;
  kind: string;
  channel: string;
  visitor_id: string;
  session_id: string;
  path: string | null;
  source: string | null;
  platform: string | null;
};

export type Report = {
  /** False when the table is not there yet, so the page can say what to run. */
  ready: boolean;
  error?: string;
  days: number;
  /** One entry per day, oldest first. */
  series: { day: string; visits: number; views: number }[];
  visits: number;
  views: number;
  visitors: number;
  /** Share of visits that saw exactly one page. */
  bounceRate: number;
  viewsPerVisit: number;
  previous: { visits: number; views: number; visitors: number; bounceRate: number };
  sources: { name: string; visits: number }[];
  pages: { path: string; views: number; visitors: number }[];
  platforms: { name: string; sessions: number }[];
  /** Daily active visitors and the 30-day rolling active count. */
  dau: number;
  mau: number;
  /** Visitors from the first half of the window who came back in the second. */
  retention: number | null;
};

const dayOf = (iso: string) => iso.slice(0, 10);

function emptyReport(days: number, error?: string): Report {
  return {
    ready: false,
    error,
    days,
    series: [],
    visits: 0,
    views: 0,
    visitors: 0,
    bounceRate: 0,
    viewsPerVisit: 0,
    previous: { visits: 0, views: 0, visitors: 0, bounceRate: 0 },
    sources: [],
    pages: [],
    platforms: [],
    dau: 0,
    mau: 0,
    retention: null,
  };
}

/**
 * Everything both analytics pages need, in one pass over the window and the
 * window before it (so "up 12%" means up on the same length of time).
 */
export async function report(channel: Channel, days = 30): Promise<Report> {
  if (!isSupabaseConfigured()) return emptyReport(days, "not_configured");
  const since = new Date(Date.now() - days * 2 * 86400000).toISOString();

  try {
    const { data, error } = await getServerSupabase()
      .from("site_events")
      .select("created_at,kind,channel,visitor_id,session_id,path,source,platform")
      .eq("channel", channel)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50000);
    if (error) {
      return emptyReport(days, missingTable(error.message) ? "no_table" : error.message);
    }

    const rows = (data ?? []) as Row[];
    const cut = Date.now() - days * 86400000;
    const now = rows.filter((r) => new Date(r.created_at).getTime() >= cut);
    const before = rows.filter((r) => new Date(r.created_at).getTime() < cut);

    const count = (list: Row[]) => {
      const sessions = new Map<string, number>();
      const visitors = new Set<string>();
      let views = 0;
      for (const r of list) {
        visitors.add(r.visitor_id);
        if (r.kind === "pageview") {
          views++;
          sessions.set(r.session_id, (sessions.get(r.session_id) ?? 0) + 1);
        } else if (!sessions.has(r.session_id)) {
          sessions.set(r.session_id, 0);
        }
      }
      const visits = sessions.size;
      const single = [...sessions.values()].filter((n) => n <= 1).length;
      return {
        visits,
        views,
        visitors: visitors.size,
        bounceRate: visits ? Math.round((single / visits) * 100) : 0,
      };
    };

    const totals = count(now);
    const prev = count(before);

    // Per day: visits (distinct sessions) and views.
    const byDay = new Map<string, { sessions: Set<string>; views: number }>();
    for (let i = days - 1; i >= 0; i--) {
      byDay.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), { sessions: new Set(), views: 0 });
    }
    for (const r of now) {
      const slot = byDay.get(dayOf(r.created_at));
      if (!slot) continue;
      slot.sessions.add(r.session_id);
      if (r.kind === "pageview") slot.views++;
    }

    const tally = <T extends string>(list: Row[], pick: (r: Row) => T | null) => {
      const m = new Map<T, number>();
      const seen = new Set<string>();
      for (const r of list) {
        const key = pick(r);
        if (!key) continue;
        // Sources and platforms belong to a visit, not to every page of it.
        const once = key + "·" + r.session_id;
        if (seen.has(once)) continue;
        seen.add(once);
        m.set(key, (m.get(key) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    const pageMap = new Map<string, { views: number; visitors: Set<string> }>();
    for (const r of now) {
      if (r.kind !== "pageview" || !r.path) continue;
      const slot = pageMap.get(r.path) ?? { views: 0, visitors: new Set<string>() };
      slot.views++;
      slot.visitors.add(r.visitor_id);
      pageMap.set(r.path, slot);
    }

    // Active visitors today, and across the last 30 days.
    const today = new Date().toISOString().slice(0, 10);
    const dau = new Set(now.filter((r) => dayOf(r.created_at) === today).map((r) => r.visitor_id)).size;
    const monthCut = Date.now() - 30 * 86400000;
    const mau = new Set(
      rows.filter((r) => new Date(r.created_at).getTime() >= monthCut).map((r) => r.visitor_id),
    ).size;

    // Retention: of the visitors first seen in the older half of the window,
    // how many came back in the newer half.
    const half = Date.now() - (days / 2) * 86400000;
    const early = new Set(now.filter((r) => new Date(r.created_at).getTime() < half).map((r) => r.visitor_id));
    const late = new Set(now.filter((r) => new Date(r.created_at).getTime() >= half).map((r) => r.visitor_id));
    const returned = [...early].filter((v) => late.has(v)).length;

    return {
      ready: true,
      days,
      series: [...byDay.entries()].map(([day, v]) => ({ day, visits: v.sessions.size, views: v.views })),
      visits: totals.visits,
      views: totals.views,
      visitors: totals.visitors,
      bounceRate: totals.bounceRate,
      viewsPerVisit: totals.visits ? Math.round((totals.views / totals.visits) * 10) / 10 : 0,
      previous: prev,
      sources: tally(now, (r) => r.source ?? "direct").map(([name, visits]) => ({ name, visits })),
      pages: [...pageMap.entries()]
        .map(([path, v]) => ({ path, views: v.views, visitors: v.visitors.size }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20),
      platforms: tally(now, (r) => r.platform ?? null).map(([name, sessions]) => ({ name, sessions })),
      dau,
      mau,
      retention: early.size ? Math.round((returned / early.size) * 100) : null,
    };
  } catch (e) {
    return emptyReport(days, (e as Error).message);
  }
}

/** How much this window is up or down on the one before it. */
export function delta(now: number, before: number): number | undefined {
  if (!before) return undefined;
  return Math.round(((now - before) / before) * 100);
}
