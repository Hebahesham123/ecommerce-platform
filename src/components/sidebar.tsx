"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type DictKey } from "@/lib/i18n";
import {
  IcOverview,
  IcOrders,
  IcProducts,
  IcCustomers,
  IcCourier,
  IcInbox,
  IcMarketing,
  IcSettings,
} from "./icons";
import type { ComponentType, SVGProps } from "react";

type Item = {
  href: string;
  key: DictKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number;
};

const store: Item[] = [
  { href: "/dashboard", key: "nav_overview", icon: IcOverview },
  { href: "/orders", key: "nav_orders", icon: IcOrders, badge: 7 },
  { href: "/products", key: "nav_products", icon: IcProducts },
  { href: "/customers", key: "nav_customers", icon: IcCustomers },
  { href: "/couriers", key: "nav_couriers", icon: IcCourier },
];
const engage: Item[] = [
  { href: "/inbox", key: "nav_inbox", icon: IcInbox, badge: 3 },
  { href: "/marketing", key: "nav_marketing", icon: IcMarketing },
];

function NavLink({ item }: { item: Item }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-muted hover:bg-surface-hover hover:text-ink"
      }`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${active ? "text-brand-600" : "text-ink-soft group-hover:text-ink-muted"}`}
      />
      <span className="flex-1 truncate">{t(item.key)}</span>
      {item.badge ? (
        <span
          className={`badge ${active ? "bg-brand text-white" : "bg-slate-100 text-ink-muted"}`}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5" onClick={onNavigate}>
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-bold text-white">
          ف
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">{t("brand")}</div>
          <div className="text-[11px] text-ink-soft">Admin</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {t("group_store")}
          </p>
          {store.map((i) => (
            <NavLink key={i.href} item={i} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {t("group_engage")}
          </p>
          {engage.map((i) => (
            <NavLink key={i.href} item={i} />
          ))}
        </div>
      </nav>

      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-hover hover:text-ink"
      >
        <IcSettings className="h-5 w-5 text-ink-soft" />
        {t("nav_settings")}
      </Link>
    </div>
  );
}
