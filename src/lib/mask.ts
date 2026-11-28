/**
 * Masking for personal data that goes into the audit log.
 *
 * admin_audit is append-only by design, so anything written there cannot be
 * taken out again. That is the point for money, and a problem for personal
 * data: Egypt's data protection law (151/2020) gives a customer the right to
 * have their data erased, and a table nobody can delete from cannot honour
 * that. So the audit records *which fields changed* and enough of the value
 * to recognise it — never the value itself.
 *
 * The readable version still exists where it is actually needed: the order's
 * timeline keeps the full before and after so the merchant can see what they
 * changed, and that table is ordinary and can be erased on request.
 *
 * Masks keep the tail rather than the head. "Which of the two numbers ending
 * 337 was it" is the question a dispute actually asks, and a leading digit of
 * an Egyptian mobile is the same for everyone.
 */

/** Keep the last `keep` characters, replace the rest with a fixed marker. */
function tail(value: string, keep: number): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= keep) return "•".repeat(v.length);
  return "•••" + v.slice(-keep);
}

/** +201064114932 → "•••932" */
export function maskPhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits ? tail(digits, 3) : "";
}

/** heba.hassan@gmail.com → "h•••@gmail.com" */
export function maskEmail(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const at = v.lastIndexOf("@");
  if (at <= 0) return tail(v, 2);
  const local = v.slice(0, at);
  const domain = v.slice(at);
  return (local[0] ?? "") + "•••" + domain;
}

/**
 * A free-text field — a name, a street. Nothing of it is kept: unlike a phone
 * there is no short tail that identifies it without being it. The length is
 * recorded instead, which distinguishes "filled in" from "cleared" and
 * "corrected a typo" from "replaced entirely" without storing a word of it.
 */
export function maskText(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  return v ? `${v.length} chars` : "";
}

export type MaskedChange = { field: string; before: string; after: string };

const MASKS: Record<string, (v: string | null | undefined) => string> = {
  phone: maskPhone,
  email: maskEmail,
};

/**
 * Turn a before/after pair into the masked record of a change, or null when
 * nothing moved. `field` is always in the clear — knowing that the address
 * changed is the useful part, and is not itself personal data.
 */
export function maskedChange(
  field: string,
  before: string | null | undefined,
  after: string | null | undefined,
): MaskedChange | null {
  const b = String(before ?? "").trim();
  const a = String(after ?? "").trim();
  if (b === a) return null;
  const mask = MASKS[field] ?? maskText;
  return { field, before: mask(b), after: mask(a) };
}
