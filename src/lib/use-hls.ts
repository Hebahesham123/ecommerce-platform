"use client";

import { useEffect } from "react";

/**
 * Play a source on a video element, whatever kind of source it is.
 *
 * A replay is one of two things now: the original file, which every browser
 * plays, or an adaptive playlist, which only Safari does. The playlist is the
 * one worth having — it starts on a segment of a few seconds instead of on the
 * front of a whole file, and it follows the connection down rather than
 * stalling — so the rest of the browsers are given a library that reads it for
 * them.
 *
 * That library is loaded only when a playlist actually turns up, and never on
 * Safari. A shopper watching ordinary files never downloads it.
 */
export function useHlsSource(
  video: React.RefObject<HTMLVideoElement | null>,
  src: string | null | undefined,
  /** Skip the work entirely for something far down a feed. */
  enabled = true,
) {
  useEffect(() => {
    const el = video.current;
    if (!el || !src || !enabled) return;

    const isPlaylist = /\.m3u8(\?|$)/i.test(src);
    const nativeHls =
      isPlaylist && el.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (!isPlaylist || nativeHls) {
      if (el.getAttribute("src") !== src) el.setAttribute("src", src);
      return;
    }

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) {
        // No library and no native support: the original file is still there,
        // and a caller that has one can fall back to it.
        return;
      }
      const hls = new Hls({
        // A reel is watched now, not scrubbed. Keeping the buffer short is what
        // stops a feed spending a shopper's data on minutes she will swipe past.
        maxBufferLength: 12,
        maxMaxBufferLength: 30,
        // Start modestly and climb: the first segment arriving quickly matters
        // more than it arriving beautifully.
        startLevel: -1,
      });
      instance = hls;
      hls.loadSource(src);
      hls.attachMedia(el);
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [video, src, enabled]);
}
