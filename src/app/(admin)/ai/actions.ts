"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { aiEnabled, readAiConfig, invalidateAi } from "@/lib/ai";
import { generateSeoMeta, generateCopy, type ContentKind } from "@/lib/ai-content";
import { DEFAULT_AI, normalizeAi, type AiConfig, type AiProvider } from "@/lib/ai-types";

export type AiActionResult = { ok: true } | { ok: false; error: string };

/** Whether AI is usable, and for which provider — drives the Generate buttons. */
export async function aiStatus(): Promise<{ enabled: boolean; provider: AiProvider }> {
  try {
    const cfg = await readAiConfig();
    return { enabled: await aiEnabled(), provider: cfg.provider };
  } catch {
    return { enabled: false, provider: "anthropic" };
  }
}

/** Generate a SEO title + description. Null when AI is off / fails. */
export async function aiSeoMeta(input: {
  kind: ContentKind;
  title?: string;
  context?: string;
  lang: "ar" | "en";
}): Promise<{ title: string; description: string } | null> {
  return generateSeoMeta(input);
}

/** Generate a block of copy. Null when AI is off / fails. */
export async function aiCopy(input: {
  kind: ContentKind;
  title?: string;
  context?: string;
  lang: "ar" | "en";
  instructions?: string;
}): Promise<string | null> {
  return generateCopy(input);
}

/** Read the stored AI config (provider + optional model). */
export async function getAiSettings(): Promise<AiConfig> {
  try {
    return await readAiConfig();
  } catch {
    return DEFAULT_AI;
  }
}

/** Merge-upsert the AI section into `store_settings.data.ai` (never stores keys). */
export async function saveAiSettings(cfg: AiConfig): Promise<AiActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const current = (row?.data as Record<string, unknown>) ?? {};
    const merged = { ...current, ai: normalizeAi(cfg) };
    const { error } = await supabase
      .from("store_settings")
      .upsert({ id: "default", data: merged }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    invalidateAi();
    revalidatePath("/seo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
