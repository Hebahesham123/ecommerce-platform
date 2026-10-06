"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeSeo, invalidateSeoSettings, type SeoSettings } from "@/lib/seo-settings";

export type SeoResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Read the merchant's SEO settings from `store_settings.data.seo`. */
export async function getSeoSettings(): Promise<SeoResult<SeoSettings>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle(); // no error when the row doesn't exist yet
    if (error) return { ok: false, error: error.message };
    const raw = (data?.data as Record<string, unknown> | null)?.seo;
    return { ok: true, data: normalizeSeo(raw) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Merge-upsert the SEO section into `store_settings.data`, like settings/updateSection. */
export async function saveSeoSettings(cfg: SeoSettings): Promise<SeoResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const current = (row?.data as Record<string, unknown>) ?? {};
    const merged = { ...current, seo: normalizeSeo(cfg) };
    // Upsert so the save persists even if the seed row is missing (a plain
    // UPDATE would match 0 rows and "succeed" without saving anything).
    const { error } = await supabase
      .from("store_settings")
      .upsert({ id: "default", data: merged }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    // Forget the storefront's cached copy so the change shows on the next page.
    invalidateSeoSettings();
    revalidatePath("/seo");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
