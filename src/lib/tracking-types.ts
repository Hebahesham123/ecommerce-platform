/**
 * Google tracking configuration shape + defaults — pure, client-safe (no server
 * imports). The admin form and the server-only reader both import from here,
 * exactly the split the SEO settings use (seo-types vs seo-settings), so a
 * client component can read the type/defaults without pulling in server-only
 * code.
 */
export type Tracking = {
  /** GA4 Measurement ID, e.g. G-XXXXXXX. */
  ga4Id: string;
  /** GA4 Measurement Protocol API secret (needed for server-side purchase events). */
  ga4ApiSecret: string;
  /** When false, no GA4 tag is injected into the storefront. */
  ga4Enabled: boolean;
  /** Google Search Console verification token (the `content` of the meta tag). */
  gscVerification: string;
};

export const DEFAULT_TRACKING: Tracking = {
  ga4Id: "",
  ga4ApiSecret: "",
  ga4Enabled: false,
  gscVerification: "",
};

/** Coerce whatever is stored (possibly partial / wrong types) into a full, safe config. */
export function normalizeTracking(raw: unknown): Tracking {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown): string => (v == null ? "" : String(v).trim());
  return {
    ga4Id: s(o.ga4Id),
    ga4ApiSecret: s(o.ga4ApiSecret),
    ga4Enabled: Boolean(o.ga4Enabled),
    gscVerification: s(o.gscVerification),
  };
}
