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
 * It travels on its own when there is more of it than fits, one way, and
 * never arrives. A row that ends at the screen's edge looks like it ends
 * there, and the shortcuts past the fold — often the seasonal ones a merchant
 * put in last — are never seen. Turning round at the end only trades that for
 * a row that visibly bounces off a wall, so the shortcuts are laid down twice
 * and the travel wraps at the seam: the second copy is the first, so the join
 * cannot be seen and there is no end to reach.
 *
 * It yields while a thumb is on it, because moving the row under someone who
 * is steering is rude, and it picks up again a couple of seconds after they
 * let go — stopping for good would mean the shortcuts past the fold are
 * unseen again for the rest of the visit.
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
  /**
   * Whether the shortcuts are laid down twice.
   *
   * Only when there are more than fit: doubling a row that already fits would
   * invent an overflow and set a row travelling that had no reason to.
   */
  const [looping, setLooping] = useState(false);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () => {
      // Half, because by then the row is holding two copies of itself.
      const own = looping ? el.scrollWidth / 2 : el.scrollWidth;
      setLooping(own > el.clientWidth + 8);
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [items.length, looping]);

  /** A thumb stops it; letting go starts it again two seconds later. */
  useEffect(() => {
    if (!held) return;
    const t = window.setTimeout(() => setHeld(false), 2000);
    return () => window.clearTimeout(t);
  }, [held]);

  useEffect(() => {
    const el = rail.current;
    if (!el || held || !looping) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // In a right-to-left row the browser counts scrollLeft downwards from
    // zero, so the distance travelled is kept as a positive number and the
    // sign put back on at the last moment.
    const rtl = getComputedStyle(el).direction === "rtl";
    let at = Math.abs(el.scrollLeft);
    let last = 0;
    let frame = 0;
    // Pixels a second, rather than pixels a frame, so it reads at the same
    // speed on a phone drawing 120 frames and a laptop drawing 30.
    const speed = 24;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (!last) {
        last = now;
        return;
      }
      // How long since the last frame, capped so a tab coming back from the
      // background does not leap the row forward by however long it was away.
      const gap = Math.min(now - last, 64);
      last = now;
      const seam = el.scrollWidth / 2;
      if (seam <= 1) return;
      at += (speed * gap) / 1000;
      // The second copy is the first, so landing back at the seam is
      // indistinguishable from carrying on.
      if (at >= seam) at -= seam;
      el.scrollLeft = rtl ? -at : at;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [held, looping, items.length]);

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
      {(looping ? [...items, ...items] : items).map((item, i) => {
        const on = i % items.length === activeIndex;
        // The second copy is the same shortcuts again, and a screen reader
        // should be told once.
        const echo = i >= items.length;
        return (
          <button
            key={item.id + (echo ? "-again" : "")}
            onClick={() => onOpen?.(item)}
            aria-hidden={echo}
            tabIndex={echo ? -1 : undefined}
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
