import type { DictKey } from "./i18n";

// ---- File domain (Content · Files) ------------------------------------------
export type FileKind = "image" | "video" | "document" | "audio" | "other";

export type FileAsset = {
  id: string;
  name: string;
  alt: string | null;
  mimeType: string | null;
  kind: FileKind;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  url: string;
  storagePath: string | null;
  isExternal: boolean;
  folder: string;
  referenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export const fileKindKey: Record<FileKind, DictKey> = {
  image: "fk_image",
  video: "fk_video",
  document: "fk_document",
  audio: "fk_audio",
  other: "fk_other",
};

/** Derive a coarse file kind from a MIME type (and filename as fallback). */
export function kindFromMime(mime: string | null, name = ""): FileKind {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (
    m.includes("pdf") ||
    m.includes("word") ||
    m.includes("excel") ||
    m.includes("spreadsheet") ||
    m.includes("presentation") ||
    m.includes("text") ||
    m.includes("zip") ||
    m.includes("json") ||
    m.includes("csv")
  )
    return "document";

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "json", "zip"].includes(ext))
    return "document";
  return "other";
}

/** Human-readable file size. */
export function formatBytes(bytes: number | null, lang: "ar" | "en" = "ar"): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  const num = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: val < 10 && i > 0 ? 1 : 0,
  }).format(val);
  return `${num} ${units[i]}`;
}

export const FILE_KINDS: FileKind[] = ["image", "video", "document", "audio", "other"];
