"use server";

import { getSessionPhone } from "@/lib/store-session";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";

/**
 * The signed-in shopper's own account actions.
 *
 * Every function resolves the phone from the session cookie itself (never a
 * caller-supplied argument), so a shopper can only ever read or change their
 * own data — the same trust model the rest of the storefront uses.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const nnum = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

export type MyOrderLine = {
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  fulfilledQuantity: number;
};
export type MyFulfillment = {
  id: string;
  tracking: string | null;
  carrier: string | null;
  createdAt: string;
  items: { productName: string; quantity: number }[];
};
export type MyOrder = {
  orderNumber: string;
  createdAt: string;
  lifecycle: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotal: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balance: number;
  customerName: string;
  address: string | null;
  city: string | null;
  governorate: string | null;
  paymentMethod: string;
  items: MyOrderLine[];
  fulfillments: MyFulfillment[];
};

/** One of the shopper's own orders, in full — verified to belong to them. */
export async function getMyOrder(orderNumber: string): Promise<ActionResult<MyOrder>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!order) return { ok: false, error: "not_found" };
    // Ownership check — never reveal another shopper's order.
    if (!phoneVariants(phone).includes(s(order.phone))) return { ok: false, error: "not_your_order" };

    const orderId = s(order.id);
    let fulfillments: MyFulfillment[] = [];
    try {
      const { data: fs } = await supabase
        .from("order_fulfillments")
        .select("*, order_fulfillment_items(*)")
        .eq("order_id", orderId)
        .order("created_at");
      fulfillments = ((fs ?? []) as Row[]).map((f): MyFulfillment => ({
        id: s(f.id),
        tracking: sn(f.tracking),
        carrier: sn(f.carrier),
        createdAt: s(f.created_at),
        items: (Array.isArray(f.order_fulfillment_items) ? f.order_fulfillment_items : []).map((fi: Row) => ({
          productName: s(fi.product_name),
          quantity: nnum(fi.quantity),
        })),
      }));
    } catch {
      /* 0028 not applied yet — orders still render without shipment history */
    }

    const items = (Array.isArray(order.store_order_items) ? order.store_order_items : []) as Row[];
    const total = nnum(order.total);
    const amountPaid = nnum(order.amount_paid);
    return {
      ok: true,
      data: {
        orderNumber: s(order.order_number),
        createdAt: s(order.created_at),
        lifecycle: s(order.lifecycle) || "placed",
        paymentStatus: s(order.payment_status) || "pending",
        fulfillmentStatus: s(order.fulfillment_status) || "unfulfilled",
        subtotal: nnum(order.subtotal),
        shipping: nnum(order.shipping),
        total,
        amountPaid,
        balance: Math.max(0, total - amountPaid),
        customerName: s(order.customer_name),
        address: sn(order.address),
        city: sn(order.city),
        governorate: sn(order.governorate),
        paymentMethod: s(order.payment_method) || "cod",
        items: items.map((li): MyOrderLine => ({
          productName: s(li.product_name),
          variantTitle: sn(li.variant_title),
          sku: sn(li.sku),
          imageUrl: sn(li.image_url),
          price: nnum(li.price),
          quantity: nnum(li.quantity),
          fulfilledQuantity: nnum(li.fulfilled_quantity),
        })),
        fulfillments,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const AVATAR_BUCKET = "files";
/** Small enough to arrive as one request; the browser shrinks it before sending. */
const AVATAR_MAX_BYTES = 900_000;

/**
 * Set the signed-in shopper's own picture.
 *
 * It arrives already shrunk to a square by the browser, so it fits in a single
 * request and there is no upload URL to hand out — which matters, because a
 * signed upload URL given to a storefront visitor is a write into storage that
 * nothing else checks. The phone comes from the session, never the caller, so
 * this can only ever change her own.
 *
 * Stored under a random name. A path built from her phone number would publish
 * it to anyone the image URL reached.
 */
export async function saveMyAvatar(dataUrl: string): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return { ok: false, error: "not_an_image" };
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) return { ok: false, error: "empty_image" };
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, error: "image_too_large" };

  try {
    const supabase = getServerSupabase();
    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const path = `avatars/${crypto.randomUUID()}.${extension}`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: `image/${match[1]}`, cacheControl: "31536000", upsert: false });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    // What she had before, so it can be cleared once the new one is safely in.
    const { data: before } = await supabase
      .from("store_customers")
      .select("avatar_url")
      .eq("phone", phone)
      .maybeSingle();

    const { error } = await supabase
      .from("store_customers")
      .upsert({ phone, avatar_url: url, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    if (error) {
      // Do not leave an orphan behind a failed save.
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      return { ok: false, error: error.message };
    }

    const old = s(before?.avatar_url);
    const oldPath = old.match(/\/object\/public\/[^/]+\/(.+)$/)?.[1];
    if (oldPath && oldPath !== path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([decodeURIComponent(oldPath)]);
    }

    return { ok: true, data: url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Take her picture back off, and delete the file with it. */
export async function removeMyAvatar(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const { data: before } = await supabase
      .from("store_customers")
      .select("avatar_url")
      .eq("phone", phone)
      .maybeSingle();
    const { error } = await supabase
      .from("store_customers")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("phone", phone);
    if (error) return { ok: false, error: error.message };
    const oldPath = s(before?.avatar_url).match(/\/object\/public\/[^/]+\/(.+)$/)?.[1];
    if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([decodeURIComponent(oldPath)]);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Update the signed-in shopper's own profile. */
export async function saveMyProfile(input: {
  name?: string;
  email?: string;
  birthday?: string | null;
  governorate?: string;
  city?: string;
  address?: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const phone = await getSessionPhone();
  if (!phone) return { ok: false, error: "not_signed_in" };
  try {
    const supabase = getServerSupabase();
    const patch: Row = { phone, updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name.trim() || null;
    if (input.email !== undefined) patch.email = input.email.trim() || null;
    if (input.birthday !== undefined) patch.birthday = input.birthday || null;
    if (input.governorate !== undefined) patch.governorate = input.governorate.trim() || null;
    if (input.city !== undefined) patch.city = input.city.trim() || null;
    if (input.address !== undefined) patch.address = input.address.trim() || null;
    const { error } = await supabase.from("store_customers").upsert(patch, { onConflict: "phone" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
