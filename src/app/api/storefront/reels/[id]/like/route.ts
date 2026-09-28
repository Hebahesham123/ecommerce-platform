import { likeReplay } from "@/lib/live-service";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One more like on a replay.
 *
 * No sign-in: the like is the smallest thing a viewer can do and asking her to
 * identify herself first would cost more than the gesture is worth. The browser
 * remembers its own taps so it does not send a second; the shop only ever
 * learns the total.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await likeReplay(id, 1);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" ? 503 : 400);
  return ok({ likes: res.data });
}

/** And taking it back, because a heart that cannot be un-tapped is a trap. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await likeReplay(id, -1);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" ? 503 : 400);
  return ok({ likes: res.data });
}
