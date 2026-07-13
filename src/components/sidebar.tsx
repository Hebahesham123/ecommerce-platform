"use client";

import { useEffect, useState } from "react";
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
  IcDiscount,
  IcFile,
  IcTheme,
  IcChevron,
  IcMeta,
  IcInventory,
  IcLocation,
  IcAccounting,
} from "./icons";
import type { ComponentType, SVGProps } from "react";

type Item = {
  href: string;
  key: DictKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number;
};

type Group = { id: string; label: DictKey; items: Item[] };

const groups: Group[] = [
  {
    id: "store",
    label: "group_store",
    items: [
      { href: "/dashboard", key: "nav_overview", icon: IcOverview },
      { href: "/orders", key: "nav_orders", icon: IcOrders, badge: 7 },
      { href: "/products", key: "nav_products", icon: IcProducts },
      { href: "/customers", key: "nav_customers", icon: IcCustomers },
      { href: "/discounts", key: "nav_discounts", icon: IcDiscount },
      { href: "/couriers", key: "nav_couriers", icon: IcCourier },
    ],
  },
  {
    id: "inventory",
    label: "group_inventory",
    items: [
      { href: "/inventory", key: "nav_inventory", icon: IcInventory },
      { href: "/inventory/locations", key: "nav_locations", icon: IcLocation },
    ],
  },
  {
    id: "operations",
    label: "group_operations",
    items: [
      { href: "/accounting", key: "nav_accounting", icon: IcAccounting },
      { href: "/courier-system", key: "nav_courier_system", icon: IcCourier },
    ],
  },
  {
    id: "content",
    label: "group_content",
    items: [{ href: "/content/files", key: "nav_files", icon: IcFile }],
  },
  {
    id: "online_store",
    label: "group_online_store",
    items: [{ href: "/online-store/themes", key: "nav_themes", icon: IcTheme }],
  },
  {
    id: "channels",
    label: "group_channels",
    items: [{ href: "/channels/meta", key: "nav_meta", icon: IcMeta }],
  },
  {
    id: "engage",
    label: "group_engage",
    items: [
      { href: "/inbox", key: "nav_inbox", icon: IcInbox },
      { href: "/marketing", key: "nav_marketing", icon: IcMarketing },
    ],
  },
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

function CollapsibleGroup({ group }: { group: Group }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const hasActive = group.items.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  const [open, setOpen] = useState(hasActive);

  // Auto-open the group when you navigate into it, but let the chevron collapse it.
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);
  const expanded = open;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft transition-colors hover:text-ink-muted"
      >
        <IcChevron
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : "rotate-0"} rtl:-scale-x-100`}
        />
        <span className="flex-1 text-start">{t(group.label)}</span>
      </button>
      {expanded && (
        <div className="space-y-1">
          {group.items.map((i) => (
            <NavLink key={i.href} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const sidebarPath = usePathname();
  const pathnameSettingsActive = sidebarPath.startsWith("/settings");
  return (
    <div className="flex h-full flex-col gap-5 px-3 py-5" onClick={onNavigate}>
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-bold text-white">
          ف
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">{t("brand")}</div>
          <div className="text-[11px] text-ink-soft">Admin</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <CollapsibleGroup key={g.id} group={g} />
        ))}
      </nav>

      <Link
        href="/settings"
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          pathnameSettingsActive ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
        }`}
      >
        <IcSettings className={`h-5 w-5 ${pathnameSettingsActive ? "text-brand-600" : "text-ink-soft"}`} />
        {t("nav_settings")}
      </Link>
    </div>
  );
}
