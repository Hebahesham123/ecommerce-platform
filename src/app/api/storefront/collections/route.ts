import { listStoreProducts } from "@/app/store/actions";
import { fromResult, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The categories that actually have something to sell.
 *
 * Derived from the catalogue rather than kept in a table of its own, so a
 * category cannot survive in the app's navigation after its last product is
 * gone — which is the usual way a store ends up with a tab that opens onto
 * nothing.
 */
export async function GET() {
  const res = await listStoreProducts();
  if (!res.ok) return fromResult(res);

  const counts = new Map<string, { name: string; count: number; image: string | null }>();
  for (const p of res.data) {
    const name = (p.category ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, count: 0, image: null };
    entry.count += 1;
    entry.image = entry.image ?? p.image;
    counts.set(key, entry);
  }

  const collections = [...counts.entries()]
    .map(([handle, v]) => ({ handle, ...v }))
    .sort((a, b) => b.count - a.count);

  return ok({ collections });
}
