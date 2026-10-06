import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { appCatalog } from "@/lib/api/catalog";

/**
 * How many of each product have actually been bought.
 *
 * The one number on a card that a shop cannot fake and a shopper cannot get
 * anywhere else. It is counted off the order lines, not estimated: every line
 * belonging to an order that was not cancelled, summed by the product the line
 * points at. A line names a variant, so the variant is mapped back to its
 * product first; older lines that lost their variant are matched on the
 * product name they were written with, which is the only other thing they
 * carry.
 *
 * Cancelled and voided orders do not count. Something returned to the shelf
 * was not sold, and a card that says otherwise is the kind of number that
 * teaches a shopper to stop believing the rest of the card.
 */

/** Newest orders to look through. Far more than this shop has, with room. */
const ORDER_LIMIT = 5000;

/** How long a count stands before it is counted again. */
const FRESH_FOR = 5 * 60 * 1000;

let cache: { at: number; counts: Record<string, number> } | null = null;
let inFlight: Promise<Record<string, number>> | null = null;

async function count(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = getServerSupabase();

  const { data: orders } = await supabase
    .from("store_orders")
    .select("id,lifecycle")
    .order("created_at", { ascending: false })
    .limit(ORDER_LIMIT);

  // A cancelled order is not a sale.
  const kept = (orders ?? []).filter((o) => !/cancel|void/i.test(String(o.lifecycle ?? "")));
  if (!kept.length) return {};

  const [catalog, { data: lines }] = await Promise.all([
    appCatalog(),
    supabase
      .from("store_order_items")
      .select("order_id,item_id,product_name,quantity")
      .in(
        "order_id",
        kept.map((o) => String(o.id)),
      ),
  ]);

  // Both ways a line can name what was bought.
  const byVariant = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of catalog.products) {
    const id = String(p.id);
    byName.set(String(p.name ?? "").trim().toLowerCase(), id);
    for (const v of p.variants ?? []) byVariant.set(String(v.id), id);
  }

  const counts: Record<string, number> = {};
  for (const line of lines ?? []) {
    const product =
      byVariant.get(String(line.item_id ?? "")) ??
      byName.get(String(line.product_name ?? "").trim().toLowerCase());
    if (!product) continue;
    const n = Number(line.quantity ?? 0);
    if (!Number.isFinite(n) || n <= 0) continue;
    counts[product] = (counts[product] ?? 0) + Math.trunc(n);
  }
  return counts;
}

/**
 * The counts, fresh enough. One count in flight at a time, so a burst of
 * requests does not become a burst of the same query.
 */
export async function soldByProduct(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < FRESH_FOR) return cache.counts;
  if (inFlight) return inFlight;
  inFlight = count()
    .then((counts) => {
      cache = { at: Date.now(), counts };
      return counts;
    })
    .catch(() => cache?.counts ?? {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Write the counts onto cards already built. */
export function attachSold<T extends { id: string; sold: number }>(
  cards: T[],
  counts: Record<string, number>,
): T[] {
  for (const c of cards) c.sold = counts[c.id] ?? 0;
  return cards;
}
