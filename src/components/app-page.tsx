"use client";

import type { AppPage, AppSettings } from "@/lib/app-theme";

/**
 * A page the merchant wrote: For Her, For Him.
 *
 * Not a collection — a collection is a wall of products, and the honest
 * answer to "what do you have for her?" is eleven answers, not four hundred
 * bags. So it is the website's own shape: a small line, a headline set over
 * two lines, and a set of pictures that each open a collection.
 *
 * The circles are the website's swatches; the tiles are for a merchant whose
 * pictures are photographs rather than cut-outs, where a circle crops the
 * subject out of its own scene.
 */
export function AppPageView({
  page,
  settings,
  ar,
  onOpen,
  onBack,
}: {
  page: AppPage;
  settings: AppSettings;
  ar: boolean;
  onOpen: (tile: AppPage["items"][number]) => void;
  onBack?: () => void;
}) {
  const tiles = page.items.filter((t) => t.label || t.imageUrl);
  const circles = page.layout !== "tiles";
  const accent = settings.accent;

  return (
    <div>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {ar ? "رجوع" : "Back"}
        </button>
      )}

      <header className="py-3 text-center">
        {page.kicker && (
          <span
            dir="auto"
            className="block text-[10px] font-bold uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            {page.kicker}
          </span>
        )}
        {page.line1 && (
          <span
            dir="auto"
            className="app-display mt-2 block text-[15px] font-semibold uppercase tracking-[0.3em] text-slate-500"
          >
            {page.line1}
          </span>
        )}
        {page.line2 && (
          <h2 dir="auto" className="app-display mt-1 text-[26px] font-bold leading-tight text-slate-900">
            {page.line2}
          </h2>
        )}
      </header>

      {tiles.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {ar ? "لا شيء في هذه الصفحة بعد" : "Nothing on this page yet"}
        </p>
      ) : circles ? (
        <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-4">
          {tiles.map((tile) => (
            <button key={tile.id} onClick={() => onOpen(tile)} className="flex flex-col items-center">
              <span
                className="grid aspect-square w-full place-items-center overflow-hidden rounded-full"
                style={{ background: "#f3ece4" }}
              >
                {tile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tile.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              {tile.label && (
                <span
                  dir="auto"
                  className="mt-2 w-full truncate text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-700"
                >
                  {tile.label}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => onOpen(tile)}
              className="relative overflow-hidden rounded-2xl text-start"
              style={{ aspectRatio: "3 / 4", background: "#f3ece4" }}
            >
              {tile.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 block h-1/2"
                style={{
                  background:
                    "linear-gradient(to top, rgba(20,12,7,0.62) 0%, rgba(20,12,7,0) 100%)",
                }}
              />
              {tile.label && (
                <span
                  dir="auto"
                  className="absolute bottom-2.5 start-3 end-3 truncate text-[12px] font-bold uppercase tracking-[0.08em] text-white"
                >
                  {tile.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
