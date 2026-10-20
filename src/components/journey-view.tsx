"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, num, egp } from "@/lib/i18n";
import type { Journey } from "@/lib/analytics-reports";

/**
 * A visitor's journey — or a customer's, across every browser and phone she
 * used: who she is, where she first came from and which page she landed on,
 * every visit, every page with the time she actually looked at it, what she
 * searched for, and what she pressed (the presses that matter marked).
 */

const SOURCE: Record<string, { en: string; ar: string }> = {
  direct: { en: "Direct", ar: "مباشر" },
  search: { en: "Search", ar: "بحث" },
  social: { en: "Social", ar: "سوشيال" },
  paid: { en: "Paid ad", ar: "إعلان مدفوع" },
  email: { en: "Email", ar: "بريد" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  referral: { en: "Other site", ar: "موقع آخر" },
  sms: { en: "SMS", ar: "SMS" },
};
const NETWORK: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  x: "X",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  threads: "Threads",
  telegram: "Telegram",
  bing: "Bing",
};

export function sourceText(source: string | null | undefined, network: string | null | undefined, ar: boolean): string {
  const s = source ? (SOURCE[source] ? (ar ? SOURCE[source].ar : SOURCE[source].en) : source) : ar ? "غير معروف" : "Unknown";
  const n = network ? NETWORK[network] ?? network : "";
  return n ? `${n} · ${s}` : s;
}

export function duration(seconds: number, ar: boolean): string {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return ar ? `${s} ث` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return ar ? `${m} د ${s % 60} ث` : `${m}m ${s % 60}s`;
  return ar ? `${Math.floor(m / 60)} س ${m % 60} د` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function when(iso: string, ar: boolean) {
  return new Date(iso).toLocaleString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-ink-muted">{k}</span>
      <span className="min-w-0 break-words text-end text-ink">{v ?? "—"}</span>
    </div>
  );
}

