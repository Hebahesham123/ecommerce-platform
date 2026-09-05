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

/** Turn a shared ActionResult into a response, mapping the usual refusals. */
export function fromResult<T>(
  res: { ok: true; data: T } | { ok: false; error: string },
): NextResponse {
  if (res.ok) return ok(res.data);
  const status =
    res.error === "not_signed_in" || res.error === "not_verified"
      ? 401
      : res.error === "not_your_order" || res.error === "not_configured"
        ? 403
        : res.error === "order_not_found" || res.error === "not_found"
          ? 404
          : res.error === "out_of_stock" || res.error === "window_expired"
            ? 409
            : 400;
  return fail(res.error, status);
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
