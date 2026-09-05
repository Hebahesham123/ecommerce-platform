"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  metaAppConfigured,
  catalogItemsBatch,
  sendConversionEvent,
  sha256,
  type ConversionEvent,
  type CatalogItem,
  type Named,
} from "@/lib/meta";
import { invalidatePixelSnippet } from "@/lib/theme-render-service";
import { products } from "@/lib/data";
import type { Channel } from "@/lib/channel";

export type MetaResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type MetaConnectionView = {
  configured: boolean;
  connected: boolean;
  userName: string | null;
  businessName: string | null;
  pixelId: string | null;
  pixelName: string | null;
  catalogId: string | null;
  catalogName: string | null;
  pixelEnabled: boolean;
  capiEnabled: boolean;
  /** Whether a Conversions API token is stored. The token itself never leaves
   *  the server — the UI only needs to know it is there. */
  capiTokenSet: boolean;
  /**
   * The app's own dataset. Meta counts a website and an app as two different
   * sources, so keeping them apart here is what lets the merchant run ads for
   * one, the other, or both, and see honest numbers for each.
   */
  appDatasetId: string | null;
  appCapiEnabled: boolean;
  appCapiTokenSet: boolean;
  testEventCode: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncCount: number;
  available: { businesses?: Named[]; pixels?: Named[]; catalogs?: Named[] };
};

async function loadRow() {
  const supabase = getServerSupabase();
  const { data } = await supabase.from("meta_connection").select("*").eq("id", "default").single();
  return data as Record<string, unknown> | null;
}

