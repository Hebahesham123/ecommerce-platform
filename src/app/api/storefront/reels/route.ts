import { listReplays } from "@/lib/live-service";
import { publicLive } from "@/lib/live";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every replay, newest first, with what was being sold in it.
 *
 * Open to guests, like the lives themselves: a reel is an advert, and asking
 * somebody to sign in before they can watch one hides it from exactly the
 * people it exists to reach. The stream key never appears here — publicLive()
 * decides what leaves the server.
 */
export async function GET() {
  const res = await listReplays();
  if (!res.ok) return fail(res.error, res.error === "migration_missing" ? 503 : 400);
  return ok(res.data.map(publicLive));
}
