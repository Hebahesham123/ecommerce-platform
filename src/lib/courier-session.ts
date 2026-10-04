import "server-only";
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Courier sessions for the courier portal.
 *
 * A courier logs in with their phone + a PIN. The session cookie carries the
 * courier's id plus an HMAC of it, so the value is only trusted once the
 * signature verifies — the same shape as the shopper session, kept separate
 * (its own cookie) so a courier is never mistaken for a customer or an admin.
 */

const COOKIE = "bb_courier";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  const s = process.env.STORE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing STORE_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY)");
  return s;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(`courier:${id}`).digest("base64url");
}

function sigMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function setCourierSession(courierId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, `${courierId}.${sign(courierId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** The signed-in courier id, or null. Never trusts the cookie unverified. */
export async function getCourierId(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const at = raw.lastIndexOf(".");
    if (at <= 0) return null;
    const id = raw.slice(0, at);
    const sig = raw.slice(at + 1);
    if (!sigMatches(sig, sign(id))) return null;
    return id;
  } catch {
    return null;
  }
}

export async function clearCourierSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}

// ---- PIN hashing (scrypt, salted) -------------------------------------------
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const test = scryptSync(pin, salt, 32).toString("hex");
    return timingSafeEqual(Buffer.from(test, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
