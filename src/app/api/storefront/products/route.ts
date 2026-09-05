import { listStoreProducts, type StoreProduct } from "@/app/store/actions";
import { fromResult, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The catalogue.
 *
 * Same source as the website's product grid, so an item that is sold out or
 * unpriced is missing from both. Search and category filtering happen here
 * rather than in the app, so a phone with a stale build cannot show a category
 * the merchant has since renamed.
 */
export async function GET(request: Request) {
  const res = await listStoreProducts();
  if (!res.ok) return fromResult(res);

  const url = new URL(request.url);
  const q = str(url.searchParams.get("q"), 80).toLowerCase();
  const category = str(url.searchParams.get("category"), 80).toLowerCase();
  const inStock = url.searchParams.get("inStock") === "1";

  let products: StoreProduct[] = res.data;
  if (category) {
    products = products.filter((p) => (p.category ?? "").toLowerCase() === category);
  }
  if (q) {
    products = products.filter((p) =>
      `${p.name} ${p.vendor ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q),
    );
  }
  if (inStock) products = products.filter((p) => p.available > 0);

  return ok({ products, count: products.length });
}
