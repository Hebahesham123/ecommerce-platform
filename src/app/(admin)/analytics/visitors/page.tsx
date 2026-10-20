"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { duration, sourceText } from "@/components/journey-view";
import type { VisitorRow } from "@/lib/analytics-reports";
import { visitorsAction } from "../report-actions";

/**
 * Everyone who came: known customers and anonymous visitors alike, each with
 * where they first came from, the page they first landed on, and how much
 * they did. A row opens the visitor's whole journey.
 */

const PERIODS = [
  { days: 1, en: "Today", ar: "اليوم" },
  { days: 7, en: "7 days", ar: "٧ أيام" },
  { days: 30, en: "30 days", ar: "٣٠ يوماً" },
  { days: 90, en: "90 days", ar: "٩٠ يوماً" },
];

export default function VisitorsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [days, setDays] = useState(7);
  const [who, setWho] = useState<"all" | "known" | "anonymous">("all");
  const [channel, setChannel] = useState<"all" | "web" | "app">("all");
  const [search, setSearch] = useState("");
  const [typed, setTyped] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; rows: VisitorRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The search box asks once she stops typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 350);
    return () => clearTimeout(t);
  }, [typed]);
  useEffect(() => setPage(0), [days, who, channel, search]);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (days - 1));
    return { from: from.toISOString(), to: new Date(to.getTime() + 60_000).toISOString() };
  }, [days]);

  useEffect(() => {
    let live = true;
    visitorsAction({ ...range, channel, who, search, page }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else {
        setData({ total: 0, rows: [] });
        setError(r.error);
      }
    });
    return () => {
      live = false;
    };
  }, [range, channel, who, search, page]);

  const seg = (on: boolean) => `rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${on ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink"}`;
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <>
      <PageHeader
        title={ar ? "الزوار" : "Visitors"}
        subtitle={ar ? "كل زائر: من أين جاء، أول صفحة دخلها، وكل ما فعله" : "Every visitor: where they came from, the page they landed on, and everything they did"}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <button key={p.days} className={seg(days === p.days)} onClick={() => setDays(p.days)}>
              {ar ? p.ar : p.en}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(["all", "known", "anonymous"] as const).map((w) => (
            <button key={w} className={seg(who === w)} onClick={() => setWho(w)}>
              {w === "all" ? (ar ? "الكل" : "All") : w === "known" ? (ar ? "عملاء معروفون" : "Known customers") : ar ? "مجهولون" : "Anonymous"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(["all", "web", "app"] as const).map((c) => (
            <button key={c} className={seg(channel === c)} onClick={() => setChannel(c)}>
              {c === "all" ? (ar ? "الكل" : "All") : c === "web" ? (ar ? "الموقع" : "Website") : ar ? "التطبيق" : "App"}
            </button>
          ))}
        </div>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={ar ? "بحث: هاتف، رقم زائر، صفحة، مدينة…" : "Search: phone, visitor id, page, city…"}
          className="h-9 min-w-[220px] flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand-600"
        />
      </div>

      {error && (
        <div className="card mb-4 p-4 text-sm text-rose-600">
          {error === "migration_missing"
            ? ar
              ? "شغّلي ملف قاعدة البيانات 0059_visitor_journey.sql في Supabase (بعد 0058) ثم حدّثي الصفحة."
              : "Run the database file 0059_visitor_journey.sql in Supabase (after 0058), then refresh this page."
            : error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 text-start font-semibold">{ar ? "الزائر" : "Visitor"}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{ar ? "جاء أول مرة من" : "First came from"}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{ar ? "أول صفحة" : "First landing page"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "زيارات" : "Visits"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "صفحات" : "Pages"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "الوقت" : "Time"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "بحث" : "Searches"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "ضغطات" : "Clicks"}</th>
              <th className="px-3 py-2.5 text-end font-semibold">{ar ? "طلبات" : "Orders"}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{ar ? "آخر ظهور" : "Last seen"}</th>
            </tr>
          </thead>
          <tbody>
            {data === null ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-ink-soft">
                  {ar ? "جارٍ التحميل…" : "Loading…"}
                </td>
              </tr>
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-ink-soft">
                  {ar ? "لا يوجد زوار في هذه الفترة." : "No visitors in this period."}
                </td>
              </tr>
            ) : (
              data.rows.map((v) => (
                <tr key={v.visitor_id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-3 py-2">
                    <Link href={`/analytics/visitors/${encodeURIComponent(v.visitor_id)}`} className="block">
                      <span className="block font-medium text-ink">{v.name || (v.phone ? <span dir="ltr">{v.phone}</span> : ar ? "زائر مجهول" : "Anonymous visitor")}</span>
                      <span className="block font-mono text-[11px] text-ink-soft" dir="ltr">
                        {v.visitor_id.slice(0, 14)} · {v.channel === "app" ? "app" : "web"}
                        {v.device ? ` · ${v.device}` : ""}
                        {v.city ? ` · ${v.city}` : ""}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {sourceText(v.first_source, v.first_network, ar)}
                    {v.first_utm_campaign && <span className="block text-[11px] text-ink-soft">{v.first_utm_campaign}</span>}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-ink-muted" dir="ltr">
                    {v.first_landing}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{num(v.sessions, lang)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{num(v.pageviews, lang)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{duration(v.seconds, ar)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{num(v.searches, lang)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{num(v.clicks, lang)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{v.orders ? num(v.orders, lang) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-ink-muted">
                    {new Date(v.last_seen).toLocaleString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 50 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
          <span>
            {num(data.total, lang)} {ar ? "زائر" : "visitors"}
          </span>
          <div className="flex items-center gap-2">
            <button className="btn-outline h-8 px-3 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {ar ? "السابق" : "Previous"}
            </button>
            <span>
              {num(page + 1, lang)} / {num(pages, lang)}
            </span>
            <button className="btn-outline h-8 px-3 text-xs" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              {ar ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
