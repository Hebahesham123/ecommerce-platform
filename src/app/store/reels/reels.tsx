"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import type { LiveProduct, WatchableLive } from "@/lib/live";
import { say, type Copy } from "@/lib/page-copy";
import { useHlsSource } from "@/lib/use-hls";
import { useCart } from "../cart";

declare global {
  interface Window {
    /** Present only inside the native app's WebView. */
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

type AppMessage =
  | { source: "beautybar-app"; action: "close" }
  | { source: "beautybar-app"; action: "product"; id: string; back: string };

/**
 * Say something to the app this page is inside, if it is inside one.
 *
 * There are two: the dashboard's phone preview, which frames this page in an
 * iframe, and the real native app, which shows it in a WebView. They are
 * reached differently — a WebView has no parent window, only its own bridge
 * — and a page that only knew about the iframe behaved like the plain
 * website inside the real app: its X sent the WebView off to the shop page
 * instead of back to the app's Shop tab.
 *
 * Returns false on the plain website, where there is nobody to tell.
 */
/** Both ends of the product row fade to nothing. */
const FADE_EDGES = "linear-gradient(to right, transparent 0, #000 22%, #000 78%, transparent 100%)";

function postToApp(message: AppMessage): boolean {
  if (typeof window === "undefined") return false;
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
    return true;
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
    return true;
  }
  return false;
}

/**
 * Opening a product, from wherever this is being shown.
 *
 * On the website it is a page and the product is another page. Inside an
 * app it asks the app to open its own product screen instead — following
 * the link there would load the whole website product page, header and
 * all, which is a second storefront wearing the app's chrome.
 *
 * `back` is the reel she was on, so returning from the product lands her
 * on that reel rather than at the top of the feed.
 */
function openProduct(itemId: string, back: string) {
  return postToApp({ source: "beautybar-app", action: "product", id: itemId, back });
}

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
export function Reels({
  reels,
  copy,
}: {
  reels: WatchableLive[];
  /** The merchant's wording for this page, from the Pages screen. */
  copy: Copy;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { count } = useCart();

  const [current, setCurrent] = useState(0);
  const warmed = useRef(new Set<string>());
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

  /**
   * A shared link opens on the reel it was shared from.
   *
   * Without this the address carries the reel and the feed ignores it: every
   * link anybody sends lands on whatever happens to be newest, which is the
   * one thing a shared link must not do.
   */
  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    let wanted = "";
    try {
      wanted = new URLSearchParams(window.location.search).get("reel") ?? "";
    } catch {
      return;
    }
    if (!wanted) return;
    const i = reels.findIndex((r) => r.id === wanted);
    if (i < 1) return; // not found, or already the one on screen
    const slide = root.querySelector<HTMLElement>(`[data-reel="${i}"]`);
    if (!slide) return;
    // Instantly, not smoothly: this is where the page opens, not somewhere
    // it travels to while the viewer watches.
    slide.scrollIntoView({ block: "start", behavior: "auto" });
    setCurrent(i);
  }, [reels]);

  /**
   * Keep the address on the reel being watched.
   *
   * Everything that leaves this page and comes back — a product, checkout, a
   * refresh, the browser's own back button — reads the address to know where
   * it was. If it still says the reel the visitor arrived on, all of them
   * return her to that one however far she has swiped since.
   *
   * replaceState rather than push: swiping through a feed should not fill the
   * back button with every video she passed.
   */
  useEffect(() => {
    const reel = reels[current];
    if (!reel) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("reel") === reel.id) return;
      url.searchParams.set("reel", reel.id);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* an address we cannot rewrite is not worth failing over */
    }
  }, [current, reels]);

  /**
   * Fetch the front of the next few videos before they are asked for.
   *
   * This is the difference between a feed that plays on the swipe and one
   * that starts thinking about it then. A video element will not do this on
   * its own without also deciding to download the whole file, so the first
   * couple of megabytes are pulled by hand — enough for the opening seconds —
   * and the browser and the CDN both keep them. By the time the reel is on
   * screen the bytes it needs have already arrived.
   *
   * Two ahead, once each. Further than that is a shopper's data spent on
   * videos she will never reach.
   */
  useEffect(() => {
    const ahead = reels.slice(current, current + 3);
    for (const r of ahead) {
      const url = r.recordingUrl;
      // A playlist needs no warming: it is already in pieces, and its player
      // asks for the one it wants. This is for the whole files.
      if (!url || /\.m3u8(\?|$)/i.test(url) || warmed.current.has(url)) continue;
      warmed.current.add(url);
      fetch(url, {
        headers: { Range: "bytes=0-2097151" },
        credentials: "omit",
      })
        // Read it to the end so it lands in the cache rather than being
        // abandoned half-received.
        .then((res) => res.arrayBuffer())
        .catch(() => {
          // A warm-up that fails costs nothing: the video element will ask
          // for the same bytes itself when its turn comes.
        });
    }
  }, [current, reels]);

  /**
   * Where closing goes depends on where this is being shown.
   *
   * On the website it is a page, and closing means the shop. Inside the app
   * it is a tab in a frame, and sending the frame to the website would leave
   * the shopper looking at a whole second storefront inside her app with no
   * way back. So when it is framed it asks to be closed rather than going
   * anywhere itself, and the app puts her back on the tab she came from.
   */
  function close() {
    if (postToApp({ source: "beautybar-app", action: "close" })) return;
    window.location.assign("/shop");
  }

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
            // The two after this one are already loading, so a swipe lands on
            // a video that has started rather than one that is beginning to
            // think about it.
            warm={i > current && i <= current + 2}
            muted={muted}
            onToggleSound={() => setMuted((m) => !m)}
            ar={ar}
            lang={lang}
            copy={copy}
          />
        ))}
      </div>

      {/* Out, and on to paying — the two things that must never be a swipe
          away from wherever the feed happens to have stopped. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={close}
          className="pointer-events-auto rounded-full bg-black/45 p-2.5 backdrop-blur"
          aria-label={ar ? "إغلاق" : "Close"}
        >
          <CloseIcon />
        </button>
        {/* Checkout used to sit up here; it is in the rail with everything
            else she can do now, where a thumb already is. */}
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
  copy,
}: {
  index: number;
  reel: WatchableLive;
  active: boolean;
  warm: boolean;
  muted: boolean;
  onToggleSound: () => void;
  ar: boolean;
  lang: string;
  copy: Copy;
}) {
  const { add, items, setQty, remove, count } = useCart();

  /**
   * The like, remembered by the browser that made it.
   *
   * There is no row of who liked what — that would attach a name to a
   * gesture somebody made without signing in, for a number nobody ever reads
   * per person. The shop keeps the total; this keeps the fact that this
   * phone has already added to it.
   */
  const [likes, setLikes] = useState(reel.likes);
  const [liked, setLiked] = useState(false);
  useEffect(() => {
    try {
      setLiked(localStorage.getItem(`bb_reel_like_${reel.id}`) === "1");
    } catch {
      /* private browsing */
    }
  }, [reel.id]);

  /**
   * Liking, and changing your mind.
   *
   * A heart that cannot be un-tapped turns a slip of the thumb into a
   * permanent one, so the same tap does both. It fills at once and the shop
   * is told afterwards — a heart that waits for a round trip before it
   * fills is a heart that feels broken.
   */
  function like() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) localStorage.setItem(`bb_reel_like_${reel.id}`, "1");
      else localStorage.removeItem(`bb_reel_like_${reel.id}`);
    } catch {
      /* private browsing */
    }
    fetch(`/api/storefront/reels/${reel.id}/like`, {
      method: next ? "POST" : "DELETE",
    })
      .then((r) => r.json())
      .then((r) => {
        if (r?.ok && typeof r.data?.likes === "number") setLikes(r.data.likes);
      })
      .catch(() => {
        /* the tap is kept; the total catches up on the next read */
      });
  }

  // Where a shopper says what she thought of it, about the thing she was
  // just shown rather than the shop in general.
  const reviewHref = pinnedProductHref(reel);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // A playlist where there is one, the whole file where there is not. Only
  // for reels near enough to be watched — the rest are not given a source at
  // all, which is the cheapest possible way of not loading them.
  useHlsSource(videoRef, reel.recordingUrl, active || warm);

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

  // Where to send whatever leaves this reel, so it comes back to this reel
  // rather than to the top of the feed.
  const here = `/store/reels?reel=${encodeURIComponent(reel.id)}`;

  const ordered = [...reel.products].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder,
  );

  /**
   * The same products, laid end to end enough times to make a ring.
   *
   * A row that stops at its last item has to jump back to the first, and a
   * jump is the one thing that tells everybody it is a trick. Repeating the
   * list means there is always another copy of it coming up on the right, so
   * the drift never reaches an end — and when it has travelled exactly one
   * copy's width it is wound back by exactly that, onto a picture identical
   * to the one it was already showing. Nothing moves; the ring just carries
   * on.
   *
   * Two products need this as much as six do: two do not fill the strip, so
   * without copies there is nowhere to scroll to at all.
   */
  const CARD = 112; // 104 wide, 8 of gap
  const STRIP = 260; // the widest the strip is ever allowed to be
  // One product has nowhere to go and no reason to: a single thing sliding
  // back and forth under a still picture is movement for its own sake.
  const copies =
    ordered.length > 1
      ? Math.min(8, Math.max(2, Math.ceil((STRIP * 2) / (CARD * ordered.length))))
      : 1;
  const ring = Array.from({ length: copies }, () => ordered).flat();

  /**
   * The products carry themselves past, and begin again.
   *
   * A row that has to be pushed is a row most people never push: what is off
   * the right-hand edge may as well not be there. So it drifts, slowly enough
   * to read and slowly enough to tap, and returns to the first when it
   * reaches the last.
   *
   * It moves only on the reel being watched, stops the moment a finger lands
   * on it, and waits a couple of seconds after she lets go before taking over
   * again — nothing should slide out from under a thumb that is reaching for
   * it. A phone asking for less motion gets none.
   */
  useEffect(() => {
    const el = stripRef.current;
    // Nothing to go round: one product, or none.
    if (!el || !active || copies < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let idleUntil = 0;
    let leftOver = 0;

    const step = () => {
      frame = requestAnimationFrame(step);
      if (Date.now() < idleUntil) return;

      // One copy of the list. Measured rather than calculated, so a card that
      // is a pixel wider than it was designed to be does not slowly drag the
      // wrap out of alignment.
      const lap = el.scrollWidth / Math.max(1, copies);
      if (lap < 1) return;

      if (el.scrollLeft >= lap) {
        // Wound back one whole copy, onto the identical picture. There is
        // nothing to see here, which is the entire point.
        el.scrollLeft -= lap;
      }

      // Sub-pixel movement accumulates rather than being rounded away, which
      // is the difference between a drift and a stutter.
      leftOver += 0.32;
      const whole = Math.floor(leftOver);
      if (whole >= 1) {
        el.scrollLeft += whole;
        leftOver -= whole;
      }
    };

    const hold = () => {
      idleUntil = Date.now() + 2500;
    };

    frame = requestAnimationFrame(step);
    el.addEventListener("pointerdown", hold, { passive: true });
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("wheel", hold, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("wheel", hold);
    };
  }, [active, copies]);

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

  // Whatever she held up goes first; the rest keep the order they were
  // given. Nobody should have to scroll to reach the thing on screen.

  /**
   * Share the reel, at the reel.
   *
   * This used to hand over the live's own page — the broadcast this
   * recording came from, with its chat, its viewer count and its title still
   * on it. Whoever opened it got the room after everyone had left, which is
   * not what was being shared.
   */
  async function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/store/reels?reel=${encodeURIComponent(reel.id)}`
        : "";
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
        poster={reel.coverUrl ?? undefined}
        // The near ones in full; the rest just far enough to have their
        // connection made and their length known, which costs a few kilobytes
        // and saves the handshake later.
        preload={active || warm ? "auto" : "metadata"}
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
          {say(copy, "tapForSound", ar) || (ar ? "اضغطي للصوت" : "Tap for sound")}
        </button>
      )}

      {/*
        The furniture, arranged the way a reel is read: the thing being sold in
        the bottom left where the account and caption sit on every feed anyone
        already uses, and the actions in a column on the right under the thumb.
        Nothing crosses the middle of the picture.
      */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* ---- bottom left: what this reel is selling ---- */}
        <div className="min-w-0 flex-1">

          {/*
            One product or six, in the same strip of screen. They scroll
            sideways rather than stacking, so a live that sold a whole rail
            of things does not bury the video it is selling them from — and
            each one still leads with its photograph, which is what she is
            deciding about.
          */}
          {reel.products.length > 0 && (
            <div
              ref={stripRef}
              // No scroll snapping: it would keep pulling the row back onto a
              // product while the drift is trying to move it off one.
              className="pointer-events-auto -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                maxWidth: "min(72vw, 260px)",
                // Products come in out of nothing and go back into it, rather
                // than being cut off by the edge of the row.
                // One product stands still, so it keeps its edges.
                WebkitMaskImage: ordered.length > 1 ? FADE_EDGES : undefined,
                maskImage: ordered.length > 1 ? FADE_EDGES : undefined,
              }}
            >
              {ring.map((p, i) => {
                const soldOut = (p.available ?? 0) <= 0;
                return (
                  // The picture and the name open the product; only the pill
                  // buys it. They were one button before, which made every
                  // glance at something cost a line in the cart.
                  <div
                    key={`${p.id}-${i}`}
                    // Only the first time round is read out; the rest are the
                    // same things again and a screen reader should not have to
                    // sit through them.
                    aria-hidden={i >= ordered.length}
                    className="w-[84px] shrink-0"
                  >
                    <Link
                      href={
                        p.itemId
                          ? `/store/product/${encodeURIComponent(p.itemId)}?back=${encodeURIComponent(here)}`
                          : "/store"
                      }
                      onClick={(e) => {
                        if (p.itemId && openProduct(p.itemId, here)) e.preventDefault();
                      }}
                      className="block text-start"
                    >
                      <span className="block h-[84px] w-[84px] overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className={`h-full w-full object-cover ${soldOut ? "opacity-45" : ""}`}
                          />
                        )}
                      </span>
                      <span className="mt-1 block truncate text-center text-[10px] font-medium leading-tight text-white drop-shadow">
                        {p.productName}
                      </span>
                      <span className="mt-0.5 block text-center text-[10px] font-bold text-white drop-shadow">
                        {p.price != null ? egp(p.price, lang as never) : ""}
                      </span>
                    </Link>
                    {/* The shop's own button, the width of the card it belongs
                        to, so a row of them reads as a row rather than as
                        pills scattered under pictures. */}
                    <button
                      onClick={() => !soldOut && addToCart(p)}
                      disabled={soldOut}
                      className={`mt-1 block w-full whitespace-nowrap rounded-lg px-1 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                        soldOut
                          ? "bg-white/25 text-white/70"
                          : added === p.id
                            ? "bg-emerald-600 text-white"
                            : "bg-[#8a5a2b] text-white"
                      }`}
                    >
                      {soldOut
                        ? say(copy, "soldOut", ar) || (ar ? "نفدت" : "Sold out")
                        : added === p.id
                          ? say(copy, "added", ar) || (ar ? "تمت" : "Added")
                          : say(copy, "add", ar) || (ar ? "أضيفي للسلة" : "Add to cart")}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- right: the things she can do about it ---- */}
        <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-1">
          <Action
            onClick={like}
            label={likes > 0 ? compact(likes) : ""}
            active={liked}
            icon={<HeartIcon filled={liked} />}
          />
          {reel.products.length > 0 && (
            <Action
              onClick={() => setSheet(true)}
              label={String(reel.products.length)}
              icon={<BagIcon />}
            />
          )}
          {count > 0 && (
            <Action
              // Carrying where she came from, so the page she lands on can
              // offer her the way back instead of leaving her to find it.
              href={`/store/checkout?back=${encodeURIComponent(here)}`}
              label={String(count)}
              highlight
              icon={<CheckoutIcon />}
            />
          )}
          <Action
            href={reviewHref}
            label={ar ? "تقييم" : "Review"}
            icon={<StarIcon />}
          />
          <Action onClick={share} label="" icon={<ShareIcon />} />
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
              {say(copy, "sheetTitle", ar) || (ar ? "منتجات هذا البث" : "In this live")}
            </h3>
            <ul className="space-y-2">
              {reel.products.map((p) => {
                const soldOut = (p.available ?? 0) <= 0;
                const inCart = p.itemId ? items.find((i) => i.itemId === p.itemId) : undefined;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    {/* The same rule as the strip: the picture and the name are
                        the way in, the button is the way to buy. */}
                    <Link
                      href={
                        p.itemId
                          ? `/store/product/${encodeURIComponent(p.itemId)}?back=${encodeURIComponent(here)}`
                          : "/store"
                      }
                      onClick={(e) => {
                        if (p.itemId && openProduct(p.itemId, here)) e.preventDefault();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
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
                          <span className="ms-2 text-rose-600">
                            {say(copy, "soldOut", ar) || (ar ? "نفدت" : "Sold out")}
                          </span>
                        )}
                      </span>
                      </span>
                    </Link>
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
                        {added === p.id
                          ? say(copy, "added", ar) || (ar ? "تمت" : "Added")
                          : say(copy, "add", ar) || (ar ? "أضيفي" : "Add")}
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
              {say(copy, "keepWatching", ar) || (ar ? "متابعة المشاهدة" : "Keep watching")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- the rail --------------------------------- */

/**
 * One thing she can do, as a circle with a word under it.
 *
 * A link when it goes somewhere and a button when it does something — the
 * difference matters for a long press, for opening in a new tab, and for
 * anyone reading the page rather than looking at it.
 */
function Action({
  icon,
  label,
  onClick,
  href,
  active,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span
        className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur transition-colors ${
          highlight
            ? "bg-rose-600 text-white"
            : active
              ? "bg-rose-600/90 text-white"
              : "bg-black/40 text-white"
        }`}
      >
        {icon}
      </span>
      {label && (
        <span className="mt-1 block text-[10px] font-semibold text-white drop-shadow">
          {label}
        </span>
      )}
    </>
  );
  const cls = "flex w-12 flex-col items-center";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** 1.2k rather than 1200: a count is read at a glance or not at all. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

