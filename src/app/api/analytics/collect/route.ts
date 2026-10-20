import { recordSessionHit, recordSiteEvent, sourceOf, type Channel, type Platform } from "@/lib/analytics";
import { attribute, deviceOf, geoOf, TRACKED_PARAMS } from "@/lib/analytics-attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a pageview lands.
 *
 * Open by design: it is the storefront and the app telling their own shop what
 * was looked at. It takes no names, no phone numbers and no cookies - a
 * visitor id the browser made up for itself, the path, and where the visit
 * came from. The referrer is reduced to its site rather than stored whole, and
 * of the landing address only the campaign tags and ad click ids are kept
 * (`params`), never the rest of its query string.
 *
 * Each pageview also moves its visit along in analytics_sessions, which is
 * what the Analytics page reports from: the first page of a visit records
 * where it came from (source, social network, campaign), what it is on
 * (device, browser, system) and roughly where (country and city, from the
 * hosting network's lookup of the connection).
 *
 * It always answers 204: analytics must never slow a shopper down or show
 * them an error, and a blocked beacon is not the shop's problem to report.
 */
const ok = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

    const visitorId = str(body.visitorId, 64);
    const sessionId = str(body.sessionId, 64);
    if (!visitorId || !sessionId) return ok();

    const channel: Channel = body.channel === "app" ? "app" : "web";
    const kind = body.kind === "session" ? "session" : "pageview";
    const platformRaw = str(body.platform, 12).toLowerCase();
    const platform: Platform | null =
      platformRaw === "ios" || platformRaw === "android" || platformRaw === "web"
        ? (platformRaw as Platform)
        : null;

    // Only the path, never the query string: a search term or an email in a
    // link has no business in an analytics table.
    const path = str(body.path, 300).split("?")[0] || "/";
    const referrer = str(body.referrer, 400);
    const { source: legacySource, host } = sourceOf(referrer);

    // Campaign tags and ad click ids only.
    const params: Record<string, string> = {};
    const rawParams = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
    for (const k of TRACKED_PARAMS) {
      const v = str(rawParams[k], 200).trim();
      if (v) params[k] = v;
    }

    const ua = request.headers.get("user-agent") ?? "";
    const ownHost = new URL(request.url).hostname.replace(/^www\./, "").toLowerCase();
    const where = channel === "app" && !referrer && !Object.keys(params).length
      ? { source: "direct", network: null, referrerHost: null, clickId: null }
      : attribute(referrer, params, ua, ownHost);
    const dev = channel === "app"
      ? { device: "mobile", browser: "BeautyBar app", os: platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Other" }
      : deviceOf(ua);
    const geo = geoOf(request.headers);

    await Promise.all([
      recordSiteEvent({
        kind,
        channel,
        visitorId,
        sessionId,
        path,
        source: legacySource,
        referrerHost: host,
        platform,
        appVersion: str(body.appVersion, 40) || null,
      }),
      recordSessionHit({
        sessionId,
        visitorId,
        channel,
        platform: platform ?? (channel === "web" ? "web" : null),
        path,
        referrerHost: where.referrerHost,
        source: where.source,
        network: where.network,
        utm: params,
        clickId: where.clickId,
        ...dev,
        ...geo,
      }),
    ]);
  } catch {
    /* a malformed beacon is not worth an error page */
  }
  return ok();
}
