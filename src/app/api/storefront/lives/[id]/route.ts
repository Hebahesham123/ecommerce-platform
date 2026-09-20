import { getLive, reportViewers } from "@/lib/live-service";
import { publicLive } from "@/lib/live";
import { bodyOf, fail, int, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One live: what to play, and what is being sold on it right now. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await getLive(id);
  if (!res.ok) return fail(res.error, res.error === "not_found" ? 404 : 400);
  return ok(publicLive(res.data));
}

/**
 * The app reporting how many it can see watching.
 *
 * Viewer count comes from the chat channel's presence, which only the clients
 * can observe — the server never sees a connection per viewer. Each app sends
 * the number it sees; the highest one sticks. Wrong by a little, free, and it
 * costs the merchant nothing to be told roughly how big the room was.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await bodyOf(req);
  await reportViewers(id, int(body.viewers, 0));
  return ok({ recorded: true });
}
