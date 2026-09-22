"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { LiveMessage } from "@/lib/live";

/**
 * Live chat, for whoever is watching — the host over her own camera, and every
 * viewer over the video. One implementation, because the two must agree about
 * what was said and when.
 *
 * Messages travel by Realtime *broadcast*, not by watching the table. Watching
 * the table means every insert is re-checked against the row policy for every
 * subscriber before it is delivered, and that policy asks whether the stream is
 * still on air — a join, per message, per phone. At 500 viewers that is where
 * the delay came from. A broadcast is a message on a channel: no database round
 * trip, no per-row check, and it arrives in the time it takes to cross the
 * network.
 *
 * The database is still written first, by the server, because a comment has to
 * survive for moderation and for the replay. The broadcast is how it travels,
 * not where it lives — and a poll every few seconds reconciles anything a
 * broadcast missed, since broadcasts are fire-and-forget by design.
 */

type Options = {
  /** Only subscribe while there is something to listen to. */
  enabled?: boolean;
  /** How many to keep. A long live would otherwise grow without end. */
  keep?: number;
  /**
   * How a message is written. The host uses an admin action so her comment
   * can carry the host mark; the public route never accepts that claim.
   */
  postVia?: (input: { authorName: string; body: string }) => Promise<LiveMessage | null>;
};

export type LiveChat = {
  messages: LiveMessage[];
  viewers: number;
  /** False when the channel could not be joined — the UI can say so. */
  connected: boolean;
  send: (input: { authorName: string; body: string; isHost?: boolean }) => Promise<boolean>;
};

export function useLiveChat(
  liveId: string,
  { enabled = true, keep = 60, postVia }: Options = {},
): LiveChat {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [viewers, setViewers] = useState(1);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null>(null);

  const merge = useCallback(
    (incoming: LiveMessage[]) => {
      setMessages((cur) => {
        const byId = new Map(cur.map((m) => [m.id, m]));
        for (const m of incoming) byId.set(m.id, m);
        return [...byId.values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-keep);
      });
    },
    [keep],
  );

  // What was said before this phone arrived.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/storefront/lives/${liveId}/messages`)
      .then((r) => r.json())
      .then((r) => {
        if (!cancelled && r?.ok && Array.isArray(r.data)) merge(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [liveId, merge]);

  useEffect(() => {
    if (!enabled) return;
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    try {
      channel = getBrowserSupabase().channel(`live:${liveId}`, {
        config: { broadcast: { self: true }, presence: { key: crypto.randomUUID() } },
      });
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "comment" }, ({ payload }) => {
          const m = payload as LiveMessage;
          if (m?.id) merge([m]);
        })
        .on("presence", { event: "sync" }, () => {
          setViewers(Math.max(1, Object.keys(channel?.presenceState() ?? {}).length));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnected(true);
            channel?.track({ at: Date.now() });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnected(false);
          }
        });
    } catch {
      setConnected(false);
    }
    return () => {
      channel?.unsubscribe();
      channelRef.current = null;
    };
  }, [liveId, enabled, merge]);

  // A broadcast is not guaranteed to arrive, and a phone that slept missed
  // everything sent while it was away. This is the safety net, not the path.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      fetch(`/api/storefront/lives/${liveId}/messages`)
        .then((r) => r.json())
        .then((r) => {
          if (r?.ok && Array.isArray(r.data)) merge(r.data);
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [liveId, enabled, merge]);

  const send = useCallback<LiveChat["send"]>(
    async ({ authorName, body }) => {
      const text = body.trim();
      if (!text) return false;
      const written = postVia
        ? await postVia({ authorName, body: text })
        : await fetch(`/api/storefront/lives/${liveId}/messages`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ authorName, body: text }),
          })
            .then((r) => r.json())
            .then((r) => (r?.ok ? (r.data as LiveMessage) : null))
            .catch(() => null);
      if (!written) return false;

      // Show it here at once, and push it to everyone else without waiting for
      // the database to tell them about it.
      merge([written]);
      channelRef.current?.send({ type: "broadcast", event: "comment", payload: written });
      return true;
    },
    [liveId, merge, postVia],
  );

  return { messages, viewers, connected, send };
}
