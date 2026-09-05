import { previewCoupon } from "@/app/store/actions";
import { priceCart, type CartRequestLine } from "@/lib/api/cart";
import { bodyOf, fail, int, ok, str, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a code is worth on this cart.
 *
 * The cart is re-priced from the database first, so the preview is computed on
 * real prices rather than whatever the app claims its basket is worth. It is
 * still only a preview — checkout runs the same engine again — but a preview
 * that lies to the shopper is worse than none.
 *
 * The phone comes from the bearer token, never the body: a birthday code must
 * not be claimable by typing someone else's number.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const code = str(body.code, 60);
  if (!code) return fail("missing_code");

  const raw = Array.isArray(body.lines) ? body.lines : [];
  const requested: CartRequestLine[] = raw
    .map((l): CartRequestLine => {
      const line = (l ?? {}) as Record<string, unknown>;
      return { itemId: str(line.itemId, 64), quantity: int(line.quantity, 0) };
    })
    .filter((l) => l.itemId && l.quantity > 0);

  const cart = await priceCart(requested);
  if (!cart.lines.length) return fail("empty_cart");

  const preview = await previewCoupon(
    code,
    cart.lines.map((l) => ({
      itemId: l.itemId,
      productName: l.productName,
      variantTitle: l.variantTitle,
      sku: l.sku,
      imageUrl: l.imageUrl,
      price: l.price,
      quantity: l.quantity,
    })),
    viewerOf(request),
    str(body.birthday, 10) || null,
  );

  return ok({ ...preview, subtotal: cart.subtotal });
}
