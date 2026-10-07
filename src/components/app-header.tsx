"use client";

import { useEffect, useState } from "react";
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

/**
 * The suggestion in the search box, changing over.
 *
 * It only ever shows while the box is empty and nobody is typing in it: a
 * hint that moves under a cursor is a hint that has become an obstacle.
 */
function SearchHint({ hints, ink }: { hints: string[]; ink: string }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (hints.length < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % hints.length), 2600);
    return () => clearInterval(t);
  }, [hints.length]);

  if (!hints.length) return null;
  const hint = hints[at % hints.length];
  return (
    <span
      className="pointer-events-none absolute inset-y-0 start-9 end-3 flex items-center overflow-hidden"
      aria-hidden
    >
      <span
        key={hint + at}
        className="app-hint-up block truncate text-[12px]"
        style={{ color: `${ink}70` }}
      >
        {hint}
      </span>
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
  onMenu,
  onHome,
  suggest = [],
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
  /** Opens the shop's menu. The website keeps this in the header; so does this. */
  onMenu?: () => void;
  /** Tapping the name goes home, the way it does on every shop. */
  onHome?: () => void;
  /**
   * What the search box offers while it is empty, after the merchant's own
   * wording. The shop's collections, so it cannot suggest what it does not
   * sell.
   */
  suggest?: string[];
}) {
  const [typing, setTyping] = useState(false);
  // Her wording first, then the collections. Trimmed, deduplicated, and short
  // enough that none of them is cut off in a field this wide.
  const hints = [
    ...new Set(
      [settings.searchPlaceholder, ...suggest]
        .map((h) => String(h ?? "").trim())
        .filter((h) => h && h.length <= 34),
    ),
  ].slice(0, 8);

  const ink = settings.headerInk || "#191614";
  const bg = settings.headerBg || "#ffffff";
  // An uploaded logo wins over the wordmark; a store that has neither still
  // gets its name rather than an empty corner.
  const wordmark = settings.logoText || settings.storeName;

  const saved = settings.showWishlist && (
    <button
      onClick={onWishlist}
      aria-label={ar ? "المفضّلة" : "Saved"}
      className="relative grid h-8 w-8 shrink-0 place-items-center"
      style={{ color: ink }}
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
      </svg>
      <Badge count={wishlistCount} accent={accent} />
    </button>
  );

  const bag = settings.showBag && (
    <button
      onClick={onBag}
      aria-label={ar ? "السلة" : "Bag"}
      className="relative grid h-8 w-8 shrink-0 place-items-center"
      style={{ color: ink }}
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
      <Badge count={cartCount} accent={accent} />
    </button>
  );

  return (
    <div className="border-b border-slate-200 px-3 pb-2 pt-2" style={{ background: bg }}>
      {/* The name, and the two things a shopper owns. Nothing between them. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onHome}
          disabled={!onHome}
          aria-label={wordmark || "Home"}
          className="flex min-w-0 flex-1 items-center disabled:cursor-default"
        >
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="h-[22px] w-auto shrink-0 object-contain" />
          ) : (
            (wordmark || settings.logoAccentText) && (
              <span
                className="shrink-0 text-[15px] font-extrabold tracking-tight"
                style={{ color: ink }}
              >
                {wordmark}
                {settings.logoAccentText && (
                  <span style={{ color: accent }}>{settings.logoAccentText}</span>
                )}
              </span>
            )
          )}
        </button>
        {saved}
        {bag}
        {/* With no search there is no second row, so the menu stays up here
            rather than disappearing with the row it was moved to. */}
        {onMenu && !settings.showSearch && (
        <button
          onClick={onMenu}
          aria-label={ar ? "القائمة" : "Menu"}
          className="-me-1 grid h-8 w-8 shrink-0 place-items-center"
          style={{ color: ink }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        )}
      </div>

      {settings.showSearch && (
        <div className="mt-2 flex items-center gap-2">
          <span className="relative flex min-w-0 flex-1 items-center">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute start-3 h-4 w-4"
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
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              readOnly={!onQuery}
              aria-label={settings.searchPlaceholder || (ar ? "ابحثي" : "Search")}
              // The suggestion that changes stands in for this, so the two
              // would otherwise be printed one on top of the other.
              placeholder={hints.length > 1 ? "" : settings.searchPlaceholder}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-[12px] outline-none focus:border-slate-300"
              style={{ color: ink }}
            />
            {hints.length > 1 && !typing && !(query ?? "") && (
              <SearchHint hints={hints} ink={ink} />
            )}
          </span>
          {/* Searching and browsing by category are the two ways of finding
              something, so they share a line. */}
          {onMenu && (
        <button
          onClick={onMenu}
          aria-label={ar ? "القائمة" : "Menu"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50"
          style={{ color: ink }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
          )}
        </div>
      )}
    </div>
  );
}
