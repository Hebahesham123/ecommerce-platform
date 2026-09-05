import { submitGeneralRequest } from "@/app/store/requests/actions";
import { channelOf, fail, fromResult, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The "something else" enquiry, with photos or a short video.
 *
 * Multipart rather than JSON so the app can post the attachments themselves
 * instead of base64 inside a body, and so the exact same server function
 * handles it as the website's form. Signing in is optional here — a shopper
 * with a question about an order they placed as a guest still needs to be able
 * to ask it — but when a token is present the request is filed against that
 * number rather than whatever was typed in the form.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("expected_multipart");
  }

  return fromResult(
    await submitGeneralRequest(form, {
      viewerPhone: viewerOf(request),
      channel: channelOf(request),
    }),
  );
}
