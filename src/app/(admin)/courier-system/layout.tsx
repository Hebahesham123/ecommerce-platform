"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useI18n } from "@/lib/i18n";
import { IcOverview, IcInbox, IcInventory, IcClipboard, IcCustomers, IcCourier, IcLink, IcAccounting } from "@/components/icons";

type Tab = { href: string; ar: string; en: string; icon: ComponentType<SVGProps<SVGSVGElement>>; exact?: boolean };

const TABS: Tab[] = [
  { href: "/courier-system", ar: "لوحة التحكم", en: "Dashboard", icon: IcOverview, exact: true },
  { href: "/courier-system/requests", ar: "الطلبات", en: "Requests", icon: IcInbox },
  { href: "/courier-system/warehouse", ar: "المستودع", en: "Warehouse", icon: IcInventory },
  { href: "/courier-system/accounting", ar: "محاسبة المندوبين", en: "Courier accounting", icon: IcAccounting },
  { href: "/courier-system/logs", ar: "السجل", en: "Logs", icon: IcClipboard },
  { href: "/courier-system/users", ar: "المستخدمون", en: "Users", icon: IcCustomers },
];

export default function CourierSystemLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const pathname = usePathname();

  const isActive = (t: Tab) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <nav className="mb-5 flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-sm">
        {TABS.map((t) => {
          const active = isActive(t);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {ar ? t.ar : t.en}
            </Link>
          );
        })}
        <a
          href="/courier"
          target="_blank"
          rel="noopener noreferrer"
          className="ms-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <IcCourier className="h-4 w-4" />
          {ar ? "بوابة المندوب" : "Courier portal"}
          <IcLink className="h-3.5 w-3.5 opacity-70" />
        </a>
      </nav>
      {children}
    </div>
  );
}
