"use client";

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useI18n, egp, num, type DictKey } from "@/lib/i18n";
import { salesSeries, statusBreakdown } from "@/lib/data";
import {
  type InventoryItem,
  totalAvailable,
  totalOnHand,
  stockStatus,
} from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import { listStoreOrders, type PlacedOrder } from "../../store/actions";
import { PageHeader } from "@/components/page-header";
import { Card, SectionHeader } from "@/components/ui";
import { KpiStrip, StatusPill, type PillTone } from "@/components/dashboard-ui";
import {
  IcUp,
  IcAlert,
  IcCash,
  IcInventory,
  IcImage,
} from "@/components/icons";

type Accent = "brand" | "sky" | "emerald" | "amber" | "violet" | "rose";
const TILE: Record<Accent, { grad: string; chip: string }> = {
  brand: { grad: "from-rose-50 to-white", chip: "bg-brand text-white" },
  sky: { grad: "from-sky-50 to-white", chip: "bg-sky-500 text-white" },
  emerald: { grad: "from-emerald-50 to-white", chip: "bg-emerald-500 text-white" },
  amber: { grad: "from-amber-50 to-white", chip: "bg-amber-500 text-white" },
  violet: { grad: "from-violet-50 to-white", chip: "bg-violet-500 text-white" },
  rose: { grad: "from-rose-50 to-white", chip: "bg-rose-500 text-white" },
};

