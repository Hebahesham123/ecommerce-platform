import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Customer sessions for the storefront.
 *
 * The verified phone IS the account (there are no passwords), so the session
 * cookie carries the normalized phone plus an HMAC of it. Without the signature
 * anyone could edit the cookie and become any customer, so the value is only
 * trusted after the signature verifies.
 *
 * This is separate from Supabase Auth, which the admin uses — shoppers never
 * get a Supabase session.
 */

const COOKIE = "bb_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  // A dedicated secret is preferred; fall back to the service-role key so the
  // feature works without new env wiring. Both are server-only.
  const s = process.env.STORE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing STORE_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY)");
  return s;
}

function sign(phone: string): string {
  return createHmac("sha256", secret()).update(phone).digest("base64url");
}

/** Constant-time compare so a signature can't be guessed byte by byte. */
function sigMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function setSession(phone: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, `${phone}.${sign(phone)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** The signed-in phone, or null. Never trusts the cookie's contents unverified. */
export async function getSessionPhone(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const at = raw.lastIndexOf(".");
    if (at <= 0) return null;
    const phone = raw.slice(0, at);
    const sig = raw.slice(at + 1);
    if (!sigMatches(sig, sign(phone))) return null;
    return phone;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
