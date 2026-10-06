import "server-only";
import { randomUUID } from "crypto";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  DEFAULT_TRACKING,
  normalizeTracking,
  type Tracking,
} from "@/lib/tracking-types";

/**
 * The one place that decides which Google Analytics 4 tag this store fires and
 * which Search Console token it proves ownership with — the GA4/GSC twin of
 * meta-pixel.ts.
 *
 * Both the storefront <head> injection and the server-side purchase event read
 * from here. Like the pixel it sits on the hot path of every page, so the
 * config is cached in memory with a short self-healing TTL plus an explicit
 * invalidation from the admin save. Nothing in here ever throws: analytics must
 * never be able to break a page or an order.
 */

// Re-export the pure config shape/helpers so server importers keep working.
// The admin form imports these from @/lib/tracking-types directly (that module
// is client-safe — this one is server-only).
export { DEFAULT_TRACKING, normalizeTracking };
export type { Tracking };

// ---- Cached read ------------------------------------------------------------
const TTL_MS = 60_000;
let cache: { at: number; value: Tracking } | null = null;

/** Forget the cached tracking config (call after the admin save). */
export function invalidateTracking(): void {
  cache = null;
}

/** Read the merchant's tracking config, defaulting sensibly when absent. Never throws. */
export async function readTracking(): Promise<Tracking> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (!isSupabaseConfigured()) return DEFAULT_TRACKING;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const raw = (data?.data as Record<string, unknown> | null)?.tracking;
    const value = normalizeTracking(raw);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_TRACKING;
  }
}

// ---- Injected HTML ----------------------------------------------------------
/** Escape a value before it is interpolated into injected HTML. */
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// Google's own id format. Anything else is a paste error, not a tag — refusing
// it keeps a broken id out of a <script src>.
const GA4_ID_RE = /^G-[A-Z0-9]+$/;

/**
 * The async gtag.js loader + config block to inject, or "" when GA4 is off or
 * the id is missing/malformed. Reads through the cached config, so this is
 * effectively cached too.
 */
export async function getGa4Snippet(): Promise<string> {
  const t = await readTracking();
  if (!t.ga4Enabled || !GA4_ID_RE.test(t.ga4Id)) return "";
  const id = esc(t.ga4Id);
  return `<!-- Google Analytics 4 (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
</script>
<!-- End Google Analytics 4 -->`;
}

/** The Search Console ownership <meta>, or "" when no token is configured. */
export async function getGscMeta(): Promise<string> {
  const t = await readTracking();
  if (!t.gscVerification) return "";
  return `<meta name="google-site-verification" content="${esc(t.gscVerification)}">`;
}

// ---- Server-side purchase (Measurement Protocol) ----------------------------
type Ga4Item = {
  item_id?: string;
  item_name?: string;
  price?: number;
  quantity?: number;
};

/**
 * Report a placed order to GA4 via the Measurement Protocol — the GA4 twin of
 * the Meta Conversions API purchase. Fires only when both a measurement id and
 * an API secret are configured. Best-effort and self-contained: an analytics
 * endpoint being unreachable must never affect an order that already succeeded.
 */
export async function sendGa4Purchase(input: {
  orderNumber: string;
  value: number;
  currency?: string;
  items?: Ga4Item[];
  clientId?: string;
}): Promise<void> {
  try {
    const t = await readTracking();
    if (!t.ga4Id || !t.ga4ApiSecret) return;
    const url =
      `https://www.google-analytics.com/mp/collect` +
      `?measurement_id=${encodeURIComponent(t.ga4Id)}` +
      `&api_secret=${encodeURIComponent(t.ga4ApiSecret)}`;
    const body = {
      // GA4 wants the browser's own _ga client id to stitch the sale to the
      // session; the server rarely has it, so a random id is sent instead — the
      // purchase still counts, it just does not join a web session.
      client_id: input.clientId || randomUUID(),
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: input.orderNumber,
            value: Number(input.value) || 0,
            currency: input.currency || "EGP",
            items: input.items ?? [],
          },
        },
      ],
    };
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* an order must never fail because an analytics endpoint was unreachable */
  }
}
