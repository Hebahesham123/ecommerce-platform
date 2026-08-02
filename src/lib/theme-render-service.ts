/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { renderThemePage, type FileMap, type RenderRoute } from "@/lib/liquid-render";
import { getCatalog, searchProducts, type ProductDrop } from "@/lib/storefront-data";
import { buildCart, type CartLine } from "@/lib/storefront-cart";
import { pixelBaseCode } from "@/lib/meta";

const BUCKET = "themes";
/** How long a theme's source files stay in memory. Catalog data is NOT cached here. */
const BUNDLE_TTL_MS = 5 * 60_000;

type StoredFile = { path: string; url: string };

// ---- Theme bundle (sources + asset base), cached in memory ------------------
type LiquidBundle = {
  kind: "liquid";
  name: string;
  files: FileMap;
  assetBase: string;
  cssAssets: string[];
};
type StaticBundle = {
  kind: "static";
  name: string;
  entry: StoredFile;
  files: StoredFile[];
  stripLen: number;
};
type Bundle = LiquidBundle | StaticBundle;

const bundleCache = new Map<string, { at: number; bundle: Bundle }>();

/** Drop cached theme sources (call after a re-upload). */
export function invalidateThemeBundle(id?: string): void {
  if (id) bundleCache.delete(id);
  else bundleCache.clear();
}

async function listAll(prefix: string): Promise<StoredFile[]> {
  const supabase = getServerSupabase();
  async function walk(dir: string): Promise<StoredFile[]> {
    const { data } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (!data) return [];
    const out: StoredFile[] = [];
    for (const item of data as { name: string; id: string | null }[]) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await walk(full)));
      else
        out.push({
          path: full.slice(prefix.length + 1),
          url: supabase.storage.from(BUCKET).getPublicUrl(full).data.publicUrl,
        });
    }
    return out;
  }
  return walk(prefix);
}

async function loadBundle(
  id: string,
  fresh: boolean,
): Promise<Bundle | { error: string }> {
  const hit = bundleCache.get(id);
  if (!fresh && hit && Date.now() - hit.at < BUNDLE_TTL_MS) return hit.bundle;

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

  // Zips usually wrap everything in a single folder — treat that as the root.
  const tops = new Set(all.map((f) => f.path.split("/")[0]));
  const wrapper = tops.size === 1 ? [...tops][0] : "";
  const stripLen = wrapper ? wrapper.length + 1 : 0;
  const rootStorage = wrapper ? `${prefix}/${wrapper}` : prefix;
  const rel = (p: string) => p.slice(stripLen);

  const hasLiquid =
    all.some((f) => rel(f.path) === "layout/theme.liquid") ||
    all.some((f) => rel(f.path) === "templates/index.json") ||
    all.some((f) => rel(f.path) === "templates/index.liquid");

  let bundle: Bundle;
  if (!hasLiquid) {
    const htmlFiles = all.filter(
      (f) => /\.html?$/i.test(f.path) && !rel(f.path).startsWith("_preview/"),
    );
    const entry =
      htmlFiles.find((f) => /(^|\/)index\.html?$/i.test(rel(f.path))) ?? htmlFiles[0];
    if (!entry) return { error: "not_renderable" };
    bundle = {
      kind: "static",
      name: (row.name as string) || "Store",
      entry,
      files: all,
      stripLen,
    };
  } else {
    let assetBase = supabase.storage.from(BUCKET).getPublicUrl(`${rootStorage}/`).data
      .publicUrl;
    if (!assetBase.endsWith("/")) assetBase += "/";

    const textFiles = all.filter((f) => /\.(liquid|json)$/i.test(f.path));
    const entries = await Promise.all(
      textFiles.map(async (f) => {
        try {
          const r = await fetch(f.url, { cache: "no-store" });
          return [rel(f.path), r.ok ? await r.text() : ""] as const;
        } catch {
          return [rel(f.path), ""] as const;
        }
      }),
    );
    const files: FileMap = {};
    for (const [k, v] of entries) files[k] = v;

    bundle = {
      kind: "liquid",
      name: (row.name as string) || "Store",
      files,
      assetBase,
      cssAssets: all
        .filter((f) => /^assets\/[^/]+\.css$/i.test(rel(f.path)))
        .map((f) => f.url),
    };
  }

  bundleCache.set(id, { at: Date.now(), bundle });
  return bundle;
}

// ---- Meta Pixel -------------------------------------------------------------
async function getPixelSnippet(): Promise<string> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("meta_connection")
      .select("pixel_id, pixel_enabled")
      .eq("id", "default")
      .single();
    if (data?.pixel_enabled && data?.pixel_id) return pixelBaseCode(data.pixel_id as string);
  } catch {
    /* no pixel configured */
  }
  return "";
}

function injectHead(html: string, snippet: string): string {
  if (!snippet) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${snippet}`);
  return `${snippet}${html}`;
}

function injectBase(html: string, base: string): string {
  const tag = `<base href="${base}">`;
  if (/<base\b/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${tag}</head>`);
  return `${tag}${html}`;
}

// ---- Which theme is live ----------------------------------------------------
export async function getPublishedThemeId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("themes")
      .select("id")
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (data?.id) return String(data.id);
    // Nothing published yet — fall back to the most recent upload so the
    // storefront still has something to show.
    const { data: latest } = await supabase
      .from("themes")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return latest?.id ? String(latest.id) : null;
  } catch {
    return null;
  }
}

// ---- Route dispatch ---------------------------------------------------------
function sortProducts(products: ProductDrop[], sortBy: string): ProductDrop[] {
  const out = [...products];
  switch (sortBy) {
    case "price-ascending":
      return out.sort((a, b) => a.price_min - b.price_min);
    case "price-descending":
      return out.sort((a, b) => b.price_min - a.price_min);
    case "title-ascending":
      return out.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    case "title-descending":
      return out.sort((a, b) => String(b.title).localeCompare(String(a.title)));
    case "best-selling":
    case "manual":
    default:
      return out;
  }
}

