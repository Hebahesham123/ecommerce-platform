"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Sidebar } from "./sidebar";
import { IcSearch, IcBell, IcGlobe, IcMenu } from "./icons";

export function Topbar() {
  const { t, lang, toggle } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur md:px-6">
        <button
          className="btn-ghost -ms-2 p-2 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <IcMenu />
        </button>

        <div className="relative hidden max-w-md flex-1 sm:block">
          <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            placeholder={t("search")}
            className="h-10 w-full rounded-xl border border-line bg-surface-page ps-10 pe-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="ms-auto flex items-center gap-1.5">
          <button
            onClick={toggle}
            className="btn-outline h-10 gap-1.5 px-3 text-xs font-semibold"
            title="Switch language"
          >
            <IcGlobe className="h-4 w-4" />
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button className="btn-ghost relative p-2.5" aria-label="Notifications">
            <IcBell />
            <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-white" />
          </button>
          <div className="ms-1 flex items-center gap-2.5 ps-1">
            <div className="hidden text-end leading-tight sm:block">
              <div className="text-sm font-semibold text-ink">{t("greeting")}</div>
              <div className="text-[11px] text-ink-soft">{t("nav_settings")}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
              H
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 bg-white shadow-pop">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
