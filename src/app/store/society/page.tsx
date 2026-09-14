import Link from "next/link";
import { getMyLoyalty } from "../loyalty-actions";
import SocietyApp from "./society-app";
import { getLoyaltyTheme } from "@/lib/loyalty/theme-service";
import { loyaltyVars, type LoyaltyTheme } from "@/lib/loyalty/theme";

// The session lives in a cookie, so this page can never be static.
export const dynamic = "force-dynamic";

export default async function SocietyPage() {
  const [res, theme] = await Promise.all([getMyLoyalty(), getLoyaltyTheme()]);
  const w = theme.words;

  if (!res.ok) {
    if (res.error === "not_signed_in") {
      return (
        <Shell theme={theme}>
          <div className="rounded-2xl bg-[var(--ls-card)] p-8 text-center shadow-sm ring-1 ring-[var(--ls-line)]">
            <div className="text-3xl">{w.glyph}</div>
            <h1 className="mt-3 font-serif text-2xl text-[var(--ls-ink)]">
              {w.brandLine} {w.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--ls-ink-muted)]">{w.tagline}</p>
            <p className="mt-4 text-sm text-[var(--ls-ink-muted)]">Sign in to see your Signatures, level and rewards.</p>
            <Link
              href="/store/login?next=/store/society"
              className="mt-5 inline-block rounded-xl bg-[var(--ls-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--ls-accent)]"
            >
              Sign in
            </Link>
          </div>
        </Shell>
      );
    }
    if (res.error === "migration_missing" || res.error === "not_configured") {
      return (
        <Shell theme={theme}>
          <div className="rounded-2xl bg-amber-50 p-8 text-center ring-1 ring-amber-200">
            <h1 className="font-serif text-xl text-amber-900">Society isn&apos;t switched on yet</h1>
            <p className="mt-2 text-sm text-amber-800">
              Run <code className="rounded bg-white px-1.5 py-0.5">supabase/migrations/0027_loyalty.sql</code> to enable the loyalty program.
            </p>
          </div>
        </Shell>
      );
    }
    return (
      <Shell theme={theme}>
        <div className="rounded-2xl bg-rose-50 p-6 text-center text-sm text-rose-700 ring-1 ring-rose-200">{res.error}</div>
      </Shell>
    );
  }

  return <SocietyApp summary={res.data} theme={theme} />;
}

function Shell({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: LoyaltyTheme;
}) {
  return (
    <div
      className="min-h-screen bg-[var(--ls-page)] px-4 py-10"
      style={loyaltyVars(theme) as React.CSSProperties}
    >
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
