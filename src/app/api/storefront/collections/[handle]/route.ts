import { appCatalog, toCard, toCollection } from "@/lib/api/catalog";
import { fail, int, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = ["manual", "price-ascending", "price-descending", "title-ascending", "newest"] as const;
type Sort = (typeof SORTS)[number];

/**
 * One collection and what is in it.
 *
 * Sorting happens here rather than on the device: a phone holding one page of
 * forty products cannot sort the other four hundred, and letting it try is how
 * "price, low to high" ends up meaning "the cheapest of what you happen to
 * have scrolled past".
 *
 * `all` works as a handle and returns the whole shop, which is what a "shop
 * everything" screen wants.
 */
export async function GET(request: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  if (!handle) return fail("missing_handle");

  try {
    const catalog = await appCatalog();
    const found = catalog.collectionByHandle.get(handle.toLowerCase());
    if (!found) return fail("not_found", 404);

    const url = new URL(request.url);
    const sort = (str(url.searchParams.get("sort"), 24) || "manual") as Sort;
    const limit = Math.min(Math.max(int(url.searchParams.get("limit"), 24), 1), 100);
    const offset = Math.max(int(url.searchParams.get("offset"), 0), 0);

    // Filters, applied before paging for the same reason sorting is: a filter
    // over the page a phone happens to hold is a filter that misses things.
    // Prices arrive in whole pounds; the catalogue holds minor units.
    const brands = new Set(
      (url.searchParams.get("vendor") ?? "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
    const minPrice = Number(url.searchParams.get("minPrice"));
    const maxPrice = Number(url.searchParams.get("maxPrice"));
    const inStock = url.searchParams.get("inStock") === "1";
    const onSale = url.searchParams.get("onSale") === "1";

    // What a filter panel needs to offer: the brands in this collection with
    // how many pieces each has, and the span of its prices. Worked out over the
    // whole collection, so choosing one brand does not hide the others.
    const vendorCounts = new Map<string, number>();
    let lowest = Infinity;
    let highest = 0;
    for (const p of found.products) {
      const vendor = String(p.vendor ?? "").trim();
      if (vendor) vendorCounts.set(vendor, (vendorCounts.get(vendor) ?? 0) + 1);
      const price = Number(p.price_min ?? 0) / 100;
      if (price > 0) {
        lowest = Math.min(lowest, price);
        highest = Math.max(highest, price);
      }
    }
    const facets = {
      vendors: [...vendorCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
      priceMin: Number.isFinite(lowest) ? Math.floor(lowest) : 0,
      priceMax: Math.ceil(highest),
    };

    const products = found.products.filter((p) => {
      if (brands.size && !brands.has(String(p.vendor ?? "").trim().toLowerCase())) return false;
      const price = Number(p.price_min ?? 0) / 100;
      if (minPrice > 0 && price < minPrice) return false;
      if (maxPrice > 0 && price > maxPrice) return false;
      if (inStock && Number(p.quantity_available ?? 0) <= 0) return false;
      if (onSale && !(Number(p.compare_at_price ?? 0) > Number(p.price_min ?? 0))) return false;
      return true;
    });
    if (sort === "price-ascending") products.sort((a, b) => a.price_min - b.price_min);
    else if (sort === "price-descending") products.sort((a, b) => b.price_min - a.price_min);
    else if (sort === "title-ascending")
      products.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    else if (sort === "newest")
      products.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    // "manual" is the order the merchant put them in, so it is left alone.

    return ok({
      collection: toCollection(found),
      products: products.slice(offset, offset + limit).map(toCard),
      total: products.length,
      offset,
      limit,
      sort,
      facets,
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
