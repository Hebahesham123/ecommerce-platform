"use client";

import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge, SectionHeader } from "@/components/ui";
import {
  StatTile,
  KpiRow,
  Toolbar,
  SearchInput,
  Select,
} from "@/components/dashboard-ui";
import {
  IcWhatsApp,
  IcMarketing,
  IcInbox,
  IcMobile,
  IcSend,
  IcCash,
  IcUp,
  IcAlert,
  IcCopy,
  IcX,
} from "@/components/icons";

// ---- Local mock data (no campaigns table in src/lib/data.ts yet) -----------
type Channel = "whatsapp" | "email" | "sms";
type CampaignStatus = "active" | "scheduled" | "done";

type Campaign = {
  id: string;
  channel: Channel;
  nameAr: string;
  nameEn: string;
  sent: number;
  opened: number;
  clicked: number;
  revenue: number;
  status: CampaignStatus;
};

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: "c1", channel: "whatsapp", nameAr: "تخفيضات الصيف", nameEn: "Summer sale", sent: 4200, opened: 4116, clicked: 1890, revenue: 21400, status: "active" },
  { id: "c2", channel: "whatsapp", nameAr: "استرجاع السلات", nameEn: "Cart recovery", sent: 860, opened: 550, clicked: 210, revenue: 9600, status: "active" },
  { id: "c3", channel: "email", nameAr: "نشرة الأسبوع", nameEn: "Weekly newsletter", sent: 5100, opened: 1683, clicked: 412, revenue: 8300, status: "active" },
  { id: "c4", channel: "email", nameAr: "عملاء VIP", nameEn: "VIP customers", sent: 1320, opened: 410, clicked: 96, revenue: 5200, status: "done" },
  { id: "c5", channel: "sms", nameAr: "تذكير المفضلة", nameEn: "Wishlist reminder", sent: 640, opened: 198, clicked: 52, revenue: 2100, status: "scheduled" },
  { id: "c6", channel: "whatsapp", nameAr: "عرض العيد", nameEn: "Eid offer", sent: 0, opened: 0, clicked: 0, revenue: 0, status: "scheduled" },
];

const CHANNEL_META: Record<
  Channel,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string; hex: string; nameAr: string; nameEn: string }
> = {
  whatsapp: { Icon: IcWhatsApp, tone: "bg-emerald-50 text-emerald-600", hex: "#10b981", nameAr: "واتساب", nameEn: "WhatsApp" },
  email: { Icon: IcInbox, tone: "bg-sky-50 text-sky-600", hex: "#0ea5e9", nameAr: "بريد إلكتروني", nameEn: "Email" },
  sms: { Icon: IcMobile, tone: "bg-violet-50 text-violet-600", hex: "#8b5cf6", nameAr: "رسالة نصية", nameEn: "SMS" },
};

const STATUS_META: Record<CampaignStatus, { tone: string; ar: string; en: string }> = {
  active: { tone: "bg-emerald-50 text-emerald-700", ar: "نشطة", en: "Active" },
  scheduled: { tone: "bg-sky-50 text-sky-700", ar: "مجدولة", en: "Scheduled" },
  done: { tone: "bg-slate-100 text-slate-600", ar: "منتهية", en: "Done" },
};

type AbandonedCart = {
  id: string;
  customerAr: string;
  customerEn: string;
  items: number;
  value: number;
  agoAr: string;
  agoEn: string;
};

const ABANDONED_CARTS: AbandonedCart[] = [
  { id: "ac1", customerAr: "دينا سعيد", customerEn: "Dina Saeed", items: 3, value: 1450, agoAr: "منذ ٤ ساعات", agoEn: "4h ago" },
  { id: "ac2", customerAr: "عمر فتحي", customerEn: "Omar Fathy", items: 1, value: 690, agoAr: "منذ ٧ ساعات", agoEn: "7h ago" },
  { id: "ac3", customerAr: "رنا إبراهيم", customerEn: "Rana Ibrahim", items: 2, value: 980, agoAr: "أمس", agoEn: "Yesterday" },
  { id: "ac4", customerAr: "سيف الدين", customerEn: "Seif El Din", items: 4, value: 2100, agoAr: "أمس", agoEn: "Yesterday" },
];

