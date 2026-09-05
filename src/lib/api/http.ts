import "server-only";
import { NextResponse } from "next/server";
import { normalizeChannel, type Channel } from "@/lib/channel";
import { bearerOf, phoneFromToken } from "@/lib/api/token";

/**
 * The small amount of plumbing every Storefront API route shares.
 *
 * Responses are never cached: everything here is either a shopper's own data or
 * live stock, and a stale answer to either is worse than a slow one.
 */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * How each refusal the shared functions can return maps onto HTTP.
 *
 * Worth being exact about: an app decides what to do next from the status
 * alone. A 404 tells it the thing is gone, a 409 tells it to re-read and try
 * again, a 401 tells it to sign in — and getting one of those wrong is how an
 * app signs a customer out over a database blip, or hides a sold-out message
 * behind "something went wrong".
 */
const STATUS: Record<string, number> = {
  not_signed_in: 401,
  not_verified: 401,
  not_your_order: 403,
  phone_not_yours: 403,
  not_configured: 503,
  account_unavailable: 503,
  not_found: 404,
  order_not_found: 404,
  line_not_found: 404,
  replacement_not_found: 404,
  out_of_stock: 409,
  item_unavailable: 409,
  cart_changed: 409,
  replacement_out_of_stock: 409,
  already_requested: 409,
  window_expired: 409,
  nothing_returnable: 409,
  migration_missing: 503,
};

/** Turn a shared ActionResult into a response, mapping the usual refusals. */
export function fromResult<T>(
  res: { ok: true; data: T } | { ok: false; error: string },
): NextResponse {
  if (res.ok) return ok(res.data);
  return fail(res.error, STATUS[res.error] ?? 400);
}

/**
 * Which surface is calling.
 *
 * This is attribution, not authorisation — a header cannot be trusted to prove
 * anything, and nothing here grants access based on it. It decides which label
 * a row carries and which Meta dataset a purchase reports to, and defaults to
 * "app" because the website does not use this API.
 */
export function channelOf(req: Request): Channel {
  const h = req.headers.get("x-store-channel");
  return h ? normalizeChannel(h) : "app";
}

/** The signed-in shopper's phone, or null. */
export function viewerOf(req: Request): string | null {
  return phoneFromToken(bearerOf(req));
}

/** Read a JSON body without throwing on a malformed one. */
export async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max = 500): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export const int = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
