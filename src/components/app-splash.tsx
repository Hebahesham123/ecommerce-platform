"use client";

import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/lib/app-theme";

/**
 * The picture the app opens on.
 *
 * A campaign only a shopper who scrolls will see is a campaign most shoppers
 * miss. This one is held in front of the app for a moment and then leaves on
 * its own, so the offer is the first thing seen and never the thing in the
 * way: it always goes by itself, a tap anywhere sends it early, and the phone
 * behind it has already finished loading while it was up.
 *
 * How often a shopper meets it is the merchant's call — every open is right
 * for one week of a sale, once a visit is right for most of the year — and it
 * is remembered in the browser, so nothing about it is tracked.
 */

type Target = { handle?: string; url?: string; productId?: string; screen?: string };

const KEY = "bb_splash_seen";
const CACHE = "bb_splash_last";

/**
 * What the picture was last time, so it can be up before the theme arrives.
 *
 * The shipped app compiles its theme in and shows this instantly; a preview
 * has to fetch it first, which would mean the app appearing and then being
 * covered a second later - the one thing an opening picture must not do. So
 * the last one seen is kept, and the fetched settings take over the moment
 * they land.
 */
type Remembered = Pick<
  AppSettings,
  "splashEnabled" | "splashImageUrl" | "splashBg" | "splashSeconds" | "splashExit" | "splashFit" | "splashShow" | "splashSkipLabel"
>;

function readCache(): Remembered | null {
  try {
    const raw = localStorage.getItem(CACHE);
    const v = raw ? (JSON.parse(raw) as Remembered) : null;
    return v && v.splashEnabled && v.splashImageUrl ? v : null;
  } catch {
    return null;
  }
}

function writeCache(s: AppSettings) {
  try {
    localStorage.setItem(
      CACHE,
      JSON.stringify({
        splashEnabled: s.splashEnabled,
        splashImageUrl: s.splashImageUrl,
        splashBg: s.splashBg,
        splashSeconds: s.splashSeconds,
        splashExit: s.splashExit,
        splashFit: s.splashFit,
        splashShow: s.splashShow,
        splashSkipLabel: s.splashSkipLabel,
      }),
    );
  } catch {
    /* nothing to remember it with */
  }
}

/** True when this shopper has already been shown it under the current rule. */
function seenAlready(rule: string): boolean {
  if (rule === "open") return false;
  try {
    if (rule === "session") return sessionStorage.getItem(KEY) === "1";
    const day = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(KEY) === day;
  } catch {
    // Storage turned off: show it, rather than never showing it.
    return false;
  }
}

function remember(rule: string) {
  try {
    if (rule === "session") sessionStorage.setItem(KEY, "1");
    else if (rule === "day") localStorage.setItem(KEY, new Date().toISOString().slice(0, 10));
  } catch {
    /* nothing to remember it with, and nothing worth failing over */
  }
}

export function AppSplash({
  settings,
  ar,
  onOpen,
  /** Bumping this plays it again, which is how the editor previews it. */
  replay = 0,
  /** The editor plays it on demand and never writes the "already seen" mark. */
  rehearsal = false,
}: {
  settings: AppSettings;
  ar: boolean;
  onOpen?: (target: Target) => void;
  replay?: number;
  rehearsal?: boolean;
}) {
  // The editor always means its own draft. Everywhere else, the remembered
  // picture stands in until the fetched one arrives.
  const [remembered] = useState<Remembered | null>(() => (rehearsal ? null : readCache()));
  const live = settings.splashEnabled && Boolean(settings.splashImageUrl);
  const shown: Remembered = live ? settings : (remembered ?? settings);
  const on = Boolean(shown.splashEnabled && shown.splashImageUrl);

  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const timers = useRef<number[]>([]);
  // The picture this run is showing: a second set of settings for the same
  // picture must not cut short the run already on screen.
  const playing = useRef<string>("");

  useEffect(() => {
    if (live && !rehearsal) writeCache(settings);
  }, [live, rehearsal, settings]);

  useEffect(() => {
    if (!on) return;
    // A framed preview of one screen is not the app opening: the Pages hub
    // asks for the bag, or the collection, and an offer over the top of it
    // would be a picture of the wrong thing.
    try {
      if (new URLSearchParams(window.location.search).get("bbpreview") === "1") return;
    } catch {
      /* no search params, no frame */
    }
    if (playing.current === shown.splashImageUrl && replay === 0) return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    if (!rehearsal && seenAlready(shown.splashShow)) {
      setPhase("hidden");
      return;
    }

    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = Math.max(0.5, shown.splashSeconds) * 1000;
    const leaving = quiet ? 180 : 620;

    playing.current = shown.splashImageUrl;
    setPhase("in");
    if (!rehearsal) remember(shown.splashShow);
    timers.current.push(window.setTimeout(() => setPhase("out"), hold));
    timers.current.push(window.setTimeout(() => setPhase("hidden"), hold + leaving));
    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, replay, shown.splashImageUrl, shown.splashSeconds, shown.splashShow, shown.splashExit]);

  if (!on || phase === "hidden") return null;

  const leaving = phase === "out";
  const exit = shown.splashExit;
  const target: Target = {
    handle: settings.splashHandle,
    url: settings.splashUrl,
    productId: settings.splashProductId,
    screen: settings.splashScreen,
  };
  const opens = Boolean(target.handle || target.url || target.productId || target.screen);

  const skip = () => setPhase("out");
  const take = () => {
    setPhase("out");
    if (opens) onOpen?.(target);
  };

  // The curtain is the picture cut in two, each half leaving the way a curtain
  // does. The others move the whole picture, so one layer is enough.
  const halves = exit === "curtain";

  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden"
      style={{ background: shown.splashBg }}
      onClick={opens ? take : skip}
      role="button"
      tabIndex={0}
      aria-label={ar ? "إغلاق" : "Dismiss"}
    >
      {halves ? (
        <>
          <SplashHalf settings={shown} top leaving={leaving} />
          <SplashHalf settings={shown} top={false} leaving={leaving} />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown.splashImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: shown.splashFit === "contain" ? "contain" : "cover",
            transition: "transform 620ms cubic-bezier(0.4, 0, 0.2, 1), opacity 620ms ease",
            transform: leaving
              ? exit === "zoom"
                ? "scale(1.18)"
                : exit === "up"
                  ? "translateY(-100%)"
                  : "none"
              : "none",
            opacity: leaving && exit !== "up" ? 0 : 1,
          }}
        />
      )}

      {shown.splashSkipLabel && !leaving && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
          className="absolute end-3 top-3 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur"
        >
          {shown.splashSkipLabel}
        </button>
      )}
    </div>
  );
}

/** One half of the curtain: the same picture, shown from a different edge. */
function SplashHalf({
  settings,
  top,
  leaving,
}: {
  settings: Remembered;
  top: boolean;
  leaving: boolean;
}) {
  return (
    <div
      className="absolute inset-x-0 h-1/2 overflow-hidden"
      style={{
        top: top ? 0 : "50%",
        transition: "transform 620ms cubic-bezier(0.65, 0, 0.35, 1)",
        transform: leaving ? `translateY(${top ? "-100%" : "100%"})` : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={settings.splashImageUrl}
        alt=""
        className="absolute inset-x-0 h-[200%] w-full"
        style={{
          top: top ? 0 : "-100%",
          objectFit: settings.splashFit === "contain" ? "contain" : "cover",
        }}
      />
    </div>
  );
}
