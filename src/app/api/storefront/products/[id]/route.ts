import { getStoreProduct } from "@/app/store/actions";
import { fail, fromResult } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One product, with every variant and its live availability. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail("missing_id");
  return fromResult(await getStoreProduct(id));
}
