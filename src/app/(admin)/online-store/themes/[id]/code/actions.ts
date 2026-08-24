"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { purgeThemeBundle } from "@/lib/theme-render-service";
import { mimeForPath, isEditablePath } from "@/lib/themes";

const BUCKET = "themes";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_EDITABLE_BYTES = 2_000_000;

function mapError(message: string): string {
  return /relation .*theme_file_edits.* does not exist|could not find the table/i.test(message)
    ? "migration_missing"
    : message;
}

/** Storage prefix for a theme (paths from listThemeFiles are relative to it). */
async function themePrefix(themeId: string): Promise<string> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("themes")
    .select("storage_path")
    .eq("id", themeId)
    .maybeSingle();
  return (data?.storage_path as string) || themeId;
}

export type ThemeFileContent = {
  path: string;
  content: string;
  editable: boolean;
  /** True when this file has been edited since upload (an original is stored). */
  modified: boolean;
};

export async function readThemeFile(
  themeId: string,
  path: string,
): Promise<ActionResult<ThemeFileContent>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!isEditablePath(path))
    return { ok: true, data: { path, content: "", editable: false, modified: false } };
  try {
    const supabase = getServerSupabase();
    const prefix = await themePrefix(themeId);
    const { data, error } = await supabase.storage.from(BUCKET).download(`${prefix}/${path}`);
    if (error || !data) return { ok: false, error: error?.message ?? "not_found" };
    if (data.size > MAX_EDITABLE_BYTES)
      return { ok: true, data: { path, content: "", editable: false, modified: false } };

    // Missing table just means "no edit history yet" — still let them edit.
    let modified = false;
    try {
      const { data: row } = await supabase
        .from("theme_file_edits")
        .select("path")
        .eq("theme_id", themeId)
        .eq("path", path)
        .maybeSingle();
      modified = Boolean(row);
    } catch {
      /* migration not applied */
    }

    return { ok: true, data: { path, content: await data.text(), editable: true, modified } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Paths edited since upload, so the file tree can flag them. */
export async function listModifiedFiles(themeId: string): Promise<ActionResult<string[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("theme_file_edits")
      .select("path")
      .eq("theme_id", themeId);
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: (data ?? []).map((r) => String(r.path)) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function saveThemeFile(
  themeId: string,
  path: string,
  content: string,
): Promise<ActionResult<{ modified: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!isEditablePath(path)) return { ok: false, error: "not_editable" };

  // A broken .json quietly disables a template or the whole settings schema,
  // so it is checked before it can be written.
  if (path.endsWith(".json")) {
    try {
      JSON.parse(content);
    } catch (e) {
      return { ok: false, error: `invalid_json: ${(e as Error).message}` };
    }
  }

  try {
    const supabase = getServerSupabase();
    const prefix = await themePrefix(themeId);
    const full = `${prefix}/${path}`;

    // Keep the uploaded original the first time this file is touched.
    let modified = true;
    try {
      const { data: existing } = await supabase
        .from("theme_file_edits")
        .select("id")
        .eq("theme_id", themeId)
        .eq("path", path)
        .maybeSingle();
      if (!existing) {
        const { data: current } = await supabase.storage.from(BUCKET).download(full);
        const originalContent = current ? await current.text() : "";
        await supabase
          .from("theme_file_edits")
          .insert({ theme_id: themeId, path, original_content: originalContent });
      }
    } catch {
      // No edit history table — saving still works, revert just won't.
      modified = false;
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(full, new TextEncoder().encode(content), {
        contentType: mimeForPath(path),
        upsert: true,
      });
    if (error) return { ok: false, error: error.message };

    await purgeThemeBundle(themeId);
    revalidatePath(`/online-store/themes/${themeId}/code`);
    return { ok: true, data: { modified } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Restore the file exactly as it was uploaded. */
export async function revertThemeFile(
  themeId: string,
  path: string,
): Promise<ActionResult<{ content: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row, error } = await supabase
      .from("theme_file_edits")
      .select("original_content")
      .eq("theme_id", themeId)
      .eq("path", path)
      .maybeSingle();
    if (error) return { ok: false, error: mapError(error.message) };
    if (!row) return { ok: false, error: "no_original" };

    const original = String(row.original_content ?? "");
    const prefix = await themePrefix(themeId);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(`${prefix}/${path}`, new TextEncoder().encode(original), {
        contentType: mimeForPath(path),
        upsert: true,
      });
    if (upErr) return { ok: false, error: upErr.message };

    await supabase
      .from("theme_file_edits")
      .delete()
      .eq("theme_id", themeId)
      .eq("path", path);

    await purgeThemeBundle(themeId);
    revalidatePath(`/online-store/themes/${themeId}/code`);
    return { ok: true, data: { content: original } };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
