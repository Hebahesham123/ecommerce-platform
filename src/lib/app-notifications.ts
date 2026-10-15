import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { isPhoneComplete, normalizePhone } from "@/lib/phone";

/**
 * App notifications: a message written in the dashboard reaches every install
 * it is meant for twice over — in the bell inside the app, and as a pop-up on
 * the phone if the phone allowed them.
 *
 * Every install is known by the visitor id the app makes on first launch (the
 * same id the shopper tracking uses), registered here each time the app opens;
 * signing in adds the phone it belongs to. Delivery is written down per install
 * when a message is sent — that list is the bell — and the pop-ups go out
 * through Expo's push service, which hands them to Apple and Google.
 *
 * Tables: supabase/migrations/0056_app_notifications.sql.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** What a tap opens, in the app's own link shape (the one its tiles use). */
export type NotificationLink = { productId?: string; handle?: string; url?: string; screen?: string };

export type Audience = "all" | "signed_in" | "buyers" | "cart" | "phones";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  link: NotificationLink;
  audience: Audience;
  audiencePhones: string[];
  status: "draft" | "sending" | "sent" | "failed";
  recipients: number;
  pushed: number;
  pushFailed: number;
  opened: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  link: NotificationLink;
  sentAt: string;
  read: boolean;
};

const missing = (msg: string) => /app_devices|app_notifications|app_notification_inbox|app_notification_opened/.test(msg);
const fail = (msg: string): { ok: false; error: string } => ({ ok: false, error: missing(msg) ? "migration_missing" : msg });

/** A pop-up's text is cut to what a lock screen shows anyway. */
const TITLE_MAX = 65;
const BODY_MAX = 240;
/** A cart counts as left behind for this long. */
const CART_DAYS = 14;

function cleanLink(v: unknown): NotificationLink {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 500) : undefined);
  // One kind only, most specific first — as the app reads them.
  if (s(o.productId)) return { productId: s(o.productId) };
  if (s(o.handle)) return { handle: s(o.handle) };
  if (s(o.screen)) return { screen: s(o.screen) };
  const url = s(o.url);
  if (url && /^https?:\/\//i.test(url)) return { url };
  return {};
}

function rowToNotification(r: Record<string, unknown>): AppNotification {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    imageUrl: (r.image_url as string | null) ?? null,
    link: cleanLink(r.link),
    audience: (r.audience as Audience) ?? "all",
    audiencePhones: (r.audience_phones as string[] | null) ?? [],
    status: (r.status as AppNotification["status"]) ?? "draft",
    recipients: Number(r.recipients ?? 0),
    pushed: Number(r.pushed ?? 0),
    pushFailed: Number(r.push_failed ?? 0),
    opened: Number(r.opened ?? 0),
    error: (r.error as string | null) ?? null,
    createdAt: String(r.created_at),
    sentAt: (r.sent_at as string | null) ?? null,
  };
}

/** Every row of a query, a page at a time: Supabase answers 1,000 rows at most. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/* ------------------------------------------------------------------ */
/* The app's side                                                     */
/* ------------------------------------------------------------------ */

const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

/**
 * An install says it is here: on every launch, and again on signing in (so
 * the phone it belongs to is known) and whenever pop-ups are allowed or
 * refused. A token another install held before (a reinstall) moves here.
 */
export async function registerDevice(input: {
  visitor: string;
  phone: string | null;
  platform: string;
  pushToken: string | null;
  pushEnabled: boolean;
}): Promise<Result<{ registered: true }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const visitor = input.visitor.trim().slice(0, 64);
  if (!visitor) return { ok: false, error: "no_visitor" };
  const token = input.pushToken && EXPO_TOKEN.test(input.pushToken) ? input.pushToken : null;
  const sb = getServerSupabase();

  if (token) {
    const { error } = await sb.from("app_devices").update({ push_token: null, push_enabled: false }).eq("push_token", token).neq("visitor_id", visitor);
    if (error) return fail(error.message);
  }
  const row: Record<string, unknown> = {
    visitor_id: visitor,
    platform: input.platform === "ios" || input.platform === "android" ? input.platform : null,
    last_seen: new Date().toISOString(),
  };
  // A signed-out launch leaves the phone it was signed in as; signing in sets it.
  if (input.phone) row.phone = normalizePhone(input.phone);
  // Pop-ups change only on news about them: a token (allowed) or a refusal.
  // A launch that says neither leaves them as they were.
  if (token) {
    row.push_token = token;
    row.push_enabled = input.pushEnabled;
    row.push_failed_at = null;
  } else if (!input.pushEnabled) {
    row.push_token = null;
    row.push_enabled = false;
  }
  const { error } = await sb.from("app_devices").upsert(row, { onConflict: "visitor_id" });
  if (error) return fail(error.message);
  return { ok: true, data: { registered: true } };
}

