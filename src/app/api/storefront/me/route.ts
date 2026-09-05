import { getAccount } from "@/app/store/auth-actions";
import { fail, ok, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in shopper's profile and recent orders. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const account = await getAccount(viewer);
  if (!account) return fail("not_found", 404);
  return ok(account);
}
