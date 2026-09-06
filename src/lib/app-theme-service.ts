import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeTheme, type AppTheme } from "@/lib/app-theme";

/**
 * Reading and writing the app's theme.
 *
 * Cached for a minute, like the catalogue, because every app that opens asks
 * for it and none of them need a round trip to the database to learn the
 * accent colour. Saving clears the cache, so the editor's Save is visible on
 * the next app launch rather than a minute later.
 */

let cache: { at: number; value: AppTheme } | null = null;
const CACHE_MS = 60_000;

export function invalidateAppTheme() {
  cache = null;
}

export async function getAppTheme(): Promise<AppTheme> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  // A store with no row, or no database at all, still gets a working app.
  if (!isSupabaseConfigured()) return normalizeTheme(null);

  try {
    const { data, error } = await getServerSupabase()
      .from("app_theme")
      .select("settings,blocks")
      .eq("id", "default")
      .maybeSingle();
    // A missing table means the migration hasn't run. The app should not go
    // dark over that, so it gets the defaults and the dashboard says why.
    const value = normalizeTheme(error ? null : data);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return normalizeTheme(null);
  }
}

export async function saveAppTheme(
  theme: AppTheme,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    // Normalised on the way in as well as out: the editor is the only writer
    // today, but a theme that can only be trusted because of who wrote it is
    // one bad call away from reaching an app.
    const clean = normalizeTheme(theme);
    const { error } = await getServerSupabase()
      .from("app_theme")
      .upsert(
        {
          id: "default",
          settings: clean.settings,
          blocks: clean.blocks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) {
      const missing = /app_theme/i.test(error.message);
      return { ok: false, error: missing ? "migration_missing" : error.message };
    }
    invalidateAppTheme();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
