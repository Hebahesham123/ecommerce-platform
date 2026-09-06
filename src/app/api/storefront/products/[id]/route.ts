import { appCatalog, toProduct } from "@/lib/api/catalog";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One product, by variant id or by the website's handle.
 *
 * Both work because both are addresses the app will legitimately hold: a
 * variant id comes back in every cart line and order, while a handle is what a
 * menu item or a shared link points at.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail("missing_id");

  try {
    const catalog = await appCatalog();
    const byVariant = catalog.variantById.get(id);
    const product = byVariant?.product ?? catalog.productByHandle.get(id.toLowerCase());
    if (!product) return fail("not_found", 404);

    return ok({
      ...toProduct(product),
      // Which variant the caller asked for, when they asked by variant id.
      selectedVariantId: byVariant ? id : null,
    });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}
