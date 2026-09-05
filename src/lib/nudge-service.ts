/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapCampaign, type NudgeCampaign, type NudgeEventType } from "@/lib/nudge";

/**
 * Reading the live nudge campaign, and recording what shoppers did with it.
 *
 * The campaign is looked up on the hot path of every storefront page, so it is
 * cached in memory the same way the published theme and the pixel snippet are —
 * a short TTL that self-heals, plus an explicit invalidation from the admin
 * save, so a warm instance serves pages without touching the database.
 */

const TTL_MS = 60_000;

let cache: { at: number; value: NudgeCampaign | null } | null = null;

/** Forget the cached campaign (call after the editor saves). */
export function invalidateNudge(): void {
  cache = null;
}

/** The enabled campaign, or null. Most recently updated wins if several are on. */
export async function getActiveNudge(): Promise<NudgeCampaign | null> {
  if (!isSupabaseConfigured()) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let value: NudgeCampaign | null = null;
  try {
    const { data } = await getServerSupabase()
      .from("nudge_campaigns")
      .select("*")
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    value = data ? mapCampaign(data as Record<string, unknown>) : null;
  } catch {
    // Migration not applied, or the table is unreachable. A storefront must
    // never fail to render because a marketing popup could not be looked up.
    value = null;
  }

  cache = { at: Date.now(), value };
  return value;
}

export type NudgeEventInput = {
  campaignId?: string | null;
  visitorId: string;
  sessionId?: string | null;
  type: NudgeEventType;
  trigger?: string | null;
  path?: string | null;
  dwellMs?: number | null;
  code?: string | null;
  contact?: string | null;
  orderNumber?: string | null;
  orderTotal?: number | null;
};

const clampText = (v: unknown, max: number): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Record one event. Best-effort by design: this is analytics riding along on a
 * shopper's page, and it must never surface an error to them or slow a
 * checkout down.
 */
export async function recordNudgeEvent(ev: NudgeEventInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const visitor = clampText(ev.visitorId, 64);
  if (!visitor) return;
  try {
    await getServerSupabase().from("nudge_events").insert({
      campaign_id: ev.campaignId || null,
      visitor_id: visitor,
      session_id: clampText(ev.sessionId, 64),
      type: ev.type,
      trigger: clampText(ev.trigger, 16),
      path: clampText(ev.path, 300),
      dwell_ms:
        ev.dwellMs == null || !Number.isFinite(Number(ev.dwellMs))
          ? null
          : Math.max(0, Math.min(3_600_000, Math.trunc(Number(ev.dwellMs)))),
      code: clampText(ev.code, 60),
      contact: clampText(ev.contact, 160),
      order_number: clampText(ev.orderNumber, 40),
      order_total: ev.orderTotal == null ? null : Number(ev.orderTotal),
    });
  } catch {
    /* the shopper's page does not care */
  }
}

/**
 * Close the loop: an order placed with a code this campaign hands out is the
 * only evidence the popup actually earned anything.
 *
 * Attribution is deliberately narrow — the visitor must have been shown the
 * popup and the order must carry the campaign's own code — so an unrelated
 * order that happens to use the same code is not counted as recovered.
 */
export async function recordNudgeConversion(args: {
  visitorId: string | null;
  code: string | null;
  orderNumber: string;
  orderTotal: number;
}): Promise<void> {
  if (!args.visitorId || !args.code || !isSupabaseConfigured()) return;
  try {
    const campaign = await getActiveNudge();
    const codes = campaign
      ? [campaign.discountCode, ...campaign.wheelSegments.map((s) => s.code)]
          .filter(Boolean)
          .map((c) => String(c).toLowerCase())
      : [];
    if (!codes.includes(args.code.toLowerCase())) return;

    // Only count it if this visitor was actually shown the thing.
    const { data } = await getServerSupabase()
      .from("nudge_events")
      .select("id")
      .eq("visitor_id", args.visitorId)
      .in("type", ["shown", "claimed"])
      .limit(1);
    if (!data?.length) return;

    await recordNudgeEvent({
      campaignId: campaign?.id ?? null,
      visitorId: args.visitorId,
      type: "converted",
      code: args.code,
      orderNumber: args.orderNumber,
      orderTotal: args.orderTotal,
    });
  } catch {
    /* never let bookkeeping fail an order */
  }
}
