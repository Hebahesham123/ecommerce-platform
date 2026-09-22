"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isTestStream, type LiveMessage, type LiveProduct, type WatchableLive } from "@/lib/live";
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
  const { add, count, setOpen } = useCart();

  const [live, setLive] = useState(initial);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState(1);
  const [chatLive, setChatLive] = useState(true);
  const [added, setAdded] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [composing, setComposing] = useState(false);

  const onAir = live.status === "live";
  const pinned = live.products.find((p) => p.pinned) ?? null;

  useEffect(() => {
    try {
      setName(localStorage.getItem("bb_live_name") || "");
    } catch {
      /* private browsing */
    }
  }, []);

  useEffect(() => {
    fetch(`/api/storefront/lives/${live.id}/messages`)
      .then((r) => r.json())
      .then((r) => {
        if (r?.ok && Array.isArray(r.data)) setMessages(r.data);
      })
      .catch(() => {});
  }, [live.id]);

  // One subscription per viewer beats 500 phones polling a route.
  useEffect(() => {
    if (!onAir) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    try {
      const supabase = getBrowserSupabase();
      channel = supabase
        .channel(`live:${live.id}`, { config: { presence: { key: crypto.randomUUID() } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_stream_messages", filter: `live_id=eq.${live.id}` },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            if (row.hidden) return;
            setMessages((cur) =>
              cur.some((m) => m.id === String(row.id))
                ? cur
                : [
                    ...cur,
                    {
                      id: String(row.id),
                      liveId: String(row.live_id),
                      authorName: String(row.author_name ?? ""),
                      body: String(row.body ?? ""),
                      isHost: Boolean(row.is_host),
                      offsetMs: row.offset_ms == null ? null : Number(row.offset_ms),
                      createdAt: String(row.created_at ?? ""),
                    },
                  ].slice(-60),
            );
          },
        )
        .on("presence", { event: "sync" }, () => {
          setViewers(Math.max(1, Object.keys(channel?.presenceState() ?? {}).length));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setChatLive(true);
            channel?.track({ at: Date.now() });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setChatLive(false);
          }
        });
    } catch {
      setChatLive(false);
    }
    return () => {
      channel?.unsubscribe();
    };
  }, [live.id, onAir]);

  useEffect(() => {
    if (!onAir || viewers <= 1) return;
    const t = setTimeout(() => {
      fetch(`/api/storefront/lives/${live.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewers }),
      }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [viewers, onAir, live.id]);

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

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const who = name.trim() || (ar ? "زائرة" : "Guest");
    try {
      localStorage.setItem("bb_live_name", who);
    } catch {
      /* private browsing */
    }
    const res = await fetch(`/api/storefront/lives/${live.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorName: who, body }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSending(false);
    if (res?.ok) {
      setDraft("");
      setComposing(false);
      if (!chatLive) setMessages((cur) => [...cur, res.data].slice(-60));
    }
  }

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

  // Only the last handful, the way a live chat reads: the newest at the bottom,
  // older ones fading out rather than demanding to be scrolled.
  const visible = messages.slice(-7);

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
                {viewers} {ar ? "يشاهدون" : "watching"}
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

        {/* Comments rise here. */}
        <div className="pointer-events-none px-3 pb-2">
          <div className="flex max-w-[78%] flex-col justify-end gap-1.5">
            {visible.map((m, i) => (
              <div
                key={m.id}
                // Older messages recede instead of being cut off, so the eye
                // lands on what was just said.
                style={{ opacity: 0.35 + (0.65 * (i + 1)) / visible.length }}
                className="w-fit max-w-full rounded-2xl bg-black/45 px-3 py-1.5 text-[13px] leading-snug backdrop-blur"
              >
                <span className={m.isHost ? "font-bold text-amber-300" : "font-semibold text-white/80"}>
                  {m.authorName}
                </span>{" "}
                <span className="text-white">{m.body}</span>
              </div>
            ))}
            {onAir && messages.length === 0 && (
              <div className="w-fit rounded-2xl bg-black/35 px-3 py-1.5 text-[13px] text-white/60 backdrop-blur">
                {ar ? "كوني أول من يعلّق" : "Be the first to comment"}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar: say something, see the products, go to checkout. */}
        <div className="pointer-events-auto bg-gradient-to-t from-black/80 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {composing ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ar ? "اسمك" : "Name"}
                className="h-11 w-24 shrink-0 rounded-full bg-white/15 px-3 text-sm text-white outline-none backdrop-blur placeholder:text-white/50"
              />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                maxLength={240}
                autoFocus
                placeholder={ar ? "اكتبي تعليقاً…" : "Say something…"}
                className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/50"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="h-11 shrink-0 rounded-full bg-rose-600 px-4 text-sm font-semibold disabled:opacity-40"
              >
                {ar ? "إرسال" : "Send"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => (onAir ? setComposing(true) : null)}
                disabled={!onAir}
                className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-start text-sm text-white/70 backdrop-blur disabled:opacity-50"
              >
                {onAir
                  ? ar ? "اكتبي تعليقاً…" : "Say something…"
                  : ar ? "التعليقات مغلقة" : "Comments are closed"}
              </button>

              {live.products.length > 0 && (
                <button
                  onClick={() => setSheet(true)}
                  className="relative h-11 shrink-0 rounded-full bg-white/15 px-4 text-sm font-semibold backdrop-blur"
                >
                  🛍 {live.products.length}
                </button>
              )}

              {count > 0 && (
                <Link
                  href="/store/checkout"
                  className="h-11 shrink-0 rounded-full bg-rose-600 px-4 text-sm font-bold leading-[2.75rem]"
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
                    <button
                      onClick={() => addToCart(p)}
                      disabled={soldOut}
                      className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40 ${
                        added === p.id ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    >
                      {added === p.id ? (ar ? "تمت" : "Added") : ar ? "أضيفي" : "Add"}
                    </button>
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

/* --------------------------------- player --------------------------------- */

declare global {
  interface Window {
    Stream?: (el: HTMLIFrameElement) => { muted: boolean; play: () => Promise<void> };
  }
}

/**
 * The video, filling the screen.
 *
 * It starts muted because every browser refuses to autoplay sound, and a
 * refusal would leave the viewer staring at a still frame. So it plays
 * immediately without sound and asks for one tap to turn it on — which is
 * also how the apps people are used to behave.
 */
function Player({ live, ar }: { live: WatchableLive; ar: boolean }) {
  const src = live.status === "live" ? live.playbackUrl : live.recordingUrl;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<{ muted: boolean; play: () => Promise<void> } | null>(null);
  const [muted, setMuted] = useState(true);

  const cloudflare = useMemo(() => {
    if (!src) return null;
    const m = src.match(/^https:\/\/(customer-[^.]+\.cloudflarestream\.com)\/([^/]+)\//);
    return m ? { host: m[1], uid: m[2] } : null;
  }, [src]);

  // Cloudflare's player is cross-origin, so unmuting it needs their SDK: a
  // postMessage bridge to the iframe. Without it the speaker button in our UI
  // could do nothing at all.
  useEffect(() => {
    if (!cloudflare) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-cf-stream-sdk]");
    const attach = () => {
      if (iframeRef.current && window.Stream) playerRef.current = window.Stream(iframeRef.current);
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
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
  }

  return (
    <div className="absolute inset-0">
      {!src ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
          {live.status === "scheduled"
            ? ar ? "لم يبدأ البث بعد" : "The live has not started yet"
            : ar ? "لا يوجد فيديو" : "No video"}
        </div>
      ) : cloudflare ? (
        <iframe
          ref={iframeRef}
          src={`https://${cloudflare.host}/${cloudflare.uid}/iframe?autoplay=true&muted=true&controls=false&preload=auto`}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className="h-full w-full border-0"
          title={live.title}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={src}
          autoPlay
          playsInline
          muted
          loop
          className="h-full w-full object-cover"
        />
      )}

      {src && muted && (
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

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" />
  </svg>
);
