"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { KpiRow, StatTile, StatusPill } from "@/components/dashboard-ui";
import { IcOrders, IcCash, IcAlert, IcInventory, IcInbox, IcCourier, IcChevron, IcClipboard } from "@/components/icons";
import { collectionMethodLabel, type Shipment } from "@/lib/courier";
import { courierCashSummary, listShipments, type CourierCash } from "../couriers/actions";
import { listWarehouse, listRequests, listLogs } from "./actions";
import { logActionLabel, LOG_ACTION, type CourierLog, type CourierRequest, type WarehouseItem } from "@/lib/courier-ops";

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function CourierSystemDashboard() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [cash, setCash] = useState<CourierCash[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseItem[]>([]);
  const [requests, setRequests] = useState<CourierRequest[]>([]);
  const [logs, setLogs] = useState<CourierLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cc, sh, wh, rq, lg] = await Promise.all([
      courierCashSummary(),
      listShipments(),
      listWarehouse({ status: "in_warehouse" }),
      listRequests(),
      listLogs(),
    ]);
    if (cc.ok) setCash(cc.data);
    if (sh.ok) setShipments(sh.data);
    if (wh.ok) setWarehouse(wh.data);
    if (rq.ok) setRequests(rq.data);
    if (lg.ok) setLogs(lg.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeDeliveries = cash.reduce((s, c) => s + c.active, 0);
  const cashInHand = cash.reduce((s, c) => s + c.cashPending, 0);
  const deliveredToday = useMemo(
    () => shipments.filter((s) => s.status === "delivered" && isToday(s.confirmedAt)).length,
    [shipments],
  );
  const pendingReports = useMemo(() => shipments.filter((s) => s.reportedStatus).length, [shipments]);
  const openRequests = useMemo(() => requests.filter((r) => r.status === "pending" || r.status === "process").length, [requests]);

  // Collection by method: sum collected cash grouped by how it was taken.
  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const sh of shipments) {
      if (sh.cashCollected > 0) {
        const key = sh.collectedMethod || "cash";
        m.set(key, (m.get(key) ?? 0) + sh.cashCollected);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [shipments]);
  const totalCollected = byMethod.reduce((s, [, v]) => s + v, 0);

  const recentLogs = logs.slice(0, 10);

  return (
    <>
      <PageHeader
        title={t("nav_courier_system")}
        subtitle={ar ? "لوحة متابعة الشحن: التوصيلات، النقدية، المستودع والطلبات" : "Deliveries, cash, warehouse & requests at a glance"}
        actions={
          <Link href="/courier" target="_blank" rel="noopener noreferrer" className="btn-outline h-10">
            <IcCourier className="h-4 w-4" /> {ar ? "بوابة المندوب" : "Courier portal"}
          </Link>
        }
      />

      <div className="mb-4">
        <KpiRow cols={3}>
          <StatTile icon={IcOrders} label={ar ? "توصيلات نشطة" : "Active deliveries"} value={num(activeDeliveries, lang)} accent="sky" />
          <StatTile icon={IcOrders} label={ar ? "سُلّم اليوم" : "Delivered today"} value={num(deliveredToday, lang)} accent="emerald" />
          <StatTile icon={IcCash} label={ar ? "نقدية بالعُهدة" : "Cash in hand"} value={egp(cashInHand, lang)} accent="amber" />
          <StatTile icon={IcAlert} label={ar ? "تقارير معلّقة" : "Pending reports"} value={num(pendingReports, lang)} accent="rose" />
          <StatTile icon={IcInventory} label={ar ? "في المستودع" : "In warehouse"} value={num(warehouse.length, lang)} accent="violet" />
          <StatTile icon={IcInbox} label={ar ? "طلبات مفتوحة" : "Open requests"} value={num(openRequests, lang)} accent="brand" />
        </KpiRow>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Collection by method */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink">{ar ? "التحصيل حسب الوسيلة" : "Collection by method"}</span>
            <span className="text-xs text-ink-soft">{egp(totalCollected, lang)}</span>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-soft">{t("loading")}</div>
          ) : byMethod.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-soft">{ar ? "لا تحصيل بعد" : "No collections yet"}</div>
          ) : (
            <ul className="divide-y divide-line">
              {byMethod.map(([method, amount]) => {
                const pct = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
                return (
                  <li key={method} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{collectionMethodLabel(method, ar)}</span>
                      <span className="font-semibold text-ink">{egp(amount, lang)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-page">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-9 text-end text-xs text-ink-soft">{num(pct, lang)}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Latest audit log */}
        <Card className="overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><IcClipboard className="h-4 w-4 text-ink-soft" /> {ar ? "أحدث العمليات" : "Latest activity"}</span>
            <Link href="/courier-system/logs" className="text-xs font-semibold text-brand-600 hover:underline">{ar ? "عرض الكل" : "View all"}</Link>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-soft">{t("loading")}</div>
          ) : recentLogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-soft">{ar ? "لا عمليات بعد" : "No activity yet"}</div>
          ) : (
            <ul className="divide-y divide-line">
              {recentLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusPill label={logActionLabel(l.action, ar)} tone={LOG_ACTION[l.action]?.tone ?? "neutral"} />
                    {l.orderNumber && <span className="shrink-0 text-xs font-semibold text-ink" dir="ltr">#{l.orderNumber}</span>}
                    <span className="truncate text-xs text-ink-soft">{l.detail}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-soft" dir="ltr">{new Date(l.createdAt).toLocaleString(ar ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink href="/courier-system/requests" icon={IcInbox} title={ar ? "الطلبات" : "Requests"} sub={ar ? `${num(openRequests, lang)} مفتوحة` : `${num(openRequests, lang)} open`} ar={ar} />
        <QuickLink href="/courier-system/warehouse" icon={IcInventory} title={ar ? "المستودع" : "Warehouse"} sub={ar ? `${num(warehouse.length, lang)} عنصر` : `${num(warehouse.length, lang)} items`} ar={ar} />
        <QuickLink href="/courier-system/users" icon={IcCourier} title={ar ? "المستخدمون" : "Users"} sub={ar ? "المندوبون والموظفون" : "Couriers & staff"} ar={ar} />
      </div>
    </>
  );
}

function QuickLink({ href, icon: Icon, title, sub, ar }: { href: string; icon: typeof IcInbox; title: string; sub: string; ar: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-pop">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{title}</div>
        <div className="truncate text-xs text-ink-soft">{sub}</div>
      </div>
      <IcChevron className={`h-4 w-4 text-ink-soft transition-transform group-hover:translate-x-0.5 ${ar ? "rotate-180" : ""}`} />
    </Link>
  );
}
