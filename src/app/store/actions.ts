"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

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

function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

const OTP_WEBHOOK_URL =
  process.env.OTP_WEBHOOK_URL || "https://n8n.srv1155688.hstgr.cloud/webhook/send-otp";

/**
 * Generate a code, store it, and deliver it via the n8n OTP webhook.
 * `sent` reflects whether the webhook accepted the request; if it fails we fall
 * back to returning the code (`devCode`) so testing still works.
 */
export async function sendOtp(
  phone: string,
): Promise<ActionResult<{ sent: boolean; devCode: string | null }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(phone);
    if (ph.replace(/\D/g, "").length < 8) return { ok: false, error: "invalid_phone" };

    // Already verified before → caller should skip OTP entirely.
    const { data: known } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (known) return { ok: true, data: { sent: true, devCode: null } };

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("otp_codes")
      .upsert({ phone: ph, code, expires_at: expires }, { onConflict: "phone" });
    if (error) return { ok: false, error: error.message };

    // Deliver through the n8n webhook (SMS/WhatsApp).
    let sent = false;
    try {
      const r = await fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: ph,
          code,
          otp: code,
          message: `BeautyBar verification code: ${code}`,
        }),
      });
      sent = r.ok;
    } catch {
      sent = false;
    }

    return { ok: true, data: { sent, devCode: sent ? null : code } };
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
  governorate: string;
  city: string;
  address: string;
  note?: string;
  items: CartLine[];
};

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
    const total = subtotal + shipping;
    const orderNumber = "BB" + Date.now().toString().slice(-8);

    const { data: order, error: oe } = await supabase
      .from("store_orders")
      .insert({
        order_number: orderNumber,
        customer_name: payload.customerName.trim(),
        phone: ph,
        governorate: payload.governorate.trim() || null,
        city: payload.city.trim() || null,
        address: payload.address.trim() || null,
        note: payload.note?.trim() || null,
        subtotal,
        shipping,
        total,
        payment_method: "cod",
        payment_status: "pending",
        fulfillment_status: "unfulfilled",
        lifecycle: "placed",
      })
      .select("id")
      .single();
    if (oe) return { ok: false, error: oe.message };

    const lines = payload.items.map((i) => ({
      order_id: order.id,
      item_id: i.itemId,
      product_name: i.productName,
      variant_title: i.variantTitle,
      sku: i.sku,
      image_url: i.imageUrl,
      price: i.price,
      quantity: i.quantity,
    }));
    const { error: ie } = await supabase.from("store_order_items").insert(lines);
    if (ie) return { ok: false, error: ie.message };

    // Decrement stock for each line (best-effort).
    for (const i of payload.items) {
      await supabase.rpc("decrement_stock", { p_item: i.itemId, p_qty: i.quantity });
    }

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
