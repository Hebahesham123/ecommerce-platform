"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { SECTIONS } from "@/lib/settings";
import { sectionIcon } from "@/components/settings-shell";

export default function SettingsHome() {
  const { t, lang } = useI18n();
  return (
    <>
      <PageHeader title={t("nav_settings")} subtitle={lang === "ar" ? "إعدادات المتجر" : "Store settings"} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = sectionIcon(s.icon);
          return (
            <Link key={s.key} href={`/settings/${s.key}`} className="card p-4 transition-shadow hover:shadow-pop">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{s.label[lang]}</div>
                  <p className="mt-0.5 text-sm text-ink-soft">{s.desc[lang]}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
