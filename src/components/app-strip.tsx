"use client";

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
  if (!items.length) return null;
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 bg-white px-4">
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
