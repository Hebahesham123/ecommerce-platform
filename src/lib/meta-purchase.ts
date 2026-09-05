import "server-only";
import { cookies, headers } from "next/headers";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { sendConversionEvent, sha256 } from "@/lib/meta";
import type { Channel } from "@/lib/channel";

/**
 * Report a placed order to Meta's Conversions API.
 *
 * Authenticating takes only the dataset id and a token. Being *useful* takes
 * more: Meta scores every event on how confidently it can tie it to a real
 * person, and an event carrying nothing but a hashed phone number matches
 * poorly, which quietly wastes the ad spend it was meant to optimise.
 *
 * So alongside the hashed customer details this sends the four signals that do
 * most of the matching work — the browser's _fbp cookie, the _fbc click id, the
 * shopper's IP and their user agent. Those four are sent RAW, not hashed; Meta
 * treats them as identifiers rather than personal data, and hashing them makes
 * them useless.
 */

type PurchaseInput = {
  orderNumber: string;
  total: number;
  phone?: string | null;
  email?: string | null;
  customerName?: string | null;
  city?: string | null;
  contentIds?: string[];
  numItems?: number;
  /** Which surface sold it. Decides both the dataset and the action_source. */
  channel: Channel;
};

/** Meta matches on normalised, SHA-256 hashed values — never raw. */
function hashed(value: string | null | undefined): string[] | undefined {
  const v = (value ?? "").trim();
  return v ? [sha256(v)] : undefined;
}

/** Phone must be digits with a country code before hashing. */
function phoneDigits(p: string | null | undefined): string | null {
  const d = String(p ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11 && d.startsWith("0")) return "20" + d.slice(1);
  return d;
}

/**
 * What the browser knows that the database doesn't.
 *
 * `_fbp` is written by the pixel on this same origin and `_fbc` by a click from
 * an ad, so both are readable here — which is the whole reason the pixel and
 * the Conversions API are worth having together rather than either alone.
 */
async function browserSignals(orderNumber: string) {
  try {
    const [h, c] = await Promise.all([headers(), cookies()]);
    const forwarded = h.get("x-forwarded-for") ?? "";
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "https";
    return {
      ip: forwarded.split(",")[0].trim() || h.get("x-real-ip") || null,
      ua: h.get("user-agent") || null,
      fbp: c.get("_fbp")?.value ?? null,
      fbc: c.get("_fbc")?.value ?? null,
      // Required whenever action_source is "website", which it is.
      sourceUrl: host
        ? `${proto}://${host}/store/order/${orderNumber}`
        : process.env.NEXT_PUBLIC_SITE_URL || undefined,
    };
  } catch {
    // Called outside a request (a job, a webhook) — send what we have.
    return { ip: null, ua: null, fbp: null, fbc: null, sourceUrl: undefined };
  }
}

export async function sendOrderPurchase(order: PurchaseInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("meta_connection")
      .select("pixel_id,capi_token,access_token,capi_enabled,app_dataset_id,app_capi_token,app_capi_enabled")
      .eq("id", "default")
      .maybeSingle();
    if (!data) return;

    // A website pixel and an app dataset are different data sources in Meta,
    // each with its own token. Sending an app sale on the web pixel would file
    // it as web traffic, which is worse than not sending it at all.
    const isApp = order.channel === "app";
    const enabled = isApp ? data.app_capi_enabled : data.capi_enabled;
    if (!enabled) return;

    const pixelId = (isApp ? data.app_dataset_id : data.pixel_id) as string | undefined;
    // A dedicated CAPI token is preferred; an OAuth token still works for web.
    const token = (isApp
      ? (data.app_capi_token as string)
      : (data.capi_token as string) || (data.access_token as string)) ?? "";
    if (!pixelId || !token) return;

    // Browser identifiers only exist for the website. An app has no _fbp
    // cookie and no page URL; sending empty ones would only muddy the payload.
    const signals = isApp
      ? { ip: null, ua: null, fbp: null, fbc: null, sourceUrl: undefined }
      : await browserSignals(order.orderNumber);

    const name = String(order.customerName ?? "").trim();
    const [first, ...rest] = name ? name.split(/\s+/) : [];
    const user_data: Record<string, string[] | string> = {};

    const ph = phoneDigits(order.phone);
    if (ph) user_data.ph = [sha256(ph)];
    const em = hashed(order.email);
    if (em) user_data.em = em;
    const fn = hashed(first);
    if (fn) user_data.fn = fn;
    const ln = hashed(rest.join(" "));
    if (ln) user_data.ln = ln;
    const ct = hashed(order.city);
    if (ct) user_data.ct = ct;
    user_data.country = [sha256("eg")];

    // Raw on purpose — hashing any of these four breaks the match.
    if (signals.fbp) user_data.fbp = signals.fbp;
    if (signals.fbc) user_data.fbc = signals.fbc;
    if (signals.ip) user_data.client_ip_address = signals.ip;
    if (signals.ua) user_data.client_user_agent = signals.ua;

    const custom_data: Record<string, unknown> = {
      currency: "EGP",
      value: Number(order.total) || 0,
      order_id: order.orderNumber,
      content_type: "product",
    };
    if (order.contentIds?.length) custom_data.content_ids = order.contentIds;
    if (order.numItems) custom_data.num_items = order.numItems;

    let status = "sent";
    let response: unknown;
    try {
      response = await sendConversionEvent(pixelId, token, {
        event_name: "Purchase",
        event_id: order.orderNumber,
        action_source: isApp ? "app" : "website",
        event_source_url: signals.sourceUrl,
        user_data,
        custom_data,
      });
      // Deliberately no test_event_code. It belongs to the "send a test
      // button, and passing it here would route every real sale into the Test
      // Events tab — where it is visible but does not count as a conversion.
      // A merchant who set a code once to check the wiring would have silently
      // stopped reporting sales.
    } catch (e) {
      status = "error";
      response = { error: (e as Error).message };
    }

    await supabase.from("meta_events").insert({
      event_name: "Purchase",
      event_id: order.orderNumber,
      source: "capi",
      status,
      payload: {
        order_id: order.orderNumber,
        channel: order.channel,
        value: custom_data.value,
        // Which identifiers were available, so a poor match quality score in
        // Events Manager can be explained without guessing.
        matched_on: Object.keys(user_data),
      },
      response,
    });
  } catch {
    /* an order must never fail because an ad platform was unreachable */
  }
}
