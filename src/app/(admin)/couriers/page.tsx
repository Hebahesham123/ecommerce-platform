"use client";

import { useI18n, egp, num } from "@/lib/i18n";
import { couriers } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { IcCash } from "@/components/icons";

export default function CouriersPage() {
  const { t, lang } = useI18n();

  const totalPending = couriers.reduce((s, c) => s + c.cashPending, 0);
  const totalCollected = couriers.reduce((s, c) => s + c.cashCollected, 0);
  const totalActive = couriers.reduce((s, c) => s + c.active, 0);

  const summary = [
    { key: "courier_cash" as const, value: egp(totalCollected, lang), tone: "text-emerald-600" },
    { key: "courier_pending" as const, value: egp(totalPending, lang), tone: "text-amber-600" },
    { key: "active_deliveries" as const, value: num(totalActive, lang), tone: "text-ink" },
  ];

  return (
    <>
      <PageHeader
        title={t("nav_couriers")}
        subtitle={lang === "ar" ? "إدارة المندوبين وتسوية النقدية (الدفع عند الاستلام)" : "Courier management & COD reconciliation"}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.key} className="p-4">
            <div className="text-sm text-ink-muted">{t(s.key)}</div>
            <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_courier")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("active_deliveries")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("courier_cash")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("courier_pending")}</th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-page">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <div className="font-medium text-ink">{c.name}</div>
                        <div className="text-xs text-ink-soft">
                          {num(c.delivered, lang)} {lang === "ar" ? "تسليم" : "delivered"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{c.zone}</td>
                  <td className="px-3 py-3.5">
                    <span className="badge bg-sky-50 text-sky-700">{num(c.active, lang)}</span>
                  </td>
                  <td className="px-3 py-3.5 font-medium text-emerald-700">
                    {egp(c.cashCollected, lang)}
                  </td>
                  <td className="px-3 py-3.5 font-medium text-amber-700">
                    {egp(c.cashPending, lang)}
                  </td>
                  <td className="px-5 py-3.5 text-end">
                    <button className="btn-outline h-8 gap-1.5 px-3 text-xs">
                      <IcCash className="h-3.5 w-3.5" /> {t("reconcile")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
