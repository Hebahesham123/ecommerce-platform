"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Theme } from "@/lib/themes";
import { IcX, IcDesktop, IcMobile, IcLink, IcRefresh } from "@/components/icons";

/** Pages every storefront has — lets you click through the theme in the preview. */
const NAV: { path: string; ar: string; en: string }[] = [
  { path: "/", ar: "الرئيسية", en: "Home" },
  { path: "/collections", ar: "التصنيفات", en: "Collections" },
  { path: "/collections/all", ar: "كل المنتجات", en: "All products" },
  { path: "/search", ar: "البحث", en: "Search" },
  { path: "/cart", ar: "السلة", en: "Cart" },
];

export function ThemePreview({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [path, setPath] = useState("/");
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Served by our own route as text/html, wired to live products/collections.
  const base = `/online-store/themes/${theme.id}/preview`;
  // Refresh re-requests the page but does NOT pass fresh=1: that would skip the
  // cached bundle and re-fetch the theme file by file, costing several seconds.
  // Editing or re-uploading a theme purges that cache on its own, so a plain
  // reload already shows current content.
  const src = useMemo(
    () => `${base}${path === "/" ? "" : path}${nonce ? `${path.includes("?") ? "&" : "?"}r=${nonce}` : ""}`,
    [base, path, nonce],
  );

  // Any change of address means a fresh paint, so show the loader again.
  useEffect(() => {
    setLoaded(false);
  }, [src]);

  function go(next: string) {
    setLoaded(false);
    setPath(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/10 bg-ink px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{theme.name}</div>
          <div className="text-[11px] text-white/60">
            {ar ? "متصل بالمنتجات والمخزون الحقيقي" : "Connected to live products & inventory"}
          </div>
        </div>

        <div className="mx-auto flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <button
            onClick={() => setDevice("desktop")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              device === "desktop" ? "bg-white text-ink" : "text-white/80 hover:text-white"
            }`}
          >
            <IcDesktop className="h-4 w-4" /> {t("desktop")}
          </button>
          <button
            onClick={() => setDevice("mobile")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              device === "mobile" ? "bg-white text-ink" : "text-white/80 hover:text-white"
            }`}
          >
            <IcMobile className="h-4 w-4" /> {t("mobile")}
          </button>
        </div>

        <button
          onClick={() => {
            setLoaded(false);
            setNonce((n) => n + 1);
          }}
          title={ar ? "إعادة بناء من الملفات" : "Rebuild from theme files"}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20"
        >
          <IcRefresh className="h-4 w-4" />
        </button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20 sm:flex"
        >
          <IcLink className="h-4 w-4" /> {t("open_new_tab")}
        </a>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20"
        >
          <IcX className="h-4 w-4" /> {t("close")}
        </button>
      </div>

      {/* Page switcher */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-ink/95 px-4 py-2">
        {NAV.map((n) => (
          <button
            key={n.path}
            onClick={() => go(n.path)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              path === n.path
                ? "bg-white text-ink"
                : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            }`}
          >
            {ar ? n.ar : n.en}
          </button>
        ))}
        <span className="ms-auto truncate font-mono text-[11px] text-white/40">{path}</span>
      </div>

      <div className="flex flex-1 items-stretch justify-center overflow-auto p-4">
        <div
          className={`relative h-full overflow-hidden rounded-2xl bg-white shadow-pop transition-all ${
            device === "mobile" ? "w-[390px] max-w-full" : "w-full"
          }`}
        >
          {!loaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand-600" />
              <span className="text-sm font-medium text-ink-muted">
                {ar ? "جارٍ تجهيز المعاينة…" : "Building the preview…"}
              </span>
              <span className="max-w-[260px] text-center text-xs text-ink-soft">
                {ar
                  ? "أول فتح بعد النشر أبطأ؛ بعدها يصبح فورياً."
                  : "The first load after a deploy is slower — later ones are instant."}
              </span>
            </div>
          )}
          {/* Kept transparent until it has painted: an empty iframe renders as
              an opaque white sheet and would cover the message above. */}
          <iframe
            key={src}
            src={src}
            title={theme.name}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full border-0 transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          />
        </div>
      </div>
    </div>
  );
}