/** The bell: the latest messages delivered to this install, and how many are unread. */
export async function inboxFor(visitor: string, limit = 50): Promise<Result<{ items: InboxItem[]; unread: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!visitor) return { ok: true, data: { items: [], unread: 0 } };
  const sb = getServerSupabase();
  const [{ data, error }, { count, error: countErr }] = await Promise.all([
    sb
      .from("app_notification_inbox")
      .select("delivered_at, read_at, app_notifications(id, title, body, image_url, link)")
      .eq("visitor_id", visitor)
      .order("delivered_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit))),
    sb.from("app_notification_inbox").select("notification_id", { count: "exact", head: true }).eq("visitor_id", visitor).is("read_at", null),
  ]);
  if (error) return fail(error.message);
  if (countErr) return fail(countErr.message);
  const items: InboxItem[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const n = (Array.isArray(r.app_notifications) ? r.app_notifications[0] : r.app_notifications) as Record<string, unknown> | null;
    if (!n) continue;
    items.push({
      id: String(n.id),
      title: String(n.title ?? ""),
      body: String(n.body ?? ""),
      imageUrl: (n.image_url as string | null) ?? null,
      link: cleanLink(n.link),
      sentAt: String(r.delivered_at),
      read: Boolean(r.read_at),
    });
  }
  return { ok: true, data: { items, unread: count ?? 0 } };
}

/** Opening the bell reads what is in it: all of it, or the messages named. */
export async function markRead(visitor: string, ids: string[] | "all"): Promise<Result<{ unread: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!visitor) return { ok: true, data: { unread: 0 } };
  const sb = getServerSupabase();
  const clean = ids === "all" ? [] : ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (ids === "all" || clean.length) {
    let q = sb.from("app_notification_inbox").update({ read_at: new Date().toISOString() }).eq("visitor_id", visitor).is("read_at", null);
    if (ids !== "all") q = q.in("notification_id", clean);
    const { error } = await q;
    if (error) return fail(error.message);
  }
  const { count, error: countErr } = await sb
    .from("app_notification_inbox")
    .select("notification_id", { count: "exact", head: true })
    .eq("visitor_id", visitor)
    .is("read_at", null);
  if (countErr) return fail(countErr.message);
  return { ok: true, data: { unread: count ?? 0 } };
}

/** A message was tapped — in the bell or on the lock screen. Counted once per install. */
export async function markOpened(id: string, visitor: string): Promise<Result<{ counted: boolean }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!visitor || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: { counted: false } };
  const { data, error } = await getServerSupabase().rpc("app_notification_opened", { p_id: id, p_visitor: visitor });
  if (error) return fail(error.message);
  return { ok: true, data: { counted: Boolean(data) } };
}

/* ------------------------------------------------------------------ */
/* The dashboard's side                                               */
/* ------------------------------------------------------------------ */

type Device = { visitor_id: string; phone: string | null; push_token: string | null; push_enabled: boolean };

/** The installs a message is for. */
async function devicesFor(audience: Audience, phones: string[]): Promise<Device[]> {
  const sb = getServerSupabase();
  const cols = "visitor_id, phone, push_token, push_enabled";
  const devices = await allRows<Device>((a, b) => sb.from("app_devices").select(cols).order("visitor_id").range(a, b));

  if (audience === "all") return devices;
  if (audience === "signed_in") return devices.filter((d) => d.phone);
  if (audience === "phones") {
    const wanted = new Set(phones.map(normalizePhone));
    return devices.filter((d) => d.phone && wanted.has(normalizePhone(d.phone)));
  }
  if (audience === "buyers") {
    // Order phones are stored in more than one spelling; compared normalized.
    const orders = await allRows<{ phone: string | null }>((a, b) => sb.from("store_orders").select("phone").order("id").range(a, b));
    const bought = new Set(orders.map((o) => (o.phone ? normalizePhone(o.phone) : "")).filter(Boolean));
    return devices.filter((d) => d.phone && bought.has(normalizePhone(d.phone)));
  }
  // cart: something left in the basket in the last two weeks, with no order after it.
  const since = new Date(Date.now() - CART_DAYS * 86400_000).toISOString();
  const carts = await allRows<{ visitor_id: string; phone: string | null }>((a, b) =>
    sb
      .from("shopper_carts")
      .select("visitor_id, phone")
      .gt("item_count", 0)
      .is("ordered_at", null)
      .gte("updated_at", since)
      .order("visitor_id")
      .range(a, b),
  );
  const visitors = new Set(carts.map((c) => c.visitor_id));
  const cartPhones = new Set(carts.map((c) => (c.phone ? normalizePhone(c.phone) : "")).filter(Boolean));
  return devices.filter((d) => visitors.has(d.visitor_id) || (d.phone && cartPhones.has(normalizePhone(d.phone))));
}

/** How many installs, and how many of them will get a pop-up, before sending. */
export async function audienceSize(audience: Audience, phones: string[]): Promise<Result<{ installs: number; popups: number }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const d = await devicesFor(audience, phones);
    return { ok: true, data: { installs: d.length, popups: d.filter((x) => x.push_enabled && x.push_token).length } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "failed");
  }
}

