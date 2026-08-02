import {
  handleStorefrontGet,
  handleStorefrontPost,
  type MountConfig,
} from "@/lib/storefront-handler";

export const dynamic = "force-dynamic";

/**
 * Admin theme preview. Serves the whole storefront (home, collections,
 * products, search, cart) for ONE theme — published or not — wired to the same
 * live products/inventory/collections as the public shop.
 */
async function config(params: Promise<{ id: string }>): Promise<MountConfig> {
  const { id } = await params;
  return { themeId: id, mount: `/online-store/themes/${id}/preview` };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleStorefrontGet(req, await config(ctx.params));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleStorefrontPost(req, await config(ctx.params));
}
