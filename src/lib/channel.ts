/**
 * Which surface a shopper used.
 *
 * Deliberately a label on the same row rather than a second set of tables:
 * there is one catalogue, one inventory, one order table and one checkout, and
 * the channel only records where a row came from. That is what keeps stock
 * honest across surfaces — an app buyer and a web buyer contend for the same
 * unit through the same lock.
 *
 * Stored as free text so a third surface (a kiosk, a WhatsApp catalogue) needs
 * no migration to start reporting.
 */
export type Channel = "web" | "app";

export const CHANNELS: Channel[] = ["web", "app"];

export const CHANNEL_LABELS: Record<Channel, { ar: string; en: string }> = {
  web: { ar: "الموقع", en: "Website" },
  app: { ar: "التطبيق", en: "App" },
};

/** Anything unrecognised is the website — the surface that existed first. */
export function normalizeChannel(v: unknown): Channel {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "app" ? "app" : "web";
}

/** Label for display, falling back to the raw value for a future channel. */
export function channelLabel(v: unknown, lang: "ar" | "en"): string {
  const s = String(v ?? "web").trim().toLowerCase();
  if (s === "web" || s === "app") return CHANNEL_LABELS[s][lang];
  return s;
}
