"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the shop which screen was just seen.
 *
 * Two ids, both made by the browser and kept in the browser: one for the
 * device (so returning visitors can be counted) and one for the visit, which
 * expires after half an hour of quiet. No name, no phone, no third party, and
 * the whole thing is one small POST that never blocks the page.
 */

const VISITOR = "bb_visitor";
const SESSION = "bb_session";
const SESSION_AT = "bb_session_at";
const HALF_HOUR = 30 * 60 * 1000;

const makeId = () =>
  "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);

function ids(): { visitorId: string; sessionId: string; fresh: boolean } | null {
  try {
    let visitorId = localStorage.getItem(VISITOR);
    if (!visitorId) {
      visitorId = makeId();
      localStorage.setItem(VISITOR, visitorId);
    }
    const last = Number(sessionStorage.getItem(SESSION_AT)) || 0;
    let sessionId = sessionStorage.getItem(SESSION);
    const fresh = !sessionId || Date.now() - last > HALF_HOUR;
    if (fresh) {
      sessionId = makeId();
      sessionStorage.setItem(SESSION, sessionId);
    }
    sessionStorage.setItem(SESSION_AT, String(Date.now()));
    return { visitorId, sessionId: sessionId!, fresh };
  } catch {
    // Private browsing, or storage turned off: no counting, no complaining.
    return null;
  }
}

export function AnalyticsBeacon({
  channel = "web",
  platform,
}: {
  channel?: "web" | "app";
  platform?: "ios" | "android" | "web";
}) {
  const pathname = usePathname();

  useEffect(() => {
    const who = ids();
    if (!who) return;
    const body = JSON.stringify({
      kind: "pageview",
      channel,
      platform: platform ?? "web",
      path: pathname,
      referrer: document.referrer,
      visitorId: who.visitorId,
      sessionId: who.sessionId,
    });
    try {
      // sendBeacon survives the page being closed; fetch is the fallback.
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/collect", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/analytics/collect", { method: "POST", body, keepalive: true });
      }
    } catch {
      /* never let counting break a page */
    }
  }, [pathname, channel, platform]);

  return null;
}
