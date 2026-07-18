"use client";

import { Fragment, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  orders,
  type Order,
  type Lifecycle,
  type Payment,
  type Fulfillment,
  type PayMethod,
} from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, Badge, Dot } from "@/components/ui";
import {
  LifecycleBadge,
  PaymentBadge,
  FulfillmentBadge,
} from "@/components/status";
import {
  KpiRow,
  StatTile,
  Toolbar,
  SearchInput,
  Select,
  SegBtn,
} from "@/components/dashboard-ui";
import { IcOrders, IcCash, IcAlert, IcCourier, IcX } from "@/components/icons";

type QuickTab = "all" | "attention" | "today";
type LifecycleFilter = "all" | Lifecycle;
type PaymentFilter = "all" | Payment;
type FulfillmentFilter = "all" | Fulfillment;
type MethodFilter = "all" | PayMethod;
type SortKey = "newest" | "oldest" | "total_high" | "total_low";

type OrderFlag = NonNullable<Order["flag"]>;

const flagTone: Record<OrderFlag, string> = {
  fake_cod: "bg-rose-50 text-rose-700",
  return: "bg-slate-100 text-slate-600",
  unpaid_delivered: "bg-amber-50 text-amber-700",
};
const flagDot: Record<OrderFlag, string> = {
  fake_cod: "bg-rose-500",
  return: "bg-slate-400",
  unpaid_delivered: "bg-amber-500",
};

