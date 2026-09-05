"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { setSession, getSessionPhone, clearSession } from "@/lib/store-session";
import { sendOtp, verifyOtp, type ActionResult } from "./actions";
import { accountFor, type Account } from "@/lib/account-service";

export type { AccountOrder, Account } from "@/lib/account-service";

/**
 * Phone-based customer accounts.
 *
 * Verification is delegated entirely to the existing n8n workflow via sendOtp /
 * verifyOtp — this module never generates or delivers a code itself. A phone
 * counts as verified when it has a row in `verified_phones`, which is exactly
 * what checkout already relies on.
 */

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
 * Whether this number is a customer we already have, verified or not.
 *
 * `verified_phones` only holds numbers that went through the code flow on this
 * app, so it misses everyone who ordered before it existed or whose row was
 * written under the old unnormalized phone format. Those shoppers are in the
 * database in every sense that matters — they have orders — and telling them
 * to "create an account" is telling them they're a stranger.
 */
async function isKnownCustomer(phone: string): Promise<boolean> {
  if (await isVerified(phone)) return true;
  const supabase = getServerSupabase();
  const variants = phoneVariants(phone);
  const [{ data: order }, { data: profile }] = await Promise.all([
    supabase.from("store_orders").select("phone").in("phone", variants).limit(1),
    supabase.from("store_customers").select("phone").in("phone", variants).limit(1),
  ]);
  return Boolean(order?.length) || Boolean(profile?.length);
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
    if (await isKnownCustomer(ph)) return { ok: false, error: "already_registered" };
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
 * Any number we already have counts, not just ones carrying a verified_phones
 * row: a customer with orders on file is not a new sign-up. Genuinely unknown
 * numbers are still reported back so the caller can route into sign up.
 */
export async function loginWithPhone(
  phone: string,
): Promise<ActionResult<{ phone: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const ph = normalizePhone(phone);
  if (ph.replace(/\D/g, "").length < 12) return { ok: false, error: "invalid_phone" };

  try {
    if (!(await isKnownCustomer(ph))) return { ok: false, error: "not_registered" };
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
  return accountFor(await getSessionPhone());
}
