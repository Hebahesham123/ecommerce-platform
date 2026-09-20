"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type DictKey } from "@/lib/i18n";
import { Sidebar } from "./sidebar";
import { IcOverview, IcOrders, IcProducts, IcInbox, IcMenu } from "./icons";

/**
 * The phone's navigation.
 *
 * A 64-point sidebar hidden behind a hamburger is a menu nobody opens, so the
 * four places a merchant actually lives go along the bottom, where a thumb
 * rests. Everything else is one tap away under "More", which slides the full
 * sidebar up as a drawer - the same one, not a second list to keep in step.
 */

const tabs: { href: string; key: DictKey; icon: typeof IcOverview }[] = [
  { href: "/dashboard", key: "nav_overview", icon: IcOverview },
  { href: "/orders", key: "nav_orders", icon: IcOrders },
  { href: "/products", key: "nav_products", icon: IcProducts },
  { href: "/inbox", key: "nav_inbox", icon: IcInbox },
];

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-brand-700" : "text-ink-soft"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate px-1">{t(tab.key)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-soft"
          >
            <IcMenu className="h-5 w-5" />
            <span>{t("nav_more")}</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={t("nav_more")}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82%] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex justify-center bg-surface py-2">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
