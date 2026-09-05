/**
 * Hesitation nudges — the vocabulary the dashboard editor, the storefront
 * script and the results page all share.
 *
 * Pure (no database, no `server-only`) so the admin client can import the types
 * and the renderer can reuse the same shapes without either copying them.
 */

export type NudgeStyle = "card" | "wheel" | "capture";
export type NudgePosition = "center" | "bottom-right" | "bottom-left" | "bottom-bar";

/** Which kind of storefront page a nudge may appear on. */
export type NudgePage = "index" | "product" | "collection" | "cart" | "search";

/** Which signal decided the shopper was hesitating. */
export type NudgeTrigger = "dwell" | "exit" | "idle" | "cart";

export type NudgeEventType =
  | "hesitation"
  | "shown"
  | "dismissed"
  | "claimed"
  | "converted";

export type WheelSegment = { label: string; code: string; weight: number };

export type NudgeCampaign = {
  id: string;
  name: string;
  enabled: boolean;

  dwellEnabled: boolean;
  dwellSeconds: number;
  exitEnabled: boolean;
  idleEnabled: boolean;
  idleSeconds: number;
  cartEnabled: boolean;
  cartSeconds: number;

  pages: NudgePage[];
  maxPerSession: number;
  cooldownHours: number;
  skipIfCartEmpty: boolean;

  style: NudgeStyle;
  position: NudgePosition;
  headline: string;
  body: string;
  buttonLabel: string;
  dismissLabel: string;
  captureLabel: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  imageUrl: string | null;

  discountCode: string | null;
  wheelSegments: WheelSegment[];

  updatedAt: string;
};

export const ALL_PAGES: NudgePage[] = ["index", "product", "collection", "cart", "search"];

export const PAGE_LABELS: Record<NudgePage, { ar: string; en: string }> = {
  index: { ar: "الصفحة الرئيسية", en: "Home page" },
  product: { ar: "صفحة المنتج", en: "Product pages" },
  collection: { ar: "صفحة التصنيف", en: "Collection pages" },
  cart: { ar: "السلة", en: "Cart page" },
  search: { ar: "البحث", en: "Search results" },
};

export const TRIGGER_LABELS: Record<NudgeTrigger, { ar: string; en: string }> = {
  dwell: { ar: "بقاء طويل على الصفحة", en: "Long dwell on one page" },
  exit: { ar: "نية المغادرة", en: "Exit intent" },
  idle: { ar: "توقف عن التفاعل", en: "Gone quiet" },
  cart: { ar: "سلة بلا إتمام", en: "Cart with no checkout" },
};

export const STYLE_LABELS: Record<NudgeStyle, { ar: string; en: string }> = {
  card: { ar: "بطاقة خصم", en: "Discount card" },
  wheel: { ar: "عجلة الحظ", en: "Spin the wheel" },
  capture: { ar: "بريد أو هاتف أولاً", en: "Email or phone first" },
};

export const POSITION_LABELS: Record<NudgePosition, { ar: string; en: string }> = {
  center: { ar: "منتصف الشاشة", en: "Centre of the screen" },
  "bottom-right": { ar: "أسفل يمين", en: "Bottom right" },
  "bottom-left": { ar: "أسفل يسار", en: "Bottom left" },
  "bottom-bar": { ar: "شريط سفلي", en: "Bottom bar" },
};

type Row = Record<string, unknown>;
const int = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));

function pagesOf(v: unknown): NudgePage[] {
  if (!Array.isArray(v)) return ["product", "collection", "cart"];
  const out = v.map((p) => String(p)).filter((p): p is NudgePage =>
    (ALL_PAGES as string[]).includes(p),
  );
  return out.length ? out : ["product"];
}

function segmentsOf(v: unknown): WheelSegment[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => {
      const r = (s ?? {}) as Row;
      return {
        label: str(r.label).slice(0, 40),
        code: str(r.code).slice(0, 40),
        weight: Math.max(0, int(r.weight, 1)),
      };
    })
    .filter((s) => s.label);
}

