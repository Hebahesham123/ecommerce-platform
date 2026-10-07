import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCatalog, type ProductDrop } from "@/lib/storefront-data";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { getEnabledNudges, recordNudgeEvent } from "@/lib/nudge-service";
import { mintPersonalCode, offerLabel } from "@/lib/exclusive-offers";
import { trackShopper, type ShopperChannel } from "@/lib/shopper-tracking";
import { ALL_PAGES, type NudgeCampaign, type NudgeChannel, type NudgeEventType, type NudgePage } from "@/lib/nudge";

/**
 * Which offer a shopper should be armed with on the page she is on.
 *
 * Decided on the server, per shopper, because it depends on who she is (an
 * offer made for her by name, a campaign for signed-in customers only) and on
 * what she is looking at (a campaign for one product). The page itself stays
 * the same for everyone; only this small answer is personal.
 *
 * Her own offer comes first. After that, the first campaign that fits, in the
 * merchant's order of priority.
 */

/** What the popup script needs to run. The same shape on every surface. */
export type OfferConfig = {
  /** A campaign id, or "offer:<id>" for an offer made for her by name. */
  id: string;
  pages: string[];
  dwell: number;
  exit: boolean;
  idle: number;
  cart: number;
  maxPerSession: number;
  cooldownHours: number;
  skipIfCartEmpty: boolean;
  style: string;
  position: string;
  headline: string;
  body: string;
  button: string;
  dismiss: string;
  captureLabel: string;
  accent: string;
  bg: string;
  fg: string;
  image: string | null;
  /** A ready code. Null for a campaign that makes one per shopper on claim. */
  code: string | null;
  segments: { label: string; code: string; weight: number }[];
  /** Claim through the server to get a code made for this shopper. */
  unique: boolean;
};

export type DecideInput = {
  channel: NudgeChannel;
  visitorId: string | null;
  phone: string | null;
  pageType: string;
  productKey?: string | null;
  collectionHandle?: string | null;
  cartCount: number;
};

function configOf(c: NudgeCampaign): OfferConfig {
  return {
    id: c.id,
    pages: c.pages,
    dwell: c.dwellEnabled ? c.dwellSeconds : 0,
    exit: c.exitEnabled,
    idle: c.idleEnabled ? c.idleSeconds : 0,
    cart: c.cartEnabled ? c.cartSeconds : 0,
    maxPerSession: c.maxPerSession,
    cooldownHours: c.cooldownHours,
    skipIfCartEmpty: c.skipIfCartEmpty,
    style: c.style,
    position: c.position,
    headline: c.headline,
    body: c.body,
    button: c.buttonLabel,
    dismiss: c.dismissLabel,
    captureLabel: c.captureLabel,
    accent: c.accentColor,
    bg: c.backgroundColor,
    fg: c.textColor,
    image: c.imageUrl,
    code: c.codeMode === "unique" ? null : c.discountCode,
    segments: c.wheelSegments,
    unique: c.codeMode === "unique",
  };
}

/** Every key a product is known by, so a target set by id, handle or variant matches. */
function keysOf(product: ProductDrop): Set<string> {
  const keys = new Set<string>([product.id, product.handle]);
  for (const v of product.variants) keys.add(v.id);
  return keys;
}

async function productFor(key: string | null | undefined): Promise<ProductDrop | null> {
  if (!key) return null;
  try {
    const catalog = await getCatalog();
    return (
      catalog.productByHandle.get(key) ??
      catalog.variantById.get(key)?.product ??
      catalog.products.find((p) => p.id === key) ??
      null
    );
  } catch {
    return null;
  }
}

/** Her own offer, if one is waiting: made for her, unused, still good. */
async function personalOffer(phone: string, accent: string): Promise<OfferConfig | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("customer_offers")
    .select("*")
    .in("phone", phoneVariants(phone))
    .eq("popup", true)
    .is("cancelled_at", null)
    .is("claimed_at", null)
    .gt("ends_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const o = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (!o) return null;

  // A code that has already been used is not an offer any more.
  const { data: d } = await supabase.from("discounts").select("used_count").ilike("code", String(o.code)).maybeSingle();
  if (d && Number((d as { used_count?: number }).used_count ?? 0) > 0) return null;

  const until = new Date(String(o.ends_at)).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return {
    id: "offer:" + String(o.id),
    pages: [...ALL_PAGES, "other"],
    dwell: Math.max(3, Number(o.popup_seconds ?? 8)),
    exit: true,
    idle: 0,
    cart: 0,
    // Once a visit until she takes it or it runs out.
    maxPerSession: 1,
    cooldownHours: 0,
    skipIfCartEmpty: false,
    style: "card",
    position: "center",
    headline: "A gift, just for you",
    body: (String(o.message ?? "").trim() || `${String(o.label)} on your order — made only for you.`) + ` Valid until ${until}.`,
    button: "Copy code and shop",
    dismiss: "Maybe later",
    captureLabel: "",
    accent,
    bg: "#ffffff",
    fg: "#0f172a",
    image: null,
    code: String(o.code),
    segments: [],
    unique: false,
  };
}

