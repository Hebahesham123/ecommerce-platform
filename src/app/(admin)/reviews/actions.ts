"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ActionResult } from "../../store/actions";
import { normalizeChannel, type Channel } from "@/lib/channel";

export type ReviewStatus = "pending" | "published" | "hidden";

export type StoreReview = {
  id: string;
  reviewerName: string;
  productRating: number | null;
  shippingRating: number | null;
  supportRating: number | null;
  experienceLevel: string | null;
  comment: string | null;
  status: ReviewStatus;
  featured: boolean;
  phone: string | null;
  orderNumber: string | null;
  createdAt: string;
  /** Which surface it was left from. */
  channel: Channel;
};

type Row = Record<string, unknown>;
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

function mapReview(r: Row): StoreReview {
  return {
    id: String(r.id),
    reviewerName: String(r.reviewer_name ?? "Anonymous"),
    productRating: numOrNull(r.product_rating),
    shippingRating: numOrNull(r.shipping_rating),
    supportRating: numOrNull(r.support_rating),
    experienceLevel: (r.experience_level as string) ?? null,
    comment: (r.comment as string) ?? null,
    status: (r.status as ReviewStatus) ?? "pending",
    featured: Boolean(r.featured),
    phone: (r.phone as string) ?? null,
    orderNumber: (r.order_number as string) ?? null,
    createdAt: String(r.created_at),
    channel: normalizeChannel(r.channel),
  };
}

export async function listReviews(): Promise<ActionResult<StoreReview[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      if ((error.message || "").includes("store_reviews")) {
        return { ok: false, error: "migration_missing" };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data: (data ?? []).map(mapReview) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Publish, hide, or send a review back to pending. */
export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    // A review pulled off the storefront shouldn't keep its place on the Happy
    // Customers page.
    const patch: Row = { status };
    if (status !== "published") patch.featured = false;
    const { error } = await supabase.from("store_reviews").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Pick a review for the Happy Customers page (or take it off).
 *
 * Featuring implies publishing — there is no sensible reading of "show this on
 * the happy page but not on the storefront".
 */
export async function setReviewFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("store_reviews")
      .update(featured ? { featured: true, status: "published" } : { featured: false })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteReview(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("store_reviews").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
