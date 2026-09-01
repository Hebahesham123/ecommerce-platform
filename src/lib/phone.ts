/**
 * Normalize any Egyptian phone to the same international form n8n stores,
 * e.g. "01027546062", "201027546062", "+20 102 754 6062" → "+201027546062".
 *
 * Every table keyed by phone (verified_phones, otp_codes, store_customers,
 * store_orders) stores this form, so auth and checkout must agree exactly —
 * hence one shared copy rather than one per caller.
 */
export function normalizePhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return "+20" + d;
}

/** A phone is usable once it carries at least 10 digits. */
export function isPhoneComplete(p: string): boolean {
  return normalizePhone(p).replace(/\D/g, "").length >= 12;
}

/**
 * Every spelling of the same number, for looking up rows written before
 * normalization was shared — store_orders still holds values like
 * "01027546062" alongside "+201027546062", and a customer whose history is
 * only findable under the old spelling would look like a stranger.
 */
export function phoneVariants(p: string): string[] {
  const intl = normalizePhone(p); // +201027546062
  const digits = intl.slice(1); //  201027546062
  const local = `0${digits.slice(2)}`; // 01027546062
  return [...new Set([intl, digits, local])];
}
