import { markOpened } from "@/lib/app-notifications";
import { bodyOf, fail, ok } from "@/lib/api/http";
import { visitorOf } from "@/lib/notification-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A notification was tapped, in the bell or on the lock screen. Counted once per install. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await bodyOf(req);
  const visitor = visitorOf(req, body);
  if (!visitor) return fail("no_visitor", 400);
  const res = await markOpened(id, visitor);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" || res.error === "not_configured" ? 503 : 400);
  return ok(res.data);
}
