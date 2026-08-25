/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { matchesRule } from "@/lib/collections";

/**
 * Turns the dashboard's inventory into the Shopify-shaped drops a Liquid theme
 * expects (`product`, `collection`, `variant`, `image`, …).
 *
 *   inventory_items   → one row per VARIANT; rows sharing product_name are one product
 *   inventory_levels  → per-location stock; available = on_hand - committed
 *   category          → the collection a product belongs to
 *
 * Money is exposed in minor units (piastres/cents) because that is what the
 * `money` family of Liquid filters divides by 100.
 */

// ---- Types ------------------------------------------------------------------
export type ImageDrop = Record<string, unknown>;

export type VariantDrop = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  available: boolean;
  inventory_quantity: number;
  [k: string]: unknown;
};

export type ProductDrop = {
  id: string;
  handle: string;
  title: string;
  url: string;
  available: boolean;
  price: number;
  price_min: number;
  price_max: number;
  variants: VariantDrop[];
  tags: string[];
  [k: string]: unknown;
};

export type CollectionDrop = {
  id: string;
  handle: string;
  title: string;
  url: string;
  products: ProductDrop[];
  products_count: number;
  [k: string]: unknown;
};

export type ShopInfo = {
  name: string;
  currency: string;
  email: string;
  phone: string;
  description: string;
  address: Record<string, unknown>;
};

/** A navigation menu as stored in the dashboard, ready for `linklists`. */
export type MenuDef = {
  handle: string;
  title: string;
  items: MenuItemDef[];
};
export type MenuItemDef = {
  title: string;
  url: string;
  children: MenuItemDef[];
};

export type Catalog = {
  shop: ShopInfo;
  products: ProductDrop[];
  collections: CollectionDrop[];
  /** Merchant-built menus; empty means "fall back to collections". */
  menus: MenuDef[];
  productByHandle: Map<string, ProductDrop>;
  collectionByHandle: Map<string, CollectionDrop>;
  variantById: Map<string, { variant: VariantDrop; product: ProductDrop }>;
  /** Rows the storefront hides (draft/archived/unpriced) — useful for diagnostics. */
  hiddenCount: number;
};

// ---- Helpers ----------------------------------------------------------------
const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const numOrNull = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
/** Decimal currency (250.00) → minor units (25000), which Liquid's money filter expects. */
const cents = (v: unknown): number => Math.round((Number(v) || 0) * 100);

