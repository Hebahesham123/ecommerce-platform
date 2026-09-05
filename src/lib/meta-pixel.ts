import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { pixelBaseCode } from "@/lib/meta";

/**
 * The one place that decides which Meta Pixel this store fires.
 *
 * It used to be two places: the theme renderer read `meta_connection`, while
 * the root layout carried an id hardcoded in source. A merchant pasting their
 * own id into the dashboard would still have someone else's pixel firing on
 * every /store page — which makes "just paste your id" a lie.
 *
 * Looked up on the hot path of every page, so it is cached in memory with a
 * short self-healing TTL plus an explicit invalidation from the admin save.
 */

const TTL_MS = 60_000;
let cache: { at: number; snippet: string } | null = null;

/** Forget the cached snippet (call after the pixel is changed). */
export function invalidatePixelSnippet(): void {
  cache = null;
}

/** The <script> block to inject, or "" when no pixel is configured or enabled. */
export async function getPixelSnippet(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.snippet;

  let snippet = "";
  if (isSupabaseConfigured()) {
    try {
      const { data } = await getServerSupabase()
        .from("meta_connection")
        .select("pixel_id, pixel_enabled")
        .eq("id", "default")
        .maybeSingle();
      if (data?.pixel_enabled && data?.pixel_id) snippet = pixelBaseCode(String(data.pixel_id));
    } catch {
      /* no pixel configured, or the table is unreachable */
    }
  }

  cache = { at: Date.now(), snippet };
  return snippet;
}
