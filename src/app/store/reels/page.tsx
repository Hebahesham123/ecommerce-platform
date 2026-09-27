import Link from "next/link";
import { listReplays } from "@/lib/live-service";
import { watchable } from "@/lib/live";
import { Reels } from "./reels";

// Stock and the list of replays both move while the page is open.
export const dynamic = "force-dynamic";

/**
 * Every live that was kept, as one feed.
 *
 * A live sells for an hour and then stops. The recording is the same hour with
 * the same things held up in it, and it goes on being watchable — so the
 * replays are gathered here and each one keeps the products that belonged to
 * it. Somebody who missed the live can still buy from it.
 */
export default async function ReelsPage() {
  const res = await listReplays();
  const reels = res.ok ? res.data.map(watchable) : [];

  if (!reels.length) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-ink">
          Nothing to watch yet
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Recordings of our lives show up here once a live has ended.
        </p>
        <Link href="/shop" className="btn-primary mt-6 inline-flex px-5 py-2.5">
          Continue shopping
        </Link>
      </div>
    );
  }

  // The stream key sits on the same row as the recording, so what reaches the
  // browser is the named public shape rather than the row itself.
  return <Reels reels={reels} />;
}
