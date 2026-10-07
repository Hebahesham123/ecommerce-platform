"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import type { ActionResult } from "../../store/actions";

type Row = Record<string, unknown>;

const text = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const money = (v: unknown): number | null => (v == null ? null : Number(v));

function mapError(message: string): string {
  return /shopper_(events|carts|visitors)/i.test(message) ? "migration_missing" : message;
}

export type TimelineItem = {
  at: string;
  /** "page" for a pageview; otherwise the event's own type. */
  kind: string;
  channel: string;
  path: string | null;
  productId: string | null;
  productName: string | null;
  imageUrl: string | null;
  value: number | null;
  quantity: number | null;
  meta: Record<string, unknown>;
};

export type CartLine = { itemId: string; name: string; imageUrl: string | null; price: number; quantity: number };

export type OpenCart = {
  visitorId: string;
  channel: string;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  updatedAt: string;
};

export type CustomerProfile = {
  phone: string;
  name: string | null;
  email: string | null;
  governorate: string | null;
  city: string | null;
  birthday: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  orders: { number: string; total: number; createdAt: string; lifecycle: string; channel: string }[];
  totalSpent: number;
  devices: { visitorId: string; channel: string; platform: string | null; lastSeen: string }[];
  lastSeen: string | null;
  carts: OpenCart[];
  /** The products she keeps coming back to. */
  mostViewed: { productId: string; name: string; imageUrl: string | null; views: number; lastAt: string }[];
  timeline: TimelineItem[];
};

function cartOf(r: Row): OpenCart {
  const items = Array.isArray(r.items) ? (r.items as CartLine[]) : [];
  return {
    visitorId: String(r.visitor_id),
    channel: String(r.channel ?? "web"),
    items,
    itemCount: Number(r.item_count ?? 0),
    subtotal: Number(r.subtotal ?? 0),
    updatedAt: String(r.updated_at),
  };
}

