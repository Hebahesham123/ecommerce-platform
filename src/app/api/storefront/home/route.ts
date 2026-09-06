import { appCatalog, appMenus, SYNTHETIC, toCard, toCollection } from "@/lib/api/catalog";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROWS = 6;
const PER_ROW = 8;
const NEW_ARRIVALS = 12;

/**
 * The app's front page, in one request.
 *
 * The website's homepage is a Liquid theme — sections, blocks, CSS — and none
 * of that is data an app can render. What it can use is the judgement the
 * merchant already expressed in Collections: which ones are published, what
 * order they go in, what each is called and what image represents it. So the
 * app's home is that, plus what is new.
 *
 * The upshot is there is no second place to keep up to date. Reordering
 * collections in the dashboard reorders the app's home screen, and a
 * collection that gets unpublished leaves both surfaces at once.
 *
 * One request rather than five, because a home screen that paints in stages
 * over a phone connection reads as a broken app rather than a fast one.
 */
export async function GET() {
  try {
    const catalog = await appCatalog();

    const collections = catalog.collections.filter((c) => c.handle !== SYNTHETIC);

    // A collection with nothing in it is a tile that opens onto an empty
    // screen — the merchant's ordering is respected, but not that far.
    const rows = collections
      .filter((c) => c.products.length > 0)
      .slice(0, ROWS)
      .map((c) => ({
        ...toCollection(c),
        products: c.products.slice(0, PER_ROW).map(toCard),
      }));

    const newArrivals = [...catalog.products]
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .slice(0, NEW_ARRIVALS)
      .map(toCard);

    return ok({
      shop: { name: catalog.shop.name, currency: catalog.shop.currency },
      menus: await appMenus(),
      collections: collections.map(toCollection),
      rows,
      newArrivals,
      productCount: catalog.products.length,
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
