"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveMessage } from "@/lib/live";

/**
 * The room, over the picture.
 *
 * Both sides of a live read the same comments — the viewer over the video, the
 * host over her own camera — so they read them from the same component.
 *
 * It showed the last handful and nothing else, which meant a comment was gone
 * a few seconds after it was made. Anyone who looked away, or who was reading
 * while three more arrived, had no way back to it. Now the whole conversation
 * is there and can be scrolled.
 *
 * Scrolling and arriving fight each other, so the rule is the one every chat
 * app settles on: while you are at the bottom it follows the newest comment,
 * and the moment you scroll up it stops and lets you read. It says how many
 * you have missed and takes you back down when you ask. Nothing ever moves
 * under your thumb while you are reading.
 */
export function LiveComments({
  messages,
  ar,
  empty,
  className = "",
}: {
  messages: LiveMessage[];
  ar: boolean;
  /** Shown when nobody has said anything yet; omit for no placeholder. */
  empty?: string | null;
  /** Where to stop growing, e.g. "max-h-[38dvh]". */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);
  const [missed, setMissed] = useState(0);
  const seen = useRef(messages.length);

  useEffect(() => {
    const el = ref.current;
    const arrived = messages.length - seen.current;
    seen.current = messages.length;
    if (!el) return;
    if (following) {
      el.scrollTop = el.scrollHeight;
      setMissed(0);
    } else if (arrived > 0) {
      setMissed((n) => n + arrived);
    }
  }, [messages.length, following]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    // A little slack: a list that only counts as "at the bottom" at exactly
    // the bottom stops following after a single clumsy pixel.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setFollowing(atBottom);
    if (atBottom) setMissed(0);
  }

  function backToNewest() {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setFollowing(true);
    setMissed(0);
  }

  // Older comments dissolve at the top edge rather than being sliced off, so
  // the list has no hard line across the video.
  const fade = "linear-gradient(to bottom, transparent 0, #000 28px)";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className={`pointer-events-auto overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        <div className="flex flex-col items-start gap-1.5 pt-7">
          {messages.length === 0
            ? empty && (
                <div className="w-fit rounded-2xl bg-black/35 px-3 py-1.5 text-[13px] text-white/60 backdrop-blur">
                  {empty}
                </div>
              )
            : messages.map((m) => (
                <div
                  key={m.id}
                  className="w-fit max-w-full rounded-2xl bg-black/45 px-3 py-1.5 text-[13px] leading-snug backdrop-blur"
                >
                  <span className={m.isHost ? "font-bold text-amber-300" : "font-semibold text-white/80"}>
                    {m.authorName}
                  </span>{" "}
                  <span className="text-white">{m.body}</span>
                </div>
              ))}
        </div>
      </div>

      {missed > 0 && (
        <button
          onClick={backToNewest}
          className="pointer-events-auto absolute -bottom-1 start-0 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white shadow-lg"
        >
          {ar ? `${missed} تعليق جديد ↓` : `${missed} new ↓`}
        </button>
      )}
    </div>
  );
}
