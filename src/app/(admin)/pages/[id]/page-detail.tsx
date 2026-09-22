"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import {
  fill,
  howLabel,
  previewUrl,
  unresolved,
  type PageEntry,
  type Samples,
} from "@/lib/pages-catalog";
import { PAGE_COPY, type Copy } from "@/lib/page-copy";
import { CopyForm } from "./copy-form";

type Device = "phone" | "tablet" | "desktop";

const WIDTH: Record<Device, number> = { phone: 430, tablet: 820, desktop: 1280 };

/**
 * One page, at the size a shopper meets it, next to the way to change it.
 *
 * The frame is the live page rather than a picture of it, so what a merchant
 * approves here is what is being served — and reloading after an edit shows
 * the edit, which is the whole point of standing the two side by side.
 */
export function PageDetail({
  page,
  samples,
  copy,
}: {
  page: PageEntry;
  samples: Samples;
  /** What the merchant has already written for this page. */
  copy: Copy;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [device, setDevice] = useState<Device>(page.surface === "app" ? "phone" : "desktop");
  // Bumping this remounts the frame, which is how a merchant sees an edit they
  // just made somewhere else.
  const [nonce, setNonce] = useState(0);

  const missing = unresolved(page.preview, samples);
  // Flagged as a preview: looking at your own page here is not a visit.
  const src = missing ? "" : previewUrl(page.preview, samples);
  const live = page.live ? fill(page.live, samples) : src;
  const edit = page.editHref && !unresolved(page.editHref, samples) ? fill(page.editHref, samples) : null;

  const width = page.surface === "app" ? WIDTH.phone : WIDTH[device];
  const spec = PAGE_COPY[page.id];

  // A desktop page squeezed into the column would switch to its phone layout,
  // which is not the thing being previewed. It is laid out at full width and
  // scaled down instead.
  const stage = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setRoom(el.clientWidth));
    watch.observe(el);
    setRoom(el.clientWidth);
    return () => watch.disconnect();
  }, []);
  const scale = room > 0 ? Math.min(1, room / width) : 1;
  const height = 760;

  return (
    <>
      <PageHeader
        title={ar ? page.title.ar : page.title.en}
        subtitle={ar ? page.what.ar : page.what.en}
        actions={
          <>
            <Link href="/pages" className="btn-ghost">
              {ar ? "كل الصفحات" : "All pages"}
            </Link>
            <button onClick={() => setNonce((n) => n + 1)} className="btn-outline">
              {ar ? "تحديث" : "Reload"}
            </button>
            {!missing && (
              <a href={live} target="_blank" rel="noreferrer" className="btn-outline">
                {ar ? "فتح في تبويب" : "Open in a tab"}
              </a>
            )}
          </>
        }
        primary={
          edit
            ? { label: ar ? "تعديل هذه الصفحة" : "Edit this page", href: edit }
            : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="truncate font-mono text-[11px] text-ink-soft">{live || "—"}</span>
            {page.surface === "web" && (
              <div className="ms-auto inline-flex shrink-0 rounded-lg border border-line p-0.5">
                {(
                  [
                    ["phone", ar ? "هاتف" : "Phone"],
                    ["tablet", ar ? "تابلت" : "Tablet"],
                    ["desktop", ar ? "سطح المكتب" : "Desktop"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDevice(key)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                      device === key ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={stage} className="bg-surface-page p-3">
            {missing ? (
              <p className="px-4 py-16 text-center text-sm text-ink-soft">
                {ar
                  ? "لا توجد بيانات في المتجر لعرض هذه الصفحة بعد."
                  : "There is nothing in the store to show on this page yet."}
              </p>
            ) : (
              <div
                className="mx-auto overflow-hidden"
                style={{ width: width * scale, height: height * scale }}
              >
                <iframe
                  key={`${src}-${device}-${nonce}`}
                  src={src}
                  title={ar ? page.title.ar : page.title.en}
                  className="block rounded-xl border border-line bg-white"
                  style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: ar ? "top right" : "top left",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {spec && (
            <CopyForm spec={spec} saved={copy} onSaved={() => setNonce((n) => n + 1)} />
          )}

          <div className="card p-4">
            <h2 className="section-title mb-2">{ar ? "التعديل" : "Editing"}</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {ar ? howLabel[page.how].ar : howLabel[page.how].en}
              {page.note && (
                <span className="mt-1.5 block text-xs">{ar ? page.note.ar : page.note.en}</span>
              )}
            </p>
            {edit && (
              <Link href={edit} className="btn-primary mt-3 w-full justify-center">
                {ar ? "افتحي المحرّر" : "Open the editor"}
              </Link>
            )}
          </div>

          <div className="card p-4">
            <h2 className="section-title mb-2">{ar ? "أين تظهر" : "Where it lives"}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-soft">{ar ? "المتجر" : "Store"}</dt>
                <dd className="min-w-0 text-ink">
                  {page.surface === "app" ? (ar ? "التطبيق" : "Mobile app") : (ar ? "الموقع" : "Website")}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-soft">{ar ? "الرابط" : "Address"}</dt>
                <dd className="min-w-0 break-all font-mono text-xs text-ink">{live || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
