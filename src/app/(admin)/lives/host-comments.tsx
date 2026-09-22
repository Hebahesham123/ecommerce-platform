"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveChat } from "@/lib/live-chat";
import { postHostMessageAction } from "./actions";

/**
 * The comments, in the live's own drawer.
 *
 * They are also drawn over the camera while broadcasting, but that overlay only
 * exists while the broadcast panel is open — and a live is commonly run across
 * two devices: the phone pointed at the host, the dashboard open next to her.
 * Putting the room here as well means she can read it from wherever she is
 * actually looking, which is the whole point of showing it at all.
 */
export function HostComments({
  liveId,
  live,
  ar,
}: {
  liveId: string;
  /** Chat is only open while the stream is on air. */
  live: boolean;
  ar: boolean;
}) {
  const { messages, connected, send } = useLiveChat(liveId, { enabled: live, keep: 100 });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function reply() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await send({
      authorName: ar ? "المضيفة" : "Host",
      body,
      // The mark itself is applied server-side, by an action only the dashboard
      // can call — the public route will not accept the claim.
    });
    setBusy(false);
    if (ok) setDraft("");
  }

  return (
    <section className="rounded-2xl border border-line p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">
          {ar ? "التعليقات" : "Comments"}
          {messages.length > 0 && (
            <span className="ms-1.5 text-ink-soft">{messages.length}</span>
          )}
        </h3>
        {live && (
          <span className={`text-xs ${connected ? "text-emerald-600" : "text-amber-600"}`}>
            {connected
              ? ar ? "مباشر" : "Live"
              : ar ? "يتم التحديث كل ٦ ثوانٍ" : "Refreshing every 6s"}
          </span>
        )}
      </div>

      <div
        ref={listRef}
        className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl bg-surface-page p-3"
      >
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">
            {live
              ? ar ? "لا توجد تعليقات بعد" : "No comments yet"
              : ar ? "التعليقات تظهر أثناء البث" : "Comments appear while the live is on air"}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug">
              <span className={m.isHost ? "font-bold text-brand-700" : "font-semibold text-ink"}>
                {m.authorName}
              </span>{" "}
              <span className="text-ink-muted">{m.body}</span>
            </div>
          ))
        )}
      </div>

      {live && (
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reply()}
            maxLength={240}
            placeholder={ar ? "ردّي على المشاهدين…" : "Reply to viewers…"}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600"
          />
          <button
            onClick={reply}
            disabled={busy || !draft.trim()}
            className="btn-primary h-10 shrink-0 px-4 text-sm disabled:opacity-40"
          >
            {ar ? "إرسال" : "Send"}
          </button>
        </div>
      )}
    </section>
  );
}
