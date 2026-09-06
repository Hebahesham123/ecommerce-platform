import { isPhoneVerified, sendOtp } from "@/app/store/actions";
import { bodyOf, fail, fromResult, ok, str } from "@/lib/api/http";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check a number, then — separately — send it a code.
 *
 * Two steps in one endpoint, told apart by whether you have said how to
 * deliver:
 *
 *   no `channel`  → a check. Nothing is sent.
 *       already_verified  we know this number; sign in, no code needed
 *       needs_code        new to us; ask how they want it, then call again
 *
 *   `channel`     → send it.
 *       sent              a code is on its way
 *       not_delivered     the webhook refused; do not sit on a code screen
 *
 * They are separate because the shopper picks WhatsApp or SMS, and a code that
 * goes out before they have chosen makes the choice a lie. And because the
 * three outcomes used to be one: `sendOtp` returns `sent: true` both when a
 * code went out AND when the number is already verified, in which case it
 * deliberately sends nothing — the website uses that to avoid asking a
 * returning customer to prove themselves twice. An app reading only "ok" shows
 * a code screen and waits forever for a message nobody sent, which is exactly
 * what it did.
 *
 * Delivery is still n8n's, so a number verified in the app is verified on the
 * website too.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const phone = str(body.phone, 40);
  if (!phone) return fail("missing_phone");

  const normalized = normalizePhone(phone);
  if (normalized.replace(/\D/g, "").length < 12) return fail("invalid_phone");

  // Asked before anything is sent, so a verified number is never told to wait
  // for something that was never going to arrive.
  if (await isPhoneVerified(normalized)) {
    return ok({ status: "already_verified" as const, phone: normalized });
  }

  const asked = str(body.channel, 12);
  if (!asked) return ok({ status: "needs_code" as const, phone: normalized });

  const channel = asked === "sms" ? "sms" : "whatsapp";
  const res = await sendOtp(normalized, channel);
  if (!res.ok) return fromResult(res);

  return ok({
    status: res.data.sent ? ("sent" as const) : ("not_delivered" as const),
    phone: normalized,
    channel,
  });
}
