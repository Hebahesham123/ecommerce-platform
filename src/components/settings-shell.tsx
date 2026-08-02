"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { SECTIONS } from "@/lib/settings";
import {
  IcSettings, IcOverview, IcCash, IcCustomers, IcOrders, IcCourier,
  IcDiscount, IcBell, IcGlobe, IcContent,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  settings: IcSettings, overview: IcOverview, cash: IcCash, customers: IcCustomers,
  orders: IcOrders, courier: IcCourier, discount: IcDiscount, bell: IcBell,
  globe: IcGlobe, content: IcContent,
};

export function sectionIcon(name: string) {
  return ICONS[name] ?? IcSettings;
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = sectionIcon(s.icon);
            const active = pathname === `/settings/${s.key}`;
            return (
              <Link
                key={s.key}
                href={`/settings/${s.key}`}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-ink-soft"}`} />
                <span className="truncate">{s.label[lang]}</span>
              </Link>
            );
          })}
        </div>
      </aside>
      <div>{children}</div>
      {/* mobile: show settings link back */}
      <div className="lg:hidden">
        <Link href="/settings" className="text-sm font-medium text-brand-700">
          ← {t("nav_settings")}
        </Link>
      </div>
    </div>
  );
}
