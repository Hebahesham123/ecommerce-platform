"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import type { LiveProduct, WatchableLive } from "@/lib/live";
import { useCart } from "../cart";

/**
 * The replays, one after another, the way reels are watched.
 *
 * A live sells for an hour and then stops; the recording is the same hour with
 * the same things held up in it. So each reel keeps the products that belonged
 * to its live, and somebody who missed the broadcast can still buy from it.
 *
 * Only the reel on screen plays. That is not a nicety: a feed that starts every
 * video at once spends the viewer's data on twenty things they are not
 * watching, and on a phone it stutters the one they are.
 */
export function Reels({ reels }: { reels: WatchableLive[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { count } = useCart();

  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);

  /**
   * Which one is on screen, decided by the browser rather than by arithmetic
   * on scroll positions — it is the one question IntersectionObserver answers
   * exactly, and it keeps working whatever the address bar does to the height.
   */
  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-reel]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const i = Number((e.target as HTMLElement).dataset.reel);
            if (!Number.isNaN(i)) setCurrent(i);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white">
      <div
        ref={trackRef}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {reels.map((reel, i) => (
          <Reel
            key={reel.id}
            index={i}
            reel={reel}
            active={i === current}
            // The next one is fetched while this one plays, so a swipe lands
            // on a video that has already started rather than on a spinner.
            warm={i === current + 1}
            muted={muted}
            onToggleSound={() => setMuted((m) => !m)}
            ar={ar}
            lang={lang}
          />
        ))}
      </div>

      {/* Out, and on to paying — the two things that must never be a swipe
          away from wherever the feed happens to have stopped. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/shop"
          className="pointer-events-auto rounded-full bg-black/45 p-2.5 backdrop-blur"
          aria-label={ar ? "إغلاق" : "Close"}
        >
          <CloseIcon />
        </Link>
        {count > 0 && (
          <Link
            href="/store/checkout"
            className="pointer-events-auto rounded-full bg-rose-600 px-4 py-2.5 text-sm font-bold"
          >
            {ar ? `الدفع (${count})` : `Checkout (${count})`}
          </Link>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- one reel -------------------------------- */

function Reel({
  index,
  reel,
  active,
  warm,
  muted,
  onToggleSound,
  ar,
  lang,
}: {
  index: number;
  reel: WatchableLive;
  active: boolean;
  warm: boolean;
  muted: boolean;
  onToggleSound: () => void;
  ar: boolean;
  lang: string;
}) {
  const { add, items, setQty, remove } = useCart();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  /**
   * Start the one being watched, and keep asking until it does.
   *
   * A single play() the moment a reel becomes current is a request made
   * before there is anything to play — the file has not been fetched yet, so
   * it is refused and the reel sits on its cover forever. Asking again as
   * soon as the browser says it can play is what turns a poster into a video.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!active) {
      el.pause();
      el.currentTime = 0;
      setSheet(false);
      return;
    }

    // preload="none" means nothing has been asked for yet; say so plainly
    // rather than hoping play() implies it.
    if (el.readyState === 0) el.load();
    const start = () => el.play().catch(() => {});
    start();
    el.addEventListener("canplay", start);
    el.addEventListener("loadeddata", start);
    return () => {
      el.removeEventListener("canplay", start);
      el.removeEventListener("loadeddata", start);
    };
  }, [active]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  const addToCart = useCallback(
    (p: LiveProduct) => {
      if (!p.itemId) return;
      add(
        {
          itemId: p.itemId,
          productName: p.productName,
          variantTitle: null,
          sku: null,
          imageUrl: p.imageUrl,
          price: p.price ?? 0,
          maxAvailable: p.available ?? 1,
        },
        1,
      );
      setAdded(p.id);
      setTimeout(() => setAdded((cur) => (cur === p.id ? null : cur)), 1800);
    },
    [add],
  );

  const pinned = reel.products.find((p) => p.pinned) ?? reel.products[0] ?? null;

  async function share() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/store/live/${reel.id}` : "";
    try {
      if (navigator.share) await navigator.share({ title: reel.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  }

  return (
    <section
      data-reel={index}
      className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={reel.recordingUrl ?? undefined}
        poster={reel.coverUrl ?? undefined}
        // The one being watched and the one after it. Further down the feed
        // nothing is fetched at all: twenty videos at once is a shopper's data
        // spent on nineteen she is not watching.
        preload={active || warm ? "auto" : "none"}
        playsInline
        loop
        muted={muted}
        // Once it has frames it has frames. A reel that flashes a spinner
        // every time the buffer dips is a reel that looks broken while it is
        // working perfectly well.
        onLoadedData={() => setPlaying(true)}
        onPlaying={() => setPlaying(true)}
        onClick={onToggleSound}
        className="absolute inset-0 h-full w-full object-contain"
      />


      {muted && playing && (
        <button
          onClick={onToggleSound}
          className="absolute inset-x-0 top-1/2 z-10 mx-auto flex w-fit -translate-y-1/2 items-center gap-2 rounded-full bg-black/65 px-5 py-3 text-sm font-semibold backdrop-blur"
        >
          <SoundIcon />
          {ar ? "اضغطي للصوت" : "Tap for sound"}
        </button>
      )}

      {/* Everything below floats over the video. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
        <div className="bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
          <h2 className="truncate text-[15px] font-semibold drop-shadow">{reel.title}</h2>
          {reel.hostName && (
            <p className="truncate text-xs text-white/70 drop-shadow">{reel.hostName}</p>
          )}

          {/* The thing held up in this reel, within thumb reach. */}
          {pinned && (
            <button
              onClick={() => addToCart(pinned)}
              className="pointer-events-auto mt-2.5 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white/95 p-2 text-start shadow-lg backdrop-blur"
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {pinned.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pinned.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {pinned.productName}
                </span>
                <span className="block text-xs text-ink-muted">
                  {pinned.price != null ? egp(pinned.price, lang as never) : ""}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white ${
                  added === pinned.id ? "bg-emerald-600" : "bg-rose-600"
                }`}
              >
                {added === pinned.id ? (ar ? "تمت" : "Added") : ar ? "أضيفي" : "Add"}
              </span>
            </button>
          )}

          <div className="pointer-events-auto mt-2.5 flex items-center gap-2">
            {reel.products.length > 0 && (
              // A photograph of the first item and the word for what it opens.
              // A bag glyph and a number meant nothing to half the people who
              // saw it on the live page either.
              <button
                onClick={() => setSheet(true)}
                className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/95 ps-1.5 pe-3.5 text-ink shadow-lg"
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  {reel.products[0]?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={reel.products[0].imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="truncate text-sm font-bold">
                  {ar ? "المنتجات" : "Products"}
                  <span className="ms-1 text-ink-soft">{reel.products.length}</span>
                </span>
              </button>
            )}
            <button
              onClick={share}
              className="h-11 w-11 shrink-0 rounded-full bg-white/15 backdrop-blur"
              aria-label={ar ? "مشاركة" : "Share"}
            >
              <span className="mx-auto block w-fit">
                <ShareIcon />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Everything that was sold in this live. */}
      {sheet && (
        <div
          className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50"
          onClick={() => setSheet(false)}
        >
          <div
            className="max-h-[72%] overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <h3 className="mb-3 text-base font-bold text-ink">
              {ar ? "منتجات هذا البث" : "In this live"}
            </h3>
            <ul className="space-y-2">
              {reel.products.map((p) => {
                const soldOut = (p.available ?? 0) <= 0;
                const inCart = p.itemId ? items.find((i) => i.itemId === p.itemId) : undefined;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {p.productName}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {p.price != null ? egp(p.price, lang as never) : "—"}
                        {p.discountCode && (
                          <span className="ms-2 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                            {p.discountCode}
                          </span>
                        )}
                        {soldOut && (
                          <span className="ms-2 text-rose-600">{ar ? "نفدت" : "Sold out"}</span>
                        )}
                      </span>
                    </span>
                    {/* Once something is in, this is how many — and one step
                        below one takes it out again. */}
                    {inCart && p.itemId ? (
                      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line p-1">
                        <button
                          onClick={() =>
                            inCart.quantity > 1
                              ? setQty(p.itemId!, inCart.quantity - 1)
                              : remove(p.itemId!)
                          }
                          className="h-8 w-8 rounded-lg text-lg font-semibold leading-none text-ink"
                          aria-label={
                            inCart.quantity > 1 ? (ar ? "أقل" : "One fewer") : ar ? "حذف" : "Remove"
                          }
                        >
                          {inCart.quantity > 1 ? "−" : "🗑"}
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold text-ink">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => setQty(p.itemId!, inCart.quantity + 1)}
                          disabled={inCart.quantity >= (p.available ?? 1)}
                          className="h-8 w-8 rounded-lg text-lg font-semibold leading-none text-ink disabled:opacity-30"
                          aria-label={ar ? "أكثر" : "One more"}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p)}
                        disabled={soldOut}
                        className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40 ${
                          added === p.id ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      >
                        {added === p.id ? (ar ? "تمت" : "Added") : ar ? "أضيفي" : "Add"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => setSheet(false)}
              className="mt-4 h-12 w-full rounded-xl border border-line text-sm font-semibold text-ink"
            >
              {ar ? "متابعة المشاهدة" : "Keep watching"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------- icons ---------------------------------- */

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 3v13M8 7l4-4 4 4" />
  </svg>
);

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" />
  </svg>
);
