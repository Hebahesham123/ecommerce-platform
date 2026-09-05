"use server";

import { getSessionPhone } from "@/lib/store-session";
import { submitGeneralRequestFor } from "@/lib/requests-service";
import type { ActionResult } from "../actions";

/**
 * The website's "something else" form.
 *
 * Takes no shopper argument: a Server Action's arguments come from the caller,
 * so the phone is read from the signed session cookie here and nowhere else.
 * The work is in lib/requests-service.ts, shared with the mobile API.
 */

export type { RequestAttachment } from "@/lib/requests-service";

export async function submitGeneralRequest(
  form: FormData,
): Promise<ActionResult<{ reference: string }>> {
  return submitGeneralRequestFor(await getSessionPhone(), form, "web");
}
