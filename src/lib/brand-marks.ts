/**
 * The houses this repository ships a mark for.
 *
 * Generated from public/brands — run scripts/brand-marks.mjs after adding or
 * removing one. It is a list in code rather than a path in the theme row on
 * purpose: which files exist is a fact about the repository, not a setting,
 * and a theme row gets saved over by whoever has the editor open.
 *
 * A mark set by hand on the brand item still wins over this.
 */
export const BRAND_MARKS: readonly string[] = [
  "adidas",
  "chanel",
  "christian-dior",
  "fendi",
  "gucci",
  "hermes",
  "louis-vuitton",
  "prada",
  "valentino",
  "yves-saint-laurent",
];

const HAS = new Set(BRAND_MARKS);

/** The shop-relative path to a house's mark, or "" when none ships. */
export function brandMark(handle: string): string {
  return HAS.has(handle) ? "/brands/" + handle + ".webp" : "";
}