export function mapCampaign(r: Row): NudgeCampaign {
  return {
    id: String(r.id),
    name: str(r.name, "Hesitation offer"),
    enabled: Boolean(r.enabled),

    dwellEnabled: r.dwell_enabled !== false,
    dwellSeconds: Math.max(5, int(r.dwell_seconds, 45)),
    exitEnabled: r.exit_enabled !== false,
    idleEnabled: Boolean(r.idle_enabled),
    idleSeconds: Math.max(5, int(r.idle_seconds, 30)),
    cartEnabled: Boolean(r.cart_enabled),
    cartSeconds: Math.max(5, int(r.cart_seconds, 20)),

    pages: pagesOf(r.pages),
    maxPerSession: Math.max(1, int(r.max_per_session, 1)),
    cooldownHours: Math.max(0, int(r.cooldown_hours, 24)),
    skipIfCartEmpty: Boolean(r.skip_if_cart_empty),

    style: (["card", "wheel", "capture"] as string[]).includes(str(r.style))
      ? (str(r.style) as NudgeStyle)
      : "card",
    position: (["center", "bottom-right", "bottom-left", "bottom-bar"] as string[]).includes(
      str(r.position),
    )
      ? (str(r.position) as NudgePosition)
      : "center",
    headline: str(r.headline, "Still thinking it over?"),
    body: str(r.body, ""),
    buttonLabel: str(r.button_label, "Copy code and continue"),
    dismissLabel: str(r.dismiss_label, "No thanks"),
    captureLabel: str(r.capture_label, ""),
    accentColor: str(r.accent_color, "#e11d48"),
    backgroundColor: str(r.background_color, "#ffffff"),
    textColor: str(r.text_color, "#0f172a"),
    imageUrl: r.image_url ? String(r.image_url) : null,

    discountCode: r.discount_code ? String(r.discount_code) : null,
    wheelSegments: segmentsOf(r.wheel_segments),

    updatedAt: str(r.updated_at),
  };
}

/** Domain object → database row, for the admin editor's save. */
export function campaignToRow(c: NudgeCampaign): Row {
  return {
    name: c.name.trim() || "Hesitation offer",
    enabled: c.enabled,
    dwell_enabled: c.dwellEnabled,
    dwell_seconds: Math.max(5, Math.trunc(c.dwellSeconds)),
    exit_enabled: c.exitEnabled,
    idle_enabled: c.idleEnabled,
    idle_seconds: Math.max(5, Math.trunc(c.idleSeconds)),
    cart_enabled: c.cartEnabled,
    cart_seconds: Math.max(5, Math.trunc(c.cartSeconds)),
    pages: c.pages,
    max_per_session: Math.max(1, Math.trunc(c.maxPerSession)),
    cooldown_hours: Math.max(0, Math.trunc(c.cooldownHours)),
    skip_if_cart_empty: c.skipIfCartEmpty,
    style: c.style,
    position: c.position,
    headline: c.headline.trim(),
    body: c.body.trim(),
    button_label: c.buttonLabel.trim(),
    dismiss_label: c.dismissLabel.trim(),
    capture_label: c.captureLabel.trim(),
    accent_color: c.accentColor,
    background_color: c.backgroundColor,
    text_color: c.textColor,
    image_url: c.imageUrl?.trim() || null,
    discount_code: c.discountCode?.trim() || null,
    wheel_segments: c.wheelSegments,
  };
}

/**
 * At least one signal has to be on, or the campaign can never fire. The editor
 * uses this to explain why an "enabled" campaign is doing nothing.
 */
export function activeTriggers(c: NudgeCampaign): NudgeTrigger[] {
  const out: NudgeTrigger[] = [];
  if (c.dwellEnabled) out.push("dwell");
  if (c.exitEnabled) out.push("exit");
  if (c.idleEnabled) out.push("idle");
  if (c.cartEnabled) out.push("cart");
  return out;
}

/** Everything that would stop this campaign from ever showing. */
export function campaignProblems(c: NudgeCampaign): string[] {
  const out: string[] = [];
  if (!activeTriggers(c).length) out.push("no_triggers");
  if (!c.pages.length) out.push("no_pages");
  if (c.style === "wheel") {
    if (c.wheelSegments.length < 2) out.push("wheel_needs_segments");
  } else if (!c.discountCode) out.push("no_code");
  return out;
}
