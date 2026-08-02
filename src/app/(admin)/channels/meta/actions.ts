"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  metaAppConfigured,
  catalogItemsBatch,
  sendConversionEvent,
  sha256,
  type CatalogItem,
  type Named,
} from "@/lib/meta";
import { products } from "@/lib/data";

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
    revalidatePath("/channels/meta");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function disconnect(): Promise<MetaResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("meta_connection")
      .update({
        connected: false,
        access_token: null,
        token_expires_at: null,
        fb_user_id: null,
        fb_user_name: null,
        business_id: null,
        business_name: null,
        available: {},
      })
      .eq("id", "default");
    if (error) return { ok: false, error: error.message };
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

export async function sendTestEvent(
  eventName: string,
): Promise<MetaResult<{ eventsReceived: number; traceId: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const r = await loadRow();
    const token = r?.access_token as string | undefined;
    const pixelId = r?.pixel_id as string | undefined;
    const testCode = (r?.test_event_code as string) || undefined;
    if (!token) return { ok: false, error: "not_connected" };
    if (!pixelId) return { ok: false, error: "no_pixel" };

    const eventId = crypto.randomUUID();
    const event = {
      event_name: eventName,
      event_id: eventId,
      event_source_url: SITE_URL,
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
      source: "test",
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