export type StorefrontRequest = {
  themeId: string;
  /** URL prefix the storefront is served from, e.g. "/shop" (no trailing slash). */
  mount: string;
  /** Path within the storefront, e.g. "/collections/all". */
  path: string;
  query: Record<string, string>;
  cartLines: CartLine[];
  fresh?: boolean;
  /** Overrides the shop name (the theme preview shows the theme's own name). */
  shopName?: string;
};

export type StorefrontResponse = { html: string; status: number };

function errorPage(message: string): StorefrontResponse {
  return {
    status: 200,
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px/1.7 system-ui,-apple-system,Segoe UI,sans-serif;padding:48px;color:#475569;max-width:640px;margin:0 auto}code{background:#f1f5f9;padding:2px 6px;border-radius:6px}</style></head><body>${message}</body></html>`,
  };
}

/**
 * Render one storefront page from an uploaded theme, wired to the dashboard's
 * products, inventory and collections.
 */
export async function renderStorefront(
  req: StorefrontRequest,
): Promise<StorefrontResponse> {
  if (!isSupabaseConfigured()) return errorPage("Supabase is not connected.");

  const bundle = await loadBundle(req.themeId, Boolean(req.fresh));
  if ("error" in bundle) {
    const msg =
      bundle.error === "not_renderable"
        ? "This theme has no renderable template."
        : bundle.error === "empty_theme"
          ? "This theme has no files."
          : `Theme error: ${bundle.error}`;
    return errorPage(msg);
  }

  const pixel = await getPixelSnippet();

  // ---- Static (plain HTML) themes: serve files as uploaded -----------------
  if (bundle.kind === "static") {
    const rel = (p: string) => p.slice(bundle.stripLen);
    const wanted = req.path.replace(/^\/+/, "");
    const match = wanted
      ? bundle.files.find((f) => rel(f.path) === wanted || rel(f.path) === `${wanted}.html`)
      : null;
    const target = match ?? bundle.entry;
    try {
      const r = await fetch(target.url, { cache: "no-store" });
      const html = await r.text();
      const folder = target.url.slice(0, target.url.lastIndexOf("/") + 1);
      return { status: 200, html: injectHead(injectBase(html, folder), pixel) };
    } catch (e) {
      return errorPage(`Preview error: ${(e as Error).message}`);
    }
  }

  // ---- Liquid themes: render against live catalog data ---------------------
  const mount = req.mount.replace(/\/$/, "");
  const catalog = await getCatalog(mount);

  const segments = req.path.split("/").filter(Boolean);
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
  const sortBy = req.query.sort_by ?? "";

  let route: RenderRoute = { type: "index", path: "/", query: req.query, page };
  let status = 200;

  const productRoute = (handle: string): RenderRoute | null => {
    const product = catalog.productByHandle.get(handle);
    if (!product) return null;
    const variantId = req.query.variant;
    const variant =
      (variantId && product.variants.find((v) => v.id === variantId)) ||
      product.selected_or_first_available_variant ||
      null;
    return {
      type: "product",
      path: `/products/${handle}`,
      query: req.query,
      page,
      product: {
        ...product,
        selected_variant: variantId ? variant : null,
        selected_or_first_available_variant: variant,
      } as ProductDrop,
      variant: variant as Record<string, unknown> | null,
    };
  };

  const collectionRoute = (handle: string): RenderRoute | null => {
    const collection = catalog.collectionByHandle.get(handle);
    if (!collection) return null;
    return {
      type: "collection",
      path: `/collections/${handle}`,
      query: req.query,
      page,
      collection: sortBy
        ? { ...collection, products: sortProducts(collection.products, sortBy), sort_by: sortBy }
        : collection,
    };
  };

  const notFound = (): RenderRoute => {
    status = 404;
    return { type: "404", path: req.path, query: req.query, page };
  };

  if (segments.length === 0) {
    route = { type: "index", path: "/", query: req.query, page };
  } else if (segments[0] === "collections") {
    if (segments.length === 1) {
      route = { type: "list-collections", path: "/collections", query: req.query, page };
    } else if (segments.length >= 4 && segments[2] === "products") {
      route = productRoute(segments[3]) ?? notFound();
    } else {
      route = collectionRoute(segments[1]) ?? notFound();
    }
  } else if (segments[0] === "products" && segments[1]) {
    route = productRoute(segments[1]) ?? notFound();
  } else if (segments[0] === "search") {
    const terms = req.query.q ?? "";
    route = {
      type: "search",
      path: "/search",
      query: req.query,
      page,
      searchTerms: terms,
      searchResults: sortBy
        ? sortProducts(searchProducts(catalog, terms), sortBy)
        : searchProducts(catalog, terms),
    };
  } else if (segments[0] === "cart") {
    route = { type: "cart", path: "/cart", query: req.query, page };
  } else {
    route = notFound();
  }

  route.cart = buildCart(req.cartLines, catalog, mount);

  try {
    const html = await renderThemePage({
      files: bundle.files,
      assetBase: bundle.assetBase,
      mount,
      catalog,
      route,
      cssAssets: bundle.cssAssets,
      shopName: req.shopName,
    });
    return { status, html: injectHead(html, pixel) };
  } catch (e) {
    return errorPage(`Render error: ${(e as Error).message}`);
  }
}

/** Cart JSON endpoints need the catalog without rendering a page. */
export async function getStorefrontCatalog(mount: string) {
  return getCatalog(mount.replace(/\/$/, ""));
}
