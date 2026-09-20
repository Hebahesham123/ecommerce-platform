import { listMessages, postMessage } from "@/lib/live-service";
import { fromResult, bodyOf, str, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chat.
 *
 * Reading is here for the first paint and for a replay; while a stream is on
 * air the app subscribes to the rows over Supabase Realtime instead, because
 * 300 phones polling this route would be 150 requests a second for an hour.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return fromResult(await listMessages(id));
}

/** Posting always goes through the server: it is moderated and rate-limited. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await bodyOf(req);
  return fromResult(
    await postMessage({
      liveId: id,
      authorName: str(body.authorName, 60) || "Guest",
      body: str(body.body, 240),
      phone: viewerOf(req),
    }),
  );
}
