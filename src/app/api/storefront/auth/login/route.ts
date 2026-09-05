import { loginWithPhone } from "@/app/store/auth-actions";
import { issueToken } from "@/lib/api/token";
import { bodyOf, fail, fromResult, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in a number the store already knows, no code required.
 *
 * This mirrors the website's login exactly — including the fact that a shopper
 * with orders on file counts as known even if they predate the code flow.
 * Unknown numbers come back as `not_registered` so the app can route them into
 * sign-up rather than a dead end.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const phone = str(body.phone, 40);
  if (!phone) return fail("missing_phone");

  const res = await loginWithPhone(phone);
  if (!res.ok) return fromResult(res);

  return ok({ token: issueToken(res.data.phone), phone: res.data.phone });
}
