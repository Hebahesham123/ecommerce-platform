import { aiSearch } from "@/lib/ai-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-site AI search. GET ?q= returns the matching products, AI-ranked when an
 * AI key is set and keyword-ranked otherwise.
 *
 * Cheap and best-effort: an empty or failing search is an empty product list,
 * never an error, so a storefront search box can call this without special
 * handling.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  let products: Array<{
    handle: string;
    title: string;
    image: string | null;
    price: number;
    url: string;
  }> = [];

  if (q) {
    try {
      const drops = await aiSearch(q, 24);
      products = drops.map((p) => ({
        handle: String(p.handle),
        title: String(p.title ?? ""),
        // Image drops stringify to their URL; force a plain string / null.
        image: p.featured_image ? String(p.featured_image) : null,
        price: Number(p.price_min ?? p.price ?? 0),
        url: String(p.url ?? ""),
      }));
    } catch {
      products = [];
    }
  }

  return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
