import { appCatalog, SYNTHETIC, toCollection } from "@/lib/api/catalog";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The merchant's own collections, in the order they arranged them.
 *
 * This used to synthesise categories out of each product's `category` string,
 * which meant the app showed "Apparel & Accessories > Handbags, Wallets &
 * Cases > Handbags" where the website showed the collection the merchant had
 * actually built and named. Same shop, two different shops to a shopper.
 *
 * Now it reads the same resolver the storefront renders from, so publishing,
 * reordering or renaming a collection reaches both surfaces at once.
 */
export async function GET() {
  try {
    const catalog = await appCatalog();
    const collections = catalog.collections
      .filter((c) => c.handle !== SYNTHETIC)
      .map(toCollection);
    return ok({ collections });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
