import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

/**
 * What each shopper does, tied to her once she is known.
 *
 * Every surface — the website, the theme storefront at /shop and the app —
 * reports through here with a visitor id the browser or phone keeps for
 * itself. The phone comes from the signed-in session, never from the caller,
 * so nobody can write activity into someone else's profile.
 *
 * Tracking must never cost a shopper anything: every function here swallows
 * its own failures.
 */

export type ShopperChannel = "web" | "app" | "shop";

export const SHOPPER_EVENT_TYPES = [
  "product_view",
  "collection_view",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "checkout_start",
  "order",
  "offer_shown",
  "offer_claimed",
] as const;
export type ShopperEventType = (typeof SHOPPER_EVENT_TYPES)[number];

export type ShopperEvent = {
  type: ShopperEventType;
  path?: string | null;
  productId?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
  value?: number | null;
  quantity?: number | null;
  meta?: Record<string, unknown>;
};

export type CartSnapshotLine = {
  itemId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
};

const MAX_LINES = 50;

function cleanLines(lines: CartSnapshotLine[]): CartSnapshotLine[] {
  return lines
    .filter((l) => l.itemId && l.quantity > 0)
    .slice(0, MAX_LINES)
    .map((l) => ({
      itemId: String(l.itemId).slice(0, 80),
      name: String(l.name ?? "").slice(0, 200),
      imageUrl: l.imageUrl ? String(l.imageUrl).slice(0, 500) : null,
      price: Number.isFinite(l.price) ? Math.max(0, l.price) : 0,
      quantity: Math.max(1, Math.min(999, Math.trunc(l.quantity))),
    }));
}

/** Seen now; tied to a phone if one is known. Returns the visitor's phone, if any. */
async function touch(
  visitorId: string,
  phone: string | null,
  channel: ShopperChannel,
  platform: string | null,
): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("shopper_touch", {
    p_visitor: visitorId,
    p_phone: phone ? normalizePhone(phone) : null,
    p_channel: channel,
    p_platform: platform,
  });
  if (error) throw error;
  return typeof data === "string" && data ? data : null;
}

/** One beacon: an event, a basket, or both. */
export async function trackShopper(input: {
  visitorId: string;
  phone: string | null;
  channel: ShopperChannel;
  platform?: string | null;
  event?: ShopperEvent | null;
  cart?: CartSnapshotLine[] | null;
}): Promise<void> {
  if (!isSupabaseConfigured() || !input.visitorId) return;
  try {
    const supabase = getServerSupabase();
    const phone = await touch(input.visitorId, input.phone, input.channel, input.platform ?? null);

    if (input.event) {
      const e = input.event;
      await supabase.from("shopper_events").insert({
        visitor_id: input.visitorId,
        phone,
        channel: input.channel,
        type: e.type,
        path: e.path ? e.path.split("?")[0].slice(0, 300) : null,
        product_id: e.productId ? String(e.productId).slice(0, 80) : null,
        product_name: e.productName ? String(e.productName).slice(0, 200) : null,
        image_url: e.imageUrl ? String(e.imageUrl).slice(0, 500) : null,
        value: e.value != null && Number.isFinite(e.value) ? e.value : null,
        quantity: e.quantity != null && Number.isFinite(e.quantity) ? Math.trunc(e.quantity) : null,
        meta: e.meta ?? {},
      });
    }

    if (input.cart) {
      const items = cleanLines(input.cart);
      await supabase.from("shopper_carts").upsert(
        {
          visitor_id: input.visitorId,
          phone,
          channel: input.channel,
          items,
          item_count: items.reduce((n, l) => n + l.quantity, 0),
          subtotal: items.reduce((n, l) => n + l.price * l.quantity, 0),
          updated_at: new Date().toISOString(),
          ordered_at: null,
          order_number: null,
        },
        { onConflict: "visitor_id" },
      );
    }
  } catch {
    /* tracking never breaks shopping */
  }
}

/**
 * An order was placed: it joins her timeline, ties this visitor to her phone,
 * and closes every basket she had open, on any device.
 */
export async function recordShopperOrder(input: {
  visitorId: string | null;
  phone: string;
  channel: ShopperChannel;
  orderNumber: string;
  total: number;
  itemCount: number;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getServerSupabase();
    const phone = normalizePhone(input.phone);
    if (input.visitorId) await touch(input.visitorId, phone, input.channel, null);
    // An app too old to send a visitor id still puts the order on her timeline.
    await supabase.from("shopper_events").insert({
      visitor_id: input.visitorId ?? `phone:${phone}`,
      phone,
      channel: input.channel,
      type: "order",
      value: input.total,
      quantity: input.itemCount,
      meta: { orderNumber: input.orderNumber },
    });
    const now = new Date().toISOString();
    const closed = { ordered_at: now, order_number: input.orderNumber };
    await supabase.from("shopper_carts").update(closed).eq("phone", phone).is("ordered_at", null);
    if (input.visitorId) {
      await supabase.from("shopper_carts").update(closed).eq("visitor_id", input.visitorId).is("ordered_at", null);
    }
  } catch {
    /* an order is never failed over its tracking */
  }
}
