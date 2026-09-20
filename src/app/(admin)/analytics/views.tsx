"use client";

import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { KpiCard, Panel, ChartFrame, chartAxis, NotConnected } from "@/components/analytics-ui";
import { DataTable, type Column } from "@/components/data-table";
import { CHART, useIsDark, type ChartColor } from "@/lib/chart-theme";
import type { Report } from "@/lib/analytics";

/**
 * The two analytics pages.
 *
 * Both read the shop's own counting - see lib/analytics.ts - so a figure here
 * is a figure this store measured. Metrics nothing measures yet (installs from
 * the stores, crash reports) say where they would come from instead of showing
 * a number, because an invented KPI is worse than an empty one.
 */

const pct = (v: number) => `${v}%`;

function Missing({ report }: { report: Report }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (report.ready) return null;
  const needsTable = report.error === "no_table";
  return (
    <div className="card mb-4 border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-500/10">
      <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        {needsTable
          ? ar ? "التتبّع لم يبدأ بعد" : "Counting hasn't started yet"
          : ar ? "تعذّر قراءة البيانات" : "Couldn't read the figures"}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
        {needsTable
          ? ar
            ? "شغّلي 0033_site_events.sql في Supabase مرة واحدة، وستبدأ الزيارات في الظهور هنا فوراً."
            : "Run 0033_site_events.sql in Supabase once. Visits start appearing here straight away — nothing else to set up."
          : report.error}
      </p>
    </div>
  );
}

function Trend({ report, label }: { report: Report; label: string }) {
  const { lang } = useI18n();
  const dark = useIsDark();
  const c = (k: ChartColor) => CHART[k][dark ? "dark" : "light"];
  const data = report.series.map((d) => ({
    label: new Date(d.day).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }),
    visits: d.visits,
    views: d.views,
  }));
  return (
    <Panel title={label} className="lg:col-span-2">
      <ChartFrame empty={!report.visits}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(148,148,168,0.16)" />
            <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...chartAxis} width={44} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "rgba(148,148,168,0.3)" }}
              content={({ active, payload, label: l }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs">
                    <div className="font-semibold text-ink">{l}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="mt-0.5 text-ink-muted">
                        {String(p.dataKey)}: {num(Number(p.value), lang)}
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            <Area type="monotone" dataKey="views" stroke={c("blue")} strokeWidth={1.5} fill={c("blue")} fillOpacity={0.06} />
            <Area type="monotone" dataKey="visits" stroke={c("violet")} strokeWidth={2} fill={c("violet")} fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Panel>
  );
}

