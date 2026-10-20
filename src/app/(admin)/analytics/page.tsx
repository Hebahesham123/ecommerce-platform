"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n, num, egp } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { KpiCard, Panel, ChartFrame, chartAxis } from "@/components/analytics-ui";
import { CHART, useIsDark } from "@/lib/chart-theme";
import type { Breakdowns, Live, Overview, ProductRow, Slice } from "@/lib/analytics-reports";
import { breakdownsAction, liveAction, overviewAction, productsAction } from "./report-actions";

/**
 * Analytics: the shop's figures the way a shop owner reads them — what sold,
 * how many came, from where, how far they got, and which of them bought.
 *
 * Every number is counted from the shop's own records: visits from the
 * storefront's and the app's own beacons, sales from the orders. Where a visit
 * came from is read from the page it came from, the campaign tags and ad click
 * id it arrived with, and the in-app browser of the social app it was opened
 * in; an order is credited to the visit that bought, or to the last visit
 * before it that did not come straight in (an Instagram ad that brought her,
 * even if she typed the address to come back and buy).
 */

type Preset = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "custom";

const PRESETS: { key: Preset; en: string; ar: string }[] = [
  { key: "today", en: "Today", ar: "اليوم" },
  { key: "yesterday", en: "Yesterday", ar: "أمس" },
  { key: "7d", en: "Last 7 days", ar: "آخر ٧ أيام" },
  { key: "30d", en: "Last 30 days", ar: "آخر ٣٠ يوماً" },
  { key: "90d", en: "Last 90 days", ar: "آخر ٩٠ يوماً" },
  { key: "month", en: "This month", ar: "هذا الشهر" },
  { key: "custom", en: "Custom", ar: "مخصص" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rangeOf(p: Preset, custom: { from: string; to: string }): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  switch (p) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "yesterday":
      return { from: addDays(today, -1), to: today };
    case "7d":
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case "90d":
      return { from: addDays(today, -89), to: addDays(today, 1) };
    case "month":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
    case "custom": {
      const f = custom.from ? new Date(custom.from + "T00:00:00") : addDays(today, -29);
      const t = custom.to ? addDays(new Date(custom.to + "T00:00:00"), 1) : addDays(today, 1);
      return t > f ? { from: f, to: t } : { from: f, to: addDays(f, 1) };
    }
    default:
      return { from: addDays(today, -29), to: addDays(today, 1) };
  }
}

const SOURCE: Record<string, { en: string; ar: string }> = {
  direct: { en: "Direct", ar: "مباشر" },
  search: { en: "Search", ar: "محركات البحث" },
  social: { en: "Social", ar: "السوشيال ميديا" },
  paid: { en: "Paid ads", ar: "إعلانات مدفوعة" },
  email: { en: "Email", ar: "البريد" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  referral: { en: "Other sites", ar: "مواقع أخرى" },
  sms: { en: "SMS", ar: "رسائل SMS" },
  "": { en: "Unknown", ar: "غير معروف" },
};

const NETWORK: Record<string, { name: string; color: string; ink?: string }> = {
  instagram: { name: "Instagram", color: "#E1306C" },
  facebook: { name: "Facebook", color: "#1877F2" },
  tiktok: { name: "TikTok", color: "#111111" },
  snapchat: { name: "Snapchat", color: "#FFFC00", ink: "#111" },
  google: { name: "Google", color: "#4285F4" },
  youtube: { name: "YouTube", color: "#FF0000" },
  whatsapp: { name: "WhatsApp", color: "#25D366" },
  x: { name: "X (Twitter)", color: "#111111" },
  pinterest: { name: "Pinterest", color: "#E60023" },
  linkedin: { name: "LinkedIn", color: "#0A66C2" },
  threads: { name: "Threads", color: "#111111" },
  telegram: { name: "Telegram", color: "#26A5E4" },
  bing: { name: "Bing", color: "#008373" },
};

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const pctText = (v: number, lang: "ar" | "en") => `${num(Math.round(v * 10) / 10, lang)}%`;
const delta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);

