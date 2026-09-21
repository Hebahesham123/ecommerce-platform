"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isTestStream, type LiveMessage, type LiveProduct, type WatchableLive } from "@/lib/live";
import { useCart } from "../../cart";

/**
 * Watching a live.
 *
 * A viewer may do exactly three things: comment, add to cart, and share. They
 * never appear on camera and never speak — so this screen has no camera code
 * and asks for no permissions, which is also why it opens instantly.
 *
 * The products were chosen before the live began, so there is no searching or
 * browsing here either: the host holds something up, pins it, and it is one tap
 * away. Leaving the stream to go and find it is how a live loses a sale.
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
  const listRef = useRef<HTMLDivElement | null>(null);

  const onAir = live.status === "live";
  const pinned = live.products.find((p) => p.pinned) ?? null;

  // Remember what they called themselves, so it is asked once and not per live.
  useEffect(() => {
    try {
      setName(localStorage.getItem("bb_live_name") || "");
    } catch {
      /* private browsing */
    }
  }, []);

  // First paint of the chat comes from the API; Realtime carries it from there.
  useEffect(() => {
    fetch(`/api/storefront/lives/${live.id}/messages`)
      .then((r) => r.json())
      .then((r) => {
        if (r?.ok && Array.isArray(r.data)) setMessages(r.data);
      })
      .catch(() => {});
  }, [live.id]);

  // Realtime: one subscription per viewer, rather than every phone asking the
  // server again every couple of seconds for messages that have not changed.
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
                  ].slice(-200), // a long live would otherwise grow without end
            );
          },
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState() ?? {};
          setViewers(Math.max(1, Object.keys(state).length));
        })
        .subscribe((status) => {
          // At the plan's peer ceiling this is where it gives way: the messages
          // already loaded stay, and the page says it is no longer following.
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

  // Tell the shop how big the room got. Only the highest number sticks.
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

  // While on air, pick up a newly pinned product without a reload.
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

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
      // Realtime echoes it back, but only if the subscription is alive.
      if (!chatLive) setMessages((cur) => [...cur, res.data].slice(-200));
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
    const text = ar ? `${live.title} — بث مباشر` : `${live.title} — live now`;
    try {
      if (navigator.share) await navigator.share({ title: live.title, text, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* the share sheet was dismissed */
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <Player live={live} ar={ar} />

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-ink">{live.title}</h1>
          <p className="text-sm text-ink-muted">
            {live.hostName ? `${live.hostName} · ` : ""}
            {onAir
              ? `${viewers} ${ar ? "يشاهدون الآن" : "watching"}`
              : live.status === "scheduled"
                ? ar ? "لم يبدأ بعد" : "Not started yet"
                : ar ? "إعادة" : "Replay"}
          </p>
        </div>
        <button onClick={share} className="btn-outline h-9 shrink-0 px-3 text-xs">
          {ar ? "مشاركة" : "Share"}
        </button>
      </div>

      {/* What the host is holding up right now. */}
      {pinned && (
        <div className="mt-4 rounded-2xl border-2 border-brand-500 bg-brand-50/40 p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            {ar ? "معروض الآن" : "Showing now"}
          </div>
          <ProductRow p={pinned} ar={ar} lang={lang} added={added === pinned.id} onAdd={addToCart} big />
        </div>
      )}

      {/* Everything the live is advertising, chosen before it began. */}
      {live.products.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {ar ? "منتجات البث" : "In this live"}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {live.products
              .filter((p) => !p.pinned)
              .map((p) => (
                <li key={p.id} className="p-3">
                  <ProductRow p={p} ar={ar} lang={lang} added={added === p.id} onAdd={addToCart} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Comments */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{ar ? "التعليقات" : "Comments"}</h2>
          {onAir && !chatLive && (
            <span className="text-xs text-amber-600">
              {ar ? "التحديث المباشر متوقف" : "Not following new comments"}
            </span>
          )}
        </div>

        <div
          ref={listRef}
          className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-line p-3"
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">
              {onAir
                ? ar ? "كوني أول من يعلّق" : "Be the first to comment"
                : ar ? "لا توجد تعليقات" : "No comments"}
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className={`font-semibold ${m.isHost ? "text-brand-700" : "text-ink"}`}>
                  {m.authorName}
                  {m.isHost && <span className="ms-1 text-[10px] uppercase">{ar ? "المضيفة" : "host"}</span>}
                </span>
                <span className="text-ink-muted"> {m.body}</span>
              </div>
            ))
          )}
        </div>

        {onAir ? (
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ar ? "اسمك" : "Your name"}
              className="h-11 w-28 shrink-0 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={240}
              placeholder={ar ? "اكتبي تعليقاً…" : "Write a comment…"}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
            />
            <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary h-11 px-4 text-sm disabled:opacity-50">
              {ar ? "إرسال" : "Send"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">
            {ar ? "التعليقات مفتوحة أثناء البث فقط." : "Comments are open while the live is on air."}
          </p>
        )}
      </section>

      {/* Checkout is the point of all of this, so the way out is always visible. */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button onClick={() => setOpen(true)} className="btn-outline h-12 flex-1 justify-center text-sm">
              {ar ? `السلة (${count})` : `Cart (${count})`}
            </button>
            <Link href="/store/checkout" className="btn-primary h-12 flex-1 justify-center text-sm">
              {ar ? "إتمام الطلب" : "Checkout"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- player --------------------------------- */

/**
 * Cloudflare's own player is used when the video is Cloudflare's: it handles
 * every browser, adapts quality to the connection, and costs us no library.
 * Anything else — the rehearsal clip — falls back to the browser's own video
 * element, which plays HLS natively on iOS and Safari.
 */
function Player({ live, ar }: { live: WatchableLive; ar: boolean }) {
  const src = live.status === "live" ? live.playbackUrl : live.recordingUrl;

  const cloudflareEmbed = useMemo(() => {
    if (!src) return null;
    const m = src.match(/^https:\/\/(customer-[^.]+\.cloudflarestream\.com)\/([^/]+)\//);
    return m ? `https://${m[1]}/${m[2]}/iframe?autoplay=true&muted=false` : null;
  }, [src]);

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-slate-900 text-center text-sm text-white/70">
        {live.status === "scheduled"
          ? ar ? "لم يبدأ البث بعد" : "The live has not started yet"
          : ar ? "لا يوجد فيديو" : "No video"}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      {cloudflareEmbed ? (
        <iframe
          src={cloudflareEmbed}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className="aspect-video w-full border-0"
          title={live.title}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={src} controls autoPlay playsInline className="aspect-video w-full" />
      )}
      {live.status === "live" && (
        <span className="absolute start-3 top-3 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold uppercase text-white">
          {ar ? "مباشر" : "Live"}
        </span>
      )}
      {isTestStream(live) && (
        <span className="absolute end-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase text-white">
          {ar ? "تجريبي" : "Test"}
        </span>
      )}
    </div>
  );
}

/* -------------------------------- product --------------------------------- */

function ProductRow({
  p,
  ar,
  lang,
  added,
  onAdd,
  big,
}: {
  p: LiveProduct;
  ar: boolean;
  lang: "ar" | "en";
  added: boolean;
  onAdd: (p: LiveProduct) => void;
  big?: boolean;
}) {
  const soldOut = (p.available ?? 0) <= 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`${big ? "h-16 w-16" : "h-12 w-12"} shrink-0 overflow-hidden rounded-xl border border-line bg-white`}>
        {p.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium text-ink ${big ? "text-[15px]" : "text-sm"}`}>{p.productName}</div>
        <div className="text-xs text-ink-soft">
          {p.price != null ? egp(p.price, lang) : "—"}
          {p.discountCode && (
            <span className="ms-2 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              {p.discountCode}
            </span>
          )}
          {soldOut && <span className="ms-2 text-rose-600">{ar ? "نفدت" : "Sold out"}</span>}
        </div>
      </div>
      <button
        onClick={() => onAdd(p)}
        disabled={soldOut}
        className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40 ${
          added ? "bg-emerald-600 text-white" : "bg-brand text-white hover:bg-brand-700"
        }`}
      >
        {added ? (ar ? "تمت الإضافة" : "Added") : ar ? "أضيفي" : "Add"}
      </button>
    </div>
  );
}
