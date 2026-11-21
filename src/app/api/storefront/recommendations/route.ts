import { recommendationsFor, type Recommendations } from "@/lib/recommendations";
import { aiRelatedProducts } from "@/lib/ai-recommend";
import { aiEnabled } from "@/lib/ai";
import { toCard } from "@/lib/api/catalog";
import { ok, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What goes with what this shopper already bought - the "Complete your look"
 * section.
 *
 * A guest is not an error here: the answer for someone with no history is
 * simply nothing to show, and the app hides the section on an empty list. A
 * 401 would make every guest's home log a failure it has no reason to.
 *
 * When a product `?handle=` is in context and an AI key is set, the suggestions
 * are the AI's related products for that product instead; on any failure (AI
 * off, slow, nothing usable) this falls straight back to the purchase-based
 * recommendations below, so behaviour is never worse than before.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = (url.searchParams.get("handle") ?? "").trim();

  if (handle) {
    try {
      if (await aiEnabled()) {
        const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit")) || 4));
        const products = (await aiRelatedProducts(handle, limit)).map(toCard);
        if (products.length) {
          const res: Recommendations = { mode: "pairs", basedOn: null, products };
          return ok(res);
        }
      }
    } catch {
      /* fall through to the purchase-based recommendations */
    }
  }

  return ok(await recommendationsFor(viewerOf(request)));
}
