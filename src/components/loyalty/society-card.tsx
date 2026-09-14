import Link from "next/link";
import { getMyLoyalty } from "@/app/store/loyalty-actions";

/**
 * Compact Beauty Bar Society summary for the account / home screen. Reads the
 * signed-in shopper's real loyalty state and links into the full Society hub.
 * Renders nothing when the program isn't available (e.g. migration not run) so
 * it can be dropped anywhere safely.
 */
export default async function SocietyCard() {
  const res = await getMyLoyalty();
  if (!res.ok) return null;
  const d = res.data;
  const p = d.progress;
  const vaultReady = d.primaryVault?.status === "ready_to_open" && !d.primaryVault.locked;

  return (
    <Link
      href="/store/society"
      className="block overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b2119] to-[#43301f] p-5 text-[#f0e6d8] transition-transform hover:scale-[1.01]"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.25em] text-[#c9b79f]">YOUR SOCIETY</div>
        <div className="text-sm">✦</div>
      </div>
      <div className="mt-1 font-serif text-xl">{p.currentLevelName}</div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-3xl font-bold">{new Intl.NumberFormat("en-US").format(d.user.signatureBalance)}</div>
        <div className="pb-1 text-xs text-[#c9b79f]">signatures</div>
      </div>

      {p.nextLevel ? (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#e0b877]" style={{ width: `${p.percentage}%` }} />
          </div>
          <div className="mt-2 text-xs text-[#c9b79f]">
            {new Intl.NumberFormat("en-US").format(p.remaining ?? 0)} until {p.nextLevelName}
          </div>
        </>
      ) : (
        <div className="mt-3 text-xs text-[#c9b79f]">You&apos;ve reached the highest level.</div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#e0b877]">
          {vaultReady ? "🎁 Your vault is ready — open now" : "View Society"} →
        </span>
      </div>
    </Link>
  );
}
