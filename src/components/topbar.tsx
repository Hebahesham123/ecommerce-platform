"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Sidebar } from "./sidebar";
import { useCommandPalette } from "./command-palette";
import { IcSearch, IcBell, IcGlobe, IcMenu } from "./icons";

export function Topbar() {
  const { t, lang, toggle } = useI18n();
  const { setOpen } = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
    // Admin defaults to dark unless the user explicitly chose light (also
    // re-applies dark when returning from the always-light storefront).
    let wantDark = true;
    try {
      wantDark = localStorage.getItem("theme") !== "light";
    } catch {}
    document.documentElement.classList.toggle("dark", wantDark);
    setDark(wantDark);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur md:px-6">
        <button
          className="btn-ghost -ms-2 p-2 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <IcMenu />
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative hidden h-10 max-w-md flex-1 items-center rounded-xl border border-line bg-surface-page ps-10 pe-3 text-start text-sm text-ink-soft transition hover:border-brand-600 hover:bg-surface sm:flex"
        >
          <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <span className="flex-1 truncate">{t("search")}</span>
          <kbd className="ms-2 hidden shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-soft md:block">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>

        <div className="ms-auto flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="btn-ghost p-2.5"
            aria-label="Toggle theme"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>
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
            <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" />
          </button>
          <div className="ms-1 flex items-center gap-2.5 ps-1">
            <div className="hidden text-end leading-tight sm:block">
              <div className="text-sm font-semibold text-ink">{t("greeting")}</div>
              <div className="text-[11px] text-ink-soft">{t("nav_settings")}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
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
          <div className="absolute inset-y-0 start-0 w-72 bg-surface shadow-pop">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
