import { sendOtp } from "@/app/store/actions";
import { bodyOf, fail, fromResult, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask for a verification code.
 *
 * Delivery is n8n's job, exactly as on the website — this never generates or
 * sends a code itself, so both surfaces verify against the same store of codes
 * and a number verified in the app is verified on the website too.
 */
export async function POST(request: Request) {
  const body = await bodyOf(request);
  const phone = str(body.phone, 40);
  if (!phone) return fail("missing_phone");
  const channel = str(body.channel, 12) === "sms" ? "sms" : "whatsapp";
  return fromResult(await sendOtp(phone, channel));
}
