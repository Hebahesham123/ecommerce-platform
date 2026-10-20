"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, visitorId as sharedVisitorId } from "@/lib/shopper-client";
import { isImportant, labelOf, pressedElement, targetOf } from "@/lib/click-tracking";

/**
 * Tells the shop what was seen, for how long, and what was pressed.
 *
 * Two ids, both made by the browser and kept in the browser: one for the
 * device (so returning visitors can be counted) and one for the visit, which
 * expires after half an hour of quiet. Each page gets an id of its own too, so
 * that when it is left (or the tab is hidden, or closed) the time it was
 * actually on screen and how far it was scrolled can be added to it.
 *
 * Every press on a button or link is sent with its words and whether it is
 * one that matters (see lib/click-tracking). Nothing typed into a field is
 * ever read. No name, no phone, no third party, and each report is one small
 * POST that never blocks the page.
 */

const VISITOR = "bb_visitor";
const SESSION = "bb_session";
const SESSION_AT = "bb_session_at";
const HALF_HOUR = 30 * 60 * 1000;

/** The only parts of an address that are kept: campaign tags and ad click ids. */
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "gbraid", "wbraid", "ttclid", "sccid", "ScCid", "msclkid", "twclid", "li_fat_id", "epik"];

function campaignParams(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of PARAMS) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 200);
    }
  } catch {
    /* no address to read */
  }
  return out;
}

const makeId = () =>
  "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);

function ids(): { visitorId: string; sessionId: string; fresh: boolean } | null {
  try {
    // The same id shopper tracking and the popup use, so a pageview and a
    // product view are the same visitor on the customer's timeline.
    let visitorId = sharedVisitorId() || localStorage.getItem(VISITOR);
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

function post(body: Record<string, unknown>) {
  const json = JSON.stringify(body);
  try {
    // sendBeacon survives the page being closed; fetch is the fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/collect", new Blob([json], { type: "application/json" }));
    } else {
      void fetch("/api/analytics/collect", { method: "POST", body: json, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    /* never let counting break a page */
  }
}

function previewing(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("bbpreview") === "1";
  } catch {
    return false;
  }
}

/** How far down the page has been seen, as a percentage. */
function scrolled(): number {
  const doc = document.documentElement;
  const seen = window.scrollY + window.innerHeight;
  return doc.scrollHeight > 0 ? Math.min(100, Math.round((seen / doc.scrollHeight) * 100)) : 0;
}

export function AnalyticsBeacon({
  channel = "web",
  platform,
  clicks = true,
}: {
  channel?: "web" | "app";
  platform?: "ios" | "android" | "web";
  /** Off where the person pressing is the merchant, not a shopper (the app preview). */
  clicks?: boolean;
}) {
  const pathname = usePathname();
  // The page on screen now: its id, the time on screen so far, and the deepest scroll.
  const page = useRef<{ id: string; visibleMs: number; since: number | null; scroll: number } | null>(null);

  /** Report the current page's time on screen; safe to call more than once. */
  const flush = () => {
    const p = page.current;
    if (!p) return;
    const ms = p.visibleMs + (p.since !== null ? Date.now() - p.since : 0);
    post({ kind: "leave", pageviewId: p.id, seconds: Math.round(ms / 1000), scroll: Math.max(p.scroll, scrolled()) });
  };

  // A page seen.
  useEffect(() => {
    // A page being previewed in the dashboard is not a shopper's visit, and
    // counting it would inflate the merchant's own figures every time they
    // opened the Pages hub.
    if (previewing()) return;
    const who = ids();
    if (!who) return;
    flush();
    const id = "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    page.current = { id, visibleMs: 0, since: document.visibilityState === "visible" ? Date.now() : null, scroll: 0 };
    // The title is read a moment later, once the new page has set it.
    const t = setTimeout(() => {
      post({
        kind: "pageview",
        channel,
        platform: platform ?? "web",
        path: pathname,
        referrer: document.referrer,
        params: campaignParams(),
        visitorId: who.visitorId,
        sessionId: who.sessionId,
        pageviewId: id,
        title: document.title,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, channel, platform]);

  // Time on screen: counted only while the tab is visible; reported when it is hidden or closed.
  useEffect(() => {
    const onVisibility = () => {
      const p = page.current;
      if (!p) return;
      if (document.visibilityState === "hidden") {
        if (p.since !== null) p.visibleMs += Date.now() - p.since;
        p.since = null;
        p.scroll = Math.max(p.scroll, scrolled());
        flush();
      } else {
        p.since = Date.now();
      }
    };
    const onScroll = () => {
      const p = page.current;
      if (p) p.scroll = Math.max(p.scroll, scrolled());
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Presses on buttons and links. At most one every 300ms, and 300 a visit.
  useEffect(() => {
    if (!clicks) return;
    let last = 0;
    let count = 0;
    const onClick = (e: MouseEvent) => {
      if (previewing()) return;
      const el = pressedElement(e.target);
      if (!el) return;
      const now = Date.now();
      if (now - last < 300 || count >= 300) return;
      last = now;
      count++;
      const label = labelOf(el);
      track("click", { label, important: el.hasAttribute("data-track-important") || isImportant(label), target: targetOf(el) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [clicks]);

  return null;
}
