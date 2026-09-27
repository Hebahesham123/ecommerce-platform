import "server-only";

import crypto from "crypto";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  EMPTY_PAYMOB,
  PAYMOB_INTENTION_URL,
  paymobCheckoutUrl,
  paymobFrom,
  type PaymobConfig,
} from "./paymob";

/**
 * Server side of Paymob: read the merchant's keys, open an intention, and
 * verify the webhook signature. Keys come from the Settings row first
 * (store_settings.data.paymob, entered on the Payment integration screen) and
 * fall back to env (PAYMOB_SECRET_KEY / PAYMOB_PUBLIC_KEY / PAYMOB_INTEGRATION_ID
 * / PAYMOB_HMAC).
 */

const s = (v: unknown): string => (v == null ? "" : String(v));

export async function getPaymobConfig(): Promise<PaymobConfig> {
  let cfg: PaymobConfig = { ...EMPTY_PAYMOB };
  if (isSupabaseConfigured()) {
    try {
      const { data } = await getServerSupabase()
        .from("store_settings")
        .select("data")
        .eq("id", "default")
        .maybeSingle();
      cfg = paymobFrom((data?.data as Record<string, unknown>)?.paymob);
    } catch {
      /* fall through to env */
    }
  }
  const env = process.env;
  return {
    enabled: cfg.enabled || env.PAYMOB_ENABLED === "true",
    secretKey: cfg.secretKey || env.PAYMOB_SECRET_KEY || "",
    publicKey: cfg.publicKey || env.PAYMOB_PUBLIC_KEY || "",
    integrationId: cfg.integrationId || env.PAYMOB_INTEGRATION_ID || "",
    hmacSecret: cfg.hmacSecret || env.PAYMOB_HMAC || "",
  };
}

export type IntentionInput = {
  amountEGP: number;
  orderNumber: string;
  specialReference: string;
  customer: { name: string; email: string; phone: string; address?: string; city?: string; governorate?: string };
  items?: { name: string; amount: number; quantity: number }[];
};

/** Open a Paymob intention and return the Unified Checkout URL to send the shopper to. */
export async function createPaymobIntention(
  input: IntentionInput,
): Promise<{ ok: true; url: string; clientSecret: string } | { ok: false; error: string }> {
  const cfg = await getPaymobConfig();
  if (!cfg.secretKey || !cfg.publicKey || !cfg.integrationId) return { ok: false, error: "paymob_not_configured" };
  const cents = Math.round(input.amountEGP * 100);
  if (cents <= 0) return { ok: false, error: "invalid_amount" };

  const parts = (input.customer.name || "Customer").trim().split(/\s+/);
  const billing = {
    first_name: parts[0] || "Customer",
    last_name: parts.slice(1).join(" ") || "-",
    email: input.customer.email || "na@example.com",
    phone_number: input.customer.phone || "+20000000000",
    street: input.customer.address || "NA",
    city: input.customer.city || "NA",
    state: input.customer.governorate || "NA",
    country: "EG",
    apartment: "NA",
    building: "NA",
    floor: "NA",
    postal_code: "NA",
    shipping_method: "NA",
  };

  const items = (input.items?.length ? input.items : [{ name: `Order ${input.orderNumber}`, amount: input.amountEGP, quantity: 1 }]).map((i) => ({
    name: i.name.slice(0, 50),
    amount: Math.round(i.amount * 100),
    quantity: Math.max(1, Math.round(i.quantity)),
    description: i.name.slice(0, 100),
  }));

  try {
    const res = await fetch(PAYMOB_INTENTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Token ${cfg.secretKey}` },
      body: JSON.stringify({
        amount: cents,
        currency: "EGP",
        payment_methods: [Number(cfg.integrationId)],
        items,
        billing_data: billing,
        special_reference: input.specialReference,
        extras: { order_number: input.orderNumber },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: s(json.message || json.detail) || `paymob_http_${res.status}` };
    }
    const clientSecret = s(json.client_secret);
    if (!clientSecret) return { ok: false, error: "paymob_no_client_secret" };
    return { ok: true, url: paymobCheckoutUrl(cfg.publicKey, clientSecret), clientSecret };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// The exact field order Paymob concatenates before signing a transaction
// callback. Nested paths are read from the `obj`.
const HMAC_PATHS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
  "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
  "is_standalone_payment", "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

function at(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

/** True when the webhook's `hmac` matches a signature we compute over `obj`. */
export function verifyPaymobHmac(obj: Record<string, unknown>, received: string, secret: string): boolean {
  if (!received || !secret) return false;
  const concat = HMAC_PATHS.map((p) => {
    const v = at(obj, p);
    return v === undefined || v === null ? "" : String(v);
  }).join("");
  const digest = crypto.createHmac("sha512", secret).update(concat).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(received.toLowerCase()));
  } catch {
    return false;
  }
}
