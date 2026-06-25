"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
} from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, SectionHeader } from "@/components/ui";
import {
  LifecycleBadge,
  PaymentBadge,
  FulfillmentBadge,
} from "@/components/status";
import { IcUp, IcDown, IcAlert, IcCash } from "@/components/icons";
import Link from "next/link";

type Kpi = {
  key: DictKey;
  value: string;
  delta: number;
  hint?: string;
};

function KpiCard({ k }: { k: Kpi }) {
  const { t } = useI18n();
  const up = k.delta >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">{t(k.key)}</span>
        <span
          className={`badge ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
        >
          {up ? <IcUp className="h-3 w-3" /> : <IcDown className="h-3 w-3" />}
          {Math.abs(k.delta)}%
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {k.value}
      </div>
      <div className="mt-1 text-xs text-ink-soft">{k.hint ?? t("vs_last_week")}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { t, lang } = useI18n();

  const kpis: Kpi[] = [
    { key: "kpi_revenue", value: egp(84320, lang), delta: 12 },
    { key: "kpi_orders", value: num(312, lang), delta: 8 },
    { key: "kpi_aov", value: egp(541, lang), delta: 3 },
    { key: "kpi_cod_share", value: "61%", delta: -4 },
  ];

  const attention = orders.filter((o) => o.flag);

  return (
    <>
      <PageHeader
        title={t("nav_overview")}
        subtitle={t("greeting")}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.key} k={k} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={t("sales_7d")}
            action={
              <span className="text-lg font-bold text-ink">{egp(84500, lang)}</span>
            }
          />
          <div className="h-64 w-full px-2 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSeries} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey={lang === "ar" ? "day" : "dayEn"}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip
                  cursor={{ stroke: "#e7eaee" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e7eaee",
                    fontSize: 12,
                    boxShadow: "0 8px 30px rgba(15,23,42,0.12)",
                  }}
                  formatter={(v: number) => [egp(v, lang), t("kpi_revenue")]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  fill="url(#g)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status donut */}
        <Card>
          <SectionHeader title={t("orders_by_status")} />
          <div className="flex items-center gap-2 px-5 pb-5">
            <div className="h-40 w-40 shrink-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown as unknown as Record<string, number>[]}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {statusBreakdown.map((s) => (
                      <Cell key={s.key} fill={s.tone} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2">
              {statusBreakdown.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: s.tone }}
                  />
                  <span className="flex-1 text-ink-muted">{t(s.key as DictKey)}</span>
                  <span className="font-semibold text-ink">{s.value}</span>
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-ink-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                    <div className="text-xs text-ink-soft">
                      {num(p.sold, lang)} {lang === "ar" ? "عملية بيع" : "sold"}
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
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
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