export async function listNotifications(limit = 100): Promise<Result<AppNotification[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const { data, error } = await getServerSupabase()
    .from("app_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return { ok: true, data: (data ?? []).map((r) => rowToNotification(r as Record<string, unknown>)) };
}

export async function deleteNotification(id: string): Promise<Result<{ deleted: true }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const { error } = await getServerSupabase().from("app_notifications").delete().eq("id", id);
  if (error) return fail(error.message);
  return { ok: true, data: { deleted: true } };
}

/**
 * Write a message and send it: delivered into the bell of every install it is
 * for, then popped up on each of those phones that allowed it.
 */
export async function sendNotification(input: {
  title: string;
  body: string;
  imageUrl: string | null;
  link: NotificationLink;
  audience: Audience;
  audiencePhones: string[];
}): Promise<Result<AppNotification>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const title = input.title.trim().slice(0, TITLE_MAX);
  const body = input.body.trim().slice(0, BODY_MAX);
  if (!title) return { ok: false, error: "title_required" };
  const phones = input.audience === "phones" ? input.audiencePhones.filter(isPhoneComplete).map(normalizePhone).slice(0, 5000) : [];
  if (input.audience === "phones" && !phones.length) return { ok: false, error: "phones_required" };
  const imageUrl = input.imageUrl && /^https?:\/\//i.test(input.imageUrl.trim()) ? input.imageUrl.trim().slice(0, 1000) : null;
  const link = cleanLink(input.link);
  const sb = getServerSupabase();

  const { data: created, error } = await sb
    .from("app_notifications")
    .insert({ title, body, image_url: imageUrl, link, audience: input.audience, audience_phones: phones, status: "sending" })
    .select("*")
    .single();
  if (error || !created) return fail(error?.message ?? "insert_failed");
  const id = String(created.id);

  const finish = async (patch: Record<string, unknown>) => {
    const { data } = await sb.from("app_notifications").update(patch).eq("id", id).select("*").single();
    return data ? rowToNotification(data as Record<string, unknown>) : rowToNotification({ ...created, ...patch });
  };

  try {
    const devices = await devicesFor(input.audience, phones);

    // The bell first: delivered is delivered, whatever the pop-ups do.
    for (let i = 0; i < devices.length; i += 500) {
      const rows = devices.slice(i, i + 500).map((d) => ({ notification_id: id, visitor_id: d.visitor_id }));
      const { error: inboxErr } = await sb.from("app_notification_inbox").upsert(rows, { onConflict: "notification_id,visitor_id", ignoreDuplicates: true });
      if (inboxErr) throw new Error(inboxErr.message);
    }

    const tokens = devices.filter((d) => d.push_enabled && d.push_token).map((d) => d.push_token!);
    const pushed = await pushToPhones(tokens, { id, title, body, imageUrl, link });

    return {
      ok: true,
      data: await finish({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipients: devices.length,
        pushed: pushed.ok,
        push_failed: pushed.failed,
        error: pushed.error,
      }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    await finish({ status: "failed", error: msg });
    return fail(msg);
  }
}

/* ------------------------------------------------------------------ */
/* Pop-ups, through Expo's push service                               */
/* ------------------------------------------------------------------ */

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

type Ticket = { status: "ok" | "error"; id?: string; message?: string; details?: { error?: string } };

/**
 * Hand the pop-ups to Expo, a hundred at a time (its limit per request).
 * A phone the push service says is gone (the app was removed) is switched off,
 * so it is not tried again.
 */
async function pushToPhones(
  tokens: string[],
  n: { id: string; title: string; body: string; imageUrl: string | null; link: NotificationLink },
): Promise<{ ok: number; failed: number; error: string | null }> {
  let ok = 0;
  let failed = 0;
  let lastError: string | null = null;
  const dead: string[] = [];
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  // Only needed once "enhanced push security" is turned on for the Expo project.
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const messages = batch.map((to) => ({
      to,
      title: n.title,
      body: n.body,
      sound: "default",
      channelId: "default",
      priority: "high",
      data: { notificationId: n.id, link: n.link },
      ...(n.imageUrl ? { richContent: { image: n.imageUrl } } : {}),
    }));
    try {
      const res = await fetch(EXPO_PUSH, { method: "POST", headers, body: JSON.stringify(messages) });
      const json = (await res.json().catch(() => null)) as { data?: Ticket[]; errors?: { message?: string }[] } | null;
      if (!res.ok || !Array.isArray(json?.data)) {
        failed += batch.length;
        lastError = json?.errors?.[0]?.message ?? `expo_${res.status}`;
        continue;
      }
      json.data.forEach((t, k) => {
        if (t.status === "ok") ok++;
        else {
          failed++;
          lastError = t.message ?? t.details?.error ?? "push_error";
          if (t.details?.error === "DeviceNotRegistered") dead.push(batch[k]);
        }
      });
    } catch (e) {
      failed += batch.length;
      lastError = e instanceof Error ? e.message : "expo_unreachable";
    }
  }

  if (dead.length) {
    await getServerSupabase()
      .from("app_devices")
      .update({ push_enabled: false, push_failed_at: new Date().toISOString() })
      .in("push_token", dead);
  }
  return { ok, failed, error: failed ? lastError : null };
}
