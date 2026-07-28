"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  orders as mockOrders,
  labels,
  salesSeries,
  type Order,
  type Lifecycle,
  type Payment,
  type Fulfillment,
  type PayMethod,
} from "@/lib/data";
import { listStoreOrders } from "../../store/actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  KpiStrip,
  StatusPill,
  ViewTabs,
  Checkbox,
  Toolbar,
  SearchInput,
  Select,
  type PillTone,
} from "@/components/dashboard-ui";
import { IcFile, IcX, IcChevron, IcCash, IcCourier } from "@/components/icons";

type Tab = "all" | "unfulfilled" | "unpaid" | "open" | "attention";
type SortKey = "newest" | "oldest" | "total_high" | "total_low";

const paymentPill: Record<Payment, PillTone> = {
  pending: "warning",
  authorized: "info",
  paid: "success",
  refunded: "neutral",
};
const fulfillmentPill: Record<Fulfillment, PillTone> = {
  unfulfilled: "neutral",
  assigned: "info",
  out: "attention",
  delivered: "success",
  returned: "critical",
};

type OrderFlag = NonNullable<Order["flag"]>;
const flagPill: Record<OrderFlag, PillTone> = {
  fake_cod: "critical",
  return: "neutral",
  unpaid_delivered: "warning",
};

