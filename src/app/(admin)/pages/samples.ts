import { getCatalog } from "@/lib/storefront-data";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Samples } from "@/lib/pages-catalog";

/**
 * The previews point at real things or they teach nothing: a collection page
 * with no collection is a screenshot of an error. So one of each is picked out
 * of this store before any frame is built.
 */
export async function samples(): Promise<Samples> {
  const catalog = await getCatalog().catch(() => null);
  // The busiest collection makes the better preview — an empty one shows an
  // empty page and says nothing about the design.
  const collection = [...(catalog?.collections ?? [])].sort(
    (a, b) => b.products_count - a.products_count,
  )[0];
  const product = collection?.products[0] ?? catalog?.products[0];

  const one = async (table: string, column: string, filter?: [string, string]) => {
    if (!isSupabaseConfigured()) return "";
    try {
      let q = getServerSupabase().from(table).select(column).limit(1);
      if (filter) q = q.eq(filter[0], filter[1]);
      const { data } = await q.maybeSingle();
      return String((data as Record<string, unknown> | null)?.[column] ?? "");
    } catch {
      // A table that isn't there yet just leaves the entry saying so.
      return "";
    }
  };

  const [order, theme] = await Promise.all([
    one("store_orders", "order_number"),
    one("themes", "id", ["status", "published"]),
  ]);

  return {
    collection: collection?.handle ?? "",
    product: product?.handle ?? "",
    productId: product?.id ?? "",
    order,
    theme,
  };
}
