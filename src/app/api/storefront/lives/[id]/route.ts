import { getPublicLive, recordHeartbeat } from "@/lib/live-service";
import { publicLive } from "@/lib/live";
import { bodyOf, fail, ok, str } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One live: what to play, and what is being sold on it right now. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await getPublicLive(id);
  if (!res.ok) return fail(res.error, res.error === "not_found" ? 404 : 400);
  return ok(publicLive(res.data));
}

/**
 * A watching page saying it is still here.
 *
 * The count used to be whatever a viewer claimed to see, which meant it
 * depended on Realtime presence working and never corrected itself when
 * someone left. A beat every few seconds is dull and always right: stop
 * beating and you stop being counted.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await bodyOf(req);
  await recordHeartbeat(id, str(body.key, 64));
  return ok({ beat: true });
}
