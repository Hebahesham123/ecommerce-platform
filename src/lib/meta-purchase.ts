import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { sendConversionEvent, sha256 } from "@/lib/meta";

/**
 * Report a placed order to Meta's Conversions API.
 *
 * Without this the Conversions API is connected to nothing: the browser pixel
 * only fires Purchase on paths that look like Shopify's thank-you page, and
 * this store's is /store/order/<number>, so no purchase was ever reported from
 * either side. A server-side event is also the more reliable half — it survives
 * ad blockers, and it carries the real order total instead of a guess.
 *
 * `event_id` is the order number, which is what lets Meta discard a duplicate
 * if a browser-side Purchase is ever added for the same order.
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

export async function sendOrderPurchase(order: PurchaseInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("meta_connection")
      .select("pixel_id, capi_token, access_token, capi_enabled, test_event_code")
      .eq("id", "default")
      .maybeSingle();

    if (!data?.capi_enabled) return;
    const pixelId = data.pixel_id as string | undefined;
    // A dedicated CAPI token is preferred; an OAuth token still works.
    const token = ((data.capi_token as string) || (data.access_token as string)) ?? "";
    if (!pixelId || !token) return;

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
      response = await sendConversionEvent(
        pixelId,
        token,
        {
          event_name: "Purchase",
          event_id: order.orderNumber,
          user_data,
          custom_data,
        },
        (data.test_event_code as string) || undefined,
      );
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
        value: custom_data.value,
        matched_on: Object.keys(user_data),
      },
      response,
    });
  } catch {
    /* an order must never fail because an ad platform was unreachable */
  }
}
