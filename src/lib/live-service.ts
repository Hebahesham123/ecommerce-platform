import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapLiveMessage, mapLiveStream, type LiveMessage, type LiveStream } from "@/lib/live";
import { matchesRule, type CollectionRuleType } from "@/lib/collections";

/**
 * Live shopping, server side.
 *
 * Two jobs kept apart on purpose:
 *   - our database, which owns the event, the products and the chat;
 *   - the streaming provider, which owns the video and is reached only through
 *     the narrow interface below.
 *
 * Everything except actually broadcasting works with no provider configured,
 * so a merchant can schedule next week's live and line the products up before
 * anyone has opened a Cloudflare account. `prepare()` is the only call that
 * needs credentials, and it says so plainly instead of failing obscurely.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TABLE = "live_streams";
const missingTable = (msg: string) => msg.includes("live_stream");

// ---- The provider -----------------------------------------------------------

/** What any streaming provider has to give us. Cloudflare is one implementation. */
type LiveInputs = {
  providerStreamId: string;
  whipUrl: string;
  whepUrl: string;
  ingestUrl: string;
  streamKey: string;
  playbackUrl: string;
};

const CF_ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const CF_TOKEN = (process.env.CLOUDFLARE_STREAM_TOKEN ?? "").trim();
// Optional: only needed if Cloudflare ever stops returning a playback URL to
// read the subdomain from. Normally left unset.
const CF_CUSTOMER_CODE = (process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "").trim();

export const providerConfigured = () => Boolean(CF_ACCOUNT && CF_TOKEN);

/**
 * Which of the two the server cannot see.
 *
 * "Not connected" is true but useless: it cannot tell a missing variable from
 * a typo, from a deployment that was never rebuilt, from Production-only
 * variables on a preview URL. Names only — never the values.
 */
export function providerMissing(): string[] {
  const missing: string[] = [];
  if (!CF_ACCOUNT) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!CF_TOKEN) missing.push("CLOUDFLARE_STREAM_TOKEN");
  return missing;
}

/**
 * Cloudflare plays video from customer-<code>.cloudflarestream.com, and that
 * code is NOT the account id — it is a separate per-account subdomain. Every
 * URL the API hands back carries it, so it is read from one of those rather
 * than guessed, and never hardcoded.
 */
