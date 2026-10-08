import { cookies } from "next/headers";
import { viewReplay } from "@/lib/live-service";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One view of a reel: sent once the viewer has let it play for two seconds.
 *
 * The viewer is the app's visitor id or the website's bb_vid cookie, and the
 * same viewer on the same reel is counted once per half hour.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let viewer = (req.headers.get("x-visitor") ?? "").trim().slice(0, 64);
  if (!viewer) {
    try {
      viewer = ((await cookies()).get("bb_vid")?.value ?? "").slice(0, 64);
    } catch {
      viewer = "";
    }
  }
  const res = await viewReplay(id, viewer);
  if (!res.ok) return fail(res.error, res.error === "migration_missing" ? 503 : 400);
  return ok({ views: res.data });
}
