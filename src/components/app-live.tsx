"use client";

import type { LiveSession } from "@/lib/app-theme";

/**
 * The Live tab: who is on air, then who is coming up.
 *
 * It draws the sessions the Live now and Coming up live sections already
 * carry, so there is one list to keep rather than two that drift. When those
 * sections are not on the home screen this tab is empty, and says why instead
 * of looking broken.
 */
export function AppLive({
  sessions,
  ar,
  accent,
  onOpen,
}: {
  sessions: LiveSession[];
  ar: boolean;
  accent: string;
  onOpen?: (session: LiveSession) => void;
}) {
  if (!sessions.length) {
    return (
      <div className="p-8 text-center text-[12px] leading-relaxed text-slate-400">
        {ar
          ? "لا يوجد بث بعد. أضيفي قسم «البث المباشر» أو «بث قادم» في الشاشة الرئيسية ليظهر هنا."
          : "Nothing live yet. Add a Live now or Coming up live section to the home screen and it will show here."}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onOpen?.(s)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-start"
        >
          <span className="relative shrink-0">
            <span className="block h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
              {s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            {s.live && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white"
                style={{ background: "#e11d48" }}
              >
                {ar ? "مباشر" : "LIVE"}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold text-slate-900">{s.name}</span>
            {s.detail && (
              <span className="block truncate text-[11px] text-slate-500">{s.detail}</span>
            )}
          </span>
          <span
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
            style={{ background: accent }}
          >
            {s.live ? (ar ? "شاهدي" : "Watch") : (ar ? "ذكّريني" : "Remind me")}
          </span>
        </button>
      ))}
    </div>
  );
}
