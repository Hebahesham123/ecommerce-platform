import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

// Reads whatever is featured right now, so a pick on the dashboard shows here
// immediately rather than after a rebuild.
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/**
 * Happy Customers — the reviews someone picked out on the dashboard.
 *
 * Only featured AND published reviews appear, so nothing reaches this page
 * without a deliberate choice.
 */
async function featuredReviews(): Promise<Row[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("store_reviews")
      .select("id,reviewer_name,product_rating,shipping_rating,support_rating,comment,created_at,featured_order")
      .eq("featured", true)
      .eq("status", "published")
      .order("featured_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(60);
    return data ?? [];
  } catch {
    return [];
  }
}

const num = (v: unknown) => (v == null ? null : Number(v));

function Stars({ value }: { value: number }) {
  return (
    <span className="text-base tracking-[0.12em] text-amber-500" aria-label={`${value} / 5`}>
      {"★".repeat(value)}
      <span className="text-slate-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default async function HappyCustomersPage() {
  const rows = await featuredReviews();

  const cards = rows.map((r) => {
    const ratings = [num(r.product_rating), num(r.shipping_rating), num(r.support_rating)].filter(
      (v): v is number => v != null,
    );
    const overall = ratings.length
      ? Math.round(ratings.reduce((s, v) => s + v, 0) / ratings.length)
      : null;
    return {
      id: String(r.id),
      name: String(r.reviewer_name ?? "Anonymous"),
      comment: (r.comment as string) ?? null,
      overall,
      date: new Date(String(r.created_at)).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      }),
    };
  });

  return (
    <div className="py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Happy customers</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Real words from people who shopped with us.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line p-10 text-center">
          <p className="text-sm text-ink-muted">
            No featured reviews yet — they appear here once we pick them.
          </p>
          <Link
            href="/shop/reviews"
            target="_top"
            className="btn-primary mt-5 inline-flex px-5 py-2.5"
          >
            Leave a review
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm"
              >
                {c.overall != null && <Stars value={c.overall} />}
                {c.comment && (
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">
                    “{c.comment}”
                  </blockquote>
                )}
                <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{c.name}</div>
                    <div className="text-xs text-ink-soft">{c.date}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 text-center">
            <Link
              href="/shop/reviews"
              target="_top"
              className="btn-outline inline-flex px-5 py-2.5"
            >
              Share your experience
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