export default function OrdersPage() {
  const { t, lang } = useI18n();

  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  const [q, setQ] = useState("");
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [expanded, setExpanded] = useState<string | null>(null);

  function flagLabel(f: OrderFlag) {
    if (f === "fake_cod") return lang === "ar" ? "دفع وهمي" : "Fake COD";
    if (f === "return") return t("f_returned");
    return lang === "ar" ? "تم التسليم بدون تحصيل" : "Delivered unpaid";
  }

  // ---- KPIs (computed over the full dataset, independent of active filters) ----
  const latestDate = useMemo(
    () => orders.reduce((max, o) => (o.date > max ? o.date : max), orders[0]?.date ?? ""),
    [],
  );

  const kpi = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const codOrders = orders.filter((o) => o.method === "cod");
    const attention = orders.filter((o) => o.flag);
    const uncollected = codOrders
      .filter((o) => o.payment !== "paid" && o.payment !== "refunded")
      .reduce((s, o) => s + o.total, 0);
    return {
      total: orders.length,
      revenue,
      codCount: codOrders.length,
      codShare: orders.length ? Math.round((codOrders.length / orders.length) * 100) : 0,
      attentionCount: attention.length,
      uncollected,
    };
  }, []);

  // ---- Filter + sort ----
  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (quickTab === "attention" && !o.flag) return false;
      if (quickTab === "today" && o.date !== latestDate) return false;
      if (lifecycle !== "all" && o.lifecycle !== lifecycle) return false;
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
          return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
        case "total_high":
          return b.total - a.total;
        case "total_low":
          return a.total - b.total;
        default:
          return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      }
    });
    return sorted;
  }, [q, quickTab, lifecycle, payment, fulfillment, method, sort, latestDate]);

  const filtersActive =
    q !== "" ||
    quickTab !== "all" ||
    lifecycle !== "all" ||
    payment !== "all" ||
    fulfillment !== "all" ||
    method !== "all";

  function clearFilters() {
    setQ("");
    setQuickTab("all");
    setLifecycle("all");
    setPayment("all");
    setFulfillment("all");
    setMethod("all");
  }

  const sortLabels: Record<SortKey, string> = {
    newest: t("sort_newest"),
    oldest: t("sort_oldest"),
    total_high: lang === "ar" ? "الإجمالي: الأعلى أولاً" : "Total: High to low",
    total_low: lang === "ar" ? "الإجمالي: الأقل أولاً" : "Total: Low to high",
  };

  return (
    <>
      <PageHeader
        title={t("nav_orders")}
        subtitle={lang === "ar" ? "إدارة الطلبات بحالة ثلاثية المحاور" : "Three-axis order management"}
        actions={<button className="btn-outline">{t("export")}</button>}
      />

      {/* ---- KPI tiles ---- */}
      <div className="mb-4">
        <KpiRow cols={5}>
          <StatTile icon={IcOrders} label={t("kpi_orders")} value={num(kpi.total, lang)} accent="brand" />
          <StatTile icon={IcCash} label={t("kpi_revenue")} value={egp(kpi.revenue, lang)} accent="emerald" />
          <StatTile
            icon={IcCourier}
            label={t("cod")}
            value={num(kpi.codCount, lang)}
            sub={`${num(kpi.codShare, lang)}%`}
            accent="sky"
          />
          <StatTile
            icon={IcAlert}
            label={t("needs_attention")}
            value={num(kpi.attentionCount, lang)}
            accent="amber"
            active={quickTab === "attention"}
            onClick={() => setQuickTab(quickTab === "attention" ? "all" : "attention")}
          />
          <StatTile
            icon={IcCash}
            label={t("kpi_pending_cod")}
            value={egp(kpi.uncollected, lang)}
            accent="rose"
          />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        {/* ---- Quick tabs ---- */}
        <Toolbar>
          <div className="flex flex-wrap gap-1.5">
            <SegBtn active={quickTab === "all"} onClick={() => setQuickTab("all")}>
              {t("filter_all")}
            </SegBtn>
            <SegBtn active={quickTab === "attention"} onClick={() => setQuickTab("attention")}>
              <IcAlert className="h-3.5 w-3.5" />
              {t("needs_attention")}
            </SegBtn>
            <SegBtn active={quickTab === "today"} onClick={() => setQuickTab("today")}>
              {lang === "ar" ? "اليوم" : "Today"}
            </SegBtn>
          </div>
        </Toolbar>

        {/* ---- Filters ---- */}
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder={t("search")} />

          <Select value={lifecycle} onChange={(v) => setLifecycle(v as LifecycleFilter)}>
            <option value="all">{`${t("col_lifecycle")}: ${t("filter_all")}`}</option>
            <option value="placed">{t("s_placed")}</option>
            <option value="confirmed">{t("s_confirmed")}</option>
            <option value="packed">{t("s_packed")}</option>
            <option value="shipped">{t("s_shipped")}</option>
            <option value="completed">{t("s_completed")}</option>
            <option value="cancelled">{t("s_cancelled")}</option>
          </Select>

          <Select value={payment} onChange={(v) => setPayment(v as PaymentFilter)}>
            <option value="all">{`${t("col_payment")}: ${t("filter_all")}`}</option>
            <option value="pending">{t("p_pending")}</option>
            <option value="authorized">{t("p_authorized")}</option>
            <option value="paid">{t("p_paid")}</option>
            <option value="refunded">{t("p_refunded")}</option>
          </Select>

          <Select value={fulfillment} onChange={(v) => setFulfillment(v as FulfillmentFilter)}>
            <option value="all">{`${t("col_fulfillment")}: ${t("filter_all")}`}</option>
            <option value="unfulfilled">{t("f_unfulfilled")}</option>
            <option value="assigned">{t("f_assigned")}</option>
            <option value="out">{t("f_out")}</option>
            <option value="delivered">{t("f_delivered")}</option>
            <option value="returned">{t("f_returned")}</option>
          </Select>

          <Select value={method} onChange={(v) => setMethod(v as MethodFilter)}>
            <option value="all">{`${t("col_method")}: ${t("filter_all")}`}</option>
            <option value="cod">{t("cod")}</option>
            <option value="card">{t("card")}</option>
            <option value="wallet">{t("wallet")}</option>
          </Select>

          <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {`${t("sort_label")}: ${sortLabels[k]}`}
              </option>
            ))}
          </Select>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
            >
              <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
            </button>
          )}

          <span className="ms-auto text-xs text-ink-soft">
            {num(filteredSorted.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        {/* ---- Table ---- */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_order")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_date")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_total")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_payment")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_fulfillment")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_lifecycle")}</th>
                <th className="px-5 py-3 text-start font-medium">
                  {lang === "ar" ? "تنبيه" : "Flag"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : o.id)}
                      className={`cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-page ${
                        isOpen ? "bg-surface-page" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink" dir="ltr">
                          #{o.id}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="text-ink">{o.customer}</div>
                        <div className="text-xs text-ink-soft" dir="ltr">{o.phone}</div>
                      </td>
                      <td className="px-3 py-3.5 text-ink-muted">{o.governorate}</td>
                      <td className="px-3 py-3.5 text-ink-muted" dir="ltr">{o.date}</td>
                      <td className="px-3 py-3.5 text-end font-semibold text-ink">
                        {egp(o.total, lang)}
                      </td>
                      <td className="px-3 py-3.5">
                        <PaymentBadge v={o.payment} method={o.method} />
                      </td>
                      <td className="px-3 py-3.5">
                        <FulfillmentBadge v={o.fulfillment} />
                      </td>
                      <td className="px-3 py-3.5">
                        <LifecycleBadge v={o.lifecycle} />
                      </td>
                      <td className="px-5 py-3.5">
                        {o.flag ? (
                          <Badge className={`gap-1.5 ${flagTone[o.flag]}`}>
                            <Dot className={flagDot[o.flag]} />
                            {flagLabel(o.flag)}
                          </Badge>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-line bg-surface-page/60 last:border-0">
                        <td colSpan={9} className="px-5 py-3 text-xs text-ink-muted">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
                            <span>
                              {t("col_courier")}:{" "}
                              <span className="font-medium text-ink">
                                {o.courier ?? (lang === "ar" ? "لم يُعيّن بعد" : "Not assigned")}
                              </span>
                            </span>
                            {o.flag && (
                              <span>
                                {lang === "ar" ? "ملاحظة: " : "Note: "}
                                <span className="font-medium text-ink">{flagLabel(o.flag)}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {filteredSorted.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcOrders className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {lang === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders"}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{t("clear_filters")}</p>
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
    </>
  );
}
