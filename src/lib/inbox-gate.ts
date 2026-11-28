import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * A shared secret on every /api/inbox/* route, until staff login exists (security plan 1.12–1.14).
 *
 * Callers send it as the `X-Inbox-Secret` header. The live stream (EventSource can't set
 * headers) may send it as `?inbox_secret=` instead.
 *
 *   INBOX_API_SECRET unset           → nothing is checked (today's behaviour)
 *   INBOX_API_SECRET set             → calls without it are LOGGED, not refused, so we can see who
 *                                      still calls without it (step 1.12)
 *   + INBOX_API_ENFORCE=true         → calls without it get 401 (step 1.14)
 */
export function inboxGate(req: Request): Response | null {
  const secret = process.env.INBOX_API_SECRET;
  if (!secret) return null;

  const url = new URL(req.url);
  const given = req.headers.get("x-inbox-secret") ?? url.searchParams.get("inbox_secret") ?? "";
  if (same(given, secret)) return null;

  if (process.env.INBOX_API_ENFORCE === "true") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  console.warn(
    "[inbox-gate] call without the inbox secret",
    JSON.stringify({
      path: url.pathname,
      method: req.method,
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      ua: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    }),
  );
  return null;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
