import Link from "next/link";
import { getMyLoyalty } from "@/app/store/loyalty-actions";
import { getLoyaltyTheme } from "@/lib/loyalty/theme-service";
import { loyaltyVars } from "@/lib/loyalty/theme";

/**
 * Compact Beauty Bar Society summary for the account / home screen. Reads the
 * signed-in shopper's real loyalty state and links into the full Society hub.
 * Renders nothing when the program isn't available (e.g. migration not run) so
 * it can be dropped anywhere safely.
 */
export default async function SocietyCard() {
  const res = await getMyLoyalty();
  if (!res.ok) return null;
  const theme = await getLoyaltyTheme();
  const w = theme.words;
  const d = res.data;
  const p = d.progress;
  const vaultReady = d.primaryVault?.status === "ready_to_open" && !d.primaryVault.locked;

  return (
    <Link
      href="/store/society"
      className="block overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-5 text-[var(--ls-on-deep)] transition-transform hover:scale-[1.01]"
      style={loyaltyVars(theme) as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.25em] text-[var(--ls-on-deep-soft)]">{w.cardKicker}</div>
        <div className="text-sm">{w.glyph}</div>
      </div>
      <div className="mt-1 font-serif text-xl">{p.currentLevelName}</div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-3xl font-bold">{new Intl.NumberFormat("en-US").format(d.user.signatureBalance)}</div>
        <div className="pb-1 text-xs text-[var(--ls-on-deep-soft)]">{w.pointsWord}</div>
      </div>

      {p.nextLevel ? (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[var(--ls-gold)]" style={{ width: `${p.percentage}%` }} />
          </div>
          <div className="mt-2 text-xs text-[var(--ls-on-deep-soft)]">
            {new Intl.NumberFormat("en-US").format(p.remaining ?? 0)} until {p.nextLevelName}
          </div>
        </>
      ) : (
        <div className="mt-3 text-xs text-[var(--ls-on-deep-soft)]">You&apos;ve reached the highest level.</div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--ls-gold)]">
          {vaultReady ? "🎁 Your vault is ready — open now" : "View Society"} →
        </span>
      </div>
    </Link>
  );
}
