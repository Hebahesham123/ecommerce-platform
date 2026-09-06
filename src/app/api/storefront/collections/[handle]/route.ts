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

    const products = [...found.products];
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
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
