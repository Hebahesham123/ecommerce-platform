"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { computeDiscount, slotLabel, isBirthday } from "@/lib/offers";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type StoreVariant = {
  id: string;
  variantTitle: string | null;
  sku: string | null;
  price: number | null;
  compareAt: number | null;
  available: number;
};
export type StoreProduct = {
  id: string; // first variant id — used as the product route key
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  category: string | null;
  vendor: string | null;
  priceMin: number | null;
  priceMax: number | null;
  available: number;
  variants: StoreVariant[];
};

type Row = Record<string, unknown>;
const n = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const availOf = (r: Row): number => {
  const levels = Array.isArray(r.inventory_levels) ? (r.inventory_levels as Row[]) : [];
  return levels.reduce((s, l) => s + Math.max(0, n(l.on_hand) - n(l.committed)), 0);
};

function groupToProducts(rows: Row[]): StoreProduct[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = String(r.product_name ?? r.id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const out: StoreProduct[] = [];
  for (const group of map.values()) {
    const variants: StoreVariant[] = group.map((r) => ({
      id: String(r.id),
      variantTitle: (r.variant_title as string) ?? null,
      sku: (r.sku as string) ?? null,
      price: numOrNull(r.price),
      compareAt: numOrNull(r.compare_at_price),
      available: availOf(r),
    }));
    const prices = variants.map((v) => v.price).filter((p): p is number => p != null);
    const withImg = group.find((r) => r.image_url) ?? group[0];
    const gallery = [
      ...new Set(
        group.flatMap((r) =>
          Array.isArray(r.images) && r.images.length
            ? (r.images as string[])
            : r.image_url
              ? [String(r.image_url)]
              : [],
        ),
      ),
    ];
    out.push({
      id: variants[0].id,
      name: String(group[0].product_name ?? ""),
      description: (group.find((r) => r.description)?.description as string) ?? null,
      image: (withImg.image_url as string) ?? null,
      images: gallery,
      category: (group[0].category as string) ?? null,
      vendor: (group[0].vendor as string) ?? null,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      available: variants.reduce((s, v) => s + v.available, 0),
      variants,
    });
  }
  return out;
}

export async function listStoreProducts(): Promise<ActionResult<StoreProduct[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*, inventory_levels(on_hand,committed)")
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    let products = groupToProducts(data ?? []);
    // Show only sellable products (published/active if the column exists).
    products = products.filter((p) => p.priceMin != null);
    return { ok: true, data: products };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getStoreProduct(id: string): Promise<ActionResult<StoreProduct>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: one, error: e1 } = await supabase
      .from("inventory_items")
      .select("product_name")
      .eq("id", id)
      .single();
    if (e1) return { ok: false, error: e1.message };
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*, inventory_levels(on_hand,committed)")
      .eq("product_name", one.product_name);
    if (error) return { ok: false, error: error.message };
    const products = groupToProducts(data ?? []);
    if (!products[0]) return { ok: false, error: "not_found" };
    return { ok: true, data: products[0] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Phone verification (mock OTP; remembers verified numbers) --------------
export async function isPhoneVerified(phone: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", normalizePhone(phone))
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Normalize any Egyptian phone to the same international form n8n stores,
 * e.g. "01027546062", "201027546062", "+20 102 754 6062" → "+201027546062".
 */
function normalizePhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return "+20" + d;
}

const OTP_WEBHOOK_URL =
  process.env.OTP_WEBHOOK_URL || "https://n8n.srv1155688.hstgr.cloud/webhook/send-otp";

/**
 * n8n "order relay" flow: on every placed order we POST the order + customer +
 * per-item supplier mapping here. n8n then creates a draft order on the supplier
 * Shopify store and emails the customer a checkout link. See
 * docs/n8n-order-relay.md. Fire-and-forget: a webhook failure never blocks the
 * order from being placed on our own store.
 */
const ORDER_RELAY_WEBHOOK_URL =
  process.env.ORDER_RELAY_WEBHOOK_URL ||
  "https://n8n.srv1155688.hstgr.cloud/webhook/order-relay";

/**
 * Generate a code, store it, and deliver it via the n8n OTP webhook.
 * `sent` reflects whether the webhook accepted the request; if it fails we fall
 * back to returning the code (`devCode`) so testing still works.
 */
export async function sendOtp(
  phone: string,
  channel: "whatsapp" | "sms" = "whatsapp",
): Promise<ActionResult<{ sent: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(phone);
    if (ph.replace(/\D/g, "").length < 10) return { ok: false, error: "invalid_phone" };
    const ch = channel === "sms" ? "sms" : "whatsapp";

    // Already verified before → caller should skip OTP entirely.
    const { data: known } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (known) return { ok: true, data: { sent: true } };

    // n8n owns OTP generation + delivery + storage (in otp_codes). We only
    // trigger it; verifyOtp then checks the code n8n stored. `channel` tells
    // n8n which route to deliver on (WhatsApp or SMS) per the customer's pick.
    let sent = false;
    try {
      const r = await fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: ph, mobile: ph, channel: ch }),
      });
      sent = r.ok;
    } catch {
      sent = false;
    }

    return { ok: true, data: { sent } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function verifyOtp(
  phone: string,
  code: string,
  name?: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(phone);
    const { data } = await supabase.from("otp_codes").select("*").eq("phone", ph).maybeSingle();
    if (!data) return { ok: false, error: "no_code" };
    if (String(data.code) !== code.trim()) return { ok: false, error: "wrong_code" };
    if (new Date(String(data.expires_at)).getTime() < Date.now())
      return { ok: false, error: "expired" };
    await supabase
      .from("verified_phones")
      .upsert({ phone: ph, name: name ?? null, verified_at: new Date().toISOString() }, { onConflict: "phone" });
    await supabase.from("otp_codes").delete().eq("phone", ph);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Passwordless customer profiles (phone = account) -----------------------
export type CustomerProfile = {
  name: string | null;
  email: string | null;
  birthday: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  note: string | null;
};

/**
 * Returns whether the phone is verified and, if so, its saved profile so the
 * checkout can autofill returning customers. A profile is ONLY revealed for
 * verified numbers — typing someone else's number leaks nothing.
 */
export async function getCustomer(
  phone: string,
): Promise<ActionResult<{ verified: boolean; profile: CustomerProfile | null }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(phone);
    const { data: v } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (!v) return { ok: true, data: { verified: false, profile: null } };

    const { data } = await supabase
      .from("store_customers")
      .select("name,email,birthday,governorate,city,address,note")
      .eq("phone", ph)
      .maybeSingle();
    const profile: CustomerProfile | null = data
      ? {
          name: (data.name as string) ?? null,
          email: (data.email as string) ?? null,
          birthday: data.birthday ? String(data.birthday) : null,
          governorate: (data.governorate as string) ?? null,
          city: (data.city as string) ?? null,
          address: (data.address as string) ?? null,
          note: (data.note as string) ?? null,
        }
      : null;
    return { ok: true, data: { verified: true, profile } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Save/patch a customer's birthday (verified numbers only). */
export async function setCustomerBirthday(phone: string, birthday: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(phone);
    const { data: v } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (!v) return { ok: false, error: "not_verified" };
    await supabase
      .from("store_customers")
      .upsert({ phone: ph, birthday, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Lightweight storefront counts for social-proof UI. */
export async function getStoreStats(): Promise<ActionResult<{ orders: number; customers: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { count: orders } = await supabase
      .from("store_orders")
      .select("*", { count: "exact", head: true });
    const { count: customers } = await supabase
      .from("store_customers")
      .select("*", { count: "exact", head: true });
    return { ok: true, data: { orders: orders ?? 0, customers: customers ?? 0 } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Place a COD order ------------------------------------------------------
export type CartLine = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
};
export type OrderPayload = {
  customerName: string;
  phone: string;
  email?: string | null; // needed so the supplier can email the checkout link
  governorate: string;
  city: string;
  address: string;
  note?: string;
  couponCode?: string | null;
  birthday?: string | null; // yyyy-mm-dd, saved to the customer profile
  deliverySpeed?: "standard" | "scheduled";
  deliveryDate?: string | null; // yyyy-mm-dd
  deliverySlot?: string | null; // slot id from DELIVERY_SLOTS
  giftWrap?: boolean;
  giftMessage?: string | null;
  items: CartLine[];
};

/**
 * Build the relay payload (order + customer + per-item supplier mapping) and POST
 * it to the n8n order-relay webhook. Enriches each cart line with the supplier
 * mapping columns (supplier_variant_id / supplier_url / supplier_title) and the
 * vendor, so n8n can either use an exact supplier variant or search the supplier
 * store by the brand-stripped title. Never throws — relay problems must not fail
 * an order that already succeeded on our store.
 */
async function fireOrderRelay(
  supabase: ReturnType<typeof getServerSupabase>,
  orderNumber: string,
  payload: OrderPayload,
  phone: string,
  email: string | null,
  total: number,
): Promise<void> {
  try {
    const ids = [...new Set(payload.items.map((i) => i.itemId))];
    const { data: mapRows } = await supabase
      .from("inventory_items")
      .select("id, vendor, supplier_variant_id, supplier_url, supplier_title")
      .in("id", ids);
    const byId = new Map((mapRows ?? []).map((r: Row) => [String(r.id), r]));

    const items = payload.items.map((i) => {
      const m = byId.get(i.itemId) ?? {};
      return {
        title: i.productName,
        variantTitle: i.variantTitle,
        sku: i.sku,
        quantity: i.quantity,
        price: i.price,
        vendor: (m.vendor as string) ?? null,
        supplierVariantId: (m.supplier_variant_id as string) ?? null,
        supplierUrl: (m.supplier_url as string) ?? null,
        supplierTitle: (m.supplier_title as string) ?? null,
      };
    });

    await fetch(ORDER_RELAY_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderNumber,
        total,
        customer: {
          name: payload.customerName.trim(),
          phone,
          email,
          governorate: payload.governorate.trim() || null,
          city: payload.city.trim() || null,
          address: payload.address.trim() || null,
          note: payload.note?.trim() || null,
        },
        items,
      }),
    });
  } catch {
    // swallow — the order is already placed; relay is best-effort.
  }
}

export async function placeOrder(
  payload: OrderPayload,
): Promise<ActionResult<{ orderNumber: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!payload.items.length) return { ok: false, error: "empty_cart" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(payload.phone);

    // Enforce verification server-side.
    const { data: verified } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (!verified) return { ok: false, error: "not_verified" };

    const subtotal = payload.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = 0; // free shipping for the test flow

    // Validate any coupon server-side (never trust the client for pricing).
    // The BIRTHDAY coupon is only honored on the customer's real birthday,
    // checked against the birthday they entered now or saved on their profile.
    let isBday = false;
    if ((payload.couponCode || "").trim().toUpperCase() === "BIRTHDAY") {
      let bday = payload.birthday || null;
      if (!bday) {
        const { data: c } = await supabase
          .from("store_customers")
          .select("birthday")
          .eq("phone", ph)
          .maybeSingle();
        bday = c?.birthday ? String(c.birthday) : null;
      }
      isBday = isBirthday(bday, new Date());
    }
    const disc = computeDiscount(payload.couponCode, subtotal, { birthday: isBday });
    const discount = disc.ok ? disc.discount : 0;
    const total = Math.max(0, subtotal - discount + shipping);
    const orderNumber = "BB" + Date.now().toString().slice(-8);

    // Fold delivery schedule, gift options and coupon into the merchant note
    // (no schema change needed — it's all captured in store_orders.note).
    const noteParts: string[] = [];
    if (payload.note?.trim()) noteParts.push(payload.note.trim());
    if (payload.deliverySpeed === "scheduled" && payload.deliveryDate) {
      const slot = slotLabel(payload.deliverySlot, "ar");
      noteParts.push(`التوصيل: ${payload.deliveryDate}${slot ? ` (${slot})` : ""}`);
    } else {
      noteParts.push("التوصيل: قياسي (٢–٤ أيام)");
    }
    if (payload.giftWrap) {
      noteParts.push(`تغليف هدية${payload.giftMessage?.trim() ? `: "${payload.giftMessage.trim()}"` : ""}`);
    }
    if (disc.ok && disc.offer) noteParts.push(`كوبون ${disc.offer.code} (−${discount})`);
    const composedNote = noteParts.join(" | ") || null;

    // Place the order atomically: stock is reserved under row locks and the
    // whole transaction rolls back if any line is short (prevents overselling).
    const { error: rpcErr } = await supabase.rpc("place_store_order", {
      p_order_number: orderNumber,
      p_customer_name: payload.customerName.trim(),
      p_phone: ph,
      p_governorate: payload.governorate.trim() || null,
      p_city: payload.city.trim() || null,
      p_address: payload.address.trim() || null,
      p_note: composedNote,
      p_subtotal: subtotal,
      p_shipping: shipping,
      p_total: total,
      p_items: payload.items.map((i) => ({
        item_id: i.itemId,
        product_name: i.productName,
        variant_title: i.variantTitle,
        sku: i.sku,
        image_url: i.imageUrl,
        price: i.price,
        quantity: i.quantity,
      })),
    });
    if (rpcErr) {
      if ((rpcErr.message || "").includes("insufficient_stock")) {
        return { ok: false, error: "out_of_stock" };
      }
      return { ok: false, error: rpcErr.message };
    }

    // Upsert the passwordless customer profile (keyed by the verified phone) so
    // returning customers get autofilled next time. Birthday only overwrites
    // when provided, so we never wipe a saved one.
    const emailIn = payload.email?.trim() || null;
    await supabase.from("store_customers").upsert(
      {
        phone: ph,
        name: payload.customerName.trim() || null,
        ...(emailIn ? { email: emailIn } : {}),
        governorate: payload.governorate.trim() || null,
        city: payload.city.trim() || null,
        address: payload.address.trim() || null,
        ...(payload.birthday ? { birthday: payload.birthday } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );

    // Fall back to the saved profile email if none was entered this time, so the
    // supplier can still email the checkout link.
    let relayEmail = emailIn;
    if (!relayEmail) {
      const { data: prof } = await supabase
        .from("store_customers")
        .select("email")
        .eq("phone", ph)
        .maybeSingle();
      relayEmail = (prof?.email as string) ?? null;
    }

    // Relay to the supplier via n8n (draft order + checkout-link email). Awaited
    // so it runs before the serverless function returns, but never fails the order.
    await fireOrderRelay(supabase, orderNumber, payload, ph, relayEmail, total);

    return { ok: true, data: { orderNumber } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Admin-facing list of real placed orders, mapped to the admin Order shape.
export type PlacedOrder = {
  id: string;
  customer: string;
  phone: string;
  governorate: string;
  total: number;
  method: "cod";
  lifecycle: "placed" | "confirmed" | "packed" | "shipped" | "completed" | "cancelled";
  payment: "pending" | "authorized" | "paid" | "refunded";
  fulfillment: "unfulfilled" | "assigned" | "out" | "delivered" | "returned";
  date: string;
  itemsCount: number;
};

export async function listStoreOrders(): Promise<ActionResult<PlacedOrder[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_orders")
      .select("*, store_order_items(id)")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []).map((r: Row): PlacedOrder => ({
      id: String(r.order_number),
      customer: String(r.customer_name ?? ""),
      phone: String(r.phone ?? ""),
      governorate: String(r.governorate ?? ""),
      total: Number(r.total ?? 0),
      method: "cod",
      lifecycle: (String(r.lifecycle ?? "placed") as PlacedOrder["lifecycle"]),
      payment: (String(r.payment_status ?? "pending") as PlacedOrder["payment"]),
      fulfillment: (String(r.fulfillment_status ?? "unfulfilled") as PlacedOrder["fulfillment"]),
      date: String(r.created_at ?? "").slice(0, 10),
      itemsCount: Array.isArray(r.store_order_items) ? r.store_order_items.length : 0,
    }));
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getOrderByNumber(orderNumber: string): Promise<ActionResult<Row>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("order_number", orderNumber)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
