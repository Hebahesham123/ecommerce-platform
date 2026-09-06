import "server-only";
import {
  getCatalog,
  type CollectionDrop,
  type ProductDrop,
  type VariantDrop,
} from "@/lib/storefront-data";

/**
 * The website's own catalogue, in a shape an app can use.
 *
 * The app used to invent its categories out of the `category` string on each
 * product, which meant the merchant's real collections — the ones they
 * curated, ordered, gave images to and published — were invisible to it. Two
 * surfaces merchandising themselves differently is not two channels; it is one
 * shop and one shop-shaped guess.
 *
 * So everything here reads `getCatalog()`, the same resolver the storefront
 * renders from. Manual collections, vendor and tag rules, sort order, the
 * publish flag, handles, images: identical on both, by construction rather
 * than by anyone remembering to keep them level.
 *
 * The one translation is money. The catalogue speaks minor units because
 * Liquid's `money` filter needs them, and the rest of this API speaks whole
 * pounds. Getting that wrong shows a shopper 850,000 for an 8,500 handbag, so
 * it happens exactly once, here.
 */

/** Minor units (850000) → what the rest of the API speaks (8500). */
const major = (v: unknown): number => Math.round(Number(v ?? 0)) / 100;
const majorOrNull = (v: unknown): number | null =>
  v == null || Number(v) <= 0 ? null : major(v);

export type AppVariant = {
  id: string;
  variantTitle: string | null;
  sku: string | null;
  price: number | null;
  compareAt: number | null;
  available: number;
};

export type AppProduct = {
  /** The first variant's id — what /cart/price and /orders take. */
  id: string;
  /** The website's handle for the same product, so links match across surfaces. */
  handle: string;
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  category: string | null;
  vendor: string | null;
  tags: string[];
  priceMin: number | null;
  priceMax: number | null;
  compareAt: number | null;
  available: number;
  variants: AppVariant[];
};

export type AppCollection = {
  handle: string;
  title: string;
  description: string | null;
  image: string | null;
  productCount: number;
};

const imageOf = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  const src = (v as Record<string, unknown>).src ?? (v as Record<string, unknown>).url;
  return typeof src === "string" && src ? src : null;
};

function toVariant(v: VariantDrop): AppVariant {
  return {
    id: String(v.id),
    // "Default Title" is Shopify's placeholder for a product with no options;
    // showing it to a shopper is showing them plumbing.
    variantTitle: v.title && v.title !== "Default Title" ? String(v.title) : null,
    sku: v.sku ?? null,
    price: majorOrNull(v.price),
    compareAt: majorOrNull(v.compare_at_price),
    available: Number(v.inventory_quantity ?? 0),
  };
}

export function toProduct(p: ProductDrop): AppProduct {
  const images = Array.isArray(p.images)
    ? (p.images as unknown[]).map(imageOf).filter((s): s is string => Boolean(s))
    : [];
  return {
    id: String(p.id),
    handle: String(p.handle),
    name: String(p.title ?? ""),
    description: (p.description as string) || null,
    image: imageOf(p.featured_image) ?? images[0] ?? null,
    images,
    category: (p.category as string) ?? null,
    vendor: (p.vendor as string) || null,
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    priceMin: majorOrNull(p.price_min),
    priceMax: majorOrNull(p.price_max),
    compareAt: majorOrNull(p.compare_at_price),
    available: Number(p.quantity_available ?? 0),
    variants: (p.variants ?? []).map(toVariant),
  };
}

/**
 * What a grid tile needs, and nothing else.
 *
 * A listing of forty products carrying every variant, every image and every
 * tag is most of a megabyte for a screen that shows a picture, a name and a
 * price. The full record is one tap away at /products/{id}, which is also when
 * the shopper actually needs to know which sizes are left.
 */
export type AppProductCard = {
  id: string;
  handle: string;
  name: string;
  image: string | null;
  priceMin: number | null;
  priceMax: number | null;
  compareAt: number | null;
  available: number;
};

export function toCard(p: ProductDrop): AppProductCard {
  const images = Array.isArray(p.images) ? (p.images as unknown[]) : [];
  return {
    id: String(p.id),
    handle: String(p.handle),
    name: String(p.title ?? ""),
    image: imageOf(p.featured_image) ?? imageOf(images[0]) ?? null,
    priceMin: majorOrNull(p.price_min),
    priceMax: majorOrNull(p.price_max),
    compareAt: majorOrNull(p.compare_at_price),
    available: Number(p.quantity_available ?? 0),
  };
}

