"use client";

import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, SectionHeader } from "@/components/ui";
import { IcWhatsApp, IcMarketing, IcPlus } from "@/components/icons";

export default function MarketingPage() {
  const { t, lang } = useI18n();

  const campaigns = [
    { name: lang === "ar" ? "تخفيضات الصيف" : "Summer sale", channel: "WhatsApp", sent: 4200, rate: "98%", revenue: 21400, on: true },
    { name: lang === "ar" ? "استرجاع السلات" : "Cart recovery", channel: "WhatsApp", sent: 860, rate: "18%", revenue: 9600, on: true },
    { name: lang === "ar" ? "عملاء VIP" : "VIP customers", channel: "SMS", sent: 320, rate: "—", revenue: 5200, on: false },
  ];

  return (
    <>
      <PageHeader
        title={t("nav_marketing")}
        subtitle={lang === "ar" ? "حملات الواتساب والرسائل والاسترجاع" : "WhatsApp, SMS & cart recovery"}
        actions={
          <button className="btn-primary">
            <IcPlus className="h-4 w-4" /> {t("whatsapp_broadcast")}
          </button>
        }
      />

      {/* Quiet hours banner */}
      <Card className="mb-4 flex items-center gap-3 bg-emerald-50/60 p-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-card">
          🌙
        </span>
        <span className="text-sm font-medium text-emerald-800">{t("quiet_hours")}</span>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title={t("campaigns")} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-line text-xs text-ink-soft">
                  <th className="px-5 py-2.5 text-start font-medium">{t("campaigns")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("col_channel")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{lang === "ar" ? "أُرسلت" : "Sent"}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{lang === "ar" ? "فتح" : "Open"}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{t("kpi_revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.name} className="border-b border-line last:border-0 hover:bg-surface-page">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        {c.channel === "WhatsApp" ? (
                          <IcWhatsApp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <IcMarketing className="h-4 w-4 text-sky-500" />
                        )}
                        {c.name}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{c.channel}</td>
                    <td className="px-3 py-3.5 text-ink">{num(c.sent, lang)}</td>
                    <td className="px-3 py-3.5">
                      <span className="badge bg-emerald-50 text-emerald-700">{c.rate}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">{egp(c.revenue, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionHeader title={t("abandoned_carts")} />
          <div className="px-5 pb-5">
            <div className="text-3xl font-bold text-ink">{num(34, lang)}</div>
            <p className="mt-1 text-sm text-ink-muted">
              {lang === "ar" ? "سلة قابلة للاسترجاع بقيمة" : "Recoverable, worth"} {egp(18600, lang)}
            </p>
            <button className="btn-primary mt-4 w-full">
              <IcWhatsApp className="h-4 w-4" />
              {lang === "ar" ? "إرسال تذكير واتساب" : "Send WhatsApp reminder"}
            </button>
            <p className="mt-3 text-center text-xs text-ink-soft">
              {lang === "ar" ? "معدل استرجاع متوقع ١٠–٢٥٪" : "Expected 10–25% recovery"}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
