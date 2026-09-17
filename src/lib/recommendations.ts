import "server-only";

import { appCatalog, SYNTHETIC, toCard, type AppProductCard } from "@/lib/api/catalog";
import { getAppTheme } from "@/lib/app-theme-service";
import { itemsOf, type Block } from "@/lib/app-theme";
import { phoneVariants } from "@/lib/phone";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * "Complete your look" - what goes with what a shopper already bought.
 *
 * Showing someone the bag they bought last week is showing them a bag they
 * will not buy twice. So their orders are read, each piece is traced to the
 * collections it sits in, and the merchant's pairing rules in the theme
 * ("bought from Hand bags - suggest Heels, Sunglasses, Wallets") say where to
 * look instead. Nothing they already own comes back, nor anything from the
 * collection it matched on, nor anything out of stock.
 *
 * A shopper whose purchases match no rule still has a history, so they get the
 * shop's own order minus what they bought and the collections they bought
 * from - labelled as a general recommendation rather than as a match.
 *
 * A guest, or a shopper with no orders, gets nothing at all, and every surface
 * hides the section rather than drawing an empty row.
 */

export type Recommendations = {
  /** "pairs" when a rule matched their purchases, "fallback" otherwise, "none" for nothing to show. */
  mode: "pairs" | "fallback" | "none";
  /** The most recent purchase the suggestions were built from. */
  basedOn: string | null;
  products: AppProductCard[];
};

const NONE: Recommendations = { mode: "none", basedOn: null, products: [] };

/** How many orders back to look. Old enough purchases say little about now. */
const ORDER_LOOKBACK = 20;
const MAX_LIMIT = 16;

const handleOf = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** The theme's rules: bought from one collection, suggest from up to three. */
function rulesOf(block: Block | undefined) {
  const rules = new Map<string, string[]>();
  if (!block) return rules;
  for (const item of itemsOf(block)) {
    const from = handleOf(item.from);
    if (!from) continue;
    const to = [item.to1, item.to2, item.to3].map(handleOf).filter((h) => h && h !== from);
    rules.set(from, [...new Set([...(rules.get(from) ?? []), ...to])]);
  }
  return rules;
}

export async function recommendationsFor(phone: string | null): Promise<Recommendations> {
  if (!phone || !isSupabaseConfigured()) return NONE;

  try {
    const supabase = getServerSupabase();
    const { data: orders } = await supabase
      .from("store_orders")
      .select("id,lifecycle,created_at")
      .in("phone", phoneVariants(phone))
      .order("created_at", { ascending: false })
      .limit(ORDER_LOOKBACK);
    // A cancelled order is not something they own.
    const kept = (orders ?? []).filter((o) => !/cancel|void/i.test(String(o.lifecycle ?? "")));
    if (!kept.length) return NONE;

    const [theme, catalog, { data: lines }] = await Promise.all([
      getAppTheme(),
      appCatalog(),
      supabase
        .from("store_order_items")
        .select("order_id,item_id,product_name")
        .in(
          "order_id",
          kept.map((o) => String(o.id)),
        ),
    ]);

    const block = (theme.blocks as Block[]).find((b) => b.type === "complete_look");
    const s = block?.settings ?? {};
    const limitRaw = Number(s.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.trunc(limitRaw), MAX_LIMIT) : 8;
    const rules = rulesOf(block);

    // Which collections each product sits in. "all" is every product, so it
    // says nothing about what kind of thing a product is.
    const collectionsOf = new Map<string, string[]>();
    for (const c of catalog.collections) {
      const handle = handleOf(c.handle);
      if (handle === SYNTHETIC) continue;
      for (const p of c.products ?? []) {
        const id = String(p.id);
        const list = collectionsOf.get(id) ?? [];
        list.push(handle);
        collectionsOf.set(id, list);
      }
    }
    const productById = new Map(catalog.products.map((p) => [String(p.id), p]));

    // Their purchases, newest order first. A line can name the product or one
    // of its variants.
    const orderRank = new Map(kept.map((o, i) => [String(o.id), i]));
    const bought: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const line of [...(lines ?? [])].sort(
      (a, b) => (orderRank.get(String(a.order_id)) ?? 0) - (orderRank.get(String(b.order_id)) ?? 0),
    )) {
      const ref = String(line.item_id ?? "");
      const product = productById.get(ref) ?? catalog.variantById.get(ref)?.product;
      if (!product) continue;
      const id = String(product.id);
      if (seen.has(id)) continue;
      seen.add(id);
      bought.push({ id, name: String(line.product_name || product.title || "") });
    }
    if (!bought.length) return NONE;

    // A collection holding most of the shop ("For women", a big sale) says
    // nothing about what kind of thing a piece is, so it cannot rule
    // anything out.
    const broad = new Set(
      catalog.collections
        .filter((c) => (c.products?.length ?? 0) > catalog.products.length * 0.5)
        .map((c) => handleOf(c.handle)),
    );
    const ownedCollections = new Set(
      bought.flatMap((b) => collectionsOf.get(b.id) ?? []).filter((h) => !broad.has(h)),
    );

    // Walk purchases newest first, gathering the collections their rules
    // point at, and the collections that matched so they are not suggested.
    const targets: string[] = [];
    const matched = new Set<string>();
    let basedOn: string | null = null;
    for (const b of bought) {
      for (const handle of collectionsOf.get(b.id) ?? []) {
        const to = rules.get(handle);
        if (!to?.length) continue;
        matched.add(handle);
        basedOn ??= b.name;
        for (const t of to) if (!targets.includes(t)) targets.push(t);
      }
    }

    const ok = (p: { id: unknown; quantity_available?: unknown }) =>
      !seen.has(String(p.id)) && Number(p.quantity_available ?? 0) > 0;

    const picked: AppProductCard[] = [];
    const taken = new Set<string>();
    const take = (p: Parameters<typeof toCard>[0]) => {
      const id = String(p.id);
      if (taken.has(id)) return;
      taken.add(id);
      picked.push(toCard(p));
    };

    if (targets.length) {
      // One from each target collection in turn, so "heels, sunglasses,
      // wallets" reads as a look rather than eight pairs of heels.
      const queues = targets.map((handle) =>
        (catalog.collectionByHandle.get(handle)?.products ?? []).filter(
          (p) => ok(p) && !(collectionsOf.get(String(p.id)) ?? []).some((h) => matched.has(h)),
        ),
      );
      for (let round = 0; picked.length < limit && queues.some((q) => q.length); round++) {
        for (const q of queues) {
          const next = q.shift();
          if (next) take(next);
          if (picked.length >= limit) break;
        }
      }
    }
    if (picked.length) return { mode: "pairs", basedOn, products: picked };

    // No rule fits: the shop's own order, minus what they own and the kinds of
    // thing they already bought.
    for (const p of catalog.products) {
      if (picked.length >= limit) break;
      if (!ok(p)) continue;
      if ((collectionsOf.get(String(p.id)) ?? []).some((h) => ownedCollections.has(h))) continue;
      take(p);
    }
    return picked.length
      ? { mode: "fallback", basedOn: bought[0]?.name ?? null, products: picked }
      : NONE;
  } catch {
    // A recommendation is a nicety; a read failing must never break the home.
    return NONE;
  }
}
