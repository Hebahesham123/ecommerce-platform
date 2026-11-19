import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * One cached read of the store's settings row, shared by everything that
 * needs a section of it.
 *
 * The Settings screen writes each section under its own key — `updateSection`
 * saves `{ shipping: {...}, taxes: {...} }` — so a reader asks for a section
 * by name and gets `{}` when the merchant has never opened that screen.
 *
 * Cached for a few seconds because pricing a cart, placing an order and
 * rendering a checkout all ask within the same request, and this is one row
 * that changes a few times a month.
 *
 * `payments-server.ts` keeps its own cache of the same row. That is left
 * alone deliberately: it is live code on both checkouts, and folding it in
 * here would risk a working flow to save one query every fifteen seconds.
 */

type Section = Record<string, unknown>;

let cache: { at: number; value: Record<string, Section> } | null = null;
const CACHE_MS = 15_000;

async function load(): Promise<Record<string, Section>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (!isSupabaseConfigured()) return {};
  try {
    const { data } = await getServerSupabase()
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const value = (data?.data ?? {}) as Record<string, Section>;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // Settings are a refinement on defaults. An order must still be placeable
    // when this read fails, so an outage reads as "nothing configured".
    return cache?.value ?? {};
  }
}

/** One section of the settings row, or `{}` if it was never saved. */
export async function getSettingsSection(key: string): Promise<Section> {
  const all = await load();
  const s = all[key];
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Section) : {};
}

/** Called after the Settings screen saves, so the next read is fresh. */
export function forgetSettings(): void {
  cache = null;
}
