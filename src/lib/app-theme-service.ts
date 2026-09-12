import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeTheme, type AppTheme } from "@/lib/app-theme";
import { seedFromWebsite } from "@/lib/app-theme-seed";
import { getCatalog } from "@/lib/storefront-data";

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

/**
 * Everything a theme is, versus what the table had before 0026.
 *
 * PostgREST rejects the whole request when it is asked for a column that is
 * not there, so a store that has not run the migration yet would lose its
 * theme to a select it cannot satisfy. Both shapes are tried, newest first.
 */
const ALL_COLUMNS = "settings,blocks,tabs,screens";
const PRE_0026_COLUMNS = "settings,blocks";

/** True when the only thing wrong was asking for tabs or screens. */
function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(message)
  );
}

export function invalidateAppTheme() {
  cache = null;
}

export async function getAppTheme(): Promise<AppTheme> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  // A store with no row, or no database at all, still gets a working app.
  if (!isSupabaseConfigured()) return normalizeTheme(null);

  try {
    const db = getServerSupabase();
    let { data, error } = await db
      .from("app_theme")
      .select(ALL_COLUMNS)
      .eq("id", "default")
      .maybeSingle();
    if (missingColumn(error)) {
      ({ data, error } = await db
        .from("app_theme")
        .select(PRE_0026_COLUMNS)
        .eq("id", "default")
        .maybeSingle());
    }

    // A saved theme is the merchant's arrangement and always wins. Once they
    // have pressed Save the website stops being consulted, or an edit on one
    // side would silently undo an edit on the other.
    //
    // "Saved" means having blocks, not merely having a row: the migration
    // creates one with an empty screen, and treating that as a deliberate
    // choice would mean a store that ran the migration could never be seeded.
    // Deleting every block is not a state anyone wants to keep, either.
    const saved = error ? null : normalizeTheme(data);
    if (saved && saved.blocks.length) {
      cache = { at: Date.now(), value: saved };
      return saved;
    }

    // Nothing saved yet — so start from the website's own home page rather
    // than an empty screen. The merchant has already decided what belongs on
    // their front page; making them rebuild it is asking for a job they have
    // done. A missing table lands here too, which is right: the app should not
    // go dark because a migration has not run.
    const seeded = await seedFromWebsite(await shopName());
    const value = seeded ?? normalizeTheme(null);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return normalizeTheme(null);
  }
}

/** The shop's own name, so the seeded theme is not branded "BeautyBar" by default. */
async function shopName(): Promise<string | undefined> {
  try {
    const catalog = await getCatalog("");
    return catalog.shop.name || undefined;
  } catch {
    return undefined;
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
    const db = getServerSupabase();
    const row = {
      id: "default",
      settings: clean.settings,
      blocks: clean.blocks,
      updated_at: new Date().toISOString(),
    };

    let { error } = await db
      .from("app_theme")
      .upsert({ ...row, tabs: clean.tabs, screens: clean.screens }, { onConflict: "id" });
    // Before 0026 there is nowhere to put the tab bar or the screen wording.
    // Saving the rest is far better than refusing to save at all, so the brand
    // and the blocks still land and the two that cannot be kept are dropped —
    // the same as before the columns existed.
    if (missingColumn(error)) {
      ({ error } = await db.from("app_theme").upsert(row, { onConflict: "id" }));
    }
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
