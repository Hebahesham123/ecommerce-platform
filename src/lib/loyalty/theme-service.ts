import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { DEFAULT_LOYALTY_THEME, normalizeLoyaltyTheme, type LoyaltyTheme } from "./theme";

/**
 * One row, like app_theme. A store has one Society.
 *
 * Which row is found rather than named. The intended key is the text
 * "default", but a table that was already there when the migration ran keeps
 * whatever key it was built with - an identity integer, in at least one real
 * database - and a settings document nobody addresses by id has no reason to
 * care. So reads take the first row and writes update the row that is there,
 * which is correct under either shape.
 */
const TABLE = "loyalty_theme";

/**
 * True when the database has not been prepared, rather than the write having
 * failed on its merits.
 *
 * Both halves matter: 42P01 and PGRST205 are the table not being there, and
 * 42703 is the table being there without its settings column - which is the
 * state a half-delivered migration leaves behind, and the one a merchant is
 * most likely to be staring at.
 */
const needsMigration = (error: { message?: string; code?: string } | null): boolean => {
  if (!error) return false;
  if (["PGRST205", "PGRST204", "42P01", "42703"].includes(error.code ?? "")) return true;
  return /loyalty_theme|does not exist|schema cache/i.test(error.message ?? "");
};

/**
 * The Society's theme, always.
 *
 * A store that has never opened the editor, a Supabase that is not configured,
 * a migration nobody has run yet and a read that simply failed all give the
 * same answer: the defaults, which are exactly what the pages looked like
 * before any of this existed. A loyalty page that rendered unstyled because a
 * settings read timed out would be worse than one that ignores the merchant's
 * colours for a moment.
 */
export async function getLoyaltyTheme(): Promise<LoyaltyTheme> {
  if (!isSupabaseConfigured()) return DEFAULT_LOYALTY_THEME;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select("settings")
      .limit(1)
      .maybeSingle();
    if (error) return DEFAULT_LOYALTY_THEME;
    return normalizeLoyaltyTheme(data?.settings);
  } catch {
    return DEFAULT_LOYALTY_THEME;
  }
}

/**
 * Save it.
 *
 * Normalised on the way in as well as out: the editor is the only writer
 * today, but a colour that reached a page unchecked would be CSS somebody
 * typed, and the page has no way to tell the difference.
 */
export async function saveLoyaltyTheme(
  theme: LoyaltyTheme,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const clean = normalizeLoyaltyTheme(theme);
    const supabase = getServerSupabase();
    const row = { settings: clean, updated_at: new Date().toISOString() };

    // The row this table was seeded with, whatever its key is called.
    const { data: existing, error: findError } = await supabase
      .from(TABLE)
      .select("id")
      .limit(1)
      .maybeSingle();
    if (findError && needsMigration(findError)) {
      return { ok: false, error: "migration_missing" };
    }

    const { error } = existing
      ? await supabase.from(TABLE).update(row).eq("id", existing.id)
      : await supabase.from(TABLE).insert(row);
    if (error) {
      // Say which migration, rather than handing the merchant a PostgREST code.
      return { ok: false, error: needsMigration(error) ? "migration_missing" : error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
