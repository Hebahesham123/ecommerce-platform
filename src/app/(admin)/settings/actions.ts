"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

export type SettingsResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type SettingsData = Record<string, Record<string, unknown>>;

export async function getSettings(): Promise<SettingsResult<SettingsData>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle(); // no error when the row doesn't exist yet
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data?.data as SettingsData) ?? {} };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSection(
  section: string,
  sectionData: Record<string, unknown>,
): Promise<SettingsResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const current = (row?.data as SettingsData) ?? {};
    const merged = { ...current, [section]: sectionData };
    // Upsert so the save persists even if the seed row is missing (a plain
    // UPDATE would match 0 rows and "succeed" without saving anything).
    const { error } = await supabase
      .from("store_settings")
      .upsert({ id: "default", data: merged }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath(`/settings/${section}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
