"use server";

import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { mimeForPath, pickEntry, type Theme, type ThemeStatus } from "@/lib/themes";

const BUCKET = "themes";

type Row = Record<string, unknown>;

function rowToTheme(r: Row): Theme {
  const numOrNull = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    version: (r.version as string) ?? null,
    status: (r.status as ThemeStatus) ?? "unpublished",
    isCurrent: Boolean(r.is_current),
    previewUrl: (r.preview_url as string) ?? null,
    entryPath: (r.entry_path as string) ?? null,
    storagePath: (r.storage_path as string) ?? null,
    sourceKind: (r.source_kind as "zip" | "html") ?? "zip",
    sizeBytes: numOrNull(r.size_bytes),
    fileCount: Number(r.file_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export type ThemeResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function cleanEntryPath(p: string): string {
  return p.replace(/^\.?\//, "");
}
function isJunk(p: string): boolean {
  return (
    p.startsWith("__MACOSX/") ||
    p.endsWith("/.DS_Store") ||
    p.endsWith(".DS_Store") ||
    p.includes("/.git/")
  );
}

// ---- Reads ------------------------------------------------------------------
export async function listThemes(): Promise<ThemeResult<Theme[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("themes")
      .select("*")
      .order("is_current", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(rowToTheme) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Upload + extract -------------------------------------------------------
export async function uploadTheme(form: FormData): Promise<ThemeResult<Theme>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "no_file" };
    const supabase = getServerSupabase();

    const themeId = crypto.randomUUID();
    const baseName = file.name.replace(/\.(zip|html?)$/i, "") || "theme";
    const isZip =
      /\.zip$/i.test(file.name) ||
      file.type.includes("zip") ||
      file.type === "application/x-zip-compressed";

    let entryPath: string | null = null;
    let fileCount = 0;

    if (isZip) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(
        (e) => !e.dir && !isJunk(e.name),
      );
      if (entries.length === 0) return { ok: false, error: "empty_zip" };

      const paths: string[] = [];
      for (const entry of entries) {
        const rel = cleanEntryPath(entry.name);
        if (!rel) continue;
        const bytes = await entry.async("uint8array");
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(`${themeId}/${rel}`, bytes, {
            contentType: mimeForPath(rel),
            upsert: true,
          });
        if (upErr) return { ok: false, error: upErr.message };
        paths.push(rel);
      }
      fileCount = paths.length;
      entryPath = pickEntry(paths);
    } else if (/\.html?$/i.test(file.name) || file.type.includes("html")) {
      const rel = "index.html";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(`${themeId}/${rel}`, bytes, {
          contentType: "text/html; charset=utf-8",
          upsert: true,
        });
      if (upErr) return { ok: false, error: upErr.message };
      entryPath = rel;
      fileCount = 1;
    } else {
      return { ok: false, error: "unsupported_type" };
    }

    const previewUrl = entryPath
      ? supabase.storage.from(BUCKET).getPublicUrl(`${themeId}/${entryPath}`).data.publicUrl
      : null;

    const { data, error } = await supabase
      .from("themes")
      .insert({
        id: themeId,
        name: baseName,
        status: "unpublished",
        is_current: false,
        preview_url: previewUrl,
        entry_path: entryPath,
        storage_path: themeId,
        source_kind: isZip ? "zip" : "html",
        size_bytes: file.size,
        file_count: fileCount,
      })
      .select("*")
      .single();
    if (error) {
      await removeFolder(themeId);
      return { ok: false, error: error.message };
    }
    revalidatePath("/online-store/themes");
    return { ok: true, data: rowToTheme(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Publish / unpublish ----------------------------------------------------
export async function publishTheme(id: string): Promise<ThemeResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    // The DB trigger demotes any other current theme automatically.
    const { error } = await supabase
      .from("themes")
      .update({ is_current: true, status: "published" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/online-store/themes");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renameTheme(id: string, name: string): Promise<ThemeResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("themes")
      .update({ name: name.trim() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/online-store/themes");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Delete (storage folder + row) -----------------------------------------
async function removeFolder(prefix: string) {
  const supabase = getServerSupabase();
  async function walk(dir: string): Promise<string[]> {
    const { data } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (!data) return [];
    const out: string[] = [];
    for (const item of data) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      // Folders have null id/metadata in Supabase storage listings.
      if (item.id === null) out.push(...(await walk(full)));
      else out.push(full);
    }
    return out;
  }
  const paths = await walk(prefix);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function deleteTheme(id: string): Promise<ThemeResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("themes")
      .select("storage_path")
      .eq("id", id)
      .single();
    const prefix = (row?.storage_path as string) || id;
    await removeFolder(prefix);
    const { error } = await supabase.from("themes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/online-store/themes");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
