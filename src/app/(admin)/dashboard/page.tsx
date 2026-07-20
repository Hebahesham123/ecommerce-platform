"use client";

import type { ComponentType, SVGProps } from "react";
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
import {
  orders,
  products,
  salesSeries,
  statusBreakdown,
  type Order,
} from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { KpiRow, StatTile, type Accent } from "@/components/dashboard-ui";
import {
  LifecycleBadge,
  PaymentBadge,
  FulfillmentBadge,
} from "@/components/status";
import {
  IcUp,
  IcAlert,
  IcCash,
  IcOrders,
  IcAccounting,
} from "@/components/icons";
import Link from "next/link";

type Kpi = {
  key: DictKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  value: string;
  delta: number;
  accent: Accent;
};

const flagTone: Record<NonNullable<Order["flag"]>, string> = {
  fake_cod: "bg-rose-50 text-rose-600",
  unpaid_delivered: "bg-amber-50 text-amber-600",
  return: "bg-slate-100 text-slate-600",
};

export default function DashboardPage() {
  const { t, lang } = useI18n();

  const returnRate =
    Math.round(
      (orders.filter((o) => o.flag === "return").length / orders.length) * 1000
    ) / 10;

  const kpis: Kpi[] = [
    { key: "kpi_revenue", icon: IcCash, value: egp(84320, lang), delta: 12, accent: "brand" },
    { key: "kpi_orders", icon: IcOrders, value: num(312, lang), delta: 8, accent: "sky" },
    { key: "kpi_aov", icon: IcAccounting, value: egp(541, lang), delta: 3, accent: "violet" },
    { key: "kpi_cod_share", icon: IcCash, value: `${num(61, lang)}%`, delta: -4, accent: "amber" },
    { key: "kpi_return_rate", icon: IcAlert, value: `${num(returnRate, lang)}%`, delta: -2, accent: "rose" },
  ];

  const attention = orders.filter((o) => o.flag);
  const totalSales = salesSeries.reduce((sum, d) => sum + d.sales, 0);
  const totalStatus = statusBreakdown.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      <PageHeader title={t("nav_overview")} subtitle={t("greeting")} />

      <KpiRow cols={5}>
        {kpis.map((k) => (
          <StatTile
            key={k.key}
            icon={k.icon}
            label={t(k.key)}
            value={k.value}
            delta={k.delta}
            accent={k.accent}
            sub={t("vs_last_week")}
          />
        ))}
      </KpiRow>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={t("sales_7d")}
            action={
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-ink">{egp(totalSales, lang)}</span>
                <span className="badge gap-1 bg-emerald-50 text-emerald-700">
                  <IcUp className="h-3 w-3" />
                  {num(12, lang)}%
                </span>
              </div>
            }
          />
          <div className="h-64 w-full px-2 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSeries} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis
                  dataKey={lang === "ar" ? "day" : "dayEn"}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip
                  cursor={{ stroke: "#e7eaee" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload as { sales: number; orders: number };
                    return (
                      <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
                        <div className="font-semibold text-ink">{label}</div>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-brand-600">
                          <span className="h-2 w-2 rounded-full bg-brand-600" />
                          {egp(p.sales, lang)}
                        </div>
                        <div className="mt-0.5 text-ink-soft">
                          {num(p.orders, lang)} {t("kpi_orders")}
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
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
                  <Pie
                    data={statusBreakdown as unknown as Record<string, number>[]}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {statusBreakdown.map((s) => (
                      <Cell key={s.key} fill={s.tone} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name) => [num(value, lang), t(name as DictKey)]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e7eaee",
                      fontSize: 12,
                      boxShadow: "0 8px 30px rgba(15,23,42,0.12)",
                    }}
                  />
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
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: s.tone }}
                  />
                  <span className="flex-1 truncate text-ink-muted">{t(s.key as DictKey)}</span>
                  <span className="text-end">
                    <span className="block font-semibold text-ink">{num(s.value, lang)}</span>
                    <span className="block text-[10px] text-ink-soft">
                      {Math.round((s.value / totalStatus) * 100)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={t("recent_orders")}
            action={
              <Link href="/orders" className="text-sm font-medium text-brand-700 hover:underline">
                {t("view_all")}
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-start text-xs text-ink-soft">
                  <th className="px-5 py-2.5 text-start font-medium">{t("col_order")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("col_customer")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("col_total")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("col_lifecycle")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("col_payment")}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{t("col_fulfillment")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-line last:border-0 hover:bg-surface-page"
                  >
                    <td className="px-5 py-3 font-semibold text-ink">#{o.id}</td>
                    <td className="px-3 py-3 text-ink">{o.customer}</td>
                    <td className="px-3 py-3 font-medium text-ink">{egp(o.total, lang)}</td>
                    <td className="px-3 py-3">
                      <LifecycleBadge v={o.lifecycle} />
                    </td>
                    <td className="px-3 py-3">
                      <PaymentBadge v={o.payment} method={o.method} />
                    </td>
                    <td className="px-5 py-3">
                      <FulfillmentBadge v={o.fulfillment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Needs attention + top products */}
        <div className="space-y-4">
          <Card>
            <SectionHeader title={t("needs_attention")} />
            <ul className="space-y-1 px-3 pb-3">
              {attention.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-page"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${flagTone[o.flag as NonNullable<Order["flag"]>]}`}
                  >
                    <IcAlert className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      #{o.id} · {o.customer}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {o.flag === "fake_cod"
                        ? lang === "ar" ? "اشتباه طلب وهمي" : "Suspected fake COD"
                        : o.flag === "unpaid_delivered"
                        ? lang === "ar" ? "تم التسليم بدون تحصيل" : "Delivered, not collected"
                        : lang === "ar" ? "طلب مرتجع" : "Returned order"}
                    </div>
                  </div>
                  <LifecycleBadge v={o.lifecycle} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHeader
              title={t("top_products")}
              action={
                <Link href="/products" className="text-sm font-medium text-brand-700 hover:underline">
                  {t("view_all")}
                </Link>
              }
            />
            <ul className="space-y-1 px-3 pb-3">
              {products.slice(0, 4).map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-page"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-ink-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-xs text-ink-soft">
                        {num(p.sold, lang)} {lang === "ar" ? "عملية بيع" : "sold"}
                      </span>
                      {p.stock === 0 ? (
                        <Badge className="bg-rose-50 text-rose-700">{t("out_stock")}</Badge>
                      ) : p.stock < 10 ? (
                        <Badge className="bg-amber-50 text-amber-700">{t("low_stock")}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-ink">{egp(p.price, lang)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Uncollected COD strip */}
      <Card className="mt-4 flex items-center gap-4 bg-gradient-to-l from-brand-50 to-white p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
          <IcCash />
        </span>
        <div className="flex-1">
          <div className="text-sm text-ink-muted">{t("kpi_pending_cod")}</div>
          <div className="text-xl font-bold text-ink">{egp(7770, lang)}</div>
        </div>
        <Link href="/couriers" className="btn-primary">
          {t("reconcile")}
        </Link>
      </Card>
    </>
  );
}