/** A bar per row, biggest first: sources, platforms, anything small and ranked. */
function RankedBars({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: { name: string; value: number }[];
  unit: string;
  empty: string;
}) {
  const { lang } = useI18n();
  const dark = useIsDark();
  const c = (k: ChartColor) => CHART[k][dark ? "dark" : "light"];
  const palette: ChartColor[] = ["violet", "blue", "green", "orange"];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-soft">{empty}</p>
      ) : (
        <>
          <ChartFrame height="h-40" empty={false}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={86} {...chartAxis} />
                <Tooltip
                  cursor={{ fill: "rgba(148,148,168,0.08)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink">
                        {num(Number(payload[0].value), lang)} {unit}
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={c(palette[i % palette.length])} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ul className="border-t border-line px-4 py-2">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between py-1 text-sm">
                <span className="capitalize text-ink">{r.name}</span>
                <span className="text-ink-muted">
                  {num(r.value, lang)} · {total ? Math.round((r.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ============================================================== website ====
export function WebsiteAnalytics({ report }: { report: Report }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const period = ar ? `آخر ${report.days} يوماً` : `Last ${report.days} days`;
  const d = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : undefined);

  const pages: Column<Report["pages"][number]>[] = [
    { key: "path", header: ar ? "الصفحة" : "Page", rank: "title", cell: (r) => <span className="font-mono text-[13px]">{r.path}</span> },
    { key: "views", header: ar ? "مشاهدات" : "Views", rank: "primary", align: "end", cell: (r) => num(r.views, lang) },
    { key: "visitors", header: ar ? "زوّار" : "Visitors", rank: "primary", align: "end", cell: (r) => num(r.visitors, lang) },
    {
      key: "share",
      header: ar ? "النسبة" : "Share",
      rank: "secondary",
      align: "end",
      cell: (r) => pct(report.views ? Math.round((r.views / report.views) * 100) : 0),
    },
  ];

  return (
    <>
      <PageHeader
        title={ar ? "تحليلات الموقع" : "Website analytics"}
        subtitle={`${period} · ${ar ? "من تتبّع المتجر نفسه" : "counted by your own store"}`}
        actions={
          <Link href="/analytics/app" className="btn-outline h-10">
            {ar ? "تحليلات التطبيق" : "App analytics"}
          </Link>
        }
      />
      <Missing report={report} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label={ar ? "الزيارات" : "Total visits"} value={num(report.visits, lang)} delta={d(report.visits, report.previous.visits)} note={period} />
        <KpiCard label={ar ? "مشاهدات الصفحات" : "Pageviews"} value={num(report.views, lang)} delta={d(report.views, report.previous.views)} note={period} />
        <KpiCard label={ar ? "معدّل المغادرة" : "Bounce rate"} value={pct(report.bounceRate)} note={ar ? "زيارة بصفحة واحدة" : "one-page visits"} />
        <KpiCard label={ar ? "صفحات لكل زيارة" : "Pages per visit"} value={String(report.viewsPerVisit)} note={`${num(report.visitors, lang)} ${ar ? "زائراً" : "visitors"}`} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Trend report={report} label={ar ? "الزيارات والمشاهدات" : "Visits and pageviews"} />
        <RankedBars
          title={ar ? "مصادر الزيارات" : "Traffic sources"}
          rows={report.sources.map((s) => ({ name: s.name, value: s.visits }))}
          unit={ar ? "زيارة" : "visits"}
          empty={ar ? "لا زيارات بعد." : "No visits yet."}
        />
      </div>

      <div className="mt-3">
        <h2 className="section-title mb-2">{ar ? "أكثر الصفحات زيارة" : "Top pages"}</h2>
        <DataTable
          rows={report.pages}
          columns={pages}
          getKey={(r) => r.path}
          empty={ar ? "لا مشاهدات بعد." : "No pageviews yet."}
        />
      </div>
    </>
  );
}

// ================================================================== app ====
export function AppAnalytics({
  report,
  appOrders,
  webOrders,
}: {
  report: Report;
  appOrders: number;
  webOrders: number;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const period = ar ? `آخر ${report.days} يوماً` : `Last ${report.days} days`;
  const d = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : undefined);
  const stickiness = report.mau ? Math.round((report.dau / report.mau) * 100) : 0;

  const screens: Column<Report["pages"][number]>[] = [
    { key: "path", header: ar ? "الشاشة" : "Screen", rank: "title", cell: (r) => <span className="font-mono text-[13px]">{r.path}</span> },
    { key: "views", header: ar ? "مرات الفتح" : "Opens", rank: "primary", align: "end", cell: (r) => num(r.views, lang) },
    { key: "visitors", header: ar ? "أجهزة" : "Devices", rank: "primary", align: "end", cell: (r) => num(r.visitors, lang) },
  ];

  return (
    <>
      <PageHeader
        title={ar ? "تحليلات التطبيق" : "App analytics"}
        subtitle={`${period} · ${ar ? "من تتبّع التطبيق نفسه" : "counted by the app itself"}`}
        actions={
          <Link href="/analytics/website" className="btn-outline h-10">
            {ar ? "تحليلات الموقع" : "Website analytics"}
          </Link>
        }
      />
      <Missing report={report} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="DAU" value={num(report.dau, lang)} note={ar ? "أجهزة نشطة اليوم" : "active devices today"} />
        <KpiCard label="MAU" value={num(report.mau, lang)} note={ar ? "خلال ٣٠ يوماً" : "in the last 30 days"} />
        <KpiCard
          label={ar ? "معدّل العودة" : "Retention"}
          value={report.retention == null ? "—" : pct(report.retention)}
          note={ar ? "عادوا في النصف الثاني من الفترة" : "came back in the second half"}
        />
        <KpiCard label={ar ? "الجلسات" : "Sessions"} value={num(report.visits, lang)} delta={d(report.visits, report.previous.visits)} note={period} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Trend report={report} label={ar ? "الجلسات والشاشات" : "Sessions and screens"} />
        <RankedBars
          title={ar ? "iOS مقابل Android" : "iOS vs Android"}
          rows={report.platforms.map((p) => ({ name: p.name, value: p.sessions }))}
          unit={ar ? "جلسة" : "sessions"}
          empty={ar ? "لا جلسات من التطبيق بعد." : "No app sessions yet."}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <KpiCard
          label={ar ? "التصاق (DAU/MAU)" : "Stickiness (DAU/MAU)"}
          value={pct(stickiness)}
          note={ar ? "كم يوماً في الشهر يُفتح التطبيق" : "how often the app is opened"}
        />
        <KpiCard
          label={ar ? "طلبات التطبيق" : "Orders from the app"}
          value={num(appOrders, lang)}
          note={`${ar ? "مقابل" : "vs"} ${num(webOrders, lang)} ${ar ? "من الموقع" : "from the website"}`}
        />
        <KpiCard
          label={ar ? "التحويل" : "Session to order"}
          value={report.visits ? pct(Math.round((appOrders / report.visits) * 100)) : "—"}
          note={ar ? "طلبات لكل جلسة" : "orders per session"}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <NotConnected
          what={ar ? "التنزيلات والتثبيتات" : "Installs and downloads"}
          how={
            ar
              ? "تُقاس من App Store Connect وGoogle Play Console بعد نشر التطبيق. لا يستطيع أي تتبّع داخل التطبيق رؤية التثبيتات، فلن نخترع رقماً."
              : "These come from App Store Connect and Google Play once the app is published — no in-app tracking can see an install, so no number is invented here."
          }
        />
        <NotConnected
          what={ar ? "معدّل الأعطال" : "Crash rate"}
          how={
            ar
              ? "يحتاج مُبلّغاً عن الأعطال (مثل Sentry أو Firebase Crashlytics) داخل تطبيق الهاتف. أخبريني عندما تختارين واحداً وسأوصله بهذه الصفحة."
              : "Needs a crash reporter (Sentry or Firebase Crashlytics) inside the phone app. Tell me which you want and I'll wire it into this page."
          }
        />
      </div>

      <div className="mt-3">
        <h2 className="section-title mb-2">{ar ? "أكثر الشاشات فتحاً" : "Most opened screens"}</h2>
        <DataTable
          rows={report.pages}
          columns={screens}
          getKey={(r) => r.path}
          empty={ar ? "لا جلسات بعد." : "No sessions yet."}
        />
      </div>
    </>
  );
}
