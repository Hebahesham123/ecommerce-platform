"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { setSession, getSessionPhone, clearSession } from "@/lib/store-session";
import { sendOtp, verifyOtp, type ActionResult } from "./actions";

/**
 * Phone-based customer accounts.
 *
 * Verification is delegated entirely to the existing n8n workflow via sendOtp /
 * verifyOtp — this module never generates or delivers a code itself. A phone
 * counts as verified when it has a row in `verified_phones`, which is exactly
 * what checkout already relies on.
 */

export type AccountOrder = {
  orderNumber: string;
  total: number;
  createdAt: string;
  lifecycle: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export type Account = {
  phone: string;
  name: string | null;
  email: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  orders: AccountOrder[];
};

async function isVerified(phone: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("verified_phones")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Step 1 of sign up: ask n8n to send a code.
 *
 * Note `sendOtp` deliberately short-circuits for numbers already in
 * verified_phones (checkout uses that to skip re-verifying returning
 * customers). On a sign-up form that would show a code screen for a code that
 * never gets sent, so an existing account is reported back instead — the caller
 * sends them to log in.
 */
export async function startSignup(
  phone: string,
  channel: "whatsapp" | "sms" = "whatsapp",
): Promise<ActionResult<{ sent: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ph = normalizePhone(phone);
  if (ph.replace(/\D/g, "").length < 12) return { ok: false, error: "invalid_phone" };

  try {
    if (await isVerified(ph)) return { ok: false, error: "already_registered" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return sendOtp(ph, channel);
}

/**
 * Step 2 of sign up: verify the code through n8n's stored code, then create the
 * account. verifyOtp marks the phone verified; the profile row is what makes it
 * an account the store can read back.
 */
export async function completeSignup(
  name: string,
  phone: string,
  code: string,
): Promise<ActionResult<{ phone: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ph = normalizePhone(phone);
  const clean = name.trim();
  if (!clean) return { ok: false, error: "missing_name" };

  const verified = await verifyOtp(ph, code, clean);
  if (!verified.ok) return { ok: false, error: verified.error };

  try {
    const supabase = getServerSupabase();
    // Never clobber a profile built up at checkout — only fill the name in.
    const { data: existing } = await supabase
      .from("store_customers")
      .select("phone,name")
      .eq("phone", ph)
      .maybeSingle();

    if (existing) {
      if (!existing.name) {
        await supabase.from("store_customers").update({ name: clean }).eq("phone", ph);
      }
    } else {
      await supabase.from("store_customers").insert({ phone: ph, name: clean });
    }

    await setSession(ph);
    return { ok: true, data: { phone: ph } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Log in with a phone number alone — no code, as specified.
 *
 * Only numbers that are already verified can sign in; anything else is reported
 * as unregistered so the caller can route into sign up.
 */
export async function loginWithPhone(
  phone: string,
): Promise<ActionResult<{ phone: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ph = normalizePhone(phone);
  if (ph.replace(/\D/g, "").length < 12) return { ok: false, error: "invalid_phone" };

  try {
    if (!(await isVerified(ph))) return { ok: false, error: "not_registered" };
    await setSession(ph);
    return { ok: true, data: { phone: ph } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function logout(): Promise<ActionResult> {
  await clearSession();
  return { ok: true, data: undefined };
}

/** The signed-in customer's profile and orders, or null when signed out. */
export async function getAccount(): Promise<Account | null> {
  if (!isSupabaseConfigured()) return null;
  const phone = await getSessionPhone();
  if (!phone) return null;

  try {
    const supabase = getServerSupabase();
    const [{ data: profile }, { data: verified }, { data: orders }] = await Promise.all([
      supabase
        .from("store_customers")
        .select("name,email,governorate,city,address")
        .eq("phone", phone)
        .maybeSingle(),
      // A phone verified at checkout has its name here and no profile row yet
      // (profiles are only written when an order is placed), so this is the
      // fallback for the name.
      supabase
        .from("verified_phones")
        .select("name")
        .eq("phone", phone)
        .maybeSingle(),
      supabase
        .from("store_orders")
        .select("order_number,total,created_at,lifecycle,payment_status,fulfillment_status")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      phone,
      name: ((profile?.name as string) || (verified?.name as string)) ?? null,
      email: (profile?.email as string) ?? null,
      governorate: (profile?.governorate as string) ?? null,
      city: (profile?.city as string) ?? null,
      address: (profile?.address as string) ?? null,
      orders: (orders ?? []).map((o) => ({
        orderNumber: String(o.order_number),
        total: Number(o.total),
        createdAt: String(o.created_at),
        lifecycle: String(o.lifecycle),
        paymentStatus: String(o.payment_status),
        fulfillmentStatus: String(o.fulfillment_status),
      })),
    };
  } catch {
    return null;
  }
}