function customerCodeFrom(...urls: (string | undefined)[]): string | null {
  for (const u of urls) {
    const m = u?.match(/customer-([a-z0-9]+).cloudflarestream.com/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Ask Cloudflare for a live input: an address to broadcast to and a URL to
 * play. Recording is turned on at creation, because a replay that was never
 * recorded cannot be recovered afterwards.
 */
async function createCloudflareInput(title: string): Promise<Result<LiveInputs>> {
  if (!providerConfigured()) return { ok: false, error: "provider_not_configured" };
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/stream/live_inputs`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${CF_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          meta: { name: title },
          recording: { mode: "automatic", requireSignedURLs: false, timeoutSeconds: 10 },
        }),
      },
    );
    const body = (await res.json()) as {
      success?: boolean;
      errors?: { message?: string }[];
      result?: {
        uid?: string;
        rtmps?: { url?: string; streamKey?: string };
        rtmpsPlayback?: { url?: string };
        srtPlayback?: { url?: string };
        webRTC?: { url?: string };
        webRTCPlayback?: { url?: string };
      };
    };
    if (!res.ok || !body.success || !body.result?.uid) {
      return { ok: false, error: body.errors?.[0]?.message || `cloudflare_${res.status}` };
    }
    const uid = String(body.result.uid);
    const code =
      customerCodeFrom(
        body.result.webRTCPlayback?.url,
        body.result.rtmpsPlayback?.url,
        body.result.srtPlayback?.url,
      ) || CF_CUSTOMER_CODE;
    if (!code) {
      // Better to say so now than to store a URL that plays nothing and
      // have it fail in front of an audience.
      return { ok: false, error: "cloudflare_no_playback_host" };
    }
    return {
      ok: true,
      data: {
        providerStreamId: uid,
        whipUrl: String(body.result.webRTC?.url ?? ""),
        whepUrl: String(body.result.webRTCPlayback?.url ?? ""),
        // RTMPS for a phone app today; the WebRTC URL on the same input is what
        // broadcasting from inside our own app will use later, so switching
        // does not mean a new stream or a new link to share.
        ingestUrl: String(body.result.rtmps?.url ?? ""),
        streamKey: String(body.result.rtmps?.streamKey ?? ""),
        playbackUrl: `https://customer-${code}.cloudflarestream.com/${uid}/manifest/video.m3u8`,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The recording, once Cloudflare has finished making it. */
async function cloudflareRecording(providerStreamId: string): Promise<string | null> {
  if (!providerConfigured()) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/stream/live_inputs/${providerStreamId}/videos`,
      { headers: { authorization: `Bearer ${CF_TOKEN}` } },
    );
    const body = (await res.json()) as {
      result?: {
        uid?: string;
        status?: { state?: string };
        playback?: { hls?: string };
      }[];
    };
    const ready = (body.result ?? []).find((v) => v.status?.state === "ready" && v.uid);
    if (!ready?.uid) return null;
    // Cloudflare returns the finished recording's own playback URL, which
    // already carries the right host.
    if (ready.playback?.hls) return ready.playback.hls;
    const code = customerCodeFrom(ready.playback?.hls) || CF_CUSTOMER_CODE;
    return code
      ? `https://customer-${code}.cloudflarestream.com/${ready.uid}/manifest/video.m3u8`
      : null;
  } catch {
    return null;
  }
}

// ---- Reads ------------------------------------------------------------------

const SELECT = "*, live_stream_products(*)";

export async function listLives(): Promise<Result<LiveStream[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return { ok: false, error: missingTable(error.message) ? "migration_missing" : error.message };
    }
    return { ok: true, data: (data ?? []).map(mapLiveStream) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getLive(id: string): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(TABLE).select(SELECT).eq("id", id).maybeSingle();
    if (error) {
      return { ok: false, error: missingTable(error.message) ? "migration_missing" : error.message };
    }
    if (!data) return { ok: false, error: "not_found" };
    return { ok: true, data: mapLiveStream(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** What the app shows: on air now, then what is scheduled, then replays. */
export async function listPublicLives(): Promise<Result<LiveStream[]>> {
  const all = await listLives();
  if (!all.ok) return all;
  const rank = (s: LiveStream) =>
    s.status === "live"
      ? 0
      : s.status === "scheduled"
        ? 1
        : s.status === "ended" && s.replayEnabled && s.recordingUrl
          ? 2
          : 3;
  return {
    ok: true,
    data: all.data.filter((s) => rank(s) < 3).sort((a, b) => rank(a) - rank(b)),
  };
}

/**
 * One live, priced and stocked as a viewer needs it.
 *
 * The products were chosen before the live was created, so their stock has
 * moved since — possibly during the live itself, as other viewers buy. The
 * quantity stepper has to cap against what is on the shelf now, not what was
 * there when the host lined the products up.
 */
export async function getPublicLive(id: string): Promise<Result<LiveStream>> {
  const res = await getLive(id);
  if (!res.ok) return res;
  return { ok: true, data: await withAvailability(res.data) };
}

async function withAvailability(live: LiveStream): Promise<LiveStream> {
  const ids = live.products.map((p) => p.itemId).filter((v): v is string => Boolean(v));
  if (ids.length === 0) return live;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("inventory_items")
      .select("id,tracked,inventory_levels(on_hand,committed)")
      .in("id", ids);
    const stock = new Map<string, number>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const levels = Array.isArray(row.inventory_levels)
        ? (row.inventory_levels as Record<string, unknown>[])
        : [];
      const onShelf = levels.reduce(
        (sum, l) => sum + Math.max(0, Number(l.on_hand ?? 0) - Number(l.committed ?? 0)),
        0,
      );
      // An untracked item is not stock-limited, so it never runs out on air.
      stock.set(String(row.id), row.tracked === false ? 999 : onShelf);
    }
    return {
      ...live,
      products: live.products.map((p) => ({
        ...p,
        available: p.itemId ? (stock.get(p.itemId) ?? 0) : 0,
      })),
    };
  } catch {
    return live;
  }
}
// ---- Writes -----------------------------------------------------------------

export async function saveLive(input: {
  id?: string;
  title: string;
  subtitle?: string | null;
  hostName?: string | null;
  coverUrl?: string | null;
  scheduledAt?: string | null;
  replayEnabled?: boolean;
  notes?: string | null;
}): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!input.title.trim()) return { ok: false, error: "missing_title" };
  try {
    const supabase = getServerSupabase();
    const row = {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      host_name: input.hostName?.trim() || null,
      cover_url: input.coverUrl?.trim() || null,
      scheduled_at: input.scheduledAt || null,
      replay_enabled: input.replayEnabled ?? true,
      notes: input.notes?.trim() || null,
    };
    const q = input.id
      ? supabase.from(TABLE).update(row).eq("id", input.id).select(SELECT).single()
      : supabase.from(TABLE).insert(row).select(SELECT).single();
    const { data, error } = await q;
    if (error) {
      return { ok: false, error: missingTable(error.message) ? "migration_missing" : error.message };
    }
    return { ok: true, data: mapLiveStream(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Get the broadcast credentials for a live, creating them once.
 *
 * Deliberately separate from going live: the key is wanted the day before, on
 * a laptop, to set the phone up — not in the thirty seconds before air.
 */
export async function prepareLive(id: string): Promise<Result<LiveStream>> {
  const existing = await getLive(id);
  if (!existing.ok) return existing;
  // Keys are not rotated casually: the phone is already pointed at this one.
  if (existing.data.streamKey) return existing;

  const input = await createCloudflareInput(existing.data.title);
  if (!input.ok) return input;

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        provider: "cloudflare",
        provider_stream_id: input.data.providerStreamId,
        ingest_url: input.data.ingestUrl,
        whip_url: input.data.whipUrl || null,
        whep_url: input.data.whepUrl || null,
        stream_key: input.data.streamKey,
        playback_url: input.data.playbackUrl,
      })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapLiveStream(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Rehearse the whole thing without a streaming account.
 *
 * Every part of a live except the video — going on air, the chat, the pinned
 * product, the viewer count, ending, the replay — is ours, and none of it
 * could be exercised before a card was on file somewhere. This points the
 * live at a public sample video so the flow can be walked end to end.
 *
 * It is offered only while no real provider is configured, so it cannot be
 * reached by accident once the shop is actually broadcasting, and the live is
 * stamped provider = "test" so the dashboard can say so plainly.
 */
const TEST_PLAYBACK_URL =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8";

export async function useTestStream(id: string): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (providerConfigured()) return { ok: false, error: "provider_already_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        provider: "test",
        playback_url: TEST_PLAYBACK_URL,
        recording_url: TEST_PLAYBACK_URL,
        ingest_url: null,
        stream_key: null,
      })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapLiveStream(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
export async function setLiveStatus(
  id: string,
  status: "scheduled" | "live" | "ended" | "cancelled",
): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const current = await getLive(id);
  if (!current.ok) return current;

  // Going on air without an address to broadcast to would show viewers a dead
  // player, which is worse than a stream that has not started.
  if (status === "live" && !current.data.playbackUrl) {
    return { ok: false, error: "not_prepared" };
  }

  try {
    const supabase = getServerSupabase();
    const patch: Record<string, unknown> = { status };
    if (status === "live" && !current.data.startedAt) patch.started_at = new Date().toISOString();
    if (status === "ended") patch.ended_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) return { ok: false, error: error.message };

    // The recording is not ready the instant a stream ends, so this is a first
    // attempt rather than the only one — refreshRecording() picks up the rest.
    if (status === "ended" && current.data.replayEnabled) {
      void refreshRecording(id);
    }
    return { ok: true, data: mapLiveStream(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Ask the provider whether the replay exists yet, and store it if it does. */
export async function refreshRecording(id: string): Promise<Result<string | null>> {
  const providerId = await providerIdOf(id);
  if (!providerId) return { ok: true, data: null };

  const url = await cloudflareRecording(providerId);
  if (!url) return { ok: true, data: null };
  try {
    const supabase = getServerSupabase();
    await supabase.from(TABLE).update({ recording_url: url }).eq("id", id);
    return { ok: true, data: url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function providerIdOf(id: string): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from(TABLE)
      .select("provider_stream_id")
      .eq("id", id)
      .maybeSingle();
    return (data?.provider_stream_id as string) ?? null;
  } catch {
    return null;
  }
}

export async function deleteLive(id: string): Promise<Result<void>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The highest number of people who were watching at once. Only ever grows. */
export async function reportViewers(id: string, viewers: number): Promise<void> {
  if (!isSupabaseConfigured() || viewers <= 0) return;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase.from(TABLE).select("peak_viewers").eq("id", id).maybeSingle();
    if (Number(data?.peak_viewers ?? 0) >= viewers) return;
    await supabase.from(TABLE).update({ peak_viewers: viewers }).eq("id", id);
  } catch {
    /* a missed peak is not worth failing a viewer's request over */
  }
}

// ---- Collections ------------------------------------------------------------

export type LiveCollection = { id: string; title: string; productCount: number };

/**
 * The shop's collections, with how many products each would put on air.
 *
 * A live is usually about a group the merchant already curates — the new
 * arrivals, the bags — and rebuilding that group by ticking twenty boxes is
 * work she has already done once.
 */
export async function listLiveCollections(): Promise<Result<LiveCollection[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("collections")
      .select("id,title,rule_type,rule_value,collection_products(item_id)")
      .order("position", { ascending: true });
    if (error) {
      if (error.message.includes("collections")) return { ok: true, data: [] };
      return { ok: false, error: error.message };
    }

    // A rule-based collection has no rows to count, so its size has to be
    // worked out against the catalogue the same way the storefront does.
    const catalogue = await matchableCatalogue();
    const out: LiveCollection[] = (data ?? []).map((row: Record<string, unknown>) => {
      const ruleType = String(row.rule_type ?? "manual") as CollectionRuleType;
      const manual = Array.isArray(row.collection_products)
        ? (row.collection_products as Record<string, unknown>[]).length
        : 0;
      const count =
        ruleType === "manual"
          ? manual
          : catalogue.filter((c) =>
              matchesRule(c, ruleType, (row.rule_value as string) ?? null),
            ).length;
      return {
        id: String(row.id),
        title: String(row.title ?? ""),
        productCount: count,
      };
    });
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type Matchable = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  category: string | null;
  vendor: string | null;
  tags: string[];
};

/** One row per sellable item, carrying what a collection rule asks about. */
async function matchableCatalogue(): Promise<Matchable[]> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("inventory_items")
      .select("id,product_name,image_url,price,category,vendor,tags");
    return (data ?? []).map((r: Record<string, unknown>) => ({
      itemId: String(r.id),
      productName: String(r.product_name ?? ""),
      imageUrl: (r.image_url as string) ?? null,
      price: r.price == null ? null : Number(r.price),
      category: (r.category as string) ?? null,
      vendor: (r.vendor as string) ?? null,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    }));
  } catch {
    return [];
  }
}

/**
 * Everything a collection would put on air, as live products.
 *
 * Resolved at the moment it is chosen rather than kept as a link: a live is a
 * fixed event with a fixed shelf, and a collection edited next month should
 * not quietly rewrite what last month's replay was selling.
 */
export async function collectionProducts(collectionId: string): Promise<Result<LiveProductInput[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: collection, error } = await supabase
      .from("collections")
      .select("id,rule_type,rule_value,collection_products(item_id,product_name,position)")
      .eq("id", collectionId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!collection) return { ok: false, error: "not_found" };

    const catalogue = await matchableCatalogue();
    const byId = new Map(catalogue.map((c) => [c.itemId, c]));
    const ruleType = String(collection.rule_type ?? "manual") as CollectionRuleType;

    const chosen: Matchable[] =
      ruleType === "manual"
        ? (Array.isArray(collection.collection_products)
            ? (collection.collection_products as Record<string, unknown>[])
            : []
          )
            .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
            .map((row) => byId.get(String(row.item_id)))
            .filter((c): c is Matchable => Boolean(c))
        : catalogue.filter((c) =>
            matchesRule(c, ruleType, (collection.rule_value as string) ?? null),
          );

    return {
      ok: true,
      data: chosen.map((c) => ({
        itemId: c.itemId,
        productName: c.productName,
        imageUrl: c.imageUrl,
        price: c.price,
        discountCode: null,
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Products on air --------------------------------------------------------

export type LiveProductInput = {
  itemId: string | null;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  discountCode: string | null;
};

export async function setLiveProducts(
  liveId: string,
  products: LiveProductInput[],
): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    await supabase.from("live_stream_products").delete().eq("live_id", liveId);
    if (products.length) {
      const { error } = await supabase.from("live_stream_products").insert(
        products.map((p, i) => ({
          live_id: liveId,
          item_id: p.itemId,
          product_name: p.productName,
          image_url: p.imageUrl,
          price: p.price,
          discount_code: p.discountCode,
          sort_order: i,
        })),
      );
      if (error) return { ok: false, error: error.message };
    }
    return getLive(liveId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Put one product in front of viewers. Unpinning the rest is the point. */
export async function pinLiveProduct(
  liveId: string,
  productId: string | null,
): Promise<Result<LiveStream>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    await supabase.from("live_stream_products").update({ pinned: false }).eq("live_id", liveId);
    if (productId) {
      const { error } = await supabase
        .from("live_stream_products")
        .update({ pinned: true })
        .eq("id", productId)
        .eq("live_id", liveId);
      if (error) return { ok: false, error: error.message };
    }
    return getLive(liveId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Chat -------------------------------------------------------------------

export async function listMessages(liveId: string, limit = 200): Promise<Result<LiveMessage[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("live_stream_messages")
      .select("*")
      .eq("live_id", liveId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { ok: false, error: missingTable(error.message) ? "migration_missing" : error.message };
    }
    return { ok: true, data: (data ?? []).map(mapLiveMessage).reverse() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function postMessage(input: {
  liveId: string;
  authorName: string;
  body: string;
  phone?: string | null;
  isHost?: boolean;
}): Promise<Result<LiveMessage>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const body = input.body.trim().slice(0, 240);
  if (!body) return { ok: false, error: "empty_message" };

  const live = await getLive(input.liveId);
  if (!live.ok) return live;
  // Chat belongs to the broadcast. A replay's chat is history, not a guestbook.
  if (live.data.status !== "live") return { ok: false, error: "chat_closed" };

  try {
    const supabase = getServerSupabase();
    const offsetMs = live.data.startedAt
      ? Math.max(0, Date.now() - new Date(live.data.startedAt).getTime())
      : null;
    const { data, error } = await supabase
      .from("live_stream_messages")
      .insert({
        live_id: input.liveId,
        phone: input.phone ?? null,
        author_name: input.authorName.trim().slice(0, 60) || "Guest",
        body,
        offset_ms: offsetMs,
        is_host: Boolean(input.isHost),
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapLiveMessage(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function hideMessage(id: string, hidden = true): Promise<Result<void>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("live_stream_messages").update({ hidden }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
