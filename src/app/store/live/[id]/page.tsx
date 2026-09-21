import Link from "next/link";
import { getPublicLive } from "@/lib/live-service";
import { watchable } from "@/lib/live";
import { Watch } from "./watch";

// Stock, the pinned product and the status all change while the page is open.
export const dynamic = "force-dynamic";

/**
 * The page a shared live link opens.
 *
 * Viewers can comment, add to cart and share — never join the broadcast — so
 * this needs no camera, no microphone and no sign-in, and opens on a tap from
 * WhatsApp like any other link.
 */
export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getPublicLive(id);

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-bold text-ink">Live not found</h1>
        <p className="mt-2 text-sm text-ink-muted">This live may have been removed.</p>
        <Link href="/shop" className="btn-primary mt-6 inline-flex px-5 py-2.5">
          Continue shopping
        </Link>
      </div>
    );
  }

  // The stream key lives on the same row as the playback URL, so what reaches
  // the browser is the named public shape rather than the row itself.
  return <Watch live={watchable(res.data)} />;
}
