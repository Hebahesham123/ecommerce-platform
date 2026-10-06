import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { DEFAULT_SEO, normalizeSeo, type SeoSettings } from "@/lib/seo-types";

// Re-export the pure config shape/helpers so existing server importers keep
// working. The admin form imports these from @/lib/seo-types directly (that
// module is client-safe — this one is server-only).
export { DEFAULT_SEO, normalizeSeo };
export type { SeoSettings };

// ---- Cached read (hot path: every storefront page reads this) ---------------
// SEO settings change only when the merchant saves the admin SEO page, yet a
// naive read would add a Supabase round trip to every page view's TTFB. Cache
// in memory with a short TTL (self-heals within a minute) plus explicit
// invalidation from the save action, so a warm instance never touches the
// database for it.
const SEO_TTL_MS = 60_000;
let seoCache: { at: number; value: SeoSettings } | null = null;

/** Forget the cached SEO settings (call after the admin save). */
export function invalidateSeoSettings(): void {
  seoCache = null;
}

/** Read the merchant's SEO settings, defaulting sensibly when absent. Never throws. */
export async function readSeoSettings(): Promise<SeoSettings> {
  if (seoCache && Date.now() - seoCache.at < SEO_TTL_MS) return seoCache.value;
  if (!isSupabaseConfigured()) return DEFAULT_SEO;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const raw = (data?.data as Record<string, unknown> | null)?.seo;
    const value = normalizeSeo(raw);
    seoCache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SEO;
  }
}
