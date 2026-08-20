"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThemeCustomization } from "@/lib/theme-schema";

/**
 * Renders a theme page from unsaved state and streams it into an iframe.
 *
 * Every change posts the current draft to the theme's /draft route and swaps
 * the returned HTML in via srcdoc, so the preview always shows what you are
 * editing — no save, no page reload. Scroll position is restored afterwards so
 * typing doesn't keep throwing you back to the top.
 */
export type DraftPayload = {
  path: string;
  customization?: ThemeCustomization;
  fileOverrides?: Record<string, string>;
};

export function useLivePreview(themeId: string, debounceMs = 350) {
  const [html, setHtml] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const scrollRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an earlier, slower render overwriting a newer one.
  const seqRef = useRef(0);

  /** Remember where the preview was scrolled to, reported by the iframe. */
  const noteScroll = useCallback((y: number) => {
    scrollRef.current = y;
  }, []);

  const renderNow = useCallback(
    async (payload: DraftPayload) => {
      const seq = ++seqRef.current;
      setRendering(true);
      try {
        const res = await fetch(`/online-store/themes/${themeId}/draft`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        if (seq !== seqRef.current) return; // a newer render already landed
        setHtml(text);
        setError(null);
      } catch (e) {
        if (seq === seqRef.current) setError((e as Error).message);
      } finally {
        if (seq === seqRef.current) setRendering(false);
      }
    },
    [themeId],
  );

  /** Debounced: safe to call on every keystroke. */
  const render = useCallback(
    (payload: DraftPayload) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => renderNow(payload), debounceMs);
    },
    [renderNow, debounceMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /** Put the scroll position back once the fresh document has loaded. */
  const onFrameLoad = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { source: "sf-panel", kind: "scroll", y: scrollRef.current },
      "*",
    );
  }, []);

  return { html, rendering, error, render, renderNow, frameRef, onFrameLoad, noteScroll };
}