export function handleize(s: unknown): string {
  return (
    String(s ?? "")
      .toLowerCase()
      .trim()
      // keep latin letters/digits and the Arabic block; everything else separates
      .replace(/[^\w؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/** An image "drop": prints as its URL, but also exposes .src/.alt/.width like Shopify. */
function imageDrop(src: string, alt: string, position: number): ImageDrop {
  const preview = {
    src,
    url: src,
    alt,
    width: 1200,
    height: 1200,
    aspect_ratio: 1,
  };
  const o: Record<string, unknown> = {
    id: `img-${position}`,
    src,
    url: src,
    alt,
    position,
    width: 1200,
    height: 1200,
    aspect_ratio: 1,
    media_type: "image",
    attached_to_variant: false,
    variants: [],
    preview_image: preview,
  };
  // Non-enumerable so `| json` stays clean, but `{{ image }}` still prints the URL.
  Object.defineProperty(o, "toString", { value: () => src, enumerable: false });
  return o;
}

// ---- Row → drops ------------------------------------------------------------
type Row = Record<string, unknown>;

function availableOf(r: Row): number {
  const levels = Array.isArray(r.inventory_levels) ? (r.inventory_levels as Row[]) : [];
  return levels.reduce(
    (s, l) => s + Math.max(0, num(l.on_hand) - num(l.committed)),
    0,
  );
}

function imagesOf(rows: Row[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const gallery = Array.isArray(r.images) ? (r.images as unknown[]) : [];
    for (const g of gallery) {
      const u = str(g);
      if (u && !out.includes(u)) out.push(u);
    }
    const primary = str(r.image_url);
    if (primary && !out.includes(primary)) out.push(primary);
  }
  return out;
}

function tagsOf(rows: Row[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const tags = Array.isArray(r.tags) ? (r.tags as unknown[]) : [];
    for (const t of tags) {
      const s = str(t);
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

function buildProduct(rows: Row[], handle: string, mount: string): ProductDrop {
  const title = String(rows[0].product_name ?? "Untitled");
  const url = `${mount}/products/${handle}`;
  const gallery = imagesOf(rows);
  const images = gallery.map((src, i) => imageDrop(src, title, i + 1));
  const featured = images[0] ?? null;

  const variants: VariantDrop[] = rows.map((r, i) => {
    const tracked = r.tracked === undefined ? true : Boolean(r.tracked);
    const qty = availableOf(r);
    const vTitle = str(r.variant_title) ?? "Default Title";
    const price = cents(r.price);
    const compare = numOrNull(r.compare_at_price);
    const vImage =
      images.find((im) => (im as any).src === str(r.image_url)) ?? featured;
    return {
      id: String(r.id),
      product_id: String(rows[0].id),
      title: vTitle,
      name: `${title} - ${vTitle}`,
      sku: str(r.sku),
      barcode: str(r.barcode),
      price,
      compare_at_price: compare != null && compare > 0 ? cents(compare) : null,
      // Untracked variants are always sellable, matching the inventory page.
      available: tracked ? qty > 0 : true,
      inventory_quantity: qty,
      inventory_management: tracked ? "shopify" : null,
      inventory_policy: "deny",
      option1: vTitle,
      option2: null,
      option3: null,
      options: [vTitle],
      requires_shipping: true,
      taxable: true,
      weight: 0,
      weight_unit: "kg",
      weight_in_unit: 0,
      featured_image: vImage,
      featured_media: vImage,
      image: vImage,
      incoming: false,
      next_incoming_date: null,
      selling_plan_allocations: [],
      unit_price: null,
      unit_price_measurement: null,
      url: `${url}?variant=${String(r.id)}`,
      position: i + 1,
    };
  });

  const prices = variants.map((v) => v.price).filter((p) => p > 0);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const compares = variants
    .map((v) => v.compare_at_price)
    .filter((p): p is number => p != null && p > 0);
  const firstAvailable = variants.find((v) => v.available) ?? null;
  const hasOnlyDefault =
    variants.length === 1 && variants[0].title === "Default Title";

  const first = rows[0];
  const description = String(rows.find((r) => str(r.description))?.description ?? "");
  const category = str(first.category);

  return {
    id: String(first.id),
    handle,
    title,
    url,
    description,
    content: description,
    published_at: String(first.created_at ?? ""),
    created_at: String(first.created_at ?? ""),
    updated_at: String(first.updated_at ?? ""),
    vendor: str(first.vendor) ?? "",
    type: str(first.product_type) ?? category ?? "",
    tags: tagsOf(rows),
    available: variants.some((v) => v.available),
    price: priceMin,
    price_min: priceMin,
    price_max: priceMax,
    price_varies: priceMin !== priceMax,
    compare_at_price: compares.length ? Math.min(...compares) : null,
    compare_at_price_min: compares.length ? Math.min(...compares) : 0,
    compare_at_price_max: compares.length ? Math.max(...compares) : 0,
    compare_at_price_varies:
      compares.length > 1 && Math.min(...compares) !== Math.max(...compares),
    featured_image: featured,
    featured_media: featured,
    images,
    media: images,
    variants,
    first_available_variant: firstAvailable,
    selected_variant: null,
    selected_or_first_available_variant: firstAvailable ?? variants[0] ?? null,
    has_only_default_variant: hasOnlyDefault,
    options: hasOnlyDefault ? ["Title"] : ["Option"],
    options_with_values: [
      {
        name: hasOnlyDefault ? "Title" : "Option",
        position: 1,
        values: variants.map((v) => v.title),
        selected_value: (firstAvailable ?? variants[0])?.title ?? "",
      },
    ],
    requires_selling_plan: false,
    selling_plan_groups: [],
    collections: [] as unknown[],
    metafields: {},
    template_suffix: "",
    gift_card: false,
    // Shopify search templates gate on this; without it search.results render blank.
    object_type: "product",
    // convenience mirrors used by some themes
    category,
    quantity_available: variants.reduce((s, v) => s + v.inventory_quantity, 0),
  };
}

function buildCollection(
  handle: string,
  title: string,
  products: ProductDrop[],
  mount: string,
): CollectionDrop {
  const featured = (products.find((p) => p.featured_image)?.featured_image ??
    null) as ImageDrop | null;
  return {
    id: `col-${handle}`,
    handle,
    title,
    url: `${mount}/collections/${handle}`,
    description: "",
    products,
    products_count: products.length,
    all_products_count: products.length,
    featured_image: featured,
    image: featured,
    all_tags: [...new Set(products.flatMap((p) => p.tags))],
    tags: [],
    all_types: [...new Set(products.map((p) => String(p.type)).filter(Boolean))],
    all_vendors: [...new Set(products.map((p) => String(p.vendor)).filter(Boolean))],
    current_type: null,
    current_vendor: null,
    default_sort_by: "manual",
    sort_by: null,
    sort_options: [
      { value: "manual", name: "Featured" },
      { value: "price-ascending", name: "Price, low to high" },
      { value: "price-descending", name: "Price, high to low" },
      { value: "title-ascending", name: "Alphabetically, A-Z" },
    ],
    filters: [],
    template_suffix: "",
    published_at: "",
    metafields: {},
  };
}

// ---- Shop settings ----------------------------------------------------------
async function loadShop(): Promise<ShopInfo> {
  const fallback: ShopInfo = {
    name: "Store",
    currency: "EGP",
    email: "",
    phone: "",
    description: "",
    address: {},
  };
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const s = (data?.data ?? {}) as Record<string, unknown>;
    return {
      name: str(s.store_name) ?? fallback.name,
      currency: str(s.currency) ?? fallback.currency,
      email: str(s.store_email) ?? "",
      phone: str(s.store_phone) ?? "",
      description: str(s.store_description) ?? "",
      address: {
        address1: str(s.address1) ?? "",
        city: str(s.city) ?? "",
        province: str(s.governorate) ?? "",
        zip: str(s.zip) ?? "",
        country: str(s.country) ?? "Egypt",
        summary: [str(s.address1), str(s.city), str(s.governorate)]
          .filter(Boolean)
          .join(", "),
      },
    };
  } catch {
    return fallback;
  }
}

// ---- Catalog assembly + cache ----------------------------------------------
// Catalog assembly over thousands of products is expensive; cache it longer so
// most navigations hit a warm catalog instead of rebuilding. Stock/price display
// can lag up to this long, but checkout re-validates stock live.
const CACHE_MS = 120_000;
// Keyed by mount: the storefront and the theme preview bake different URLs
// into their drops, so they can't share one entry.
const cache = new Map<string, { at: number; value: Catalog }>();

/** Drop the cached catalog — call after inventory edits if you want instant reflection. */
export function invalidateCatalog(): void {
  cache.clear();
}

/** A collection defined in the dashboard (see 0010_collections.sql). */
export type CollectionDef = {
  handle: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ruleType: "manual" | "category" | "vendor" | "tag";
  ruleValue: string | null;
  /** Product names, in the order the merchant arranged them (manual only). */
  productNames: string[];
};

/** Resolve which products belong to a dashboard-defined collection. */
function membersOf(def: CollectionDef, products: ProductDrop[]): ProductDrop[] {
  if (def.ruleType === "manual") {
    const byName = new Map(products.map((p) => [String(p.title).trim().toLowerCase(), p]));
    return def.productNames
      .map((n) => byName.get(n.trim().toLowerCase()))
      .filter((p): p is ProductDrop => Boolean(p));
  }
  // Same matcher the admin uses, so the preview count always equals what the
  // storefront renders.
  return products.filter((p) =>
    matchesRule(
      {
        category: (p.category as string | null) ?? null,
        vendor: (p.vendor as string | null) ?? null,
        tags: p.tags ?? [],
      },
      def.ruleType,
      def.ruleValue,
    ),
  );
}

/**
 * Pure mapping: inventory rows → the drops a theme consumes.
 * Kept separate from the database call so it can be exercised directly.
 *
 * `defs` are the merchant's own collections. When none exist the storefront
 * falls back to grouping by `category`, which is how it behaved before the
 * Collections page existed — so a store never loses its navigation.
 */
export function buildCatalog(
  rows: Row[],
  shop: ShopInfo,
  mount: string,
  defs: CollectionDef[] = [],
  menus: MenuDef[] = [],
): Catalog {
  // Only sellable rows reach the theme: active status and a real price.
  const sellable: Row[] = [];
  let hidden = 0;
  for (const r of rows) {
    const status = String(r.status ?? "active");
    const price = numOrNull(r.price);
    if (status !== "active" || price == null || price <= 0) hidden++;
    else sellable.push(r);
  }

  // Group variants by product name.
  const groups = new Map<string, Row[]>();
  for (const r of sellable) {
    const k = (str(r.product_name) ?? String(r.id)).toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const usedHandles = new Set<string>();
  const products: ProductDrop[] = [];
  for (const group of groups.values()) {
    let handle = handleize(group[0].product_name);
    if (usedHandles.has(handle)) {
      let i = 2;
      while (usedHandles.has(`${handle}-${i}`)) i++;
      handle = `${handle}-${i}`;
    }
    usedHandles.add(handle);
    products.push(buildProduct(group, handle, mount));
  }

  // Merchant-defined collections win; categories are the automatic fallback.
  let defined: CollectionDrop[];
  if (defs.length) {
    defined = defs
      .filter((d) => d.handle && d.handle !== "all")
      .map((d) => {
        const c = buildCollection(d.handle, d.title, membersOf(d, products), mount);
        c.description = d.description ?? "";
        if (d.imageUrl) {
          const img = imageDrop(d.imageUrl, d.title, 1);
          c.featured_image = img;
          c.image = img;
        }
        return c;
      });
  } else {
    const byCategory = new Map<string, { title: string; products: ProductDrop[] }>();
    for (const p of products) {
      const title = (p.category as string | null) ?? null;
      if (!title) continue;
      const h = handleize(title);
      if (!byCategory.has(h)) byCategory.set(h, { title, products: [] });
      byCategory.get(h)!.products.push(p);
    }
    defined = [...byCategory.entries()]
      .sort((a, b) => a[1].title.localeCompare(b[1].title))
      .map(([h, v]) => buildCollection(h, v.title, v.products, mount));
  }

  const collections: CollectionDrop[] = [
    buildCollection("all", "All products", products, mount),
    ...defined,
  ];

  // Back-link each product to the collections it appears in.
  for (const c of collections) {
    if (c.handle === "all") continue;
    for (const p of c.products) {
      (p.collections as unknown[]).push({
        id: c.id,
        handle: c.handle,
        title: c.title,
        url: c.url,
      });
    }
  }

  const productByHandle = new Map(products.map((p) => [p.handle, p]));
  const collectionByHandle = new Map(collections.map((c) => [c.handle, c]));
  const variantById = new Map<string, { variant: VariantDrop; product: ProductDrop }>();
  for (const p of products)
    for (const v of p.variants) variantById.set(v.id, { variant: v, product: p });

  return {
    shop,
    products,
    collections,
    menus,
    productByHandle,
    collectionByHandle,
    variantById,
    hiddenCount: hidden,
  };
}

/**
 * Read the merchant's published collections. Returns [] when the Collections
 * migration has not been applied yet, so the storefront keeps working.
 */
async function loadCollectionDefs(): Promise<CollectionDef[]> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_products(product_name, position)")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map((r) => ({
      handle: String(r.handle ?? ""),
      title: String(r.title ?? ""),
      description: str(r.description),
      imageUrl: str(r.image_url),
      ruleType: (String(r.rule_type ?? "manual") as CollectionDef["ruleType"]),
      ruleValue: str(r.rule_value),
      productNames: (Array.isArray(r.collection_products)
        ? (r.collection_products as Row[])
        : []
      )
        .slice()
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map((m) => String(m.product_name ?? ""))
        .filter(Boolean),
    }));
  } catch {
    return [];
  }
}

/**
 * Read the merchant's navigation menus. Returns [] when the navigation
 * migration has not been applied, so the theme falls back to a menu built
 * from collections rather than losing its navigation entirely.
 */
async function loadMenus(): Promise<MenuDef[]> {
  try {
    const supabase = getServerSupabase();
    const [{ data: menus, error }, { data: items, error: itemsErr }] = await Promise.all([
      supabase.from("navigation_menus").select("id, handle, title").order("created_at"),
      supabase
        .from("navigation_items")
        .select("id, menu_id, parent_id, title, url, position"),
    ]);
    if (error || itemsErr || !menus) return [];

    const rowsByMenu = new Map<string, Row[]>();
    for (const r of (items ?? []) as Row[]) {
      const k = String(r.menu_id);
      if (!rowsByMenu.has(k)) rowsByMenu.set(k, []);
      rowsByMenu.get(k)!.push(r);
    }

    const toTree = (rows: Row[], parent: string | null): MenuItemDef[] =>
      rows
        .filter((r) => (r.parent_id ? String(r.parent_id) : null) === parent)
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map((r) => ({
          title: String(r.title ?? ""),
          url: String(r.url ?? ""),
          children: toTree(rows, String(r.id)),
        }));

    return (menus as Row[])
      .map((m) => ({
        handle: String(m.handle ?? ""),
        title: String(m.title ?? ""),
        items: toTree(rowsByMenu.get(String(m.id)) ?? [], null),
      }))
      .filter((m) => m.handle && m.items.length > 0);
  } catch {
    return [];
  }
}

export const EMPTY_SHOP: ShopInfo = {
  name: "Store",
  currency: "EGP",
  email: "",
  phone: "",
  description: "",
  address: {},
};

/**
 * Load every sellable product, grouped into Shopify-shaped drops.
 * `mount` is the storefront URL prefix (e.g. "/shop", or the theme preview
 * path) and is baked into every product/collection URL.
 */
export async function getCatalog(mount = ""): Promise<Catalog> {
  const hit = cache.get(mount);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  if (!isSupabaseConfigured()) return buildCatalog([], EMPTY_SHOP, mount);
  const shop = await loadShop();

  let rows: Row[] = [];
  try {
    const supabase = getServerSupabase();
    // PostgREST returns at most 1000 rows per request — page through so the
    // whole catalog reaches the storefront, not just the oldest 1000 variants.
    const PAGE = 1000;

    // Ask for named columns rather than "*": `description` alone is ~40% of the
    // payload and is only ever needed on a single product's page, where it is
    // fetched on demand (loadProductDescriptions below).
    // `description` and `images` are ~60% of the payload between them and are
    // only read on a product's own page, where loadProductDetail fetches them.
    // Listings need the primary image_url, which stays.
    const COLUMNS =
      "id,product_name,variant_title,sku,barcode,category,vendor,product_type," +
      "tags,price,compare_at_price,status,tracked,image_url,created_at," +
      "updated_at,inventory_levels(on_hand,committed,incoming)";

    const { count } = await supabase
      .from("inventory_items")
      .select("id", { count: "exact", head: true });

    // Pages are independent, so fetch them together instead of walking the
    // catalog one blocking round trip at a time.
    const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        supabase
          .from("inventory_items")
          .select(COLUMNS)
          .order("created_at", { ascending: true })
          .range(i * PAGE, i * PAGE + PAGE - 1),
      ),
    );
    const all: Row[] = [];
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      all.push(...((data ?? []) as unknown as Row[]));
    }
    rows = all;
  } catch {
    // The storefront must still render (empty) if the catalog query fails.
    return buildCatalog([], shop, mount);
  }

  const [collectionDefs, menus] = await Promise.all([loadCollectionDefs(), loadMenus()]);
  const value = buildCatalog(rows, shop, mount, collectionDefs, menus);
  cache.set(mount, { at: Date.now(), value });
  return value;
}

