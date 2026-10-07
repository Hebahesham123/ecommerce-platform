import "server-only";
import { cookies } from "next/headers";
import { getSessionPhone } from "@/lib/store-session";
import { viewerOf } from "@/lib/api/http";
import { claimUniqueCode, decideOffer, recordOfferEvent, type OfferConfig } from "@/lib/offer-decider";
import type { NudgeChannel, NudgeEventType } from "@/lib/nudge";

/**
 * The three things a page asks about popups — which offer to arm, a code for
 * this shopper, and what she did with it — read the same way for the website,
 * the theme storefront and the app. Who she is comes from her session or
 * token, never from the request body.
 */

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function who(req: Request, body: Record<string, unknown>, fallback: NudgeChannel) {
  const c = str(body.channel, 8);
  const channel: NudgeChannel = c === "web" || c === "shop" || c === "app" ? c : fallback;
  let visitorId = str(body.visitorId ?? body.vid, 64) || str(req.headers.get("x-visitor"), 64);
  if (!visitorId) {
    try {
      visitorId = str((await cookies()).get("bb_vid")?.value, 64);
    } catch {
      visitorId = "";
    }
  }
  const phone = viewerOf(req) ?? (await getSessionPhone());
  return { channel, visitorId, phone };
}

export async function decideFromRequest(req: Request, fallback: NudgeChannel): Promise<OfferConfig | null> {
  const body = await bodyOf(req);
  const { channel, visitorId, phone } = await who(req, body, fallback);
  return decideOffer({
    channel,
    visitorId: visitorId || null,
    phone,
    pageType: str(body.pageType, 20),
    productKey: str(body.productKey, 120) || null,
    collectionHandle: str(body.collectionHandle, 120) || null,
    cartCount: Math.max(0, Number(body.cartCount) || 0),
  });
}

export async function claimFromRequest(
  req: Request,
  fallback: NudgeChannel,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const body = await bodyOf(req);
  const { channel, visitorId, phone } = await who(req, body, fallback);
  const campaignId = str(body.cid ?? body.campaignId, 64);
  if (!visitorId || !campaignId) return { ok: false, error: "bad_request" };
  return claimUniqueCode({ campaignId, visitorId, phone, channel, path: str(body.path, 300) || null });
}

const EVENT_TYPES: NudgeEventType[] = ["hesitation", "shown", "dismissed", "claimed"];

export async function eventFromRequest(req: Request, fallback: NudgeChannel): Promise<void> {
  const body = await bodyOf(req);
  const { channel, visitorId, phone } = await who(req, body, fallback);
  const type = str(body.type, 20) as NudgeEventType;
  const id = str(body.cid ?? body.id, 80);
  if (!visitorId || !id || !EVENT_TYPES.includes(type)) return;
  await recordOfferEvent({
    id,
    visitorId,
    phone,
    channel,
    type,
    sessionId: str(body.sid, 64) || null,
    trigger: str(body.trigger, 16) || null,
    path: str(body.path, 300) || null,
    dwellMs: Number(body.dwellMs) || null,
    code: str(body.code, 60) || null,
    contact: str(body.contact, 160) || null,
  });
}
