import { listPublicLives } from "@/lib/live-service";
import { publicLive } from "@/lib/live";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the app shows in its Live tab: on air now, then scheduled, then replays.
 *
 * Open to guests. A live is an advert as much as a broadcast, and requiring a
 * login to see one would hide it from exactly the people it is meant to bring
 * in. The stream key never appears here — see publicLive().
 */
export async function GET() {
  const res = await listPublicLives();
  if (!res.ok) return fail(res.error, res.error === "migration_missing" ? 503 : 400);
  return ok(res.data.map(publicLive));
}
