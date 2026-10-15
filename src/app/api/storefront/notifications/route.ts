import { inboxFor } from "@/lib/app-notifications";
import { fail, int, ok } from "@/lib/api/http";
import { visitorOf } from "@/lib/notification-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bell: this install's notifications, newest first, and how many are
 * unread (the dot). ?limit= up to 100, 50 by default.
 */
export async function GET(req: Request) {
  const visitor = visitorOf(req);
  if (!visitor) return fail("no_visitor", 400);
  const limit = int(new URL(req.url).searchParams.get("limit"), 50);
  const res = await inboxFor(visitor, limit);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" || res.error === "not_configured" ? 503 : 400);
  return ok(res.data);
}
