import type { LevelKey } from "./types";

/**
 * A colour for each stage of the Society.
 *
 * The levels were only ever told apart by their names, so nothing on a
 * customer's own page reflected the one she had reached. These are those
 * colours — but chosen to sit on the account page's cream rather than to shout
 * over it: a tint barely off the paper, a border a shade firmer, and a single
 * saturated accent kept for the few words that name the tier.
 *
 * They climb in warmth and depth the way the tiers do, from stone at the
 * beginning to amethyst at the top, so the page changes quietly as she does.
 */
export type LevelPalette = {
  /** Panel fill — a whisper away from the page. */
  tint: string;
  /** Panel edge — the tier's colour at a readable strength. */
  edge: string;
  /** For the few words that name the tier. Dark enough to read on `tint`. */
  accent: string;
  /** For a figure or badge that should catch the eye without shouting. */
  soft: string;
};

const PALETTES: Record<LevelKey, LevelPalette> = {
  // Stone: the beginning, deliberately the quietest of them.
  discovery: { tint: "#F5F1EA", edge: "#DCD2C2", accent: "#7E7364", soft: "#EDE6DA" },
  // Bronze.
  curated: { tint: "#F8F0E4", edge: "#DFC7A6", accent: "#A46C3C", soft: "#F1E2CC" },
  // Gold.
  insider: { tint: "#FBF3DE", edge: "#E5D2A0", accent: "#8F7226", soft: "#F5E7C2" },
  // Garnet.
  icon: { tint: "#F9EDEB", edge: "#E5C5C0", accent: "#9B4B41", soft: "#F2DCD8" },
  // Amethyst: the top, and the only one that leaves the warm half of the wheel.
  muse: { tint: "#F4EEF5", edge: "#D7C8DC", accent: "#6C5375", soft: "#EBE0EE" },
};

export function levelPalette(key: LevelKey | null | undefined): LevelPalette {
  return (key && PALETTES[key]) || PALETTES.discovery;
}
