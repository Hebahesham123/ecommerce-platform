import { appMenus } from "@/lib/api/catalog";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One menu by handle — usually `main-menu` or `footer`. */
export async function GET(_request: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  if (!handle) return fail("missing_handle");

  try {
    const menus = await appMenus();
    const found = menus.find((m) => m.handle.toLowerCase() === handle.toLowerCase());
    if (!found) return fail("not_found", 404);
    return ok(found);
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
