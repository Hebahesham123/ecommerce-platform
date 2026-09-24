"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import { useLiveChat } from "@/lib/live-chat";
import { isTestStream, type LiveProduct, type WatchableLive } from "@/lib/live";
import { LiveComments } from "@/components/live-comments";
import { useCart } from "../../cart";

/**
 * Watching a live, full screen.
 *
 * The video is the page: everything else floats over it, because a live is
 * watched the way every app people already use shows one. Comments rise from
 * the bottom left, the products sit within thumb reach on the right, and
 * neither ever pushes the picture around.
 *
 * A viewer may comment, add to cart and share. They never appear on camera, so
 * this screen asks for no permissions and opens instantly from a shared link.
 */
export function Watch({ live: initial }: { live: WatchableLive }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { add, items, setQty, remove, count, setOpen } = useCart();

  const [live, setLive] = useState(initial);
  const [added, setAdded] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [composing, setComposing] = useState(false);

  const onAir = live.status === "live";
  // Watching a recording rather than a live. The video shows its own controls
  // then, so the bar floating over it has to stop swallowing the taps meant
  // for them.
  const replay = !onAir && !!live.recordingUrl;
  const pinned = live.products.find((p) => p.pinned) ?? null;

  const { messages, viewers, send: sendComment } = useLiveChat(live.id, { enabled: onAir, keep: 250 });



  // Say we are still here, so the shop can count the room without relying
  // on a channel that may never connect. The key is per tab, so two phones
  // count twice and one phone counts once however long it watches.
  useEffect(() => {
    if (!onAir) return;
    const key = crypto.randomUUID();
    const beat = () =>
      fetch(`/api/storefront/lives/${live.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      }).catch(() => {});
    beat();
    const t = setInterval(beat, 15000);
    return () => clearInterval(t);
  }, [onAir, live.id]);

  // Pick up a newly pinned product without a reload.
  useEffect(() => {
    if (!onAir) return;
    const t = setInterval(() => {
      fetch(`/api/storefront/lives/${live.id}`)
        .then((r) => r.json())
        .then((r) => {
          if (r?.ok && r.data) setLive((cur) => ({ ...cur, ...r.data }));
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [live.id, onAir]);

  const handleSend = useCallback(
    (authorName: string, body: string) => sendComment({ authorName, body }),
    [sendComment],
  );

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

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: live.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  }


  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white">
      <Player live={live} ar={ar} />

      {/* Everything below floats over the video. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        {/* Top: who, how many, and the way out */}
        <div className="pointer-events-auto flex items-start gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {onAir && (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold uppercase">
                  {ar ? "مباشر" : "Live"}
                </span>
              )}
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
                {Math.max(1, live.watching ?? 0, viewers)} {ar ? "يشاهدون" : "watching"}
              </span>
              {isTestStream(live) && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {ar ? "تجريبي" : "Test"}
                </span>
              )}
            </div>
            <h1 className="mt-1 truncate text-[15px] font-semibold drop-shadow">{live.title}</h1>
            {live.hostName && (
              <p className="truncate text-xs text-white/70 drop-shadow">{live.hostName}</p>
            )}
          </div>
          <button
            onClick={share}
            className="rounded-full bg-black/40 p-2.5 backdrop-blur"
            aria-label={ar ? "مشاركة" : "Share"}
          >
            <ShareIcon />
          </button>
          <Link
            href="/shop"
            className="rounded-full bg-black/40 p-2.5 backdrop-blur"
            aria-label={ar ? "إغلاق" : "Close"}
          >
            <CloseIcon />
          </Link>
        </div>

        <div className="flex-1" />

        {/* The product being held up right now, over the video. */}
        {pinned && (
          <div className="pointer-events-auto px-3 pb-2">
            <button
              onClick={() => addToCart(pinned)}
              className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white/95 p-2 text-start shadow-lg backdrop-blur"
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
                  {pinned.price != null ? egp(pinned.price, lang) : ""}
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
          </div>
        )}

        {/* The room, scrollable: the whole conversation, not the last few. */}
        <div className="px-3 pb-2">
          <LiveComments
            messages={messages}
            ar={ar}
            empty={onAir ? (ar ? "كوني أول من يعلّق" : "Be the first to comment") : null}
            className="max-h-[38dvh] max-w-[80%]"
          />
        </div>

        {/* Bottom bar: say something, see the products, go to checkout. */}
        <div
          className={`bg-gradient-to-t from-black/80 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${
            replay ? "pointer-events-none" : "pointer-events-auto"
          }`}
        >
          {composing ? (
            <Composer ar={ar} onSend={handleSend} onClose={() => setComposing(false)} />
          ) : (
            <div className="flex items-center gap-2">
              {replay ? (
                // The space belongs to the video's own controls now.
                <span className="min-w-0 flex-1" />
              ) : (
                <button
                  onClick={() => (onAir ? setComposing(true) : null)}
                  disabled={!onAir}
                  className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-start text-sm text-white/70 backdrop-blur disabled:opacity-50"
                >
                  {onAir
                    ? ar ? "اكتبي تعليقاً…" : "Say something…"
                    : ar ? "التعليقات مغلقة" : "Comments are closed"}
                </button>
              )}

              {live.products.length > 0 && (
                // A bag glyph and a number meant nothing to half the people
                // who saw it. A photograph of the first item and the word
                // for what it opens needs no explaining.
                <button
                  onClick={() => setSheet(true)}
                  className="pointer-events-auto flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/95 ps-1.5 pe-3.5 text-ink shadow-lg"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {live.products[0]?.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={live.products[0].imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="text-sm font-bold">
                    {ar ? "المنتجات" : "Products"}
                    <span className="ms-1 text-ink-soft">{live.products.length}</span>
                  </span>
                </button>
              )}

              {count > 0 && (
                <Link
                  href="/store/checkout"
                  className="pointer-events-auto h-11 shrink-0 rounded-full bg-rose-600 px-4 text-sm font-bold leading-[2.75rem]"
                >
                  {ar ? `الدفع (${count})` : `Checkout (${count})`}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Products, as a sheet so the video is never covered for long. */}
      {sheet && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50" onClick={() => setSheet(false)}>
          <div
            className="max-h-[70%] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <h2 className="mb-3 text-base font-bold text-ink">
              {ar ? "منتجات البث" : "In this live"}
            </h2>
            <ul className="space-y-2">
              {live.products.map((p) => {
                const soldOut = (p.available ?? 0) <= 0;
                // What is already in the cart, so it can be changed rather
                // than only ever added to.
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
                      <span className="block truncate text-sm font-medium text-ink">{p.productName}</span>
                      <span className="block text-xs text-ink-soft">
                        {p.price != null ? egp(p.price, lang) : "—"}
                        {p.discountCode && (
                          <span className="ms-2 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                            {p.discountCode}
                          </span>
                        )}
                        {soldOut && <span className="ms-2 text-rose-600">{ar ? "نفدت" : "Sold out"}</span>}
                      </span>
                    </span>
                    {/*
                      Adding was the only thing a viewer could do, so a
                      mistaken tap stayed in the cart all the way to checkout.
                      Once something is in, this becomes the way to change how
                      many — and one step below one takes it out.
                    */}
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
                            inCart.quantity > 1
                              ? ar ? "أقل" : "One fewer"
                              : ar ? "حذف" : "Remove"
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
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSheet(false)} className="h-12 flex-1 rounded-xl border border-line text-sm font-semibold text-ink">
                {ar ? "متابعة المشاهدة" : "Keep watching"}
              </button>
              {count > 0 && (
                <Link href="/store/checkout" className="h-12 flex-1 rounded-xl bg-rose-600 text-center text-sm font-bold leading-[3rem] text-white">
                  {ar ? `الدفع (${count})` : `Checkout (${count})`}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The cart drawer lives in the store layout, which this page skips. */}
      <button onClick={() => setOpen(true)} className="hidden" aria-hidden />
    </div>
  );
}

/* -------------------------------- composer -------------------------------- */

/**
 * Saying something, in a box of its own.
 *
 * It used to keep its draft in the page's state, so every keystroke re-rendered
 * the video overlay, the product list and every comment that had arrived. On a
 * phone in the middle of a live that is enough for the text to fall behind the
 * fingers — and for Send to be disabled at the instant it is tapped, which is
 * why it took several taps and sent half a sentence when it finally went. The
 * page no longer hears about the typing at all.
 *
 * Two other things that made Send feel broken are gone with it. It is never
 * disabled, so a tap is never swallowed; and it does not wait for the server —
 * the box empties at once and the request carries on behind it, because a
 * button that appears to do nothing gets pressed again, and again.
 */
function Composer({
  ar,
  onSend,
  onClose,
}: {
  ar: boolean;
  onSend: (authorName: string, body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem("bb_live_name") || "");
    } catch {
      /* private browsing */
    }
  }, []);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    const who = name.trim() || (ar ? "زائرة" : "Guest");
    try {
      localStorage.setItem("bb_live_name", who);
    } catch {
      /* private browsing */
    }
    setDraft("");
    setFailed(false);
    void onSend(who, body).then((ok) => {
      // Hand the words back rather than swallow them.
      if (!ok) {
        setDraft((cur) => cur || body);
        setFailed(true);
      }
    });
  }

  return (
    <div>
      {failed && (
        <p className="mb-1 ps-3 text-[11px] text-rose-300">
          {ar ? "لم يُرسل التعليق. حاولي مرة أخرى." : "That did not send — tap Send again."}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ar ? "اسمك" : "Name"}
          className="h-11 w-20 shrink-0 rounded-full bg-white/15 px-3 text-sm text-white outline-none backdrop-blur placeholder:text-white/50"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          maxLength={240}
          autoFocus
          enterKeyHint="send"
          placeholder={ar ? "اكتبي تعليقاً…" : "Say something…"}
          className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/50"
        />
        <button
          // Without this the tap blurs the input first, the keyboard starts to
          // close, the bar slides out from under the finger and the tap lands
          // on nothing — the other half of why Send needed pressing twice.
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className={`h-11 shrink-0 rounded-full bg-rose-600 px-4 text-sm font-semibold transition-opacity ${
            draft.trim() ? "" : "opacity-40"
          }`}
        >
          {ar ? "إرسال" : "Send"}
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="h-11 w-9 shrink-0 rounded-full bg-white/10 text-white/70"
          aria-label={ar ? "إغلاق" : "Close"}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- player --------------------------------- */

type StreamPlayer = {
  muted: boolean;
  play: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (el: HTMLIFrameElement) => StreamPlayer;
  }
}

type NetworkInfo = { effectiveType?: string; downlink?: number; saveData?: boolean };

/**
 * Whether this viewer is on a connection that cannot afford to be clever.
 *
 * Not every browser will say, and the ones that do are guessing. But a wrong
 * guess here only costs a few seconds of delay, while the right one is the
 * difference between watching the live and watching nothing.
 */
function onASlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const net = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (!net) return false;
  if (net.saveData) return true;
  if (net.effectiveType && /2g|3g/.test(net.effectiveType)) return true;
  return typeof net.downlink === "number" && net.downlink > 0 && net.downlink < 1.5;
}

/**
 * The video, filling the screen.
 *
 * It starts muted because every browser refuses to autoplay sound, and a
 * refusal would leave the viewer staring at a still frame. So it plays
 * immediately without sound and asks for one tap to turn it on — which is
 * also how the apps people are used to behave.
 *
 * Its first duty is to show something. A viewer on a poor connection would
 * rather watch a soft, stuttering picture than a black rectangle, so nothing
 * here is allowed to fail silently: HLS carries the stream at whatever quality
 * the line can bear, WebRTC is only ever an upgrade on top of it, and while
 * neither is producing pictures the screen says so instead of going dark.
 */
function Player({ live, ar }: { live: WatchableLive; ar: boolean }) {
  const onAir = live.status === "live";
  const hls = onAir ? live.playbackUrl : live.recordingUrl;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const replayRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<StreamPlayer | null>(null);
  const [muted, setMuted] = useState(true);
  const [fullScreened, setFullScreened] = useState(false);

  /**
   * WebRTC is an improvement on HLS, and an improvement has to earn its place
   * and keep earning it.
   *
   * Preferring it outright meant a viewer whose connection could not carry it
   * watched a black rectangle, which is worse than being fifteen seconds
   * behind. So HLS plays from the first moment and WebRTC runs behind it,
   * unseen, until it is actually producing pictures — and the moment it stops
   * producing them it is dropped for good and HLS, which never went away, is
   * visible again. HLS drops its own quality as the connection worsens; WebRTC
   * simply freezes, which is why it can never be the only thing playing.
   */
  const [webrtcReady, setWebrtcReady] = useState(false);
  const [webrtcOff, setWebrtcOff] = useState(false);

  /** What the viewer is actually seeing, which decides what we tell them. */
  const [playing, setPlaying] = useState(false);
  const [waited, setWaited] = useState(false);

  const cloudflare = useMemo(() => {
    if (!hls) return null;
    const m = hls.match(/^https:\/\/(customer-[^.]+\.cloudflarestream\.com)\/([^/]+)\//);
    return m ? { host: m[1], uid: m[2] } : null;
  }, [hls]);

  // Say something after a few seconds of nothing, rather than leaving the
  // viewer to decide for themselves whether it is broken.
  useEffect(() => {
    if (playing) {
      setWaited(false);
      return;
    }
    const t = setTimeout(() => setWaited(true), 6000);
    return () => clearTimeout(t);
  }, [playing]);

  useEffect(() => {
    if (!onAir || !live.whepUrl || webrtcOff) return;
    // A connection this thin cannot carry two streams at once, and WebRTC is
    // the one that would fail. Do not even open it.
    if (onASlowConnection()) return;

    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });

    (async () => {
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.ontrack = (e) => {
          const el = videoRef.current;
          if (!el) return;
          el.srcObject = e.streams[0];
          el.muted = true;
          el.play().catch(() => {});
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve();
          const done = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", done);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", done);
          setTimeout(resolve, 2500);
        });

        const res = await fetch(live.whepUrl!, {
          method: "POST",
          headers: { "content-type": "application/sdp" },
          body: pc.localDescription?.sdp ?? "",
        });
        if (!res.ok) throw new Error(String(res.status));
        const answer = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answer });

        pc.addEventListener("connectionstatechange", () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setWebrtcReady(false);
          }
        });
      } catch {
        // Any refusal at all and HLS simply carries on, which it has been
        // doing since the page opened.
        if (!cancelled) setWebrtcReady(false);
      }
    })();

    return () => {
      cancelled = true;
      pc.close();
      setWebrtcReady(false);
    };
  }, [onAir, live.whepUrl, webrtcOff]);

  /**
   * A frozen picture reports itself as connected and playing, so the only
   * honest test is whether the clock is still moving. Four seconds of a
   * stopped clock and WebRTC has had its chance: HLS is uncovered, and we do
   * not try again, because a connection that could not hold it once will not
   * hold it on the next attempt either.
   */
  useEffect(() => {
    if (!webrtcReady) return;
    let last = -1;
    let strikes = 0;
    const t = setInterval(() => {
      const el = videoRef.current;
      if (!el) return;
      if (el.currentTime === last) {
        strikes += 1;
        if (strikes >= 3) {
          setWebrtcReady(false);
          setWebrtcOff(true);
        }
      } else {
        strikes = 0;
        last = el.currentTime;
      }
    }, 1300);
    return () => clearInterval(t);
  }, [webrtcReady]);

  // Cloudflare's HLS player is cross-origin, so unmuting it needs their SDK —
  // which is also the only way to hear whether it is playing or buffering.
  useEffect(() => {
    if (!cloudflare) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-cf-stream-sdk]");
    const attach = () => {
      if (!iframeRef.current || !window.Stream) return;
      const player = window.Stream(iframeRef.current);
      playerRef.current = player;
      player.addEventListener?.("playing", () => setPlaying(true));
      player.addEventListener?.("play", () => setPlaying(true));
      player.addEventListener?.("waiting", () => setPlaying(false));
      player.addEventListener?.("stalled", () => setPlaying(false));
      player.addEventListener?.("error", () => setPlaying(false));
    };
    if (existing) {
      if (window.Stream) attach();
      else existing.addEventListener("load", attach);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    script.async = true;
    script.dataset.cfStreamSdk = "1";
    script.addEventListener("load", attach);
    document.body.appendChild(script);
  }, [cloudflare]);

  function unmute() {
    setMuted(false);
    if (playerRef.current) {
      playerRef.current.muted = false;
      playerRef.current.play().catch(() => {});
    }
    const el = videoRef.current;
    if (el) {
      el.muted = false;
      el.play().catch(() => {});
    }
  }

  /**
   * A replay, the size of the phone, with sound.
   *
   * Full screen cannot be asked for on the page's behalf — every browser
   * requires the person to ask — so this is what the one tap is for. It is the
   * same tap that turns the sound on, because those are not two decisions:
   * nobody wants a silent video in a small box.
   */
  async function watchProperly() {
    const el = replayRef.current;
    if (!el) return;
    el.muted = false;
    setMuted(false);
    setFullScreened(true);
    try {
      const ios = el as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (ios.webkitEnterFullscreen) ios.webkitEnterFullscreen();
    } catch {
      // Refused, or unsupported. The sound still came on, which was the
      // larger half of what was asked for.
    }
    el.play().catch(() => {});
  }

  const nothing = !hls && !onAir;

  return (
    <div className="absolute inset-0">
      {nothing ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
          {live.status === "scheduled"
            ? ar ? "لم يبدأ البث بعد" : "The live has not started yet"
            : live.status === "ended"
              ? ar
                ? "جارٍ تجهيز التسجيل — عودي بعد دقائق قليلة."
                : "The replay is being prepared — check back in a few minutes."
              : ar ? "لا يوجد فيديو" : "No video"}
        </div>
      ) : (
        <>
          {/* HLS: what is actually watched until WebRTC proves itself. It
              adapts its quality to the connection, so it keeps playing where
              WebRTC would stop. */}
          {hls &&
            (cloudflare ? (
              <iframe
                ref={iframeRef}
                src={`https://${cloudflare.host}/${cloudflare.uid}/iframe?autoplay=true&muted=true&controls=false&preload=auto`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className={`h-full w-full border-0 ${webrtcReady ? "invisible" : ""}`}
                title={live.title}
              />
            ) : (
              /*
               * A replay is fitted, never cropped. A live fills the screen
               * because it is framed for one, but a recording carries
               * whatever shape the host's phone happened to be held in, and
               * stretching it to fit cuts her out of her own video. It gets
               * the browser's controls too: a recording that cannot be
               * paused or wound back is barely a recording.
               */
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={replayRef}
                src={hls}
                autoPlay
                playsInline
                muted
                loop={onAir}
                controls={!onAir}
                preload="auto"
                // Something to look at while the first seconds arrive. A
                // replay opening on black reads as broken; opening on the
                // live's own cover reads as loading.
                poster={!onAir ? (live.coverUrl ?? undefined) : undefined}
                onPlaying={() => setPlaying(true)}
                onWaiting={() => setPlaying(false)}
                onStalled={() => setPlaying(false)}
                className={`h-full w-full ${onAir ? "object-cover" : "object-contain"} ${
                  webrtcReady ? "invisible" : ""
                }`}
              />
            ))}

          {/* WebRTC: hidden until it has frames, so it can never be a black
              rectangle over a working stream. */}
          {onAir && live.whepUrl && !webrtcOff && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onPlaying={(e) => {
                if (e.currentTarget.videoWidth > 0) {
                  setWebrtcReady(true);
                  setPlaying(true);
                }
              }}
              onEmptied={() => setWebrtcReady(false)}
              className={`absolute inset-0 h-full w-full object-cover ${webrtcReady ? "" : "invisible"}`}
            />
          )}
        </>
      )}

      {/*
        Never a bare black screen. Until something is actually on the glass the
        viewer is told what is happening, and after a few seconds of nothing
        they are told that a slow connection is the likely reason and that it
        is still trying — which is true, and is what keeps them from leaving.
      */}
      {!nothing && !playing && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 px-8 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm font-medium text-white/90">
            {!hls
              ? ar ? "البث على وشك البدء…" : "The live is about to start…"
              : onAir
                ? ar ? "جارٍ تحميل البث…" : "Loading the live…"
                : ar ? "جارٍ تحميل التسجيل…" : "Loading the replay…"}
          </p>
          {waited && (
            <p className="text-xs leading-relaxed text-white/60">
              {onAir
                ? ar
                  ? "الاتصال بطيء — ستقل جودة الصورة تلقائياً حتى يعمل البث."
                  : "Your connection is slow — the picture will drop in quality rather than stop."
                : ar
                  ? "التسجيل كبير وما زال يُحمَّل — سيبدأ بعد لحظات."
                  : "It is a long recording and still arriving — it will start in a moment."}
            </p>
          )}
        </div>
      )}

      {/*
        A replay gets the bigger offer. It is the thing a customer was sent a
        link to, so the first tap should give them the whole of it — sound and
        the whole screen — rather than sound in a small box with the rest left
        to be discovered.
      */}
      {!nothing && !onAir && !fullScreened && (
        <button
          onClick={watchProperly}
          className="absolute inset-x-0 top-1/2 z-10 mx-auto flex w-fit -translate-y-1/2 items-center gap-2.5 rounded-full bg-rose-600 px-6 py-3.5 text-base font-bold text-white shadow-2xl"
        >
          <PlayIcon />
          {ar ? "شاهدي بملء الشاشة" : "Watch full screen"}
        </button>
      )}

      {!nothing && onAir && muted && playing && (
        <button
          onClick={unmute}
          className="absolute inset-x-0 top-1/2 z-10 mx-auto flex w-fit -translate-y-1/2 items-center gap-2 rounded-full bg-black/70 px-5 py-3 text-sm font-semibold text-white backdrop-blur"
        >
          <SoundIcon />
          {ar ? "اضغطي للصوت" : "Tap for sound"}
        </button>
      )}
    </div>
  );
}
/* --------------------------------- icons ---------------------------------- */

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 3v13M8 7l4-4 4 4" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M8 5.5v13l11-6.5L8 5.5Z" />
  </svg>
);

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" />
  </svg>
);
