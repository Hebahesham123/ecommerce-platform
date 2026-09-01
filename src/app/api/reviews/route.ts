import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSessionPhone } from "@/lib/store-session";

export const dynamic = "force-dynamic";

/**
 * Where the review form posts.
 *
 * The form is a static page under /public, so it has no server of its own — it
 * used to carry another project's anon key and write there, which is exactly
 * why the dashboard never saw a single review. Posting here instead keeps the
 * write on the service role (no keys in the page) and lands the review in this
 * project, pending moderation.
 */

const RATING = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
};

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const productRating = RATING(body.product_rating);
  const shippingRating = RATING(body.shipping_rating);
  const supportRating = RATING(body.support_rating);
  const comment = text(body.review_comment ?? body.comment, 2000);

  // A review with neither a rating nor a comment says nothing.
  if (productRating == null && shippingRating == null && supportRating == null && !comment) {
    return NextResponse.json({ ok: false, error: "empty_review" }, { status: 400 });
  }

  const experience = text(body.experience_level, 20);
  const level = ["Easy", "Medium", "Hard"].includes(experience ?? "") ? experience : null;

  try {
    const supabase = getServerSupabase();
    // Signed-in shoppers get attributed automatically; the form stays open to
    // everyone else, so this is a bonus rather than a requirement.
    const phone = await getSessionPhone();

    const { error } = await supabase.from("store_reviews").insert({
      reviewer_name: text(body.reviewer_name, 80) ?? "Anonymous",
      product_rating: productRating,
      shipping_rating: shippingRating,
      support_rating: supportRating,
      experience_level: level,
      comment,
      phone,
      order_number: text(body.order_number, 40),
      source: "storefront",
    });

    if (error) {
      const missing = (error.message || "").includes("store_reviews");
      return NextResponse.json(
        { ok: false, error: missing ? "migration_missing" : error.message },
        { status: missing ? 503 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
