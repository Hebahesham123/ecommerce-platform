"use client";

import { useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  orders,
  labels,
  salesSeries,
  type Order,
  type Lifecycle,
  type Payment,
  type Fulfillment,
  type PayMethod,
} from "@/lib/data";
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
import { IcFile, IcX, IcChevron } from "@/components/icons";

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
      codShare: Math.round((cod / orders.length) * 100),
      unfulfilled,
      delivered,
    };
  }, []);
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
  }, [tab, q, payment, fulfillment, method, sort]);

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
                    className={`border-b border-line last:border-0 transition-colors hover:bg-surface-page ${
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
    </>
  );
}
