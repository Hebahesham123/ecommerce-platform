"use client";

import { useI18n, egp, num } from "@/lib/i18n";
import { orders } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";

// Aggregate unique customers from orders (mock derivation)
function buildCustomers() {
  const map = new Map<
    string,
    { name: string; phone: string; governorate: string; orders: number; spent: number; cod: number }
  >();
  for (const o of orders) {
    const c = map.get(o.phone) ?? {
      name: o.customer,
      phone: o.phone,
      governorate: o.governorate,
      orders: 0,
      spent: 0,
      cod: 0,
    };
    c.orders += 1;
    c.spent += o.total;
    if (o.method === "cod") c.cod += 1;
    map.set(o.phone, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}

export default function CustomersPage() {
  const { t, lang } = useI18n();
  const customers = buildCustomers();

  return (
    <>
      <PageHeader
        title={t("nav_customers")}
        subtitle={lang === "ar" ? "ملفات العملاء وسجل الشراء" : "Customer profiles & purchase history"}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("nav_orders")}</th>
                <th className="px-3 py-3 text-start font-medium">{lang === "ar" ? "إجمالي الإنفاق" : "Total spent"}</th>
                <th className="px-5 py-3 text-start font-medium">{t("cod")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phone} className="border-b border-line last:border-0 hover:bg-surface-page">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <div className="font-medium text-ink">{c.name}</div>
                        <div className="text-xs text-ink-soft" dir="ltr">{c.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{c.governorate}</td>
                  <td className="px-3 py-3.5 text-ink">{num(c.orders, lang)}</td>
                  <td className="px-3 py-3.5 font-medium text-ink">{egp(c.spent, lang)}</td>
                  <td className="px-5 py-3.5">
                    <span className="badge bg-slate-100 text-ink-muted">
                      {num(c.cod, lang)} / {num(c.orders, lang)}
                    </span>
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