export async function getConnection(): Promise<MetaResult<MetaConnectionView>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const r = await loadRow();
    return {
      ok: true,
      data: {
        configured: metaAppConfigured(),
        connected: Boolean(r?.connected),
        userName: (r?.fb_user_name as string) ?? null,
        businessName: (r?.business_name as string) ?? null,
        pixelId: (r?.pixel_id as string) ?? null,
        pixelName: (r?.pixel_name as string) ?? null,
        catalogId: (r?.catalog_id as string) ?? null,
        catalogName: (r?.catalog_name as string) ?? null,
        pixelEnabled: r?.pixel_enabled !== false,
        capiEnabled: Boolean(r?.capi_enabled),
        capiTokenSet: Boolean(r?.capi_token || r?.access_token),
        appDatasetId: (r?.app_dataset_id as string) ?? null,
        appCapiEnabled: Boolean(r?.app_capi_enabled),
        appCapiTokenSet: Boolean(r?.app_capi_token),
        testEventCode: (r?.test_event_code as string) ?? null,
        tokenExpiresAt: (r?.token_expires_at as string) ?? null,
        lastSyncAt: (r?.last_catalog_sync_at as string) ?? null,
        lastSyncCount: Number(r?.last_sync_count ?? 0),
        available: (r?.available as MetaConnectionView["available"]) ?? {},
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Connect one channel by pasting what Events Manager already shows you.
 *
 * A dataset needs an id and nothing else to receive browser events — it is a
 * public identifier that ships in the page source of every store that uses
 * one. The Conversions API needs that same id plus an access token, which is
 * secret and therefore only ever travels inwards.
 *
 * The website and the app are saved separately because Meta treats them as
 * separate sources: they get their own dataset, their own token and their own
 * on/off state. That is what makes "website only", "app only" and "both" three
 * real choices rather than one setting with a label on it — and it means
 * connecting the app can never quietly change what the website reports.
 *
 * Saving an id switches that channel on; saving a token switches its server
 * events on. There is no separate "connect" step because there is nothing else
 * to do.
 */
export async function saveDirectSetup(input: {
  /** Which surface these credentials belong to. Defaults to the website. */
  channel?: Channel;
  pixelId: string;
  /** Empty string leaves the stored token untouched; null clears it. */
  capiToken?: string | null;
  testEventCode?: string;
}): Promise<MetaResult<{ pixelOn: boolean; capiOn: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };

  const isApp = input.channel === "app";
  const pixelId = input.pixelId.trim();
  // Meta pixel / dataset ids are numeric. Catching a pasted URL or a stray
  // space here is far kinder than a silent no-op on the storefront.
  if (pixelId && !/^\d{8,20}$/.test(pixelId)) return { ok: false, error: "invalid_pixel_id" };

  try {
    const supabase = getServerSupabase();
    const current = await loadRow();

    // A blank token means "leave what is stored"; explicit null means remove.
    const stored = (isApp ? current?.app_capi_token : current?.capi_token) as string | undefined;
    let token = stored || null;
    if (input.capiToken === null) token = null;
    else if (input.capiToken && input.capiToken.trim()) token = input.capiToken.trim();

    const update: Record<string, unknown> = isApp
      ? {
          app_dataset_id: pixelId || null,
          app_capi_enabled: Boolean(pixelId && token),
        }
      : {
          pixel_id: pixelId || null,
          pixel_name: pixelId ? (current?.pixel_name as string) ?? "Pixel" : null,
          pixel_enabled: Boolean(pixelId),
          capi_enabled: Boolean(pixelId && token),
        };
    if (input.capiToken !== undefined) update[isApp ? "app_capi_token" : "capi_token"] = token;

    // "Connected" means at least one channel is reporting, so switching the
    // website off does not blank a working app connection.
    const otherId = isApp ? current?.pixel_id : current?.app_dataset_id;
    update.connected = Boolean(pixelId || otherId);

    // The test code is shared: it belongs to the tester, not to a channel.
    if (input.testEventCode !== undefined)
      update.test_event_code = input.testEventCode.trim() || null;

    const { error } = await supabase.from("meta_connection").update(update).eq("id", "default");
    if (error) {
      const missing = /capi_token|app_dataset_id|app_capi/i.test(error.message);
      return { ok: false, error: missing ? "migration_missing" : error.message };
    }

    // The storefront injects the pixel from a cached lookup — refresh it so the
    // change is live on the next page view rather than a minute later.
    invalidatePixelSnippet();
    revalidatePath("/channels/meta");
    return {
      ok: true,
      data: { pixelOn: Boolean(pixelId), capiOn: Boolean(pixelId && token) },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSelection(patch: {
  pixelId?: string;
  catalogId?: string;
  pixelEnabled?: boolean;
  capiEnabled?: boolean;
  testEventCode?: string;
}): Promise<MetaResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const r = await loadRow();
    const available = (r?.available as MetaConnectionView["available"]) ?? {};
    const update: Record<string, unknown> = {};
    if (patch.pixelId !== undefined) {
      update.pixel_id = patch.pixelId || null;
      update.pixel_name = available.pixels?.find((p) => p.id === patch.pixelId)?.name ?? null;
    }
    if (patch.catalogId !== undefined) {
      update.catalog_id = patch.catalogId || null;
      update.catalog_name = available.catalogs?.find((c) => c.id === patch.catalogId)?.name ?? null;
    }
    if (patch.pixelEnabled !== undefined) update.pixel_enabled = patch.pixelEnabled;
    if (patch.capiEnabled !== undefined) update.capi_enabled = patch.capiEnabled;
    if (patch.testEventCode !== undefined) update.test_event_code = patch.testEventCode || null;

    const { error } = await supabase.from("meta_connection").update(update).eq("id", "default");
    if (error) return { ok: false, error: error.message };
    // The storefront injects the pixel snippet from a cached lookup — refresh it.
    invalidatePixelSnippet();
    revalidatePath("/channels/meta");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Forget one channel's credentials, or all of them.
 *
 * Disconnecting the app must not take the website's ads down with it, so the
 * default is the channel you are looking at. Only clearing the last one tears
 * down the shared Facebook login as well.
 */
export async function disconnect(channel?: Channel | "all"): Promise<MetaResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const current = await loadRow();
    const scope = channel ?? "all";

    const update: Record<string, unknown> = {};
    if (scope === "app" || scope === "all") {
      update.app_dataset_id = null;
      update.app_capi_token = null;
      update.app_capi_enabled = false;
    }
    if (scope === "web" || scope === "all") {
      update.pixel_id = null;
      update.pixel_name = null;
      update.pixel_enabled = false;
      update.capi_token = null;
      update.capi_enabled = false;
    }

    const keptWeb = scope === "app" ? Boolean(current?.pixel_id) : false;
    const keptApp = scope === "web" ? Boolean(current?.app_dataset_id) : false;
    update.connected = keptWeb || keptApp;

    // The OAuth login is shared by both channels (catalog sync uses it), so it
    // only goes when nothing is left connected.
    if (!update.connected) {
      Object.assign(update, {
        access_token: null,
        token_expires_at: null,
        fb_user_id: null,
        fb_user_name: null,
        business_id: null,
        business_name: null,
        available: {},
      });
    }

    const { error } = await supabase.from("meta_connection").update(update).eq("id", "default");
    if (error) return { ok: false, error: error.message };
    invalidatePixelSnippet();
    revalidatePath("/channels/meta");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://your-store.example.com";

function productToCatalogItem(p: (typeof products)[number]): CatalogItem {
  return {
    id: p.sku,
    title: p.name,
    description: `${p.name} — ${p.category}`,
    availability: p.stock > 0 ? "in stock" : "out of stock",
    condition: "new",
    price: `${p.price.toFixed(2)} EGP`,
    link: `${SITE_URL}/products/${p.sku}`,
    image_link: `https://placehold.co/600x600/png?text=${encodeURIComponent(p.name)}`,
    brand: "Fashion Store",
  };
}

export async function syncCatalog(): Promise<MetaResult<{ count: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const r = await loadRow();
    const token = r?.access_token as string | undefined;
    const catalogId = r?.catalog_id as string | undefined;
    if (!token) return { ok: false, error: "not_connected" };
    if (!catalogId) return { ok: false, error: "no_catalog" };

    const items = products.map(productToCatalogItem);
    await catalogItemsBatch(catalogId, token, items);

    await supabase
      .from("meta_connection")
      .update({ last_catalog_sync_at: new Date().toISOString(), last_sync_count: items.length })
      .eq("id", "default");
    revalidatePath("/channels/meta");
    return { ok: true, data: { count: items.length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Prove one channel's connection works, end to end.
 *
 * Sent against whichever channel is being tested, with that channel's own
 * dataset, token and action_source — otherwise a passing test on the website
 * would say nothing at all about whether the app is wired up.
 */
export async function sendTestEvent(
  eventName: string,
  channel: Channel = "web",
): Promise<MetaResult<{ eventsReceived: number; traceId: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const r = await loadRow();
    const isApp = channel === "app";
    // A dedicated Conversions API token wins; an OAuth token still works.
    const token = (
      isApp
        ? (r?.app_capi_token as string)
        : (r?.capi_token as string) || (r?.access_token as string)
    ) as string | undefined;
    const pixelId = (isApp ? r?.app_dataset_id : r?.pixel_id) as string | undefined;
    const testCode = (r?.test_event_code as string) || undefined;
    if (!pixelId) return { ok: false, error: "no_pixel" };
    if (!token) return { ok: false, error: "no_capi_token" };

    const eventId = crypto.randomUUID();
    const event: ConversionEvent = {
      event_name: eventName,
      event_id: eventId,
      action_source: isApp ? "app" : "website",
      // Meta rejects a website event with no source URL, and rejects an app
      // event that carries one. Sending the wrong shape fails silently in the
      // worst way: accepted, then dropped from attribution.
      ...(isApp ? {} : { event_source_url: SITE_URL }),
      user_data: { em: [sha256("test@your-store.example.com")], client_user_agent: "cowork-admin-tester" },
      custom_data:
        eventName === "Purchase"
          ? { currency: "EGP", value: 540 }
          : { currency: "EGP" },
    };

    let status = "sent";
    let response: unknown;
    try {
      response = await sendConversionEvent(pixelId, token, event, testCode);
    } catch (e) {
      status = "error";
      response = { error: (e as Error).message };
    }
    await supabase.from("meta_events").insert({
      event_name: eventName,
      event_id: eventId,
      source: `test:${channel}`,
      status,
      payload: event,
      response,
    });
    revalidatePath("/channels/meta");
    if (status === "error") return { ok: false, error: (response as { error: string }).error };
    const res = response as { events_received?: number; fbtrace_id?: string };
    return { ok: true, data: { eventsReceived: res.events_received ?? 0, traceId: res.fbtrace_id ?? "" } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type MetaEventLog = {
  id: string;
  eventName: string;
  source: string;
  status: string;
  createdAt: string;
};

export async function listEvents(): Promise<MetaResult<MetaEventLog[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("meta_events")
      .select("id,event_name,source,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((e: Record<string, unknown>) => ({
        id: String(e.id),
        eventName: String(e.event_name),
        source: String(e.source),
        status: String(e.status),
        createdAt: String(e.created_at),
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
