import { priceCart, type CartRequestLine } from "@/lib/cart-pricing";
import { bodyOf, int, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-price the cart the app is holding on the device.
 *
 * The app sends ids and quantities and nothing else — never prices. Everything
 * comes back from the database, including a per-line ceiling and an `adjusted`
 * flag, so the app can tell the shopper "we only have two left" before
 * checkout refuses them at the till.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const raw = Array.isArray(body.lines) ? body.lines : [];
  const lines: CartRequestLine[] = raw
    .map((l): CartRequestLine => {
      const line = (l ?? {}) as Record<string, unknown>;
      return { itemId: str(line.itemId, 64), quantity: int(line.quantity, 0) };
    })
    .filter((l) => l.itemId && l.quantity > 0);

  return ok(await priceCart(lines));
}
