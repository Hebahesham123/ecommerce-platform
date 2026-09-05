import { verifyOtp } from "@/app/store/actions";
import { issueToken } from "@/lib/api/token";
import { bodyOf, fail, fromResult, ok, str } from "@/lib/api/http";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check a code and hand back a bearer token.
 *
 * The token is only minted after `verifyOtp` succeeds, so it can only ever be
 * issued for a number whose owner just proved they hold it. Note that
 * `verifyOtp` also writes the website's session cookie; that is harmless here
 * and means a webview inside the app is signed in as well.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const phone = str(body.phone, 40);
  const code = str(body.code, 12);
  const name = str(body.name, 120) || undefined;
  if (!phone) return fail("missing_phone");
  if (!code) return fail("missing_code");

  const res = await verifyOtp(phone, code, name);
  if (!res.ok) return fromResult(res);

  const normalized = normalizePhone(phone);
  return ok({ token: issueToken(normalized), phone: normalized });
}
