"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import {
  PAGES,
  howLabel,
  previewUrl,
  unresolved,
  type PageEntry,
  type Samples,
  type Surface,
} from "@/lib/pages-catalog";

/**
 * Every page in the store, as a wall of live previews.
 *
 * The thumbnails are the pages themselves in a frame, not screenshots: a
 * screenshot is a promise that goes stale the first time anyone edits
 * anything, and this store has four places where that can happen.
 */
export function PagesHub({ samples }: { samples: Samples }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [only, setOnly] = useState<Surface | "all">("all");

  const shown = PAGES.filter((p) => only === "all" || p.surface === only);
  const groups = [...new Set(shown.map((p) => p.group.en))];

  return (
    <>
      <PageHeader
        title={ar ? "الصفحات" : "Pages"}
        subtitle={
          ar
            ? "كل صفحة تراها العميلة — على الموقع وفي التطبيق — بمعاينة حيّة ومكان تعديلها."
            : "Every page a shopper sees, on the website and in the app, with a live preview and where to change it."
        }
        actions={
          <div className="inline-flex rounded-xl border border-line p-0.5">
            {(
              [
                ["all", ar ? "الكل" : "All"],
                ["web", ar ? "الموقع" : "Website"],
                ["app", ar ? "التطبيق" : "App"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setOnly(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  only === key ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {groups.map((group) => {
        const rows = shown.filter((p) => p.group.en === group);
        return (
          <section key={group} className="mb-7">
            <h2 className="section-title mb-2.5">{ar ? rows[0].group.ar : group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((page) => (
                <Card key={page.id} page={page} samples={samples} ar={ar} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Card({ page, samples, ar }: { page: PageEntry; samples: Samples; ar: boolean }) {
  const missing = unresolved(page.preview, samples);
  const src = missing ? "" : previewUrl(page.preview, samples);

  return (
    <Link
      href={`/pages/${page.id}`}
      className="card group overflow-hidden transition hover:border-brand-300"
    >
      <Thumb src={src} surface={page.surface} ar={ar} missing={missing} />
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">
            {ar ? page.title.ar : page.title.en}
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-muted">
            {ar ? page.what.ar : page.what.en}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            page.how === "none"
              ? "bg-surface-hover text-ink-soft"
              : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          }`}
        >
          {ar ? howLabel[page.how].ar : howLabel[page.how].en}
        </span>
      </div>
    </Link>
  );
}

/**
 * The page itself, shrunk to fit.
 *
 * A frame is laid out at the width the page was designed for and then scaled
 * down, rather than being squeezed: a website squeezed to 320px wide switches
 * to its phone layout, which is not what the merchant clicked on.
 */
function Thumb({
  src,
  surface,
  ar,
  missing,
}: {
  src: string;
  surface: Surface;
  ar: boolean;
  missing: boolean;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(0);
  // Whether this one is worth loading. A thumbnail off the bottom of the
  // screen costs a storefront render or an app boot for a picture nobody is
  // looking at, so it waits its turn and gives the frame back on the way out.
  const [near, setNear] = useState(false);
  const w = surface === "app" ? 430 : 1280;
  const h = surface === "app" ? 900 : 900;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setWide(el.clientWidth));
    watch.observe(el);
    setWide(el.clientWidth);
    const eye = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: "300px" },
    );
    eye.observe(el);
    return () => {
      watch.disconnect();
      eye.disconnect();
    };
  }, []);

  return (
    <div
      ref={box}
      className="relative h-44 overflow-hidden border-b border-line bg-surface-page"
    >
      {missing ? (
        <div className="grid h-full place-items-center px-4 text-center text-xs text-ink-soft">
          {ar ? "لا توجد بيانات لعرضها بعد" : "Nothing in the store to show here yet"}
        </div>
      ) : (
        wide > 0 &&
        near && (
          <iframe
            src={src}
            loading="lazy"
            title=""
            aria-hidden
            tabIndex={-1}
            scrolling="no"
            className="pointer-events-none absolute start-0 top-0 border-0"
            style={{ width: w, height: h, transform: `scale(${wide / w})`, transformOrigin: ar ? "top right" : "top left" }}
          />
        )
      )}
    </div>
  );
}
