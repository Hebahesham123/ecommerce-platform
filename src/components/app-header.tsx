"use client";

import type { AppSettings } from "@/lib/app-theme";

/**
 * The header the app wears above everything else.
 *
 * Chrome, like the shortcut strip under it: the wordmark, the search field and
 * the two icons a shopper reaches for. Search lives here rather than in the
 * page so it does not scroll away, which means whoever draws this header owns
 * the query and hands it down.
 */

function Badge({ count, accent }: { count: number; accent: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
      style={{ background: accent }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppHeader({
  settings,
  accent,
  ar,
  query,
  onQuery,
  cartCount = 0,
  wishlistCount = 0,
  onWishlist,
  onBag,
}: {
  settings: AppSettings;
  accent: string;
  ar: boolean;
  query?: string;
  onQuery?: (v: string) => void;
  cartCount?: number;
  wishlistCount?: number;
  onWishlist?: () => void;
  onBag?: () => void;
}) {
  const ink = settings.headerInk || "#191614";
  const bg = settings.headerBg || "#ffffff";
  // An uploaded logo wins over the wordmark; a store that has neither still
  // gets its name rather than an empty corner.
  const wordmark = settings.logoText || settings.storeName;

  return (
    <div
      className="flex items-center gap-2 border-b border-slate-200 px-3 py-2"
      style={{ background: bg }}
    >
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logoUrl} alt="" className="h-5 w-auto shrink-0 object-contain" />
      ) : (
        (wordmark || settings.logoAccentText) && (
          <span
            className="shrink-0 text-[13px] font-extrabold tracking-tight"
            style={{ color: ink }}
          >
            {wordmark}
            {settings.logoAccentText && (
              <span style={{ color: accent }}>{settings.logoAccentText}</span>
            )}
          </span>
        )
      )}

      {settings.showSearch && (
        <span className="relative flex min-w-0 flex-1 items-center">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute start-2.5 h-3.5 w-3.5"
            style={{ color: `${ink}80` }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            value={query ?? ""}
            onChange={(e) => onQuery?.(e.target.value)}
            readOnly={!onQuery}
            placeholder={settings.searchPlaceholder}
            className="h-8 w-full rounded-full border border-slate-200 bg-slate-50 ps-8 pe-3 text-[12px] outline-none focus:border-slate-300"
            style={{ color: ink }}
          />
        </span>
      )}

      {settings.showWishlist && (
        <button
          onClick={onWishlist}
          aria-label={ar ? "المفضّلة" : "Saved"}
          className="relative grid h-8 w-8 shrink-0 place-items-center"
          style={{ color: ink }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
          </svg>
          <Badge count={wishlistCount} accent={accent} />
        </button>
      )}

      {settings.showBag && (
        <button
          onClick={onBag}
          aria-label={ar ? "السلة" : "Bag"}
          className="relative grid h-8 w-8 shrink-0 place-items-center"
          style={{ color: ink }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
          </svg>
          <Badge count={cartCount} accent={accent} />
        </button>
      )}
    </div>
  );
}