/**
 * Fetch the parts of a product that are too heavy to keep in the catalog.
 *
 * `description` and the `images` gallery are together ~60% of the catalog
 * payload but are only ever read on a single product's own page. Listings need
 * nothing more than the primary `image_url`, which the catalog does carry, so
 * both are fetched here for the one product about to be rendered.
 */
export async function loadProductDetail(
  product: ProductDrop,
): Promise<{ description: string; images: ImageDrop[] }> {
  const empty = { description: "", images: [] as ImageDrop[] };
  if (!isSupabaseConfigured()) return empty;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("inventory_items")
      .select("description,images,image_url")
      .eq("product_name", String(product.title));
    const rows = (data ?? []) as Row[];
    if (!rows.length) return empty;

    const description = String(rows.find((r) => str(r.description))?.description ?? "");
    const gallery = imagesOf(rows);
    const title = String(product.title);
    return {
      description,
      images: gallery.map((src, i) => imageDrop(src, title, i + 1)),
    };
  } catch {
    return empty;
  }
}

/** Simple relevance search used by the theme's /search route. */
export function searchProducts(catalog: Catalog, terms: string): ProductDrop[] {
  const q = terms.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return catalog.products.filter((p) => {
    const hay = [
      p.title,
      p.vendor,
      p.type,
      p.description,
      (p.tags ?? []).join(" "),
      p.variants.map((v) => `${v.title} ${v.sku ?? ""}`).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
