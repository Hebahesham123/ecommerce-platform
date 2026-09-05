import { Preview } from "./preview";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="min-h-screen bg-surface-page p-4 lg:p-8">
      <div className="mx-auto max-w-6xl">
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
