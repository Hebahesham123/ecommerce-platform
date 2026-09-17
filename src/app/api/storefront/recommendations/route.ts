import { recommendationsFor } from "@/lib/recommendations";
import { ok, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What goes with what this shopper already bought - the "Complete your look"
 * section.
 *
 * A guest is not an error here: the answer for someone with no history is
 * simply nothing to show, and the app hides the section on an empty list. A
 * 401 would make every guest's home log a failure it has no reason to.
 */
export async function GET(request: Request) {
  return ok(await recommendationsFor(viewerOf(request)));
}
