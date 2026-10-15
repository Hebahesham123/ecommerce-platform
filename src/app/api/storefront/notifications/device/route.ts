import { registerDevice } from "@/lib/app-notifications";
import { bodyOf, fail, ok, str, viewerOf } from "@/lib/api/http";
import { visitorOf } from "@/lib/notification-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * This install is here: sent on every launch, after signing in, and whenever
 * pop-ups are allowed or refused.
 *
 * Body: { pushToken?: "ExponentPushToken[…]", pushEnabled: boolean, platform: "ios" | "android" }
 * The phone it belongs to is taken from the sign-in token, never the body.
 */
export async function POST(req: Request) {
  const body = await bodyOf(req);
  const visitor = visitorOf(req, body);
  if (!visitor) return fail("no_visitor", 400);
  const res = await registerDevice({
    visitor,
    phone: viewerOf(req),
    platform: str(body.platform, 16),
    pushToken: str(body.pushToken, 200) || null,
    pushEnabled: body.pushEnabled === true,
  });
  if (!res.ok) return fail(res.error, res.error === "migration_missing" || res.error === "not_configured" ? 503 : 400);
  return ok(res.data);
}