/** Everything the shop knows about one customer, newest first. */
export async function getCustomerProfile(phoneIn: string): Promise<ActionResult<CustomerProfile>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const phone = normalizePhone(phoneIn);
    const variants = phoneVariants(phoneIn);

    const [customerRes, ordersRes, visitorsRes, eventsRes, cartsRes] = await Promise.all([
      supabase.from("store_customers").select("*").in("phone", variants).limit(1).maybeSingle(),
      supabase
        .from("store_orders")
        .select("order_number,total,created_at,lifecycle,channel,customer_name")
        .in("phone", variants)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("shopper_visitors").select("*").in("phone", variants).order("last_seen", { ascending: false }),
      supabase
        .from("shopper_events")
        .select("*")
        .in("phone", variants)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("shopper_carts")
        .select("*")
        .in("phone", variants)
        .gt("item_count", 0)
        .is("ordered_at", null)
        .order("updated_at", { ascending: false }),
    ]);
    for (const r of [visitorsRes, eventsRes, cartsRes]) {
      if (r.error) return { ok: false, error: mapError(r.error.message) };
    }

    const c = (customerRes.data ?? {}) as Row;
    const orderRows = (ordersRes.data ?? []) as Row[];
    const devices = ((visitorsRes.data ?? []) as Row[]).map((v) => ({
      visitorId: String(v.visitor_id),
      channel: String(v.channel ?? "web"),
      platform: text(v.platform),
      lastSeen: String(v.last_seen),
    }));

    // Pageviews live in site_events, keyed by the same visitor ids.
    let pages: Row[] = [];
    if (devices.length) {
      const pv = await supabase
        .from("site_events")
        .select("created_at,channel,path")
        .in(
          "visitor_id",
          devices.map((d) => d.visitorId),
        )
        .eq("kind", "pageview")
        .order("created_at", { ascending: false })
        .limit(200);
      pages = (pv.data ?? []) as Row[];
    }

    const events = (eventsRes.data ?? []) as Row[];
    const timeline: TimelineItem[] = [
      ...events.map((e) => ({
        at: String(e.created_at),
        kind: String(e.type),
        channel: String(e.channel ?? "web"),
        path: text(e.path),
        productId: text(e.product_id),
        productName: text(e.product_name),
        imageUrl: text(e.image_url),
        value: money(e.value),
        quantity: e.quantity == null ? null : Number(e.quantity),
        meta: (e.meta as Record<string, unknown>) ?? {},
      })),
      ...pages.map((p) => ({
        at: String(p.created_at),
        kind: "page",
        channel: String(p.channel ?? "web"),
        path: text(p.path),
        productId: null,
        productName: null,
        imageUrl: null,
        value: null,
        quantity: null,
        meta: {},
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 300);

    const viewed = new Map<string, CustomerProfile["mostViewed"][number]>();
    for (const e of events) {
      if (e.type !== "product_view" || !e.product_id) continue;
      const id = String(e.product_id);
      const hit = viewed.get(id);
      if (hit) hit.views += 1;
      else
        viewed.set(id, {
          productId: id,
          name: String(e.product_name ?? id),
          imageUrl: text(e.image_url),
          views: 1,
          lastAt: String(e.created_at),
        });
    }

    const lastSeen = [devices[0]?.lastSeen, timeline[0]?.at].filter(Boolean).sort().pop() ?? null;

    return {
      ok: true,
      data: {
        phone,
        name: text(c.name) ?? text(orderRows[0]?.customer_name),
        email: text(c.email),
        governorate: text(c.governorate),
        city: text(c.city),
        birthday: text(c.birthday),
        avatarUrl: text(c.avatar_url),
        createdAt: text(c.created_at),
        orders: orderRows.map((o) => ({
          number: String(o.order_number),
          total: Number(o.total ?? 0),
          createdAt: String(o.created_at),
          lifecycle: String(o.lifecycle ?? "placed"),
          channel: String(o.channel ?? "web"),
        })),
        totalSpent: orderRows
          .filter((o) => o.lifecycle !== "cancelled")
          .reduce((n, o) => n + Number(o.total ?? 0), 0),
        devices,
        lastSeen,
        carts: ((cartsRes.data ?? []) as Row[]).map(cartOf),
        mostViewed: [...viewed.values()].sort((a, b) => b.views - a.views || b.lastAt.localeCompare(a.lastAt)).slice(0, 8),
        timeline,
      },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export type AbandonedCart = OpenCart & { phone: string | null; name: string | null };

/**
 * Baskets left with something in them and no order since.
 *
 * Half an hour of quiet before a basket counts: someone still choosing is not
 * someone who left.
 */
export async function listAbandonedCarts(limit = 100): Promise<ActionResult<AbandonedCart[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const quiet = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("shopper_carts")
      .select("*")
      .gt("item_count", 0)
      .is("ordered_at", null)
      .lt("updated_at", quiet)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: mapError(error.message) };
    const rows = (data ?? []) as Row[];

    const phones = [...new Set(rows.map((r) => text(r.phone)).filter((p): p is string => Boolean(p)))];
    const names = new Map<string, string>();
    if (phones.length) {
      const { data: people } = await supabase.from("store_customers").select("phone,name").in("phone", phones);
      for (const p of (people ?? []) as Row[]) if (p.name) names.set(String(p.phone), String(p.name));
    }
    return {
      ok: true,
      data: rows.map((r) => {
        const phone = text(r.phone);
        return { ...cartOf(r), phone, name: phone ? names.get(phone) ?? null : null };
      }),
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export type BrowsingNow = {
  /** Every visitor seen in the last ten minutes. */
  total: number;
  /** The ones the shop knows by name. */
  known: { phone: string; name: string | null; channel: string; lastSeen: string }[];
};

/** Who is in the shop right now. */
export async function getBrowsingNow(): Promise<ActionResult<BrowsingNow>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("shopper_visitors")
      .select("phone,channel,last_seen")
      .gt("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: mapError(error.message) };
    const rows = (data ?? []) as Row[];
    const byPhone = new Map<string, { phone: string; channel: string; lastSeen: string }>();
    for (const r of rows) {
      const phone = text(r.phone);
      if (phone && !byPhone.has(phone)) byPhone.set(phone, { phone, channel: String(r.channel), lastSeen: String(r.last_seen) });
    }
    const phones = [...byPhone.keys()];
    const names = new Map<string, string>();
    if (phones.length) {
      const { data: people } = await supabase.from("store_customers").select("phone,name").in("phone", phones);
      for (const p of (people ?? []) as Row[]) if (p.name) names.set(String(p.phone), String(p.name));
    }
    return {
      ok: true,
      data: {
        total: rows.length,
        known: [...byPhone.values()].map((k) => ({ ...k, name: names.get(k.phone) ?? null })),
      },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
