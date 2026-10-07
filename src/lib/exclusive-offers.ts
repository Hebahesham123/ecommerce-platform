import "server-only";
import { randomInt } from "node:crypto";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

/**
 * Codes made for one shopper.
 *
 * Each is a real row in the discounts table, so the checkout, the discounts
 * page and redemption counting treat it like any other code. It works once,
 * expires, and — when made for a known customer — only for her phone, so a
 * code that is forwarded on WhatsApp is refused for anyone else.
 */

export type PersonalOfferSpec = {
  /** "percentage" (0-100) or "fixed_amount" in EGP. */
  valueType: "percentage" | "fixed_amount";
  value: number;
  /** How long it lasts from now. */
  hours: number;
  /** A minimum order, or none. */
  minAmount?: number | null;
  /** What the discounts page calls it. */
  title: string;
};

export type PersonalOffer = { code: string; endsAt: string; label: string };

// No 0/O or 1/I: a code read aloud or copied by hand should not be guessed at.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => "BB" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export function offerLabel(spec: Pick<PersonalOfferSpec, "valueType" | "value">, ar = false): string {
  return spec.valueType === "percentage"
    ? ar
      ? `خصم ${spec.value}%`
      : `${spec.value}% off`
    : ar
      ? `خصم ${spec.value} ج.م`
      : `EGP ${spec.value} off`;
}

export function specProblem(spec: PersonalOfferSpec): string | null {
  if (!(spec.value > 0)) return "value";
  if (spec.valueType === "percentage" && spec.value > 90) return "value";
  if (!(spec.hours > 0) || spec.hours > 24 * 90) return "hours";
  if (spec.minAmount != null && spec.minAmount < 0) return "min";
  return null;
}

/** Make the code. `phone` locks it to one customer; null makes it single-use for anyone. */
export async function mintPersonalCode(
  spec: PersonalOfferSpec,
  phone: string | null,
): Promise<{ ok: true; data: PersonalOffer } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const problem = specProblem(spec);
  if (problem) return { ok: false, error: "invalid_" + problem };

  const supabase = getServerSupabase();
  const endsAt = new Date(Date.now() + spec.hours * 3600 * 1000).toISOString();
  const min = spec.minAmount && spec.minAmount > 0 ? spec.minAmount : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { error } = await supabase.from("discounts").insert({
      title: spec.title.slice(0, 120),
      method: "code",
      code,
      discount_type: "amount_off_order",
      status: "active",
      value_type: spec.valueType,
      value: spec.value,
      applies_to: "all",
      min_requirement: min ? "minimum_amount" : "none",
      min_amount: min,
      eligibility: phone ? "customers" : "all",
      eligibility_ids: phone ? [normalizePhone(phone)] : [],
      usage_limit_total: 1,
      usage_limit_once_per_customer: true,
      combine_shipping: true,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
    });
    if (!error) return { ok: true, data: { code, endsAt, label: offerLabel(spec) } };
    // A clash with an existing code: try another. Anything else is real.
    if (!/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message };
  }
  return { ok: false, error: "code_clash" };
}
