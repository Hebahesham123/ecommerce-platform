"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveMessage } from "@/lib/live";

/**
 * Live chat, for whoever is watching — the host over her own camera, and every
 * viewer over the video. One implementation, because the two must agree about
 * what was said and when.
 *
 * Messages travel over one open connection per phone to our own server
 * (/api/storefront/lives/[id]/stream, server-sent events; see lib/live-hub).
 * When a comment is saved the server pushes it to every open connection at
 * once: no database round trip per message, no third-party realtime service.
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
  /**
   * Who is holding this connection. The host is in the room but is not an
   * audience of one: counting her would mean every live opens on 1 watching
   * and a host with the dashboard open on two screens reads as a crowd.
   */
  role?: "viewer" | "host";
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
  { enabled = true, keep = 60, postVia, role = "viewer" }: Options = {},
): LiveChat {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);

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
    if (!enabled || typeof EventSource === "undefined") return;
    // The browser reconnects by itself if the connection drops.
    const source = new EventSource(`/api/storefront/lives/${liveId}/stream${role === "host" ? "?role=host" : ""}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("comment", (e) => {
      try {
        const m = JSON.parse((e as MessageEvent).data) as LiveMessage;
        if (m?.id) merge([m]);
      } catch {
        /* ignore a malformed event */
      }
    });
    // The host is not counted (?role=host), so this is the audience.
    source.addEventListener("viewers", (e) => {
      try {
        const v = JSON.parse((e as MessageEvent).data) as { viewers?: number };
        if (typeof v.viewers === "number") setViewers(v.viewers);
      } catch {
        /* ignore */
      }
    });
    return () => source.close();
  }, [liveId, enabled, merge, role]);

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

      // Show it here at once; the server has already pushed it to everyone else.
      merge([written]);
      return true;
    },
    [liveId, merge, postVia],
  );

  return { messages, viewers, connected, send };
}