export default function MarketingPage() {
  const { t, lang } = useI18n();

  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [message, setMessage] = useState("");
  const [broadcastSent, setBroadcastSent] = useState(false);

  const name = (c: Campaign) => (lang === "ar" ? c.nameAr : c.nameEn);

  // ---- KPIs over the full campaign set (not affected by table filters) ----
  const totals = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active").length;
    const sent = campaigns.reduce((s, c) => s + c.sent, 0);
    const opened = campaigns.reduce((s, c) => s + c.opened, 0);
    const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const openRate = sent > 0 ? opened / sent : 0;
    return { active, sent, openRate, revenue };
  }, [campaigns]);

  const abandonedValue = ABANDONED_CARTS.reduce((s, a) => s + a.value, 0);

  // ---- Filtered table rows ----
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (channel !== "all" && c.channel !== channel) return false;
      if (status !== "all" && c.status !== status) return false;
      if (needle && !`${c.nameAr} ${c.nameEn}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [campaigns, q, channel, status]);

  const filtersActive = q !== "" || channel !== "all" || status !== "all";
  function clearFilters() {
    setQ("");
    setChannel("all");
    setStatus("all");
  }

  function sendNow(id: string) {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "active" } : c)),
    );
  }

  function duplicate(c: Campaign) {
    const clone: Campaign = {
      ...c,
      id: `${c.id}-${Date.now()}`,
      nameAr: `${c.nameAr} (نسخة)`,
      nameEn: `${c.nameEn} (copy)`,
      sent: 0,
      opened: 0,
      clicked: 0,
      revenue: 0,
      status: "scheduled",
    };
    setCampaigns((prev) => [clone, ...prev]);
  }

  const chartData = campaigns.map((c) => ({
    label: name(c).length > 14 ? `${name(c).slice(0, 13)}…` : name(c),
    revenue: c.revenue,
    hex: CHANNEL_META[c.channel].hex,
  }));

  const revenueByChannel = (["whatsapp", "email", "sms"] as Channel[]).map((ch) => ({
    channel: ch,
    revenue: campaigns.filter((c) => c.channel === ch).reduce((s, c) => s + c.revenue, 0),
  }));

  return (
    <>
      <PageHeader
        title={t("nav_marketing")}
        subtitle={lang === "ar" ? "حملات الواتساب والبريد والرسائل والاسترجاع" : "WhatsApp, email, SMS & cart recovery"}
        actions={
          <a href="#broadcast" className="btn-primary">
            <IcSend className="h-4 w-4" /> {t("whatsapp_broadcast")}
          </a>
        }
      />

      {/* ---- KPI tiles ---- */}
      <div className="mb-4">
        <KpiRow cols={5}>
          <StatTile
            icon={IcMarketing}
            label={lang === "ar" ? "حملات نشطة" : "Active campaigns"}
            value={num(totals.active, lang)}
            accent="violet"
          />
          <StatTile
            icon={IcSend}
            label={lang === "ar" ? "رسائل مُرسلة" : "Messages sent"}
            value={num(totals.sent, lang)}
            accent="sky"
          />
          <StatTile
            icon={IcUp}
            label={lang === "ar" ? "متوسط معدل الفتح" : "Avg. open rate"}
            value={`${num(Math.round(totals.openRate * 100), lang)}%`}
            accent="emerald"
          />
          <StatTile
            icon={IcCash}
            label={lang === "ar" ? "إيرادات منسوبة" : "Attributed revenue"}
            value={egp(totals.revenue, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcAlert}
            label={t("abandoned_carts")}
            value={num(ABANDONED_CARTS.length, lang)}
            accent="rose"
          />
        </KpiRow>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ---- Campaign performance chart ---- */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={lang === "ar" ? "أداء الحملات" : "Campaign performance"}
            action={<span className="text-lg font-bold text-ink">{egp(totals.revenue, lang)}</span>}
          />
          <div className="h-56 w-full px-2 pb-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  interval={0}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "#f6f7f9" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e7eaee",
                    fontSize: 12,
                    boxShadow: "0 8px 30px rgba(15,23,42,0.12)",
                  }}
                  formatter={(v: number) => [egp(v, lang), t("kpi_revenue")]}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3">
            {revenueByChannel.map((r) => (
              <span key={r.channel} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_META[r.channel].hex }} />
                {lang === "ar" ? CHANNEL_META[r.channel].nameAr : CHANNEL_META[r.channel].nameEn}
                <span className="font-semibold text-ink">{egp(r.revenue, lang)}</span>
              </span>
            ))}
          </div>
        </Card>

        {/* ---- WhatsApp broadcast quick action ---- */}
        <div id="broadcast" className="scroll-mt-4">
          <Card>
            <SectionHeader title={t("whatsapp_broadcast")} />
            <div className="space-y-3 px-5 pb-5">
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setBroadcastSent(false);
                }}
                placeholder={
                  lang === "ar" ? "اكتب رسالة العرض التي سترسل للعملاء…" : "Write the offer message to broadcast…"
                }
                rows={4}
                className="w-full resize-none rounded-xl border border-line bg-surface-page p-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-card">
                  🌙
                </span>
                <span className="text-xs font-medium text-emerald-800">{t("quiet_hours")}</span>
              </div>
              <button
                className="btn-primary w-full"
                disabled={!message.trim()}
                onClick={() => {
                  setBroadcastSent(true);
                  setMessage("");
                }}
              >
                <IcWhatsApp className="h-4 w-4" />
                {lang === "ar" ? "إرسال للجميع" : "Broadcast to all"}
              </button>
              {broadcastSent && (
                <p className="text-center text-xs font-medium text-emerald-700">
                  {lang === "ar" ? "تم جدولة الإرسال بنجاح" : "Broadcast scheduled successfully"}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ---- Campaigns table ---- */}
      <Card className="mt-4 overflow-hidden">
        <SectionHeader title={t("campaigns")} />
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={lang === "ar" ? "ابحث عن حملة…" : "Search campaigns…"}
          />
          <Select value={channel} onChange={(v) => setChannel(v as "all" | Channel)}>
            <option value="all">{t("col_channel")}: {t("filter_all")}</option>
            <option value="whatsapp">{CHANNEL_META.whatsapp[lang === "ar" ? "nameAr" : "nameEn"]}</option>
            <option value="email">{CHANNEL_META.email[lang === "ar" ? "nameAr" : "nameEn"]}</option>
            <option value="sms">{CHANNEL_META.sms[lang === "ar" ? "nameAr" : "nameEn"]}</option>
          </Select>
          <Select value={status} onChange={(v) => setStatus(v as "all" | CampaignStatus)}>
            <option value="all">{t("col_status")}: {t("filter_all")}</option>
            <option value="active">{STATUS_META.active[lang === "ar" ? "ar" : "en"]}</option>
            <option value="scheduled">{STATUS_META.scheduled[lang === "ar" ? "ar" : "en"]}</option>
            <option value="done">{STATUS_META.done[lang === "ar" ? "ar" : "en"]}</option>
          </Select>
          {filtersActive && (
            <button onClick={clearFilters} className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted">
              <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
            </button>
          )}
          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_channel")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("campaigns")}</th>
                <th className="px-3 py-3 text-start font-medium">{lang === "ar" ? "أُرسلت" : "Sent"}</th>
                <th className="px-3 py-3 text-start font-medium">{lang === "ar" ? "معدل الفتح" : "Open rate"}</th>
                <th className="px-3 py-3 text-start font-medium">{lang === "ar" ? "معدل النقر" : "Click rate"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("kpi_revenue")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const meta = CHANNEL_META[c.channel];
                const st = STATUS_META[c.status];
                const openRate = c.sent > 0 ? c.opened / c.sent : 0;
                const clickRate = c.sent > 0 ? c.clicked / c.sent : 0;
                const Icon = meta.Icon;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-page">
                    <td className="px-5 py-3.5">
                      <span className={`badge ${meta.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {lang === "ar" ? meta.nameAr : meta.nameEn}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-medium text-ink">{name(c)}</td>
                    <td className="px-3 py-3.5 text-ink">{num(c.sent, lang)}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-9 text-ink">{num(Math.round(openRate * 100), lang)}%</span>
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${Math.min(100, Math.round(openRate * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{num(Math.round(clickRate * 100), lang)}%</td>
                    <td className="px-3 py-3.5 font-medium text-ink">{egp(c.revenue, lang)}</td>
                    <td className="px-3 py-3.5">
                      <Badge className={st.tone}>{lang === "ar" ? st.ar : st.en}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status === "scheduled" && (
                          <button
                            onClick={() => sendNow(c.id)}
                            className="btn-outline h-8 gap-1 px-2.5 text-xs"
                          >
                            <IcSend className="h-3.5 w-3.5" />
                            {lang === "ar" ? "إرسال" : "Send"}
                          </button>
                        )}
                        <button
                          onClick={() => duplicate(c)}
                          className="btn-ghost h-8 gap-1 px-2.5 text-xs text-ink-muted"
                        >
                          <IcCopy className="h-3.5 w-3.5" />
                          {lang === "ar" ? "نسخ" : "Duplicate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcMarketing className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {lang === "ar" ? "لا توجد حملات مطابقة" : "No matching campaigns"}
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {lang === "ar" ? "جرّب تعديل البحث أو الفلاتر." : "Try adjusting your search or filters."}
                </p>
              </div>
              {filtersActive && (
                <button className="btn-outline mt-1" onClick={clearFilters}>
                  <IcX className="h-4 w-4" /> {t("clear_filters")}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ---- Abandoned carts ---- */}
      <Card className="mt-4">
        <SectionHeader
          title={t("abandoned_carts")}
          action={
            <span className="text-sm text-ink-muted">
              {lang === "ar" ? "قابلة للاسترجاع بقيمة" : "Recoverable, worth"}{" "}
              <span className="font-semibold text-ink">{egp(abandonedValue, lang)}</span>
            </span>
          }
        />
        {ABANDONED_CARTS.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <IcCash className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-soft">
              {lang === "ar" ? "لا توجد سلات متروكة الآن" : "No abandoned carts right now"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line px-2 pb-2">
            {ABANDONED_CARTS.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">
                  {(lang === "ar" ? a.customerAr : a.customerEn).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {lang === "ar" ? a.customerAr : a.customerEn}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {num(a.items, lang)} {lang === "ar" ? "منتجات" : "items"} · {lang === "ar" ? a.agoAr : a.agoEn}
                  </div>
                </div>
                <span className="text-sm font-semibold text-ink">{egp(a.value, lang)}</span>
                <button
                  className="btn-outline h-8 gap-1.5 px-2.5 text-xs"
                  aria-label={lang === "ar" ? "إرسال تذكير واتساب" : "Send WhatsApp reminder"}
                >
                  <IcWhatsApp className="h-3.5 w-3.5 text-emerald-500" />
                  {lang === "ar" ? "تذكير" : "Remind"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-5 py-3 text-center text-xs text-ink-soft">
          {lang === "ar" ? "معدل استرجاع متوقع ١٠–٢٥٪" : "Expected 10–25% recovery"}
        </div>
      </Card>
    </>
  );
}
