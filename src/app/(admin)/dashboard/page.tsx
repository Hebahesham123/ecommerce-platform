"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  type InventoryItem, totalAvailable, stockStatus,
} from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import { listStoreOrders, type PlacedOrder } from "../../store/actions";
import { PageHeader } from "@/components/page-header";
import { KpiCard, Panel, ChartFrame, chartAxis } from "@/components/analytics-ui";
import { CHART, useIsDark, type ChartColor } from "@/lib/chart-theme";

/**
 * The overview.
 *
 * Every figure on this page is the merchant's own orders and stock, counted
 * here - there is no sample series behind the chart and no placeholder revenue
 * when a store is quiet. A new store sees zeroes and an empty chart, which is
 * the truth, rather than a demo that flatters it.
 */

const DAYS = 14;

/** The last N days as ISO dates, oldest first. */
function lastDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

const dayOf = (iso: string) => String(iso).slice(0, 10);

/** How much this period is up or down on the one before it. */
function delta(now: number, before: number): number | undefined {
  if (!before) return undefined;
  return Math.round(((now - before) / before) * 100);
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const dark = useIsDark();
  const c = (k: ChartColor) => CHART[k][dark ? "dark" : "light"];

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Orders first, on their own: the figures at the top of the page should not
  // wait on a catalogue of a thousand products to finish loading.
  useEffect(() => {
    listStoreOrders()
      .then((ord) => ord.ok && setPlaced(ord.data))
      // A failed read still ends the wait: a skeleton that never resolves
      // reads as a broken page.
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    listInventory().then((inv) => inv.ok && setItems(inv.data));
  }, []);

  const live = useMemo(() => placed.filter((o) => o.lifecycle !== "cancelled"), [placed]);

  const days = useMemo(() => lastDays(DAYS), []);
  const series = useMemo(() => {
    const byDay = new Map(days.map((d) => [d, { sales: 0, orders: 0 }]));
    for (const o of live) {
      const slot = byDay.get(dayOf(o.createdAt || o.date));
      if (!slot) continue;
      slot.sales += o.total;
      slot.orders += 1;
    }
    return days.map((d) => ({
      day: d,
      label: new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }),
      ...byDay.get(d)!,
    }));
  }, [days, live, ar]);

  // This fortnight against the one before it, so a delta means something.
  const stats = useMemo(() => {
    const start = new Date(days[0]).getTime();
    const before = start - DAYS * 86400000;
    const inWindow = (o: PlacedOrder, from: number, to: number) => {
      const at = new Date(o.createdAt || o.date).getTime();
      return at >= from && at < to;
    };
    const nowOrders = live.filter((o) => inWindow(o, start, Date.now() + 86400000));
    const prevOrders = live.filter((o) => inWindow(o, before, start));
    const sum = (list: PlacedOrder[]) => list.reduce((s, o) => s + o.total, 0);
    const revenue = sum(nowOrders);
    const prevRevenue = sum(prevOrders);
    const aov = nowOrders.length ? Math.round(revenue / nowOrders.length) : 0;
    const prevAov = prevOrders.length ? Math.round(prevRevenue / prevOrders.length) : 0;
    const customers = new Set(nowOrders.map((o) => o.phone)).size;
    const prevCustomers = new Set(prevOrders.map((o) => o.phone)).size;
    return {
      revenue,
      revenueDelta: delta(revenue, prevRevenue),
      orders: nowOrders.length,
      ordersDelta: delta(nowOrders.length, prevOrders.length),
      aov,
      aovDelta: delta(aov, prevAov),
      customers,
      customersDelta: delta(customers, prevCustomers),
      allRevenue: sum(live),
      allOrders: live.length,
    };
  }, [live, days]);

  const stock = useMemo(() => {
    const low = items.filter((i) => stockStatus(totalAvailable(i)) === "low_stock");
    const out = items.filter((i) => totalAvailable(i) <= 0);
    return { low, out, needs: [...out, ...low].slice(0, 5) };
  }, [items]);

  const recentCustomers = useMemo(() => {
    const seen = new Map<string, { name: string; gov: string; total: number }>();
    for (const o of live) if (!seen.has(o.phone)) seen.set(o.phone, { name: o.customer, gov: o.governorate, total: o.total });
    return [...seen.values()].slice(0, 5);
  }, [live]);

  const period = ar ? `آخر ${DAYS} يوماً` : `Last ${DAYS} days`;

  return (
    <>
      <PageHeader
        title={t("nav_overview")}
        subtitle={
          ar
            ? `${period} · ${num(stats.allOrders, lang)} طلب بإجمالي ${egp(stats.allRevenue, lang)} منذ البداية.`
            : `${period} · ${num(stats.allOrders, lang)} orders worth ${egp(stats.allRevenue, lang)} all time.`
        }
        actions={
          <Link href="/shop" className="btn-outline h-10">
            {ar ? "زيارة المتجر" : "Visit store"}
          </Link>
        }
        primary={{ label: ar ? "إضافة منتج" : "Add product", href: "/inventory?new=1" }}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label={t("kpi_revenue")} value={egp(stats.revenue, lang)} delta={stats.revenueDelta} note={period} loading={loading} />
        <KpiCard label={t("kpi_orders")} value={num(stats.orders, lang)} delta={stats.ordersDelta} note={period} loading={loading} />
        <KpiCard label={t("kpi_aov")} value={egp(stats.aov, lang)} delta={stats.aovDelta} note={period} loading={loading} />
        <KpiCard label={ar ? "العملاء" : "Customers"} value={num(stats.customers, lang)} delta={stats.customersDelta} note={period} loading={loading} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={ar ? "الإيرادات" : "Revenue"}
          action={<span className="text-sm font-semibold text-ink">{egp(stats.revenue, lang)}</span>}
        >
          <ChartFrame empty={stats.orders === 0} emptyText={ar ? "لا طلبات في هذه الفترة." : "No orders in this period."}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,148,168,0.16)" />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                <YAxis {...chartAxis} width={52} tickFormatter={(v) => num(Number(v), lang)} />
                <Tooltip
                  cursor={{ stroke: "rgba(148,148,168,0.3)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs">
                        <div className="font-semibold text-ink">{label}</div>
                        <div className="mt-1 text-ink-muted">{egp(Number(payload[0].value), lang)}</div>
                      </div>
                    ) : null
                  }
                />
                <Area type="monotone" dataKey="sales" stroke={c("violet")} strokeWidth={2} fill={c("violet")} fillOpacity={0.08} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>

        <Panel
          title={ar ? "المخزون" : "Stock to watch"}
          action={
            <Link href="/inventory" className="text-sm font-medium text-brand-600 hover:underline">
              {t("view_all")}
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2 px-4 pb-1">
            <div className="rounded-xl border border-line px-3 py-2.5">
              <div className="kpi-label">{ar ? "قارب على النفاد" : "Low stock"}</div>
              <div className="mt-1 text-xl font-semibold text-ink">{num(stock.low.length, lang)}</div>
            </div>
            <div className="rounded-xl border border-line px-3 py-2.5">
              <div className="kpi-label">{ar ? "نفد" : "Out of stock"}</div>
              <div className="mt-1 text-xl font-semibold text-ink">{num(stock.out.length, lang)}</div>
            </div>
          </div>
          {stock.needs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-soft">{ar ? "كل المنتجات متوفرة." : "Everything is in stock."}</p>
          ) : (
            <ul className="px-2 py-2">
              {stock.needs.map((i) => (
                <li key={i.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{i.productName}</span>
                  <span className={`badge ${totalAvailable(i) <= 0 ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {num(totalAvailable(i), lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title={t("recent_orders")}
          action={<Link href="/orders" className="text-sm font-medium text-brand-600 hover:underline">{t("view_all")}</Link>}
        >
          {live.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-soft">{ar ? "لا توجد طلبات بعد." : "No orders yet."}</p>
          ) : (
            <ul className="px-2 pb-2">
              {live.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-page text-sm font-semibold text-ink-muted">
                    {o.customer.trim().charAt(0)}
                  </span>
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

        <Panel
          title={ar ? "أحدث العملاء" : "Recent customers"}
          action={<Link href="/customers" className="text-sm font-medium text-brand-600 hover:underline">{t("view_all")}</Link>}
        >
          {recentCustomers.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-soft">{ar ? "لا يوجد عملاء بعد." : "No customers yet."}</p>
          ) : (
            <ul className="px-2 pb-2">
              {recentCustomers.map((cust, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-page text-sm font-semibold text-ink-muted">
                    {cust.name.trim().charAt(0)}
                  </span>
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
