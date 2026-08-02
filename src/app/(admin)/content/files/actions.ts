"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  kindFromMime,
  type FileAsset,
  type FileKind,
} from "@/lib/content";

const BUCKET = "files";

type Row = Record<string, unknown>;

function rowToFile(r: Row): FileAsset {
  const numOrNull = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    alt: (r.alt as string) ?? null,
    mimeType: (r.mime_type as string) ?? null,
    kind: (r.kind as FileKind) ?? "other",
    sizeBytes: numOrNull(r.size_bytes),
    width: numOrNull(r.width),
    height: numOrNull(r.height),
    url: String(r.url ?? ""),
    storagePath: (r.storage_path as string) ?? null,
    isExternal: Boolean(r.is_external),
    folder: String(r.folder ?? ""),
    referenceCount: Number(r.reference_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export type FileResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function sanitize(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "file";
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.\w]/g, "") : "";
  return `${base}${ext}`;
}

// ---- Reads ------------------------------------------------------------------
export async function listFiles(): Promise<FileResult<FileAsset[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("content_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(rowToFile) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Upload (device / drag-drop) -------------------------------------------
export async function uploadFile(form: FormData): Promise<FileResult<FileAsset>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "no_file" };

    const widthRaw = form.get("width");
    const heightRaw = form.get("height");
    const width = widthRaw ? Number(widthRaw) : null;
    const height = heightRaw ? Number(heightRaw) : null;

    const supabase = getServerSupabase();
    const safe = sanitize(file.name);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const insert = {
      name: file.name,
      mime_type: file.type || null,
      kind: kindFromMime(file.type, file.name),
      size_bytes: file.size,
      width: Number.isFinite(width as number) ? width : null,
      height: Number.isFinite(height as number) ? height : null,
      url: pub.publicUrl,
      storage_path: path,
      is_external: false,
    };
    const { data, error } = await supabase
      .from("content_files")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return { ok: false, error: error.message };
    }
    revalidatePath("/content/files");
    return { ok: true, data: rowToFile(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Add from URL ----------------------------------------------------------
// Tries to download and store the file; if the fetch fails (CORS/network),
// falls back to keeping it as an external linked reference.
export async function addFromUrl(
  rawUrl: string,
  customName?: string,
): Promise<FileResult<FileAsset>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "invalid_url" };

  const supabase = getServerSupabase();
  const guessName =
    customName?.trim() ||
    decodeURIComponent(url.split("/").pop()?.split("?")[0] || "") ||
    "file";

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok) {
      const mime = res.headers.get("content-type")?.split(";")[0] || null;
      const buf = new Uint8Array(await res.arrayBuffer());
      const safe = sanitize(guessName.includes(".") ? guessName : `${guessName}`);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: mime || "application/octet-stream", upsert: false });
      if (!upErr) {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { data, error } = await supabase
          .from("content_files")
          .insert({
            name: guessName,
            mime_type: mime,
            kind: kindFromMime(mime, guessName),
            size_bytes: buf.byteLength,
            url: pub.publicUrl,
            storage_path: path,
            is_external: false,
          })
          .select("*")
          .single();
        if (!error) {
          revalidatePath("/content/files");
          return { ok: true, data: rowToFile(data) };
        }
        await supabase.storage.from(BUCKET).remove([path]);
      }
    }
  } catch {
    // fall through to external reference
  }

  // Fallback: store as external linked reference
  try {
    const { data, error } = await supabase
      .from("content_files")
      .insert({
        name: guessName,
        kind: kindFromMime(null, guessName),
        url,
        storage_path: null,
        is_external: true,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/content/files");
    return { ok: true, data: rowToFile(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Rename / alt ----------------------------------------------------------
export async function updateFile(
  id: string,
  patch: { name?: string; alt?: string },
): Promise<FileResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const update: Row = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.alt !== undefined) update.alt = patch.alt;
    const { error } = await supabase.from("content_files").update(update).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/content/files");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Delete ----------------------------------------------------------------
export async function deleteFile(id: string): Promise<FileResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("content_files")
      .select("storage_path")
      .eq("id", id)
      .single();
    const path = row?.storage_path as string | null | undefined;
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("content_files").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/content/files");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
