"use client";

import { useEffect, useRef, useState } from "react";

import type { StripItem } from "@/lib/app-theme";

/**
 * The row of shortcuts under the header.
 *
 * Chrome, not a home block: it stays put while the page scrolls, so it lives
 * beside the header in both phones rather than in the list of sections a
 * merchant drags around.
 *
 * The first shortcut is drawn as the one you are on. Nothing here changes what
 * the home screen shows — each shortcut opens its collection — so marking one
 * is a statement about where the shopper is, not a filter being applied.
 *
 * It drifts on its own when there is more of it than fits. A row that ends at
 * the screen's edge looks like it ends there, and the shortcuts past the fold
 * — often the seasonal ones a merchant put in last — are never seen. The
 * drift is slow enough to read and stops for good the moment anyone touches
 * it: once a shopper is steering, moving the row under their thumb is rude.
 */
export function AppStrip({
  items,
  accent,
  activeIndex = 0,
  onOpen,
}: {
  items: StripItem[];
  accent: string;
  activeIndex?: number;
  onOpen?: (item: StripItem) => void;
}) {
  const rail = useRef<HTMLDivElement | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = rail.current;
    if (!el || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // In a right-to-left row the browser counts scrollLeft downwards from
    // zero, so the distance travelled is kept as a positive number and the
    // sign put back on at the last moment.
    const rtl = getComputedStyle(el).direction === "rtl";
    let at = Math.abs(el.scrollLeft);
    let way = 1;
    const tick = () => {
      const far = el.scrollWidth - el.clientWidth;
      if (far <= 1) return;
      at += way * 0.4;
      if (at >= far) {
        at = far;
        way = -1;
      } else if (at <= 0) {
        at = 0;
        way = 1;
      }
      el.scrollLeft = rtl ? -at : at;
    };
    const timer = window.setInterval(tick, 16);
    return () => window.clearInterval(timer);
  }, [held, items.length]);

  // Once it is being steered, the shortcut you land on is the one to keep in
  // sight — the drift is no longer there to bring it round. Only a change of
  // shortcut moves the row: pulling it about under the thumb that just touched
  // it would be the app arguing with the shopper.
  const shown = useRef(activeIndex);
  useEffect(() => {
    if (!held || shown.current === activeIndex) {
      shown.current = activeIndex;
      return;
    }
    shown.current = activeIndex;
    const chip = rail.current?.children[activeIndex] as HTMLElement | undefined;
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, held]);

  if (!items.length) return null;
  return (
    <div
      ref={rail}
      onPointerDown={() => setHeld(true)}
      onWheel={() => setHeld(true)}
      className="app-surface flex gap-4 overflow-x-auto border-b border-slate-200 bg-white px-4"
    >
      {items.map((item, i) => {
        const on = i === activeIndex;
        return (
          <button
            key={item.id}
            onClick={() => onOpen?.(item)}
            className="shrink-0 whitespace-nowrap border-b-2 py-2 text-[12px] font-semibold transition-colors"
            style={{
              color: on ? accent : "#64748b",
              borderColor: on ? accent : "transparent",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
