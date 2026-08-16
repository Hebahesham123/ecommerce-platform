"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, Tooltip,
} from "recharts";
import { useI18n, egp, num } from "@/lib/i18n";
import { salesSeries } from "@/lib/data";
import {
  type InventoryItem, totalAvailable, totalOnHand, stockStatus,
} from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import { listStoreOrders, type PlacedOrder } from "../../store/actions";
import { PageHeader } from "@/components/page-header";
import { IcImage } from "@/components/icons";

// Validated categorical accents (data-viz palette), light/dark steps. Violet
// leads to match the reference; magenta is skipped (reads pink).
const CHART = {
  violet: { light: "#7c3aed", dark: "#8b7cf6" },
  blue: { light: "#2a78d6", dark: "#3987e5" },
  green: { light: "#008300", dark: "#1baf7a" },
  orange: { light: "#eb6834", dark: "#d95926" },
} as const;
type ColorKey = keyof typeof CHART;

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function Delta({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
      {up ? "▲" : "▼"}{Math.abs(delta)}%
    </span>
  );
}

function Sparkline({ data, color, type }: { data: { v: number }[]; color: string; type: "area" | "bar" }) {
  const gid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({
  icon, tint, label, value, delta, data, color, type,
}: {
  icon: string; tint: string; label: string; value: string; delta?: number;
  data: { v: number }[]; color: string; type: "area" | "bar";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${tint}`}>{icon}</span>
        {delta != null && <Delta delta={delta} />}
      </div>
      <div className="mt-4 text-sm text-ink-muted">{label}</div>
      <div className="text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-3 h-10">
        <Sparkline data={data} color={color} type={type} />
      </div>
    </div>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const dark = useIsDark();
  const c = (k: ColorKey) => CHART[k][dark ? "dark" : "light"];

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);

  useEffect(() => {
    (async () => {
      const [inv, ord] = await Promise.all([listInventory(), listStoreOrders()]);
      if (inv.ok) setItems(inv.data);
      if (ord.ok) setPlaced(ord.data);
    })();
  }, []);

  const stats = useMemo(() => {
    const productCount = new Set(items.map((i) => i.productName)).size;
    const low = items.filter((i) => stockStatus(totalAvailable(i)) === "low_stock").length;
    const out = items.filter((i) => totalAvailable(i) <= 0).length;
    const units = items.reduce((s, i) => s + totalOnHand(i), 0);
    const revenue = placed.reduce((s, o) => s + o.total, 0);
    const ordersCount = placed.length;
    const aov = ordersCount ? Math.round(revenue / ordersCount) : 0;
    const customers = new Set(placed.map((o) => o.phone)).size;
    return { productCount, low, out, units, revenue, ordersCount, aov, customers };
  }, [items, placed]);

  const revenue = stats.revenue || 128430;
  const ordersCount = stats.ordersCount || 12842;
  const aov = stats.aov || 541;
  const customers = stats.customers || 3892;

  const revData = salesSeries.map((d) => ({ v: d.sales }));
  const ordData = salesSeries.map((d) => ({ v: d.orders }));
  const aovData = salesSeries.map((d) => ({ v: d.orders ? Math.round(d.sales / d.orders) : 0 }));
  const revenueSeries = salesSeries.map((d) => ({ label: ar ? d.day : d.dayEn, sales: d.sales }));

  const featured = useMemo(
    () => [...items].filter((i) => i.imageUrl && (i.price ?? 0) > 0).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 5),
    [items],
  );
  const topPrice = featured[0]?.price ?? 1;

  const recentCustomers = useMemo(() => {
    const seen = new Map<string, { name: string; gov: string; total: number }>();
    for (const o of placed) if (!seen.has(o.phone)) seen.set(o.phone, { name: o.customer, gov: o.governorate, total: o.total });
    return [...seen.values()].slice(0, 5);
  }, [placed]);

  const insight = ar
    ? `إيراداتك ${egp(revenue, lang)} من ${num(ordersCount, lang)} طلب (متوسط ${egp(aov, lang)}). ${stats.low + stats.out > 0 ? `${num(stats.low + stats.out, lang)} منتج يحتاج إعادة تخزين.` : "المخزون في وضع جيد."}`
    : `Revenue ${egp(revenue, lang)} across ${num(ordersCount, lang)} orders (avg ${egp(aov, lang)}). ${stats.low + stats.out > 0 ? `${num(stats.low + stats.out, lang)} products need restocking.` : "Inventory looks healthy."}`;

  return (
    <>
      <PageHeader
        title={t("nav_overview")}
        subtitle={ar ? "أهلاً هبة 👋 — نظرة سريعة على أداء متجرك اليوم." : "Good morning, Heba 👋 — here's your store today."}
        actions={
          <>
            <Link href="/store" className="btn-outline">{ar ? "زيارة المتجر" : "Visit store"}</Link>
            <Link href="/inventory?new=1" className="btn-primary">{ar ? "إضافة منتج" : "Add product"}</Link>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="💰" tint="bg-brand-100 text-brand-600" label={t("kpi_revenue")} value={egp(revenue, lang)} delta={12} data={revData} color={c("violet")} type="area" />
        <KpiCard icon="📦" tint="bg-blue-500/10 text-blue-500" label={t("kpi_orders")} value={num(ordersCount, lang)} delta={8} data={ordData} color={c("blue")} type="bar" />
        <KpiCard icon="📈" tint="bg-emerald-500/10 text-emerald-500" label={t("kpi_aov")} value={egp(aov, lang)} delta={3} data={aovData} color={c("green")} type="area" />
        <KpiCard icon="👥" tint="bg-orange-500/10 text-orange-500" label={ar ? "العملاء" : "Customers"} value={num(customers, lang)} delta={5} data={ordData} color={c("orange")} type="area" />
      </div>

      {/* Revenue overview + AI insight */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title={ar ? "نظرة على الإيرادات" : "Revenue Overview"}
          className="lg:col-span-2"
          action={<span className="text-lg font-bold text-ink">{egp(revenue, lang)}</span>}
        >
          <div className="h-64 w-full px-2 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c("violet")} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={c("violet")} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,148,168,0.14)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#8b8b9c" }} />
                <Tooltip
                  cursor={{ stroke: "rgba(148,148,168,0.3)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                        <div className="font-semibold text-ink">{label}</div>
                        <div className="mt-1 font-bold" style={{ color: c("violet") }}>{egp(Number(payload[0].value), lang)}</div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke={c("violet")} strokeWidth={2.5} fill="url(#revFill)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/15 to-transparent p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">✦</span>
            {ar ? "رؤية ذكية" : "AI Insight"}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{insight}</p>
          <Link href="/orders" className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:underline dark:text-brand-500">
            {ar ? "عرض التقرير الكامل" : "View full report"} →
          </Link>
        </div>
      </div>

      {/* Activity / Top products / Recent customers */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent orders (activity) */}
        <Panel title={t("recent_orders")} action={<Link href="/orders" className="text-sm font-medium text-brand-600 hover:underline">{t("view_all")}</Link>}>
          {placed.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-ink-soft">{ar ? "لا توجد طلبات بعد." : "No orders yet."}</div>
          ) : (
            <ul className="px-3 pb-3">
              {placed.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">{o.customer.trim().charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{o.customer}</div>
                    <div className="text-xs text-ink-soft">#{o.id} · {o.governorate}</div>
                  </div>
                  <span className="text-sm font-semibold text-ink">{egp(o.total, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Top products */}
        <Panel title={ar ? "المنتجات الأكثر مبيعاً" : "Top Products"} action={<Link href="/products" className="text-sm font-medium text-brand-600 hover:underline">{t("view_all")}</Link>}>
          <ul className="space-y-2 px-4 pb-4">
            {featured.length === 0 ? (
              <li className="px-1 py-2 text-sm text-ink-soft">{ar ? "أضيفي منتجات لتظهر هنا." : "Add products to see them here."}</li>
            ) : featured.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (<span className="flex h-full w-full items-center justify-center"><IcImage className="h-4 w-4 text-ink-soft" /></span>)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-ink">{p.productName}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(((p.price ?? 0) / topPrice) * 100)}%`, background: c("violet") }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-ink">{p.price != null ? egp(p.price, lang) : "—"}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent customers */}
        <Panel title={ar ? "أحدث العملاء" : "Recent Customers"} action={<Link href="/customers" className="text-sm font-medium text-brand-600 hover:underline">{t("view_all")}</Link>}>
          {recentCustomers.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-ink-soft">{ar ? "لا يوجد عملاء بعد." : "No customers yet."}</div>
          ) : (
            <ul className="px-3 pb-3">
              {recentCustomers.map((cust, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-ink-muted">{cust.name.trim().charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{cust.name}</div>
                    <div className="text-xs text-ink-soft">{cust.gov}</div>
                  </div>
                  <span className="text-sm font-semibold text-ink">{egp(cust.total, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
