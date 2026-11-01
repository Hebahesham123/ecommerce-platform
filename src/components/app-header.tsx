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
 *
 * It is drawn as two cards floating on a tinted ground rather than as a bar
 * with a rule under it. The rule said "the chrome ends here", which is a thing
 * worth saying on a website where the content starts at the top of a long
 * page; in a phone app the content is already a run of cards, so one more
 * horizontal line is just another line. Floating the header instead lets the
 * ground run behind it, which is what makes the top of the screen read as one
 * surface.
 */

function Badge({ count, accent }: { count: number; accent: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -end-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white px-1 text-[9px] font-bold leading-none text-white"
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
      className="pointer-events-none absolute inset-y-0 start-11 end-4 flex items-center overflow-hidden"
      aria-hidden
    >
      <span
        key={hint + at}
        className="app-hint-up block truncate text-[12.5px]"
        style={{ color: `${ink}66` }}
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

  /**
   * The ground the cards float on.
   *
   * Two soft washes of the shop's own colour over her header colour, rather
   * than the green the reference happens to use: a green wash under a brown
   * wordmark is somebody else's brand showing through hers. Both washes fade
   * out before halfway, so the cards sit on light and the page below carries
   * on uninterrupted.
   */
  const ground = `radial-gradient(125% 85% at 0% 0%, ${accent}42 0%, transparent 60%), radial-gradient(115% 95% at 100% 5%, ${accent}2b 0%, transparent 62%), ${bg}`;

  // One shape for everything that floats here, so the row of cards reads as a
  // set rather than as three things that happen to be rounded.
  const card =
    "rounded-[22px] border border-white/70 bg-white/60 shadow-[0_8px_22px_-14px_rgba(20,16,12,0.55)] backdrop-blur-sm";

  const saved = settings.showWishlist && (
    <button
      onClick={onWishlist}
      aria-label={ar ? "المفضّلة" : "Saved"}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-[0_2px_6px_-3px_rgba(20,16,12,0.5)] transition active:scale-90"
      style={{ color: ink }}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
      </svg>
      <Badge count={wishlistCount} accent={accent} />
    </button>
  );

  // The bag is filled rather than drawn, because it is the one thing up here
  // that is the end of a journey rather than the start of one.
  const bag = settings.showBag && (
    <button
      onClick={onBag}
      aria-label={ar ? "السلة" : "Bag"}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition active:scale-90"
      style={{ background: ink }}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
      <Badge count={cartCount} accent={accent} />
    </button>
  );

  const menu = onMenu && (
    <button
      onClick={onMenu}
      aria-label={ar ? "القائمة" : "Menu"}
      className={`grid h-11 w-11 shrink-0 place-items-center transition active:scale-95 ${card}`}
      style={{ color: ink }}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  );

  return (
    <div className="px-3 pb-2.5 pt-2.5" style={{ background: ground }}>
      {/* The name, and the two things a shopper owns. Nothing between them. */}
      <div className={`flex items-center gap-2 px-3 py-2 ${card}`}>
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
                className="shrink-0 text-[15px] font-extrabold uppercase tracking-[0.06em]"
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
        {!settings.showSearch && onMenu && (
          <button
            onClick={onMenu}
            aria-label={ar ? "القائمة" : "Menu"}
            className="-me-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 transition active:scale-90"
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
          <span className={`relative flex h-11 min-w-0 flex-1 items-center ${card}`}>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute start-4 h-[17px] w-[17px]"
              style={{ color: `${ink}70` }}
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
              className="h-full w-full rounded-[22px] bg-transparent ps-11 pe-4 text-[12.5px] outline-none"
              style={{ color: ink }}
            />
            {hints.length > 1 && !typing && !(query ?? "") && (
              <SearchHint hints={hints} ink={ink} />
            )}
          </span>
          {/* Searching and browsing by category are the two ways of finding
              something, so they share a line. */}
          {menu}
        </div>
      )}
    </div>
  );
}
