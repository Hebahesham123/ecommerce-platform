"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { invalidateNudge } from "@/lib/nudge-service";
import { campaignToRow, mapCampaign, type NudgeCampaign } from "@/lib/nudge";
import { getCatalog } from "@/lib/storefront-data";
import type { ActionResult } from "../../store/actions";

type Row = Record<string, unknown>;

function mapError(message: string): string {
  return /nudge_campaigns|nudge_events|customer_offers/i.test(message) ? "migration_missing" : message;
}

/** A code the merchant can actually hand out, straight from their discounts. */
export type OfferableCode = {
  code: string;
  title: string;
  type: string;
  valueType: string | null;
  value: number | null;
  status: string;
  endsAt: string | null;
};

/** What a campaign can be aimed at. */
export type TargetOptions = {
  products: { id: string; title: string; image: string | null }[];
  collections: { handle: string; title: string }[];
  customers: { phone: string; name: string | null }[];
};

export type NudgeEditorData = {
  /** Every campaign, highest priority first. */
  campaigns: NudgeCampaign[];
  codes: OfferableCode[];
  options: TargetOptions;
};

function imageOf(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  const src = (img as { src?: unknown }).src;
  return typeof src === "string" ? src : null;
}

async function targetOptions(): Promise<TargetOptions> {
  const out: TargetOptions = { products: [], collections: [], customers: [] };
  try {
    const catalog = await getCatalog();
    out.products = catalog.products.map((p) => ({ id: p.id, title: p.title, image: imageOf(p.featured_image) }));
    out.collections = catalog.collections.map((k) => ({ handle: k.handle, title: k.title }));
  } catch {
    /* targeting by product is optional */
  }
  try {
    const { data } = await getServerSupabase()
      .from("store_customers")
      .select("phone,name")
      .order("created_at", { ascending: false })
      .limit(2000);
    out.customers = ((data ?? []) as Row[]).map((r) => ({ phone: String(r.phone), name: r.name ? String(r.name) : null }));
  } catch {
    /* targeting by customer is optional */
  }
  return out;
}

/**
 * The campaign to edit, plus every discount code that is real.
 *
 * The code list comes from the discounts table rather than being typed by
 * hand, because a popup offering a code that checkout rejects is worse than
 * no popup at all.
 */
export async function loadNudge(): Promise<ActionResult<NudgeEditorData>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();

    const listed = await supabase
      .from("nudge_campaigns")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (listed.error) return { ok: false, error: mapError(listed.error.message) };
    let rows = (listed.data ?? []) as Row[];

    // A store that ran the migration before this page existed has no row yet.
    if (!rows.length) {
      const created = await supabase
        .from("nudge_campaigns")
        .insert({ name: "Hesitation offer", enabled: false })
        .select("*")
        .single();
      if (created.error) return { ok: false, error: mapError(created.error.message) };
      rows = [created.data as Row];
    }

    const { data: discounts } = await supabase
      .from("discounts")
      .select("code, title, discount_type, value_type, value, status, ends_at")
      .eq("method", "code")
      .not("code", "is", null)
      .in("status", ["active", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      ok: true,
      data: {
        campaigns: rows.map(mapCampaign).sort((a, b) => b.priority - a.priority),
        options: await targetOptions(),
        codes: ((discounts ?? []) as Row[]).map((r) => ({
          code: String(r.code),
          title: String(r.title ?? r.code),
          type: String(r.discount_type ?? ""),
          valueType: (r.value_type as string) ?? null,
          value: r.value == null ? null : Number(r.value),
          status: String(r.status ?? ""),
          endsAt: r.ends_at ? String(r.ends_at) : null,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function saveNudge(campaign: NudgeCampaign): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("nudge_campaigns")
      .update(campaignToRow(campaign))
      .eq("id", campaign.id);
    if (error) return { ok: false, error: mapError(error.message) };
    // The storefront serves the campaign from a cached lookup — drop it so the
    // next page view reflects the save rather than waiting out the TTL.
    invalidateNudge();
    revalidatePath("/nudges");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** A new campaign, switched off, to set up from scratch. */
export async function createNudge(): Promise<ActionResult<NudgeCampaign>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("nudge_campaigns")
      .insert({ name: "New popup", enabled: false })
      .select("*")
      .single();
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: mapCampaign(data as Row) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** Delete a campaign. Its results stay, filed under no campaign. */
export async function deleteNudge(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { error } = await getServerSupabase().from("nudge_campaigns").delete().eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateNudge();
    revalidatePath("/nudges");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

// =============================================================================
// Results
// =============================================================================
export type NudgeResults = {
  days: number;
  hesitations: number;
  shown: number;
  dismissed: number;
  claimed: number;
  converted: number;
  /** Money on orders that followed a claimed code. */
  recovered: number;
  /** What those orders cost in discount. */
  givenAway: number;
  /** Median seconds of dwell before a hesitation fired. */
  medianDwellSeconds: number;
  byTrigger: { trigger: string; count: number }[];
  topPaths: { path: string; count: number }[];
  contacts: { contact: string; code: string | null; at: string }[];
};

export async function loadNudgeResults(days = 30): Promise<ActionResult<NudgeResults>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("nudge_events")
      .select("type, trigger, path, dwell_ms, code, contact, order_number, order_total, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (error) return { ok: false, error: mapError(error.message) };

    const rows = (data ?? []) as Row[];
    const count = (t: string) => rows.filter((r) => r.type === t).length;

    const dwells = rows
      .filter((r) => r.type === "hesitation" && r.dwell_ms != null)
      .map((r) => Number(r.dwell_ms))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    const medianDwellSeconds = dwells.length
      ? Math.round(dwells[Math.floor(dwells.length / 2)] / 1000)
      : 0;

    const tally = (key: string, filter: (r: Row) => boolean) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (!filter(r)) continue;
        const k = String(r[key] ?? "").trim();
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()]
        .map(([k, v]) => [k, v] as const)
        .sort((a, b) => b[1] - a[1]);
    };

    const converted = rows.filter((r) => r.type === "converted");
    const recovered = converted.reduce((s, r) => s + Number(r.order_total ?? 0), 0);

    // What those orders actually cost in discount, read from the orders
    // themselves rather than assumed from the campaign's face value.
    let givenAway = 0;
    const orderNumbers = converted
      .map((r) => String(r.order_number ?? ""))
      .filter(Boolean);
    if (orderNumbers.length) {
      const { data: orders } = await supabase
        .from("store_orders")
        .select("order_number, discount_amount")
        .in("order_number", [...new Set(orderNumbers)]);
      givenAway = ((orders ?? []) as Row[]).reduce(
        (s, o) => s + Number(o.discount_amount ?? 0),
        0,
      );
    }

    return {
      ok: true,
      data: {
        days,
        hesitations: count("hesitation"),
        shown: count("shown"),
        dismissed: count("dismissed"),
        claimed: count("claimed"),
        converted: converted.length,
        recovered: Math.round(recovered * 100) / 100,
        givenAway: Math.round(givenAway * 100) / 100,
        medianDwellSeconds,
        byTrigger: tally("trigger", (r) => r.type === "hesitation").map(([trigger, c]) => ({
          trigger,
          count: c,
        })),
        topPaths: tally("path", (r) => r.type === "hesitation")
          .slice(0, 12)
          .map(([path, c]) => ({ path, count: c })),
        contacts: rows
          .filter((r) => r.type === "claimed" && r.contact)
          .slice(0, 100)
          .map((r) => ({
            contact: String(r.contact),
            code: r.code ? String(r.code) : null,
            at: String(r.created_at ?? ""),
          })),
      },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
