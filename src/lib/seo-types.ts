/**
 * SEO configuration shape + defaults — pure, client-safe (no server imports).
 * The admin form and the server-only reader both import from here.
 */
export type SeoSettings = {
  /** Brand name used in <title> suffixes, og:site_name and JSON-LD. */
  siteName: string;
  /** Appended to page titles (reserved for future title building). */
  titleSuffix: string;
  /** Fallback meta description when a page has none of its own. */
  defaultDescription: string;
  /** Default Open Graph / Twitter card image. */
  socialImage: string;
  /** Organization logo URL for JSON-LD. */
  logo: string;
  /** Twitter/X handle (with or without the leading @). */
  twitterHandle: string;
  /** When false, pages ship `noindex,nofollow`. */
  robotsIndex: boolean;
};

export const DEFAULT_SEO: SeoSettings = {
  siteName: "",
  titleSuffix: "",
  defaultDescription: "",
  socialImage: "",
  logo: "",
  twitterHandle: "",
  robotsIndex: true,
};

/** Coerce whatever is stored (possibly partial / wrong types) into a full, safe config. */
export function normalizeSeo(raw: unknown): SeoSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown): string => (v == null ? "" : String(v));
  return {
    siteName: s(o.siteName),
    titleSuffix: s(o.titleSuffix),
    defaultDescription: s(o.defaultDescription),
    socialImage: s(o.socialImage),
    logo: s(o.logo),
    twitterHandle: s(o.twitterHandle),
    robotsIndex: o.robotsIndex === undefined ? true : Boolean(o.robotsIndex),
  };
}
