import { getAppTheme } from "@/lib/app-theme-service";
import { appPack } from "@/lib/app-theme-codegen";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The app theme, as the installed app reads it.
 *
 * The app asks for this each time it opens and applies it before drawing
 * anything, so what the merchant saves in the App theme editor reaches phones
 * that already have the app — no new build, no store update. The shape is the
 * one a downloaded project starts from (appPack), so the two cannot disagree.
 */
export async function GET() {
  try {
    return ok(appPack(await getAppTheme()));
  } catch {
    return fail("theme_unavailable", 503);
  }
}
