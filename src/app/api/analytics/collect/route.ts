import { recordSiteEvent, sourceOf, type Channel, type Platform } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a pageview lands.
 *
 * Open by design: it is the storefront and the app telling their own shop what
 * was looked at. It takes no names, no phone numbers and no cookies - a
 * visitor id the browser made up for itself, the path, and where the visit
 * came from. The referrer is grouped here rather than stored whole, so the
 * table cannot become a list of the pages people came from elsewhere.
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
    const { source, host } = sourceOf(str(body.referrer, 400));

    await recordSiteEvent({
      kind,
      channel,
      visitorId,
      sessionId,
      path,
      source,
      referrerHost: host,
      platform,
      appVersion: str(body.appVersion, 40) || null,
    });
  } catch {
    /* a malformed beacon is not worth an error page */
  }
  return ok();
}
