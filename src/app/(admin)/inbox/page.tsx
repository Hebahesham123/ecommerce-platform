"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcAlert, IcLink, IcWhatsApp } from "@/components/icons";

// Running dashboard-web (Command Center) URL. Set in .env.local:
//   NEXT_PUBLIC_INBOX_EMBED_URL=http://localhost:3001
const EMBED_URL = process.env.NEXT_PUBLIC_INBOX_EMBED_URL || "";

const ZOOM_STEPS = [0.6, 0.67, 0.75, 0.8, 0.85, 0.9, 1];

export default function InboxPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [reloadKey, setReloadKey] = useState(0);
  const [zoom, setZoom] = useState(0.75);
  // Use the real browser viewport height as the iframe's logical height so the
  // embedded app renders exactly like a native window (no extra whitespace).
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stepZoom = (dir: -1 | 1) => {
    const i = ZOOM_STEPS.indexOf(zoom);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i === -1 ? 4 : i) + dir))];
    setZoom(next);
  };

  if (!EMBED_URL) {
    return (
      <>
        <PageHeader title={t("nav_inbox")} subtitle={ar ? "مركز القيادة" : "Command Center"} />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IcAlert className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">{ar ? "لم يتم ضبط رابط لوحة التحكم" : "Dashboard URL not set"}</div>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              {ar
                ? "أضِف NEXT_PUBLIC_INBOX_EMBED_URL في ملف .env.local (مثل http://localhost:3001) ثم أعد تشغيل الخادم."
                : "Add NEXT_PUBLIC_INBOX_EMBED_URL to .env.local (e.g. http://localhost:3001) and restart the dev server."}
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("nav_inbox")}
        subtitle={ar ? "مركز القيادة — مدمج" : "Command Center — embedded"}
        actions={
          <div className="flex items-center gap-2">
            {/* Zoom control */}
            <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
              <button
                onClick={() => stepZoom(-1)}
                disabled={zoom === ZOOM_STEPS[0]}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover disabled:opacity-40"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="w-10 text-center text-xs font-semibold text-ink">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => stepZoom(1)}
                disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover disabled:opacity-40"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn-outline h-9 px-3 text-sm">
              {ar ? "تحديث" : "Refresh"}
            </button>
            <a href={EMBED_URL} target="_blank" rel="noreferrer" className="btn-outline h-9 gap-1.5 px-3 text-sm">
              <IcLink className="h-4 w-4" /> {ar ? "فتح في تبويب" : "Open in tab"}
            </a>
            <span className="badge bg-emerald-50 text-emerald-700">
              <IcWhatsApp className="h-3.5 w-3.5" /> {ar ? "مباشر" : "Live"}
            </span>
          </div>
        }
      />
      {/* The iframe is given the real browser height (vh) as its viewport, so the
          dashboard renders just like a native window (fills its own height, no
          extra whitespace). It's then scaled by `zoom`, and the wrapper is sized
          to the scaled height. */}
      <Card className="overflow-hidden p-0">
        <div className="relative w-full overflow-hidden" style={{ height: `${Math.round(vh * zoom)}px` }}>
          <iframe
            key={reloadKey}
            src={EMBED_URL}
            title="Command Center"
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
