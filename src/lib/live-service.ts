import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapLiveMessage, mapLiveStream, type LiveMessage, type LiveStream } from "@/lib/live";

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
  ingestUrl: string;
  streamKey: string;
  playbackUrl: string;
};

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const CF_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN ?? "";

export const providerConfigured = () => Boolean(CF_ACCOUNT && CF_TOKEN);

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
        webRTC?: { url?: string };
      };
    };
    if (!res.ok || !body.success || !body.result?.uid) {
      return { ok: false, error: body.errors?.[0]?.message || `cloudflare_${res.status}` };
    }
    const uid = String(body.result.uid);
    return {
      ok: true,
      data: {
        providerStreamId: uid,
        // RTMPS for a phone app today; the WebRTC URL on the same input is what
        // broadcasting from inside our own app will use later, so switching
        // does not mean a new stream or a new link to share.
        ingestUrl: String(body.result.rtmps?.url ?? ""),
        streamKey: String(body.result.rtmps?.streamKey ?? ""),
        playbackUrl: `https://customer-${CF_ACCOUNT}.cloudflarestream.com/${uid}/manifest/video.m3u8`,
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
      result?: { uid?: string; status?: { state?: string } }[];
    };
    const ready = (body.result ?? []).find((v) => v.status?.state === "ready" && v.uid);
    return ready?.uid
      ? `https://customer-${CF_ACCOUNT}.cloudflarestream.com/${ready.uid}/manifest/video.m3u8`
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
