"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";
import { createPaymobIntention, getPaymobConfig } from "@/lib/paymob-server";
import { paymobReady, type PaymobConfig } from "@/lib/paymob";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

/** The Paymob keys for the settings form, plus whether they're complete. */
export async function getPaymentIntegration(): Promise<ActionResult<{ config: PaymobConfig; ready: boolean }>> {
  try {
    const config = await getPaymobConfig();
    return { ok: true, data: { config, ready: paymobReady(config) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Save the Paymob keys into the shared settings row. */
export async function savePaymentIntegration(config: PaymobConfig): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase.from("store_settings").select("data").eq("id", "default").maybeSingle();
    const current = (row?.data as Record<string, unknown>) ?? {};
    const merged = {
      ...current,
      paymob: {
        enabled: config.enabled === true,
        secretKey: config.secretKey.trim(),
        publicKey: config.publicKey.trim(),
        integrationId: config.integrationId.trim(),
        hmacSecret: config.hmacSecret.trim(),
      },
    };
    const { error } = await supabase.from("store_settings").upsert({ id: "default", data: merged }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/payments");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Start a Paymob card checkout for an order's outstanding balance and hand back
 * the Unified Checkout URL. The admin opens it (or sends it to the customer);
 * the webhook records the payment when it clears.
 */
export async function createPaymobCheckout(orderNumber: string): Promise<ActionResult<{ url: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("order_number,customer_name,phone,address,city,governorate,total,amount_paid")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!order) return { ok: false, error: "order_not_found" };

    const balance = Math.max(0, n(order.total) - n(order.amount_paid));
    if (balance <= 0) return { ok: false, error: "invalid_amount" };

    let email = "";
    try {
      const { data: cust } = await supabase.from("store_customers").select("email").in("phone", phoneVariants(s(order.phone))).maybeSingle();
      email = s(cust?.email);
    } catch {
      /* no profile — Paymob accepts a placeholder */
    }

    const specialReference = `${orderNumber}-${Date.now()}`;
    await supabase.from("paymob_payments").insert({ special_reference: specialReference, order_number: orderNumber, amount: balance, status: "pending" });

    const intention = await createPaymobIntention({
      amountEGP: balance,
      orderNumber,
      specialReference,
      customer: {
        name: s(order.customer_name),
        email,
        phone: s(order.phone),
        address: s(order.address),
        city: s(order.city),
        governorate: s(order.governorate),
      },
    });
    if (!intention.ok) {
      await supabase.from("paymob_payments").delete().eq("special_reference", specialReference);
      return { ok: false, error: intention.error };
    }
    return { ok: true, data: { url: intention.url } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
