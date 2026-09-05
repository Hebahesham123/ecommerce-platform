import "server-only";
import { cookies } from "next/headers";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { slotLabel, isBirthday } from "@/lib/offers";
import { normalizePhone } from "@/lib/phone";
import {
  redeemDiscount,
  validateDiscount,
  type DiscountLine,
} from "@/lib/discount-engine";
import { recordNudgeConversion } from "@/lib/nudge-service";
import { sendOrderPurchase } from "@/lib/meta-purchase";
import type { Channel } from "@/lib/channel";
import { repriceLines } from "@/lib/cart-pricing";

/**
 * Placing an order — the one path, whichever surface asked.
 *
 * This used to live inside the storefront's server action, which meant a mobile
 * app could not reach it and would have needed its own copy. Two copies of
 * checkout is two copies of the pricing rules, the stock reservation, the
 * discount redemption and the ad attribution, drifting apart from the day they
 * are written — and the one place a store cannot afford drift is the till.
 *
 * So the web action and the API are both thin wrappers over this. All either
 * decides is who is asking and from where.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

type Row = Record<string, unknown>;

const ORDER_RELAY_WEBHOOK_URL =
  process.env.ORDER_RELAY_WEBHOOK_URL ||
  "https://n8n.srv1155688.hstgr.cloud/webhook/order-relay";

/**
 * Is today verifiably this customer's birthday?
 *
 * Only asked when the BIRTHDAY code is in play, and only ever answered from
 * the date saved on their profile. A date typed at checkout is a claim, not a
 * fact — honouring it would make the code "20% off, type any date", every day,
 * for anyone.
 */
export async function isBirthdayFor(
  supabase: ReturnType<typeof getServerSupabase>,
  phone: string,
  code: string | null | undefined,
): Promise<boolean> {
  if ((code || "").trim().toUpperCase() !== "BIRTHDAY") return false;
  const { data } = await supabase
    .from("store_customers")
    .select("birthday")
    .eq("phone", phone)
    .maybeSingle();
  return isBirthday(data?.birthday ? String(data.birthday) : null, new Date());
}

/**
 * Forward the order to n8n, which creates a draft order on the supplier's
 * Shopify store and emails the customer a checkout link. Never throws — a relay
 * problem must not fail an order that already succeeded here.
 */
