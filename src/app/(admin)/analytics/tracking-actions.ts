"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { invalidateTracking } from "@/lib/ga4";
import { normalizeTracking, type Tracking } from "@/lib/tracking-types";

export type TrackingResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Read the merchant's tracking config from `store_settings.data.tracking`. */
export async function getTracking(): Promise<TrackingResult<Tracking>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle(); // no error when the row doesn't exist yet
    if (error) return { ok: false, error: error.message };
    const raw = (data?.data as Record<string, unknown> | null)?.tracking;
    return { ok: true, data: normalizeTracking(raw) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Merge-upsert the tracking section into `store_settings.data`, like settings/updateSection. */
export async function saveTracking(cfg: Tracking): Promise<TrackingResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const current = (row?.data as Record<string, unknown>) ?? {};
    const merged = { ...current, tracking: normalizeTracking(cfg) };
    // Upsert so the save persists even if the seed row is missing (a plain
    // UPDATE would match 0 rows and "succeed" without saving anything).
    const { error } = await supabase
      .from("store_settings")
      .upsert({ id: "default", data: merged }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    // Forget the cached copy so the storefront's tag/verification update on the
    // next page view instead of a minute later.
    invalidateTracking();
    revalidatePath("/analytics/website");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
