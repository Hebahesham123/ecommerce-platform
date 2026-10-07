/**
 * The browser's side of shopper tracking.
 *
 * One visitor id for the whole website: the bb_vid cookie, which the theme
 * storefront at /shop and its popup already use, so a shopper who moves
 * between /shop and /store stays one shopper. It is a cookie rather than
 * local storage so the server can read it when an order is placed. A browser
 * that was already counted under the older analytics id keeps that id.
 */

const COOKIE = "bb_vid";
const LEGACY = "bb_visitor";
const YEAR = 365 * 24 * 60 * 60;

function readCookie(name: string): string {
  try {
    const m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

export function visitorId(): string | null {
  if (typeof document === "undefined") return null;
  let id = readCookie(COOKIE);
  if (!id) {
    try {
      id = localStorage.getItem(LEGACY) || "";
    } catch {
      id = "";
    }
    if (!id) id = "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);
    try {
      document.cookie = `${COOKIE}=${encodeURIComponent(id)};path=/;max-age=${YEAR};samesite=lax`;
    } catch {
      return null;
    }
  }
  try {
    localStorage.setItem(LEGACY, id);
  } catch {
    /* the cookie is the one that counts */
  }
  return id;
}

/** A page being previewed in the dashboard is not a shopper. */
function previewing(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("bbpreview") === "1";
  } catch {
    return false;
  }
}

function send(body: Record<string, unknown>) {
  if (previewing()) return;
  const id = visitorId();
  if (!id) return;
  const payload = JSON.stringify({ channel: "web", platform: "web", visitorId: id, ...body });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", body: payload, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    /* tracking never breaks a page */
  }
}

export type TrackData = {
  productId?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
  value?: number | null;
  quantity?: number | null;
  term?: string;
};

export function track(type: string, data: TrackData = {}) {
  send({ type, path: typeof location !== "undefined" ? location.pathname : "", ...data });
}

/**
 * The basket as it stands, sent once it has stopped changing for a moment.
 *
 * Only when it changed since it was last sent — from this tab or an earlier
 * visit — so "left 2 days ago" means the basket was last touched then, not
 * that the shop was last opened then. An empty basket that was never sent is
 * not a basket at all.
 */
const SENT = "bb_cart_sent";
let cartTimer: ReturnType<typeof setTimeout> | null = null;
export function trackCart(
  lines: { itemId: string; name: string; imageUrl: string | null; price: number; quantity: number }[],
) {
  const sig = JSON.stringify(lines.map((l) => [l.itemId, l.quantity]));
  let sent: string | null = null;
  try {
    sent = localStorage.getItem(SENT);
  } catch {
    sent = null;
  }
  if (sig === sent || (sent === null && lines.length === 0)) return;
  if (cartTimer) clearTimeout(cartTimer);
  cartTimer = setTimeout(() => {
    try {
      localStorage.setItem(SENT, sig);
    } catch {
      /* worst case it is sent again next time */
    }
    send({ cart: lines });
  }, 1500);
}