async function fireOrderRelay(
  supabase: ReturnType<typeof getServerSupabase>,
  orderNumber: string,
  payload: OrderPayload,
  phone: string,
  email: string | null,
  total: number,
  channel: Channel,
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
        channel,
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

export type PlaceOrderOptions = {
  /** Which surface is asking. Recorded on the order and used for ad attribution. */
  channel: Channel;
  /**
   * The shopper this caller has already authenticated, if any — a session
   * cookie on the web, a bearer token in the app. Never taken from the payload.
   */
  viewerPhone: string | null;
};

export async function placeOrderCore(
  payload: OrderPayload,
  opts: PlaceOrderOptions,
): Promise<ActionResult<{ orderNumber: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!payload.items.length) return { ok: false, error: "empty_cart" };

  try {
    const supabase = getServerSupabase();
    const ph = normalizePhone(payload.phone);

    // Verification is enforced here, not by the caller. Being signed in as this
    // number counts: that credential was only ever issued to a shopper we had
    // already recognised, so demanding a code again would be asking twice.
    const { data: verified } = await supabase
      .from("verified_phones")
      .select("phone")
      .eq("phone", ph)
      .maybeSingle();
    if (!verified && opts.viewerPhone !== ph) return { ok: false, error: "not_verified" };

    // Prices come from the database, never from the caller. The website's cart
    // lives in localStorage and the app's lives on a phone; both are editable
    // by whoever holds them, so neither gets to name a price.
    const repriced = await repriceLines(payload.items);
    if (!repriced.ok) return { ok: false, error: repriced.error };
    const items = repriced.lines;

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = 0;

    // Price any coupon server-side — never trust a client for pricing. Reads
    // the merchant's own discounts table first, then the legacy built-ins.
    const isBday = await isBirthdayFor(supabase, ph, payload.couponCode);
    const lines: DiscountLine[] = items.map((i) => ({
      itemId: i.itemId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
    }));
    const verdict = await validateDiscount(payload.couponCode, {
      subtotal,
      items: lines,
      phone: ph,
      birthday: isBday,
    });
    const discount = verdict.ok ? verdict.amount : 0;
    const discountCode = verdict.ok ? verdict.code : null;
    const total = Math.max(0, subtotal - discount + shipping);
    const orderNumber = "BB" + Date.now().toString().slice(-8);

    // Delivery schedule, gift options and the coupon fold into the merchant
    // note — all of it captured without a schema change.
    const noteParts: string[] = [];
    if (payload.note?.trim()) noteParts.push(payload.note.trim());
    if (payload.deliverySpeed === "scheduled" && payload.deliveryDate) {
      const slot = slotLabel(payload.deliverySlot, "ar");
      noteParts.push(`التوصيل: ${payload.deliveryDate}${slot ? ` (${slot})` : ""}`);
    } else {
      noteParts.push("التوصيل: قياسي (٢–٤ أيام)");
    }
    if (payload.giftWrap) {
      noteParts.push(
        `تغليف هدية${payload.giftMessage?.trim() ? `: "${payload.giftMessage.trim()}"` : ""}`,
      );
    }
    if (discountCode && discount > 0) noteParts.push(`كوبون ${discountCode} (−${discount})`);
    const composedNote = noteParts.join(" | ") || null;

    // The single stock gate. Both channels reach the shelf through this one
    // transaction, which locks each item's levels and rolls the whole order
    // back if any line is short — so an app buyer and a web buyer contend for
    // the last unit properly instead of both getting it.
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
      p_items: items.map((i) => ({
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

    // Channel and discount are stamped after the fact so the stock function's
    // signature stays the one thing that never changes.
    const patch: Row = { channel: opts.channel };
    if (discountCode && discount > 0) {
      patch.discount_code = discountCode;
      patch.discount_amount = discount;
    }
    const { error: stampErr } = await supabase
      .from("store_orders")
      .update(patch)
      .eq("order_number", orderNumber);
    // The order is placed and the stock is reserved — this is only the label,
    // so it must never fail the sale. But an app order silently filed as a web
    // one is a lie the dashboard has no way to notice, so say so in the log.
    if (stampErr) {
      console.error(
        `[orders] ${orderNumber}: could not stamp channel/discount — ${stampErr.message}. ` +
          "Run supabase/migrations/0019 and 0022.",
      );
    }
    if (discountCode && discount > 0 && verdict.ok && verdict.source === "table") {
      await redeemDiscount(discountCode);
    }

    // The passwordless profile, so a returning shopper is autofilled next time
    // on whichever surface they come back through.
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

    let relayEmail = emailIn;
    if (!relayEmail) {
      const { data: prof } = await supabase
        .from("store_customers")
        .select("email")
        .eq("phone", ph)
        .maybeSingle();
      relayEmail = (prof?.email as string) ?? null;
    }

    // Tell Meta, using whichever dataset belongs to this channel.
    await sendOrderPurchase({
      orderNumber,
      total,
      phone: ph,
      email: relayEmail,
      customerName: payload.customerName,
      city: payload.city,
      channel: opts.channel,
      contentIds: [...new Set(payload.items.map((i) => i.sku || i.itemId))],
      numItems: payload.items.reduce((n, i) => n + i.quantity, 0),
    });

    // Close the loop on the hesitation popup. Web only: the visitor cookie it
    // keys on is written by the storefront's own script.
    if (opts.channel === "web") {
      try {
        const visitorId = (await cookies()).get("bb_vid")?.value ?? null;
        await recordNudgeConversion({ visitorId, code: discountCode, orderNumber, orderTotal: total });
      } catch {
        /* attribution is never worth failing an order over */
      }
    }

    await fireOrderRelay(supabase, orderNumber, payload, ph, relayEmail, total, opts.channel);

    return { ok: true, data: { orderNumber } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
