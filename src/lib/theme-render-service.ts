import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { renderThemeHome, type FileMap } from "@/lib/liquid-render";

const BUCKET = "themes";
const CACHE_PATH = ".cache/preview.html";

type StoredFile = { path: string; url: string };

async function listAll(prefix: string): Promise<StoredFile[]> {
  const supabase = getServerSupabase();
  async function walk(dir: string): Promise<StoredFile[]> {
    const { data } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (!data) return [];
    const out: StoredFile[] = [];
    for (const item of data as { name: string; id: string | null }[]) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await walk(full)));
      else out.push({ path: full.slice(prefix.length + 1), url: supabase.storage.from(BUCKET).getPublicUrl(full).data.publicUrl });
    }
    return out;
  }
  return walk(prefix);
}

function injectBase(html: string, base: string): string {
  const tag = `<base href="${base}">`;
  if (/<base\b/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${tag}</head>`);
  return `${tag}${html}`;
}

/**
 * Returns rendered HTML for a theme as a string (or an error).
 * - Shopify Liquid themes are rendered via the Liquid engine (cached after first build).
 * - Static themes that already contain index.html are served as-is.
 */
export async function getThemeHtml(
  id: string,
  opts: { fresh?: boolean } = {},
): Promise<{ html: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "not_configured" };
  const supabase = getServerSupabase();

  const { data: row, error } = await supabase
    .from("themes")
    .select("storage_path, name")
    .eq("id", id)
    .single();
  if (error || !row) return { error: error?.message || "not_found" };
  const prefix = (row.storage_path as string) || id;

  const all = await listAll(prefix);
  if (all.length === 0) return { error: "empty_theme" };

  const tops = new Set(all.map((f) => f.path.split("/")[0]));
  const wrapper = tops.size === 1 ? [...tops][0] : "";
  const stripLen = wrapper ? wrapper.length + 1 : 0;
  const rootStorage = wrapper ? `${prefix}/${wrapper}` : prefix;
  let assetBase = supabase.storage.from(BUCKET).getPublicUrl(`${rootStorage}/`).data.publicUrl;
  if (!assetBase.endsWith("/")) assetBase += "/";

  const rel = (p: string) => p.slice(stripLen);
  const hasLiquid =
    all.some((f) => rel(f.path) === "layout/theme.liquid") ||
    all.some((f) => rel(f.path) === "templates/index.json") ||
    all.some((f) => rel(f.path) === "templates/index.liquid");

  // Static theme: serve an existing HTML entry directly.
  if (!hasLiquid) {
    const htmlFiles = all.filter((f) => /\.html?$/i.test(f.path) && !rel(f.path).startsWith("_preview/"));
    const entry = htmlFiles.find((f) => /(^|\/)index\.html?$/i.test(rel(f.path))) ?? htmlFiles[0];
    if (!entry) return { error: "not_renderable" };
    try {
      const r = await fetch(entry.url);
      const html = await r.text();
      const folder = entry.url.slice(0, entry.url.lastIndexOf("/") + 1);
      return { html: injectBase(html, folder) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // Liquid theme — serve cached render if present (first render is expensive).
  const cacheFull = `${rootStorage}/${CACHE_PATH}`;
  if (!opts.fresh) {
    const cached = all.find((f) => rel(f.path) === CACHE_PATH);
    if (cached) {
      try {
        const r = await fetch(cached.url);
        if (r.ok) return { html: await r.text() };
      } catch {
        /* fall through to re-render */
      }
    }
  }

  // Fetch text sources and force-link the theme's stylesheets.
  const textFiles = all.filter((f) => /\.(liquid|json)$/i.test(f.path));
  const cssAssets = all
    .filter((f) => /^assets\/[^/]+\.css$/i.test(rel(f.path)))
    .map((f) => f.url);
  const entries = await Promise.all(
    textFiles.map(async (f) => {
      try {
        const r = await fetch(f.url);
        return [rel(f.path), r.ok ? await r.text() : ""] as const;
      } catch {
        return [rel(f.path), ""] as const;
      }
    }),
  );
  const files: FileMap = {};
  for (const [k, v] of entries) files[k] = v;

  try {
    const html = await renderThemeHome({
      files,
      assetBase,
      shopName: (row.name as string) || "Store",
      currency: "EGP",
      cssAssets,
    });
    try {
      await supabase.storage
        .from(BUCKET)
        .upload(cacheFull, new TextEncoder().encode(html), {
          contentType: "text/html; charset=utf-8",
          upsert: true,
        });
    } catch {
      /* non-fatal cache write */
    }
    return { html };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
