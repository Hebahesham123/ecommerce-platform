import { accountFor } from "@/lib/account-service";
import { fail, ok, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in shopper's profile and recent orders. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const account = await accountFor(viewer);
  // Never 404 here: the token proves the account exists, so a null means the
  // read failed. Telling an app "no such account" would make it sign the
  // customer out over a momentary database blip.
  if (!account) return fail("account_unavailable", 503);
  return ok(account);
}
