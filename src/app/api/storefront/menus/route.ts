import { appMenus } from "@/lib/api/catalog";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every menu the merchant built in Navigation.
 *
 * Each item carries a target rather than a path — `{type:"collection",
 * handle:"bags"}` instead of `/collections/bags` — because an app routes to
 * screens, and asking it to parse the website's URLs would mean two places
 * that have to agree about what a URL means.
 */
export async function GET() {
  try {
    return ok({ menus: await appMenus() });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
