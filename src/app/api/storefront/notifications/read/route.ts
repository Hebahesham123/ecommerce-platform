import { markRead } from "@/lib/app-notifications";
import { bodyOf, fail, ok } from "@/lib/api/http";
import { visitorOf } from "@/lib/notification-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Notifications seen: { ids: [...] } for some, or {} for everything in the
 * bell (opening it). Answers with what is still unread.
 */
export async function POST(req: Request) {
  const body = await bodyOf(req);
  const visitor = visitorOf(req, body);
  if (!visitor) return fail("no_visitor", 400);
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : "all";
  const res = await markRead(visitor, ids);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" || res.error === "not_configured" ? 503 : 400);
  return ok(res.data);
}
