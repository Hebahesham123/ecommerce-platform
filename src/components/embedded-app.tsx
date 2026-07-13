"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcAlert, IcLink } from "@/components/icons";

const ZOOM_STEPS = [0.6, 0.67, 0.75, 0.8, 0.85, 0.9, 1];

/**
 * Generic "embed another app in an iframe" surface. Generalized from the inbox
 * Command Center embed so Accounting, Courier, etc. all share one battle-tested
 * component: real-viewport height, zoom, refresh, open-in-tab, and a graceful
 * "URL not configured" state that names the env var to set.
 */
export function EmbeddedApp({
  title,
  subtitle,
  url,
  envVar,
}: {
  title: string;
  subtitle?: string;
  url: string;
  envVar: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [reloadKey, setReloadKey] = useState(0);
  const [zoom, setZoom] = useState(0.85);
  const [vh, setVh] = useState(800);

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stepZoom = (dir: -1 | 1) => {
    const i = ZOOM_STEPS.indexOf(zoom);
    const next =
      ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i === -1 ? 4 : i) + dir))];
    setZoom(next);
  };

  if (!url) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IcAlert className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">
              {ar ? "لم يتم ضبط رابط التطبيق" : "App URL not set"}
            </div>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              {ar
                ? `أضِف ${envVar} في ملف .env.local (مثل http://localhost:3001) ثم أعد تشغيل الخادم.`
                : `Add ${envVar} to .env.local (e.g. http://localhost:3001) and restart the dev server.`}
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
              <button
                onClick={() => stepZoom(-1)}
                disabled={zoom === ZOOM_STEPS[0]}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover disabled:opacity-40"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="w-10 text-center text-xs font-semibold text-ink">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => stepZoom(1)}
                disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover disabled:opacity-40"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn-outline h-9 px-3 text-sm"
            >
              {ar ? "تحديث" : "Refresh"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="btn-outline h-9 gap-1.5 px-3 text-sm"
            >
              <IcLink className="h-4 w-4" /> {ar ? "فتح في تبويب" : "Open in tab"}
            </a>
            <span className="badge bg-emerald-50 text-emerald-700">
              {ar ? "مباشر" : "Live"}
            </span>
          </div>
        }
      />
      <Card className="overflow-hidden p-0">
        <div
          className="relative w-full overflow-hidden"
          style={{ height: `${Math.round(vh * zoom)}px` }}
        >
          <iframe
            key={reloadKey}
            src={url}
            title={title}
            style={{
              width: `${100 / zoom}%`,
              height: `${vh}px`,
              transform: `scale(${zoom})`,
              transformOrigin: ar ? "top right" : "top left",
            }}
            className="border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        </div>
      </Card>
    </>
  );
}
