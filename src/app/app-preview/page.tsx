import Link from "next/link";
import { Preview } from "./preview";

export const dynamic = "force-dynamic";

/**
 * This page sits outside the admin layout, so it has none of the dashboard's
 * chrome — which is right for something pretending to be a phone, and wrong
 * for someone who now has no sidebar and no way back. Hence the bar.
 */
export default function Page() {
  return (
    <main className="min-h-screen bg-surface-page">
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
        <Preview />
      </div>
    </main>
  );
}
