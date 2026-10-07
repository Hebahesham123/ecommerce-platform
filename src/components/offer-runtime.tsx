"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    /** Set by /api/offers/script: arms the popup for the page now showing. */
    __bbOffers?: () => void;
  }
}

/**
 * The website's popups. Loads the popup program once, and since the website
 * changes pages without reloading, asks it to look again on every new page —
 * stopping whatever it was watching on the last one.
 */
export function OfferRuntime() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // The script arms itself for the page it first loads on. After that —
    // including when this component is mounted again by a different layout —
    // it is already there and only needs telling that the page changed.
    if (first.current) {
      first.current = false;
      if (!window.__bbOffers) return;
    }
    window.__bbOffers?.();
  }, [pathname]);

  return <Script src="/api/offers/script" strategy="afterInteractive" />;
}
