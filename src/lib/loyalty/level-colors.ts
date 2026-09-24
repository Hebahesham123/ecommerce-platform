import type { Level, LevelKey } from "./types";

/**
 * A level's colour, and the few shades a screen needs to use it.
 *
 * The colour comes from the loyalty programme — one hex value set against the
 * level, beside its name and its threshold, because that is what a level is
 * made of. Everything else is mixed from it here rather than chosen by hand,
 * so there is one thing to set and no palette to keep in step.
 *
 * They are mixed towards the page's own cream rather than white: a tint barely
 * off the paper for a panel, a border a shade firmer, and the colour itself
 * held back for the few words that name the tier. That is what lets a strong
 * colour sit on a warm page without shouting over it.
 */
export type LevelPalette = {
  /** Panel fill — a whisper away from the page. */
  tint: string;
  /** Panel edge — the tier's colour at a readable strength. */
  edge: string;
  /** For the few words that name the tier, and whatever is currently chosen. */
  accent: string;
  /** A hover, or a figure that should catch the eye without shouting. */
  soft: string;
};

/** The paper these are mixed towards. */
const PAPER = "#FBF7F1";

/** Used only for a level whose colour has never been set. */
const UNSET: Record<LevelKey, string> = {
  discovery: "#7E7364",
  curated: "#A46C3C",
  insider: "#8F7226",
  icon: "#9B4B41",
  muse: "#6C5375",
};

function rgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** `amount` is how much of `color` survives: 0 is all paper, 1 is all colour. */
function mix(color: string, amount: number): string {
  const a = rgb(color);
  const b = rgb(PAPER);
  if (!a || !b) return color;
  const c = a.map((v, i) => Math.round(b[i] + (v - b[i]) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function paletteFrom(color: string | null | undefined, key?: LevelKey | null): LevelPalette {
  const base = (color && rgb(color) ? color : null) ?? (key ? UNSET[key] : null) ?? UNSET.discovery;
  return {
    tint: mix(base, 0.08),
    edge: mix(base, 0.34),
    soft: mix(base, 0.16),
    accent: base,
  };
}

/** The palette for the level a customer is currently in. */
export function levelPalette(levels: Level[], key: LevelKey | null | undefined): LevelPalette {
  const level = key ? levels.find((l) => l.key === key) : undefined;
  return paletteFrom(level?.color, key);
}
