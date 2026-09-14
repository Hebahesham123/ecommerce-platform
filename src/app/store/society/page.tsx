import Link from "next/link";
import { getMyLoyalty } from "../loyalty-actions";
import SocietyApp from "./society-app";

// The session lives in a cookie, so this page can never be static.
export const dynamic = "force-dynamic";

export default async function SocietyPage() {
  const res = await getMyLoyalty();

  if (!res.ok) {
    if (res.error === "not_signed_in") {
      return (
        <Shell>
          <div className="rounded-2xl bg-[#fffaf3] p-8 text-center shadow-sm ring-1 ring-[#e7d8c4]">
            <div className="text-3xl">✦</div>
            <h1 className="mt-3 font-serif text-2xl text-[#4a3524]">Beauty Bar Society</h1>
            <p className="mt-2 text-sm text-[#8a6e57]">Collect Signatures. Unlock Privileges.</p>
            <p className="mt-4 text-sm text-[#6b543f]">Sign in to see your Signatures, level and rewards.</p>
            <Link
              href="/store/login?next=/store/society"
              className="mt-5 inline-block rounded-xl bg-[#8a5a2b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#734a23]"
            >
              Sign in
            </Link>
          </div>
        </Shell>
      );
    }
    if (res.error === "migration_missing" || res.error === "not_configured") {
      return (
        <Shell>
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
      <Shell>
        <div className="rounded-2xl bg-rose-50 p-6 text-center text-sm text-rose-700 ring-1 ring-rose-200">{res.error}</div>
      </Shell>
    );
  }

  return <SocietyApp summary={res.data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4ece1] px-4 py-10">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
