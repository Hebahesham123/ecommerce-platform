import { getActiveNudge, recordNudgeEvent } from "@/lib/nudge-service";
import type { NudgeEventType } from "@/lib/nudge";
import { fail, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The smart popup, for the app.
 *
 * Campaigns already exist and the web storefront already draws them. The app
 * was the one surface that could not, so a shop running a wheel saw it on the
 * site and nowhere else. This hands the app the same campaign — same triggers,
 * same wording, same discount codes — and lets it draw the thing itself,
 * rather than the app growing a second, drifting copy of the idea.
 */
export async function GET() {
  try {
    return ok({ campaign: await getActiveNudge() });
  } catch (e) {
    return fail((e as Error).message, 503);
  }
}

const EVENTS: NudgeEventType[] = ["hesitation", "shown", "dismissed", "claimed", "converted"];
const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Record what the shopper did with it.
 *
 * Best effort, exactly as on the web: this is analytics riding along on
 * someone's shopping, and a popup that fails to log must never be a popup that
 * fails to close.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const type = String(body.type ?? "");
    const visitorId = text(body.visitorId);
    if (!visitorId || !EVENTS.includes(type as NudgeEventType)) {
      return ok({ recorded: false });
    }
    await recordNudgeEvent({
      campaignId: text(body.campaignId),
      visitorId,
      sessionId: text(body.sessionId),
      type: type as NudgeEventType,
      trigger: text(body.trigger),
      path: text(body.path),
      code: text(body.code),
    });
    return ok({ recorded: true });
  } catch {
    return ok({ recorded: false });
  }
}
