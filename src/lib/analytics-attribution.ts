/**
 * Where a visit came from, and what it was on — worked out from what the
 * browser sends anyway: the page it came from, the campaign tags and ad click
 * id on the address it landed on, its user agent, and the country and city
 * the hosting network looks up for the connection.
 *
 * Social apps often open links in their own browser and send no referrer at
 * all, so their user agent is read too: an Instagram in-app browser is an
 * Instagram visit even when it says nothing about where it came from.
 */

export type Utm = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

/** Ad click ids, the platform each belongs to. */
const CLICK_IDS: Record<string, string> = {
  fbclid: "facebook",
  gclid: "google",
  gbraid: "google",
  wbraid: "google",
  ttclid: "tiktok",
  sccid: "snapchat",
  ScCid: "snapchat",
  msclkid: "bing",
  twclid: "x",
  li_fat_id: "linkedin",
  epik: "pinterest",
};

/** The query keys the beacons pass on — nothing else on an address is kept. */
export const TRACKED_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", ...Object.keys(CLICK_IDS)];

const NETWORK_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(tiktok\.com|tiktokv\.com)$/, "tiktok"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, "pinterest"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$/, "telegram"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(yahoo\.com|duckduckgo\.com|yandex\.[a-z.]+)$/, "search_other"],
];

const SOCIAL = new Set(["instagram", "facebook", "tiktok", "snapchat", "youtube", "x", "pinterest", "linkedin", "threads", "telegram"]);
const SEARCH = new Set(["google", "bing", "search_other"]);

/** utm_source spellings, to the platform they mean. */
function networkOfName(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  if (/^(ig|insta|instagram)/.test(n)) return "instagram";
  if (/^(fb|facebook|meta|messenger)/.test(n)) return "facebook";
  if (/^(tt|tiktok)/.test(n)) return "tiktok";
  if (/^(sc|snap|snapchat)/.test(n)) return "snapchat";
  if (/^(google|adwords|gads)/.test(n)) return "google";
  if (/^(yt|youtube)/.test(n)) return "youtube";
  if (/^(x|twitter)$/.test(n)) return "x";
  if (/^(wa|whatsapp)/.test(n)) return "whatsapp";
  if (/^(pinterest|pin)$/.test(n)) return "pinterest";
  if (/^bing/.test(n)) return "bing";
  if (/^(email|newsletter|mail|klaviyo|mailchimp)/.test(n)) return "email";
  if (/^(sms)/.test(n)) return "sms";
  return null;
}

function inAppNetwork(ua: string): string | null {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) return "tiktok";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/Pinterest/i.test(ua)) return "pinterest";
  if (/LinkedInApp/i.test(ua)) return "linkedin";
  if (/Twitter/i.test(ua)) return "x";
  return null;
}

export type Attribution = {
  source: "direct" | "search" | "social" | "paid" | "email" | "whatsapp" | "referral" | "sms";
  network: string | null;
  referrerHost: string | null;
  clickId: string | null;
};

export function attribute(referrer: string, params: Record<string, string>, userAgent: string, ownHost: string): Attribution {
  let host: string | null = null;
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\./, "").toLowerCase() : null;
  } catch {
    host = null;
  }
  // Moving around the shop itself is not a source.
  if (host && ownHost && (host === ownHost || host.endsWith("." + ownHost))) host = null;

  const clickKey = Object.keys(CLICK_IDS).find((k) => params[k]);
  const clickNetwork = clickKey ? CLICK_IDS[clickKey] : null;
  const utmSource = params.utm_source ?? "";
  const utmMedium = (params.utm_medium ?? "").toLowerCase();
  const hostNetwork = host ? (NETWORK_HOSTS.find(([re]) => re.test(host!))?.[1] ?? null) : null;
  // An Instagram link to the shop can still carry Facebook's click id: the
  // page it came from (or the app it opened in) says which of the two it was.
  const network =
    networkOfName(utmSource) ?? hostNetwork ?? inAppNetwork(userAgent) ?? clickNetwork ?? null;

  const paidMedium = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|ads?|cpm|display|sponsored|boosted)/.test(utmMedium);
  let source: Attribution["source"];
  if (clickKey || paidMedium) source = "paid";
  else if (/^(email|newsletter)/.test(utmMedium) || network === "email") source = "email";
  else if (utmMedium === "sms" || network === "sms") source = "sms";
  else if (network === "whatsapp") source = "whatsapp";
  else if (network && SOCIAL.has(network)) source = "social";
  else if (network && SEARCH.has(network)) source = "search";
  else if (utmMedium === "social" || utmMedium === "social-media") source = "social";
  else if (host) source = "referral";
  else source = "direct";

  return {
    source,
    network: network === "email" || network === "sms" || network === "search_other" ? null : network,
    referrerHost: host,
    clickId: clickKey ?? null,
  };
}

/** Device, browser and system, from the user agent. Rough, and enough. */
export function deviceOf(ua: string): { device: string; browser: string; os: string } {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)
    ? "tablet"
    : /Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)
      ? "mobile"
      : "desktop";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Android/i.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Other";
  const inApp = inAppNetwork(ua);
  const browser = inApp
    ? inApp.charAt(0).toUpperCase() + inApp.slice(1) + " app"
    : /SamsungBrowser/i.test(ua)
      ? "Samsung Internet"
      : /Edg\//i.test(ua)
        ? "Edge"
        : /OPR\/|Opera/i.test(ua)
          ? "Opera"
          : /Firefox|FxiOS/i.test(ua)
            ? "Firefox"
            : /Chrome|CriOS/i.test(ua)
              ? "Chrome"
              : /Safari/i.test(ua)
                ? "Safari"
                : "Other";
  return { device, browser, os };
}

/** Country, region and city, as the hosting network found them for this connection. */
export function geoOf(headers: Headers): { country: string | null; region: string | null; city: string | null } {
  const read = (k: string) => {
    const v = headers.get(k);
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 80);
    } catch {
      return v.slice(0, 80);
    }
  };
  return {
    country: read("x-vercel-ip-country") ?? read("cf-ipcountry"),
    region: read("x-vercel-ip-country-region"),
    city: read("x-vercel-ip-city"),
  };
}