export function JourneyView({ journey, showCustomerLink = true }: { journey: Journey; showCustomerLink?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [tab, setTab] = useState<"pages" | "searches" | "clicks" | "sessions">("pages");
  const [onlyImportant, setOnlyImportant] = useState(false);

  const first = useMemo(() => [...journey.visitors].sort((a, b) => a.first_seen.localeCompare(b.first_seen))[0], [journey.visitors]);
  const latest = useMemo(() => [...journey.visitors].sort((a, b) => b.last_seen.localeCompare(a.last_seen))[0], [journey.visitors]);
  const totals = journey.visitors.reduce(
    (t, v) => ({
      sessions: t.sessions + v.sessions,
      pageviews: t.pageviews + v.pageviews,
      seconds: t.seconds + v.seconds,
      searches: t.searches + v.searches,
      clicks: t.clicks + v.clicks,
    }),
    { sessions: 0, pageviews: 0, seconds: 0, searches: 0, clicks: 0 },
  );
  const phone = journey.visitors.find((v) => v.phone)?.phone ?? null;
  const importantClicks = journey.clicks.filter((c) => c.important).length;
  const orders = journey.sessions.filter((s) => s.ordered);

  if (!first) {
    return (
      <p className="text-sm text-ink-soft">
        {ar ? "لا توجد زيارات مسجلة لهذا العميل بعد — ستظهر رحلته من أول زيارة قادمة." : "No visits recorded for this person yet — their journey starts showing from their next visit."}
      </p>
    );
  }

  const tabs: { key: typeof tab; label: string; n: number }[] = [
    { key: "pages", label: ar ? "الصفحات" : "Pages", n: journey.pages.length },
    { key: "searches", label: ar ? "عمليات البحث" : "Searches", n: journey.searches.length },
    { key: "clicks", label: ar ? "الضغطات" : "Clicks", n: journey.clicks.length },
    { key: "sessions", label: ar ? "الزيارات" : "Visits", n: journey.sessions.length },
  ];

  return (
    <div className="space-y-4">
      {/* ---- who and where from ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <div className="kpi-label">{ar ? "المعرّف" : "Identifier"}</div>
          <Row k={ar ? "رقم الزائر" : "Visitor id"} v={<span className="font-mono text-xs" dir="ltr">{journey.visitors.map((v) => v.visitor_id).join(", ")}</span>} />
          <Row
            k={ar ? "الهاتف" : "Phone"}
            v={
              phone ? (
                showCustomerLink ? (
                  <Link className="text-brand-700 hover:underline" dir="ltr" href={`/customers/${encodeURIComponent(phone)}`}>
                    {phone}
                  </Link>
                ) : (
                  <span dir="ltr">{phone}</span>
                )
              ) : ar ? (
                "مجهول (لم يسجل دخول أو يطلب بعد)"
              ) : (
                "Anonymous (hasn't signed in or ordered yet)"
              )
            }
          />
          <Row k={ar ? "أول زيارة" : "First seen"} v={when(first.first_seen, ar)} />
          <Row k={ar ? "آخر زيارة" : "Last seen"} v={when(latest.last_seen, ar)} />
          <Row k={ar ? "القناة" : "Channel"} v={journey.visitors.map((v) => (v.channel === "app" ? (ar ? "التطبيق" : "App") : ar ? "الموقع" : "Website")).join(" + ")} />
          <Row k={ar ? "الجهاز" : "Device"} v={[latest.device, latest.os, latest.browser].filter(Boolean).join(" · ")} />
          <Row k={ar ? "الموقع" : "Location"} v={[latest.city, latest.region, latest.country].filter(Boolean).join(", ")} />
        </div>

        <div className="card p-4">
          <div className="kpi-label">{ar ? "من أين جاء أول مرة" : "Where they first came from"}</div>
          <Row k={ar ? "المصدر" : "Source"} v={sourceText(first.first_source, first.first_network, ar)} />
          <Row k={ar ? "صفحة الدخول الأولى" : "First landing page"} v={<span className="font-mono text-xs" dir="ltr">{first.first_landing ?? "—"}</span>} />
          <Row k={ar ? "الموقع المُحيل" : "Referring site"} v={first.first_referrer ? <span dir="ltr">{first.first_referrer}</span> : "—"} />
          <Row k={ar ? "الحملة" : "Campaign"} v={first.first_utm_campaign || "—"} />
          <Row k="UTM source / medium" v={[first.first_utm_source, first.first_utm_medium].filter(Boolean).join(" / ") || "—"} />
          <Row k={ar ? "نقرة إعلان" : "Ad click"} v={first.first_click_id || "—"} />
          <div className="mt-2 border-t border-line pt-2">
            <Row k={ar ? "آخر مصدر" : "Latest source"} v={sourceText(latest.last_source, latest.last_network, ar)} />
            <Row k={ar ? "آخر حملة" : "Latest campaign"} v={latest.last_utm_campaign || "—"} />
          </div>
        </div>

        <div className="card p-4">
          <div className="kpi-label">{ar ? "النشاط" : "Activity"}</div>
          <Row k={ar ? "الزيارات" : "Visits"} v={num(totals.sessions, lang)} />
          <Row k={ar ? "الصفحات" : "Pages viewed"} v={num(totals.pageviews, lang)} />
          <Row k={ar ? "الوقت على الصفحات" : "Time on pages"} v={duration(totals.seconds, ar)} />
          <Row k={ar ? "عمليات البحث" : "Searches"} v={num(totals.searches, lang)} />
          <Row k={ar ? "الضغطات" : "Clicks"} v={`${num(totals.clicks, lang)}${importantClicks ? ` (${num(importantClicks, lang)} ${ar ? "مهمة" : "important"})` : ""}`} />
          <Row k={ar ? "طلبات من الزيارات" : "Orders from visits"} v={orders.length ? orders.map((o) => `#${o.order_number} ${egp(o.revenue, lang)}`).join(", ") : "—"} />
        </div>
      </div>

      {/* ---- the record ---- */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition ${
                tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label} <span className="text-xs text-ink-soft">{num(t.n, lang)}</span>
            </button>
          ))}
          {tab === "clicks" && (
            <label className="ms-auto flex items-center gap-1.5 pb-2 text-xs text-ink-muted">
              <input type="checkbox" checked={onlyImportant} onChange={(e) => setOnlyImportant(e.target.checked)} />
              {ar ? "المهمة فقط" : "Important only"}
            </label>
          )}
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {tab === "pages" &&
            (journey.pages.length ? (
              <ul className="divide-y divide-line">
                {journey.pages.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-28 shrink-0 text-xs text-ink-soft">{when(p.entered_at, ar)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{p.title || p.path}</span>
                      <span className="block truncate font-mono text-[11px] text-ink-soft" dir="ltr">
                        {p.channel === "app" ? "app · " : ""}
                        {p.path}
                      </span>
                    </span>
                    <span className="shrink-0 text-end tabular-nums">
                      <span className="block font-semibold text-ink">{p.seconds ? duration(p.seconds, ar) : "—"}</span>
                      {p.scroll > 0 && <span className="block text-[11px] text-ink-soft">{ar ? "تمرير" : "scrolled"} {num(p.scroll, lang)}%</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-ink-soft">{ar ? "لا توجد صفحات بعد." : "No pages yet."}</p>
            ))}

          {tab === "searches" &&
            (journey.searches.length ? (
              <ul className="divide-y divide-line">
                {journey.searches.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-28 shrink-0 text-xs text-ink-soft">{when(s.created_at, ar)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink" dir="auto">
                      “{s.term}”
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {s.results === null ? "" : s.results === 0 ? <span className="text-rose-600">{ar ? "بدون نتائج" : "no results"}</span> : `${num(s.results, lang)} ${ar ? "نتيجة" : "results"}`}
                      <span className="ms-2 text-ink-soft">{s.channel === "app" ? (ar ? "التطبيق" : "app") : ar ? "الموقع" : "web"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-ink-soft">{ar ? "لم يبحث عن شيء بعد." : "No searches yet."}</p>
            ))}

          {tab === "clicks" &&
            (journey.clicks.filter((c) => !onlyImportant || c.important).length ? (
              <ul className="divide-y divide-line">
                {journey.clicks
                  .filter((c) => !onlyImportant || c.important)
                  .map((c, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-28 shrink-0 text-xs text-ink-soft">{when(c.created_at, ar)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {c.important && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{ar ? "مهم" : "Important"}</span>
                          )}
                          <span className="truncate text-ink" dir="auto">
                            {c.label}
                          </span>
                        </span>
                        <span className="block truncate font-mono text-[11px] text-ink-soft" dir="ltr">
                          {c.path}
                          {c.target ? ` → ${c.target}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-ink-soft">{ar ? "لا توجد ضغطات بعد." : "No clicks yet."}</p>
            ))}

          {tab === "sessions" &&
            (journey.sessions.length ? (
              <ul className="divide-y divide-line">
                {journey.sessions.map((s) => (
                  <li key={s.session_id} className="px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">{sourceText(s.source, s.network, ar)}</span>
                      <span className="text-xs text-ink-soft">{when(s.started_at, ar)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {ar ? "دخل من" : "Landed on"} <span className="font-mono" dir="ltr">{s.landing_path}</span>
                      {s.utm_campaign ? ` · ${ar ? "حملة" : "campaign"} ${s.utm_campaign}` : ""} · {num(s.pageviews, lang)} {ar ? "صفحة" : "pages"} ·{" "}
                      {duration(s.seconds, ar)}
                      {s.device ? ` · ${s.device}` : ""}
                      {s.city ? ` · ${s.city}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {s.product_views > 0 && <span className="rounded-full bg-surface-hover px-2 py-0.5">{ar ? "شاهد منتجات" : "viewed products"} {num(s.product_views, lang)}</span>}
                      {s.added_to_cart && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-700">{ar ? "أضاف للسلة" : "added to cart"}</span>}
                      {s.reached_checkout && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-700">{ar ? "وصل للدفع" : "reached checkout"}</span>}
                      {s.ordered && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">{ar ? "طلب" : "ordered"} #{s.order_number}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-ink-soft">{ar ? "لا توجد زيارات بعد." : "No visits yet."}</p>
            ))}
        </div>
      </div>
    </div>
  );
}
