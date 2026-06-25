"use client";

import { useState } from "react";
import { useI18n, egp } from "@/lib/i18n";
import { orders, type Order } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  LifecycleBadge,
  PaymentBadge,
  FulfillmentBadge,
} from "@/components/status";
import { IcSearch } from "@/components/icons";

type Filter = "all" | "cod" | "unfulfilled" | "flagged";

export default function OrdersPage() {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filter_all"), count: orders.length },
    { key: "cod", label: t("cod"), count: orders.filter((o) => o.method === "cod").length },
    {
      key: "unfulfilled",
      label: t("f_unfulfilled"),
      count: orders.filter((o) => o.fulfillment === "unfulfilled").length,
    },
    {
      key: "flagged",
      label: t("needs_attention"),
      count: orders.filter((o) => o.flag).length,
    },
  ];

  const rows = orders.filter((o) => {
    if (filter === "cod" && o.method !== "cod") return false;
    if (filter === "unfulfilled" && o.fulfillment !== "unfulfilled") return false;
    if (filter === "flagged" && !o.flag) return false;
    if (q && !`${o.id} ${o.customer} ${o.phone}`.includes(q)) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title={t("nav_orders")}
        subtitle={lang === "ar" ? "إدارة الطلبات بحالة ثلاثية المحاور" : "Three-axis order management"}
        actions={<button className="btn-outline">{t("export")}</button>}
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  filter === f.key
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    filter === f.key ? "bg-white/20" : "bg-white text-ink-soft"
                  }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative ms-auto">
            <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              className="h-9 w-56 rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_order")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_total")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_lifecycle")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_payment")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("col_fulfillment")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o: Order) => (
                <tr
                  key={o.id}
                  className="border-t border-line transition-colors hover:bg-surface-page"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-ink">#{o.id}</div>
                    <div className="text-xs text-ink-soft" dir="ltr">{o.date}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="text-ink">{o.customer}</div>
                    <div className="text-xs text-ink-soft" dir="ltr">{o.phone}</div>
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{o.governorate}</td>
                  <td className="px-3 py-3.5 font-medium text-ink">{egp(o.total, lang)}</td>
                  <td className="px-3 py-3.5">
                    <LifecycleBadge v={o.lifecycle} />
                  </td>
                  <td className="px-3 py-3.5">
                    <PaymentBadge v={o.payment} method={o.method} />
                  </td>
                  <td className="px-5 py-3.5">
                    <FulfillmentBadge v={o.fulfillment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-12 text-center text-sm text-ink-soft">
              {lang === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders"}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