export function toCollection(c: CollectionDrop): AppCollection {
  return {
    handle: String(c.handle),
    title: String(c.title ?? ""),
    description: (c.description as string) || null,
    image: imageOf(c.featured_image ?? c.image),
    productCount: Number(c.products_count ?? 0),
  };
}

/**
 * `all` is a synthetic collection the theme always gets — every product in the
 * shop. It is genuinely useful as a "shop everything" screen, so it stays
 * fetchable by handle, but it has no business sitting in a list of the
 * merchant's collections next to the ones they actually made.
 */
export const SYNTHETIC = "all";

export async function appCatalog() {
  return getCatalog("");
}

// ---- Navigation -------------------------------------------------------------

/**
 * What a menu item points at.
 *
 * The database stores a website path, because that is what the merchant types
 * and what the theme needs. An app has no URLs — it has screens — so the path
 * is parsed into a target it can route on. Anything unrecognised stays a plain
 * url, which an app should open in a browser rather than guess at.
 */
export type LinkTarget =
  | { type: "home" }
  | { type: "collection"; handle: string }
  | { type: "product"; handle: string }
  | { type: "search" }
  | { type: "cart" }
  | { type: "page"; handle: string }
  | { type: "url"; url: string };

export type AppMenuItem = { title: string; target: LinkTarget; children: AppMenuItem[] };
export type AppMenu = { handle: string; title: string; items: AppMenuItem[] };

export function parseTarget(raw: string): LinkTarget {
  const url = String(raw ?? "").trim();
  if (!url || url === "/") return { type: "home" };
  // Only something with its own origin is genuinely somewhere else.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return { type: "url", url };

  const path = url.split("?")[0].replace(/\/+$/, "") || "/";
  const collection = /^\/collections\/([^/]+)$/.exec(path);
  if (collection) return { type: "collection", handle: decodeURIComponent(collection[1]) };
  const product = /^\/products\/([^/]+)$/.exec(path);
  if (product) return { type: "product", handle: decodeURIComponent(product[1]) };
  const page = /^\/pages\/([^/]+)$/.exec(path);
  if (page) return { type: "page", handle: decodeURIComponent(page[1]) };
  if (path === "/collections") return { type: "collection", handle: SYNTHETIC };
  if (path === "/search") return { type: "search" };
  if (path === "/cart") return { type: "cart" };

  // A bare path like /reviews or /happy-customers is a page of this shop —
  // that is how the storefront's own widget pages are addressed. Calling those
  // "external" and refusing to open them, which is what fell out of treating
  // anything unrecognised as a link away from the store, left three items in
  // the merchant's menu that did nothing at all.
  const bare = /^\/([^/]+)$/.exec(path);
  if (bare) return { type: "page", handle: decodeURIComponent(bare[1]) };

  return { type: "url", url };
}

/**
 * The merchant's menus, as screens rather than URLs.
 *
 * If they haven't built any, the website falls back to a menu made from Home
 * plus the first handful of collections. The app gets the same fallback rather
 * than an empty drawer, because a shop with no navigation on one surface and
 * navigation on the other is the drift this whole exercise exists to prevent.
 */
export async function appMenus(): Promise<AppMenu[]> {
  const catalog = await appCatalog();

  const convert = (items: { title: string; url: string; children: unknown[] }[]): AppMenuItem[] =>
    items.map((i) => ({
      title: String(i.title ?? ""),
      target: parseTarget(i.url),
      children: convert(
        (i.children ?? []) as { title: string; url: string; children: unknown[] }[],
      ),
    }));

  if (catalog.menus.length) {
    return catalog.menus.map((m) => ({
      handle: m.handle,
      title: m.title,
      items: convert(m.items),
    }));
  }

  return [
    {
      handle: "main-menu",
      title: "Main menu",
      items: [
        { title: "Home", target: { type: "home" }, children: [] },
        ...catalog.collections
          .filter((c) => c.handle !== SYNTHETIC)
          .slice(0, 8)
          .map((c) => ({
            title: String(c.title),
            target: { type: "collection" as const, handle: String(c.handle) },
            children: [],
          })),
      ],
    },
  ];
}
