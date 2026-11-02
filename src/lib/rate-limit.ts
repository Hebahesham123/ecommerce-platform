import "server-only";
import { headers } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Simple fixed-window rate limits, stored in Postgres (migration 0053_rate_limits.sql).
 *
 * Fails OPEN: if the database call fails (for example the migration isn't applied yet), the request
 * is allowed. A broken limiter must never stop real customers from logging in or checking out.
 */

let warned = false;

/** Count one hit for `key`. Returns true if still within `max` hits per `windowSeconds`. */
export async function hit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await getServerSupabase().rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data !== false;
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn("[rate-limit] not enforced (is migration 0053 applied?):", (e as Error).message);
    }
    return true;
  }
}

/** Forget `key`, e.g. after a correct code. */
export async function reset(key: string): Promise<void> {
  try {
    await getServerSupabase().rpc("rate_limit_reset", { p_key: key });
  } catch {
    /* best effort */
  }
}

/** The caller's IP address, or null when it can't be told (then IP limits are skipped). */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip"))?.trim();
    return ip || null;
  } catch {
    return null;
  }
}

/**
 * The limits, in one place.
 *
 * IP limits are deliberately loose: Egyptian mobile networks put many customers behind one shared
 * IP address, so a tight IP limit would block real people. Phone limits do the real protecting.
 */
export const LIMITS = {
  /** Codes sent to one phone. */
  otpSendPerPhone: { max: 3, windowSeconds: 10 * 60 },
  /** Codes requested from one IP. */
  otpSendPerIp: { max: 20, windowSeconds: 60 * 60 },
  /** Codes sent store-wide per hour: a ceiling on the SMS/WhatsApp bill during an attack. */
  otpSendGlobal: {
    max: Number(process.env.OTP_GLOBAL_HOURLY_LIMIT) || 500,
    windowSeconds: 60 * 60,
  },
  /** Guesses at one phone's current code. After this the code is cancelled. */
  otpVerifyPerCode: { max: 5, windowSeconds: 15 * 60 },
  /** Guesses at one phone per day, across all its codes. */
  otpVerifyPerPhoneDaily: { max: 20, windowSeconds: 24 * 60 * 60 },
  /** Phone-only logins from one IP (slows down checking which numbers are customers). */
  phoneLoginPerIp: { max: 30, windowSeconds: 60 * 60 },
} as const;
