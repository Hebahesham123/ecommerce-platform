import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Copy } from "./page-copy";

/**
 * The merchant's wording for one page, read where the page is rendered.
 *
 * It lives in the same `store_settings` row as the rest of the store's
 * settings — one row, one read, and no migration for what is only ever a
 * handful of short strings. A store that has never opened the Pages screen
 * gets `{}` and every page keeps the wording it ships with.
 */
export async function getPageCopy(section: string): Promise<Copy> {
  if (!isSupabaseConfigured()) return {};
  try {
    const { data } = await getServerSupabase()
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const all = (data?.data ?? {}) as Record<string, unknown>;
    const mine = all[section];
    if (!mine || typeof mine !== "object") return {};
    const out: Copy = {};
    for (const [k, v] of Object.entries(mine as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    // Wording is never worth failing a page over.
    return {};
  }
}