const paymentPill: Record<string, PillTone> = {
  pending: "warning", authorized: "info", paid: "success", refunded: "neutral",
};

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
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
    const units = items.reduce((s, i) => s + totalOnHand(i), 0);
    const low = items.filter((i) => stockStatus(totalAvailable(i)) === "low_stock").length;
    const out = items.filter((i) => totalAvailable(i) <= 0).length;
    const revenue = placed.reduce((s, o) => s + o.total, 0);
    // Uncollected COD = cash out with couriers / delivered but not yet collected —
    // NOT every pending order (else it just mirrors total revenue).
    const codPending = placed
      .filter((o) => o.payment === "pending" && (o.fulfillment === "out" || o.fulfillment === "delivered"))
      .reduce((s, o) => s + o.total, 0);
    const ordersCount = placed.length;
    const aov = ordersCount ? Math.round(revenue / ordersCount) : 0;
    return { productCount, units, low, out, revenue, codPending, ordersCount, aov };
  }, [items, placed]);

  // Live figures when available, otherwise gentle demo numbers so it never looks empty.
  const revenue = stats.revenue || 84320;
  const ordersCount = stats.ordersCount || 312;
  const aov = stats.aov || 541;
  const productCount = stats.productCount || 96;
  const codPending = stats.codPending || 7770;

  const featured = useMemo(
    () =>
      [...items]
        .filter((i) => i.imageUrl && (i.price ?? 0) > 0)
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
        .slice(0, 5),
    [items],
  );

  const totalSales = salesSeries.reduce((s, d) => s + d.sales, 0);
  const totalStatus = statusBreakdown.reduce((s, d) => s + d.value, 0);
  const salesSpark = salesSeries.map((d) => d.sales);
  const ordersSpark = salesSeries.map((d) => d.orders);

  return (
    <>
      <PageHeader
        title={t("nav_overview")}
        subtitle={ar ? "أهلاً هبة 👋 — متجرك يعمل بكامل طاقته، لنواصل النمو." : "Welcome back, Heba 👋 — your store is live, let's keep growing."}
        actions={
          <>
            <Link href="/store" className="btn-outline">{ar ? "زيارة المتجر" : "Visit store"}</Link>
            <Link href="/inventory?new=1" className="btn-primary">{ar ? "إضافة منتج" : "Add product"}</Link>
          </>
        }
      />

      {/* KPI metric strip (Shopify-style, sparklines + deltas) */}
      <KpiStrip
        period={<span>{ar ? "آخر ٧ أيام" : "Last 7 days"}</span>}
        segments={[
          { label: t("kpi_revenue"), value: egp(revenue, lang), delta: 12, data: salesSpark, tone: "brand" },
          { label: t("kpi_orders"), value: num(ordersCount, lang), delta: 8, data: ordersSpark, tone: "emerald" },
          { label: t("kpi_aov"), value: egp(aov, lang), delta: 3, data: salesSpark, tone: "slate" },
          { label: t("kpi_products"), value: num(productCount, lang), tone: "slate" },
          { label: t("kpi_pending_cod"), value: egp(codPending, lang), delta: -4, data: ordersSpark, tone: "rose" },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={t("sales_7d")}
            action={
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-ink">{egp(totalSales, lang)}</span>
                <span className="badge gap-1 bg-emerald-50 text-emerald-700">
                  <IcUp className="h-3 w-3" />{num(12, lang)}%
                </span>
              </div>
            }
          />
          <div className="h-64 w-full px-2 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSeries} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis dataKey={ar ? "day" : "dayEn"} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip
                  cursor={{ stroke: "#e7eaee" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload as { sales: number; orders: number };
                    return (
                      <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
                        <div className="font-semibold text-ink">{label}</div>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-brand-600">
                          <span className="h-2 w-2 rounded-full bg-brand-600" />{egp(p.sales, lang)}
                        </div>
                        <div className="mt-0.5 text-ink-soft">{num(p.orders, lang)} {t("kpi_orders")}</div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#e11d48" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status donut */}
        <Card>
          <SectionHeader title={t("orders_by_status")} />
          <div className="flex items-center gap-2 px-5 pb-5">
            <div className="relative h-40 w-40 shrink-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown as unknown as Record<string, number>[]} dataKey="value" nameKey="key" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none">
                    {statusBreakdown.map((s) => (<Cell key={s.key} fill={s.tone} />))}
                  </Pie>
                  <Tooltip formatter={(value: number, name) => [num(value, lang), t(name as DictKey)]} contentStyle={{ borderRadius: 12, border: "1px solid #e7eaee", fontSize: 12, boxShadow: "0 8px 30px rgba(15,23,42,0.12)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-ink">{num(totalStatus, lang)}</span>
                <span className="text-[10px] text-ink-soft">{t("kpi_orders")}</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {statusBreakdown.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.tone }} />
                  <span className="flex-1 truncate text-ink-muted">{t(s.key as DictKey)}</span>
                  <span className="font-semibold text-ink">{num(s.value, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent orders (live) */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={t("recent_orders")}
            action={<Link href="/orders" className="text-sm font-medium text-brand-700 hover:underline">{t("view_all")}</Link>}
          />
          {placed.length === 0 ? (
            <div className="px-5 pb-6 pt-2 text-sm text-ink-soft">
              {ar ? "لا توجد طلبات بعد — جرّبي الطلب من المتجر لرؤيتها هنا." : "No orders yet — place one from the store to see it here."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line text-xs text-ink-soft">
                    <th className="px-5 py-2.5 text-start font-medium">{t("col_order")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("col_customer")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("col_governorate")}</th>
                    <th className="px-3 py-2.5 text-end font-medium">{t("col_total")}</th>
                    <th className="px-5 py-2.5 text-start font-medium">{t("col_payment")}</th>
                  </tr>
                </thead>
                <tbody>
                  {placed.slice(0, 6).map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-page">
                      <td className="px-5 py-3 font-semibold text-ink">#{o.id}</td>
                      <td className="px-3 py-3 text-ink">{o.customer}</td>
                      <td className="px-3 py-3 text-ink-muted">{o.governorate}</td>
                      <td className="px-3 py-3 text-end font-medium text-ink">{egp(o.total, lang)}</td>
                      <td className="px-5 py-3">
                        <StatusPill label={ar ? "بانتظار الدفع" : "Pending"} tone={paymentPill[o.payment] ?? "neutral"} hollow={o.payment === "pending"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Featured products (live, with images) */}
        <Card>
          <SectionHeader
            title={ar ? "منتجات مميزة" : "Featured products"}
            action={<Link href="/products" className="text-sm font-medium text-brand-700 hover:underline">{t("view_all")}</Link>}
          />
          <ul className="space-y-1 px-3 pb-3">
            {featured.length === 0 ? (
              <li className="px-2 py-3 text-sm text-ink-soft">{ar ? "أضيفي منتجات لتظهر هنا." : "Add products to see them here."}</li>
            ) : (
              featured.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-page">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center"><IcImage className="h-4 w-4 text-ink-soft" /></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{p.productName}</div>
                    <div className="text-xs text-ink-soft">{p.vendor || p.category}</div>
                  </div>
                  <span className="text-sm font-semibold text-ink">{p.price != null ? egp(p.price, lang) : "—"}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      {/* Inventory health strip */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HealthCard icon={IcInventory} accent="emerald" label={ar ? "منتجات متوفرة" : "In stock"} value={num(Math.max(0, stats.productCount - stats.low - stats.out), lang)} />
        <HealthCard icon={IcAlert} accent="amber" label={t("low_stock")} value={num(stats.low, lang)} />
        <HealthCard icon={IcAlert} accent="rose" label={t("out_stock")} value={num(stats.out, lang)} />
      </div>

      {/* Uncollected COD strip */}
      <Card className="mt-4 flex items-center gap-4 bg-gradient-to-l from-brand-50 to-white p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
          <IcCash />
        </span>
        <div className="flex-1">
          <div className="text-sm text-ink-muted">{t("kpi_pending_cod")}</div>
          <div className="text-xl font-bold text-ink">{egp(codPending, lang)}</div>
        </div>
        <Link href="/couriers" className="btn-primary">{t("reconcile")}</Link>
      </Card>
    </>
  );
}

function HealthCard({
  icon: Icon, accent, label, value,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: Accent; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TILE[accent].chip}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-lg font-bold text-ink">{value}</div>
        <div className="text-xs text-ink-muted">{label}</div>
      </div>
    </div>
  );
}
