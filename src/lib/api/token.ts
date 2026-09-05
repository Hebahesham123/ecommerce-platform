import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bearer tokens for the Storefront API.
 *
 * The website authenticates with an HMAC-signed cookie; an app has no cookie
 * jar, so it carries the same claim as an Authorization header instead. The
 * claim is identical — "this request belongs to this verified phone number" —
 * and so is the trust model: the value is only believed after the signature
 * verifies, so nobody can edit a token and become another customer.
 *
 * These carry an issue time and expire on the same 30-day clock as the web
 * session cookie. A token is not a stronger credential than the cookie — it is
 * the same claim in a different envelope — so it must not outlive one.
 */

const VERSION = "v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, same as the web session

function secret(): string {
  const s = process.env.STORE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing STORE_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY)");
  return s;
}

const b64 = (v: string) => Buffer.from(v, "utf8").toString("base64url");
const unb64 = (v: string) => Buffer.from(v, "base64url").toString("utf8");

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Constant-time compare, so a signature can't be guessed byte by byte. */
function matches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Mint a token for a phone we have just verified. */
export function issueToken(phone: string): string {
  const body = `${VERSION}.${b64(phone)}.${Date.now().toString(36)}`;
  return `${body}.${sign(body)}`;
}

/** The phone a token proves, or null. Never trusts the payload unverified. */
export function phoneFromToken(token: string | null | undefined): string | null {
  try {
    const raw = String(token ?? "").trim();
    if (!raw) return null;
    const parts = raw.split(".");
    if (parts.length !== 4) return null;
    const [version, phoneB64, issued, sig] = parts;
    if (version !== VERSION) return null;

    const body = `${version}.${phoneB64}.${issued}`;
    if (!matches(sig, sign(body))) return null;

    const at = parseInt(issued, 36);
    if (!Number.isFinite(at) || Date.now() - at > MAX_AGE_MS) return null;

    return unb64(phoneB64);
  } catch {
    return null;
  }
}

/** Pull a bearer token out of a request's Authorization header. */
export function bearerOf(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}
