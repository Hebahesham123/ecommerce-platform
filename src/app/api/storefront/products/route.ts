import { appCatalog, toCard, type AppProductCard } from "@/lib/api/catalog";
import { fail, int, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The catalogue, as the website sees it.
 *
 * Reading the storefront's own resolver rather than the raw table closes a gap
 * that used to bite at the till: this listed anything with a price, while
 * pricing a cart rejected anything not `active`, so an archived product could
 * be browsed, added, and then refused at checkout with nothing to explain it.
 * Both now agree on what is for sale.
 *
 * Rows come back as cards — enough for a grid. The full record, with variants
 * and stock, is at /products/{id}, which is where a shopper needs it.
 *
 * `collection` filters by a real collection handle. `category` still works
 * because it did before, but it is the older, weaker idea of the two.
 */
export async function GET(request: Request) {
  try {
    const catalog = await appCatalog();
    const url = new URL(request.url);
    const q = str(url.searchParams.get("q"), 80).toLowerCase();
    const collection = str(url.searchParams.get("collection"), 120).toLowerCase();
    const category = str(url.searchParams.get("category"), 120).toLowerCase();
    const inStock = url.searchParams.get("inStock") === "1";
    const limit = Math.min(Math.max(int(url.searchParams.get("limit"), 60), 1), 200);
    const offset = Math.max(int(url.searchParams.get("offset"), 0), 0);

    const source = collection
      ? (catalog.collectionByHandle.get(collection)?.products ?? null)
      : catalog.products;
    if (!source) return fail("not_found", 404);

    // Filtering happens on the drops, before serialising, so a search over a
    // thousand products doesn't build a thousand objects to throw most away.
    let rows = source;
    if (category) {
      rows = rows.filter((p) => String(p.category ?? "").toLowerCase() === category);
    }
    if (q) {
      rows = rows.filter((p) =>
        `${p.title} ${p.vendor ?? ""} ${p.category ?? ""} ${(p.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (inStock) rows = rows.filter((p) => p.available);

    const products: AppProductCard[] = rows.slice(offset, offset + limit).map(toCard);
    return ok({ products, count: rows.length, offset, limit });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
