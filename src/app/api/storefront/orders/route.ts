import { accountFor } from "@/lib/account-service";
import { placeOrderCore, type CartLine, type OrderPayload } from "@/lib/orders";
import { priceCart, type CartRequestLine } from "@/lib/cart-pricing";
import { bodyOf, channelOf, fail, fromResult, int, ok, str, viewerOf } from "@/lib/api/http";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The shopper's own orders, newest first. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const account = await accountFor(viewer);
  // A read that failed is not the same as a shopper with no orders, and an app
  // that shows "no orders yet" during an outage teaches people their history
  // is gone.
  if (!account) return fail("account_unavailable", 503);
  return ok({ orders: account.orders });
}

/**
 * Place a cash-on-delivery order from the app.
 *
 * The app sends ids and quantities; the prices are read here. That is the
 * whole point of the shape — an order built from numbers the client supplied
 * is an order a client can discount to zero.
 *
 * If the live catalogue no longer agrees with what the app was showing, the
 * order is refused with the corrected cart rather than quietly placed for
 * different goods at a different price. Everything after that — the stock
 * reservation, the discount redemption, the Meta purchase event — is
 * `placeOrderCore`, the same function the website's checkout calls.
 */
export async function POST(request: Request) {
  // Unlike the website, this route will not take the buyer's word for who they
  // are. The website can fall back to "this number is in verified_phones",
  // because a browser that got there went through the code screen in the same
  // session. An HTTP client did not, so knowing a number that has ordered
  // before would otherwise be enough to place an order in that person's name —
  // and to overwrite their saved address with the sender's.
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const body = await bodyOf(request);

  const raw = Array.isArray(body.lines) ? body.lines : [];
  const requested: CartRequestLine[] = raw
    .map((l): CartRequestLine => {
      const line = (l ?? {}) as Record<string, unknown>;
      return { itemId: str(line.itemId, 64), quantity: int(line.quantity, 0) };
    })
    .filter((l) => l.itemId && l.quantity > 0);
  if (!requested.length) return fail("empty_cart");

  const cart = await priceCart(requested);
  if (!cart.lines.length) return fail("empty_cart");
  if (cart.removed.length || cart.lines.some((l) => l.adjusted)) {
    return fail("cart_changed", 409);
  }

  const items: CartLine[] = cart.lines.map((l) => ({
    itemId: l.itemId,
    productName: l.productName,
    variantTitle: l.variantTitle,
    sku: l.sku,
    imageUrl: l.imageUrl,
    price: l.price,
    quantity: l.quantity,
  }));

  const payload: OrderPayload = {
    customerName: str(body.customerName, 120),
    phone: str(body.phone, 40),
    email: str(body.email, 160) || null,
    governorate: str(body.governorate, 80),
    city: str(body.city, 80),
    address: str(body.address, 400),
    note: str(body.note, 1000),
    couponCode: str(body.couponCode, 60) || null,
    birthday: str(body.birthday, 10) || null,
    deliverySpeed: str(body.deliverySpeed, 16) === "scheduled" ? "scheduled" : "standard",
    deliveryDate: str(body.deliveryDate, 10) || null,
    deliverySlot: str(body.deliverySlot, 40) || null,
    giftWrap: body.giftWrap === true,
    giftMessage: str(body.giftMessage, 500) || null,
    items,
  };

  if (!payload.customerName) return fail("missing_name");
  if (!payload.address) return fail("missing_address");
  if (normalizePhone(payload.phone) !== viewer) return fail("phone_not_yours", 403);

  return fromResult(
    await placeOrderCore(payload, { channel: channelOf(request), viewerPhone: viewer }),
  );
}
