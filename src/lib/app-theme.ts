/**
 * What the app looks like, as data.
 *
 * The website's theme is a bundle of Liquid, CSS and images, which an app
 * cannot use: it draws its own screens and needs telling what to draw, not
 * handing markup. So this is the app's equivalent — a brand, and an ordered
 * list of home-screen blocks — and the dashboard edits it the way the theme
 * customizer edits a section's settings.
 *
 * Deliberately small and typed. Every block a merchant can add has to exist as
 * a screen in the app, so a theme model that can express more than the app can
 * draw is a promise the app will break. Adding a block type here means adding
 * one there, on purpose.
 *
 * Shared by the editor, the API and the preview, so all three agree about what
 * a theme is without a schema written down in three places.
 */

export type BlockType =
  | "banner"
  | "collection_row"
  | "collection_grid"
  | "new_arrivals"
  | "categories"
  | "reviews"
  | "text";

export type Block = {
  /** Stable across reorders, so React and the editor can follow a block. */
  id: string;
  type: BlockType;
  settings: Record<string, unknown>;
};

export type AppSettings = {
  storeName: string;
  logoUrl: string | null;
  /** The one colour the app is built around: buttons, prices, the active tab. */
  accent: string;
  announcement: string;
  announcementEnabled: boolean;
  /** Which navigation menu fills the app's drawer. */
  menuHandle: string;
  showSearch: boolean;
};

export type AppTheme = { settings: AppSettings; blocks: Block[] };

/**
 * How many collections a row block with no collection chosen shows.
 *
 * A store with fifty-three collections would otherwise get fifty-three rows,
 * which is a sitemap rather than a home screen — and a front page nobody can
 * afford to download. The merchant's own order decides which win; the rest are
 * a tap away under the category chips.
 */
export const ALL_ROWS_CAP = 8;

export const DEFAULT_SETTINGS: AppSettings = {
  storeName: "BeautyBar",
  logoUrl: null,
  accent: "#7c3aed",
  announcement: "",
  announcementEnabled: false,
  menuHandle: "main-menu",
  showSearch: true,
};

/**
 * What a store gets before anyone has opened the editor.
 *
 * A shop that has never been themed should still have an app worth opening, so
 * the default is the arrangement most stores would build anyway: what is new,
 * then the collections they curated, in their own order.
 */
export const DEFAULT_BLOCKS: Block[] = [
  { id: "b-categories", type: "categories", settings: { title: "" } },
  { id: "b-new", type: "new_arrivals", settings: { title: "New arrivals", limit: 12 } },
  { id: "b-rows", type: "collection_row", settings: { handle: "", title: "", limit: 8 } },
];

/** Every block type, with what it is for and what it can be given. */
export const BLOCK_META: Record<
  BlockType,
  { ar: string; en: string; hintAr: string; hintEn: string }
> = {
  banner: {
    ar: "بانر",
    en: "Banner",
    hintAr: "صورة عريضة تفتح قسماً عند الضغط",
    hintEn: "A wide image that opens a collection when tapped",
  },
  collection_row: {
    ar: "صف قسم",
    en: "Collection row",
    hintAr: "منتجات قسم في صف أفقي. اتركي القسم فارغاً لعرض أول ٨ أقسام بالترتيب",
    hintEn: "One collection's products in a scrolling row. Leave the collection empty to show your first 8 collections, in your order",
  },
  collection_grid: {
    ar: "شبكة قسم",
    en: "Collection grid",
    hintAr: "منتجات قسم في شبكة",
    hintEn: "One collection's products as a grid",
  },
  new_arrivals: {
    ar: "وصل حديثاً",
    en: "New arrivals",
    hintAr: "أحدث المنتجات المضافة",
    hintEn: "The most recently added products",
  },
  categories: {
    ar: "شريط الأقسام",
    en: "Category chips",
    hintAr: "أقسامك كأزرار في شريط أفقي",
    hintEn: "Your collections as a row of tappable chips",
  },
  reviews: {
    ar: "آراء العملاء",
    en: "Customer reviews",
    hintAr: "التقييمات المختارة لصفحة عملاء سعداء",
    hintEn: "The reviews you featured for Happy Customers",
  },
  text: {
    ar: "نص",
    en: "Text",
    hintAr: "عنوان وفقرة قصيرة",
    hintEn: "A heading and a short paragraph",
  },
};

/** A block of this type, with settings that make sense on day one. */
export function newBlock(type: BlockType): Block {
  const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const settings: Record<string, Record<string, unknown>> = {
    banner: { imageUrl: "", handle: "", heading: "", subheading: "" },
    collection_row: { handle: "", title: "", limit: 8 },
    collection_grid: { handle: "", title: "", limit: 6 },
    new_arrivals: { title: "New arrivals", limit: 12 },
    categories: { title: "" },
    reviews: { title: "What customers say", limit: 6 },
    text: { heading: "", body: "" },
  };
  return { id, type, settings: settings[type] ?? {} };
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

/** A hex colour, or the default. Anything else would reach the app as CSS. */
function colour(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : DEFAULT_SETTINGS.accent;
}

/**
 * Turn whatever is in the database into a theme the app can trust.
 *
 * Stored as JSON, so it can be anything — an older shape, a half-written row,
 * a block type this build has never heard of. Every one of those has to end as
 * a screen that renders rather than an app that crashes, so unknown block
 * types are dropped and every setting falls back to its default.
 */
export function normalizeTheme(raw: unknown): AppTheme {
  const row = (raw ?? {}) as { settings?: unknown; blocks?: unknown };
  const s = (row.settings ?? {}) as Record<string, unknown>;

  const settings: AppSettings = {
    storeName: str(s.storeName, DEFAULT_SETTINGS.storeName).slice(0, 60),
    logoUrl: str(s.logoUrl) || null,
    accent: colour(s.accent),
    announcement: str(s.announcement).slice(0, 200),
    announcementEnabled: Boolean(s.announcementEnabled),
    menuHandle: str(s.menuHandle, DEFAULT_SETTINGS.menuHandle).slice(0, 60),
    showSearch: s.showSearch !== false,
  };

  const raws = Array.isArray(row.blocks) ? row.blocks : null;
  const blocks: Block[] = (raws ?? DEFAULT_BLOCKS)
    .map((b, i) => {
      const block = (b ?? {}) as Record<string, unknown>;
      const type = str(block.type) as BlockType;
      if (!(type in BLOCK_META)) return null;
      return {
        id: str(block.id) || `b-${i}`,
        type,
        settings:
          block.settings && typeof block.settings === "object"
            ? (block.settings as Record<string, unknown>)
            : {},
      };
    })
    .filter((b): b is Block => b !== null);

  return { settings, blocks };
}
