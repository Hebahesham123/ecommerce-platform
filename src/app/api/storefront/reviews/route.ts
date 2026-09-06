import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { bodyOf, channelOf, fail, int, ok, str, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What customers said, and how they say it.
 *
 * The website has had a Reviews page and a Happy Customers page since the
 * review form was moved into this project; the app could see neither, which is
 * why both showed up in its menu as "external" links that went nowhere.
 *
 * Only `published` reviews are ever returned. `featured=1` narrows that to the
 * ones picked for Happy Customers — publishing says a review may be shown at
 * all, featuring says it earns a place on that page, and the app honours the
 * same distinction the website does.
 */

type Row = Record<string, unknown>;
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return fail("not_configured", 503);

  const url = new URL(request.url);
  const featured = url.searchParams.get("featured") === "1";
  const limit = Math.min(Math.max(int(url.searchParams.get("limit"), 30), 1), 100);

  try {
    let query = getServerSupabase()
      .from("store_reviews")
      .select("id,reviewer_name,product_rating,shipping_rating,support_rating,comment,featured,created_at")
      .eq("status", "published");
    if (featured) query = query.eq("featured", true);

    const { data, error } = await query
      // Featured first, then newest — the merchant's pick leads, and everything
      // else falls back to recency rather than to insertion order.
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const missing = (error.message || "").includes("store_reviews");
      return fail(missing ? "migration_missing" : error.message, 503);
    }

    const reviews = (data ?? []).map((r: Row) => ({
      id: String(r.id),
      name: String(r.reviewer_name ?? "Anonymous"),
      productRating: numOrNull(r.product_rating),
      shippingRating: numOrNull(r.shipping_rating),
      supportRating: numOrNull(r.support_rating),
      comment: (r.comment as string) ?? null,
      featured: Boolean(r.featured),
      createdAt: String(r.created_at ?? ""),
    }));

    const rated = reviews
      .map((r) => r.productRating)
      .filter((n): n is number => typeof n === "number");

    return ok({
      reviews,
      count: reviews.length,
      averageProductRating: rated.length
        ? Math.round((rated.reduce((s, n) => s + n, 0) / rated.length) * 10) / 10
        : null,
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}

const rating = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
};

/**
 * Leave a review from the app.
 *
 * Lands `pending` like every other review, because moderation is the whole
 * reason the storefront form was brought into this project. A signed-in
 * shopper is attributed from their token; the form stays open to everyone
 * else, so that is a bonus rather than a requirement.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return fail("not_configured", 503);

  const body = await bodyOf(request);
  const productRating = rating(body.productRating);
  const shippingRating = rating(body.shippingRating);
  const supportRating = rating(body.supportRating);
  const comment = str(body.comment, 2000);

  // A review with neither a rating nor a comment says nothing.
  if (productRating == null && shippingRating == null && supportRating == null && !comment) {
    return fail("empty_review");
  }

  const level = str(body.experienceLevel, 20);
  try {
    const { error } = await getServerSupabase().from("store_reviews").insert({
      reviewer_name: str(body.name, 80) || "Anonymous",
      product_rating: productRating,
      shipping_rating: shippingRating,
      support_rating: supportRating,
      experience_level: ["Easy", "Medium", "Hard"].includes(level) ? level : null,
      comment: comment || null,
      phone: viewerOf(request),
      order_number: str(body.orderNumber, 40) || null,
      source: "storefront",
      channel: channelOf(request),
    });
    if (error) {
      const missing = (error.message || "").includes("store_reviews");
      return fail(missing ? "migration_missing" : error.message, missing ? 503 : 500);
    }
    return ok({ pending: true });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
