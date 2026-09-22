import Link from "next/link";
import { Preview } from "./preview";
import { AnalyticsBeacon } from "@/components/analytics-beacon";

export const dynamic = "force-dynamic";

/**
 * This page sits outside the admin layout, so it has none of the dashboard's
 * chrome — which is right for something pretending to be a phone, and wrong
 * for someone who now has no sidebar and no way back. Hence the bar.
 *
 * `?bare=1` drops all of that: the Pages hub frames this page once per app
 * screen, and a frame wants the phone and nothing else. `?screen=`,
 * `?collection=` and `?product=` say which screen to open on, so each frame
 * lands somewhere different.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bare?: string; screen?: string; collection?: string; product?: string }>;
}) {
  const sp = await searchParams;
  const start = { screen: sp.screen, collection: sp.collection, product: sp.product };
  const asked = Boolean(start.screen || start.collection || start.product);

  if (sp.bare === "1") {
    // Framed for a preview, so no beacon: a merchant looking at their own app
    // in the Pages hub is not a session to count.
    return (
      <main className="min-h-screen bg-surface-page p-3">
        <Preview bare start={asked ? start : undefined} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-page">
      {/* The preview is the app: its visits belong to Analytics → App. */}
      <AnalyticsBeacon channel="app" platform="web" />
      <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:px-8">
          <Link
            href="/app"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            <span aria-hidden className="text-base leading-none">
              ‹
            </span>
            العودة للوحة التحكم · Back to the dashboard
          </Link>
          <span className="ms-auto rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            معاينة · preview
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 lg:p-8">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-ink">معاينة التطبيق · App preview</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            متجر يعمل بالكامل عبر واجهة التطبيق — كل طلب هنا يُسجَّل كطلب تطبيق حقيقي.
            <span className="mt-0.5 block">
              A working store that talks only to the Storefront API. Anything you do here is real:
              it reserves the same stock and shows up under App in the dashboard.
            </span>
          </p>
        </header>
        <Preview start={asked ? start : undefined} />
      </div>
    </main>
  );
}
