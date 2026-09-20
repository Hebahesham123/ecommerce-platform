/**
 * Live shopping — the vocabulary the dashboard, the app API and the app screens
 * all share.
 *
 * Pure: no database, no `server-only`, no provider SDK. The admin client
 * imports the same types the service writes, so neither side has to keep its
 * own copy of what a live is.
 */

export type LiveStatus = "scheduled" | "live" | "ended" | "cancelled";

export type LiveProduct = {
  id: string;
  itemId: string | null;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  discountCode: string | null;
  /** The one the host is holding up right now. At most one per live. */
  pinned: boolean;
  sortOrder: number;
};

export type LiveStream = {
  id: string;
  title: string;
  subtitle: string | null;
  hostName: string | null;
  coverUrl: string | null;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** Where the phone broadcasts to. Dashboard only — never sent to the app. */
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string | null;
  recordingUrl: string | null;
  replayEnabled: boolean;
  peakViewers: number;
  notes: string | null;
  products: LiveProduct[];
  createdAt: string;
};

export type LiveMessage = {
  id: string;
  liveId: string;
  authorName: string;
  body: string;
  isHost: boolean;
  offsetMs: number | null;
  createdAt: string;
};

export const STATUS_LABELS: Record<LiveStatus, { ar: string; en: string }> = {
  scheduled: { ar: "مجدول", en: "Scheduled" },
  live: { ar: "على الهواء", en: "Live" },
  ended: { ar: "انتهى", en: "Ended" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

/** What a viewer can do with this stream right now. */
export function watchableState(s: LiveStream): "live" | "replay" | "upcoming" | "gone" {
  if (s.status === "live" && s.playbackUrl) return "live";
  if (s.status === "ended" && s.replayEnabled && s.recordingUrl) return "replay";
  if (s.status === "scheduled") return "upcoming";
  return "gone";
}

/** Chat is only open while a live is on air. A replay's chat is history. */
export const chatIsOpen = (s: LiveStream) => s.status === "live";

/** A message body long enough to matter, short enough not to be a wall. */
export const MESSAGE_MAX = 240;

export function countdownTo(when: string | null, now: Date = new Date()): number {
  if (!when) return 0;
  return new Date(when).getTime() - now.getTime();
}

/**
 * The one number that decides the bill: everyone watching, every minute.
 *
 * Kept here so the dashboard can show what a live actually cost next to what
 * it sold, rather than the merchant finding out at the end of the month.
 */
export function deliveredMinutes(peakViewers: number, startedAt: string | null, endedAt: string | null): number {
  if (!startedAt || !endedAt) return 0;
  const minutes = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000;
  return Math.max(0, Math.round(minutes * peakViewers));
}

/** Rough money for those minutes. The rate is the provider's, so it is a prop. */
export function estimatedCost(minutes: number, ratePerThousandMinutes = 1): number {
  return Math.round((minutes / 1000) * ratePerThousandMinutes * 100) / 100;
}

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? null : String(v));

export function mapLiveProduct(r: Row): LiveProduct {
  return {
    id: String(r.id),
    itemId: s(r.item_id),
    productName: String(r.product_name ?? ""),
    imageUrl: s(r.image_url),
    price: r.price == null ? null : Number(r.price),
    discountCode: s(r.discount_code),
    pinned: Boolean(r.pinned),
    sortOrder: n(r.sort_order),
  };
}

export function mapLiveStream(r: Row): LiveStream {
  const products = Array.isArray(r.live_stream_products) ? (r.live_stream_products as Row[]) : [];
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    subtitle: s(r.subtitle),
    hostName: s(r.host_name),
    coverUrl: s(r.cover_url),
    status: (r.status as LiveStatus) ?? "scheduled",
    scheduledAt: s(r.scheduled_at),
    startedAt: s(r.started_at),
    endedAt: s(r.ended_at),
    ingestUrl: s(r.ingest_url),
    streamKey: s(r.stream_key),
    playbackUrl: s(r.playback_url),
    recordingUrl: s(r.recording_url),
    replayEnabled: r.replay_enabled == null ? true : Boolean(r.replay_enabled),
    peakViewers: n(r.peak_viewers),
    notes: s(r.notes),
    products: products.map(mapLiveProduct).sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: String(r.created_at ?? ""),
  };
}

export function mapLiveMessage(r: Row): LiveMessage {
  return {
    id: String(r.id),
    liveId: String(r.live_id),
    authorName: String(r.author_name ?? ""),
    body: String(r.body ?? ""),
    isHost: Boolean(r.is_host),
    offsetMs: r.offset_ms == null ? null : Number(r.offset_ms),
    createdAt: String(r.created_at ?? ""),
  };
}

/**
 * What the app is allowed to know about a live.
 *
 * The broadcast credentials are on the same row as the playback URL, and the
 * app must never receive them: anyone holding the stream key can broadcast as
 * the shop. So the app's shape is built by naming what it gets, not by deleting
 * what it must not — a field added later is then absent by default.
 */
export type PublicLive = {
  id: string;
  title: string;
  subtitle: string | null;
  hostName: string | null;
  coverUrl: string | null;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  playbackUrl: string | null;
  recordingUrl: string | null;
  peakViewers: number;
  products: LiveProduct[];
};

export function publicLive(s: LiveStream): PublicLive {
  const watchable = watchableState(s);
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    hostName: s.hostName,
    coverUrl: s.coverUrl,
    status: s.status,
    scheduledAt: s.scheduledAt,
    startedAt: s.startedAt,
    // Only hand over a URL the viewer may actually play right now.
    playbackUrl: watchable === "live" ? s.playbackUrl : null,
    recordingUrl: watchable === "replay" ? s.recordingUrl : null,
    peakViewers: s.peakViewers,
    products: s.products,
  };
}