export async function decideOffer(input: DecideInput): Promise<OfferConfig | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const campaigns = await getEnabledNudges();
    const accent = campaigns[0]?.accentColor ?? "#e11d48";

    if (input.phone) {
      try {
        const mine = await personalOffer(input.phone, accent);
        if (mine) return mine;
      } catch {
        /* the offers table may not exist yet */
      }
    }

    const page = (ALL_PAGES as string[]).includes(input.pageType) ? (input.pageType as NudgePage) : null;
    if (!page) return null;

    let product: ProductDrop | null | undefined;
    const phone = input.phone ? normalizePhone(input.phone) : null;

    for (const c of campaigns) {
      if (!c.channels.includes(input.channel)) continue;
      if (!c.pages.includes(page)) continue;

      if (c.audience === "guests" && phone) continue;
      if (c.audience === "signed_in" && !phone) continue;
      if (c.audience === "with_cart" && input.cartCount <= 0) continue;
      if (c.audience === "customers") {
        if (!phone || !c.audiencePhones.some((p) => normalizePhone(p) === phone)) continue;
      }

      if (c.productIds.length || c.collectionHandles.length) {
        if (product === undefined) product = await productFor(input.productKey);
        const keys = product ? keysOf(product) : new Set<string>();
        const productHit = c.productIds.some((id) => keys.has(id));
        let collectionHit = false;
        if (c.collectionHandles.length) {
          if (page === "collection" && input.collectionHandle) {
            collectionHit = c.collectionHandles.includes(input.collectionHandle);
          } else if (product) {
            try {
              const catalog = await getCatalog();
              collectionHit = c.collectionHandles.some((h) =>
                catalog.collectionByHandle.get(h)?.products.some((p) => p.id === product!.id),
              );
            } catch {
              collectionHit = false;
            }
          }
        }
        if (!productHit && !collectionHit) continue;
      }

      return configOf(c);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * A shopper claiming a campaign that makes a code for each person.
 *
 * Asking twice gives the same code back while it is still good, so a page
 * reload is not a way to collect a pocketful. A signed-in shopper's code
 * works only for her phone; a guest's works once, for whoever places the
 * order with it.
 */
export async function claimUniqueCode(args: {
  campaignId: string;
  visitorId: string;
  phone: string | null;
  channel: ShopperChannel;
  path?: string | null;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const campaign = (await getEnabledNudges()).find((c) => c.id === args.campaignId);
  if (!campaign || campaign.codeMode !== "unique") return { ok: false, error: "not_found" };

  const supabase = getServerSupabase();
  const since = new Date(Date.now() - campaign.uniqueHours * 3600 * 1000).toISOString();
  const { data: earlier } = await supabase
    .from("nudge_events")
    .select("code")
    .eq("campaign_id", campaign.id)
    .eq("visitor_id", args.visitorId)
    .eq("type", "claimed")
    .not("code", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const again = earlier?.[0] ? String((earlier[0] as { code: string }).code) : null;
  if (again) {
    const { data: d } = await supabase.from("discounts").select("used_count").ilike("code", again).maybeSingle();
    if (!d || Number((d as { used_count?: number }).used_count ?? 0) === 0) return { ok: true, code: again };
  }

  const made = await mintPersonalCode(
    {
      valueType: campaign.uniqueValueType,
      value: campaign.uniqueValue,
      hours: campaign.uniqueHours,
      minAmount: campaign.uniqueMinAmount,
      title: `Popup · ${campaign.name} · ${offerLabel({ valueType: campaign.uniqueValueType, value: campaign.uniqueValue })}`,
    },
    args.phone,
  );
  if (!made.ok) return made;

  await recordOfferEvent({
    id: campaign.id,
    visitorId: args.visitorId,
    phone: args.phone,
    channel: args.channel,
    type: "claimed",
    code: made.data.code,
    path: args.path ?? null,
  });
  return { ok: true, code: made.data.code };
}

/**
 * What happened to a popup: shown, dismissed, claimed. Into the popup results,
 * onto her timeline, and onto the offer made for her when it was one.
 */
export async function recordOfferEvent(e: {
  id: string;
  visitorId: string;
  phone: string | null;
  channel: ShopperChannel;
  type: NudgeEventType;
  sessionId?: string | null;
  trigger?: string | null;
  path?: string | null;
  dwellMs?: number | null;
  code?: string | null;
  contact?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured() || !e.visitorId) return;
  const personal = e.id.startsWith("offer:") ? e.id.slice(6) : null;
  await recordNudgeEvent({
    campaignId: personal ? null : e.id,
    visitorId: e.visitorId,
    sessionId: e.sessionId ?? null,
    type: e.type,
    trigger: e.trigger ?? null,
    path: e.path ?? null,
    dwellMs: e.dwellMs ?? null,
    code: e.code ?? null,
    contact: e.contact ?? null,
  });

  if (e.type === "shown" || e.type === "claimed") {
    await trackShopper({
      visitorId: e.visitorId,
      phone: e.phone,
      channel: e.channel,
      event: {
        type: e.type === "shown" ? "offer_shown" : "offer_claimed",
        path: e.path ?? null,
        meta: { campaign: personal ? "personal" : e.id, ...(e.code ? { code: e.code } : {}) },
      },
    });
  }

  if (personal && (e.type === "shown" || e.type === "claimed")) {
    try {
      const column = e.type === "shown" ? "shown_at" : "claimed_at";
      await getServerSupabase()
        .from("customer_offers")
        .update({ [column]: new Date().toISOString() })
        .eq("id", personal)
        .is(column, null);
    } catch {
      /* bookkeeping only */
    }
  }
}
