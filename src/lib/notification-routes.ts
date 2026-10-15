import "server-only";

/**
 * The install a storefront call comes from: the app's visitor id, sent on
 * every request as the x-visitor header (or in the body by older builds).
 */
export function visitorOf(req: Request, body?: Record<string, unknown>): string {
  const header = (req.headers.get("x-visitor") ?? "").trim();
  const fromBody = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  return (header || fromBody).slice(0, 64);
}