export default function OrdersPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<"all" | Payment>("all");
  const [fulfillment, setFulfillment] = useState<"all" | Fulfillment>("all");
  const [method, setMethod] = useState<"all" | PayMethod>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Order | null>(null);
  const [placed, setPlaced] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      const res = await listStoreOrders();
      if (res.ok) {
        setPlaced(
          res.data.map((o): Order => ({
            id: o.id,
            customer: o.customer,
            phone: o.phone,
            governorate: o.governorate,
            total: o.total,
            method: o.method,
            lifecycle: o.lifecycle,
            payment: o.payment,
            fulfillment: o.fulfillment,
            date: o.date,
          })),
        );
      }
    })();
  }, []);

  // Real placed orders first, then the demo orders.
  const orders = useMemo(() => [...placed, ...mockOrders], [placed]);

  const ar = lang === "ar";
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });

  const flagLabel = (f: OrderFlag) =>
    f === "fake_cod"
      ? ar
        ? "اشتباه وهمي"
        : "Suspected fake"
      : f === "unpaid_delivered"
        ? ar
          ? "سُلّم بدون تحصيل"
          : "Unpaid, delivered"
        : ar
          ? "مرتجع"
          : "Return";

  // ---- KPIs + sparklines ----
  const kpi = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const cod = orders.filter((o) => o.method === "cod").length;
    const unfulfilled = orders.filter((o) => o.fulfillment === "unfulfilled").length;
    const delivered = orders.filter((o) => o.fulfillment === "delivered").length;
    return {
      count: orders.length,
      revenue,
      codShare: orders.length ? Math.round((cod / orders.length) * 100) : 0,
      unfulfilled,
      delivered,
    };
  }, [orders]);
  const ordersSpark = salesSeries.map((s) => s.orders);
  const salesSpark = salesSeries.map((s) => s.sales);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "unfulfilled", label: t("f_unfulfilled") },
    { key: "unpaid", label: t("p_pending") },
    { key: "open", label: ar ? "مفتوحة" : "Open" },
    { key: "attention", label: t("needs_attention") },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (tab === "unfulfilled" && o.fulfillment !== "unfulfilled") return false;
      if (tab === "unpaid" && o.payment !== "pending") return false;
      if (tab === "open" && (o.lifecycle === "completed" || o.lifecycle === "cancelled"))
        return false;
      if (tab === "attention" && !o.flag) return false;
      if (payment !== "all" && o.payment !== payment) return false;
      if (fulfillment !== "all" && o.fulfillment !== fulfillment) return false;
      if (method !== "all" && o.method !== method) return false;
      if (needle) {
        const hay = `${o.id} ${o.customer} ${o.phone} ${o.governorate}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.date.localeCompare(b.date);
        case "total_high":
          return b.total - a.total;
        case "total_low":
          return a.total - b.total;
        default:
          return b.date.localeCompare(a.date) || Number(b.id) - Number(a.id);
      }
    });
    return sorted;
  }, [orders, tab, q, payment, fulfillment, method, sort]);

  const filtersActive = q !== "" || payment !== "all" || fulfillment !== "all" || method !== "all";
  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const someSelected = filtered.some((o) => selected.has(o.id));

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(filtered.map((o) => o.id));
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <>
      <PageHeader
        title={t("nav_orders")}
        subtitle={ar ? "إدارة ومتابعة الطلبات" : "Manage & track orders"}
        actions={
          <>
            <button className="btn-outline">{t("export")}</button>
            <button className="btn-primary">{ar ? "إنشاء طلب" : "Create order"}</button>
          </>
        }
      />

      <div className="mb-4">
        <KpiStrip
          period={
            <span className="inline-flex items-center gap-1.5">
              {ar ? "اليوم" : "Today"}
              <IcChevron className="h-3.5 w-3.5 rotate-90 text-ink-soft" />
            </span>
          }
          segments={[
            { label: t("kpi_orders"), value: num(kpi.count, lang), delta: 12, data: ordersSpark, tone: "brand" },
            { label: t("kpi_revenue"), value: egp(kpi.revenue, lang), delta: 8, data: salesSpark, tone: "emerald" },
            { label: t("kpi_cod_share"), value: `${kpi.codShare}%`, delta: -4, data: ordersSpark, tone: "slate" },
            {
              label: t("f_unfulfilled"),
              value: num(kpi.unfulfilled, lang),
              tone: "slate",
              active: tab === "unfulfilled",
              onClick: () => setTab(tab === "unfulfilled" ? "all" : "unfulfilled"),
            },
            { label: t("f_delivered"), value: num(kpi.delivered, lang), data: ordersSpark, tone: "emerald" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
        </div>

        {/* Toolbar or bulk bar */}
        {someSelected ? (
          <div className="flex items-center gap-3 border-b border-line bg-brand-50/50 px-3 py-2.5">
            <span className="text-sm font-medium text-ink">
              {num([...selected].length, lang)} {ar ? "محدد" : "selected"}
            </span>
            <button className="btn-outline h-8 px-3 text-xs">{ar ? "تعليم كمنفّذ" : "Mark fulfilled"}</button>
            <button className="btn-outline h-8 px-3 text-xs">{t("export")}</button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost ms-auto h-8 px-2 text-xs">
              <IcX className="h-3.5 w-3.5" /> {ar ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>
        ) : (
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder={t("search")} />
            <Select value={payment} onChange={(v) => setPayment(v as "all" | Payment)}>
              <option value="all">{t("col_payment")}</option>
              {(["pending", "authorized", "paid", "refunded"] as Payment[]).map((p) => (
                <option key={p} value={p}>{t(labels.paymentKey[p])}</option>
              ))}
            </Select>
            <Select value={fulfillment} onChange={(v) => setFulfillment(v as "all" | Fulfillment)}>
              <option value="all">{t("col_fulfillment")}</option>
              {(["unfulfilled", "assigned", "out", "delivered", "returned"] as Fulfillment[]).map((f) => (
                <option key={f} value={f}>{t(labels.fulfillmentKey[f])}</option>
              ))}
            </Select>
            <Select value={method} onChange={(v) => setMethod(v as "all" | PayMethod)}>
              <option value="all">{ar ? "طريقة الدفع" : "Method"}</option>
              {(["cod", "card", "wallet"] as PayMethod[]).map((m) => (
                <option key={m} value={m}>{t(labels.methodKey[m])}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
              <option value="newest">{t("sort_label")}: {ar ? "الأحدث" : "Newest"}</option>
              <option value="oldest">{ar ? "الأقدم" : "Oldest"}</option>
              <option value="total_high">{ar ? "الأعلى قيمة" : "Total high → low"}</option>
              <option value="total_low">{ar ? "الأقل قيمة" : "Total low → high"}</option>
            </Select>
            {filtersActive && (
              <button
                onClick={() => { setPayment("all"); setFulfillment("all"); setMethod("all"); setQ(""); }}
                className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
              >
                <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
              </button>
            )}
            <span className="ms-auto text-xs text-ink-soft">
              {num(filtered.length, lang)} {t("results_word")}
            </span>
          </Toolbar>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="w-10 ps-5 pe-2 py-3">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th className="px-3 py-3 text-start font-medium">{t("col_order")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_date")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_total")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_payment")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_fulfillment")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("col_governorate")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const sel = selected.has(o.id);
                return (
                  <tr
                    key={o.id}
                    onClick={() => setDetail(o)}
                    className={`cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-page ${
                      sel ? "bg-brand-50/40" : ""
                    }`}
                  >
                    <td className="ps-5 pe-2 py-3.5">
                      <Checkbox checked={sel} onChange={() => toggleOne(o.id)} />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">#{o.id}</span>
                        {o.flag && <IcFile className="h-3.5 w-3.5 text-ink-soft" />}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{fmtDate(o.date)}</td>
                    <td className="px-3 py-3.5">
                      <div className="font-medium text-ink">{o.customer}</div>
                      <div className="text-xs text-ink-soft" dir="ltr">{o.phone}</div>
                    </td>
                    <td className="px-3 py-3.5 text-end font-semibold text-ink">
                      {egp(o.total, lang)}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill
                        label={t(labels.paymentKey[o.payment])}
                        tone={paymentPill[o.payment]}
                        hollow={o.payment === "pending"}
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill
                        label={t(labels.fulfillmentKey[o.fulfillment])}
                        tone={fulfillmentPill[o.fulfillment]}
                        hollow={o.fulfillment === "unfulfilled"}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-muted">{o.governorate}</span>
                        {o.flag && <StatusPill label={flagLabel(o.flag)} tone={flagPill[o.flag]} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="font-semibold text-ink">{ar ? "لا توجد طلبات مطابقة" : "No matching orders"}</div>
              <p className="mt-1 text-sm text-ink-soft">
                {ar ? "جرّب تعديل الفلاتر." : "Try adjusting your filters."}
              </p>
            </div>
          )}
        </div>
      </Card>

      {detail && (
        <OrderDetailDrawer
          order={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

// ---- Order detail drawer (Shopify-style) ------------------------------------
function OrderDetailDrawer({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const balance = o.payment === "paid" ? 0 : o.total;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">#{o.id}</h2>
              <StatusPill label={t(labels.paymentKey[o.payment])} tone={paymentPill[o.payment]} hollow={o.payment === "pending"} />
              <StatusPill label={t(labels.fulfillmentKey[o.fulfillment])} tone={fulfillmentPill[o.fulfillment]} hollow={o.fulfillment === "unfulfilled"} />
            </div>
            <p className="mt-1 text-xs text-ink-soft">{fmt(o.date)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 shrink-0 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {o.flag && (
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {flagLabelStatic(o.flag, ar)}
            </div>
          )}

          {/* Payment summary */}
          <div className="rounded-2xl border border-line">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              {ar ? "ملخص الدفع" : "Payment"}
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <Row label={ar ? "الإجمالي الفرعي" : "Subtotal"} value={egp(o.total, lang)} />
              <Row label={ar ? "الشحن" : "Shipping"} value={egp(0, lang)} muted />
              <div className="my-1 border-t border-line" />
              <Row label={ar ? "الإجمالي" : "Total"} value={egp(o.total, lang)} bold />
              <Row label={ar ? "المدفوع" : "Paid"} value={egp(o.total - balance, lang)} muted />
              <Row label={ar ? "المتبقي" : "Balance"} value={egp(balance, lang)} bold />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
              {balance > 0 && (
                <button className="btn-primary h-9">
                  <IcCash className="h-4 w-4" /> {ar ? "تحصيل الدفع" : "Collect payment"}
                </button>
              )}
              {o.fulfillment === "unfulfilled" && (
                <button className="btn-outline h-9">{ar ? "تعليم كمنفّذ" : "Mark fulfilled"}</button>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-2xl border border-line px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-ink">{ar ? "العميل" : "Customer"}</div>
            <div className="text-sm font-medium text-ink">{o.customer}</div>
            <div className="mt-0.5 text-sm text-ink-muted" dir="ltr">{o.phone}</div>
            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {ar ? "عنوان الشحن" : "Shipping address"}
            </div>
            <div className="mt-1 text-sm text-ink-muted">{o.governorate}، {ar ? "مصر" : "Egypt"}</div>
          </div>

          {/* Fulfillment / courier */}
          <div className="rounded-2xl border border-line px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <IcCourier className="h-4 w-4 text-ink-soft" /> {t("col_fulfillment")}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("col_courier")}</span>
              <span className="font-medium text-ink">{o.courier || (ar ? "غير معيّن" : "Unassigned")}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-ink-muted">{ar ? "طريقة الدفع" : "Method"}</span>
              <span className="font-medium text-ink">{t(labels.methodKey[o.method])}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("col_lifecycle")}</span>
              <span className="font-medium text-ink">{t(labels.lifecycleKey[o.lifecycle])}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button onClick={onClose} className="btn-outline">{ar ? "إغلاق" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-ink-soft" : "text-ink-muted"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : muted ? "text-ink-soft" : "text-ink"}>{value}</span>
    </div>
  );
}

function flagLabelStatic(f: OrderFlag, ar: boolean) {
  return f === "fake_cod"
    ? ar ? "اشتباه طلب وهمي — يُنصح بالتأكيد قبل الشحن." : "Suspected fake COD — confirm before shipping."
    : f === "unpaid_delivered"
      ? ar ? "تم التسليم بدون تحصيل النقدية." : "Delivered but cash not collected."
      : ar ? "طلب مرتجع." : "Returned order.";
}
