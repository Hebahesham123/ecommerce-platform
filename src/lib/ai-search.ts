import "server-only";
import { getCatalog, searchProducts, type Catalog, type ProductDrop } from "@/lib/storefront-data";
import { aiComplete, aiEnabled } from "@/lib/ai";

/**
 * On-site AI search — a RANKING layer over the existing keyword search.
 *
 * Keyword search decides which products match (recall); the model only
 * re-orders those candidates by how well they fit the shopper's intent
 * (precision), expanding synonyms and pushing the best matches to the top. It
 * never invents products, and on any failure — AI off, slow, bad JSON — the
 * untouched keyword results are returned, so search can never get slower or
 * worse than it is today.
 *
 * We cache the model's handle ordering (not the ProductDrops) keyed by the
 * normalized query, so the ordering can be applied cheaply to any catalog
 * regardless of its URL mount, and repeated queries skip the model entirely.
 */

// The slice of a product the model needs to rank it — kept tiny on purpose.
type Candidate = { handle: string; title: string; tags: string[]; price: number };

const RANK_TTL_MS = 60_000;
const MAX_CANDIDATES = 40;
// A short guard so a slow model call can never hold up a search response.
const SEARCH_TIMEOUT_MS = 2_500;

const rankCache = new Map<string, { at: number; order: string[] }>();

function normQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Race a promise against a timeout, resolving null if it is too slow. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function compact(candidates: ProductDrop[]): Candidate[] {
  return candidates.slice(0, MAX_CANDIDATES).map((p) => ({
    handle: String(p.handle),
    title: String(p.title ?? ""),
    tags: (p.tags ?? []).slice(0, 8).map(String),
    price: Math.round(Number(p.price_min ?? p.price ?? 0) / 100),
  }));
}

/** Ask the model for a best-first ordering of the candidate handles. */
async function aiHandleOrder(query: string, candidates: ProductDrop[]): Promise<string[] | null> {
  const list = compact(candidates);
  if (!list.length) return null;
  const prompt =
    `A shopper searched an online store for: ${JSON.stringify(query)}\n\n` +
    `Here are the candidate products (JSON):\n${JSON.stringify(list)}\n\n` +
    `First, expand the query's intent and likely synonyms. Then rank the ` +
    `candidate handles from the best match to the worst for this shopper. You ` +
    `may drop clearly irrelevant handles. Reply as JSON exactly like ` +
    `{"handles":["handle-a","handle-b"]} using only handles from the list.`;
  const out = await aiComplete({
    system: "You are a product-search ranking engine for an online store. Be precise and concise.",
    prompt,
    json: true,
    fast: true,
    maxTokens: 700,
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

/** Cached handle ordering for a query (60s). Null when the model gives nothing usable. */
async function rankedOrderFor(query: string, candidates: ProductDrop[]): Promise<string[] | null> {
  const key = normQuery(query);
  const hit = rankCache.get(key);
  if (hit && Date.now() - hit.at < RANK_TTL_MS) return hit.order;
  const order = await aiHandleOrder(query, candidates);
  if (order) {
    rankCache.set(key, { at: Date.now(), order });
    if (rankCache.size > 500) {
      // Drop the oldest entry so the cache cannot grow without bound.
      const oldest = rankCache.keys().next().value;
      if (oldest !== undefined) rankCache.delete(oldest);
    }
  }
  return order;
}

/**
 * Re-order keyword candidates by a model ranking. Handles the model omitted are
 * appended after the ranked ones, so recall never drops below keyword search.
 */
function applyOrder(candidates: ProductDrop[], order: string[]): ProductDrop[] {
  const byHandle = new Map(candidates.map((p) => [String(p.handle), p]));
  const seen = new Set<string>();
  const ranked: ProductDrop[] = [];
  for (const h of order) {
    const p = byHandle.get(h);
    if (p && !seen.has(h)) {
      ranked.push(p);
      seen.add(h);
    }
  }
  for (const p of candidates) {
    if (!seen.has(String(p.handle))) ranked.push(p);
  }
  return ranked;
}

/**
 * Rank the keyword matches for `query` within an already-built `catalog`.
 * Reorders the catalog's own ProductDrops, so URLs stay correct for whatever
 * mount built the catalog. Falls back to keyword order on any failure.
 */
export async function aiRankSearch(
  catalog: Catalog,
  query: string,
  limit?: number,
): Promise<ProductDrop[]> {
  const keyword = searchProducts(catalog, query);
  let results = keyword;
  if (keyword.length > 1) {
    try {
      if (await aiEnabled()) {
        const order = await withTimeout(rankedOrderFor(query, keyword), SEARCH_TIMEOUT_MS);
        if (order && order.length) results = applyOrder(keyword, order);
      }
    } catch {
      results = keyword;
    }
  }
  return typeof limit === "number" ? results.slice(0, limit) : results;
}

/**
 * Public on-site search used by the API route: builds the storefront catalog
 * and returns up to `limit` ProductDrops, AI-ranked when a key is set and
 * keyword-ranked otherwise. Never throws.
 */
export async function aiSearch(query: string, limit = 24): Promise<ProductDrop[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const catalog = await getCatalog("/shop");
    return await aiRankSearch(catalog, q, limit);
  } catch {
    return [];
  }
}
