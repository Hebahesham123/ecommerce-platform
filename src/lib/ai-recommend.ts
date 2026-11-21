import "server-only";
import { getCatalog, type Catalog, type ProductDrop } from "@/lib/storefront-data";
import { aiComplete, aiEnabled } from "@/lib/ai";

/**
 * AI related-products — AUGMENTS, never replaces, the existing rule-based
 * recommendations. The model picks which catalog products best pair with a
 * given product (by title/tags); when AI is off, slow, or returns nothing
 * usable, callers fall back to their existing picks (the storefront handler's
 * random-buyable pool / the app's rule-based "complete your look").
 *
 * The model's chosen handle list is cached per product (longer TTL, ~10min),
 * and applied to an already-built catalog so URLs stay correct for any mount.
 */

type Candidate = { handle: string; title: string; tags: string[] };

const REC_TTL_MS = 10 * 60_000;
const MAX_CANDIDATES = 60;
// Recommendations are not latency-critical, but still bounded so a slow model
// call never holds up a product page's "you may also like" response.
const REC_TIMEOUT_MS = 4_000;

const recCache = new Map<string, { at: number; order: string[] }>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** A buyable product worth recommending: available and with an image. */
function recommendable(p: ProductDrop): boolean {
  return Boolean(p.featured_image) && p.available !== false;
}

async function aiHandleOrder(target: ProductDrop, pool: ProductDrop[]): Promise<string[] | null> {
  const list: Candidate[] = pool.slice(0, MAX_CANDIDATES).map((p) => ({
    handle: String(p.handle),
    title: String(p.title ?? ""),
    tags: (p.tags ?? []).slice(0, 8).map(String),
  }));
  if (!list.length) return null;
  const current = {
    title: String(target.title ?? ""),
    tags: (target.tags ?? []).slice(0, 10).map(String),
  };
  const prompt =
    `A shopper is viewing this product in an online store:\n${JSON.stringify(current)}\n\n` +
    `Here are other products in the store (JSON):\n${JSON.stringify(list)}\n\n` +
    `Pick the products that best complement or relate to the viewed one (think ` +
    `"customers also bought" / "complete the look"), best first. Reply as JSON ` +
    `exactly like {"handles":["handle-a","handle-b"]} using only handles from the list.`;
  const out = await aiComplete({
    system: "You are a product recommendation engine for an online store.",
    prompt,
    json: true,
    fast: true,
    maxTokens: 500,
  });
  if (!out) return null;
  try {
    const parsed = JSON.parse(out) as { handles?: unknown };
    if (!Array.isArray(parsed.handles)) return null;
    const order = parsed.handles.map((h) => String(h));
    return order.length ? order : null;
  } catch {
    return null;
  }
}

async function cachedOrderFor(target: ProductDrop, pool: ProductDrop[]): Promise<string[] | null> {
  const key = String(target.handle);
  const hit = recCache.get(key);
  if (hit && Date.now() - hit.at < REC_TTL_MS) return hit.order;
  const order = await aiHandleOrder(target, pool);
  if (order) {
    recCache.set(key, { at: Date.now(), order });
    if (recCache.size > 500) {
      const oldest = recCache.keys().next().value;
      if (oldest !== undefined) recCache.delete(oldest);
    }
  }
  return order;
}

/**
 * AI-pick related products for `handle` within an already-built `catalog`.
 * Returns the ProductDrops (mount-correct), or null when AI is off / slow /
 * gives nothing usable — the signal for the caller to use its own fallback.
 */
export async function aiRelatedFromCatalog(
  catalog: Catalog,
  handle: string,
  limit = 4,
): Promise<ProductDrop[] | null> {
  const target = catalog.productByHandle.get(handle);
  if (!target) return null;
  if (!(await aiEnabled())) return null;

  const pool = catalog.products.filter(
    (p) => String(p.handle) !== handle && recommendable(p),
  );
  if (!pool.length) return null;

  let order: string[] | null = null;
  try {
    order = await withTimeout(cachedOrderFor(target, pool), REC_TIMEOUT_MS);
  } catch {
    order = null;
  }
  if (!order || !order.length) return null;

  const byHandle = new Map(pool.map((p) => [String(p.handle), p]));
  const picked: ProductDrop[] = [];
  const seen = new Set<string>();
  for (const h of order) {
    const p = byHandle.get(h);
    if (p && !seen.has(h)) {
      picked.push(p);
      seen.add(h);
      if (picked.length >= limit) break;
    }
  }
  return picked.length ? picked : null;
}

/**
 * Public related-products for a handle. Builds the storefront catalog itself
 * and falls back to a rule-based pick (random buyable products) when AI is
 * off / fails, so it always returns something usable. Never throws.
 */
export async function aiRelatedProducts(handle: string, limit = 4): Promise<ProductDrop[]> {
  try {
    const catalog = await getCatalog("/shop");
    const ai = await aiRelatedFromCatalog(catalog, handle, limit);
    if (ai && ai.length) return ai;
    return ruleBasedRelated(catalog, handle, limit);
  } catch {
    return [];
  }
}

/**
 * The existing rule-based fallback: a shuffled pick of buyable products other
 * than the current one — mirrors the storefront handler's recommendationProducts.
 */
function ruleBasedRelated(catalog: Catalog, handle: string, limit: number): ProductDrop[] {
  const pool = catalog.products.filter(
    (p) => String(p.handle) !== handle && recommendable(p),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, limit));
}
