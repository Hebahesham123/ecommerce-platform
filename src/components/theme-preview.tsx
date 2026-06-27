"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Theme } from "@/lib/themes";
import { IcX, IcDesktop, IcMobile, IcLink } from "@/components/icons";

export function ThemePreview({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const { t } = useI18n();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loaded, setLoaded] = useState(false);

  // Served by our own route as text/html (Supabase serves stored HTML as text/plain).
  const src = `/online-store/themes/${theme.id}/preview`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/10 bg-ink px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{theme.name}</div>
          <div className="text-[11px] text-white/60">{t("preview_theme")}</div>
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

      <div className="flex flex-1 items-stretch justify-center overflow-auto p-4">
        <div
          className={`relative h-full overflow-hidden rounded-2xl bg-white shadow-pop transition-all ${
            device === "mobile" ? "w-[390px] max-w-full" : "w-full"
          }`}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">
              {t("processing")}
            </div>
          )}
          <iframe
            src={src}
            title={theme.name}
            onLoad={() => setLoaded(true)}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          />
        </div>
      </div>
    </div>
  );
}
