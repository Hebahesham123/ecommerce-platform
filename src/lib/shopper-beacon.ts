import "server-only";
import { cookies } from "next/headers";
import { getCatalog } from "@/lib/storefront-data";
import { getSessionPhone } from "@/lib/store-session";
import { viewerOf } from "@/lib/api/http";
import {
  SHOPPER_EVENT_TYPES,
  trackShopper,
  type CartSnapshotLine,
  type ShopperChannel,
  type ShopperEvent,
  type ShopperEventType,
} from "@/lib/shopper-tracking";

/**
 * Read one tracking beacon and record it.
 *
 * Open by design, like the analytics collector: the shop's own pages and app
 * reporting what a shopper did. What it will not take from the caller is who
 * the shopper is — that comes from the signed-in session (a cookie on the
 * website, a token in the app) and nowhere else.
 */

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? n : null;
};

/** A catalog image is an object on /shop; the timeline wants its address. */
function imageOf(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  const src = (img as { src?: unknown }).src;
  return typeof src === "string" ? src : null;
}

export async function handleBeacon(req: Request, fallbackChannel: ShopperChannel): Promise<void> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return;
  }

  const channelRaw = str(body.channel, 8);
  const channel: ShopperChannel =
    channelRaw === "app" || channelRaw === "shop" || channelRaw === "web" ? channelRaw : fallbackChannel;

  let visitorId = str(body.visitorId, 64) || str(req.headers.get("x-visitor"), 64);
  if (!visitorId) {
    try {
      visitorId = str((await cookies()).get("bb_vid")?.value, 64);
    } catch {
      /* no cookies outside a request */
    }
  }
  if (!visitorId) return;

  // Who she is comes from her own credentials only.
  const phone = viewerOf(req) ?? (await getSessionPhone());

  const typeRaw = str(body.type, 40);
  const type = (SHOPPER_EVENT_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as ShopperEventType)
    : null;

  let event: ShopperEvent | null = null;
  if (type) {
    event = {
      type,
      path: str(body.path, 300) || null,
      productId: str(body.productId, 80) || null,
      productName: str(body.productName, 200) || null,
      imageUrl: str(body.imageUrl, 500) || null,
      value: num(body.value),
      quantity: num(body.quantity),
      meta: {},
    };
    const term = str(body.term, 100);
    if (term) event.meta = { term };
    const handle = str(body.handle, 120);
    if (handle) event.meta = { ...event.meta, handle };

    // The theme storefront only knows the product by its handle.
    if (channel === "shop" && handle && !event.productName) {
      try {
        const product = (await getCatalog()).productByHandle.get(handle);
        if (product) {
          event.productId = product.id;
          event.productName = product.title;
          event.imageUrl = imageOf(product.featured_image);
          event.value = product.price / 100;
        }
      } catch {
        /* the event still says which handle */
      }
    }
  }

  let cart: CartSnapshotLine[] | null = null;
  if (Array.isArray(body.cart)) {
    cart = (body.cart as Record<string, unknown>[]).slice(0, 50).map((l) => ({
      itemId: str(l?.itemId, 80),
      name: str(l?.name, 200),
      imageUrl: str(l?.imageUrl, 500) || null,
      price: num(l?.price) ?? 0,
      quantity: num(l?.quantity) ?? 0,
    }));
  } else if (Array.isArray(body.cartIds)) {
    // The theme storefront's basket is ids and quantities; the rest is the catalog's.
    try {
      const catalog = await getCatalog();
      cart = (body.cartIds as Record<string, unknown>[]).slice(0, 50).flatMap((l) => {
        const hit = catalog.variantById.get(str(l?.id, 80));
        if (!hit) return [];
        return [
          {
            itemId: hit.variant.id,
            name: hit.product.title + (hit.variant.title && hit.variant.title !== "Default Title" ? " - " + hit.variant.title : ""),
            imageUrl: imageOf(hit.variant.featured_image) ?? imageOf(hit.product.featured_image),
            price: hit.variant.price / 100,
            quantity: num(l?.quantity) ?? 0,
          },
        ];
      });
    } catch {
      cart = null;
    }
  }

  if (!event && !cart) return;
  await trackShopper({
    visitorId,
    phone,
    channel,
    platform: str(body.platform, 12) || null,
    event,
    cart,
  });
}
