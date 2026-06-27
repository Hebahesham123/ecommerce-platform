import type { DictKey } from "./i18n";
import { tone } from "./data";

export type ThemeStatus = "published" | "unpublished" | "draft";

export type Theme = {
  id: string;
  name: string;
  version: string | null;
  status: ThemeStatus;
  isCurrent: boolean;
  previewUrl: string | null;
  entryPath: string | null;
  storagePath: string | null;
  sourceKind: "zip" | "html";
  sizeBytes: number | null;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export const themeStatusKey: Record<ThemeStatus, DictKey> = {
  published: "th_published",
  unpublished: "th_unpublished",
  draft: "th_draft",
};

export const themeStatusTone: Record<ThemeStatus, string> = {
  published: tone.green,
  unpublished: tone.slate,
  draft: tone.amber,
};

/** Map a file extension to a content-type for serving extracted theme assets. */
export function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    bmp: "image/bmp",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    txt: "text/plain; charset=utf-8",
    map: "application/json",
    xml: "application/xml",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Pick the best entry HTML from a list of theme file paths. */
export function pickEntry(paths: string[]): string | null {
  const html = paths.filter((p) => /\.html?$/i.test(p));
  if (html.length === 0) return null;
  // Prefer index.html, then the shallowest path, then shortest name.
  const index = html.filter((p) => /(^|\/)index\.html?$/i.test(p));
  const pool = index.length ? index : html;
  return pool.sort(
    (a, b) => a.split("/").length - b.split("/").length || a.length - b.length,
  )[0];
}