/** The review form, pointed at whatever this reel was holding up. */
function pinnedProductHref(reel: WatchableLive): string {
  // The item the reel was holding up, so the form opens on the thing she
  // just watched rather than on an empty choice of everything in the shop.
  const p = reel.products.find((x) => x.pinned) ?? reel.products[0];

  const back = `back=${encodeURIComponent(`/store/reels?reel=${reel.id}`)}`;
  return p?.itemId
    ? `/shop/reviews?product=${encodeURIComponent(p.itemId)}&${back}`
    : `/shop/reviews?${back}`;
}

/* --------------------------------- icons ---------------------------------- */

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M12 20s-7.2-4.5-9.1-8.4C1.3 8.3 3.1 5 6.4 5c2 0 3.3 1.1 4.1 2.2l1.5 2 1.5-2C14.3 6.1 15.6 5 17.6 5c3.3 0 5.1 3.3 3.5 6.6C19.2 15.5 12 20 12 20Z" />
  </svg>
);

const BagIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.5 8h13l-1 11.5a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5.5 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);

/** The shop's own cart mark: a tote, with its handle inside the box. */
const CheckoutIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.2" y="6.4" width="17.6" height="13.2" rx="3" />
    <path d="M9 10.2a3 3 0 0 0 6 0" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.5 9.6l5.2-.7L12 4Z" />
  </svg>
);

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