function NetworkBadge({ k }: { k: string }) {
  const n = NETWORK[k];
  if (!n) return <span className="text-ink">{k || "—"}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold" style={{ background: n.color, color: n.ink ?? "#fff" }}>
        {n.name[0]}
      </span>
      <span className="text-ink">{n.name}</span>
    </span>
  );
}

/** A ranked list with a bar behind each row: small, readable, no chart library needed. */
function BarList({ rows, format, empty }: { rows: { label: React.ReactNode; value: number; note?: string }[]; format: (n: number) => string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="px-4 pb-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-1.5 px-4 pb-4">
      {rows.map((r, i) => (
        <li key={i} className="relative overflow-hidden rounded-lg">
          <div className="absolute inset-y-0 start-0 rounded-lg bg-brand-50 dark:bg-brand-500/10" style={{ width: `${(r.value / max) * 100}%` }} />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink">
              {format(r.value)}
              {r.note && <span className="ms-1.5 text-xs text-ink-soft">{r.note}</span>}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Sessions joined to sales for the same keys: a row per source / network / campaign. */
function joinRows(sessions: Slice[], sales: Slice[]) {
  const keys = new Set([...sessions.map((s) => s.key), ...sales.map((s) => s.key)]);
  return [...keys]
    .map((key) => {
      const s = sessions.find((x) => x.key === key);
      const o = sales.find((x) => x.key === key);
      return { key, sessions: s?.sessions ?? 0, carts: s?.carts ?? 0, converted: s?.orders ?? 0, orders: o?.orders ?? 0, sales: o?.sales ?? 0 };
    })
    .sort((a, b) => b.sales - a.sales || b.sessions - a.sessions);
}

function Table({
  head,
  rows,
  empty,
}: {
  head: { label: string; end?: boolean }[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (!rows.length) return <p className="px-4 pb-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <div className="overflow-x-auto px-1 pb-2">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-soft">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${h.end ? "text-end" : "text-start"}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${head[j]?.end ? "text-end tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsOverviewPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dark = useIsDark();
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [channel, setChannel] = useState<"all" | "web" | "app">("all");
  const [data, setData] = useState<{ now: Overview; before: Overview } | null>(null);
  const [parts, setParts] = useState<Breakdowns | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeOf(preset, custom), [preset, custom]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = range.from.toISOString();
    const to = range.to.toISOString();
    const [o, b, p] = await Promise.all([overviewAction(from, to, channel), breakdownsAction(from, to, channel), productsAction(from, to, channel)]);
    setLoading(false);
    if (!o.ok) {
      setError(o.error);
      return;
    }
    setError(null);
    setData(o.data);
    setParts(b.ok ? b.data : null);
    setProducts(p.ok ? p.data : []);
  }, [range, channel]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: refreshed every 30 seconds while the page is open.
  useEffect(() => {
    let on = true;
    const tick = () => liveAction().then((r) => on && r.ok && setLive(r.data));
    tick();
    const t = setInterval(tick, 30000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  const now = data?.now;
  const before = data?.before;
  const money = (n: number) => egp(n, lang);
  const count = (n: number) => num(n, lang);
  const conv = now ? pct(now.converted, now.sessions) : 0;
  const convBefore = before ? pct(before.converted, before.sessions) : 0;
  const aov = now && now.orders ? now.sales / now.orders : 0;
  const aovBefore = before && before.orders ? before.sales / before.orders : 0;
  const retRate = now ? pct(now.returningOrders, now.orders) : 0;
  const retBefore = before ? pct(before.returningOrders, before.orders) : 0;

  const series = (now?.series ?? []).map((d) => ({
    label: new Date(d.day + "T00:00:00").toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }),
    sales: d.sales,
    sessions: d.sessions,
    orders: d.orders,
  }));
  const violet = CHART.violet[dark ? "dark" : "light"];
  const blue = CHART.blue[dark ? "dark" : "light"];

  const funnel = now
    ? [
        { label: ar ? "الزيارات" : "Sessions", value: now.sessions },
        { label: ar ? "شاهدت منتجاً" : "Viewed a product", value: now.withProductView },
        { label: ar ? "أضافت للسلة" : "Added to cart", value: now.addedToCart },
        { label: ar ? "وصلت للدفع" : "Reached checkout", value: now.reachedCheckout },
        { label: ar ? "اشترت" : "Purchased", value: now.converted },
      ]
    : [];

  const sourceRows = parts ? joinRows(parts.sessionsBy.source, parts.salesBy.source) : [];
  const networkRows = parts ? joinRows(parts.sessionsBy.network, parts.salesBy.network).filter((r) => r.key) : [];
  const campaignRows = parts ? joinRows(parts.sessionsBy.campaign, parts.salesBy.campaign).filter((r) => r.key) : [];
  const noData = ar ? "لا توجد بيانات في هذه الفترة بعد." : "No data for this period yet.";
  const label = (k: string) => (SOURCE[k] ? (ar ? SOURCE[k].ar : SOURCE[k].en) : k);

  const chartTooltip = (fmt: (n: number) => string) =>
    function Tip({ active, payload, label: l }: { active?: boolean; payload?: { value?: unknown }[]; label?: unknown }) {
      return active && payload?.length ? (
        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs">
          <div className="font-semibold text-ink">{String(l)}</div>
          <div className="mt-0.5 text-ink-muted">{fmt(Number(payload[0].value))}</div>
        </div>
      ) : null;
    };

  return (
    <>
      <PageHeader
        title={ar ? "التحليلات" : "Analytics"}
        subtitle={ar ? "المبيعات والزيارات ومصادرها، من الموقع والتطبيق" : "Sales, sessions and where they come from — website and app"}
      />

      {/* ---- period and channel ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                preset === p.key ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink"
              }`}
            >
              {ar ? p.ar : p.en}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" className="h-8 rounded-lg border border-line bg-surface px-2" value={custom.from || ymd(range.from)} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="text-ink-soft">→</span>
            <input type="date" className="h-8 rounded-lg border border-line bg-surface px-2" value={custom.to || ymd(addDays(range.to, -1))} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <div className="ms-auto flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(["all", "web", "app"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${channel === c ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink"}`}
            >
              {c === "all" ? (ar ? "الكل" : "All") : c === "web" ? (ar ? "الموقع" : "Website") : ar ? "التطبيق" : "App"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card mb-4 p-4 text-sm text-rose-600">
          {error === "migration_missing"
            ? ar
              ? "شغّلي ملف قاعدة البيانات 0058_analytics_sessions.sql في Supabase مرة واحدة، وستبدأ الزيارات الجديدة في الظهور هنا."
              : "Run the database file 0058_analytics_sessions.sql in Supabase once. New visits start appearing here straight away."
            : error}
        </div>
      )}

      {/* ---- live ---- */}
      <section className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {ar ? "الآن" : "Right now"}: {count(live?.visitors ?? 0)} {ar ? "زائر" : "visitors"}
        </span>
        <span className="text-ink-muted">{ar ? "الموقع" : "Website"} {count(live?.web ?? 0)} · {ar ? "التطبيق" : "App"} {count(live?.app ?? 0)}</span>
        <span className="text-ink-muted">{ar ? "في السلة" : "In cart"} {count(live?.carts ?? 0)}</span>
        <span className="text-ink-muted">{ar ? "في الدفع" : "At checkout"} {count(live?.checkouts ?? 0)}</span>
        <span className="text-ink-muted">{ar ? "اشتروا" : "Purchased"} {count(live?.ordered ?? 0)}</span>
        {live && live.sources.length > 0 && (
          <span className="text-ink-muted">
            {ar ? "من" : "From"}: {live.sources.slice(0, 4).map((s) => `${NETWORK[s.key]?.name ?? label(s.key)} ${count(s.sessions)}`).join(" · ")}
          </span>
        )}
        <span className="text-[11px] text-ink-soft">{ar ? "آخر ٥ دقائق، يتحدث كل ٣٠ ثانية" : "Last 5 minutes, refreshes every 30s"}</span>
      </section>

      {/* ---- the headline numbers ---- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard loading={loading && !now} label={ar ? "إجمالي المبيعات" : "Total sales"} value={money(now?.sales ?? 0)} delta={now && before ? delta(now.sales, before.sales) : undefined} />
        <KpiCard loading={loading && !now} label={ar ? "الطلبات" : "Orders"} value={count(now?.orders ?? 0)} delta={now && before ? delta(now.orders, before.orders) : undefined} />
        <KpiCard loading={loading && !now} label={ar ? "الزيارات" : "Sessions"} value={count(now?.sessions ?? 0)} delta={now && before ? delta(now.sessions, before.sessions) : undefined} />
        <KpiCard loading={loading && !now} label={ar ? "معدل التحويل" : "Conversion rate"} value={pctText(conv, lang)} delta={now && before ? delta(conv, convBefore) : undefined} />
        <KpiCard loading={loading && !now} label={ar ? "متوسط قيمة الطلب" : "Average order value"} value={money(aov)} delta={now && before ? delta(aov, aovBefore) : undefined} />
        <KpiCard loading={loading && !now} label={ar ? "عملاء عائدون" : "Returning customer rate"} value={pctText(retRate, lang)} delta={now && before ? delta(retRate, retBefore) : undefined} />
      </div>

      {/* ---- over time ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title={ar ? "المبيعات عبر الوقت" : "Sales over time"}>
          <ChartFrame empty={!now?.sales} emptyText={noData}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,148,168,0.16)" />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...chartAxis} width={56} />
                <Tooltip content={chartTooltip(money)} />
                <Area type="monotone" dataKey="sales" stroke={violet} strokeWidth={2} fill={violet} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
        <Panel title={ar ? "الزيارات عبر الوقت" : "Sessions over time"}>
          <ChartFrame empty={!now?.sessions} emptyText={noData}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,148,168,0.16)" />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...chartAxis} width={44} allowDecimals={false} />
                <Tooltip content={chartTooltip(count)} />
                <Area type="monotone" dataKey="sessions" stroke={blue} strokeWidth={2} fill={blue} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
      </div>

      {/* ---- funnel and customers ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title={ar ? "مسار التحويل" : "Conversion funnel"} className="lg:col-span-2">
          {!now?.sessions ? (
            <p className="px-4 pb-4 text-sm text-ink-soft">{noData}</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 px-4 pb-4">
              {funnel.map((f, i) => {
                const share = pct(f.value, funnel[0].value);
                const fromPrev = i ? pct(f.value, funnel[i - 1].value) : 100;
                return (
                  <div key={f.label} className="flex flex-col">
                    <div className="text-[11px] font-medium text-ink-soft">{f.label}</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-ink">{count(f.value)}</div>
                    <div className="mt-2 flex h-28 items-end rounded-lg bg-surface-hover">
                      <div className="w-full rounded-lg bg-brand-500/80" style={{ height: `${Math.max(2, share)}%` }} />
                    </div>
                    <div className="mt-1.5 text-xs tabular-nums text-ink">{pctText(share, lang)}</div>
                    {i > 0 && <div className="text-[11px] tabular-nums text-ink-soft">{ar ? "من السابقة" : "of previous"} {pctText(fromPrev, lang)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title={ar ? "الزوار والعملاء" : "Visitors & customers"}>
          <div className="space-y-3 px-4 pb-4 text-sm">
            {[
              [ar ? "زوار جدد" : "New visitors", now?.newVisitors ?? 0],
              [ar ? "زوار عائدون" : "Returning visitors", now?.returningVisitors ?? 0],
              [ar ? "مشاهدات الصفحات" : "Pageviews", now?.pageviews ?? 0],
              [ar ? "زيارات بصفحة واحدة" : "Bounced sessions", now?.bounced ?? 0],
              [ar ? "عملاء طلبوا" : "Customers who ordered", now?.customers ?? 0],
              [ar ? "طلبات من عملاء عائدين" : "Orders from returning customers", now?.returningOrders ?? 0],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between">
                <span className="text-ink-muted">{k}</span>
                <span className="font-semibold tabular-nums text-ink">{count(Number(v))}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ---- social ---- */}
      <Panel title={ar ? "السوشيال ميديا والمنصات" : "Social media & platforms"} className="mb-4">
        <Table
          empty={noData}
          head={[
            { label: ar ? "المنصة" : "Platform" },
            { label: ar ? "الزيارات" : "Sessions", end: true },
            { label: ar ? "أضافت للسلة" : "Added to cart", end: true },
            { label: ar ? "الطلبات" : "Orders", end: true },
            { label: ar ? "التحويل" : "Conversion", end: true },
            { label: ar ? "المبيعات" : "Sales", end: true },
          ]}
          rows={networkRows.map((r) => [
            <NetworkBadge key="n" k={r.key} />,
            count(r.sessions),
            count(r.carts),
            count(r.orders),
            pctText(pct(r.orders, r.sessions), lang),
            money(r.sales),
          ])}
        />
        <p className="px-4 pb-3 text-[11px] text-ink-soft">
          {ar
            ? "الطلب يُنسب للزيارة التي اشترت، أو لآخر زيارة قبلها جاءت من مصدر (مثلاً إعلان إنستجرام) حتى لو رجعت العميلة مباشرة لتشتري."
            : "An order is credited to the visit that bought — or, if she came straight back to buy, to the last visit before it that came from somewhere (e.g. an Instagram ad)."}
        </p>
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title={ar ? "حسب مصدر الزيارة" : "By traffic source"}>
          <Table
            empty={noData}
            head={[
              { label: ar ? "المصدر" : "Source" },
              { label: ar ? "الزيارات" : "Sessions", end: true },
              { label: ar ? "الطلبات" : "Orders", end: true },
              { label: ar ? "المبيعات" : "Sales", end: true },
            ]}
            rows={sourceRows.map((r) => [<span key="s" className="text-ink">{label(r.key)}</span>, count(r.sessions), count(r.orders), money(r.sales)])}
          />
        </Panel>
        <Panel title={ar ? "الحملات (UTM)" : "Campaigns (UTM)"}>
          <Table
            empty={ar ? "لا توجد زيارات بروابط حملات. أضيفي ?utm_campaign=اسم_الحملة لروابط إعلاناتك." : "No visits with campaign links yet. Add ?utm_campaign=name to your ad links."}
            head={[
              { label: ar ? "الحملة" : "Campaign" },
              { label: ar ? "الزيارات" : "Sessions", end: true },
              { label: ar ? "الطلبات" : "Orders", end: true },
              { label: ar ? "المبيعات" : "Sales", end: true },
            ]}
            rows={campaignRows.map((r) => [<span key="c" className="text-ink">{r.key}</span>, count(r.sessions), count(r.orders), money(r.sales)])}
          />
        </Panel>
      </div>

      {/* ---- pages and products ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title={ar ? "أهم صفحات الدخول" : "Top landing pages"}>
          <Table
            empty={noData}
            head={[
              { label: ar ? "الصفحة" : "Page" },
              { label: ar ? "الزيارات" : "Sessions", end: true },
              { label: ar ? "للسلة" : "To cart", end: true },
              { label: ar ? "التحويل" : "Conversion", end: true },
            ]}
            rows={(parts?.sessionsBy.landing ?? []).map((r) => [
              <span key="p" className="block max-w-[260px] truncate font-mono text-xs text-ink" dir="ltr">
                {r.key || "/"}
              </span>,
              count(r.sessions ?? 0),
              pctText(pct(r.carts ?? 0, r.sessions ?? 0), lang),
              pctText(pct(r.orders, r.sessions ?? 0), lang),
            ])}
          />
        </Panel>
        <Panel title={ar ? "أهم المنتجات" : "Top products"}>
          <Table
            empty={noData}
            head={[
              { label: ar ? "المنتج" : "Product" },
              { label: ar ? "مشاهدات" : "Views", end: true },
              { label: ar ? "للسلة" : "Added", end: true },
              { label: ar ? "بيعت" : "Sold", end: true },
              { label: ar ? "المبيعات" : "Sales", end: true },
            ]}
            rows={(products ?? []).map((p) => [
              <span key="n" className="flex items-center gap-2">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-md bg-surface-hover" />
                )}
                <span className="max-w-[200px] truncate text-ink">{p.name}</span>
              </span>,
              count(p.views),
              count(p.adds),
              count(p.units),
              money(p.sales),
            ])}
          />
        </Panel>
      </div>

      {/* ---- devices and places ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title={ar ? "الأجهزة" : "Devices"}>
          <BarList
            empty={noData}
            format={count}
            rows={(parts?.sessionsBy.device ?? []).map((r) => ({
              label: r.key === "mobile" ? (ar ? "موبايل" : "Mobile") : r.key === "tablet" ? (ar ? "تابلت" : "Tablet") : r.key === "desktop" ? (ar ? "كمبيوتر" : "Desktop") : r.key || "—",
              value: r.sessions ?? 0,
              note: pctText(pct(r.sessions ?? 0, now?.sessions ?? 0), lang),
            }))}
          />
        </Panel>
        <Panel title={ar ? "المتصفحات" : "Browsers"}>
          <BarList empty={noData} format={count} rows={(parts?.sessionsBy.browser ?? []).slice(0, 8).map((r) => ({ label: r.key || "—", value: r.sessions ?? 0 }))} />
        </Panel>
        <Panel title={ar ? "أنظمة التشغيل" : "Operating systems"}>
          <BarList empty={noData} format={count} rows={(parts?.sessionsBy.os ?? []).slice(0, 8).map((r) => ({ label: r.key || "—", value: r.sessions ?? 0 }))} />
        </Panel>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title={ar ? "الزيارات حسب المدينة" : "Sessions by city"}>
          <BarList empty={noData} format={count} rows={(parts?.sessionsBy.city ?? []).slice(0, 10).map((r) => ({ label: r.key || (ar ? "غير معروف" : "Unknown"), value: r.sessions ?? 0 }))} />
        </Panel>
        <Panel title={ar ? "المبيعات حسب المدينة" : "Sales by city"}>
          <BarList empty={noData} format={money} rows={(parts?.salesBy.city ?? []).slice(0, 10).map((r) => ({ label: r.key || (ar ? "غير معروف" : "Unknown"), value: r.sales, note: `${count(r.orders)} ${ar ? "طلب" : "orders"}` }))} />
        </Panel>
        <Panel title={ar ? "مواقع أرسلت زيارات" : "Referring sites"}>
          <BarList empty={noData} format={count} rows={(parts?.sessionsBy.referrer ?? []).filter((r) => r.key).slice(0, 10).map((r) => ({ label: <span dir="ltr">{r.key}</span>, value: r.sessions ?? 0 }))} />
        </Panel>
      </div>

      <Panel title={ar ? "المبيعات حسب القناة" : "Sales by channel"} className="mb-4">
        <BarList
          empty={noData}
          format={money}
          rows={(parts?.salesBy.channel ?? []).map((r) => ({
            label: r.key === "app" ? (ar ? "التطبيق" : "App") : ar ? "الموقع" : "Website",
            value: r.sales,
            note: `${count(r.orders)} ${ar ? "طلب" : "orders"}`,
          }))}
        />
      </Panel>
    </>
  );
}
