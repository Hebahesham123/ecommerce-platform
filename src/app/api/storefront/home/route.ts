import { appCatalog, appMenus, SYNTHETIC, toCard, toCollection } from "@/lib/api/catalog";
import { getAppTheme } from "@/lib/app-theme-service";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/http";
import type { Block } from "@/lib/app-theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The front page, arranged the way the merchant arranged it.
 *
 * The theme decides what is on the home screen; this fetches exactly what
 * those blocks need and nothing else. A store whose home is one banner and one
 * collection does not pay for six rows of products it never shows.
 *
 * Products come back keyed by collection handle rather than nested inside each
 * block, so two blocks pointing at the same collection cost one copy. The app
 * walks `theme.blocks` in order and looks up what it needs.
 *
 * One request rather than five, because a home screen that paints in stages
 * over a phone connection reads as a broken app rather than a fast one.
 */

const PER_ROW_MAX = 12;

/**
 * How many collections "every collection" actually means.
 *
 * This store has 53. Fifty-three rows is not a home screen, it is a sitemap —
 * and fetching twelve products for each of them made the front page a 232KB
 * download over mobile data. The merchant's own order decides which eight win,
 * and the rest are one tap away under the category chips.
 */
const ALL_ROWS_CAP = 8;

const int = (v: unknown, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), max) : fallback;
};

async function featuredReviews(limit: number) {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getServerSupabase()
    .from("store_reviews")
    .select("id,reviewer_name,product_rating,comment,created_at")
    .eq("status", "published")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.reviewer_name ?? "Anonymous"),
    productRating: r.product_rating == null ? null : Number(r.product_rating),
    comment: (r.comment as string) ?? null,
    createdAt: String(r.created_at ?? ""),
  }));
}

export async function GET() {
  try {
    const [theme, catalog] = await Promise.all([getAppTheme(), appCatalog()]);
    const collections = catalog.collections.filter((c) => c.handle !== SYNTHETIC);

    // Which collections any block actually asks for, and how many products
    // each needs. Two blocks on one collection share a single copy, sized to
    // whichever asked for more.
    const wanted = new Map<string, number>();
    const want = (handle: string, limit: number) =>
      wanted.set(handle, Math.max(wanted.get(handle) ?? 0, Math.min(limit, PER_ROW_MAX)));

    let wantsAll = 0;
    let newArrivalsLimit = 0;
    let reviewsLimit = 0;

    for (const block of theme.blocks as Block[]) {
      const s = block.settings ?? {};
      if (block.type === "collection_row" || block.type === "collection_grid") {
        const handle = String(s.handle ?? "").trim().toLowerCase();
        const limit = int(s.limit, block.type === "collection_row" ? 8 : 6, PER_ROW_MAX);
        // An empty handle means "every collection I have", capped — see above.
        if (handle) want(handle, limit);
        else wantsAll = Math.max(wantsAll, limit);
      } else if (block.type === "banner") {
        // A banner needs no products, only somewhere to go.
      } else if (block.type === "new_arrivals") {
        newArrivalsLimit = Math.max(newArrivalsLimit, int(s.limit, 12, 40));
      } else if (block.type === "reviews") {
        reviewsLimit = Math.max(reviewsLimit, int(s.limit, 6, 20));
      }
    }
    if (wantsAll) {
      for (const c of collections.slice(0, ALL_ROWS_CAP)) want(String(c.handle), wantsAll);
    }

    const rows: Record<string, ReturnType<typeof toCard>[]> = {};
    for (const [handle, limit] of wanted) {
      const found = catalog.collectionByHandle.get(handle);
      if (found) rows[handle] = found.products.slice(0, limit).map(toCard);
    }

    const newArrivals = newArrivalsLimit
      ? [...catalog.products]
          .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
          .slice(0, newArrivalsLimit)
          .map(toCard)
      : [];

    return ok({
      theme,
      shop: { name: catalog.shop.name, currency: catalog.shop.currency },
      menus: await appMenus(),
      collections: collections.map(toCollection),
      rows,
      newArrivals,
      reviews: reviewsLimit ? await featuredReviews(reviewsLimit) : [],
      productCount: catalog.products.length,
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
