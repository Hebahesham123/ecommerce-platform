import { getAppTheme } from "@/lib/app-theme-service";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How the app should look and what its home screen is made of.
 *
 * Read at launch, before anyone signs in — none of it is private, it is the
 * shop's own branding. It is also returned inside /home so a cold start is one
 * request rather than two.
 */
export async function GET() {
  try {
    return ok(await getAppTheme());
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
