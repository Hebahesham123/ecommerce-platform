import "server-only";
import { createHash } from "crypto";

// Current Graph API version (configurable). v25.0 is current as of 2026.
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const WWW = `https://www.facebook.com/${GRAPH_VERSION}`;

// Permissions needed for Pixel + Catalog + Commerce management.
export const META_SCOPES = [
  "public_profile",
  "email",
  "business_management",
  "ads_management",
  "catalog_management",
  "pages_show_list",
].join(",");

export function metaAppConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// ---- OAuth -----------------------------------------------------------------
export function buildOAuthUrl(redirectUri: string, state: string): string {
  const configId = process.env.META_CONFIG_ID;
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID || "",
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  });
  if (configId) {
    // Facebook Login for Business: permissions come from the configuration.
    p.set("config_id", configId);
  } else {
    // Classic Facebook Login: request permissions via scope.
    p.set("scope", META_SCOPES);
  }
  return `${WWW}/dialog/oauth?${p.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID || "",
    client_secret: process.env.META_APP_SECRET || "",
    redirect_uri: redirectUri,
    code,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${p.toString()}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "token_exchange_failed");
  return j;
}

export async function getLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID || "",
    client_secret: process.env.META_APP_SECRET || "",
    fb_exchange_token: shortToken,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${p.toString()}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "long_lived_failed");
  return j;
}

// ---- Graph helpers ---------------------------------------------------------
export async function graphGet<T = unknown>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const p = new URLSearchParams({ access_token: token, ...params });
  const r = await fetch(`${GRAPH}/${path}?${p.toString()}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `graph_error_${path}`);
  return j as T;
}

export type Named = { id: string; name: string };

/** Fetch the user's businesses, pixels and catalogs for the selection UI. */
export async function fetchAssets(token: string): Promise<{
  user: Named | null;
  businesses: Named[];
  pixels: Named[];
  catalogs: Named[];
}> {
  let user: Named | null = null;
  try {
    user = await graphGet<Named>("me", token, { fields: "id,name" });
  } catch {
    user = null;
  }

  let businesses: Named[] = [];
  try {
    const b = await graphGet<{ data: Named[] }>("me/businesses", token, { fields: "id,name", limit: "50" });
    businesses = b.data ?? [];
  } catch {
    businesses = [];
  }

  const pixels: Named[] = [];
  const catalogs: Named[] = [];
  for (const biz of businesses) {
    try {
      const px = await graphGet<{ data: Named[] }>(`${biz.id}/adspixels`, token, { fields: "id,name", limit: "50" });
      for (const p of px.data ?? []) pixels.push({ id: p.id, name: p.name || `Pixel ${p.id}` });
    } catch {
      /* edge may be unavailable; manual entry covers it */
    }
    try {
      const ct = await graphGet<{ data: Named[] }>(`${biz.id}/owned_product_catalogs`, token, { fields: "id,name", limit: "50" });
      for (const c of ct.data ?? []) catalogs.push({ id: c.id, name: c.name || `Catalog ${c.id}` });
    } catch {
      /* manual entry covers it */
    }
  }
  return { user, businesses, pixels, catalogs };
}

// ---- Catalog sync ----------------------------------------------------------
export type CatalogItem = {
  id: string; // retailer_id
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "refurbished" | "used";
  price: string; // "100.00 EGP"
  link: string;
  image_link: string;
  brand: string;
};

export async function catalogItemsBatch(
  catalogId: string,
  token: string,
  items: CatalogItem[],
): Promise<{ handles?: string[]; validation_status?: unknown[] }> {
  const requests = items.map((data) => ({ method: "UPDATE", data }));
  const body = new URLSearchParams({
    access_token: token,
    item_type: "PRODUCT_ITEM",
    requests: JSON.stringify(requests),
  });
  const r = await fetch(`${GRAPH}/${catalogId}/items_batch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "catalog_batch_failed");
  return j;
}

// ---- Conversions API (used by the events tester) ---------------------------
export type ConversionEvent = {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data?: Record<string, string[] | string>;
  custom_data?: Record<string, unknown>;
};

export async function sendConversionEvent(
  pixelId: string,
  token: string,
  event: ConversionEvent,
  testEventCode?: string,
): Promise<{ events_received?: number; fbtrace_id?: string; messages?: unknown[] }> {
  const data = [
    {
      event_name: event.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.event_id,
      action_source: "website",
      event_source_url: event.event_source_url,
      user_data: event.user_data ?? {},
      custom_data: event.custom_data ?? {},
    },
  ];
  const payload: Record<string, unknown> = { data, access_token: token };
  if (testEventCode) payload.test_event_code = testEventCode;

  const r = await fetch(`${GRAPH}/${pixelId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "capi_send_failed");
  return j;
}

// ---- Pixel base code (for storefront injection) ----------------------------
export function pixelBaseCode(pixelId: string): string {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`;
}
