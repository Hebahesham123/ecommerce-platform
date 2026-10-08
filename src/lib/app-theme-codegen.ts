import {
  BLOCK_META,
  blocksFor,
  itemsOf,
  TAB_KEYS,
  liveSessionsOf,
  TAB_DEFAULTS,
  type AppTheme,
  type Block,
  type BlockType,
  type Item,
} from "@/lib/app-theme";
import { projectFiles } from "@/lib/app-project-files";

/**
 * The app's code, written by the editor.
 *
 * This is the one place the app theme differs from the website's. A website
 * theme arrives as a folder of Liquid the merchant edits; an app has no such
 * folder, because the screens do not exist until somebody writes them. So the
 * editor writes them: arrange a section and the React Native for it appears,
 * already wired to this store's API.
 *
 * That makes the code an output, not an input. It is regenerated from the
 * theme on every keystroke, so it is never stale — and never a second place
 * where the truth might live. Hand-editing it would mean losing those edits
 * the next time a section moved, which is why the code page shows it rather
 * than letting you type into it.
 *
 * The target is React Native (Expo), because that is what an app actually is.
 * Everything is plain components and fetch — no state library, no navigation
 * framework assumed — so it drops into whatever the app ends up being built
 * with rather than dictating it.
 */

export type GeneratedFile = {
  path: string;
  /** What to colour it as, and what extension the file already carries. */
  language: "tsx" | "ts" | "json" | "js" | "md";
  contents: string;
};

const q = (v: unknown): string => JSON.stringify(String(v ?? ""));
const n = (v: unknown, fallback: number): number =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Math.trunc(Number(v)) : fallback;
const s = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v ? v : fallback;

/** A block type's component name: collection_row → CollectionRow. */
export function componentName(type: BlockType): string {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

// ---------------------------------------------------------------- theme.ts --
/**
 * The shape of the theme the app understands. Raised only when an installed
 * app could not read the new shape; an app handed a format it does not know
 * keeps the theme it has rather than half-reading the new one.
 */
export const APP_PACK_FORMAT = 1;

/**
 * The theme as data: everything about the app the merchant changes in the
 * editor, in the shape the app's theme.ts reads.
 *
 * The same object is written into a downloaded project as its starting theme
 * and served to installed apps by /api/storefront/app-theme, so a change
 * saved in the editor reaches phones that already have the app, without a new
 * build. What stays in code is only how each kind of section is drawn.
 */
export function appPack(theme: AppTheme) {
  const t = theme.settings;
  const str = (v: unknown) => String(v ?? "");
  const place = (where: "home" | "product" | "cart") =>
    blocksFor(theme.blocks, where).map((b) => {
      const set = b.settings ?? {};
      // The mystery box banner and free delivery say their line inside
      // themselves, so it is not said again above them.
      const ownsKicker = (b.type === "promo_card" && s(set.style) === "banner") || b.type === "free_shipping";
      return {
        id: b.id,
        type: b.type,
        settings: settingsObject(b),
        kicker: ownsKicker ? "" : s(set.kicker),
        band: s(set.band),
      };
    });
  return {
    format: APP_PACK_FORMAT,
    theme: {
      storeName: str(t.storeName),
      titleFont: t.titleFont === "serif" ? "serif" : "",
      logoUrl: t.logoUrl ? str(t.logoUrl) : null,
      accent: str(t.accent),
      background: str(t.background),
      menuHandle: str(t.menuHandle),
      pages: (t.pages ?? []).map((p) => ({
        id: str(p.id),
        handle: str(p.handle),
        kicker: str(p.kicker),
        line1: str(p.line1),
        line2: str(p.line2),
        layout: str(p.layout),
        items: p.items.map((i) => ({
          id: str(i.id),
          imageUrl: str(i.imageUrl),
          label: str(i.label),
          handle: str(i.handle),
          url: str(i.url),
          productId: str(i.productId),
          screen: str(i.screen),
        })),
      })),
      splash: {
        enabled: Boolean(t.splashEnabled && t.splashImageUrl),
        imageUrl: str(t.splashImageUrl),
        bg: str(t.splashBg),
        seconds: Number(t.splashSeconds) || 0,
        exit: str(t.splashExit),
        fit: str(t.splashFit),
        show: str(t.splashShow),
        skipLabel: str(t.splashSkipLabel),
        handle: str(t.splashHandle),
        url: str(t.splashUrl),
        productId: str(t.splashProductId),
        screen: str(t.splashScreen),
      },
      showSearch: Boolean(t.showSearch),
      announcement: {
        enabled: Boolean(t.announcementEnabled),
        text: str(t.announcement),
      },
      header: {
        logoText: str(t.logoText),
        logoAccentText: str(t.logoAccentText),
        searchPlaceholder: str(t.searchPlaceholder),
        showWishlist: Boolean(t.showWishlist),
        showBag: Boolean(t.showBag),
        bg: str(t.headerBg),
        ink: str(t.headerInk),
      },
      live: liveSessionsOf(theme).map((x) => ({
        id: str(x.id),
        name: str(x.name),
        detail: str(x.detail),
        imageUrl: str(x.imageUrl),
        url: str(x.url),
        handle: str(x.handle),
        productId: str(x.productId),
        screen: str(x.screen),
        live: Boolean(x.live),
      })),
      card: {
        nameWords: Number(t.cardNameWords) || 3,
        photoBg: str(t.cardPhotoBg),
        stars: t.cardStars !== false,
        stock: t.cardStock !== false,
        add: t.cardAdd !== false,
        addLabel: str(t.cardAddLabel),
        ticker: t.cardTicker !== false,
        tickerText: str(t.cardTickerText),
        look: str(t.cardLook) === "soft" ? "soft" : "market",
        radius: Math.max(0, Math.min(32, Math.round(Number(t.cardRadius ?? 22)) || 0)),
        // The product screen's numbers, not a second pair of them: one score
        // kept in two places is a score that disagrees with itself.
        rating: str(theme.screens.product.ratingValue),
        reviews: str(theme.screens.product.reviewCount),
        lowAt: Number(theme.screens.product.lowStockAt) || 5,
      },
      strip: {
        enabled: Boolean(t.stripEnabled),
        items: t.strip.map((i) => ({
          id: str(i.id),
          label: str(i.label),
          handle: str(i.handle),
          url: str(i.url),
          productId: str(i.productId),
          screen: str(i.screen),
        })),
      },
    },
    gap: {
      section: Number(t.sectionGap) || 0,
      item: Number(t.itemGap) || 0,
      itemTight: Math.max(2, Math.round((Number(t.itemGap) || 0) * 0.67)),
    },
    screens: theme.screens,
    // Lives are reached from the live row at the top of the shop; there is
    // no Live tab in the app any more.
    tabs: theme.tabs
      .filter((x) => x.visible && x.key !== "live")
      .map((x) => ({ key: x.key, label: x.label || TAB_DEFAULTS[x.key].en })),
    home: place("home"),
    product: place("product"),
    cart: place("cart"),
  };
}

function themeFile(theme: AppTheme): GeneratedFile {
  return {
    path: "theme.ts",
    language: "ts",
    contents: `/**
 * The app's look, and where it comes from. Generated from the dashboard:
 * App → App theme.
 *
 * The theme written below is the one this project was downloaded with, and
 * the app starts from it when it has nothing newer. Each time the app opens it
 * asks the shop for the current theme (Boot.tsx), and applyPack brings these
 * objects up to date before any screen is drawn - so a change saved in the
 * editor reaches phones that already have the app, with no new build.
 */

import { Platform } from "react-native";
import { screens } from "./screens";

/** One session on the Live tab, gathered from the home screen's live sections. */
export type LiveSession = {
  id: string;
  name: string;
  detail: string;
  imageUrl: string;
  url: string;
  handle: string;
  productId: string;
  screen: string;
  live: boolean;
};

/** One chip in the shortcut strip under the header. */
export type StripShortcut = {
  id: string;
  label: string;
  handle: string;
  url: string;
  productId: string;
  screen: string;
};

export type ThemePage = {
  id: string;
  handle: string;
  kicker: string;
  line1: string;
  line2: string;
  layout: string;
  items: {
    id: string;
    imageUrl: string;
    label: string;
    handle: string;
    url: string;
    productId: string;
    screen: string;
  }[];
};

export type ThemeData = {
  storeName: string;
  /** "serif" for the editor's serif titles, "" for the platform's own face. */
  titleFont: string;
  logoUrl: string | null;
  accent: string;
  background: string;
  menuHandle: string;
  /** The merchant's own pages - For Her, For Him - behind their handles. */
  pages: ThemePage[];
  /** The picture the app opens on, and how it leaves. */
  splash: {
    enabled: boolean;
    imageUrl: string;
    bg: string;
    seconds: number;
    exit: string;
    fit: string;
    show: string;
    skipLabel: string;
    handle: string;
    url: string;
    productId: string;
    screen: string;
  };
  showSearch: boolean;
  announcement: { enabled: boolean; text: string };
  header: {
    logoText: string;
    logoAccentText: string;
    searchPlaceholder: string;
    showWishlist: boolean;
    showBag: boolean;
    bg: string;
    ink: string;
  };
  live: LiveSession[];
  /**
   * The product card, everywhere one is drawn.
   *
   * nameWords is how many words of a name fit its one line; photoBg is the
   * colour behind every product photo. The score and the count are the shop's
   * standing as the product screen states it, because nothing records a
   * rating per product yet, and lowAt is when "only a few left" is worth
   * saying.
   */
  card: {
    nameWords: number;
    photoBg: string;
    stars: boolean;
    stock: boolean;
    add: boolean;
    addLabel: string;
    ticker: boolean;
    tickerText: string;
    look: string;
    radius: number;
    rating: string;
    reviews: string;
    lowAt: number;
  };
  strip: { enabled: boolean; items: StripShortcut[] };
};

/** One section: what kind, what the merchant set on it, the line above it and its band. */
export type PackBlock = {
  id: string;
  type: string;
  settings: Record<string, unknown>;
  kicker: string;
  band: string;
};

export type AppPack = {
  format: number;
  theme: ThemeData;
  gap: { section: number; item: number; itemTight: number };
  screens: Record<string, Record<string, unknown>>;
  tabs: { key: string; label: string }[];
  home: PackBlock[];
  product: PackBlock[];
  cart: PackBlock[];
};

/** The shape of theme this build reads. A newer shape is ignored rather than half-read. */
export const PACK_FORMAT = ${APP_PACK_FORMAT};

const bundled: AppPack = ${JSON.stringify(appPack(theme), null, 2)};

/** Section titles. undefined means the platform's own face. */
const face = (f: string) => (f === "serif" ? (Platform.OS === "ios" ? "Georgia" : "serif") : undefined);

export const theme: Omit<ThemeData, "titleFont"> & { titleFont: string | undefined } = {
  ...bundled.theme,
  titleFont: face(bundled.theme.titleFont),
};

/** Every screen reads these, so a colour change is one edit, not thirty. */
export const colors = {
  accent: theme.accent,
  ink: "#0f172a",
  inkMuted: "#475569",
  inkSoft: "#94a3b8",
  surface: "#ffffff",
  // What every screen sits on. Set in the dashboard next to the accent.
  page: theme.background,
  line: "#e2e8f0",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * How much air the home screen leaves. "section" is the space between one
 * section and the next; "item" the space between cards; "itemTight" the same
 * scaled down for chips and small tiles.
 */
export const gap = { ...bundled.gap };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** The parts of the theme that are lists: which tabs show, and which sections go where. */
export const layout = {
  tabs: bundled.tabs,
  home: bundled.home,
  product: bundled.product,
  cart: bundled.cart,
};

/** The theme on screen, as text, so an unchanged one is recognised. */
let applied = JSON.stringify(bundled);

/**
 * Bring everything above up to date with a theme from the shop.
 *
 * Returns false, changing nothing, for anything that is not a theme this build
 * understands: a bad answer from the network must not take the app's look
 * with it.
 */
export function applyPack(input: unknown): boolean {
  const p = input as AppPack | null;
  if (!p || p.format !== PACK_FORMAT || !p.theme || !p.gap || !Array.isArray(p.tabs) || !Array.isArray(p.home)) {
    return false;
  }
  Object.assign(theme, bundled.theme, p.theme, { titleFont: face(p.theme.titleFont) });
  colors.accent = theme.accent;
  colors.page = theme.background;
  Object.assign(gap, p.gap);
  layout.tabs = p.tabs;
  layout.home = p.home;
  layout.product = Array.isArray(p.product) ? p.product : [];
  layout.cart = Array.isArray(p.cart) ? p.cart : [];
  const all = screens as unknown as Record<string, Record<string, unknown>>;
  for (const key of Object.keys(p.screens || {})) all[key] = { ...all[key], ...p.screens[key] };
  applied = JSON.stringify(p);
  return true;
}

/** Whether a theme is the one already on screen. */
export const isApplied = (input: unknown) => JSON.stringify(input) === applied;

/**
 * Whether a theme can be put on screen while the app is open.
 *
 * Colours, spacing and the title face are built into each screen's styles
 * when the app starts, so changing them mid-visit would leave half the app in
 * the old colour. Those wait for the next start; words, pictures and the order
 * of sections do not have to.
 */
export function canApplyLive(input: unknown): boolean {
  const p = input as AppPack | null;
  if (!p || !p.theme || !p.gap) return false;
  return (
    p.theme.accent === theme.accent &&
    p.theme.background === theme.background &&
    face(p.theme.titleFont) === theme.titleFont &&
    p.gap.section === gap.section &&
    p.gap.item === gap.item &&
    p.gap.itemTight === gap.itemTight
  );
}
`,
  };
}

// ------------------------------------------------------------------ api.ts --
function apiFile(baseUrl: string): GeneratedFile {
  return {
    path: "api.ts",
    language: "ts",
    contents: `/**
 * Talking to the store. Generated from the dashboard.
 *
 * The channel header is what makes an order show up under App in the
 * dashboard, and which Meta dataset its purchase reports to. It is a label,
 * not a permission.
 */
import { Dimensions, PixelRatio, Platform } from "react-native";

export const API_BASE = ${q(baseUrl)};
// The website itself, for the screens that are simply the real site shown in
// the app: the origin is the API base with its /api/storefront tail cut off.
export const SITE_ORIGIN = API_BASE.replace(/\\/api\\/storefront\\/?$/, "");

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

/**
 * This phone, as the shop's customer tracking knows it: made once and kept on
 * the phone (Boot.tsx), anonymous until she signs in, then joined to her.
 */
let visitor = "";
export const setVisitor = (v: string) => { visitor = v; };

/**
 * What the phone is, in one header.
 *
 * Meta will not count an app sale without it: an event marked as coming from
 * an app has to carry the device it came from, and a request that leaves it
 * out is accepted and then quietly dropped. Only the phone knows any of this,
 * so it says so on every request and the shop passes it on.
 *
 * \`tracking\` is the person's answer on iOS, not a default to be assumed.
 * Wire it to whatever your ATT prompt returned; until you have one, say false
 * rather than claim a permission nobody gave.
 */
export const device = {
  platform: Platform.OS,
  osVersion: String(Platform.Version),
  bundleId: "",
  appVersion: "",
  buildVersion: "",
  model: "",
  locale: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  width: Math.round(Dimensions.get("window").width),
  height: Math.round(Dimensions.get("window").height),
  density: PixelRatio.get(),
  tracking: false,
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: {
      "x-store-channel": "app",
      "x-app-device": encodeURIComponent(JSON.stringify(device)),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: \`Bearer \${token}\` } : {}),
      ...(visitor ? { "x-visitor": visitor } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error ?? "request_failed");
  return json.data as T;
}

export type Card = {
  id: string;
  handle: string;
  name: string;
  image: string | null;
  priceMin: number | null;
  compareAt: number | null;
  vendor?: string | null;
  /** The only variant, when there is exactly one - so a card can add it straight away. */
  variantId?: string | null;
  variantCount?: number;
  /** How many are left. The one number on a card true of that product alone. */
  available?: number;
  /** How many have been bought. Counted off order lines that were not cancelled. */
  sold?: number;
};

export type HomePayload = {
  theme: typeof import("./theme").theme;
  collections: { handle: string; title: string; image: string | null; productCount: number }[];
  rows: Record<string, Card[]>;
  newArrivals: Card[];
  reviews: { id: string; name: string; productRating: number | null; comment: string | null }[];
  lives: {
    id: string;
    title: string;
    hostName: string | null;
    coverUrl: string | null;
    status: string;
    scheduledAt: string | null;
    peakViewers: number;
    likes?: number;
    pieces?: number;
    href: string;
  }[];
  /** The ways the shop takes money, as the checkout knows them. */
  payments?: { id: string; name: string; nameAr: string; kind: string; note: string; noteAr: string; color: string }[];
};

/** Everything the front page needs, in one request. */
export const fetchHome = () => api<HomePayload>("/home");

/**
 * What she did, for the shop's customer page. Fire and forget: tracking
 * never slows the app down or shows an error.
 */
export function track(
  type: string,
  data: { productId?: string; productName?: string; imageUrl?: string | null; value?: number | null; quantity?: number; term?: string; handle?: string } = {},
) {
  if (!visitor) return;
  api("/track", { method: "POST", body: JSON.stringify({ type, channel: "app", platform: Platform.OS, visitorId: visitor, ...data }) }).catch(() => {});
}

/** One product held up in a reel. */
export type ReelProduct = {
  id: string;
  itemId: string | null;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  pinned: boolean;
  sortOrder: number;
  available?: number;
};

/** A kept live, as a reel: the stream to play and what was sold in it. */
export type Reel = {
  id: string;
  title: string;
  hostName: string | null;
  coverUrl: string | null;
  /** The adaptive stream once it is ready, the original file until then. */
  recordingUrl: string | null;
  likes: number;
  /** Times watched for two seconds or more. */
  views?: number;
  products: ReelProduct[];
};

export const fetchReels = () => api<Reel[]>("/reels");

/** She watched it: counted by the shop once per half hour per phone. */
export const viewReel = (id: string) =>
  api("/reels/" + encodeURIComponent(id) + "/view", { method: "POST" }).catch(() => {});

/** A like, or taking it back. Returns the new total. */
export const likeReel = (id: string, on: boolean) =>
  api<{ likes: number }>("/reels/" + encodeURIComponent(id) + "/like", { method: on ? "POST" : "DELETE" }).then((r) => r.likes);

/** Which screen she is on, for the shop to choose an offer for. */
export type OfferContext = {
  pageType: "index" | "product" | "collection" | "cart" | "search" | "checkout" | "other";
  productKey?: string;
  collectionHandle?: string;
};

/** An offer to show: the merchant's design, and when it should appear. */
export type OfferConfig = {
  id: string;
  dwell: number;
  idle: number;
  cart: number;
  maxPerSession: number;
  cooldownHours: number;
  skipIfCartEmpty: boolean;
  style: string;
  headline: string;
  body: string;
  button: string;
  dismiss: string;
  accent: string;
  bg: string;
  fg: string;
  image: string | null;
  code: string | null;
  segments: { label: string; code: string; weight: number }[];
  unique: boolean;
};

export const decideOffer = (ctx: OfferContext & { cartCount: number }) =>
  api<{ offer: OfferConfig | null }>("/offers/decide", {
    method: "POST",
    body: JSON.stringify({ channel: "app", visitorId: visitor, ...ctx }),
  }).then((r) => r.offer);

/** A code made for this shopper, for a campaign that hands out one per person. */
export const claimOffer = (id: string) =>
  api<{ code: string }>("/offers/claim", {
    method: "POST",
    body: JSON.stringify({ channel: "app", visitorId: visitor, cid: id }),
  }).then((r) => r.code);

/** What she did with a popup. Fire and forget. */
export function offerEvent(type: "shown" | "dismissed" | "claimed", id: string, extra: { trigger?: string; code?: string } = {}) {
  if (!visitor) return;
  api("/offers/event", { method: "POST", body: JSON.stringify({ channel: "app", visitorId: visitor, type, cid: id, ...extra }) }).catch(() => {});
}

/** The basket as it stands, once it has stopped changing for a moment. */
let cartTimer: ReturnType<typeof setTimeout> | null = null;
let cartSent: string | null = null;
export function trackCart(lines: { itemId: string; name: string; imageUrl: string | null; price: number; quantity: number }[]) {
  const sig = JSON.stringify(lines.map((l) => [l.itemId, l.quantity]));
  if (!visitor || sig === cartSent || (cartSent === null && !lines.length)) return;
  if (cartTimer) clearTimeout(cartTimer);
  cartTimer = setTimeout(() => {
    cartSent = sig;
    api("/track", { method: "POST", body: JSON.stringify({ channel: "app", platform: Platform.OS, visitorId: visitor, cart: lines }) }).catch(() => {});
  }, 1500);
}

/**
 * What goes with the signed-in shopper's past orders. A guest gets an empty
 * list rather than an error, and the section is then not drawn.
 */
export type Recommendations = { mode: "pairs" | "fallback" | "none"; basedOn: string | null; products: Card[] };
export const fetchRecommendations = () => api<Recommendations>("/recommendations");

/**
 * Search the catalogue.
 *
 * The shop does the matching, over titles, brands, categories and tags, on the
 * same catalogue the collections are cut from — so a product that cannot be
 * found here is one that is genuinely not for sale, not one the app forgot to
 * download.
 */
export const searchProducts = (q: string, limit = 40) =>
  api<{ products: Card[]; count: number }>(
    \`/products?limit=\${limit}&q=\${encodeURIComponent(q)}\`,
  );

export type Variant = {
  id: string;
  variantTitle: string | null;
  sku: string | null;
  price: number | null;
  compareAt: number | null;
  available: number;
};

export type Product = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  category: string | null;
  vendor: string | null;
  tags: string[];
  priceMin: number | null;
  priceMax: number | null;
  compareAt: number | null;
  available: number;
  variants: Variant[];
  selectedVariantId: string | null;
};

export type Collection = {
  handle: string;
  title: string;
  description: string | null;
  image: string | null;
  productCount: number;
};

export type Sort = "manual" | "price-ascending" | "price-descending" | "title-ascending" | "newest";

export type CollectionPayload = {
  collection: Collection;
  products: Card[];
  total: number;
  offset: number;
  limit: number;
  sort: Sort;
  /** The brands in the collection with their counts, and its price span. */
  facets?: { vendors: { name: string; count: number }[]; priceMin: number; priceMax: number };
};

export type CollectionFilters = { brands: string[]; min: number; max: number; inStock: boolean; onSale: boolean };

export type PricedLine = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
  /** True when the shop had fewer left than the basket asked for. */
  adjusted: boolean;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  itemCount: number;
  /** Lines that no longer exist or sold out, so the app can say so. */
  removed: string[];
};

export type Discount =
  | { ok: true; code: string; label: string; amount: number; subtotal: number }
  | { ok: false; reason: string; requiredAmount?: number; requiredQuantity?: number; subtotal: number };

export type Order = {
  orderNumber: string;
  total: number;
  createdAt: string;
  lifecycle: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export type Account = {
  phone: string;
  name: string | null;
  email: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  orders: Order[];
};

/** One collection's products. Sorting and paging happen on the server. */
export const fetchCollection = (
  handle: string,
  sort: Sort = "manual",
  offset = 0,
  limit = 24,
  filters?: CollectionFilters,
) =>
  api<CollectionPayload>(
    "/collections/" +
      encodeURIComponent(handle) +
      "?sort=" + sort +
      "&offset=" + offset +
      "&limit=" + limit +
      (filters && filters.brands.length ? "&vendor=" + encodeURIComponent(filters.brands.join(",")) : "") +
      (filters && filters.min > 0 ? "&minPrice=" + filters.min : "") +
      (filters && filters.max > 0 ? "&maxPrice=" + filters.max : "") +
      (filters && filters.inStock ? "&inStock=1" : "") +
      (filters && filters.onSale ? "&onSale=1" : ""),
  );

/** Prices in a reward's line read the way prices read everywhere else. */
const money = (n: number) => "EGP " + Math.round(n).toLocaleString("en-US");

/** One product, by product handle or by variant id. */
export const fetchProduct = (id: string) => api<Product>(\`/products/\${encodeURIComponent(id)}\`);

/**
 * What the basket is really worth.
 *
 * The app sends only ids and quantities; every price and every "how many are
 * left" comes back from the shop. A basket held on the phone cannot be talked
 * into a cheaper total, because the phone never gets a say in the price.
 */
export const priceCart = (lines: { itemId: string; quantity: number }[]) =>
  api<PricedCart>("/cart/price", { method: "POST", body: JSON.stringify({ lines }) });

/** What a code is worth on this basket. Checkout re-runs it, so this is a preview. */
export const previewDiscount = (code: string, lines: { itemId: string; quantity: number }[]) =>
  api<Discount>("/discount", { method: "POST", body: JSON.stringify({ code, lines }) });

// ------------------------------------------------------------------ signing in --
/**
 * Is this number already known to the shop?
 *
 * Asked without a channel, nothing is sent — the shop only answers whether a
 * code is needed. A returning customer should not have to wait for an SMS to
 * be told the shop already knows them.
 */
export const checkPhone = (phone: string) =>
  api<{ status: "already_verified" | "needs_code"; phone: string }>("/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });

/** Send the code, the way the shopper chose. */
export const requestCode = (phone: string, channel: "sms" | "whatsapp") =>
  api<{ status: string; phone: string }>("/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ phone, channel }),
  });

/** Trade a code for a token. Keep the token; it is the account. */
export const verifyCode = (phone: string, code: string, name?: string) =>
  api<{ token: string; phone: string }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code, name }),
  });

/** A number the shop already trusts needs no code. */
export const loginVerified = (phone: string) =>
  api<{ token: string; phone: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });

export const fetchAccount = () => api<Account>("/me");
export const fetchOrders = () => api<{ orders: Order[] }>("/orders");

export type OrderRequest = {
  customerName: string;
  phone: string;
  email?: string | null;
  governorate: string;
  city: string;
  address: string;
  note?: string;
  couponCode?: string | null;
  /** Which of the shop's methods the shopper picked. */
  paymentMethod?: string | null;
  lines: { itemId: string; quantity: number }[];
};

/**
 * How this shop can be paid.
 *
 * The same list the website's checkout is built from, so a shopper is never
 * offered on one storefront what the other has never heard of. Nothing here
 * charges a card: cash is settled at the door and the instalment providers
 * are arranged with the shopper after the order, which is what each method's
 * note says.
 */
export type PaymentMethod = {
  id: string;
  name: string;
  nameAr: string;
  kind: string;
  note: string;
  noteAr: string;
  logo: string;
  enabled: boolean;
};

export const fetchPayments = () => api<PaymentMethod[]>("/payments");

// ---------------------------------------------------------------- rewards --
/**
 * A gift, as the basket needs it.
 *
 * Two kinds reach a basket: one she has already redeemed, which carries its
 * code and only has to be applied, and one she can afford right now, which is
 * redeemed and applied in a single tap. Everything else in the Society - the
 * locked rewards, the ones she cannot afford yet, the ones the staff fulfil by
 * hand - is not a choice she can make while she is paying.
 */
export type Gift = {
  id: string;
  title: string;
  code: string;
  detail: string;
  cost: number;
  ready: boolean;
};

type RewardRow = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  status: string;
  signatureCost: number;
  discountKind: string | null;
  discountValue: number | null;
  minOrderValue: number | null;
};
type MyRewardRow = {
  id: string;
  rewardId: string;
  type: string;
  title: string;
  status: string;
  code: string | null;
  expiresAt: string | null;
};
export type Loyalty = {
  enrolled: boolean;
  user: { signatureBalance: number };
  availableRewards: RewardRow[];
  myRewards: MyRewardRow[];
};

export const fetchLoyalty = () => api<Loyalty>("/loyalty");

export const redeemReward = (rewardId: string) =>
  api<{ balance: number; userReward: { code: string | null } | null }>("/loyalty/redeem", {
    method: "POST",
    body: JSON.stringify({ rewardId }),
  });

const giftDetail = (kind: string | null, value: number | null, minOrder: number | null) => {
  const over = minOrder ? " on orders over " + money(minOrder) : "";
  if (kind === "free_shipping") return "Free delivery" + over;
  if (kind === "percent" && value) return value + "% off" + over;
  if (kind === "amount" && value) return money(value) + " off" + over;
  return "A gift";
};

/**
 * What she is closest to, when nothing is spendable yet.
 *
 * A rewards block that draws nothing when there is nothing looks exactly like
 * one that is broken, and a shopper with no signatures yet is the one person
 * who most needs telling that signatures buy something. Level-locked rewards
 * are left out: more signatures will not unlock them.
 */
export function nextGift(l: Loyalty | null, shipping: number = 0) {
  if (!l || !l.enrolled) return null;
  const balance = (l.user && l.user.signatureBalance) || 0;
  const spendable = (k: string | null) => k === "percent" || k === "amount" || k === "free_shipping";
  const cheapest = (l.availableRewards || [])
    .filter((r) => spendable(r.discountKind))
    .filter((r) => shipping > 0 || r.discountKind !== "free_shipping")
    .filter((r) => r.status !== "locked")
    .filter((r) => r.signatureCost > balance)
    .sort((a, b) => a.signatureCost - b.signatureCost)[0];
  if (!cheapest) return null;
  return { short: cheapest.signatureCost - balance, title: cheapest.titleEn, balance };
}

/**
 * The rewards worth offering in a basket, already redeemed ones first.
 *
 * shipping is what delivery costs on this order: while the shop delivers free,
 * a free-delivery reward is worth nothing and is left out rather than sold to
 * her for signatures.
 */
export function giftsFrom(l: Loyalty | null, shipping: number = 0): Gift[] {
  if (!l || !l.enrolled) return [];
  const now = Date.now();
  const at = (v: string | null) => (v ? new Date(v).getTime() : Infinity);
  const held = (l.myRewards || [])
    .filter((r) => r.code && (r.status === "available" || r.status === "claimed"))
    .filter((r) => shipping > 0 || r.type !== "delivery")
    .filter((r) => !r.expiresAt || at(r.expiresAt) > now)
    // Only one code goes on an order, so two unused copies of the same reward
    // are one choice wearing two faces. The soonest to expire is the one to
    // spend.
    .sort((a, b) => at(a.expiresAt) - at(b.expiresAt));

  const seen: string[] = [];
  const mine: Gift[] = [];
  for (const r of held) {
    if (seen.indexOf(r.rewardId) >= 0) continue;
    seen.push(r.rewardId);
    mine.push({ id: r.id, title: r.title, code: r.code || "", detail: "Ready to use", cost: 0, ready: true });
  }

  const balance = (l.user && l.user.signatureBalance) || 0;
  const spendable = (k: string | null) => k === "percent" || k === "amount" || k === "free_shipping";
  const affordable: Gift[] = (l.availableRewards || [])
    .filter((r) => r.status === "affordable" || r.status === "available")
    .filter((r) => spendable(r.discountKind))
    .filter((r) => shipping > 0 || r.discountKind !== "free_shipping")
    .filter((r) => r.signatureCost <= balance)
    // No sense spending signatures on one she already holds a code for.
    .filter((r) => seen.indexOf(r.id) < 0)
    .sort((a, b) => a.signatureCost - b.signatureCost)
    .map((r) => ({
      id: r.id,
      title: r.titleEn,
      code: "",
      detail: giftDetail(r.discountKind, r.discountValue, r.minOrderValue),
      cost: r.signatureCost,
      ready: false,
    }));

  return mine.concat(affordable).slice(0, 6);
}

/**
 * Place the order.
 *
 * Stock is taken here and nowhere else: the shop re-prices the basket, then
 * one database call reserves every line or none of them. Two phones racing
 * for the last item means one order and one honest "out of stock".
 */
export const placeOrder = (payload: OrderRequest) =>
  api<{ orderNumber: string }>("/orders", { method: "POST", body: JSON.stringify(payload) });
`,
  };
}

/** A page the merchant wrote: a headline and the ways in under it. */
function pageScreenFile(): GeneratedFile {
  return {
    path: "components/PageScreen.tsx",
    language: "tsx",
    contents: `import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, theme } from "../theme";
import { fetchHome } from "../api";

export type PageTile = {
  id: string;
  imageUrl?: string;
  label?: string;
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};

export type Page = {
  id: string;
  handle: string;
  kicker?: string;
  line1?: string;
  line2?: string;
  layout?: string;
  items: PageTile[];
};

/**
 * Not a collection: a collection is a wall of products, and the honest answer
 * to "what do you have for her?" is eleven answers. So it is the website's own
 * shape - a small line, a headline over two lines, and pictures that each open
 * a collection.
 */
export function PageScreen({
  page,
  onOpen,
}: {
  page: Page;
  onOpen: (tile: PageTile) => void;
}) {
  const tiles = (page.items ?? []).filter((t) => t.label || t.imageUrl);
  const circles = page.layout !== "tiles";
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.head}>
        {page.kicker ? <Text style={styles.kicker}>{page.kicker.toUpperCase()}</Text> : null}
        {page.line1 ? <Text style={styles.line1}>{page.line1.toUpperCase()}</Text> : null}
        {page.line2 ? (
          <Text style={[styles.line2, { fontFamily: theme.titleFont }]}>{page.line2}</Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {tiles.map((t) => (
          <Pressable key={t.id} style={circles ? styles.cell : styles.tileCell} onPress={() => onOpen(t)}>
            {circles ? (
              <View style={styles.circle}>
                {t.imageUrl ? <Image source={{ uri: t.imageUrl }} style={styles.circleImg} resizeMode="cover" /> : null}
              </View>
            ) : (
              <View style={styles.tile}>
                {t.imageUrl ? <Image source={{ uri: t.imageUrl }} style={styles.tileImg} resizeMode="cover" /> : null}
                <View style={styles.tileScrim} />
                {t.label ? <Text style={styles.tileLabel} numberOfLines={1}>{t.label.toUpperCase()}</Text> : null}
              </View>
            )}
            {circles && t.label ? (
              <Text style={styles.label} numberOfLines={1}>{t.label.toUpperCase()}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Every department the shop has, drawn as a page.
 *
 * The list is the catalogue's, asked for here rather than carried through the
 * app for a screen that may never be opened, and never kept by hand: a second
 * list of departments is a list that goes out of date.
 */
export function AllCollectionsScreen({ onOpen }: { onOpen: (handle: string, title?: string) => void }) {
  const [items, setItems] = useState<PageTile[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHome()
      .then((home) => {
        if (!alive) return;
        setItems(
          (home.collections ?? []).map((c) => ({
            id: c.handle,
            imageUrl: c.image ?? undefined,
            label: c.title,
            handle: c.handle,
          })),
        );
      })
      .catch(() => setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!items) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <PageScreen
      page={{ id: "all-collections", handle: "collections", line2: "All collections", layout: "circles", items }}
      onOpen={(tile) => onOpen(tile.handle ?? "", tile.label)}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  wrap: { padding: spacing.lg },
  head: { alignItems: "center", paddingVertical: 10 },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 2.4, color: colors.accent },
  line1: { marginTop: 8, fontSize: 15, fontWeight: "600", letterSpacing: 3, color: colors.inkMuted },
  line2: { marginTop: 4, fontSize: 26, fontWeight: "700", color: colors.ink },
  grid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", alignItems: "center", paddingHorizontal: 4, paddingVertical: 8 },
  circle: { width: "100%", aspectRatio: 1, borderRadius: 999, overflow: "hidden", backgroundColor: "#f3ece4" },
  circleImg: { width: "100%", height: "100%" },
  label: { marginTop: 8, fontSize: 11, fontWeight: "600", letterSpacing: 1, color: colors.ink },
  tileCell: { width: "50%", padding: 4 },
  tile: { width: "100%", aspectRatio: 0.75, borderRadius: 16, overflow: "hidden", backgroundColor: "#f3ece4" },
  tileImg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  tileScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: "rgba(20,12,7,0.42)" },
  tileLabel: { position: "absolute", left: 12, right: 12, bottom: 10, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: "#fff" },
});
`,
  };
}

// ------------------------------------------------------------- shared bits --
/** The picture the app opens on. Chrome, so it ships whether or not the
 *  merchant has switched it on: the theme decides at runtime. */
function splashFile(): GeneratedFile {
  return {
    path: "components/Splash.tsx",
    language: "tsx",
    contents: `import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import { openLink } from "./Pieces";

/**
 * The picture the app opens on.
 *
 * It holds for the merchant's few seconds and then leaves the way they chose,
 * and a tap sends it early - so it is the first thing a shopper sees and never
 * the thing in the way. The app behind it has already started loading while it
 * was up, which is the other half of why it is worth having.
 */
export function Splash({
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const s = theme.splash;
  const [gone, setGone] = useState(!s.enabled || !s.imageUrl);
  const go = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  const leave = (then?: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(go, { toValue: 1, duration: 620, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: true }).start(
      () => {
        setGone(true);
        if (then) then();
      },
    );
  };

  useEffect(() => {
    if (gone) return;
    const hold = setTimeout(() => leave(), Math.max(500, s.seconds * 1000));
    return () => clearTimeout(hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;

  const screen = Dimensions.get("window");
  const opens = Boolean(s.handle || s.url || s.productId || s.screen);
  const take = () =>
    leave(() => {
      if (opens) openLink(s, { onOpenCollection, onOpenProduct, onOpenScreen });
    });

  const fade = go.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const zoom = go.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const slide = go.interpolate({ inputRange: [0, 1], outputRange: [0, -screen.height] });
  const half = screen.height / 2;
  const partUp = go.interpolate({ inputRange: [0, 1], outputRange: [0, -half] });
  const partDown = go.interpolate({ inputRange: [0, 1], outputRange: [0, half] });
  const fit = s.fit === "contain" ? "contain" : "cover";

  return (
    <Pressable style={[styles.wrap, { backgroundColor: s.bg }]} onPress={take}>
      {s.exit === "curtain" ? (
        <>
          <Animated.View style={[styles.half, { height: half, top: 0, transform: [{ translateY: partUp }] }]}>
            <Image source={{ uri: s.imageUrl }} style={[styles.whole, { height: screen.height, top: 0 }]} resizeMode={fit} />
          </Animated.View>
          <Animated.View style={[styles.half, { height: half, top: half, transform: [{ translateY: partDown }] }]}>
            <Image source={{ uri: s.imageUrl }} style={[styles.whole, { height: screen.height, top: -half }]} resizeMode={fit} />
          </Animated.View>
        </>
      ) : (
        <Animated.Image
          source={{ uri: s.imageUrl }}
          resizeMode={fit}
          style={[
            styles.whole,
            { height: screen.height, top: 0 },
            s.exit === "up"
              ? { transform: [{ translateY: slide }] }
              : s.exit === "zoom"
                ? { opacity: fade, transform: [{ scale: zoom }] }
                : { opacity: fade },
          ]}
        />
      )}

      {s.skipLabel ? (
        <Pressable style={styles.skip} onPress={() => leave()} hitSlop={8}>
          <Text style={styles.skipText}>{s.skipLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, overflow: "hidden" },
  half: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  whole: { position: "absolute", left: 0, right: 0, width: "100%" },
  skip: { position: "absolute", right: 14, top: 44, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 12, paddingVertical: 5 },
  skipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
`,
  };
}

function piecesFile(): GeneratedFile {
  return {
    path: "components/Pieces.tsx",
    language: "tsx",
    contents: `import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, theme } from "../theme";
import type { Card, HomePayload } from "../api";

/** The bits every section is made of, so they all look like one app. */

/**
 * Where the merchant pointed something. They choose one of five things in
 * the dashboard's link picker - nothing, a collection, a product, a screen
 * in the app, or a web address - and it arrives here as one of these set.
 */
export type LinkTo = {
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};

/** Who knows how to get there. Every section that links takes these three. */
export type LinkHandlers = {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
};

/**
 * Follow one link.
 *
 * Only one of the four is ever set, because picking a kind clears the other
 * three. They are still checked most-specific first, so a section saved
 * before the picker existed - which can carry both a collection and a typed
 * address - behaves exactly the way it did then.
 */
export function openLink(to: LinkTo, h: LinkHandlers) {
  if (to.url) {
    Linking.openURL(to.url).catch(() => {});
    return;
  }
  if (to.productId) return h.onOpenProduct?.(to.productId);
  if (to.screen) return h.onOpenScreen?.(to.screen);
  if (to.handle) return h.onOpenCollection?.(to.handle);
}

export function SectionHeading({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  if (!title) return null;
  return (
    <View style={styles.headingRow}>
      <Text style={styles.heading} numberOfLines={1}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * What a card pointed at a collection looks like.
 *
 * Choosing a collection is already saying what the card is; making the
 * merchant then paste that collection's picture is asking them to repeat
 * themselves, and guarantees the two drift the day the collection gets a new
 * image. Their own image wins whenever they set one.
 */
export function inherit(
  item: { imageUrl?: string; title?: string; label?: string; handle?: string },
  collections: HomePayload["collections"],
): { image: string | undefined; title: string } {
  const found = item.handle ? collections.find((c) => c.handle === item.handle) : undefined;
  return {
    image: item.imageUrl || found?.image || undefined,
    title: item.title || item.label || found?.title || "",
  };
}

/**
 * The first few words of a name, and a sign that there were more.
 *
 * Trimming by words rather than by width means the break lands between two
 * words instead of through the middle of one, so what is left still reads as
 * language: "Louis Vuitton Pochette…" rather than "Louis Vuitton Poche…".
 */
export function shortName(name: string, words: number = theme.card.nameWords) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) return parts.join(" ");
  return parts.slice(0, words).join(" ") + "…";
}

export function money(v: number | null) {
  return v == null ? "—" : \`\${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)} EGP\`;
}

/**
 * The same number with the currency in front: "EGP 1,049".
 *
 * A shopper scanning a grid finds the digits in the same place on every card,
 * which is the whole point of putting the three letters first.
 */
export function moneyFirst(v: number | null) {
  return v == null ? "—" : \`EGP \${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)}\`;
}

/** Just the digits, for the price it was - the currency is on the line above. */
export function plainNumber(v: number | null) {
  return v == null ? "" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

/**
 * Five stars, filled to a score.
 *
 * Two rows of stars, the lit one clipped to the width the score earns, so a
 * 4.6 is four stars and most of a fifth rather than a rounding the number
 * beside it contradicts.
 */
function Stars({ score, size = 9 }: { score: number; size?: number }) {
  const part = Math.max(0, Math.min(1, score / 5));
  return (
    <View>
      <Text style={{ fontSize: size, color: "#d9d2c9" }}>{"★★★★★"}</Text>
      <View style={{ position: "absolute", left: 0, top: 0, width: (part * 100) + "%", overflow: "hidden" }}>
        <Text style={{ fontSize: size, color: colors.accent }} numberOfLines={1}>{"★★★★★"}</Text>
      </View>
    </View>
  );
}

type Note = { key: string; text: string; ink: string; mark: string };

/**
 * The card's note: one true thing at a time, turning over.
 *
 * It turns on its top edge rather than sliding, because a line that slides is
 * a ticker and a shopper learns to let a ticker run past.
 */
function CardNote({ notes }: { notes: Note[] }) {
  const [at, setAt] = useState(0);
  const turn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (notes.length < 2) return;
    const timer = setInterval(() => {
      turn.setValue(0);
      setAt((n) => (n + 1) % notes.length);
      Animated.timing(turn, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }, 2600);
    return () => clearInterval(timer);
  }, [notes.length, turn]);

  if (!notes.length) return null;
  const note = notes[at % notes.length];
  const tilt = turn.interpolate({ inputRange: [0, 1], outputRange: ["-88deg", "0deg"] });
  return (
    <View style={styles.noteRow}>
      <Animated.View style={[styles.noteFace, { opacity: turn, transform: [{ perspective: 300 }, { rotateX: tilt }] }]}>
        <Text style={[styles.noteMark, { color: note.ink }]}>{note.mark}</Text>
        <Text style={[styles.noteText, { color: note.ink }]} numberOfLines={1}>{note.text}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * The facts a card can put its name to, in the order a shopper weighs them.
 *
 * Delivery is free on everything the shop sells, so it is not a promise being
 * made here. Nothing is written for the card: the discount is the gap between
 * the two prices and the count is of order lines that were not cancelled.
 */
function notesFor(card: Card, scarce: boolean, left: number | null): Note[] {
  if (!theme.card.ticker) return [];
  const notes: Note[] = [];
  notes.push({ key: "van", mark: "\u{1F69A}", ink: "#15803d", text: "Free delivery on everything" });
  const score = Number(theme.card.rating);
  if (Number.isFinite(score) && score > 0) {
    notes.push({
      key: "star",
      mark: "\u2605",
      ink: "#b45309",
      text: theme.card.reviews
        ? theme.card.rating + " from " + theme.card.reviews + " ratings"
        : theme.card.rating + " out of 5",
    });
  }
  if (card.compareAt != null && card.priceMin != null && card.compareAt > card.priceMin) {
    notes.push({ key: "drop", mark: "\u2193", ink: "#b42318", text: "You save " + money(card.compareAt - card.priceMin) });
  }
  const sold = Number(card.sold || 0);
  if (sold > 0) {
    notes.push({ key: "bag", mark: "\u{1F6CD}", ink: "#334155", text: sold.toLocaleString("en-US") + " sold" });
  }
  if (scarce && left !== null) {
    notes.push({ key: "few", mark: "\u25C6", ink: "#b42318", text: left === 1 ? "Last one" : "Only " + left + " left" });
  }
  if (theme.card.tickerText) {
    notes.push({ key: "own", mark: "\u25CF", ink: "#334155", text: theme.card.tickerText });
  }
  return notes;
}

export function ProductTile({
  card,
  width = 128,
  fill = false,
  shape = "square",
  fit = "cover",
  onPress,
  onAdd,
}: {
  card: Card;
  width?: number;
  /** True in a grid, where the column decides the width and the picture squares itself. */
  fill?: boolean;
  /** The picture's proportions: "square", "wide" or "tall". */
  shape?: string;
  /** "cover" crops to fill the frame, "contain" fits the whole picture in. */
  fit?: string;
  onPress?: (id: string) => void;
  /** Put the one variant in the basket. Without it the card has no button. */
  onAdd?: (variantId: string, productId: string) => void;
}) {
  const score = Number(theme.card.rating);
  const stars = theme.card.stars && Number.isFinite(score) && score > 0;
  // Only once it is scarce: a full bar on everything says nothing, and a bar
  // claiming to show sales would invent a number nothing records.
  const left = typeof card.available === "number" ? card.available : null;
  const scarce = theme.card.stock && left !== null && left > 0 && left <= theme.card.lowAt;
  const single = card.variantId != null && (card.variantCount || 1) === 1;
  const market = theme.card.look === "market";
  const off =
    card.compareAt != null && card.priceMin != null && card.compareAt > card.priceMin
      ? Math.round(((card.compareAt - card.priceMin) / card.compareAt) * 100)
      : 0;
  const notes = notesFor(card, scarce, left);
  const ratio = shape === "wide" ? 0.75 : shape === "tall" ? 1.34 : 1;
  const box = fill ? styles.fillImage : { width, height: Math.round(width * ratio) };

  if (market) {
    return (
      <View style={[styles.flat, fill ? styles.fill : { width }]}>
        <Pressable onPress={() => onPress?.(card.id)}>
          <View style={styles.panel}>
            {card.image ? (
              <Image source={{ uri: card.image }} style={[styles.panelImage, box]} resizeMode={fit === "contain" ? "contain" : "cover"} />
            ) : (
              <View style={[styles.panelImage, box]} />
            )}
            {/* Across from where the heart sits, measured from the same edge. */}
            {off > 0 ? (
              <View style={styles.offStamp}>
                <Text style={styles.offStampText}>{"-" + off + "%"}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.marketBody}>
            <View style={styles.nameRow}>
              <Text style={styles.marketName} numberOfLines={1}>{card.name}</Text>
              {stars ? (
                <View style={styles.scoreTail}>
                  <Text style={styles.chipStar}>{"★"}</Text>
                  <Text style={styles.chipScore}>{theme.card.rating}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceBig}>{moneyFirst(card.priceMin)}</Text>
              {off > 0 ? <Text style={styles.compareAt}>{plainNumber(card.compareAt)}</Text> : null}
            </View>
            <CardNote notes={notes} />
          </View>
        </Pressable>
        {theme.card.add && onAdd ? (
          <Pressable
            style={styles.plus}
            onPress={() => (single && card.variantId ? onAdd(card.variantId, card.id) : onPress?.(card.id))}
          >
            <Text style={styles.plusMark}>+</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable style={[styles.tile, fill ? styles.fill : { width }]} onPress={() => onPress?.(card.id)}>
      {card.image ? (
        <Image source={{ uri: card.image }} style={[styles.tileImage, box]} resizeMode={fit === "contain" ? "contain" : "cover"} />
      ) : (
        <View style={[styles.tileImage, box]} />
      )}
      <View style={styles.tileBody}>
        {/* One line. A name too long for it stops at a word, not mid-word. */}
        <Text style={styles.tileName} numberOfLines={1}>{shortName(card.name)}</Text>
        {stars ? (
          <View style={styles.starRow}>
            <Stars score={score} />
            <Text style={styles.scoreText}>{theme.card.rating}</Text>
            {theme.card.reviews ? <Text style={styles.countText}>{"(" + theme.card.reviews + ")"}</Text> : null}
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(card.priceMin)}</Text>
          {card.compareAt != null && card.priceMin != null && card.compareAt > card.priceMin ? (
            <Text style={styles.compareAt}>{money(card.compareAt)}</Text>
          ) : null}
        </View>
        <CardNote notes={notes} />
        {scarce ? (
          <View style={styles.leftWrap}>
            <View style={styles.leftTrack}>
              <View
                style={[
                  styles.leftFill,
                  { width: Math.max(8, Math.round(((theme.card.lowAt - (left as number) + 1) / theme.card.lowAt) * 100)) + "%" },
                ]}
              />
            </View>
            <Text style={styles.leftText}>{"Only " + left + " left"}</Text>
          </View>
        ) : null}
        {theme.card.add && onAdd ? (
          <Pressable
            style={styles.tileCta}
            onPress={() => (single && card.variantId ? onAdd(card.variantId, card.id) : onPress?.(card.id))}
          >
            <Text style={styles.tileCtaText}>
              {single ? (theme.card.addLabel || "Add to bag").toUpperCase() : "CHOOSE SIZE"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  heading: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  tile: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { width: "100%" },
  fillImage: { width: "100%", aspectRatio: 1 },
  tileImage: { backgroundColor: theme.card.photoBg },
  tileBody: { paddingHorizontal: spacing.sm, paddingTop: 6, paddingBottom: spacing.sm },
  tileName: { fontSize: 11, lineHeight: 15, color: colors.ink },
  starRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  scoreText: { fontSize: 9, fontWeight: "700", color: colors.inkMuted },
  countText: { fontSize: 9, color: colors.inkSoft },
  noteRow: { marginTop: 4, height: 15, justifyContent: "center", overflow: "hidden" },
  noteFace: { flexDirection: "row", alignItems: "center", gap: 4 },
  noteMark: { fontSize: 9, lineHeight: 11 },
  noteText: { fontSize: 9, fontWeight: "700", flexShrink: 1 },
  flat: { position: "relative" },
  panel: { borderRadius: theme.card.radius, overflow: "hidden", backgroundColor: theme.card.photoBg },
  panelImage: { backgroundColor: theme.card.photoBg },
  offStamp: { position: "absolute", left: 6, top: 6, backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  offStampText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  plus: { position: "absolute", right: 2, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  plusMark: { fontSize: 17, lineHeight: 19, fontWeight: "600", color: "#fff" },
  marketBody: { paddingTop: 4, paddingBottom: 4, paddingLeft: 2, paddingRight: 34 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  marketName: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "500", color: colors.ink },
  scoreTail: { flexDirection: "row", alignItems: "center", gap: 2 },
  chipStar: { fontSize: 9, color: "#15803d" },
  chipScore: { fontSize: 9, fontWeight: "700", color: colors.inkMuted },
  dropRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  dropDisc: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#b42318", alignItems: "center", justifyContent: "center" },
  dropMark: { fontSize: 9, lineHeight: 11, fontWeight: "800", color: "#fff" },
  priceBig: { fontSize: 13, fontWeight: "800", color: colors.ink },
  leftWrap: { marginTop: 4 },
  leftTrack: { height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: "hidden" },
  leftFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  leftText: { marginTop: 2, fontSize: 9, fontWeight: "700", color: colors.accent },
  tileCta: { marginTop: 6, height: 30, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  tileCtaText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: "#fff" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "700", color: colors.accent },
  compareAt: { fontSize: 10, color: colors.inkSoft, textDecorationLine: "line-through" },
});
`,
  };
}

// --------------------------------------------------------- one section each --
/**
 * One component per block *type*, taking its settings as a prop.
 *
 * Not one per block. Two collection rows are the same component with different
 * props; generating CollectionRow1 and CollectionRow2 would duplicate the code
 * the moment a second row is added — and baking the first row's settings in as
 * constants would quietly make the second one a copy of it.
 */
function sectionFile(type: BlockType): GeneratedFile {
  const name = componentName(type);
  const body: Record<BlockType, string> = {
    brand_wall: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing, theme } from "../theme";
import { inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Brand = { id: string; handle?: string; label?: string; imageUrl?: string };
export type BrandWallSettings = {
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllUrl?: string;
  perRow?: number;
  rows?: number;
  showCount?: boolean;
  titleSize?: number;
  linkColor?: string;
  items?: Brand[];
};

/**
 * The houses the shop carries, each with how many pieces it holds.
 *
 * It points at the collection the shop already keeps per house, and the count
 * is read off the catalogue every time it draws. A hand-typed count is wrong
 * by next week, and a wrong count is worse than none: it is the one number
 * here a shopper could check.
 */
export function BrandWall({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: BrandWallSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = settings.items ?? [];
  const perRow = Math.max(2, Math.min(5, Number(settings.perRow || 4)));
  const showCount = settings.showCount !== false;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });

  const houses = items
    .map((i) => {
      const found = collections.find((c) => c.handle === i.handle);
      return {
        item: i,
        name: i.label || found?.title || i.handle || "",
        logo: i.imageUrl || undefined,
        count: found?.productCount ?? 0,
        known: Boolean(found),
      };
    })
    .filter((h) => h.name && (!h.known || h.count > 0));

  if (!houses.length) return null;

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.heading, settings.titleSize ? { fontSize: settings.titleSize } : null]} numberOfLines={1}>
          {settings.title ?? ""}
        </Text>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go({ handle: settings.seeAllHandle, url: settings.seeAllUrl })}>
            <Text style={[styles.seeAll, settings.linkColor ? { color: settings.linkColor } : null]}>
              {settings.seeAllLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.grid}>
        {houses.map((h) => (
          <Pressable
            key={h.item.id}
            style={[styles.cell, { width: 100 / perRow + "%" }]}
            onPress={() => go(h.item)}
          >
            <View style={styles.card}>
              <View style={styles.markRow}>
                {h.logo ? (
                  <Image source={{ uri: h.logo }} style={styles.mark} resizeMode="contain" />
                ) : (
                  <Text style={styles.name} numberOfLines={2}>{h.name.toUpperCase()}</Text>
                )}
              </View>
              {showCount && h.count > 0 ? <Text style={styles.count}>{String(h.count)}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  heading: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginTop: 8, rowGap: gap.item },
  cell: { paddingHorizontal: 4 },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 10, gap: 4 },
  markRow: { height: 28, width: "100%", alignItems: "center", justifyContent: "center" },
  mark: { height: 28, width: "100%" },
  name: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, lineHeight: 12, textAlign: "center", color: colors.ink },
  count: { fontSize: 9, color: colors.inkSoft },
});
`,
    pay_strip: `import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Way = { id: string; name: string; nameAr: string; kind: string; note: string; noteAr: string; color: string };

/**
 * A thin strip naming the ways the shop takes money, one at a time.
 *
 * What it names comes from the merchant's payment settings, the same place
 * the checkout reads, so the strip cannot advertise a provider that was
 * switched off a month ago. A shop that takes one way shows one line standing
 * still rather than a carousel of one.
 *
 * It rises rather than slides: everything else on this screen travels
 * sideways, and one strip moving the other way gets read.
 */
export function PayStrip({
  settings,
  payments,
}: {
  settings: { every?: number; title?: string };
  payments: Way[];
}) {
  const every = Math.max(0, Math.min(12, Number(settings.every === undefined ? 3 : settings.every) || 0));
  const [at, setAt] = useState(0);
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (every <= 0 || payments.length < 2) return;
    const t = setInterval(() => {
      rise.setValue(0);
      setAt((i) => (i + 1) % payments.length);
      Animated.timing(rise, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }, every * 1000);
    return () => clearInterval(t);
  }, [every, payments.length, rise]);

  if (!payments.length) return null;
  const way = payments[at % payments.length];
  const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <View style={styles.window}>
      <Animated.View
        style={[styles.strip, { backgroundColor: way.color || colors.accent, opacity: rise, transform: [{ translateY: lift }] }]}
      >
        <View style={styles.tag}>
          <Text style={styles.tagText}>{settings.title || "Pay your way"}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.name}>{way.name}</Text>
          {way.note ? (
            <Text style={styles.note} numberOfLines={1}>{way.note}</Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { height: 40, borderRadius: 12, overflow: "hidden", justifyContent: "center" },
  strip: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 10 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  tagText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: "#fff" },
  line: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6 },
  name: { fontSize: 12, fontWeight: "800", color: "#fff" },
  note: { flexShrink: 1, fontSize: 10, color: "rgba(255,255,255,0.75)" },
});
`,
    banner: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { openLink } from "./Pieces";
import type { HomePayload } from "../api";

export type BannerSettings = {
  imageUrl?: string;
  heading?: string;
  subheading?: string;
  /** Where tapping it goes: a collection, a product, a screen or an address. */
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};

export function Banner({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: BannerSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const { heading, subheading, handle } = settings;
  const imageUrl =
    settings.imageUrl || collections.find((c) => c.handle === handle)?.image || undefined;
  if (!imageUrl && !heading) return null;
  return (
    <Pressable onPress={() => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen })} style={styles.wrap}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
      {heading || subheading ? (
        <View style={styles.overlay}>
          {heading ? <Text style={styles.heading}>{heading}</Text> : null}
          {subheading ? <Text style={styles.sub}>{subheading}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", height: 144, backgroundColor: colors.page },
  // Written out rather than StyleSheet.absoluteFillObject, which newer React
  // Native no longer declares in its types.
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", padding: 12, backgroundColor: "rgba(0,0,0,0.28)" },
  heading: { fontSize: 17, fontWeight: "700", color: "#fff" },
  sub: { fontSize: 11, color: "rgba(255,255,255,0.85)" },
});
`,

    categories: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Category = { id: string; label?: string; emoji?: string } & LinkTo;
export type CategoriesSettings = { title?: string; items?: Category[] };

export function Categories({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: CategoriesSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  // The merchant's own picks when they made some; otherwise every collection,
  // which is what a store that has not curated this wants anyway.
  const picked = (settings.items ?? []).filter(
    (i) => i.handle || i.productId || i.screen || i.url,
  );
  const chips = picked.length
    ? picked.map((i) => {
        const { image, title } = inherit(i, collections);
        return { key: i.id, to: i as LinkTo, title, image, emoji: i.emoji };
      })
    : collections.map((c) => ({
        key: c.handle,
        to: { handle: c.handle } as LinkTo,
        title: c.title,
        image: c.image ?? undefined,
        emoji: undefined,
      }));
  if (!chips.length) return null;

  return (
    <>
      <SectionHeading title={settings.title ?? ""} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips.map((c) => (
          <Pressable key={c.key} style={styles.chip} onPress={() => openLink(c.to, { onOpenCollection, onOpenProduct, onOpenScreen })}>
            {c.image ? (
              <Image source={{ uri: c.image }} style={styles.chipImage} />
            ) : c.emoji ? (
              <Text style={styles.chipEmoji}>{c.emoji}</Text>
            ) : null}
            <Text style={styles.chipText}>{c.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: gap.itemTight, paddingVertical: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingStart: 6, paddingEnd: 12, paddingVertical: 4 },
  chipImage: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.page },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.inkMuted },
});
`,

    new_arrivals: `import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { gap, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { Card } from "../api";

export type NewArrivalsSettings = { title?: string; limit?: number };

export function NewArrivals({
  settings,
  products,
  onOpenProduct,
}: {
  settings: NewArrivalsSettings;
  products: Card[];
  onOpenProduct?: (id: string) => void;
}) {
  const shown = products.slice(0, settings.limit ?? 12);
  if (!shown.length) return null;
  return (
    <>
      <SectionHeading title={settings.title || "New arrivals"} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((p) => <ProductTile key={p.id} card={p} onPress={onOpenProduct} />)}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({ row: { gap: gap.item, paddingVertical: spacing.sm } });
`,

    collection_row: `import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { gap, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type CollectionRowSettings = {
  /** Empty means every collection, in the order set in the dashboard. */
  handle?: string;
  title?: string;
  limit?: number;
};

/** Matches the cap the API applies, so a row is never promised and not drawn. */
const ALL_ROWS_CAP = 8;

export function CollectionRow({
  settings,
  collections,
  rows,
  onOpenCollection,
  onOpenProduct,
}: {
  settings: CollectionRowSettings;
  collections: HomePayload["collections"];
  rows: HomePayload["rows"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
}) {
  const handle = settings.handle ?? "";
  const limit = settings.limit ?? 8;
  const targets = handle
    ? collections.filter((c) => c.handle === handle)
    : collections.slice(0, ALL_ROWS_CAP);

  return (
    <>
      {targets.map((c) => {
        const products = (rows[c.handle] ?? []).slice(0, limit);
        if (!products.length) return null;
        return (
          <View key={c.handle}>
            <SectionHeading
              title={handle ? settings.title || c.title : c.title}
              onSeeAll={() => onOpenCollection?.(c.handle)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {products.map((p) => <ProductTile key={p.id} card={p} onPress={onOpenProduct} />)}
            </ScrollView>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({ row: { gap: gap.item, paddingVertical: spacing.sm } });
`,

    collection_grid: `import React from "react";
import { StyleSheet, View } from "react-native";
import { gap, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type CollectionGridSettings = { handle?: string; title?: string; limit?: number };

const ALL_ROWS_CAP = 8;

export function CollectionGrid({
  settings,
  collections,
  rows,
  onOpenCollection,
  onOpenProduct,
}: {
  settings: CollectionGridSettings;
  collections: HomePayload["collections"];
  rows: HomePayload["rows"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
}) {
  const handle = settings.handle ?? "";
  const limit = settings.limit ?? 6;
  const targets = handle
    ? collections.filter((c) => c.handle === handle)
    : collections.slice(0, ALL_ROWS_CAP);

  return (
    <>
      {targets.map((c) => {
        const products = (rows[c.handle] ?? []).slice(0, limit);
        if (!products.length) return null;
        return (
          <View key={c.handle}>
            <SectionHeading
              title={handle ? settings.title || c.title : c.title}
              onSeeAll={() => onOpenCollection?.(c.handle)}
            />
            <View style={styles.grid}>
              {products.map((p) => (
                <ProductTile key={p.id} card={p} width={168} onPress={onOpenProduct} />
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: gap.item, paddingVertical: spacing.sm },
});
`,

    reviews: `import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type ReviewsSettings = {
  title?: string;
  subtitle?: string;
  ratingLabel?: string;
  seeAllLabel?: string;
  limit?: number;
};

export function Reviews({
  settings,
  reviews,
}: {
  settings: ReviewsSettings;
  reviews: HomePayload["reviews"];
}) {
  const shown = reviews.slice(0, settings.limit ?? 6);
  if (!shown.length) return null;
  return (
    <>
      <SectionHeading title={settings.ratingLabel || settings.title || "What customers say"} />
      {settings.subtitle ? <Text style={styles.sub}>{settings.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name}>{r.name}</Text>
              {r.productRating != null ? (
                <Text style={styles.stars}>{"★".repeat(r.productRating)}</Text>
              ) : null}
            </View>
            {r.comment ? <Text style={styles.comment} numberOfLines={3}>{r.comment}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 224, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontSize: 12, fontWeight: "600", color: colors.ink },
  stars: { fontSize: 12, color: "#f59e0b" },
  comment: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.inkMuted },
  sub: { fontSize: 11, color: colors.inkSoft },
});
`,

    hero: `import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { openLink } from "./Pieces";
import type { HomePayload } from "../api";

export type Slide = {
  id: string;
  imageUrl?: string;
  kicker?: string;
  heading?: string;
  subheading?: string;
  /** Where tapping it goes: a collection, a product, a screen or an address. */
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};
export type HeroSettings = {
  /** Seconds each slide is held before the next. Zero waits to be tapped. */
  autoplaySeconds?: number;
  height?: number;
  width?: number;
  items?: Slide[];
};

export function Hero({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: HeroSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const slides = settings.items ?? [];
  const [at, setAt] = useState(0);
  const every = settings.autoplaySeconds === undefined ? 5 : settings.autoplaySeconds;
  const tall = settings.height === undefined ? 240 : settings.height;
  const span = Math.max(50, Math.min(100, settings.width === undefined ? 86 : settings.width));
  const rail = useRef<{ scrollTo: (to: { x: number; animated?: boolean }) => void } | null>(null);
  const far = useRef(0);
  const seen = useRef(0);
  const [wide, setWide] = useState(0);
  const step = wide > 0 ? Math.round((wide * span) / 100) + 8 : 0;

  /**
   * The slides move on by themselves.
   *
   * A second slide nobody swipes to is a second slide nobody sees, and the
   * dots underneath are too small to read as an invitation. Picking one
   * restarts the wait from that choice rather than yanking the carousel out
   * from under a thumb.
   */
  useEffect(() => {
    if (every <= 0 || slides.length < 2 || step <= 0) return;
    const t = setInterval(() => {
      // Back to the start only once it is actually at the end: wrapping as
      // soon as one more slide would overshoot leaves a rail whose last step
      // is a short one sitting still for ever.
      const next = seen.current >= far.current - 2 ? 0 : Math.min(seen.current + step, far.current);
      seen.current = next;
      rail.current?.scrollTo({ x: next, animated: true });
      setAt(step > 0 ? Math.round(next / step) : 0);
    }, every * 1000);
    return () => clearInterval(t);
  }, [every, slides.length, step, at]);

  if (!slides.length) return null;

  return (
    <View onLayout={(e: { nativeEvent: { layout: { width: number } } }) => setWide(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={rail as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step > 0 ? step : undefined}
        decelerationRate="fast"
        onContentSizeChange={(w: number) => {
          far.current = Math.max(0, w - wide);
        }}
        onScroll={(e: { nativeEvent: { contentOffset: { x: number } } }) => {
          seen.current = e.nativeEvent.contentOffset.x;
          if (step > 0) setAt(Math.max(0, Math.min(slides.length - 1, Math.round(seen.current / step))));
        }}
        scrollEventThrottle={64}
        contentContainerStyle={styles.rail}
      >
        {slides.map((sl) => {
          // A slide with no picture of its own borrows the collection's.
          const image =
            sl.imageUrl || collections.find((c) => c.handle === sl.handle)?.image || undefined;
          return (
            <Pressable
              key={sl.id}
              onPress={() => openLink(sl, { onOpenCollection, onOpenProduct, onOpenScreen })}
              style={[styles.wrap, { height: tall, width: wide > 0 ? Math.round((wide * span) / 100) : undefined }]}
            >
              {image ? <Image source={{ uri: image }} style={styles.image} /> : null}
              <View style={styles.overlay}>
                {sl.kicker ? <Text style={styles.kicker}>{sl.kicker}</Text> : null}
                {sl.heading ? <Text style={styles.heading}>{sl.heading}</Text> : null}
                {sl.subheading ? <Text style={styles.sub}>{sl.subheading}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((sl, i) => (
            <Pressable
              key={sl.id}
              onPress={() => {
                setAt(i);
                seen.current = i * step;
                rail.current?.scrollTo({ x: i * step, animated: true });
              }}
              style={[styles.dot, i === at ? styles.dotOn : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 8 },
  wrap: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.page },
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", padding: 12, backgroundColor: "rgba(0,0,0,0.3)" },
  kicker: { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.8)" },
  heading: { fontSize: 20, fontWeight: "700", color: "#fff" },
  sub: { fontSize: 11, color: "rgba(255,255,255,0.85)" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: "#cbd5e1" },
  dotOn: { width: 16, backgroundColor: colors.accent },
});
`,

    promo_bar: `import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export type PromoBarSettings = { lead?: string; rest?: string; code?: string };

export function PromoBar({ settings }: { settings: PromoBarSettings }) {
  const { lead, rest, code } = settings;
  if (!lead && !code) return null;
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        {lead ? <Text style={styles.lead} numberOfLines={1}>{lead}</Text> : null}
        {rest ? <Text style={styles.rest} numberOfLines={1}>{rest}</Text> : null}
      </View>
      {code ? (
        <View style={styles.code}>
          <Text style={styles.codeText}>{code}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.accent + "14" },
  lead: { fontSize: 12, fontWeight: "700", color: colors.accent },
  rest: { fontSize: 10, color: colors.inkSoft },
  code: { borderRadius: radius.sm, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent, paddingHorizontal: 8, paddingVertical: 4 },
  codeText: { fontSize: 11, fontWeight: "700", color: colors.accent },
});
`,

    collection_tabs: `import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type Tab = { id: string; handle?: string; label?: string; emoji?: string };
export type CollectionTabsSettings = {
  title?: string;
  limit?: number;
  /** Where the kicker and heading sit: "left", "center" or "right". */
  align?: string;
  /** Pills share the width equally rather than scrolling at their own size. */
  stretchTabs?: boolean;
  /** The link to the whole collection, beside the heading. */
  showLink?: boolean;
  imageShape?: string;
  imageFit?: string;
  items?: Tab[];
};

export function CollectionTabs({
  settings,
  rows,
  onOpenCollection,
  onOpenProduct,
}: {
  settings: CollectionTabsSettings;
  rows: HomePayload["rows"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
}) {
  const tabs = (settings.items ?? []).filter((t) => t.handle);
  const [at, setAt] = useState(0);
  if (!tabs.length) return null;

  const active = tabs[Math.min(at, tabs.length - 1)];
  const products = (rows[active.handle!] ?? []).slice(0, settings.limit ?? 8);
  const align =
    settings.align === "center" ? "center" : settings.align === "right" ? "flex-end" : "flex-start";
  const stretch = settings.stretchTabs === true;

  return (
    <View>
      <SectionHeading
        title={settings.title ?? ""}
        onSeeAll={
          settings.showLink === false ? undefined : () => onOpenCollection?.(active.handle!)
        }
      />
      {stretch ? (
        <View style={styles.tabsRow}>
          {tabs.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => setAt(i)}
              style={[styles.tab, styles.tabGrow, i === at ? styles.tabOn : styles.tabOff]}
            >
              <Text numberOfLines={1} style={i === at ? styles.tabTextOn : styles.tabTextOff}>
                {(t.emoji ? t.emoji + " " : "") + (t.label || t.handle)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((t, i) => (
          <Pressable
            key={t.id}
            onPress={() => setAt(i)}
            style={[styles.tab, i === at ? styles.tabOn : styles.tabOff]}
          >
            <Text style={i === at ? styles.tabTextOn : styles.tabTextOff}>
              {(t.emoji ? t.emoji + " " : "") + (t.label || t.handle)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {products.map((p) => (
          <ProductTile
            key={p.id}
            card={p}
            shape={settings.imageShape ?? "square"}
            fit={settings.imageFit ?? "cover"}
            onPress={onOpenProduct}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 6, paddingVertical: spacing.sm },
  tabsRow: { flexDirection: "row", gap: 6, paddingVertical: spacing.sm },
  tabGrow: { flex: 1, alignItems: "center" },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  tab: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tabOn: { backgroundColor: colors.accent },
  tabOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tabTextOn: { fontSize: 12, fontWeight: "500", color: "#fff" },
  tabTextOff: { fontSize: 12, fontWeight: "500", color: colors.inkMuted },
});
`,

    cards: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type ImageCard = { id: string; imageUrl?: string; title?: string; subtitle?: string } & LinkTo;
export type CardsSettings = { kicker?: string; title?: string; items?: ImageCard[] };

export function Cards({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: CardsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const cards = settings.items ?? [];
  if (!cards.length) return null;
  return (
    <View>
      <SectionHeading title={settings.title ?? ""} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((c) => {
          const { image, title } = inherit(c, collections);
          return (
            <Pressable key={c.id} style={styles.card} onPress={() => openLink(c, { onOpenCollection, onOpenProduct, onOpenScreen })}>
              {image ? (
                <Image source={{ uri: image }} style={styles.image} />
              ) : (
                <View style={styles.image} />
              )}
              <View style={{ padding: spacing.sm }}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {c.subtitle ? <Text style={styles.sub} numberOfLines={1}>{c.subtitle}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 144, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
  image: { width: 144, height: 180, backgroundColor: colors.page },
  title: { fontSize: 12, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 10, color: colors.inkSoft },
});
`,

    sale_seal: `import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { colors, theme } from "../theme";
import { openLink, type LinkTo } from "./Pieces";

export type SaleSealSettings = {
  layout?: string;
  ringText?: string;
  bigText?: string;
  smallText?: string;
  tagline?: string;
  buttonLabel?: string;
  imageUrl?: string;
  focal?: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  bg?: string;
  bg2?: string;
  inkColor?: string;
  ringColor?: string;
  height?: number;
  radius?: number;
} & LinkTo;

/** A minute a turn: noticed rather than watched. */
function useTurn() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

export function SaleSeal({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: SaleSealSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const turn = useTurn();
  if (!settings.bigText && !settings.tagline && !settings.imageUrl) return null;

  const stacked = settings.layout === "stacked";
  const bg = settings.bg || "#7a4b27";
  const ink = settings.inkColor || "#ffffff";
  const ring = settings.ringColor || ink;
  const h = settings.height && settings.height > 0 ? settings.height : 230;
  const r = settings.radius && settings.radius >= 0 ? settings.radius : 18;
  const seal = Math.min(150, Math.round(h * 0.62));
  const reach = seal / 2 - 9;
  const opens = Boolean(settings.handle || settings.url || settings.productId || settings.screen);

  const line = String(settings.ringText || "").replace(/\s*·\s*/g, " · ").trim();
  const letters = (line + " · " + line + " · ").split("");

  const panel = (
    <View style={[styles.panel, { backgroundColor: bg }]}>
      <Fade angle={150} colors={[bg, settings.bg2 || colors.accent]} style={StyleSheet.absoluteFill} />
      <View style={[styles.seal, { width: seal, height: seal }]}>
        <Animated.View style={[styles.ring, { transform: [{ rotate: turn }] }]}>
          {letters.map((ch, i) => (
            <Text
              key={i}
              style={[
                styles.letter,
                {
                  color: ring,
                  transform: [
                    { rotate: String((i / letters.length) * 360) + "deg" },
                    { translateY: -reach },
                  ],
                },
              ]}
            >
              {ch === " " ? " " : ch.toUpperCase()}
            </Text>
          ))}
        </Animated.View>
        <View style={[styles.inner, { borderColor: ring }]}>
          {settings.smallText ? (
            <Text style={[styles.small, { color: ring, fontFamily: theme.titleFont }]}>{settings.smallText}</Text>
          ) : null}
          {settings.bigText ? (
            <Text style={[styles.big, { color: ink, fontFamily: theme.titleFont }]}>{settings.bigText}</Text>
          ) : null}
        </View>
      </View>

      {settings.tagline ? <Text style={[styles.tagline, { color: ink }]}>{settings.tagline}</Text> : null}
      {settings.buttonLabel ? (
        <View style={[styles.cta, { backgroundColor: ink }]}>
          <Text style={[styles.ctaText, { color: bg }]}>{settings.buttonLabel.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );

  const picture = settings.imageUrl ? (
    <View style={stacked ? { width: "100%", height: Math.round(h * 0.55) } : { width: "42%" }}>
      <Image source={{ uri: settings.imageUrl }} style={styles.photo} resizeMode="cover" />
      {settings.badge ? (
        <View style={[styles.badge, { backgroundColor: settings.badgeBg || "#2b1b10" }]}>
          <Text style={[styles.badgeText, { color: settings.badgeColor || "#ffffff" }]}>{settings.badge}</Text>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <Pressable
      disabled={!opens}
      onPress={() => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen })}
      style={[styles.wrap, { borderRadius: r, minHeight: stacked ? undefined : h }, stacked ? styles.column : null]}
    >
      {panel}
      {picture}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", overflow: "hidden", backgroundColor: colors.surface },
  column: { flexDirection: "column" },
  panel: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 16 },
  seal: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  letter: { position: "absolute", fontSize: 8, fontWeight: "700" },
  inner: { position: "absolute", left: 13, right: 13, top: 13, bottom: 13, borderRadius: 999, borderWidth: 1, opacity: 0.95, alignItems: "center", justifyContent: "center" },
  small: { fontSize: 13, fontStyle: "italic" },
  big: { fontSize: 30, fontWeight: "700" },
  tagline: { textAlign: "center", fontSize: 11, lineHeight: 15, opacity: 0.9 },
  cta: { marginTop: 2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  ctaText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  badge: { position: "absolute", right: 8, top: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },
});
`,

    free_shipping: `import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Fade, mix } from "./Fade";
import { colors, theme } from "../theme";
import { openLink, type LinkTo } from "./Pieces";

export type FreeShippingSettings = {
  style?: string;
  imageUrl?: string;
  focal?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  note?: string;
  buttonLabel?: string;
  stampTop?: string;
  stampBig?: string;
  stampBottom?: string;
  bigWord?: string;
  smallWord?: string;
  wasLabel?: string;
  wasPrice?: string;
  bg?: string;
  bg2?: string;
  inkColor?: string;
  dashColor?: string;
  radius?: number;
  height?: number;
} & LinkTo;

/** The stripes travel one full repeat and start again, so the border reads as
 *  an envelope going somewhere rather than a line that ends. */
function useStripes() {
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shift, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [shift]);
  return shift.interpolate({ inputRange: [0, 1], outputRange: [0, 44] });
}

/** The ribbon's line, twice over, so the second copy is already on screen
 *  when the first leaves and the line never seems to end. */
function Ribbon({ text, color }: { text: string; color: string }) {
  const [half, setHalf] = useState(0);
  const move = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!half) return;
    move.setValue(0);
    const loop = Animated.loop(
      Animated.timing(move, { toValue: -half, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [half, move]);
  const copy = (k: number) => (
    <View
      key={k}
      style={styles.ribbonHalf}
      onLayout={k === 0 ? (e) => setHalf(e.nativeEvent.layout.width) : undefined}
    >
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.ribbonHalf}>
          <Text style={[styles.ribbonText, { color }]}>{text.toUpperCase()}</Text>
          <Text style={[styles.ribbonStar, { color }]}>✦</Text>
        </View>
      ))}
    </View>
  );
  return (
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
      <Animated.View style={[styles.ribbonHalf, { transform: [{ translateX: move }] }]}>
        {copy(0)}
        {copy(1)}
      </Animated.View>
    </ScrollView>
  );
}

export function FreeShipping({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: FreeShippingSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const travel = useStripes();
  if (!settings.title && !settings.subtitle) return null;

  const look = settings.style || "ribbon";
  const strip = look === "strip";
  const paper = settings.bg || "#fffaf3";
  const ink = settings.inkColor || "#2b1b10";
  const air = settings.dashColor || colors.accent;
  const air2 = settings.bg2 || "#2b1b10";
  const r = settings.radius && settings.radius >= 0 ? settings.radius : 18;
  const opens = Boolean(settings.handle || settings.url || settings.productId || settings.screen);
  const go = () => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen });

  // The barber-pole border, drawn as leaning blocks because the phone has no
  // repeating gradient to make one out of.
  const stripes = (
    <View style={styles.stripeClip}>
      <Animated.View style={[styles.stripeRow, { transform: [{ translateX: travel }] }]}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View
            key={i}
            style={[styles.stripe, { backgroundColor: i % 2 === 0 ? air : air2 }]}
          />
        ))}
      </Animated.View>
    </View>
  );

  // A ticket, torn off.
  //
  // A banner is a rectangle with words in it and the eye has learned to slide
  // off rectangles. A ticket is an object - a stub, a perforation and a face
  // value - and the eye stops on objects. The notches do the work: two circles
  // in the page's own colour sitting half outside the card at each end of the
  // tear, which is what turns a dashed line into something that was torn.
  if (look === "ticket") {
    const big = settings.bigWord || "FREE";
    const small = settings.smallWord || "Delivery";
    const was = settings.wasPrice || "";
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.ticket, { backgroundColor: settings.bg || "#2b1b10", borderRadius: r, minHeight: settings.height || undefined }]}>
        <Fade
          angle={115}
          colors={[settings.bg || "#2b1b10", mix(settings.bg || "#2b1b10", settings.bg2 || colors.accent, 1 / 1.4)]}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
        <View style={styles.ticketBody}>
          {settings.kicker ? (
            <Text style={[styles.ticketKicker, { color: air }]}>{settings.kicker.toUpperCase()}</Text>
          ) : null}
          <View style={styles.ticketLine}>
            <Text style={[styles.ticketBig, { fontFamily: theme.titleFont }]}>{big}</Text>
            <Text style={styles.ticketSmall}>{small.toUpperCase()}</Text>
          </View>
          {settings.subtitle ? <Text style={styles.ticketSub}>{settings.subtitle}</Text> : null}
        </View>
        {was ? (
          <View style={styles.stub}>
            <View style={styles.tear} />
            <View style={[styles.notch, styles.notchTop, { backgroundColor: colors.page }]} />
            <View style={[styles.notch, styles.notchBottom, { backgroundColor: colors.page }]} />
            <Text style={styles.stubLabel}>{(settings.wasLabel || "was").toUpperCase()}</Text>
            <Text style={styles.stubPrice}>{was}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  // Priced, not described: the word, and what delivery would have cost.
  if (look === "bold") {
    const big = settings.bigWord || "FREE";
    const small = settings.smallWord || "Delivery";
    const was = settings.wasPrice || "";
    return (
      <View>
        <Pressable disabled={!opens} onPress={go} style={[styles.bold, { borderRadius: r, minHeight: settings.height || undefined }]}>
          <Fade
            angle={120}
            colors={[settings.bg || "#2b1b10", settings.bg2 || colors.accent]}
            style={[StyleSheet.absoluteFill, { borderRadius: r }]}
          />
          <View style={styles.boldCopy}>
            <Text style={[styles.boldBig, { fontFamily: theme.titleFont }]}>{big}</Text>
            <View style={styles.boldWords}>
              <Text style={styles.boldSmall}>{small.toUpperCase()}</Text>
              {settings.subtitle ? <Text style={styles.boldSub}>{settings.subtitle}</Text> : null}
            </View>
          </View>
          {was ? (
            <View style={styles.boldWas}>
              <Text style={[styles.boldWasLabel, { color: air }]}>{(settings.wasLabel || "was").toUpperCase()}</Text>
              <Text style={[styles.boldWasPrice, { textDecorationColor: air }]}>{was}</Text>
            </View>
          ) : null}
        </Pressable>
        {settings.note ? <Text style={styles.boldNote}>{settings.note}</Text> : null}
      </View>
    );
  }

  // A line between two hairlines - a fact, not a banner.
  if (look === "rule") {
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.rule, { borderColor: ink + "1f" }]}>
        <View style={styles.ruleLine}>
          <Text style={[styles.ruleStar, { color: air }]}>✦</Text>
          <Text style={[styles.ruleTitle, { color: ink }]}>{(settings.title || "").toUpperCase()}</Text>
          <Text style={[styles.ruleStar, { color: air }]}>✦</Text>
        </View>
        {settings.subtitle ? <Text style={[styles.ruleSub, { color: ink }]}>{settings.subtitle.toUpperCase()}</Text> : null}
      </Pressable>
    );
  }

  // One line of type crossing the screen.
  if (look === "ribbon") {
    const run = [settings.title, settings.subtitle].filter(Boolean).join(" ") || settings.kicker || "";
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.ribbon, { backgroundColor: air }]}>
        <Ribbon text={run} color={paper} />
      </Pressable>
    );
  }

  // The editorial line: no ornament at all.
  if (look === "editorial") {
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.editorial, { backgroundColor: paper, borderRadius: r }]}>
        {settings.kicker ? (
          <View style={styles.ruleLine}>
            <View style={[styles.hair, { backgroundColor: ink + "33" }]} />
            <Text style={[styles.edKicker, { color: air }]}>{settings.kicker.toUpperCase()}</Text>
            <View style={[styles.hair, { backgroundColor: ink + "33" }]} />
          </View>
        ) : null}
        {settings.title ? <Text style={[styles.edTitle, { color: ink, fontFamily: theme.titleFont }]}>{settings.title}</Text> : null}
        {settings.subtitle ? <Text style={[styles.edSub, { color: ink }]}>{settings.subtitle.toUpperCase()}</Text> : null}
        {settings.buttonLabel ? (
          <Text style={[styles.edCta, { color: ink, borderBottomColor: air }]}>{settings.buttonLabel.toUpperCase() + " →"}</Text>
        ) : null}
      </Pressable>
    );
  }

  // The promise over a photograph: the shape everything else in this shop
  // takes, because the shop is a photographed one.
  if (look === "photo") {
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.photoWrap, { height: settings.height || 168 }]}>
        {settings.imageUrl ? (
          <Image source={{ uri: settings.imageUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, { backgroundColor: air }]} />
        )}
        <Fade
          angle={0}
          colors={["rgba(20,12,7,0.78)", "rgba(20,12,7,0.35)", "rgba(20,12,7,0)"]}
          locations={[0, 0.45, 0.78]}
          style={styles.scrim}
        />
        <View style={styles.photoBody}>
          <View style={{ flex: 1 }}>
            {settings.kicker ? (
              <Text style={styles.photoKicker}>{settings.kicker.toUpperCase()}</Text>
            ) : null}
            {settings.title ? (
              <Text style={[styles.photoTitle, { fontFamily: theme.titleFont }]}>{settings.title}</Text>
            ) : null}
            {settings.subtitle ? <Text style={styles.photoSub}>{settings.subtitle}</Text> : null}
          </View>
          {settings.buttonLabel ? (
            <View style={styles.photoCta}>
              <Text style={styles.photoCtaText}>{settings.buttonLabel.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (strip) {
    return (
      <Pressable disabled={!opens} onPress={go} style={[styles.strip, { backgroundColor: paper, borderRadius: r, borderColor: air }]}>
        <View style={[styles.pip, { backgroundColor: air }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.stripTitle, { color: ink }]} numberOfLines={1}>{settings.title}</Text>
          {settings.subtitle ? (
            <Text style={[styles.stripSub, { color: ink }]} numberOfLines={1}>{settings.subtitle}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const stamped = Boolean(settings.stampTop || settings.stampBig || settings.stampBottom);

  return (
    <Pressable disabled={!opens} onPress={go} style={[styles.banner, { backgroundColor: paper, borderRadius: r, minHeight: settings.height || undefined }]}>
      {stripes}

      <View style={styles.body}>
        <View style={{ flex: 1 }}>
          {settings.kicker ? (
            <Text style={[styles.kicker, { color: air }]}>{"\u2726 " + settings.kicker.toUpperCase()}</Text>
          ) : null}
          {settings.title ? (
            <Text style={[styles.title, { color: ink, fontFamily: theme.titleFont }]}>{settings.title}</Text>
          ) : null}
          {settings.subtitle ? (
            <Text style={[styles.sub, { color: ink }]}>{settings.subtitle}</Text>
          ) : null}

          <View style={styles.footRow}>
            {settings.buttonLabel ? (
              <View style={[styles.cta, { backgroundColor: ink }]}>
                <Text style={[styles.ctaText, { color: paper }]}>{settings.buttonLabel}</Text>
              </View>
            ) : null}
            {settings.note ? <Text style={[styles.note, { color: ink }]}>{settings.note}</Text> : null}
          </View>
        </View>

        {stamped ? (
          <View style={[styles.stamp, { borderColor: air }]}>
            {settings.stampTop ? <Text style={[styles.stampTop, { color: air }]}>{settings.stampTop}</Text> : null}
            {settings.stampBig ? (
              <Text style={[styles.stampBig, { color: ink, fontFamily: theme.titleFont }]}>{settings.stampBig}</Text>
            ) : null}
            {settings.stampBottom ? (
              <Text style={[styles.stampBottom, { color: ink }]}>{settings.stampBottom}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {stripes}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bold: { flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 14 },
  boldCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  boldWords: { flexShrink: 1, paddingBottom: 4 },
  boldBig: { fontSize: 42, lineHeight: 44, fontWeight: "700", color: "#ffffff" },
  boldSmall: { fontSize: 13, fontWeight: "700", letterSpacing: 2.3, color: "#ffffff" },
  boldSub: { marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.8)" },
  boldWas: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", backgroundColor: "rgba(20,12,7,0.28)" },
  boldWasLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.3 },
  boldWasPrice: { marginTop: 2, fontSize: 15, fontWeight: "700", color: "#ffffff", textDecorationLine: "line-through" },
  boldNote: { marginTop: 6, textAlign: "center", fontSize: 10, color: "#64748b" },
  rule: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, alignItems: "center" },
  ruleLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ruleStar: { fontSize: 10 },
  ruleTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 1.6 },
  ruleSub: { marginTop: 4, fontSize: 9, fontWeight: "600", letterSpacing: 1.3, opacity: 0.55 },
  ribbon: { marginHorizontal: -16, paddingVertical: 12, overflow: "hidden" },
  ribbonHalf: { flexDirection: "row", alignItems: "center" },
  ribbonText: { fontSize: 13, fontWeight: "700", letterSpacing: 1.8 },
  ribbonStar: { paddingHorizontal: 12, fontSize: 11, opacity: 0.7 },
  editorial: { paddingHorizontal: 16, paddingVertical: 24, alignItems: "center" },
  hair: { height: 1, width: 32 },
  edKicker: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  edTitle: { marginTop: 8, fontSize: 27, fontWeight: "700", textAlign: "center" },
  edSub: { marginTop: 6, fontSize: 10, fontWeight: "600", letterSpacing: 1.8, opacity: 0.6, textAlign: "center" },
  edCta: { marginTop: 12, borderBottomWidth: 1, paddingBottom: 2, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  banner: { overflow: "hidden" },
  photoWrap: { marginHorizontal: -16, overflow: "hidden" },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  photoBody: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 16 },
  photoKicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.9, color: "#e7c9a9" },
  photoTitle: { marginTop: 4, fontSize: 24, fontWeight: "700", color: "#ffffff" },
  photoSub: { marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  photoCta: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 14, paddingVertical: 6 },
  photoCtaText: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "#2b1b10" },
  ticket: { flexDirection: "row", overflow: "hidden" },
  ticketBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  ticketKicker: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  ticketLine: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  ticketBig: { fontSize: 30, fontWeight: "700", color: "#ffffff" },
  ticketSmall: { fontSize: 12, fontWeight: "800", letterSpacing: 1.6, color: "rgba(255,255,255,0.9)", paddingBottom: 3 },
  ticketSub: { marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.7)" },
  stub: { width: 92, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  // React Native has no dashed border on one side, so the tear is a hairline.
  tear: { position: "absolute", left: 0, top: 8, bottom: 8, width: 1, backgroundColor: "rgba(255,255,255,0.45)" },
  notch: { position: "absolute", left: -8, width: 16, height: 16, borderRadius: 8 },
  notchTop: { top: -8 },
  notchBottom: { bottom: -8 },
  stubLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 1.6, color: "rgba(255,255,255,0.55)" },
  stubPrice: { marginTop: 2, fontSize: 16, fontWeight: "700", color: "#ffffff", textDecorationLine: "line-through" },
  stripeClip: { height: 7, overflow: "hidden" },
  stripeRow: { flexDirection: "row", position: "absolute", left: -44, width: 900 },
  stripe: { width: 11, height: 20, marginTop: -6, transform: [{ rotate: "25deg" }] },
  body: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.9 },
  title: { marginTop: 4, fontSize: 26, fontWeight: "700" },
  sub: { marginTop: 2, fontSize: 12, opacity: 0.72 },
  footRow: { marginTop: 12, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  cta: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  ctaText: { fontSize: 12, fontWeight: "700" },
  note: { fontSize: 10, opacity: 0.55 },
  stamp: { width: 62, height: 78, borderRadius: 6, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, transform: [{ rotate: "-3deg" }] },
  stampTop: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  stampBig: { fontSize: 19, fontWeight: "700" },
  stampBottom: { marginTop: 2, fontSize: 7, fontWeight: "700", letterSpacing: 0.8, opacity: 0.6 },
  strip: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  pip: { width: 6, height: 24, borderRadius: 999 },
  stripTitle: { fontSize: 12, fontWeight: "700" },
  stripSub: { fontSize: 11, opacity: 0.7 },
});
`,

    moments: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { colors, gap, spacing } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Moment = { id: string; imageUrl?: string; label?: string; focal?: string } & LinkTo;
export type MomentsSettings = {
  title?: string;
  subtitle?: string;
  /**
   * How many fit across before anyone has to scroll.
   *
   * A row that scrolls hides whatever is past the edge, and on a phone that is
   * most of it. Asking for a number rather than a width lets the screen decide
   * the width: the cards divide what there is, keep the proportions of the
   * size below, and the whole edit is visible at once. Zero scrolls instead.
   */
  perRow?: number;
  cardWidth?: number;
  cardHeight?: number;
  radius?: number;
  labelColor?: string;
  items?: Moment[];
};

/** "50% 25%" is where the website puts the eye; React Native can only meet it
 *  half way, so the picture is anchored top, centre or bottom. */
function anchor(focal?: string): "top" | "center" | "bottom" {
  const y = Number(String(focal ?? "").trim().split(/\s+/)[1]?.replace("%", ""));
  if (!Number.isFinite(y)) return "center";
  if (y <= 33) return "top";
  if (y >= 67) return "bottom";
  return "center";
}

export function Moments({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: MomentsSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.imageUrl || i.label);
  if (!items.length) return null;
  const w = settings.cardWidth && settings.cardWidth > 0 ? settings.cardWidth : 150;
  const h = settings.cardHeight && settings.cardHeight > 0 ? settings.cardHeight : 210;
  const r = settings.radius && settings.radius >= 0 ? settings.radius : 14;
  const word = settings.labelColor || "#ffffff";
  const across = !settings.perRow ? 5 : Math.max(0, Math.round(settings.perRow));
  const grid = across >= 2;
  // Five across leaves about sixty pixels a card, and a word set at thirteen
  // would not fit in it. The shade over the picture shrinks with the card too:
  // half of it is right at two hundred pixels tall and a slab at ninety.
  const tight = across >= 5;

  const cards = items.map((m) => (
          <Pressable
            key={m.id}
            style={[
              styles.card,
              grid
                ? { flex: 1, aspectRatio: w > 0 && h > 0 ? w / h : 5 / 7, borderRadius: r }
                : { width: w, height: h, borderRadius: r },
            ]}
            onPress={() => openLink(m, { onOpenCollection, onOpenProduct, onOpenScreen })}
          >
            {m.imageUrl ? (
              <Image source={{ uri: m.imageUrl }} style={styles.img} resizeMode="cover" resizeMethod="resize" />
            ) : (
              <View style={[styles.img, { backgroundColor: colors.line }]} />
            )}
            <Fade
              angle={0}
              colors={tight ? ["rgba(0,0,0,0.68)", "rgba(0,0,0,0.26)", "rgba(0,0,0,0)"] : ["rgba(0,0,0,0.58)", "rgba(0,0,0,0.22)", "rgba(0,0,0,0)"]}
              locations={tight ? [0, 0.55, 1] : [0, 0.45, 1]}
              style={tight ? styles.scrimTight : styles.scrim}
            />
            {m.label ? (
              <Text style={[tight ? styles.wordTight : styles.word, { color: word }]} numberOfLines={1}>
                {m.label}
              </Text>
            ) : null}
          </Pressable>
  ));

  return (
    <View>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      {grid ? (
        <View style={styles.grid}>{cards}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {cards}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.inkSoft },
  row: { gap: gap.itemTight, paddingVertical: spacing.sm },
  grid: { flexDirection: "row", gap: gap.itemTight, paddingVertical: spacing.sm },
  card: { overflow: "hidden", backgroundColor: colors.line },
  img: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%" },
  scrimTight: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%" },
  word: { position: "absolute", left: 12, right: 12, bottom: 10, fontSize: 13, fontWeight: "600" },
  wordTight: { position: "absolute", left: 5, right: 5, bottom: 5, fontSize: 9, fontWeight: "700" },
});
`,

    bundle_save: `import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing, theme } from "../theme";
import { money, shortName } from "./Pieces";
import type { HomePayload } from "../api";

type Card = HomePayload["newArrivals"][number];

export type BundleSaveSettings = {
  eyebrow?: string;
  title?: string;
  itemCount?: number;
  percentOff?: number;
  code?: string;
  handle?: string;
  limit?: number;
  addLabel?: string;
  note?: string;
  radius?: number;
  bg?: string;
  inkColor?: string;
};

/**
 * Buy three, the cheapest comes down.
 *
 * It does not invent a total: the saving is a real discount code the shopper
 * uses at checkout, so this says the code and the checkout does the
 * arithmetic. A card that needs a size opens instead of being picked, for the
 * same reason the product cards do - guessing on her behalf is how you earn a
 * return.
 */
/** The brand is already on the photo; the card's two words are for the piece. */
function withoutVendor(name: string, vendor?: string | null) {
  const v = (vendor || "").trim();
  const n = String(name || "").trim();
  if (!v || n.toLowerCase().indexOf(v.toLowerCase()) !== 0) return n;
  return n.slice(v.length).trim() || n;
}

export function BundleSave({
  settings,
  rows,
  newArrivals,
  onOpenProduct,
  onAdd,
}: {
  settings: BundleSaveSettings;
  rows: HomePayload["rows"];
  newArrivals: HomePayload["newArrivals"];
  onOpenProduct?: (id: string) => void;
  onAdd?: (variantId: string, productId: string) => void;
}) {
  const handle = (settings.handle || "").toLowerCase();
  const pool = (handle ? rows[handle] : undefined) || newArrivals || [];
  const cards = pool.slice(0, settings.limit && settings.limit > 0 ? settings.limit : 12);
  const want = Math.max(2, settings.itemCount || 3);
  const off = Math.max(0, Math.min(90, settings.percentOff === undefined ? 10 : settings.percentOff));
  const ink = settings.inkColor || "#2b1b10";
  const paper = settings.bg || "#fffaf3";
  const r = settings.radius ? settings.radius : 16;

  const [picked, setPicked] = useState<string[]>([]);
  const [added, setAdded] = useState(false);
  if (!cards.length) return null;

  // The code is what actually takes money off, so without one this section
  // claims nothing: no per cent, no saving, just a faster way to add several
  // things at once. An offer the checkout will not honour is worse than none.
  const offers = Boolean(settings.code) && off > 0;
  const chosen = cards.filter((c) => picked.indexOf(c.id) >= 0);
  const prices = chosen.map((c) => c.priceMin || 0);
  const total = prices.reduce((a, b) => a + b, 0);
  const saving = offers && prices.length ? Math.round((Math.min.apply(null, prices) * off) / 100) : 0;
  const full = picked.length >= want;

  const toggle = (card: Card) => {
    const single = card.variantId != null && (card.variantCount || 1) === 1;
    if (!single) return onOpenProduct && onOpenProduct(card.id);
    setPicked((p) => (p.indexOf(card.id) >= 0 ? p.filter((x) => x !== card.id) : p.concat(card.id)));
  };

  return (
    <View style={[styles.card, { backgroundColor: paper, borderColor: colors.accent + "33", borderRadius: r }]}>
      <View style={[styles.band, { backgroundColor: colors.accent + "14" }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          {(settings.eyebrow || "Bundle & save").toUpperCase()}
        </Text>
        {offers ? (
          <View style={[styles.pill, { backgroundColor: colors.accent }]}>
            <Text style={styles.pillText}>{off + "% OFF"}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {settings.title ? (
          <Text style={[styles.title, { color: ink, fontFamily: theme.titleFont }]}>{settings.title}</Text>
        ) : null}
        <Text style={[styles.rule, { color: ink }]}>
          {offers ? "Pick " + want + " — the cheapest comes down " + off + "%" : "Pick " + want + " and add them together"}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.row}>
          {cards.map((card) => {
            const on = picked.indexOf(card.id) >= 0;
            return (
              <Pressable
                key={card.id}
                onPress={() => toggle(card)}
                style={[styles.pick, { borderColor: on ? colors.accent : colors.line, borderWidth: on ? 2 : 1 }]}
              >
                {card.image ? (
                  <Image source={{ uri: card.image }} style={styles.pickImage} resizeMode="cover" />
                ) : (
                  <View style={styles.pickImage} />
                )}
                {on ? (
                  <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                    <Text style={styles.tickText}>{"✓"}</Text>
                  </View>
                ) : null}
                <View style={styles.pickBody}>
                  <Text style={styles.pickName} numberOfLines={1}>{shortName(withoutVendor(card.name, card.vendor), 2)}</Text>
                  <Text style={[styles.pickPrice, { color: ink }]}>{money(card.priceMin)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.foot}>
          <View style={{ flex: 1 }}>
            <Text style={styles.count}>{picked.length + " of " + want + " picked"}</Text>
            {picked.length ? (
              <Text style={[styles.total, { color: ink }]}>
                {money(total - saving)}
                {saving > 0 ? <Text style={[styles.saving, { color: colors.accent }]}>{"  save " + money(saving)}</Text> : null}
              </Text>
            ) : null}
          </View>
          <Pressable
            disabled={!full || !onAdd}
            onPress={() => {
              chosen.forEach((c) => c.variantId && onAdd && onAdd(c.variantId, c.id));
              setAdded(true);
              setTimeout(() => setAdded(false), 2200);
            }}
            style={[
              styles.cta,
              { backgroundColor: added ? "#4a7858" : colors.accent },
              !full || !onAdd ? { opacity: 0.4 } : null,
            ]}
          >
            <Text style={styles.ctaText}>
              {added ? "ADDED ✓" : (settings.addLabel || "Add bundle").toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {settings.code ? (
          <Text style={styles.note}>
            {(settings.note || "Use the code at checkout") + ": "}
            <Text style={[styles.code, { color: colors.accent }]}>{settings.code}</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: 1 },
  band: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  eyebrow: { flex: 1, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: "700" },
  rule: { marginTop: 2, fontSize: 11, opacity: 0.6 },
  rail: { marginHorizontal: -12, marginTop: 10 },
  row: { flexDirection: "row", gap: gap.itemTight, paddingHorizontal: 12, paddingBottom: 4 },
  pick: { width: 86, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  pickImage: { width: "100%", height: 86, backgroundColor: theme.card.photoBg },
  tick: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tickText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  pickBody: { paddingHorizontal: 6, paddingTop: 4, paddingBottom: 6 },
  pickName: { fontSize: 9, color: "#64748b" },
  pickPrice: { fontSize: 11, fontWeight: "700" },
  foot: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: 10 },
  count: { fontSize: 11, color: colors.inkSoft },
  total: { fontSize: 15, fontWeight: "700" },
  saving: { fontSize: 11, fontWeight: "700" },
  cta: { height: 40, justifyContent: "center", borderRadius: radius.md, paddingHorizontal: 16 },
  ctaText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: "#fff" },
  note: { marginTop: 8, fontSize: 10, color: colors.inkSoft },
  code: { fontWeight: "800" },
});
`,

    tiers: `import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing, theme } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Tier = { id: string; prefix?: string; amount?: string; label?: string } & LinkTo;
export type TiersSettings = {
  title?: string;
  cardBg?: string;
  lineColor?: string;
  inkColor?: string;
  mutedColor?: string;
  items?: Tier[];
};

export function Tiers({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: TiersSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const tiers = settings.items ?? [];
  if (!tiers.length) return null;
  const cardBg = settings.cardBg || "#fffaf3";
  const line = settings.lineColor || "#e7d8c4";
  const ink = settings.inkColor || "#2b1b10";
  const muted = settings.mutedColor || "#8a6e57";
  return (
    <View>
      <SectionHeading title={settings.title ?? ""} />
      <View style={styles.grid}>
        {tiers.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.card, { backgroundColor: cardBg, borderColor: line }]}
            onPress={() => openLink(t, { onOpenCollection, onOpenProduct, onOpenScreen })}
          >
            {t.prefix ? <Text style={[styles.prefix, { color: muted }]}>{t.prefix.toUpperCase()}</Text> : null}
            <Text style={[styles.amount, { color: ink, fontFamily: theme.titleFont }]}>{t.amount}</Text>
            <View style={[styles.rule, { backgroundColor: colors.accent }]} />
            <Text style={[styles.label, { color: muted }]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: gap.itemTight, paddingVertical: spacing.sm },
  card: { flexGrow: 1, flexBasis: "46%", borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  prefix: { fontSize: 9, letterSpacing: 1.6, fontWeight: "600" },
  amount: { marginTop: 4, fontSize: 19, fontWeight: "700" },
  rule: { marginTop: 8, height: 1, width: 24 },
  label: { marginTop: 8, fontSize: 11 },
});
`,

    split: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Panel = { id: string; imageUrl?: string; label?: string; buttonLabel?: string } & LinkTo;
export type SplitSettings = { title?: string; items?: Panel[] };

export function Split({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: SplitSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const panels = (settings.items ?? []).slice(0, 2);
  if (!panels.length) return null;
  return (
    <View>
      <SectionHeading title={settings.title ?? ""} />
      <View style={styles.row}>
        {panels.map((p) => {
          const { image, title } = inherit(p, collections);
          return (
            <Pressable key={p.id} style={styles.panel} onPress={() => openLink(p, { onOpenCollection, onOpenProduct, onOpenScreen })}>
              {image ? (
                <Image source={{ uri: image }} style={styles.image} />
              ) : (
                <View style={styles.image} />
              )}
              <View style={styles.caption}>
                <Text style={styles.label}>{title}</Text>
                {p.buttonLabel ? <Text style={styles.button}>{p.buttonLabel}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: gap.itemTight, paddingVertical: spacing.sm },
  panel: { flex: 1, height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.page },
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  caption: { position: "absolute", right: 0, bottom: 0, left: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.35)" },
  label: { fontSize: 14, fontWeight: "700", color: "#fff" },
  button: { fontSize: 10, color: "rgba(255,255,255,0.85)" },
});
`,

    trust_badges: `import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";

export type Badge = { id: string; emoji?: string; title?: string; subtitle?: string };
export type TrustBadgesSettings = { items?: Badge[] };

export function TrustBadges({ settings }: { settings: TrustBadgesSettings }) {
  const badges = settings.items ?? [];
  if (!badges.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {badges.map((b) => (
        <View key={b.id} style={styles.card}>
          <Text style={styles.emoji}>{b.emoji || "•"}</Text>
          <Text style={styles.title} numberOfLines={1}>{b.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{b.subtitle}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: gap.itemTight, paddingVertical: spacing.sm },
  card: { width: 112, alignItems: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 10 },
  emoji: { fontSize: 18 },
  title: { marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 10, color: colors.inkSoft },
});
`,

    live_now: `import React, { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Path } from "react-native-svg";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import { Fade } from "./Fade";
import { fetchAccount, fetchReels, likeReel, type HomePayload, type Reel } from "../api";

export type LivePerson = {
  id: string;
  imageUrl?: string;
  name?: string;
  viewers?: string;
  /** A recording, if this circle is one. */
  videoUrl?: string;
  /** False for a recording, true for a live that is on air now. */
  onAir?: boolean;
  /** A live on air: its hearts, and how many things are pinned to it. */
  likes?: number;
  pieces?: number;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
};

export type LiveNowSettings = {
  title?: string;
  liveLabel?: string;
  replayBadge?: string;
  showReplays?: boolean;
  replaysLabel?: string;
  replaysHandle?: string;
  replaysProductId?: string;
  replaysScreen?: string;
  replaysUrl?: string;
  /** Recordings play inside their tiles. On unless switched off. */
  autoplayReplays?: boolean;
  offerEnabled?: boolean;
  offerTitle?: string;
  offerText?: string;
  offerMinutes?: number;
  offerHandle?: string;
  offerProductId?: string;
  offerScreen?: string;
  offerUrl?: string;
  avatarShape?: string;
  avatarSize?: number;
  ringWidth?: number;
  ringColor?: string;
  badgeBg?: string;
  badgeTextColor?: string;
  nameSize?: number;
  viewersSize?: number;
  bannerRadius?: number;
  /** The gap between the row of circles and the banner. */
  offerGap?: number;
  /** How tall the banner is. Zero follows its wording. */
  offerHeight?: number;
  offerBg?: string;
  offerTextColor?: string;
  offerTitleSize?: number;
  offerTextSize?: number;
  timerBg?: string;
  timerTextColor?: string;
  items?: LivePerson[];
};

/**
 * Put the shopper name into the line the merchant wrote, or take the token out.
 * A literal "{name}" on screen is worse than no personalisation, so when nobody
 * is signed in the token and the comma after it go, and the line starts later.
 */
function personalise(template: string, name: string | null): string {
  const first = String(name ?? "").trim().split(" ")[0] ?? "";
  if (first) return template.split("{name}").join(first);
  let out = template.split("{name}").join("").trim();
  // A possessive reads as "'s profile" once the name is gone, so the
  // apostrophe leaves with it rather than dangling at the front of the line.
  if (out.startsWith("'s ") || out.startsWith("’s ")) out = out.slice(3).trim();
  if (out === "'s" || out === "’s") out = "";
  while (out.startsWith(",") || out.startsWith("،")) out = out.slice(1).trim();
  return out ? out[0].toUpperCase() + out.slice(1) : "";
}

const pad = (n: number) => (n < 10 ? "0" + n : String(n));

/**
 * The live a replay link points at, when it is one of ours.
 *
 * A replay circle here is something the merchant set up by hand, so its own
 * id is the editor's, not the live's. What she pasted into it is usually the
 * live's link from the dashboard - /store/live/<id> - or a shared reel
 * link with ?reel=<id>, and that is where the real id is.
 */
function reelIdOf(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/\\/store\\/live\\/([^/?#]+)/) || url.match(/[?&]reel=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function LiveNow({
  settings,
  lives,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: LiveNowSettings;
  lives?: HomePayload["lives"];
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  // Whoever is genuinely on air comes first, with the cover chosen when the
  // live was created. Behind them stand the recordings the merchant keeps in
  // this section, so the row is never empty between shows.
  const onAir = (lives ?? []).filter((l) => l.status === "live");
  const people: LivePerson[] = [
    ...onAir.map((l) => ({
      id: l.id,
      imageUrl: l.coverUrl ?? undefined,
      name: l.hostName || l.title,
      viewers: l.peakViewers ? String(l.peakViewers) : undefined,
      url: l.href,
      onAir: true,
      likes: l.likes ?? 0,
      pieces: l.pieces ?? 0,
    })),
    ...(settings.items ?? [])
      .filter((i) => i.videoUrl || i.imageUrl || i.name)
      .map((i) => ({ ...i, onAir: false })),
  ];
  const showReplays = settings.showReplays !== false;
  const liveLabel = settings.liveLabel || "LIVE";
  const replayBadge = settings.replayBadge || "Replay";

  // An empty colour means "follow the brand", so the section keeps up with the
  // accent instead of stranding a hex somebody typed once and forgot.
  const ringColor = settings.ringColor || colors.accent;
  const badgeBg = settings.badgeBg || "#e11d48";
  const badgeFg = settings.badgeTextColor || "#ffffff";
  const offerBg = settings.offerBg || colors.accent;
  const offerFg = settings.offerTextColor || "#ffffff";
  const timerBg = settings.timerBg || "rgba(255,255,255,0.22)";
  const timerFg = settings.timerTextColor || "#ffffff";

  const size = settings.avatarSize && settings.avatarSize > 0 ? settings.avatarSize : 64;
  // Zero is a real answer here — it means no ring at all — so this cannot use
  // the "positive or default" rule the other numbers use.
  const ringW = typeof settings.ringWidth === "number" && settings.ringWidth >= 0 ? settings.ringWidth : 2;
  const shape = settings.avatarShape || "circle";
  const photoRadius = shape === "square" ? 4 : shape === "rounded" ? Math.round(size * 0.28) : Math.round(size / 2);
  const nameSize = settings.nameSize && settings.nameSize > 0 ? settings.nameSize : 10;
  const viewersSize = settings.viewersSize && settings.viewersSize > 0 ? settings.viewersSize : 9;
  const bannerRadius = settings.bannerRadius && settings.bannerRadius > 0 ? settings.bannerRadius : radius.lg;
  const offerGap = typeof settings.offerGap === "number" && settings.offerGap >= 0 ? settings.offerGap : spacing.md;
  const offerHeight = typeof settings.offerHeight === "number" && settings.offerHeight > 0 ? settings.offerHeight : undefined;
  const offerTitleSize = settings.offerTitleSize && settings.offerTitleSize > 0 ? settings.offerTitleSize : 13;
  const offerTextSize = settings.offerTextSize && settings.offerTextSize > 0 ? settings.offerTextSize : 11;
  // A card, not a face in a circle: the portrait shape a phone video is. It
  // takes its width from the size the merchant set, but never less than a
  // name and a pill need.
  const tileW = Math.max(Math.round(size * 1.6), 96);
  const tileH = Math.round(tileW * 1.46);
  const tileR = shape === "square" ? 6 : 14;
  const autoplay = settings.autoplayReplays !== false;
  void ringW;
  void ringColor;
  void replayBadge;

  // The offer is addressed by name, so ask who is signed in. Signed out this
  // rejects, and the greeting simply loses the name — never a blocked screen.
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAccount()
      .then((a) => {
        if (alive) setName(a.name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // What each replay tile can play and say: its stream, its likes and how
  // many things were sold in it — asked once for the whole row.
  const [reels, setReels] = useState<Record<string, Reel>>({});
  useEffect(() => {
    if (!people.some((p) => reelIdOf(p.videoUrl))) return;
    let alive = true;
    fetchReels()
      .then((list) => {
        if (!alive) return;
        const byId: Record<string, Reel> = {};
        for (const r of list) byId[r.id] = r;
        setReels(byId);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.map((p) => p.videoUrl ?? "").join("|")]);

  const total = Math.max(0, Math.trunc((settings.offerMinutes ?? 10) * 60));
  const [left, setLeft] = useState(total);
  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const offerTitle = personalise(settings.offerTitle ?? "", name);
  const offerText = settings.offerText ?? "";
  const hasOffer = settings.offerEnabled !== false && Boolean(offerTitle || offerText);
  if (!people.length && !hasOffer) return null;

  /** A typed link wins over a collection: it is the more specific thing to set. */
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}

      {people.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {people.map((p, i) => {
            const borrowed = inherit(p, collections);
            const photo = p.imageUrl || borrowed.image;
            const onAirNow = p.onAir !== false;
            const reelId = reelIdOf(p.videoUrl);
            const reel = reelId ? reels[reelId] : undefined;
            const liveId = onAirNow ? p.id : reel ? reel.id : null;
            const likes = onAirNow ? p.likes ?? 0 : reel ? reel.likes : 0;
            const pieces = onAirNow ? p.pieces ?? 0 : reel ? reel.products.length : 0;
            return (
              <LiveTile
                key={p.id}
                width={tileW}
                height={tileH}
                radius={tileR}
                photo={photo || null}
                // Only the first few tiles play at once; a long row would
                // otherwise be a dozen videos nobody can see.
                video={autoplay && i < 4 && reel ? reel.recordingUrl : null}
                name={p.name || borrowed.title || ""}
                viewers={p.viewers || ""}
                onAir={onAirNow}
                liveLabel={liveLabel}
                badgeBg={badgeBg}
                badgeFg={badgeFg}
                nameSize={nameSize}
                viewersSize={viewersSize}
                pieces={pieces}
                liveId={liveId}
                likes={likes}
                onPress={() => {
                  // A live on air now is a broadcast, not a reel: it keeps the
                  // way in it always had.
                  if (p.onAir) return onOpenScreen?.("live:" + p.id);
                  // A recording opens in the app's own reels feed, on the reel
                  // it is - not a bare video file in the system browser.
                  if (reelId) return onOpenScreen?.("reel:" + reelId);
                  if (p.videoUrl) return onOpenScreen?.("reels");
                  go(p);
                }}
              />
            );
          })}

          {showReplays ? (
            <Pressable
              style={[styles.person, { width: Math.max(size + 12, 56) }]}
              onPress={() =>
                settings.replaysUrl || settings.replaysHandle || settings.replaysProductId || settings.replaysScreen
                  ? go({ url: settings.replaysUrl, handle: settings.replaysHandle, productId: settings.replaysProductId, screen: settings.replaysScreen })
                  : onOpenScreen?.("reels")
              }
            >
              <View style={[styles.replays, { width: size, height: size, borderRadius: photoRadius }]}>
                <Text style={[styles.replaysIcon, { fontSize: Math.round(size / 3.5) }]}>▶</Text>
              </View>
              <Text style={[styles.name, { fontSize: nameSize, color: colors.inkSoft }]} numberOfLines={1}>
                {settings.replaysLabel || "Replays"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {hasOffer ? (
        <Pressable
          style={[styles.offer, { backgroundColor: offerBg, borderRadius: bannerRadius, marginTop: offerGap, minHeight: offerHeight }]}
          onPress={() => go({ url: settings.offerUrl, handle: settings.offerHandle, productId: settings.offerProductId, screen: settings.offerScreen })}
        >
          <View style={{ flex: 1 }}>
            {offerTitle ? (
              <Text style={[styles.offerTitle, { color: offerFg, fontSize: offerTitleSize }]} numberOfLines={1}>
                {offerTitle}
              </Text>
            ) : null}
            {offerText ? (
              <Text style={[styles.offerText, { color: offerFg, fontSize: offerTextSize }]} numberOfLines={1}>
                {offerText}
              </Text>
            ) : null}
          </View>
          <View style={[styles.timer, { backgroundColor: timerBg, borderRadius: Math.min(bannerRadius, 10) }]}>
            <Text style={[styles.timerText, { color: timerFg, fontSize: offerTitleSize }]}>
              {pad(Math.floor(left / 60)) + ":" + pad(left % 60)}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </>
  );
}

/* ---- one tile: the video, what is written on it, and the cheer ------------ */
const CHEER = ["❤️", "🔥", "😍", "👏", "✨", "💖"];
type Face = { id: number; face: string; lean: number; size: number; delay: number; rise: Animated.Value };
let faceIds = 0;

function LiveTile({
  width,
  height,
  radius: r,
  photo,
  video,
  name,
  viewers,
  onAir,
  liveLabel,
  badgeBg,
  badgeFg,
  nameSize,
  viewersSize,
  pieces,
  liveId,
  likes,
  onPress,
}: {
  width: number;
  height: number;
  radius: number;
  photo: string | null;
  video: string | null;
  name: string;
  viewers: string;
  onAir: boolean;
  liveLabel: string;
  badgeBg: string;
  badgeFg: string;
  nameSize: number;
  viewersSize: number;
  pieces: number;
  liveId: string | null;
  likes: number;
  onPress: () => void;
}) {
  // The recording plays inside the tile, silently, from the stream.
  const player = useVideoPlayer(video, (pl) => {
    pl.loop = true;
    pl.muted = true;
    pl.play();
  });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => setPlaying(Boolean(e.isPlaying)));
    return () => sub.remove();
  }, [player]);

  const [count, setCount] = useState(likes);
  const [mine, setMine] = useState(false);
  const [faces, setFaces] = useState<Face[]>([]);
  useEffect(() => setCount(likes), [likes]);
  useEffect(() => {
    if (!liveId) return;
    AsyncStorage.getItem("reel_like_" + liveId)
      .then((v) => setMine(v === "1"))
      .catch(() => {});
  }, [liveId]);

  // Faces let go and rise the height of the tile, each leaning its own way.
  // Decoration only: they say nothing about how many are watching.
  const release = (many: number) => {
    const born: Face[] = Array.from({ length: many }, (_, i) => ({
      id: faceIds++,
      face: CHEER[Math.floor(Math.random() * CHEER.length)],
      lean: Math.round((Math.random() - 0.5) * 34),
      size: 11 + Math.round(Math.random() * 7),
      delay: Math.round(i * 55 + Math.random() * 240),
      rise: new Animated.Value(0),
    }));
    setFaces((all) => [...all, ...born].slice(-24));
    for (const f of born) {
      Animated.timing(f.rise, { toValue: 1, duration: 1800, delay: f.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
        setFaces((all) => all.filter((x) => x.id !== f.id)),
      );
    }
  };

  // A live tile with nothing moving reads as a photograph; a face drifts up
  // every second or so on its own.
  useEffect(() => {
    if (!liveId) return;
    let timer: ReturnType<typeof setTimeout>;
    const beat = () => {
      release(2 + Math.round(Math.random() * 2));
      timer = setTimeout(beat, 420 + Math.random() * 620);
    };
    timer = setTimeout(beat, Math.random() * 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  const tap = () => {
    if (!liveId) return;
    const on = !mine;
    setMine(on);
    setCount((n) => Math.max(0, n + (on ? 1 : -1)));
    (on ? AsyncStorage.setItem("reel_like_" + liveId, "1") : AsyncStorage.removeItem("reel_like_" + liveId)).catch(() => {});
    release(9);
    likeReel(liveId, on)
      .then((n) => setCount(n))
      .catch(() => {});
  };

  return (
    <View style={{ width, height, borderRadius: r, overflow: "hidden", backgroundColor: "#17120f" }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {video ? (
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0 }]}
            contentFit="cover"
            nativeControls={false}
          />
        ) : null}
        <Fade
          angle={0}
          colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
          locations={[0, 0.38, 1]}
          style={[styles.tileShade, { height: "64%" }]}
        />
        {onAir && liveLabel ? (
          <View style={[styles.liveBadge, { backgroundColor: badgeBg }]}>
            <View style={[styles.liveDot, { backgroundColor: badgeFg }]} />
            <Text style={[styles.liveBadgeText, { color: badgeFg }]}>{liveLabel.toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={styles.tileWords}>
          {name ? <Text style={[styles.tileName, { fontSize: nameSize + 1 }]} numberOfLines={1}>{name}</Text> : null}
          {viewers ? <Text style={[styles.tileViewers, { fontSize: viewersSize }]} numberOfLines={1}>{viewers}</Text> : null}
          {pieces > 0 ? (
            <View style={styles.piecesPill}>
              <Text style={[styles.piecesText, { fontSize: Math.max(8, viewersSize) }]} numberOfLines={1}>
                {onAir ? "Shop " + pieces + " piece" + (pieces === 1 ? "" : "s") : "+" + pieces + (pieces === 1 ? " piece" : " pieces")}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* The cheer rises from behind the heart; it is weather, not a control. */}
      <View pointerEvents="none" style={styles.cheer}>
        {faces.map((f) => (
          <Animated.Text
            key={f.id}
            style={{
              position: "absolute",
              fontSize: f.size,
              opacity: f.rise.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
              transform: [
                { translateY: f.rise.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.78] }) },
                { translateX: f.rise.interpolate({ inputRange: [0, 1], outputRange: [0, f.lean] }) },
              ],
            }}
          >
            {f.face}
          </Animated.Text>
        ))}
      </View>

      {liveId ? (
        <Pressable onPress={tap} style={styles.heart} hitSlop={8}>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path
              d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z"
              fill={mine ? colors.accent : "rgba(255,255,255,0.25)"}
              stroke={mine ? colors.accent : "#ffffff"}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {count > 0 ? <Text style={styles.heartCount}>{count > 999 ? Math.round(count / 100) / 10 + "k" : String(count)}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: gap.item, paddingVertical: spacing.sm },
  person: { alignItems: "center" },
  name: { marginTop: 7, fontWeight: "600", color: colors.ink, textAlign: "center" },
  replays: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.page },
  replaysIcon: { color: colors.inkSoft },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  liveBadge: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { width: 4, height: 4, borderRadius: 2 },
  liveBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  tileWords: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingBottom: 6 },
  tileName: { color: "#ffffff", fontWeight: "800" },
  tileViewers: { marginTop: 1, color: "rgba(255,255,255,0.75)" },
  piecesPill: { marginTop: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  piecesText: { color: "#ffffff", fontWeight: "700" },
  cheer: { position: "absolute", right: 28, bottom: 32, width: 0, height: 0 },
  heart: { position: "absolute", top: 6, right: 6, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: "rgba(0,0,0,0.35)" },
  heartCount: { color: "#ffffff", fontSize: 9, fontWeight: "800" },
  offer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 8 },
  offerTitle: { fontWeight: "700" },
  offerText: { opacity: 0.85 },
  timer: { paddingHorizontal: 8, paddingVertical: 4 },
  timerText: { fontWeight: "700" },
});
`,

    coming_up_live: `import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Session = { id: string; imageUrl?: string; title?: string; when?: string; handle?: string; url?: string };
export type ComingUpLiveSettings = {
  title?: string;
  remindLabel?: string;
  remindedLabel?: string;
  cardBg?: string;
  radius?: number;
  items?: Session[];
};

export function ComingUpLive({
  settings,
  lives,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: ComingUpLiveSettings;
  lives?: HomePayload["lives"];
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  // The lives actually scheduled, soonest first.
  const upcoming = (lives ?? []).filter((l) => l.status === "scheduled");
  const items: Session[] = [...upcoming]
        .sort((a, b) => String(a.scheduledAt ?? "").localeCompare(String(b.scheduledAt ?? "")))
        .map((l) => ({
          id: l.id,
          imageUrl: l.coverUrl ?? undefined,
          title: l.title,
          when: l.scheduledAt
            ? new Date(l.scheduledAt).toLocaleString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          url: l.href,
        }))

  // Remind me sets a reminder and stays put; the session itself opens its collection.
  const [reminded, setReminded] = useState<string[]>([]);
  if (!items.length) return null;

  /** A typed link wins over a collection: it is the more specific thing to set. */
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });

  const r = settings.radius && settings.radius > 0 ? settings.radius : radius.lg;
  const bg = settings.cardBg || colors.surface;
  const remind = settings.remindLabel || "Remind me";

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      <View style={[styles.card, { backgroundColor: bg, borderRadius: r }]}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          return (
            <View key={i.id} style={styles.row}>
              <Pressable style={styles.session} onPress={() => go(i)}>
                {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{i.title || borrowed.title}</Text>
                  {i.when ? <Text style={styles.when} numberOfLines={1}>{i.when}</Text> : null}
                </View>
              </Pressable>
              {remind ? (
                <Pressable
                  style={[styles.remind, reminded.includes(i.id) ? styles.remindOn : null]}
                  onPress={() =>
                    setReminded((cur) => (cur.includes(i.id) ? cur.filter((x) => x !== i.id) : [...cur, i.id]))
                  }
                >
                  <Text style={[styles.remindText, reminded.includes(i.id) ? styles.remindTextOn : null]}>
                    {reminded.includes(i.id) ? "✓ " + (settings.remindedLabel || "Reminder set") : remind}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: gap.item },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.page },
  title: { fontSize: 12, fontWeight: "700", color: colors.ink },
  when: { fontSize: 11, color: colors.inkSoft },
  session: { flex: 1, flexDirection: "row", alignItems: "center", gap: gap.item },
  remind: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },
  remindOn: { backgroundColor: colors.surface },
  remindText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  remindTextOn: { color: colors.accent },
});
`,

    countdown_deals: `import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing, theme } from "../theme";
import { inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Deal = {
  id: string;
  imageUrl?: string;
  badge?: string;
  price?: string;
  comparePrice?: string;
  claimed?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
};
export type CountdownDealsSettings = {
  /** Whether the first item is shown big, above the rest. */
  featureFirst?: boolean;
  title?: string;
  endsInMinutes?: number;
  showTimer?: boolean;
  showClaimed?: boolean;
  badgeBg?: string;
  radius?: number;
  items?: Deal[];
};

const two = (n: number) => (n < 10 ? "0" + n : String(n));

export function CountdownDeals({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: CountdownDealsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.price || i.imageUrl || i.handle);
  const total = Math.max(0, Math.trunc((settings.endsInMinutes ?? 135) * 60));
  const [left, setLeft] = useState(total);
  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  if (!items.length) return null;

  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });

  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const badgeBg = settings.badgeBg || colors.accent;
  const parts = [two(Math.floor(left / 3600)), two(Math.floor((left % 3600) / 60)), two(left % 60)];
  const units = ["H", "M", "S"];

  return (
    <>
      <View style={styles.head}>
        <Text style={styles.heading} numberOfLines={1}>{settings.title ?? ""}</Text>
        {settings.showTimer !== false ? (
          <View style={[styles.timer, { backgroundColor: colors.accent + "14" }]}>
            <View
              style={[styles.dot, { backgroundColor: colors.accent, opacity: left % 2 === 0 ? 1 : 0.3 }]}
            />
            {parts.map((p, i) => (
              <View key={i} style={styles.tickWrap}>
                {i > 0 ? <Text style={[styles.colon, { color: colors.accent }]}>:</Text> : null}
                <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                  <Text style={styles.tickText}>{p}</Text>
                  <Text style={styles.tickUnit}>{units[i]}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i, idx) => {
          const lead = settings.featureFirst === true && idx === 0;
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const pct = Math.max(0, Math.min(100, parseInt(i.claimed ?? "", 10) || 0));
          const shot = [styles.photo, { height: lead ? 176 : 124 }];
          return (
            <Pressable
              key={i.id}
              style={[styles.card, { borderRadius: r, width: lead ? 224 : 158 }]}
              onPress={() => go(i)}
            >
              <View>
                {photo ? <Image source={{ uri: photo }} style={shot} /> : <View style={shot} />}
                {i.badge ? (
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={styles.badgeText}>{i.badge}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.body}>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{i.price}</Text>
                  {i.comparePrice ? <Text style={styles.was}>{i.comparePrice}</Text> : null}
                </View>
                {settings.showClaimed !== false && i.claimed ? (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: pct + "%" }]} />
                    </View>
                    <Text style={styles.claimed}>{i.claimed}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heading: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  timer: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingLeft: 6, paddingRight: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 2 },
  tickWrap: { flexDirection: "row", alignItems: "center" },
  colon: { fontSize: 11, fontWeight: "700", opacity: 0.4, paddingHorizontal: 3, paddingBottom: 4 },
  tick: { alignItems: "center", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  tickText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  tickUnit: { fontSize: 7, fontWeight: "600", color: "#fff", opacity: 0.75, marginTop: 2 },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 158, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  photo: { width: "100%", height: 120, backgroundColor: theme.card.photoBg },
  badge: { position: "absolute", top: 6, left: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  body: { padding: 8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  price: { fontSize: 13, fontWeight: "700", color: colors.accent },
  was: { fontSize: 10, color: colors.inkSoft, textDecorationLine: "line-through" },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.page, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  claimed: { marginTop: 4, fontSize: 9, color: colors.inkSoft },
});
`,

    info_rows: `import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type InfoRow = {
  id: string;
  emoji?: string;
  title?: string;
  subtitle?: string;
  note?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
};
export type InfoRowsSettings = { title?: string; cardBg?: string; radius?: number; items?: InfoRow[] };

export function InfoRows({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: InfoRowsSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.title);
  if (!items.length) return null;

  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });

  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const bg = settings.cardBg || colors.surface;

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      <View style={{ marginTop: spacing.sm, gap: gap.itemTight }}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            style={[styles.row, { backgroundColor: bg, borderRadius: r }]}
            onPress={() => go(i)}
          >
            {i.emoji ? (
              <View style={styles.icon}>
                <Text style={styles.iconText}>{i.emoji}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{i.title}</Text>
              {i.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{i.subtitle}</Text> : null}
            </View>
            {i.note ? <Text style={styles.note}>{i.note}</Text> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: gap.item, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10 },
  icon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.page },
  iconText: { fontSize: 16 },
  title: { fontSize: 12, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  note: { fontSize: 11, fontWeight: "600", color: colors.accent },
});
`,

    shipping_goal: `import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export type ShippingGoalSettings = {
  title?: string;
  subtitle?: string;
  startLabel?: string;
  endLabel?: string;
  percent?: number;
  barColor?: string;
  cardBg?: string;
  radius?: number;
};

export function ShippingGoal({ settings }: { settings: ShippingGoalSettings }) {
  if (!settings.title && !settings.subtitle) return null;
  const pct = Math.max(0, Math.min(100, typeof settings.percent === "number" ? settings.percent : 100));
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  return (
    <View style={[styles.card, { backgroundColor: settings.cardBg || colors.surface, borderRadius: r }]}>
      {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct + "%", backgroundColor: settings.barColor || colors.accent }]} />
      </View>
      {settings.startLabel || settings.endLabel ? (
        <View style={styles.ends}>
          <Text style={styles.end}>{settings.startLabel}</Text>
          <Text style={styles.end}>{settings.endLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  title: { fontSize: 12, fontWeight: "700", color: colors.ink },
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.inkSoft },
  track: { marginTop: spacing.sm, height: 8, borderRadius: 4, backgroundColor: colors.page, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  ends: { marginTop: 4, flexDirection: "row", justifyContent: "space-between" },
  end: { fontSize: 10, color: colors.inkSoft },
});
`,

    payment_plans: `import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing, theme } from "../theme";
import { openLink, type LinkTo } from "./Pieces";

export type Plan = { id: string; name?: string; headline?: string; note?: string; color?: string; handle?: string; url?: string };
export type PaymentPlansSettings = {
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllProductId?: string;
  seeAllScreen?: string;
  seeAllUrl?: string;
  radius?: number;
  items?: Plan[];
};

export function PaymentPlans({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: PaymentPlansSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.name || i.headline);
  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go({ url: settings.seeAllUrl, handle: settings.seeAllHandle, productId: settings.seeAllProductId, screen: settings.seeAllScreen })}>
            <Text style={styles.seeAll}>{settings.seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            style={[styles.card, { backgroundColor: i.color || colors.accent, borderRadius: r }]}
            onPress={() => go(i)}
          >
            {i.name ? <Text style={styles.name}>{i.name}</Text> : null}
            {i.headline ? <Text style={styles.headline}>{i.headline}</Text> : null}
            {i.note ? <Text style={styles.note}>{i.note}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 152, padding: 12 },
  name: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  headline: { marginTop: 4, fontSize: 15, fontWeight: "700", color: "#fff" },
  note: { marginTop: 4, fontSize: 10, lineHeight: 14, color: "rgba(255,255,255,0.75)" },
});
`,

    price_slider: `import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type InstalmentPlan = {
  id: string;
  logo?: string;
  name?: string;
  months?: string;
  badge?: string;
  /** Several promises on one line, split on a middle dot, comma or bar. */
  perks?: string;
  color?: string;
};
export type PriceSliderSettings = {
  title?: string;
  subtitle?: string;
  priceLabel?: string;
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  startPrice?: number;
  cardBg?: string;
  radius?: number;
  items?: InstalmentPlan[];
};

const nf = (n: number) => {
  const digits = String(Math.round(n));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
};

export function PriceSlider({ settings }: { settings: PriceSliderSettings }) {
  const items = (settings.items ?? []).filter((i) => i.name && i.months);
  const min = settings.minPrice && settings.minPrice > 0 ? settings.minPrice : 2999;
  const max = Math.max(min + 1, settings.maxPrice && settings.maxPrice > 0 ? settings.maxPrice : 16000);
  const start = Math.min(max, Math.max(min, settings.startPrice && settings.startPrice > 0 ? settings.startPrice : 7750));
  const [price, setPrice] = useState(start);
  const [width, setWidth] = useState(0);
  if (!items.length) return null;

  const cur = settings.currency || "EGP";
  /**
   * Which plan is being read, and the rest as marks under it.
   *
   * Three providers written out in full is three of everything, and a shopper
   * comparing them has to hold two in her head while she reads the third. One
   * at a time, with the others as their own logos underneath, is the same
   * information in a third of the height: tap a mark and it takes the place of
   * the one above.
   */
  const [pick, setPick] = useState(0);
  const at = Math.min(pick, Math.max(0, items.length - 1));
  const lead = items[at];
  const rest = items.filter((_, n) => n !== at);
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const pct = ((price - min) / (max - min)) * 100;

  // Core React Native has no slider, and pulling one in would be a dependency
  // the merchant's app has not declared. The track is its own responder, so
  // locationX is already relative to it.
  const setFromX = (x: number) => {
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    setPrice(Math.round(min + ratio * (max - min)));
  };

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <View style={[styles.card, { backgroundColor: settings.cardBg || colors.surface, borderRadius: r }]}>
        {settings.priceLabel ? <Text style={styles.priceLabel}>{settings.priceLabel}</Text> : null}
        <Text style={styles.price}>{cur + " " + nf(price)}</Text>

        <View
          style={styles.track}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
          onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
        >
          <View style={[styles.fill, { width: pct + "%" }]} />
          <View style={[styles.knob, { left: pct + "%" }]} />
        </View>
        <View style={styles.ends}>
          <Text style={styles.end}>{cur + " " + nf(min)}</Text>
          <Text style={styles.end}>{cur + " " + nf(max)}</Text>
        </View>

        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {[lead].filter(Boolean).map((i) => {
            const months = Math.max(1, parseInt(i.months ?? "", 10) || 1);
            return (
              <View key={i.id} style={styles.row}>
                <View style={styles.provider}>
                  {i.logo ? (
                    <Image source={{ uri: i.logo }} style={styles.logo} resizeMode="contain" accessibilityLabel={i.name} />
                  ) : (
                    <Text style={styles.providerName} numberOfLines={1}>{i.name}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.monthly}>{cur + " " + nf(price / months) + " / month"}</Text>
                  <Text style={styles.months}>{months + " months"}</Text>
                  {i.perks ? (
                    <View style={styles.perks}>
                      {i.perks
                        .split(/[·,|]/)
                        .map((p) => p.trim())
                        .filter(Boolean)
                        .map((p) => (
                          <View key={p} style={[styles.perk, { backgroundColor: (i.color || colors.accent) + "14" }]}>
                            <Text style={[styles.perkText, { color: i.color || colors.accent }]}>{p}</Text>
                          </View>
                        ))}
                    </View>
                  ) : null}
                </View>
                {i.badge ? (
                  <View style={[styles.badge, { backgroundColor: (i.color || colors.accent) + "1f" }]}>
                    <Text style={[styles.badgeText, { color: i.color || colors.accent }]}>{i.badge}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* The others, as their own marks. Four to a row is the ceiling, not
              the target: two laid out in four columns sit in the left half of
              the card looking like two more are missing. */}
          {rest.length > 0 ? (
            <View style={styles.marks}>
              {rest.map((i) => (
                <Pressable
                  key={i.id}
                  style={styles.mark}
                  onPress={() => setPick(items.indexOf(i))}
                  accessibilityLabel={i.name}
                >
                  {i.logo ? (
                    <Image source={{ uri: i.logo }} style={styles.markLogo} resizeMode="contain" />
                  ) : (
                    <Text style={styles.markName} numberOfLines={1}>{i.name}</Text>
                  )}
                  <Text style={styles.markPrice} numberOfLines={1}>
                    {nf(price / Math.max(1, parseInt(i.months ?? "", 10) || 1)) + "/mo"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  card: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  priceLabel: { fontSize: 11, color: colors.inkSoft },
  price: { fontSize: 20, fontWeight: "700", color: colors.accent },
  track: { marginTop: spacing.sm, height: 24, justifyContent: "center" },
  fill: { position: "absolute", height: 6, borderRadius: 3, backgroundColor: colors.accent },
  knob: { position: "absolute", width: 16, height: 16, borderRadius: 8, marginLeft: -8, backgroundColor: colors.accent },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  end: { fontSize: 10, color: colors.inkSoft },
  row: { flexDirection: "row", alignItems: "center", gap: gap.item, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  marks: { flexDirection: "row", gap: 6 },
  mark: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 6, backgroundColor: colors.surface },
  markLogo: { width: "100%", height: 16 },
  markName: { fontSize: 9, fontWeight: "700", color: colors.inkMuted },
  markPrice: { fontSize: 9, fontWeight: "600", color: colors.inkSoft },
  provider: { width: 56, height: 36, justifyContent: "center", alignItems: "center" },
  providerName: { width: 56, fontSize: 11, fontWeight: "600", color: colors.inkMuted },
  logo: { width: 56, height: 36 },
  perks: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  perk: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  perkText: { fontSize: 9, fontWeight: "600" },
  monthly: { fontSize: 13, fontWeight: "700", color: colors.accent },
  months: { fontSize: 10, color: colors.inkSoft },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: "600" },
});
`,

    offer_cards: `import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Offer = { id: string; badge?: string; title?: string; subtitle?: string; color?: string; handle?: string; url?: string };
export type OfferCardsSettings = {
  title?: string;
  subtitle?: string;
  claimLabel?: string;
  radius?: number;
  items?: Offer[];
};

export function OfferCards({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: OfferCardsSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.badge || i.title);
  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const claim = settings.claimLabel || "Claim";

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => {
          const colour = i.color || colors.accent;
          return (
            <View key={i.id} style={[styles.card, { borderColor: colour, backgroundColor: colour + "0f", borderRadius: r }]}>
              {i.badge ? <Text style={[styles.badge, { color: colour }]}>{i.badge}</Text> : null}
              {i.title ? <Text style={styles.title}>{i.title}</Text> : null}
              {i.subtitle ? <Text style={styles.detail}>{i.subtitle}</Text> : null}
              {claim ? (
                <Pressable style={[styles.cta, { backgroundColor: colour }]} onPress={() => go(i)}>
                  <Text style={styles.ctaText}>{claim}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 152, borderWidth: 1, borderStyle: "dashed", padding: 12, gap: 4 },
  badge: { fontSize: 20, fontWeight: "700" },
  title: { fontSize: 11, fontWeight: "700", color: colors.ink },
  detail: { fontSize: 10, lineHeight: 14, color: colors.inkSoft },
  cta: { marginTop: 4, borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  ctaText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,

    product_reasons: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing, theme } from "../theme";
import { inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Suggestion = {
  id: string;
  imageUrl?: string;
  reason?: string;
  name?: string;
  price?: string;
  comparePrice?: string;
  badge?: string;
  rating?: string;
  sold?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
};
export type ProductReasonsSettings = {
  /** Whether the first item is shown big, above the rest. */
  featureFirst?: boolean;
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllProductId?: string;
  seeAllScreen?: string;
  seeAllUrl?: string;
  buttonLabel?: string;
  radius?: number;
  items?: Suggestion[];
};

export function ProductReasons({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: ProductReasonsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.name || i.imageUrl || i.handle);
  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go({ url: settings.seeAllUrl, handle: settings.seeAllHandle, productId: settings.seeAllProductId, screen: settings.seeAllScreen })}>
            <Text style={styles.seeAll}>{settings.seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i, idx) => {
          const lead = settings.featureFirst === true && idx === 0;
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const shot = [styles.photo, { height: lead ? 196 : 136 }];
          return (
            <View key={i.id} style={[styles.card, { borderRadius: r, width: lead ? 236 : 166 }]}>
              <Pressable onPress={() => go(i)}>
                {photo ? <Image source={{ uri: photo }} style={shot} /> : <View style={shot} />}
                {i.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{i.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.body}>
                {i.reason ? <Text style={styles.reason} numberOfLines={1}>{i.reason}</Text> : null}
                <Text style={styles.name} numberOfLines={2}>{i.name || borrowed.title}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{i.price}</Text>
                  {i.comparePrice ? <Text style={styles.was}>{i.comparePrice}</Text> : null}
                </View>
                {i.rating || i.sold ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {(i.rating ? "* " + i.rating + "  " : "") + (i.sold ?? "")}
                  </Text>
                ) : null}
                {settings.buttonLabel ? (
                  <Pressable style={styles.cta} onPress={() => go(i)}>
                    <Text style={styles.ctaText}>{settings.buttonLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  card: { width: 166, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  photo: { width: "100%", height: 136, backgroundColor: colors.page },
  badge: { position: "absolute", top: 6, right: 6, borderRadius: 4, backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  body: { padding: 8 },
  reason: { fontSize: 9, fontWeight: "600", color: colors.accent },
  name: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink },
  priceRow: { marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 4 },
  price: { fontSize: 12, fontWeight: "700", color: colors.accent },
  was: { fontSize: 10, color: colors.inkSoft, textDecorationLine: "line-through" },
  meta: { marginTop: 2, fontSize: 9, color: colors.inkSoft },
  cta: { marginTop: 8, borderRadius: 8, backgroundColor: colors.accent, paddingVertical: 6, alignItems: "center" },
  ctaText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,

    circle_row: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing, theme } from "../theme";
import { inherit, openLink, type LinkTo } from "./Pieces";
import type { HomePayload } from "../api";

export type Circle = { id: string; imageUrl?: string; label?: string; note?: string; handle?: string; url?: string };

/** A rail that scrolls, or a row that wraps. */
function Rail({ grid, children }: { grid: boolean; children: React.ReactNode }) {
  if (grid) return <View style={styles.grid}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}
export type CircleRowSettings = {
  perRow?: number;
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllProductId?: string;
  seeAllScreen?: string;
  seeAllUrl?: string;
  size?: number;
  showLabel?: boolean;
  showNote?: boolean;
  /** "circle", "rounded" or "square". */
  shape?: string;
  /** Corner radius for a rounded tile. */
  radius?: number;
  titleSize?: number;
  labelSize?: number;
  labelBold?: boolean;
  labelColor?: string;
  linkColor?: string;
  /** Paints the whole section, edge to edge. */
  bg?: string;
  items?: Circle[];
};

export function CircleRow({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: CircleRowSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.imageUrl || i.label || i.handle);
  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const size = settings.size && settings.size > 0 ? settings.size : 76;
  const cell = Math.max(size + 14, 56);
  // Nought is a rail. Anything else is a grid that many across, with the
  // tiles taking the width their column gives them.
  const perRow = Math.max(0, Math.min(6, Number(settings.perRow || 0)));
  const grid = perRow > 0;
  const shape = settings.shape ?? "circle";
  const tileRadius =
    shape === "square" ? 0 : shape === "rounded" ? (settings.radius && settings.radius > 0 ? settings.radius : 22) : Math.round(size / 2);
  const titleSize = settings.titleSize && settings.titleSize > 0 ? settings.titleSize : 16;
  const linkSize = titleSize <= 16 ? 12 : Math.round(titleSize * 0.82);
  const labelSize = settings.labelSize && settings.labelSize > 0 ? settings.labelSize : 10;

  return (
    <View
      style={
        settings.bg
          ? { backgroundColor: settings.bg, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }
          : undefined
      }
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={[styles.title, { fontSize: titleSize }]}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go({ url: settings.seeAllUrl, handle: settings.seeAllHandle, productId: settings.seeAllProductId, screen: settings.seeAllScreen })}>
            <Text style={[styles.seeAll, { fontSize: linkSize }, settings.linkColor ? { color: settings.linkColor } : null]}>
              {settings.seeAllLabel + " \u203A"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Rail grid={grid}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const round = grid
            ? { width: "100%" as const, aspectRatio: 1, borderRadius: tileRadius }
            : { width: size, height: size, borderRadius: tileRadius };
          return (
            <Pressable
              key={i.id}
              style={[styles.cell, grid ? { width: (100 / perRow) + "%", paddingHorizontal: 4 } : { width: cell }]}
              onPress={() => go(i)}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={round} />
              ) : (
                <View style={[round, { backgroundColor: colors.page }]} />
              )}
              {settings.showNote !== false && i.note ? (
                <Text style={styles.note} numberOfLines={1}>{i.note}</Text>
              ) : null}
              {settings.showLabel !== false ? (
                <Text
                  style={[
                    styles.label,
                    { fontSize: labelSize, marginTop: 6 },
                    settings.labelBold ? { fontWeight: "600" } : null,
                    settings.labelColor ? { color: settings.labelColor } : null,
                  ]}
                  numberOfLines={1}
                >
                  {i.label || borrowed.title}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  cell: { alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, rowGap: gap.item },
  note: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.accent, textAlign: "center" },
  label: { fontSize: 10, color: colors.inkSoft, textAlign: "center" },
});
`,

    pick_colour: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing, theme } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Swatch = {
  id: string;
  color?: string;
  label?: string;
  imageUrl?: string;
  line1?: string;
  line2?: string;
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};
export type PickColourSettings = {
  style?: string;
  title?: string;
  subtitle?: string;
  size?: number;
  eyebrow?: string;
  linkLabel?: string;
  pillText?: string;
  pillCta?: string;
  pillHandle?: string;
  pillUrl?: string;
  pillProductId?: string;
  pillScreen?: string;
  titleSize?: number;
  imageHeight?: number;
  cardWidth?: number;
  swatchSize?: number;
  radius?: number;
  bg?: string;
  cardBg?: string;
  inkColor?: string;
  mutedColor?: string;
  accentColor?: string;
  lineColor?: string;
  pillBg?: string;
  items?: Swatch[];
};

export function PickColour({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: PickColourSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.color);
  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  if (settings.style === "palette") return <Palette settings={settings} items={items} go={go} />;
  const size = settings.size && settings.size > 0 ? settings.size : 44;

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => (
          <Pressable key={i.id} style={[styles.cell, { width: size + 16 }]} onPress={() => go(i)}>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: Math.round(size / 2),
                backgroundColor: i.color,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            />
            {i.label ? <Text style={styles.label} numberOfLines={1}>{i.label}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const num = (v: number | undefined, fallback: number) => (typeof v === "number" && v > 0 ? v : fallback);

/** Shop by palette: the website's section - photo cards with a swatch on their edge. */
function Palette({ settings, items, go }: { settings: PickColourSettings; items: Swatch[]; go: (to: LinkTo) => void }) {
  const ink = settings.inkColor || "#211a15";
  const muted = settings.mutedColor || "#74685e";
  const caramel = settings.accentColor || "#9d6540";
  const line = settings.lineColor || "#e0d4c4";
  const r = typeof settings.radius === "number" && settings.radius >= 0 ? settings.radius : 12;
  const h = num(settings.imageHeight, 104);
  const w = num(settings.cardWidth, 0);
  const sw = num(settings.swatchSize, 22);
  const link = settings.linkLabel || "Shop now";
  const pill = {
    handle: settings.pillHandle,
    url: settings.pillUrl,
    productId: settings.pillProductId,
    screen: settings.pillScreen,
  };

  const cards = items.map((i) => (
    <Pressable
      key={i.id}
      onPress={() => go(i)}
      style={[styles.card, w ? { width: w } : { flex: 1 }, { borderRadius: r, backgroundColor: settings.cardBg || "#fffdfa", borderColor: line }]}
    >
      {i.imageUrl ? (
        <Image source={{ uri: i.imageUrl }} style={{ width: "100%", height: h }} resizeMode="cover" />
      ) : (
        <View style={{ width: "100%", height: h, backgroundColor: i.color }} />
      )}
      <View style={[styles.swatch, { width: sw, height: sw, borderRadius: sw / 2, marginTop: -sw / 2, backgroundColor: i.color }]} />
      <View style={styles.cardBody}>
        {i.label ? <Text style={[styles.cardTitle, { color: ink }]}>{i.label.toUpperCase()}</Text> : null}
        {i.line1 ? <Text style={[styles.cardLines, { color: muted }]}>{i.line1}</Text> : null}
        {i.line2 ? <Text style={[styles.cardLines, styles.cardLine2, { color: muted }]}>{i.line2}</Text> : null}
        <Text style={[styles.cardLink, { color: ink }]}>{link.toUpperCase()}</Text>
      </View>
    </Pressable>
  ));

  return (
    <View style={[styles.panel, { backgroundColor: settings.bg || "#f6f0e8" }]}>
      {settings.eyebrow ? <Text style={[styles.eyebrow, { color: caramel }]}>{settings.eyebrow.toUpperCase()}</Text> : null}
      {settings.title ? (
        <Text style={[styles.paletteTitle, { color: ink, fontSize: num(settings.titleSize, 28) }]}>{settings.title}</Text>
      ) : null}
      {settings.subtitle ? <Text style={[styles.paletteSub, { color: muted }]}>{settings.subtitle}</Text> : null}
      {w ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsScroll}>
          {cards}
        </ScrollView>
      ) : (
        <View style={styles.cardsRow}>{cards}</View>
      )}
      {settings.pillText || settings.pillCta ? (
        <Pressable onPress={() => go(pill)} style={[styles.pill, { backgroundColor: settings.pillBg || "#f1e7d9", borderColor: line }]}>
          {settings.pillText ? (
            <Text style={[styles.pillText, { color: muted }]}>
              <Text style={{ color: caramel }}>{"✦ "}</Text>
              {settings.pillText}
            </Text>
          ) : null}
          {settings.pillCta ? <Text style={[styles.pillCta, { color: ink }]}>{settings.pillCta.toUpperCase() + " →"}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  row: { gap: gap.item, paddingVertical: spacing.sm },
  cell: { alignItems: "center", gap: 4 },
  label: { fontSize: 10, color: colors.inkMuted, textAlign: "center" },

  panel: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.sm, paddingVertical: 20 },
  eyebrow: { fontSize: 10, fontWeight: "600", letterSpacing: 2.2, textAlign: "center" },
  paletteTitle: { marginTop: 6, textAlign: "center", fontFamily: theme.titleFont },
  paletteSub: { marginTop: 8, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.lg },
  cardsRow: { flexDirection: "row", gap: 5, marginTop: 16 },
  cardsScroll: { gap: 6, marginTop: 16 },
  card: { overflow: "hidden", borderWidth: 1 },
  swatch: { alignSelf: "center", borderWidth: 2, borderColor: "#fffdfa" },
  cardBody: { alignItems: "center", paddingHorizontal: 4, paddingTop: 6, paddingBottom: 8, flex: 1 },
  cardTitle: { fontSize: 8.5, letterSpacing: 0.7, textAlign: "center", fontFamily: theme.titleFont },
  cardLines: { marginTop: 4, fontSize: 7.5, lineHeight: 10, textAlign: "center" },
  cardLine2: { marginTop: 0 },
  cardLink: { marginTop: 6, fontSize: 7, fontWeight: "700", letterSpacing: 0.6, textDecorationLine: "underline" },
  pill: { marginTop: 20, marginHorizontal: spacing.sm, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", gap: 4 },
  pillText: { fontSize: 11 },
  pillCta: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5 },
});
`,

    price_drop: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { openLink } from "./Pieces";

export type DropThumb = { id: string; imageUrl?: string };
export type PriceDropSettings = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
  cardBg?: string;
  radius?: number;
  items?: DropThumb[];
};

export function PriceDrop({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: PriceDropSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  if (!settings.title && !settings.subtitle) return null;
  const go = () => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen });
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const thumbs = (settings.items ?? []).filter((i) => i.imageUrl).slice(0, 3);

  return (
    <View style={[styles.card, { backgroundColor: settings.cardBg || colors.surface, borderRadius: r }]}>
      {thumbs.length ? (
        <View style={styles.thumbs}>
          {thumbs.map((t) => (
            <Image key={t.id} source={{ uri: t.imageUrl }} style={styles.thumb} />
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {settings.title ? <Text style={styles.title} numberOfLines={1}>{settings.title}</Text> : null}
        {settings.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{settings.subtitle}</Text> : null}
      </View>
      {settings.buttonLabel ? (
        <Pressable style={styles.cta} onPress={go}>
          <Text style={styles.ctaText}>{settings.buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  thumbs: { flexDirection: "row" },
  thumb: { width: 30, height: 30, borderRadius: 8, marginRight: -8, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.page },
  title: { fontSize: 12, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  cta: { borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },
  ctaText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,

    style_profile: `import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { colors, spacing, theme } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Tag = { id: string; label?: string; color?: string; handle?: string; url?: string };
export type StyleProfileSettings = {
  title?: string;
  subtitle?: string;
  cardTitle?: string;
  cardSubtitle?: string;
  footNote?: string;
  cardBg?: string;
  radius?: number;
  style?: string;
  kicker?: string;
  glyph?: string;
  deepFrom?: string;
  deepTo?: string;
  gold?: string;
  onDeep?: string;
  onDeepSoft?: string;
  items?: Tag[];
} & LinkTo;

/** Put the shopper name in, or take the token out. */
function personalise(template: string, name: string | null): string {
  const first = String(name ?? "").trim().split(" ")[0] ?? "";
  if (first) return template.split("{name}").join(first);
  let out = template.split("{name}").join("").trim();
  // A possessive reads as "'s profile" once the name is gone, so the
  // apostrophe leaves with it rather than dangling at the front of the line.
  if (out.startsWith("'s ") || out.startsWith("’s ")) out = out.slice(3).trim();
  if (out === "'s" || out === "’s") out = "";
  while (out.startsWith(",") || out.startsWith("،")) out = out.slice(1).trim();
  return out ? out[0].toUpperCase() + out.slice(1) : "";
}

export function StyleProfile({
  settings,
  shopperName,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: StyleProfileSettings;
  shopperName?: string | null;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.label);
  const cardTitle = personalise(settings.cardTitle ?? "", shopperName ?? null);
  if (!items.length && !cardTitle) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  // The club's own colours, so a shopper's taste sits on the same card her
  // status does rather than on a settings panel.
  const society = settings.style !== "plain";
  const deep = settings.deepFrom || "#2b2119";
  const deepTo = settings.deepTo || "#43301f";
  const gold = settings.gold || "#e0b877";
  const onDeep = settings.onDeep || "#f0e6d8";
  const onDeepSoft = settings.onDeepSoft || "#c9b79f";
  const opens = Boolean(settings.handle || settings.url || settings.productId || settings.screen);
  const kicker = settings.kicker || "Your society";
  const glyph = settings.glyph || "✦";

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <View
        style={[
          styles.card,
          society
            ? { backgroundColor: deep, borderColor: gold + "3d", borderRadius: r }
            : { backgroundColor: settings.cardBg || colors.surface, borderColor: colors.line, borderRadius: r },
        ]}
      >
        {society ? (
          <Fade angle={135} colors={[deep, deep, deepTo]} locations={[0, 0.45, 1]} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
        ) : null}
        {society && kicker ? (
          <Text style={[styles.kicker, { color: gold }]}>{(glyph ? glyph + " " : "") + kicker.toUpperCase()}</Text>
        ) : null}
        {cardTitle ? (
          <Pressable disabled={!opens} onPress={() => go(settings)}>
            <Text
              style={[
                styles.cardTitle,
                society ? { color: onDeep, fontSize: 17, fontFamily: theme.titleFont } : null,
              ]}
            >
              {cardTitle}
            </Text>
          </Pressable>
        ) : null}
        {settings.cardSubtitle ? (
          <Text style={[styles.cardSubtitle, society ? { color: onDeepSoft } : null]}>{settings.cardSubtitle}</Text>
        ) : null}
        <View style={styles.tags}>
          {items.map((i) => (
            <Pressable
              key={i.id}
              style={[
                styles.tag,
                society
                  ? { borderColor: i.color ? i.color + "aa" : gold + "59", backgroundColor: i.color ? i.color + "1f" : gold + "14" }
                  : { borderColor: i.color || colors.line },
              ]}
              onPress={() => go(i)}
            >
              <Text style={[styles.tagText, { color: i.color || (society ? onDeep : colors.inkMuted) }]}>{i.label}</Text>
            </Pressable>
          ))}
        </View>
        {settings.footNote ? (
          <Text style={[styles.foot, society ? { color: onDeepSoft } : null]}>{settings.footNote}</Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  card: { marginTop: spacing.sm, borderWidth: 1, padding: 16, overflow: "hidden" },
  wash: { position: "absolute", right: -40, bottom: -60, height: 170, width: 170, borderRadius: 85, opacity: 0.55 },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.8 },
  cardTitle: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 11, color: colors.inkSoft },
  tags: { marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: "500" },
  foot: { marginTop: spacing.sm, fontSize: 11, color: colors.inkSoft },
});
`,

    promo_card: `import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { colors, spacing } from "../theme";
import { openLink } from "./Pieces";

export type PromoCardSettings = {
  style?: string;
  kicker?: string;
  title?: string;
  body?: string;
  price?: string;
  worth?: string;
  stockNote?: string;
  buttonLabel?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
  imageUrl?: string;
  bg?: string;
  bg2?: string;
  glow?: string;
  textColor?: string;
  radius?: number;
  height?: number;
};

type Openers = {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
};

export function PromoCard({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: { settings: PromoCardSettings } & Openers) {
  if (!settings.title && !settings.body) return null;
  const go = () => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen });
  if (settings.style === "banner") return <MysteryBanner settings={settings} onOpen={go} />;
  const r = settings.radius && settings.radius > 0 ? settings.radius : 16;
  const bg = settings.bg || colors.accent;
  const ink = settings.textColor || "#ffffff";

  return (
    <View style={{ backgroundColor: bg, borderRadius: r, overflow: "hidden" }}>
      {settings.imageUrl ? <Image source={{ uri: settings.imageUrl }} style={styles.photo} /> : null}
      <View style={styles.body}>
        {settings.title ? <Text style={[styles.title, { color: ink }]}>{settings.title}</Text> : null}
        {settings.body ? <Text style={[styles.text, { color: ink }]}>{settings.body}</Text> : null}
        {settings.buttonLabel ? (
          <Pressable style={[styles.cta, { backgroundColor: ink }]} onPress={go}>
            <Text style={[styles.ctaText, { color: bg }]}>{settings.buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** The mystery box as a banner: a night gradient and a glowing gift box. */
function MysteryBanner({ settings, onOpen }: { settings: PromoCardSettings; onOpen: () => void }) {
  const bg = settings.bg || "#2b1b10";
  const bg2 = settings.bg2 || colors.accent;
  const glow = settings.glow || "#e0b877";
  const ink = settings.textColor || "#ffffff";
  const r = settings.radius && settings.radius > 0 ? settings.radius : 20;
  const h = settings.height && settings.height > 0 ? settings.height : 196;

  // The lid and the question mark bob gently, as if something inside is waking.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <Pressable onPress={onOpen} style={[styles.banner, { minHeight: h, borderRadius: r, backgroundColor: bg }]}>
      <Fade angle={135} colors={[bg, bg, bg2]} locations={[0, 0.4, 1]} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
      <View style={[styles.glowBig, { backgroundColor: bg2 }]} />
      <View style={[styles.glowSmall, { backgroundColor: glow }]} />

      <View style={styles.copy}>
        {settings.kicker ? (
          <View style={[styles.kicker, { borderColor: glow + "66", backgroundColor: glow + "1f" }]}>
            <Text style={[styles.kickerText, { color: glow }]}>{"✦ " + settings.kicker.toUpperCase()}</Text>
          </View>
        ) : null}
        {settings.title ? <Text style={[styles.bannerTitle, { color: ink }]}>{settings.title}</Text> : null}
        {settings.body ? (
          <Text style={[styles.bannerBody, { color: ink }]} numberOfLines={3}>
            {settings.body}
          </Text>
        ) : null}
        {settings.price || settings.worth ? (
          <View style={styles.priceRow}>
            {settings.price ? <Text style={[styles.price, { color: glow }]}>{settings.price}</Text> : null}
            {settings.worth ? <Text style={[styles.worth, { color: ink }]}>{settings.worth}</Text> : null}
          </View>
        ) : null}
        {settings.buttonLabel || settings.stockNote ? (
          <View style={styles.ctaRow}>
            {settings.buttonLabel ? (
              <View style={[styles.bannerCta, { backgroundColor: glow }]}>
                <Text style={[styles.bannerCtaText, { color: bg }]}>{settings.buttonLabel + " →"}</Text>
              </View>
            ) : null}
            {settings.stockNote ? <Text style={[styles.stock, { color: ink }]}>{settings.stockNote}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.art}>
        {settings.imageUrl ? (
          <Image source={{ uri: settings.imageUrl }} style={styles.artImage} resizeMode="contain" />
        ) : (
          <View style={styles.stage}>
            <View style={[styles.halo, { backgroundColor: glow }]} />
            <Text style={[styles.spark, { top: 6, left: 8, fontSize: 14, color: glow }]}>✦</Text>
            <Text style={[styles.spark, { top: 26, right: 6, fontSize: 10, color: glow }]}>✦</Text>
            <Text style={[styles.spark, { bottom: 40, left: 2, fontSize: 9, color: glow }]}>✦</Text>
            <Animated.Text style={[styles.question, { textShadowColor: glow, transform: [{ translateY: lift }] }]}>?</Animated.Text>
            <Animated.View style={[styles.lid, { backgroundColor: glow, transform: [{ translateY: lift }, { rotate: "-9deg" }] }]}>
              <View style={[styles.ribbon, { backgroundColor: bg2 }]} />
            </Animated.View>
            <View style={[styles.box, { backgroundColor: glow }]}>
              <View style={styles.boxShade} />
              <View style={[styles.ribbon, { backgroundColor: bg2 }]} />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", height: 112, backgroundColor: colors.page },
  body: { padding: spacing.lg },
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  text: { marginTop: 4, fontSize: 11, lineHeight: 16, opacity: 0.8 },
  cta: { marginTop: spacing.md, alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  ctaText: { fontSize: 12, fontWeight: "700" },

  banner: { flexDirection: "row", overflow: "hidden" },
  glowBig: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, bottom: -90, opacity: 0.7 },
  glowSmall: { position: "absolute", width: 160, height: 160, borderRadius: 80, right: -20, bottom: -60, opacity: 0.18 },
  copy: { flex: 1, justifyContent: "center", paddingVertical: spacing.lg, paddingLeft: spacing.lg, paddingRight: spacing.sm, gap: 6 },
  kicker: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  kickerText: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  bannerTitle: { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  bannerBody: { fontSize: 11, lineHeight: 16, opacity: 0.78 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  price: { fontSize: 15, fontWeight: "800" },
  worth: { fontSize: 10, opacity: 0.72 },
  ctaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 },
  bannerCta: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  bannerCtaText: { fontSize: 12, fontWeight: "700" },
  stock: { fontSize: 10, fontWeight: "600", opacity: 0.8 },
  art: { width: "44%", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  artImage: { width: "100%", height: 150 },
  stage: { width: 124, height: 132 },
  halo: { position: "absolute", top: 16, left: 16, width: 92, height: 92, borderRadius: 46, opacity: 0.35 },
  spark: { position: "absolute" },
  question: { position: "absolute", top: 12, left: 50, width: 24, textAlign: "center", fontSize: 36, fontWeight: "900", color: "#ffffff", textShadowRadius: 12 },
  lid: { position: "absolute", bottom: 62, left: 14, width: 96, height: 18, borderRadius: 6 },
  box: { position: "absolute", bottom: 8, left: 20, width: 84, height: 56, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: "hidden" },
  boxShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 22, backgroundColor: "rgba(0,0,0,0.18)" },
  ribbon: { position: "absolute", top: 0, bottom: 0, left: "50%", marginLeft: -7, width: 14 },
});
`,

    review_summary: `import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { theme } from "../theme";
import { openLink } from "./Pieces";

export type ReviewSummarySettings = {
  eyebrow?: string;
  heading?: string;
  headingItalic?: string;
  average?: string;
  reviewCount?: string;
  reviewsWord?: string;
  trustNote?: string;
  pct5?: number;
  pct4?: number;
  pct3?: number;
  pct2?: number;
  pct1?: number;
  buttonLabel?: string;
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
  animate?: boolean;
  avgSize?: number;
  radius?: number;
  bg?: string;
  panelFrom?: string;
  panelTo?: string;
  starColor?: string;
  barTrack?: string;
  barFrom?: string;
  barTo?: string;
  brownColor?: string;
  accentColor?: string;
  inkColor?: string;
  mutedColor?: string;
};

/** The average, its stars, the count and a bar per star, as on the website. */
export function ReviewSummary({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: ReviewSummarySettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const grow = useRef(new Animated.Value(settings.animate === false ? 1 : 0)).current;
  useEffect(() => {
    if (settings.animate === false) return;
    Animated.timing(grow, { toValue: 1, duration: 1100, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow, settings.animate]);

  if (!settings.average && !settings.heading && !settings.headingItalic) return null;
  const go = () => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen });
  const star = settings.starColor || "#c9a227";
  const track = settings.barTrack || "#e5dbcd";
  const brown = settings.brownColor || "#684329";
  const caramel = settings.accentColor || "#9d6540";
  const ink = settings.inkColor || "#211a15";
  const muted = settings.mutedColor || "#74685e";
  const filled = Math.max(0, Math.min(5, Math.floor(Number(settings.average) || 0)));
  const pcts: Record<number, number | undefined> = { 5: settings.pct5, 4: settings.pct4, 3: settings.pct3, 2: settings.pct2, 1: settings.pct1 };
  const pct = (n: number) => Math.max(0, Math.min(100, Number(pcts[n]) || 0));
  const count = [settings.reviewCount, settings.reviewsWord].filter(Boolean).join(" ");

  return (
    <View style={settings.bg ? [styles.band, { backgroundColor: settings.bg }] : null}>
      {settings.eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={[styles.rule, { backgroundColor: caramel }]} />
          <Text style={[styles.eyebrow, { color: brown }]}>{settings.eyebrow.toUpperCase()}</Text>
          <View style={[styles.rule, { backgroundColor: caramel }]} />
        </View>
      ) : null}
      {settings.heading || settings.headingItalic ? (
        <Text style={[styles.heading, { color: ink }]}>
          {settings.heading ? settings.heading + " " : ""}
          {settings.headingItalic ? <Text style={[styles.italic, { color: caramel }]}>{settings.headingItalic}</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={go}
        style={[
          styles.card,
          {
            borderRadius: settings.radius || 18,
            backgroundColor: settings.panelFrom || "#fdf9f3",
          },
        ]}
      >
        <Fade
          angle={160}
          colors={[settings.panelFrom || "#fdf9f3", settings.panelTo || "#f3e9db"]}
          style={[StyleSheet.absoluteFill, { borderRadius: settings.radius || 18 }]}
        />
        <View style={styles.score}>
          {settings.average ? (
            <Text style={[styles.average, { color: ink, fontSize: settings.avgSize && settings.avgSize > 0 ? settings.avgSize : 58 }]}>
              {settings.average}
            </Text>
          ) : null}
          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Text key={i} style={[styles.star, { color: i < filled ? star : track }]}>★</Text>
            ))}
          </View>
          {count ? <Text style={[styles.count, { color: muted }]}>{count}</Text> : null}
          {settings.trustNote ? <Text style={[styles.trust, { color: caramel }]}>{"✓  " + settings.trustNote.toUpperCase()}</Text> : null}
        </View>
        <View style={styles.bars}>
          {[5, 4, 3, 2, 1].map((n) => (
            <View key={n} style={styles.barRow}>
              <Text style={[styles.barN, { color: ink }]}>{n}</Text>
              <Text style={[styles.barStar, { color: star }]}>★</Text>
              <View style={[styles.track, { backgroundColor: track }]}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: settings.barTo || caramel,
                      width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", pct(n) + "%"] }),
                    },
                  ]}
                >
                  <Fade angle={90} colors={[settings.barFrom || "#c9a227", settings.barTo || caramel]} style={StyleSheet.absoluteFill} />
                </Animated.View>
              </View>
              <Text style={[styles.pct, { color: muted }]}>{pct(n) + "%"}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {settings.buttonLabel ? (
        <Pressable onPress={go} style={[styles.cta, { backgroundColor: brown }]}>
          <Text style={styles.ctaText}>{settings.buttonLabel.toUpperCase() + "  →"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 20 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  rule: { width: 34, height: 1, opacity: 0.5 },
  eyebrow: { fontSize: 10.5, fontWeight: "600", letterSpacing: 2.5 },
  heading: { marginTop: 12, fontSize: 28, fontWeight: "600", textAlign: "center", fontFamily: theme.titleFont },
  italic: { fontStyle: "italic", fontWeight: "500" },
  card: { marginTop: 20, borderWidth: 1, borderColor: "rgba(69,46,31,0.13)", paddingHorizontal: 18, paddingVertical: 22, overflow: "hidden" },
  cardLower: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", opacity: 0.6 },
  score: { alignItems: "center", paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(69,46,31,0.13)" },
  average: { fontWeight: "600", fontFamily: theme.titleFont },
  stars: { flexDirection: "row", gap: 3, marginTop: 8 },
  star: { fontSize: 16 },
  count: { marginTop: 8, fontSize: 11.5 },
  trust: { marginTop: 10, fontSize: 9.5, fontWeight: "600", letterSpacing: 1.1 },
  bars: { marginTop: 16, gap: 7 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, paddingVertical: 4 },
  barN: { width: 10, fontSize: 11.5, fontWeight: "600" },
  barStar: { fontSize: 12 },
  track: { flex: 1, height: 7, borderRadius: 20, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 20, overflow: "hidden" },
  fillStart: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", opacity: 0.85 },
  pct: { width: 32, textAlign: "right", fontSize: 11 },
  cta: { marginTop: 20, alignSelf: "center", borderRadius: 100, paddingHorizontal: 26, paddingVertical: 13 },
  ctaText: { color: "#ffffff", fontSize: 10.5, fontWeight: "700", letterSpacing: 1.9 },
});
`,

    brand_timeline: `import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { theme } from "../theme";
import { openLink, type LinkTo } from "./Pieces";

export type Brand = {
  id: string;
  logoText?: string;
  label?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  focal?: string;
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};
export type BrandTimelineSettings = {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  linkLabel?: string;
  autoplay?: number;
  cardHeight?: number;
  radius?: number;
  overlay?: number;
  bg?: string;
  accentColor?: string;
  brownColor?: string;
  inkColor?: string;
  lineColor?: string;
  items?: Brand[];
};

/**
 * Shop by brand: round logo marks over one wide photo card at a time. The
 * cards slide on their own with a bar filling underneath; a swipe or a tap on
 * a mark takes over, and tapping the card opens the brand.
 */
export function BrandTimeline({
  settings,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: BrandTimelineSettings;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.label || i.title || i.imageUrl);
  const [on, setOn] = useState(0);
  // Once the shopper takes hold, the cards stop moving on their own.
  const [held, setHeld] = useState(false);
  const [width, setWidth] = useState(0);
  // Only scrollTo is needed, so only scrollTo is promised.
  const scroller = useRef<{ scrollTo: (to: { x: number; animated?: boolean }) => void } | null>(null);
  const bar = useRef(new Animated.Value(0)).current;
  const seconds = typeof settings.autoplay === "number" ? settings.autoplay : 3;

  // Show the current card, run its bar, then move on.
  useEffect(() => {
    if (width) scroller.current?.scrollTo({ x: on * width, animated: true });
    if (!(seconds > 0) || items.length < 2 || held) return;
    bar.setValue(0);
    const run = Animated.timing(bar, { toValue: 1, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: false });
    run.start();
    const t = setTimeout(() => setOn((i) => (i + 1) % items.length), seconds * 1000);
    return () => {
      run.stop();
      clearTimeout(t);
    };
  }, [on, width, seconds, items.length, bar, held]);

  if (!items.length) return null;
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  const caramel = settings.accentColor || "#9d6540";
  const brown = settings.brownColor || "#684329";
  const ink = settings.inkColor || "#211a15";
  const line = settings.lineColor || "rgba(69,46,31,0.16)";
  const r = typeof settings.radius === "number" && settings.radius >= 0 ? settings.radius : 20;
  const h = settings.cardHeight && settings.cardHeight > 0 ? settings.cardHeight : 150;
  const shade = (typeof settings.overlay === "number" ? settings.overlay : 72) / 100;

  return (
    <View style={settings.bg ? [styles.band, { backgroundColor: settings.bg }] : null}>
      {settings.eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowRule, { backgroundColor: caramel }]} />
          <Text style={[styles.eyebrow, { color: brown }]}>{settings.eyebrow.toUpperCase()}</Text>
        </View>
      ) : null}
      {settings.heading ? <Text style={[styles.heading, { color: ink }]}>{settings.heading}</Text> : null}
      {settings.intro ? <Text style={styles.intro}>{settings.intro}</Text> : null}

      <View style={styles.marks}>
        <View style={[styles.hairline, { backgroundColor: line }]} />
        {items.map((b, i) => {
          const active = i === on;
          return (
            <Pressable key={b.id} style={styles.mark} onPress={() => { setHeld(true); setOn(i); }}>
              <View
                style={[
                  styles.circle,
                  { backgroundColor: active ? caramel : "#fffdfa", borderColor: active ? caramel : line },
                  active ? styles.circleOn : null,
                ]}
              >
                <Text style={[styles.logo, { color: active ? "#ffffff" : brown }]} numberOfLines={2}>
                  {b.logoText ?? ""}
                </Text>
              </View>
              <Text style={[styles.markLabel, { color: active ? brown : ink }]} numberOfLines={2}>
                {(b.label || b.title || "").toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.cards, { borderRadius: r }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={(node) => {
            scroller.current = node as unknown as { scrollTo: (to: { x: number; animated?: boolean }) => void } | null;
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setHeld(true)}
          onMomentumScrollEnd={(e) => {
            if (width) setOn(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
        >
          {items.map((b) => (
            <Pressable key={b.id} onPress={() => go(b)} style={{ width: width || 1, height: h }}>
              {b.imageUrl ? <Image source={{ uri: b.imageUrl }} style={styles.fill} resizeMode="cover" /> : null}
              <Fade
                angle={90}
                colors={["rgba(28,18,12," + shade + ")", "rgba(28,18,12," + shade * 0.47 + ")", "rgba(28,18,12,0.02)"]}
                locations={[0, 0.46, 0.74]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{b.title || b.label}</Text>
                {b.description ? <Text style={styles.cardDesc}>{b.description}</Text> : null}
                {settings.linkLabel ? (
                  <View style={styles.cta}>
                    <Text style={styles.ctaText}>{settings.linkLabel.toUpperCase() + "  →"}</Text>
                    <View style={styles.ctaRule} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {seconds > 0 && items.length > 1 && !held ? (
          <View style={styles.progress}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: caramel, width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: -16, paddingHorizontal: 12, paddingVertical: 20 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  eyebrowRule: { width: 40, height: 1 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 2.6 },
  heading: { marginTop: 8, fontSize: 24, fontWeight: "600", textAlign: "center", fontFamily: theme.titleFont },
  intro: { marginTop: 8, fontSize: 11.5, lineHeight: 17, color: "#74685e", textAlign: "center" },
  marks: { flexDirection: "row", marginTop: 16, alignItems: "flex-start" },
  hairline: { position: "absolute", left: "10%", right: "10%", top: 20, height: 1 },
  mark: { flex: 1, alignItems: "center", gap: 6 },
  circle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  circleOn: { transform: [{ scale: 1.06 }] },
  logo: { fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 2, fontFamily: theme.titleFont },
  markLabel: { fontSize: 8, fontWeight: "600", letterSpacing: 1, textAlign: "center" },
  cards: { marginTop: 16, overflow: "hidden", backgroundColor: "#b89d82" },
  // Written out: newer React Native no longer declares absoluteFill in its types.
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  shadeFull: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#1c120c" },
  shadeHalf: { position: "absolute", left: 0, top: 0, bottom: 0, width: "60%", backgroundColor: "#1c120c" },
  shadeEdge: { position: "absolute", left: 0, top: 0, bottom: 0, width: "32%", backgroundColor: "#1c120c" },
  copy: { position: "absolute", left: 20, top: 0, bottom: 0, maxWidth: "78%", justifyContent: "center", alignItems: "flex-start" },
  cardTitle: { color: "#ffffff", fontSize: 22, fontWeight: "600", fontFamily: theme.titleFont },
  cardDesc: { marginTop: 6, color: "#ffffff", fontSize: 11.5, lineHeight: 16, opacity: 0.95 },
  cta: { marginTop: 8, paddingBottom: 4 },
  ctaText: { color: "#ffffff", fontSize: 11.5, fontWeight: "600", letterSpacing: 1.6 },
  ctaRule: { position: "absolute", left: 0, bottom: 0, width: 40, height: 1, backgroundColor: "rgba(255,255,255,0.65)" },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(0,0,0,0.15)" },
  progressFill: { height: "100%" },
});
`,

    complete_look: `import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { Recommendations } from "../api";

export type CompleteLookSettings = {
  title?: string;
  subtitle?: string;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  limit?: number;
};

/** "{product}" becomes the piece they bought; with no piece, the line goes. */
function withProduct(line: string, product: string | null): string {
  if (!line.includes("{product}")) return line;
  if (!product) return "";
  const short = product.length > 32 ? product.slice(0, 32).replace(/ +[^ ]*$/, "") : product;
  return line.split("{product}").join(short);
}

/**
 * What goes with the shopper's past orders. The shop does the matching; a
 * guest or a first-time shopper gets nothing back, and then this is not drawn.
 */
export function CompleteLook({
  settings,
  recs,
  onOpenProduct,
}: {
  settings: CompleteLookSettings;
  recs: Recommendations | null;
  onOpenProduct?: (id: string) => void;
}) {
  if (!recs || !recs.products.length) return null;
  const pairs = recs.mode !== "fallback";
  const title = pairs ? settings.title || "Complete your look" : settings.fallbackTitle || "Recommended for you";
  const subtitle = withProduct((pairs ? settings.subtitle : settings.fallbackSubtitle) || "", recs.basedOn);

  return (
    <View>
      <SectionHeading title={title} />
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {recs.products.map((p) => <ProductTile key={p.id} card={p} onPress={onOpenProduct} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  row: { gap: gap.item, paddingVertical: spacing.sm },
});
`,

    showcase: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Fade } from "./Fade";
import { colors, spacing } from "../theme";
import { openLink } from "./Pieces";
import type { HomePayload } from "../api";

export type ShowcaseSettings = {
  imageUrl?: string;
  heading?: string;
  subheading?: string;
  buttonLabel?: string;
  handle?: string;
  productId?: string;
  screen?: string;
  url?: string;
  height?: number;
  overlay?: number;
  textColor?: string;
  align?: string;
};

export function Showcase({
  settings,
  collections,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  settings: ShowcaseSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const target = collections.find((c) => c.handle === settings.handle);
  const image = settings.imageUrl || (target ? target.image : "");
  if (!image && !settings.heading) return null;

  const height = settings.height && settings.height > 0 ? settings.height : 360;
  const overlay = typeof settings.overlay === "number" ? Math.max(0, Math.min(100, settings.overlay)) : 45;
  const ink = settings.textColor || "#ffffff";
  const centred = settings.align === "center";
  const go = () => openLink(settings, { onOpenCollection, onOpenProduct, onOpenScreen });

  return (
    <View style={[styles.wrap, { height, marginHorizontal: -spacing.lg }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} />
      ) : (
        <View style={[styles.image, { backgroundColor: colors.page }]} />
      )}
      <Fade
        angle={0}
        colors={["rgba(0,0,0," + overlay / 100 + ")", "rgba(0,0,0," + (overlay / 100) * 0.35 + ")", "rgba(0,0,0,0)"]}
        locations={[0, 0.45, 0.8]}
        style={styles.scrim}
      />
      <View style={[styles.body, centred ? styles.centred : styles.bottom]}>
        {settings.heading ? (
          <Text style={[styles.heading, { color: ink }, centred ? styles.middle : null]}>{settings.heading}</Text>
        ) : null}
        {settings.subheading ? (
          <Text style={[styles.sub, { color: ink }, centred ? styles.middle : null]}>{settings.subheading}</Text>
        ) : null}
        {settings.buttonLabel ? (
          <Pressable style={[styles.cta, { backgroundColor: ink }, centred ? { alignSelf: "center" } : null]} onPress={go}>
            <Text style={[styles.ctaText, settings.imageUrl ? null : { color: colors.accent }]}>{settings.buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 28 },
  bottom: { justifyContent: "flex-end" },
  centred: { alignItems: "center", justifyContent: "center" },
  middle: { textAlign: "center" },
  heading: { fontSize: 26, fontWeight: "700", lineHeight: 30 },
  sub: { marginTop: 4, fontSize: 12, lineHeight: 18, opacity: 0.85 },
  cta: { marginTop: 12, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  ctaText: { fontSize: 12, fontWeight: "700", color: "#191614" },
});
`,

    text: `import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";

export type TextBlockSettings = { heading?: string; body?: string };

export function TextBlock({ settings }: { settings: TextBlockSettings }) {
  const { heading, body } = settings;
  if (!heading && !body) return null;
  return (
    <View style={styles.wrap}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, backgroundColor: colors.page, padding: spacing.md },
  heading: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.inkMuted },
});
`,
  };

  return {
    path: `components/${name}.tsx`,
    language: "tsx",
    contents: `/** ${BLOCK_META[type].en}. Generated from the dashboard — App → App theme. */
${body[type]}`,
  };
}

// -------------------------------------------------------------- the screen --
function homeScreenFile(): GeneratedFile {
  // Every kind of section, not only the ones on the home screen today: which
  // appear is decided when the app opens, so one added in the editor tomorrow
  // must already be something this build can draw.
  const types = Object.keys(BLOCK_META) as BlockType[];
  const imports = types
    .map((t) => `import { ${exportName(t)} } from "./components/${componentName(t)}";`)
    .join("\n");
  const cases = types.map(blockCase).join("\n");

  return {
    path: "HomeScreen.tsx",
    language: "tsx",
    contents: `/**
 * The app's home screen. Generated from the dashboard — App → App theme.
 *
 * Which sections appear, in what order and with what in them, is the theme
 * the app fetched when it opened (theme.ts), so a change saved in the editor
 * reaches the phone without a new build. This file only knows how to draw
 * each kind of section.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, gap, layout, spacing, type PackBlock } from "./theme";
import { fetchHome, fetchRecommendations, type HomePayload, type Recommendations } from "./api";
${imports}

type Handlers = {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
  /** Put a single-variant product in the basket, for a section that can. */
  onAdd?: (variantId: string, productId: string) => void;
  /** Whether someone is signed in - what Complete your look is built from. */
  signedIn?: boolean;
};

/** One section of a given kind, drawn with the settings the dashboard sent. */
function renderBlock(b: PackBlock, data: HomePayload, recs: Recommendations | null, h: Handlers) {
  const { onOpenCollection, onOpenProduct, onOpenScreen, onAdd } = h;
  // Each component checks its own settings; these arrive as the editor saved them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = b.settings as any;
  switch (b.type) {
${cases}
    // A kind of section this build does not know yet is left out, not a crash.
    default:
      return null;
  }
}

/** A band bleeds to the screen edges, so the page padding comes off and is put back on inside it. */
function bandStyle(band: string): StyleProp<ViewStyle> {
  if (band === "tint" || band === "paper") {
    return {
      marginHorizontal: -spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: gap.section,
      backgroundColor: band === "paper" ? "#ffffff" : colors.accent + "12",
    };
  }
  if (band === "divider") return { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: gap.section };
  return null;
}

/**
 * One section, and the line above it.
 *
 * A section can have nothing to draw once it is on the phone - no lives
 * scheduled, no deals running - and a heading over nothing reads as a mistake.
 * The editor leaves both out, so this measures what the section drew and
 * does the same, band and all.
 */
function Section({
  kicker,
  style,
  children,
}: {
  kicker?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [drawn, setDrawn] = useState<number | null>(null);
  const empty = drawn !== null && drawn < 1;
  return (
    <View style={empty ? styles.gone : style}>
      {kicker ? <Text style={[styles.kicker, drawn === null || empty ? styles.hidden : null]}>{kicker.toUpperCase()}</Text> : null}
      <View onLayout={(e) => setDrawn(e.nativeEvent.layout.height)}>{children}</View>
    </View>
  );
}

function Sections({
  list,
  data,
  recs,
  h,
}: {
  list: PackBlock[];
  data: HomePayload;
  recs: Recommendations | null;
  h: Handlers;
}) {
  return (
    <>
      {list.map((b) => (
        <Section key={b.id} style={bandStyle(b.band)} kicker={b.kicker || undefined}>
          {renderBlock(b, data, recs, h)}
        </Section>
      ))}
    </>
  );
}

/** Suggestions for whoever is signed in, when a section in the list uses them. */
function useRecs(list: PackBlock[], signedIn?: boolean) {
  const wanted = list.some((b) => b.type === "complete_look");
  const [recs, setRecs] = useState<Recommendations | null>(null);
  useEffect(() => {
    if (!wanted || !signedIn) return setRecs(null);
    fetchRecommendations().then(setRecs).catch(() => setRecs(null));
  }, [wanted, signedIn]);
  return recs;
}

export default function HomeScreen(h: Handlers & { onCollections?: (titles: string[]) => void }) {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHome()
      .then((d) => {
        setData(d);
        h.onCollections?.((d.collections ?? []).map((c) => c.title).filter(Boolean));
      })
      .catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recs = useRecs(layout.home, h.signedIn);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Sections list={layout.home} data={data} recs={recs} h={h} />
      </ScrollView>
    </View>
  );
}

/**
 * The same sections, placed elsewhere.
 *
 * A merchant who puts "complete your look" beside the basket gets the section
 * she already built, not a second one written to look like it. Each asks for
 * the catalogue itself, because the product screen and the basket have no
 * reason to carry a home payload around for a section that may not be there.
 */
function Placed({ list, ...h }: Handlers & { list: PackBlock[] }) {
  const [data, setData] = useState<HomePayload | null>(null);
  useEffect(() => {
    if (!list.length) return;
    fetchHome().then(setData).catch(() => setData(null));
  }, [list.length]);
  const recs = useRecs(list, h.signedIn);
  if (!list.length || !data) return null;
  return (
    <View style={styles.placed}>
      <Sections list={list} data={data} recs={recs} h={h} />
    </View>
  );
}

/** Sections the merchant placed on the product screen. */
export function ProductSections(h: Handlers) {
  return <Placed list={layout.product} {...h} />;
}

/** Sections the merchant placed on the basket. */
export function CartSections(h: Handlers) {
  return <Placed list={layout.cart} {...h} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: gap.section },
  kicker: { marginBottom: 6, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: colors.accent },
  hidden: { opacity: 0 },
  // Out of the flow, so the gap between sections closes over it, but still
  // laid out, so a section whose content arrives later is noticed.
  gone: { position: "absolute", left: 0, right: 0, opacity: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  error: { color: "#e11d48", fontSize: 13 },
  placed: { gap: gap.section, paddingVertical: gap.section },
});
`,
  };
}

function exportName(type: BlockType): string {
  return type === "text" ? "TextBlock" : componentName(type);
}

/** How the home screen draws one kind of section: its settings, plus what it reads. */
function blockCase(type: BlockType): string {
  const name = exportName(type);
  const extras: Record<BlockType, string[]> = {
    hero: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    promo_bar: [],
    pay_strip: ["payments={data.payments ?? []}"],
    brand_wall: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    bundle_save: ["rows={data.rows}", "newArrivals={data.newArrivals}", "onOpenProduct={onOpenProduct}", "onAdd={onAdd}"],
    collection_tabs: ["rows={data.rows}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}"],
    cards: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    sale_seal: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    free_shipping: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    moments: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    tiers: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    split: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    trust_badges: [],
    live_now: ["lives={data.lives}", "collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    coming_up_live: ["lives={data.lives}", "collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    countdown_deals: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    info_rows: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    shipping_goal: [],
    payment_plans: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    price_slider: [],
    offer_cards: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    product_reasons: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    circle_row: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    pick_colour: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    price_drop: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    showcase: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    style_profile: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    promo_card: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    complete_look: ["recs={recs}", "onOpenProduct={onOpenProduct}"],
    brand_timeline: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    review_summary: ["onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    banner: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    categories: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    new_arrivals: ["products={data.newArrivals}", "onOpenProduct={onOpenProduct}"],
    collection_row: ["collections={data.collections}", "rows={data.rows}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}"],
    collection_grid: ["collections={data.collections}", "rows={data.rows}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}"],
    reviews: ["reviews={data.reviews}"],
    text: [],
  };
  const props = ["settings={settings}", ...extras[type]].join(" ");
  // Nothing to suggest means no section at all - not an empty band.
  if (type === "complete_look") {
    return `    case "complete_look":\n      return recs && recs.products.length ? <${name} ${props} /> : null;`;
  }
  return `    case ${q(type)}:\n      return <${name} ${props} />;`;
}

/**
 * Settings that are numbers rather than text, and where zero is meaningful
 * (a ring width of zero is "no ring", not "unset").
 */
const SIZE_KEYS = new Set([
  "avatarSize",
  "ringWidth",
  "nameSize",
  "viewersSize",
  "bannerRadius",
  "offerGap",
  "offerHeight",
  "offerTitleSize",
  "offerTextSize",
  "radius",
  "titleSize",
  "labelSize",
  "imageHeight",
  "cardWidth",
  "swatchSize",
  "cardHeight",
  "autoplay",
  "pct5",
  "pct4",
  "pct3",
  "pct2",
  "pct1",
  "avgSize",
  "percent",
  "minPrice",
  "maxPrice",
  "startPrice",
  "size",
  "height",
  "overlay",
]);

/** A block's settings as plain data, keeping only what it uses. */
function settingsObject(block: Block): Record<string, unknown> {
  const keep: Record<BlockType, string[]> = {
    hero: [],
    pay_strip: ["every", "title"],
    brand_wall: ["title", "subtitle", "seeAllLabel", "seeAllHandle", "seeAllUrl", "perRow", "rows", "showCount", "titleSize", "linkColor"],
    bundle_save: [
      "eyebrow",
      "title",
      "itemCount",
      "percentOff",
      "code",
      "handle",
      "limit",
      "addLabel",
      "note",
      "radius",
      "bg",
      "inkColor",
    ],
    promo_bar: ["lead", "rest", "code"],
    collection_tabs: [
      "title",
      "limit",
      "align",
      "stretchTabs",
      "showLink",
      "imageShape",
      "imageFit",
    ],
    cards: ["kicker", "title"],
    sale_seal: [
      "layout",
      "ringText",
      "bigText",
      "smallText",
      "tagline",
      "buttonLabel",
      "imageUrl",
      "focal",
      "badge",
      "badgeBg",
      "badgeColor",
      "bg",
      "bg2",
      "inkColor",
      "ringColor",
      "height",
      "radius",
      "handle",
      "url",
      "productId",
      "screen",
    ],
    free_shipping: [
      "style",
      "imageUrl",
      "focal",
      "kicker",
      "title",
      "subtitle",
      "note",
      "buttonLabel",
      "stampTop",
      "stampBig",
      "stampBottom",
      "bg",
      "bg2",
      "inkColor",
      "dashColor",
      "radius",
      "height",
      "handle",
      "url",
      "productId",
      "screen",
    ],
    moments: ["title", "subtitle", "cardWidth", "cardHeight", "radius", "labelColor"],
    tiers: ["title", "cardBg", "lineColor", "inkColor", "mutedColor"],
    split: ["title"],
    trust_badges: [],
    live_now: [
      "title",
      "liveLabel",
      "replayBadge",
      "showReplays",
      "replaysLabel",
      "replaysHandle",
      "replaysUrl",
      "offerEnabled",
      "autoplayReplays",
      "offerTitle",
      "offerText",
      "offerMinutes",
      "offerHandle",
      "offerUrl",
      "avatarShape",
      "avatarSize",
      "ringWidth",
      "ringColor",
      "badgeBg",
      "badgeTextColor",
      "nameSize",
      "viewersSize",
      "bannerRadius",
      "offerGap",
      "offerHeight",
      "offerBg",
      "offerTextColor",
      "offerTitleSize",
      "offerTextSize",
      "timerBg",
      "timerTextColor",
      "replaysProductId",
      "replaysScreen",
      "offerProductId",
      "offerScreen",
    ],
    coming_up_live: ["title", "remindLabel", "remindedLabel", "cardBg", "radius"],
    countdown_deals: [
      "featureFirst",
      "title",
      "endsInMinutes",
      "showTimer",
      "showClaimed",
      "badgeBg",
      "radius",
    ],
    info_rows: ["title", "cardBg", "radius"],
    shipping_goal: [
      "title",
      "subtitle",
      "startLabel",
      "endLabel",
      "percent",
      "barColor",
      "cardBg",
      "radius",
    ],
    payment_plans: [
      "title",
      "subtitle",
      "seeAllLabel",
      "seeAllHandle",
      "seeAllUrl",
      "radius",
      "seeAllProductId",
      "seeAllScreen",
    ],
    price_slider: [
      "title",
      "subtitle",
      "priceLabel",
      "currency",
      "minPrice",
      "maxPrice",
      "startPrice",
      "cardBg",
      "radius",
    ],
    offer_cards: ["title", "subtitle", "claimLabel", "radius"],
    product_reasons: [
      "featureFirst",
      "title",
      "subtitle",
      "seeAllLabel",
      "seeAllHandle",
      "seeAllUrl",
      "buttonLabel",
      "radius",
      "seeAllProductId",
      "seeAllScreen",
    ],
    circle_row: [
      "title",
      "subtitle",
      "seeAllLabel",
      "seeAllHandle",
      "seeAllUrl",
      "size",
      "showLabel",
      "showNote",
      "seeAllProductId",
      "seeAllScreen",
      "shape",
      "radius",
      "titleSize",
      "labelSize",
      "labelBold",
      "labelColor",
      "perRow",
      "linkColor",
      "bg",
    ],
    pick_colour: [
      "style",
      "title",
      "subtitle",
      "size",
      "eyebrow",
      "linkLabel",
      "pillText",
      "pillCta",
      "pillHandle",
      "pillUrl",
      "pillProductId",
      "pillScreen",
      "titleSize",
      "imageHeight",
      "cardWidth",
      "swatchSize",
      "bg",
      "cardBg",
      "inkColor",
      "mutedColor",
      "accentColor",
      "lineColor",
      "pillBg",
    ],
    price_drop: [
      "title",
      "subtitle",
      "buttonLabel",
      "handle",
      "url",
      "cardBg",
      "radius",
      "productId",
      "screen",
    ],
    showcase: [
      "imageUrl",
      "heading",
      "subheading",
      "buttonLabel",
      "handle",
      "url",
      "height",
      "overlay",
      "textColor",
      "align",
      "productId",
      "screen",
    ],
    banner: ["imageUrl", "heading", "subheading", "handle", "url", "productId", "screen"],
    categories: ["title"],
    new_arrivals: ["title", "limit"],
    collection_row: ["handle", "title", "limit"],
    collection_grid: ["handle", "title", "limit"],
    reviews: [
      "title",
      "subtitle",
      "ratingLabel",
      "seeAllLabel",
      "seeAllHandle",
      "seeAllUrl",
      "limit",
      "seeAllProductId",
      "seeAllScreen",
    ],
    style_profile: [
      "title",
      "subtitle",
      "cardTitle",
      "cardSubtitle",
      "footNote",
      "cardBg",
      "radius",
      "style",
      "kicker",
      "glyph",
      "deepFrom",
      "deepTo",
      "gold",
      "onDeep",
      "onDeepSoft",
      "handle",
      "url",
      "productId",
      "screen",
    ],
    promo_card: [
      "style",
      "kicker",
      "title",
      "body",
      "price",
      "worth",
      "stockNote",
      "bg2",
      "glow",
      "height",
      "buttonLabel",
      "handle",
      "url",
      "imageUrl",
      "bg",
      "textColor",
      "radius",
      "productId",
      "screen",
    ],
    complete_look: ["title", "subtitle", "fallbackTitle", "fallbackSubtitle", "limit"],
    review_summary: [
      "eyebrow",
      "heading",
      "headingItalic",
      "average",
      "reviewCount",
      "reviewsWord",
      "trustNote",
      "pct5",
      "pct4",
      "pct3",
      "pct2",
      "pct1",
      "buttonLabel",
      "handle",
      "url",
      "productId",
      "screen",
      "animate",
      "avgSize",
      "radius",
      "bg",
      "panelFrom",
      "panelTo",
      "starColor",
      "barTrack",
      "barFrom",
      "barTo",
      "brownColor",
      "accentColor",
      "inkColor",
      "mutedColor",
    ],
    brand_timeline: [
      "eyebrow",
      "heading",
      "intro",
      "linkLabel",
      "autoplay",
      "cardHeight",
      "radius",
      "overlay",
      "bg",
      "accentColor",
      "brownColor",
      "inkColor",
      "lineColor",
    ],
    text: ["heading", "body"],
  };
  const set = block.settings ?? {};
  const out: Record<string, unknown> = {};
  for (const k of keep[block.type] ?? []) {
    const v = set[k];
    if (k === "limit") {
      out[k] = n(v, 8);
      continue;
    }
    // Not every setting is a string: a toggle that arrived as text would be
    // truthy in the app whichever way the merchant set it, and a size would
    // be compared as one.
    if (k === "offerMinutes") {
      out[k] = n(v, 10);
      continue;
    }
    if (k === "endsInMinutes") {
      out[k] = n(v, 135);
      continue;
    }
    if (k === "labelBold") {
      if (v === true) out[k] = true;
      continue;
    }
    if (
      k === "showReplays" ||
      k === "autoplayReplays" ||
      k === "offerEnabled" ||
      k === "showTimer" ||
      k === "showClaimed" ||
      k === "showLabel" ||
      k === "showNote" ||
      k === "featureFirst" ||
      k === "stretchTabs" ||
      k === "showLink" ||
      k === "animate"
    ) {
      out[k] = v !== false;
      continue;
    }
    // Sizes are only sent when the merchant actually set one, so the
    // component's own default stays the single source of that number.
    if (SIZE_KEYS.has(k)) {
      const size = Number(v);
      if (Number.isFinite(size) && size >= 0) out[k] = size;
      continue;
    }
    const text = s(v);
    if (text) out[k] = text;
  }

  // Slides, tabs, cards, tiers, panels and badges travel with the block —
  // they are the merchant's content, not the component's business.
  // Pairing rules are read by the shop, not the app.
  const items = block.type === "complete_look" ? [] : itemsOf(block);
  if (items.length) out.items = itemsObjects(block.type, items);
  return out;
}

/** Only the fields a given block type's items actually carry. */
function itemsObjects(type: BlockType, items: Item[]): Record<string, string>[] {
  const fields: Partial<Record<BlockType, string[]>> = {
    hero: ["imageUrl", "kicker", "heading", "subheading", "handle", "url", "productId", "screen"],
    categories: ["handle", "label", "emoji", "imageUrl", "url", "productId", "screen"],
    collection_tabs: ["handle", "label", "emoji"],
    cards: ["imageUrl", "title", "subtitle", "handle", "url", "productId", "screen"],
    tiers: ["prefix", "amount", "label", "handle", "url", "productId", "screen"],
    split: ["imageUrl", "label", "buttonLabel", "handle", "url", "productId", "screen"],
    trust_badges: ["emoji", "title", "subtitle"],
    live_now: ["imageUrl", "name", "viewers", "videoUrl", "handle", "url", "productId", "screen"],
    coming_up_live: ["imageUrl", "title", "when", "handle", "url", "productId", "screen"],
    countdown_deals: [
      "imageUrl",
      "badge",
      "price",
      "comparePrice",
      "claimed",
      "handle",
      "url",
      "productId",
      "screen",
    ],
    info_rows: ["emoji", "title", "subtitle", "note", "handle", "url", "productId", "screen"],
    payment_plans: ["name", "headline", "note", "color", "handle", "url", "productId", "screen"],
    price_slider: ["logo", "name", "months", "badge", "perks", "color"],
    offer_cards: ["badge", "title", "subtitle", "color", "handle", "url", "productId", "screen"],
    product_reasons: [
      "imageUrl",
      "reason",
      "name",
      "price",
      "comparePrice",
      "badge",
      "rating",
      "sold",
      "handle",
      "url",
      "productId",
      "screen",
    ],
    circle_row: ["imageUrl", "label", "note", "handle", "url", "productId", "screen"],
    brand_wall: ["handle", "label", "imageUrl", "url", "productId", "screen"],
    moments: ["imageUrl", "label", "focal", "handle", "url", "productId", "screen"],
    pick_colour: ["color", "label", "imageUrl", "line1", "line2", "handle", "url", "productId", "screen"],
    brand_timeline: ["logoText", "label", "title", "description", "imageUrl", "focal", "handle", "url", "productId", "screen"],
    price_drop: ["imageUrl"],
    style_profile: ["label", "color", "handle", "url", "productId", "screen"],
  };
  const keys = fields[type] ?? [];
  return items.map((item) => {
    const out: Record<string, string> = { id: String(item.id ?? "") };
    for (const k of keys) {
      const text = s(item[k]);
      if (text) out[k] = text;
    }
    return out;
  });
}

// ------------------------------------------------------- the other screens --
/**
 * The screens below home.
 *
 * Home is blocks the merchant arranges, so its code is assembled from them.
 * These are screens the app already knows how to draw, where what varies is
 * the wording and which optional parts appear — so their settings arrive as a
 * constant and the component reads it. Nobody reorders a checkout.
 */
// The app's popup: the same offers the website shows, decided by the shop for
// this shopper and this screen, drawn natively.
function offerPopupFile(): GeneratedFile {
  return {
    path: "components/OfferPopup.tsx",
    language: "tsx",
    contents: `/**
 * The app's popup. Generated from the dashboard — App → App theme.
 *
 * The shop decides which offer this shopper should see on this screen — one
 * made for her by name, or the campaign that fits her and what she is looking
 * at (Dashboard → Smart popups). This waits the time the campaign set, then
 * shows it. A code the shop makes for each shopper is fetched only when she
 * asks for it, and "Apply" puts it straight on her basket.
 */
import React, { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimOffer, decideOffer, offerEvent, type OfferConfig, type OfferContext } from "../api";

const SEEN_AT = "offer_seen_at";
/** Shown this many times since the app opened. */
let seenThisVisit = 0;

function pickSegment(segments: OfferConfig["segments"]) {
  const total = segments.reduce((n, s) => n + Math.max(0, s.weight || 0), 0);
  if (total <= 0) return segments[Math.floor(Math.random() * segments.length)];
  let r = Math.random() * total;
  for (const s of segments) {
    r -= Math.max(0, s.weight || 0);
    if (r < 0) return s;
  }
  return segments[segments.length - 1];
}

export function OfferPopup({
  context,
  cartCount,
  onApplyCode,
}: {
  context: OfferContext;
  cartCount: number;
  /** Put the code on her basket (or keep it for when there is one). */
  onApplyCode: (code: string) => void;
}) {
  const [offer, setOffer] = useState<OfferConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [prize, setPrize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cartRef = useRef(cartCount);
  cartRef.current = cartCount;
  const key = context.pageType + "|" + (context.productKey ?? "") + "|" + (context.collectionHandle ?? "");

  // A new screen: ask again, and forget whatever the last one was waiting for.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    setOffer(null);
    // Never in the way of someone paying.
    if (context.pageType === "checkout") return;
    decideOffer({ ...context, cartCount: cartRef.current })
      .then(async (o) => {
        if (!alive || !o) return;
        if (seenThisVisit >= o.maxPerSession) return;
        if (o.cooldownHours > 0) {
          const last = Number(await AsyncStorage.getItem(SEEN_AT).catch(() => null)) || 0;
          if (last && Date.now() - last < o.cooldownHours * 3600 * 1000) return;
        }
        if (o.skipIfCartEmpty && cartRef.current === 0) return;
        if (!alive) return;
        setOffer(o);
        // Time on this screen, and time with something in the basket.
        const dwell = o.dwell || o.idle;
        let onScreen = 0;
        let withCart = 0;
        timer = setInterval(() => {
          onScreen += 1;
          withCart = cartRef.current > 0 ? withCart + 1 : 0;
          const fire = dwell ? (onScreen >= dwell ? "dwell" : null) : null;
          const cartFire = o.cart && withCart >= o.cart ? "cart" : null;
          const why = fire || cartFire;
          if (!why) return;
          if (timer) clearInterval(timer);
          timer = null;
          if (!alive) return;
          seenThisVisit += 1;
          AsyncStorage.setItem(SEEN_AT, String(Date.now())).catch(() => {});
          const segment = (o.style === "wheel" || o.style === "scratch") && o.segments.length ? pickSegment(o.segments) : null;
          setPrize(segment ? segment.label : null);
          setCode(o.unique ? null : segment ? segment.code || null : o.code);
          setFailed(false);
          setVisible(true);
          offerEvent("shown", o.id, { trigger: why });
        }, 1000);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!offer) return null;

  const close = (dismissed: boolean) => {
    setVisible(false);
    if (dismissed) offerEvent("dismissed", offer.id);
  };

  const getMine = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setCode(await claimOffer(offer.id));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!code) return;
    if (!offer.unique) offerEvent("claimed", offer.id, { code });
    close(false);
    onApplyCode(code);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(true)}>
      <Pressable style={styles.veil} onPress={() => close(true)}>
        <Pressable style={[styles.card, { backgroundColor: offer.bg || "#ffffff" }]} onPress={() => {}}>
          <Pressable style={styles.x} onPress={() => close(true)} hitSlop={10}>
            <Text style={[styles.xText, { color: offer.fg }]}>×</Text>
          </Pressable>
          {offer.image ? <Image source={{ uri: offer.image }} style={styles.image} resizeMode="cover" /> : null}
          <Text style={[styles.headline, { color: offer.fg }]}>{offer.headline}</Text>
          {offer.body ? <Text style={[styles.body, { color: offer.fg }]}>{offer.body}</Text> : null}
          {prize ? <Text style={[styles.prize, { color: offer.accent }]}>{prize}</Text> : null}

          {code ? (
            <>
              <View style={[styles.code, { borderColor: offer.accent }]}>
                <Text selectable style={[styles.codeText, { color: offer.fg }]}>{code}</Text>
              </View>
              <Pressable style={[styles.button, { backgroundColor: offer.accent }]} onPress={apply}>
                <Text style={styles.buttonText}>{cartCount > 0 ? "Apply to my cart" : offer.button || "Use my code"}</Text>
              </Pressable>
            </>
          ) : offer.unique ? (
            <Pressable style={[styles.button, { backgroundColor: offer.accent, opacity: busy ? 0.6 : 1 }]} onPress={getMine} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? "…" : failed ? "Try again" : offer.button || "Get my code"}</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.button, { backgroundColor: offer.accent }]} onPress={() => close(false)}>
              <Text style={styles.buttonText}>{offer.button || "OK"}</Text>
            </Pressable>
          )}

          {offer.dismiss ? (
            <Pressable onPress={() => close(true)} hitSlop={6}>
              <Text style={[styles.dismiss, { color: offer.fg }]}>{offer.dismiss}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 400, borderRadius: 18, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18, alignItems: "stretch" },
  x: { position: "absolute", top: 8, right: 10, width: 30, height: 30, alignItems: "center", justifyContent: "center", zIndex: 1 },
  xText: { fontSize: 22, opacity: 0.45 },
  image: { width: "100%", height: 132, borderRadius: 12, marginBottom: 14 },
  headline: { fontSize: 20, fontWeight: "800", textAlign: "center", lineHeight: 25 },
  body: { marginTop: 8, fontSize: 14.5, lineHeight: 22, opacity: 0.78, textAlign: "center" },
  prize: { marginTop: 10, fontSize: 16, fontWeight: "700", textAlign: "center" },
  code: { marginTop: 16, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  codeText: { fontSize: 19, fontWeight: "800", letterSpacing: 1.5 },
  button: { marginTop: 14, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  dismiss: { marginTop: 10, textAlign: "center", fontSize: 13.5, opacity: 0.6, paddingVertical: 4 },
});
`,
  };
}

// The reels feed, drawn by the app itself and played by the phone's own video
// player — the website inside a web view was a page, a script and a player to
// load before the first frame.
function reelsScreenFile(): GeneratedFile {
  return {
    path: "components/ReelsScreen.tsx",
    language: "tsx",
    contents: `/**
 * Reels: every live that was kept, one after another, each with what was sold
 * in it. Generated from the dashboard — App → App theme.
 *
 * Played by the phone's own video player (ExoPlayer, AVPlayer) straight from
 * the streaming service, a few seconds at a time at whatever quality the
 * connection can carry. Only the reel on screen and its neighbours are loaded,
 * so the next one is already buffered by the time she swipes to it, and the
 * cover shows the instant a reel arrives rather than a black frame.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Path, Rect } from "react-native-svg";
import { SITE_ORIGIN, fetchReels, likeReel, viewReel, type Reel, type ReelProduct } from "../api";
import { Fade } from "./Fade";
import { money } from "./Pieces";

const LIKED = "reel_like_";
/** Reels already counted as watched since the app opened. */
const counted = new Set<string>();

/* ---- icons, as the website draws them ---------------------------------- */
function Icon({ name, filled }: { name: "heart" | "bag" | "tote" | "star" | "share" | "close" | "sound"; filled?: boolean }) {
  const common = { stroke: "#ffffff", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={name === "close" || name === "share" || name === "sound" ? 20 : 24} height={name === "close" || name === "share" || name === "sound" ? 20 : 24} viewBox="0 0 24 24" fill="none">
      {name === "heart" ? (
        <Path {...common} fill={filled ? "#ffffff" : "none"} d="M12 20s-7.2-4.5-9.1-8.4C1.3 8.3 3.1 5 6.4 5c2 0 3.3 1.1 4.1 2.2l1.5 2 1.5-2C14.3 6.1 15.6 5 17.6 5c3.3 0 5.1 3.3 3.5 6.6C19.2 15.5 12 20 12 20Z" />
      ) : name === "bag" ? (
        <>
          <Path {...common} d="M5.5 8h13l-1 11.5a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5.5 8Z" />
          <Path {...common} d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </>
      ) : name === "tote" ? (
        <>
          <Rect {...common} x="3.2" y="6.4" width="17.6" height="13.2" rx="3" />
          <Path {...common} d="M9 10.2a3 3 0 0 0 6 0" />
        </>
      ) : name === "star" ? (
        <Path {...common} d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.5 9.6l5.2-.7L12 4Z" />
      ) : name === "share" ? (
        <>
          <Path {...common} d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <Path {...common} d="M12 3v13M8 7l4-4 4 4" />
        </>
      ) : name === "sound" ? (
        <>
          <Path {...common} d="M4 9v6h4l5 4V5L8 9H4Z" />
          <Path {...common} d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" />
        </>
      ) : (
        <Path {...common} strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
      )}
    </Svg>
  );
}

function Action({ icon, label, onPress, active, highlight }: { icon: React.ReactNode; label?: string; onPress: () => void; active?: boolean; highlight?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={6}>
      <View style={[styles.actionCircle, highlight ? styles.actionHighlight : active ? styles.actionActive : null]}>{icon}</View>
      {label ? <Text style={styles.actionLabel}>{label}</Text> : null}
    </Pressable>
  );
}

const compact = (n: number) =>
  n >= 1000000
    ? (Math.round(n / 100000) / 10).toString() + "M"
    : n >= 1000
      ? (Math.round(n / 100) / 10).toString() + "K"
      : String(n);

/**
 * The picture on a reel's tile: a frame from the reel's own video, the way a
 * feed of videos looks, and the live's cover only while the video is still
 * being converted and has no frames to give.
 */
function thumbOf(r: Reel): string | null {
  const u = r.recordingUrl || "";
  const at = u.indexOf("/manifest/");
  if (u.indexOf("cloudflarestream.com") >= 0 && at > 0) return u.slice(0, at) + "/thumbnails/thumbnail.jpg?time=2s&height=480";
  return r.coverUrl;
}

/**
 * One tile. The frame shows at once; when it is this tile's turn the reel
 * itself plays over it, silently, and fades back to the frame when the turn
 * passes on.
 */
function GridTile({ reel, width, height, playing, onPress, children }: { reel: Reel; width: number; height: number; playing: boolean; onPress: () => void; children: React.ReactNode }) {
  const player = useVideoPlayer(playing && reel.recordingUrl ? reel.recordingUrl : null, (pl) => {
    pl.loop = true;
    pl.muted = true;
  });
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => setMoving(Boolean(e.isPlaying)));
    return () => sub.remove();
  }, [player]);
  useEffect(() => {
    if (playing) player.play();
    else {
      player.pause();
      setMoving(false);
    }
  }, [player, playing]);
  const thumb = thumbOf(reel);
  return (
    <Pressable onPress={onPress} style={{ width, height, backgroundColor: "#e2e8f0" }}>
      {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {playing ? (
        <VideoView player={player} style={[StyleSheet.absoluteFill, { opacity: moving ? 1 : 0 }]} contentFit="cover" nativeControls={false} />
      ) : null}
      {children}
    </Pressable>
  );
}

/** How many tiles play at once, and how long each turn lasts. */
const AT_ONCE = 2;
const TURN_MS = 6000;

/** The grid: every reel at a glance, a search above it, like Explore. */
function ReelGrid({
  reels,
  width,
  height,
  query,
  onQuery,
  onOpen,
}: {
  reels: Reel[];
  width: number;
  /** The whole screen's height, so four reels fill it exactly. */
  height: number;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (index: number) => void;
}) {
  // Two across and two down: four reels to a screen, big enough to watch,
  // and the rest below on scrolling. The search box takes 60 points.
  const tile = (width - GRID_GAP) / 2;
  const tileH = Math.max(Math.round(tile * 1.2), Math.floor((height - 60 - GRID_GAP) / 2));
  // Which tiles are on screen, and whose turn it is to play.
  const [visible, setVisible] = useState<number[]>([]);
  const [turn, setTurn] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisible(viewableItems.map((v) => v.index).filter((i): i is number => typeof i === "number").sort((a, b) => a - b));
  }).current;
  useEffect(() => {
    const t = setInterval(() => setTurn((n) => n + 1), TURN_MS);
    return () => clearInterval(t);
  }, []);
  const playingNow = new Set<number>();
  if (visible.length) {
    for (let k = 0; k < Math.min(AT_ONCE, visible.length); k++) {
      playingNow.add(visible[(turn * AT_ONCE + k) % visible.length]);
    }
  }
  return (
    <View style={styles.gridScreen}>
      <View style={styles.searchBox}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.2-3.2" stroke="#64748b" strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search"
          placeholderTextColor="#64748b"
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>
      {reels.length === 0 ? (
        <Text style={styles.gridEmpty}>{query ? "No reels match your search." : "Nothing to watch yet."}</Text>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={{ gap: GRID_GAP, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          renderItem={({ item, index }) => {
            return (
              <GridTile reel={item} width={tile} height={tileH} playing={playingNow.has(index)} onPress={() => onOpen(index)}>
                {/* A reel, not a photo: the mark Instagram puts in the corner. */}
                <View style={styles.tileMark} pointerEvents="none">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3.2" stroke="#ffffff" strokeWidth={1.8} />
                    <Path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="#ffffff" />
                  </Svg>
                </View>
                {(item.views ?? 0) > 0 ? (
                  <View style={styles.tileCount}>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="#ffffff" strokeWidth={1.8} />
                      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#ffffff" strokeWidth={1.8} />
                    </Svg>
                    <Text style={styles.tileCountText}>{compact(item.views ?? 0)}</Text>
                  </View>
                ) : item.likes > 0 ? (
                  <View style={styles.tileCount}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="#ffffff">
                      <Path d="M12 20s-7.2-4.5-9.1-8.4C1.3 8.3 3.1 5 6.4 5c2 0 3.3 1.1 4.1 2.2l1.5 2 1.5-2C14.3 6.1 15.6 5 17.6 5c3.3 0 5.1 3.3 3.5 6.6C19.2 15.5 12 20 12 20Z" />
                    </Svg>
                    <Text style={styles.tileCountText}>{compact(item.likes)}</Text>
                  </View>
                ) : null}
              </GridTile>
            );
          }}
        />
      )}
    </View>
  );
}

const GRID_GAP = 2;

/* ---- the products under a reel: a ring that drifts while there are several -- */
const CARD = 84;
const GAP = 8;

function ProductRing({
  products,
  added,
  onOpen,
  onAdd,
}: {
  products: ReelProduct[];
  added: string | null;
  onOpen: (p: ReelProduct) => void;
  onAdd: (p: ReelProduct) => void;
}) {
  const many = products.length > 1;
  // Laid end to end twice, so the second copy is already arriving as the
  // first leaves and the row never visibly jumps back to the start.
  const ring = many ? products.concat(products) : products;
  const half = products.length * (CARD + GAP);
  const drift = useRef(new Animated.Value(0)).current;
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!many || held) return;
    drift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: -half, duration: half * 45, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [many, held, half, drift]);

  const card = (p: ReelProduct, i: number) => {
    const soldOut = (p.available ?? 0) <= 0;
    const on = added === p.id;
    return (
      <View key={p.id + "-" + i} style={styles.card}>
        <Pressable onPress={() => onOpen(p)}>
          <View style={styles.cardPhoto}>
            {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={[styles.cardImage, soldOut ? { opacity: 0.45 } : null]} /> : null}
          </View>
          <Text style={styles.cardName} numberOfLines={1}>{p.productName}</Text>
          <Text style={styles.cardPrice}>{p.price != null ? money(p.price) : ""}</Text>
        </Pressable>
        <Pressable
          disabled={soldOut}
          onPress={() => onAdd(p)}
          style={[styles.cardButton, soldOut ? styles.cardButtonOff : on ? styles.cardButtonOn : null]}
        >
          <Text style={styles.cardButtonText} numberOfLines={1}>{soldOut ? "SOLD OUT" : on ? "ADDED" : "ADD TO CART"}</Text>
        </Pressable>
      </View>
    );
  };

  // A thumb on the row stops the drift exactly where it is and hands the row
  // over to her, rather than snapping it back to the start.
  const row = useRef<ScrollView | null>(null);
  const hold = () => {
    if (held) return;
    drift.stopAnimation((at) => {
      drift.setValue(0);
      row.current?.scrollTo({ x: -at, animated: false });
    });
    setHeld(true);
  };

  if (!many) return <View style={[styles.ring, styles.ringRow]}>{ring.map(card)}</View>;
  return (
    <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} style={styles.ring} onTouchStart={hold}>
      <Animated.View style={[styles.ringRow, { transform: [{ translateX: drift }] }]}>{ring.map(card)}</Animated.View>
    </ScrollView>
  );
}

/* ---- one reel ---------------------------------------------------------- */
function ReelItem({
  reel,
  height,
  active,
  near,
  muted,
  cartCount,
  onToggleSound,
  onClose,
  onOpenProduct,
  onAdd,
  onCheckout,
  onReview,
  onShowProducts,
}: {
  reel: Reel;
  height: number;
  active: boolean;
  near: boolean;
  muted: boolean;
  cartCount: number;
  onToggleSound: () => void;
  onClose: () => void;
  onOpenProduct: (p: ReelProduct) => void;
  onAdd: (p: ReelProduct) => void;
  onCheckout: () => void;
  onReview: (p: ReelProduct | null) => void;
  onShowProducts: () => void;
}) {
  // Only the reels about to be seen are given a source; the rest cost nothing.
  const player = useVideoPlayer(near && reel.recordingUrl ? reel.recordingUrl : null, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const [playing, setPlaying] = useState(false);
  const [likes, setLikes] = useState(reel.likes);
  const [liked, setLiked] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => setPlaying(Boolean(e.isPlaying)));
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [player, active]);

  // A view, once it has actually been watched for two seconds.
  useEffect(() => {
    if (!active || !playing || counted.has(reel.id)) return;
    const t = setTimeout(() => {
      counted.add(reel.id);
      viewReel(reel.id);
    }, 2000);
    return () => clearTimeout(t);
  }, [active, playing, reel.id]);

  useEffect(() => {
    AsyncStorage.getItem(LIKED + reel.id)
      .then((v) => setLiked(v === "1"))
      .catch(() => {});
  }, [reel.id]);

  // The heart fills at once; the shop is told afterwards, and taking it back
  // is the same tap.
  const like = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    (next ? AsyncStorage.setItem(LIKED + reel.id, "1") : AsyncStorage.removeItem(LIKED + reel.id)).catch(() => {});
    likeReel(reel.id, next)
      .then((n) => setLikes(n))
      .catch(() => {});
  };

  const share = () => {
    const url = SITE_ORIGIN + "/store/reels?reel=" + encodeURIComponent(reel.id);
    Share.share({ message: url, url, title: reel.title }).catch(() => {});
  };

  const add = (p: ReelProduct) => {
    onAdd(p);
    setAdded(p.id);
    setTimeout(() => setAdded((cur) => (cur === p.id ? null : cur)), 1800);
  };

  const ordered = useMemo(
    () => reel.products.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder),
    [reel.products],
  );

  return (
    <View style={[styles.reel, { height }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onToggleSound}>
        {near ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : null}
        {/* The cover until the first frame, never a black screen. */}
        {!playing && reel.coverUrl ? <Image source={{ uri: reel.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {!playing && active && reel.recordingUrl ? (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}
      </Pressable>

      <Fade angle={0} colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0)", "rgba(0,0,0,0)"]} locations={[0, 0.45, 1]} style={styles.shade} />

      <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
        <Icon name="close" />
      </Pressable>

      {muted && playing ? (
        <Pressable style={styles.soundPill} onPress={onToggleSound}>
          <Icon name="sound" />
          <Text style={styles.soundText}>Tap for sound</Text>
        </Pressable>
      ) : null}

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.bottomLeft} pointerEvents="box-none">
          {ordered.length ? <ProductRing products={ordered} added={added} onOpen={onOpenProduct} onAdd={add} /> : null}
        </View>
        <View style={styles.actions}>
          <Action icon={<Icon name="heart" filled={liked} />} label={likes > 0 ? compact(likes) : ""} onPress={like} active={liked} />
          {ordered.length ? <Action icon={<Icon name="bag" />} label={String(ordered.length)} onPress={onShowProducts} /> : null}
          {cartCount > 0 ? <Action icon={<Icon name="tote" />} label={String(cartCount)} onPress={onCheckout} highlight /> : null}
          <Action icon={<Icon name="star" />} label="Review" onPress={() => onReview(ordered.find((p) => p.pinned) ?? ordered[0] ?? null)} />
          <Action icon={<Icon name="share" />} onPress={share} />
        </View>
      </View>
    </View>
  );
}

/* ---- the feed ------------------------------------------------------------ */
export function ReelsScreen({
  startId,
  paused,
  cartCount,
  onClose,
  onOpenProduct,
  onAdd,
  onCheckout,
  onOpenPage,
}: {
  /** Open on this reel rather than the newest. */
  startId: string | null;
  /** Covered by a product opened from it: nothing plays underneath. */
  paused: boolean;
  cartCount: number;
  onClose: () => void;
  onOpenProduct: (itemId: string) => void;
  onAdd: (itemId: string) => void;
  onCheckout: () => void;
  /** One of the website's pages, inside the app (the review form). */
  onOpenPage: (path: string) => void;
}) {
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [sheet, setSheet] = useState<Reel | null>(null);
  const [width, setWidth] = useState(0);
  // The grid first; a reel opens full screen on top of it. A replay tapped
  // somewhere else in the app opens straight onto that reel.
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchReels()
      .then((list) => {
        const playable = list.filter((r) => r.recordingUrl);
        setReels(playable);
        const at = startId ? playable.findIndex((r) => r.id === startId) : -1;
        if (at >= 0) {
          setIndex(at);
          setOpen(true);
        }
      })
      .catch(() => setFailed(true));
  }, [startId]);

  // The phone's back button closes the reel before it leaves the tab.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  // What the search matches: the reel, its host, and what was sold in it.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!reels || !q) return reels ?? [];
    return reels.filter((r) =>
      [r.title, r.hostName ?? "", ...r.products.map((p) => p.productName)].join(" ").toLowerCase().includes(q),
    );
  }, [reels, query]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first && typeof first.index === "number") setIndex(first.index);
  }).current;

  const openProduct = useCallback((p: ReelProduct) => p.itemId && onOpenProduct(p.itemId), [onOpenProduct]);
  const add = useCallback((p: ReelProduct) => p.itemId && onAdd(p.itemId), [onAdd]);

  const review = (p: ReelProduct | null) => {
    onOpenPage(p && p.itemId ? "/shop/reviews?product=" + encodeURIComponent(p.itemId) : "/shop/reviews");
  };

  return (
    <View
      style={[styles.screen, open ? null : styles.gridScreen]}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      {!reels || !height ? (
        <View style={styles.center}>
          {failed ? (
            <Text style={[styles.empty, open ? null : { color: "#0f172a" }]}>Reels could not be loaded.</Text>
          ) : (
            <ActivityIndicator color={open ? "#ffffff" : "#94a3b8"} />
          )}
        </View>
      ) : !open ? (
        <ReelGrid
          reels={shown}
          width={width}
          height={height}
          query={query}
          onQuery={setQuery}
          onOpen={(i) => {
            setIndex(i);
            setOpen(true);
          }}
        />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          decelerationRate="fast"
          renderItem={({ item, index: i }) => (
            <ReelItem
              reel={item}
              height={height}
              active={!paused && open && i === index}
              near={Math.abs(i - index) <= 1}
              muted={muted}
              cartCount={cartCount}
              onToggleSound={() => setMuted((m) => !m)}
              onClose={() => setOpen(false)}
              onOpenProduct={openProduct}
              onAdd={add}
              onCheckout={onCheckout}
              onReview={review}
              onShowProducts={() => setSheet(item)}
            />
          )}
        />
      )}

      {/* Everything that was sold in this reel. */}
      <Modal visible={Boolean(sheet)} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.sheetVeil} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>In this live</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(sheet?.products ?? []).map((p) => {
                const soldOut = (p.available ?? 0) <= 0;
                return (
                  <View key={p.id} style={styles.sheetRow}>
                    <Pressable
                      style={styles.sheetMain}
                      onPress={() => {
                        setSheet(null);
                        openProduct(p);
                      }}
                    >
                      <View style={styles.sheetPhoto}>{p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.cardImage} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetName} numberOfLines={2}>{p.productName}</Text>
                        <Text style={styles.sheetPrice}>{p.price != null ? money(p.price) : ""}</Text>
                      </View>
                    </Pressable>
                    <Pressable disabled={soldOut} onPress={() => add(p)} style={[styles.sheetAdd, soldOut ? styles.cardButtonOff : null]}>
                      <Text style={styles.cardButtonText}>{soldOut ? "SOLD OUT" : "ADD"}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  gridScreen: { flex: 1, backgroundColor: "#ffffff" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 10, marginBottom: 10, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#efefef" },
  searchInput: { flex: 1, fontSize: 16, color: "#0f172a", paddingVertical: 0 },
  gridEmpty: { padding: 32, textAlign: "center", fontSize: 14, color: "#64748b" },
  tileMark: { position: "absolute", top: 6, right: 6 },
  tileCount: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  tileCountText: { color: "#ffffff", fontSize: 13, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "#ffffff", fontSize: 14, opacity: 0.8 },
  reel: { width: "100%", backgroundColor: "#000000", overflow: "hidden" },
  spinner: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  close: { position: "absolute", top: 14, left: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  soundPill: { position: "absolute", alignSelf: "center", top: "45%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  soundText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", padding: 12, paddingBottom: 16, gap: 12 },
  bottomLeft: { flex: 1, minWidth: 0 },
  actions: { alignItems: "center", gap: 14, paddingBottom: 4 },
  action: { width: 48, alignItems: "center" },
  actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  actionActive: { backgroundColor: "rgba(225,29,72,0.9)" },
  actionHighlight: { backgroundColor: "#e11d48" },
  actionLabel: { marginTop: 4, color: "#ffffff", fontSize: 10, fontWeight: "700" },
  ring: { maxWidth: 260 },
  ringRow: { flexDirection: "row", gap: GAP },
  card: { width: CARD, marginRight: 0 },
  cardPhoto: { width: CARD, height: CARD, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  cardImage: { width: "100%", height: "100%" },
  cardName: { marginTop: 4, color: "#ffffff", fontSize: 10, fontWeight: "500", textAlign: "center" },
  cardPrice: { marginTop: 1, color: "#ffffff", fontSize: 10, fontWeight: "700", textAlign: "center" },
  cardButton: { marginTop: 4, borderRadius: 8, paddingVertical: 6, alignItems: "center", backgroundColor: "#8a5a2b" },
  cardButtonOn: { backgroundColor: "#059669" },
  cardButtonOff: { backgroundColor: "rgba(255,255,255,0.25)" },
  cardButtonText: { color: "#ffffff", fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  sheetVeil: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 28 },
  sheetGrip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1", marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  sheetMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  sheetPhoto: { width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: "#f1f5f9" },
  sheetName: { fontSize: 13, color: "#0f172a" },
  sheetPrice: { marginTop: 2, fontSize: 13, fontWeight: "700", color: "#0f172a" },
  sheetAdd: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#8a5a2b" },
});
`,
  };
}

// The editor's icons, path for path (src/components/app-tab-icons.tsx and
// app-header.tsx). Emoji stood in for them before, and looked like someone
// else's app.
function iconsFile(): GeneratedFile {
  return {
    path: "components/Icons.tsx",
    language: "tsx",
    contents: `/**
 * The editor's own icons, drawn the same way here, so the phone and the
 * dashboard show the same marks. Generated from the dashboard — App → App theme.
 */
import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { TabKey } from "./TabBar";

export function TabIcon({
  tab,
  on = false,
  color,
  size = 21,
}: {
  tab: TabKey;
  on?: boolean;
  color: string;
  size?: number;
}) {
  const tint = (opacity: number) => (on ? { fill: "currentColor", fillOpacity: opacity } : {});
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {tab === "live" ? (
        <>
          <Circle cx="12" cy="12" r="3.1" fill={on ? "currentColor" : "none"} />
          <Path d="M7.8 7.8a5.9 5.9 0 0 0 0 8.4M16.2 16.2a5.9 5.9 0 0 0 0-8.4" />
          <Path d="M5 5a9.9 9.9 0 0 0 0 14M19 19a9.9 9.9 0 0 0 0-14" opacity={0.55} />
        </>
      ) : tab === "reels" ? (
        <>
          <Rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3.2" {...tint(0.12)} />
          <Path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="currentColor" />
        </>
      ) : tab === "cart" ? (
        <>
          <Path d="M5.4 8.4h13.2l-1 11.1a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5Z" {...tint(0.14)} />
          <Path d="M8.9 10.4V7.2a3.1 3.1 0 0 1 6.2 0v3.2" />
        </>
      ) : tab === "orders" ? (
        <>
          <Path d="M6 3.6h12v15.8l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" {...tint(0.12)} />
          <Path d="M9 8h6M9 11.6h6M9 15.2h3.5" />
        </>
      ) : tab === "account" ? (
        <>
          <Circle cx="12" cy="8.4" r="3.4" {...tint(0.18)} />
          <Path d="M4.9 20.1a7.6 7.6 0 0 1 14.2 0" />
        </>
      ) : (
        <>
          <Path d="M3.6 9.2 5 4.8h14l1.4 4.4" />
          <Path d="M3.6 9.2a2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0" />
          <Path d="M5 11.4V19h14v-7.6" {...tint(0.14)} />
          <Path d="M10 19v-4.2h4V19" />
        </>
      )}
    </Svg>
  );
}

export type HeaderIconName = "search" | "heart" | "bag" | "back";

export function HeaderIcon({ name, color, size = 18 }: { name: HeaderIconName; color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "search" ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "search" ? (
        <>
          <Circle cx="11" cy="11" r="7" />
          <Path d="m20 20-3.2-3.2" />
        </>
      ) : name === "heart" ? (
        <Path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
      ) : name === "bag" ? (
        <>
          <Path d="M6 8h12l-1 12H7L6 8Z" />
          <Path d="M9 8a3 3 0 0 1 6 0" />
        </>
      ) : (
        <Path d="M15 5l-7 7 7 7" />
      )}
    </Svg>
  );
}
`,
  };
}

// CSS gradients, drawn natively. The sections used to fake them with stacked
// flat panels, which showed as hard bands and grey boxes over photographs.
function fadeFile(): GeneratedFile {
  return {
    path: "components/Fade.tsx",
    language: "tsx",
    contents: `/**
 * A linear gradient given the way the editor gives one: a CSS angle and its
 * stops. Generated from the dashboard — App → App theme.
 */
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function Fade({
  angle = 180,
  colors,
  locations,
  style,
  children,
}: {
  /** CSS degrees: 0 runs bottom to top, 90 left to right, 180 top to bottom. */
  angle?: number;
  colors: string[];
  locations?: number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  return (
    <LinearGradient
      colors={colors as unknown as readonly [string, string, ...string[]]}
      locations={locations as unknown as readonly [number, number, ...number[]] | undefined}
      start={{ x: 0.5 - dx, y: 0.5 - dy }}
      end={{ x: 0.5 + dx, y: 0.5 + dy }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/** A hex colour part of the way to another - for a CSS stop past 100%. */
export function mix(from: string, to: string, t: number): string {
  const rgb = (hex: string) => {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = rgb(from);
  const b = rgb(to);
  if (!a || !b) return to;
  const part = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, "0");
  return "#" + part(0) + part(1) + part(2);
}
`,
  };
}

// The announcement, the header and the shortcut strip, in the editor's order,
// above every screen - not only Home, which left product pages without a
// header at all.
function chromeFile(): GeneratedFile {
  return {
    path: "components/AppChrome.tsx",
    language: "tsx",
    contents: `/**
 * What sits above every screen, in the editor's order: the announcement, the
 * header, and the row of shortcuts under it. Generated from the dashboard —
 * App → App theme.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, theme } from "../theme";
import { HeaderIcon } from "./Icons";
import { openLink } from "./Pieces";

const LOGO_HEIGHT = 20;

export function AppChrome({
  query,
  onQuery,
  cartCount = 0,
  onHome,
  onBag,
  onWishlist,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
  suggest = [],
}: {
  query: string;
  onQuery: (value: string) => void;
  /** Collection names the empty search box offers, after the shop's own wording. */
  suggest?: string[];
  cartCount?: number;
  onHome?: () => void;
  onBag?: () => void;
  onWishlist?: () => void;
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const ink = theme.header.ink || "#191614";
  const bg = theme.header.bg || "#ffffff";

  /**
   * What the box offers while it is empty.
   *
   * The shop's own wording first, then its collections - so it can never name
   * something the shop does not sell. It changes only while the box is empty:
   * a hint that moves under a cursor has become an obstacle.
   */
  const hints = Array.from(
    new Set(
      [theme.header.searchPlaceholder, ...suggest]
        .map((h) => String(h ?? "").trim())
        .filter((h) => h.length > 0 && h.length <= 34),
    ),
  ).slice(0, 8);
  const [hintAt, setHintAt] = useState(0);
  useEffect(() => {
    if (hints.length < 2 || query) return;
    const t = setInterval(() => setHintAt((i) => (i + 1) % hints.length), 2600);
    return () => clearInterval(t);
  }, [hints.length, query]);
  const hint = hints.length ? hints[hintAt % hints.length] : theme.header.searchPlaceholder;
  const wordmark = theme.header.logoText || theme.storeName;

  // The logo keeps its own proportions at the header's height, as it does in
  // the editor, rather than being squeezed into a fixed box.
  const [logoRatio, setLogoRatio] = useState(4.5);
  useEffect(() => {
    if (!theme.logoUrl) return;
    Image.getSize(
      theme.logoUrl,
      (w, h) => {
        if (w > 0 && h > 0) setLogoRatio(w / h);
      },
      () => {},
    );
  }, []);

  // The shortcut row travels one way and never arrives. Turning round at the
  // end trades a row that looks finished for a row that visibly bounces off a
  // wall, so the shortcuts are laid down twice and the travel resets at the
  // seam: the second copy is the first, so the join cannot be seen. It runs on
  // the native thread, because stepping the scroll position from JavaScript
  // every few milliseconds is what made it stutter, and it yields to a thumb
  // and picks up again a couple of seconds after it lifts.
  const [stripOn, setStripOn] = useState(0);
  const [stripHeld, setStripHeld] = useState(false);
  const [far, setFar] = useState(0);
  const strip = useRef<ScrollView | null>(null);
  const stripSize = useRef({ rail: 0, content: 0 });
  const drift = useRef(new Animated.Value(0)).current;
  // Half the content, because by then the row is holding two copies of
  // itself: one copy's width is exactly how far it can travel before the
  // second copy is standing where the first was.
  const measure = () => setFar(Math.max(0, stripSize.current.content / 2));
  useEffect(() => {
    if (stripHeld || far <= 1) return;
    // The editor's pace: about twenty-five points a second.
    const ms = (far / 25) * 1000;
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: -far, duration: ms, easing: Easing.linear, useNativeDriver: true }),
    );
    drift.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [stripHeld, far, drift]);
  // Stopping for good would leave the shortcuts past the fold unseen for the
  // rest of the visit, so the row picks itself up again.
  useEffect(() => {
    if (!stripHeld) return;
    const t = setTimeout(() => setStripHeld(false), 2000);
    return () => clearTimeout(t);
  }, [stripHeld]);
  // Hand the row to the thumb exactly where the drift left it.
  const hold = () => {
    if (stripHeld) return;
    drift.stopAnimation((at) => {
      drift.setValue(0);
      strip.current?.scrollTo({ x: -at, animated: false });
    });
    setStripHeld(true);
  };

  return (
    <View>
      {theme.announcement.enabled && theme.announcement.text ? (
        <View style={styles.announcement}>
          <Text style={styles.announcementText}>{theme.announcement.text}</Text>
        </View>
      ) : null}

      <View style={[styles.header, { backgroundColor: bg }]}>
        <View style={styles.topRow}>
        <Pressable onPress={onHome} disabled={!onHome} hitSlop={6} style={styles.home}>
          {theme.logoUrl ? (
            <Image
              source={{ uri: theme.logoUrl }}
              style={{ height: LOGO_HEIGHT, width: Math.min(160, LOGO_HEIGHT * logoRatio) }}
              resizeMode="contain"
            />
          ) : wordmark || theme.header.logoAccentText ? (
            <Text style={[styles.wordmark, { color: ink }]}>
              {wordmark}
              {theme.header.logoAccentText ? (
                <Text style={{ color: colors.accent }}>{theme.header.logoAccentText}</Text>
              ) : null}
            </Text>
          ) : null}
        </Pressable>

        {theme.header.showWishlist ? (
          <Pressable style={styles.iconButton} onPress={onWishlist} hitSlop={4}>
            <HeaderIcon name="heart" color={ink} />
          </Pressable>
        ) : null}
        {theme.header.showBag ? (
          <Pressable style={styles.iconButton} onPress={onBag} hitSlop={4}>
            <HeaderIcon name="bag" color={ink} />
            {cartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        </View>

        {/* The whole of the second line, which is the only way a placeholder
            gets to say anything longer than two words. */}
        {theme.showSearch ? (
          <View style={styles.searchRow}>
            <View style={styles.searchIcon} pointerEvents="none">
              <HeaderIcon name="search" color={ink + "80"} size={15} />
            </View>
            <TextInput
              style={[styles.search, { color: ink }]}
              value={query}
              onChangeText={onQuery}
              placeholder={hint}
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}
      </View>

      {theme.strip.enabled && theme.strip.items.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={strip}
          onLayout={(e) => {
            stripSize.current.rail = e.nativeEvent.layout.width;
            measure();
          }}
          onContentSizeChange={(w) => {
            stripSize.current.content = w;
            measure();
          }}
          onTouchStart={hold}
          style={styles.strip}
          contentContainerStyle={styles.stripPad}
        >
          <Animated.View style={[styles.stripRow, { transform: [{ translateX: drift }] }]}>
          {[...theme.strip.items, ...theme.strip.items].map((item, i) => {
            const which = i % theme.strip.items.length;
            const on = which === stripOn;
            return (
              <Pressable
                key={item.id + (i >= theme.strip.items.length ? "-again" : "")}
                onPress={() => {
                  setStripOn(which);
                  openLink(item, { onOpenCollection, onOpenProduct, onOpenScreen });
                }}
                style={[styles.stripItem, { borderBottomColor: on ? colors.accent : "transparent" }]}
              >
                <Text style={[styles.stripText, { color: on ? colors.accent : "#64748b" }]}>{item.label}</Text>
              </Pressable>
            );
          })}
          </Animated.View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  announcement: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12 },
  announcementText: { color: "#ffffff", fontSize: 11, fontWeight: "500", textAlign: "center" },
  header: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchRow: { marginTop: 8, justifyContent: "center" },
  home: { flex: 1, minWidth: 0, justifyContent: "center" },
  wordmark: { fontSize: 13, fontWeight: "800", letterSpacing: -0.3 },
  searchIcon: { position: "absolute", left: 10, zIndex: 1 },
  search: { height: 36, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", paddingLeft: 36, paddingRight: 12, paddingVertical: 0, fontSize: 12 },
  iconButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  badgeText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  strip: { flexGrow: 0, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  stripPad: { paddingHorizontal: 16 },
  stripRow: { flexDirection: "row", gap: 16 },
  stripItem: { paddingVertical: 8, borderBottomWidth: 2 },
  stripText: { fontSize: 12, fontWeight: "600" },
});
`,
  };
}

function tabBarFile(): GeneratedFile {
  return {
    path: "components/TabBar.tsx",
    language: "tsx",
    contents: `/** The bar along the bottom. Generated from the dashboard — App → App theme. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, layout, radius } from "../theme";
import { TabIcon } from "./Icons";

export type TabKey = ${TAB_KEYS.map((k) => q(k)).join(" | ")};

const KEYS: string[] = [${TAB_KEYS.filter((k) => k !== "live").map((k) => q(k)).join(", ")}];

/**
 * Order, wording and which appear are the merchant's, from the theme the app
 * fetched; the keys are the app's.
 */
export function visibleTabs(): { key: TabKey; label: string }[] {
  return layout.tabs.filter((t) => KEYS.indexOf(t.key) >= 0) as { key: TabKey; label: string }[];
}

export function TabBar({
  active,
  cartCount = 0,
  onSelect,
}: {
  active: TabKey;
  cartCount?: number;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <View style={styles.bar}>
      {visibleTabs().map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)}>
            <TabIcon tab={t.key} on={on} color={on ? colors.accent : colors.inkMuted} />
            <Text style={[styles.label, on ? styles.on : styles.off]}>{t.label}</Text>
            {t.key === "cart" && cartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  label: { fontSize: 11, fontWeight: "600" },
  on: { color: colors.accent },
  // inkSoft on white is about 2.5:1 - under the 4.5:1 a label this size needs,
  // and the reason four of the five tabs read as disabled. inkMuted clears it
  // and still sits behind the one that is selected.
  off: { color: colors.inkMuted },
  badge: { position: "absolute", top: 4, right: "26%", minWidth: 16, height: 16, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
});
`,
  };
}

function screensFile(theme: AppTheme): GeneratedFile {
  return {
    path: "screens.ts",
    language: "ts",
    contents: `/**
 * Wording and options for every screen below home.
 * Generated from the dashboard: App → App theme.
 *
 * An empty string means "use the app's own word", so a shop that has not
 * chosen one still reads correctly in the shopper's language.
 */

/**
 * Not \`as const\`: a saved 2 would then be the *type* 2, and code that asks
 * "is this 3?" would be told the question is meaningless. These are values the
 * merchant changes, not constants of the app.
 */
export const screens = ${JSON.stringify(theme.screens, null, 2)};

export type Screens = typeof screens;

/** The merchant's word when they chose one, otherwise the app's. */
export const say = (chosen: string, fallback: string) => chosen || fallback;
`,
  };
}

function cartScreenFile(placed: boolean): GeneratedFile {
  return {
    path: "components/CartScreen.tsx",
    language: "tsx",
    contents: `/** The basket. Wording comes from screens.ts — App → App theme. */
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens, say } from "../screens";
import { money } from "./Pieces";
import type { Gift } from "../api";${placed ? '\nimport { CartSections } from "../HomeScreen";' : ""}

export type CartLine = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
};

export function CartScreen({
  lines,
  subtotal,
  discount = 0,
  gifts = [],
  giftNote = null,
  giftBusy = null,
  onUseGift,
  onChangeQuantity,
  onApplyCoupon,
  onCheckout,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
  onAddBundle,
}: {
  lines: CartLine[];
  subtotal: number;
  discount?: number;
  /** Rewards she can spend on this basket. Empty for a guest. */
  gifts?: Gift[];
  /** What she is closest to, when none of them is hers yet. */
  giftNote?: string | null;
  giftBusy?: string | null;
  onUseGift?: (gift: Gift) => void;
  onChangeQuantity: (itemId: string, quantity: number) => void;
  onApplyCoupon?: (code: string) => void;
  onCheckout: () => void;
  /** Where a section placed on the basket can send her. */
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
  /** A section placed here that fills the basket itself, like a bundle. */
  onAddBundle?: (variantId: string, productId: string) => void;
}) {
  const c = screens.cart;
  const [code, setCode] = useState("");
  const total = Math.max(0, subtotal - discount);

  if (!lines.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{say(c.emptyText, "The basket is empty")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        {lines.map((l) => (
          <View key={l.itemId} style={styles.line}>
            {l.imageUrl ? (
              <Image source={{ uri: l.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>{l.productName}</Text>
              <Text style={styles.price}>{money(l.price)}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                style={styles.step}
                onPress={() => onChangeQuantity(l.itemId, l.quantity - 1)}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{l.quantity}</Text>
              <Pressable
                style={[styles.step, l.quantity >= l.maxAvailable ? styles.stepOff : null]}
                disabled={l.quantity >= l.maxAvailable}
                onPress={() => onChangeQuantity(l.itemId, l.quantity + 1)}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}

${placed ? "        {/* What the merchant put beside the basket. */}\n        <CartSections onOpenCollection={onOpenCollection} onOpenProduct={onOpenProduct} onOpenScreen={onOpenScreen} onAdd={onAddBundle} signedIn />\n" : ""}        {(gifts.length || giftNote) && onUseGift && !discount ? (
          <View style={styles.gifts}>
            <Text style={styles.giftsTitle}>YOUR REWARDS</Text>
            {gifts.map((g) => (
              <Pressable
                key={g.id}
                style={styles.gift}
                disabled={Boolean(giftBusy)}
                onPress={() => onUseGift(g)}
              >
                <View style={styles.giftText}>
                  <Text style={styles.giftName} numberOfLines={1}>{g.title}</Text>
                  <Text style={styles.giftNote} numberOfLines={1}>
                    {g.detail + (g.cost > 0 ? " · " + g.cost + " signatures" : "")}
                  </Text>
                </View>
                <Text style={styles.giftCta}>
                  {giftBusy === g.id ? "…" : g.ready ? "Use" : "Redeem"}
                </Text>
              </Pressable>
            ))}
            {!gifts.length && giftNote ? <Text style={styles.giftNote}>{giftNote}</Text> : null}
          </View>
        ) : null}

        {c.showCoupon && onApplyCoupon ? (
          <View style={styles.coupon}>
            <TextInput
              style={styles.couponInput}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder={say(c.couponLabel, "Discount code")}
              placeholderTextColor={colors.inkSoft}
            />
            <Pressable style={styles.couponCta} onPress={() => onApplyCoupon(code.trim())}>
              <Text style={styles.couponCtaText}>Apply</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{say(c.totalLabel, "Total")}</Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>
        <Pressable style={styles.cta} onPress={onCheckout}>
          <Text style={styles.ctaText}>{say(c.checkoutLabel, "Checkout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyText: { fontSize: 14, color: colors.inkSoft },
  list: { padding: spacing.lg, gap: spacing.sm },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.page },
  name: { fontSize: 12, color: colors.ink },
  price: { marginTop: 4, fontSize: 14, fontWeight: "700", color: colors.ink },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  stepOff: { opacity: 0.4 },
  stepText: { fontSize: 14, color: colors.inkMuted },
  qty: { width: 20, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.ink },
  gifts: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface, padding: 8, gap: 6, marginBottom: spacing.sm },
  giftsTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.accent },
  gift: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8 },
  giftText: { flex: 1 },
  giftName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  giftNote: { fontSize: 11, color: colors.inkSoft },
  giftCta: { fontSize: 12, fontWeight: "800", color: colors.accent },
  coupon: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 8 },
  couponInput: { flex: 1, height: 36, paddingHorizontal: 8, fontSize: 13, color: colors.ink },
  couponCta: { borderRadius: radius.sm, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8 },
  couponCtaText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: colors.inkMuted },
  total: { fontSize: 18, fontWeight: "700", color: colors.ink },
  cta: { marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent, paddingVertical: 12, alignItems: "center" },
  ctaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
`,
  };
}

function checkoutScreenFile(): GeneratedFile {
  return {
    path: "components/CheckoutScreen.tsx",
    language: "tsx",
    contents: `/**
 * Cash on delivery. Wording comes from screens.ts — App → App theme.
 *
 * Name, phone, governorate, city and address are always asked: an order
 * cannot be delivered without them and the server refuses an incomplete one.
 * The phone is the signed-in account's and cannot be edited — the server
 * refuses any other.
 */
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing, theme } from "../theme";
import { screens, say } from "../screens";
import { fetchPayments, type PaymentMethod } from "../api";

export type Address = {
  customerName: string;
  governorate: string;
  city: string;
  address: string;
  email?: string;
  note?: string;
  paymentMethod?: string | null;
};

export function CheckoutScreen({
  phone,
  busy,
  onPlace,
}: {
  phone: string;
  busy?: boolean;
  onPlace: (address: Address) => void;
}) {
  // What the shop accepts. A checkout that cannot reach the list still takes
  // cash at the door, so this never blocks the screen.
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [method, setMethod] = useState("");
  useEffect(() => {
    let alive = true;
    fetchPayments()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setMethods(list);
        const first = list.find((m) => m.kind === "cod") ?? list[0];
        if (first) setMethod(first.id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const c = screens.checkout;
  const [form, setForm] = useState<Address>({
    customerName: "",
    governorate: "",
    city: "",
    address: "",
    email: "",
    note: "",
  });
  const set = (k: keyof Address) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready = Boolean(form.customerName && form.governorate && form.city && form.address);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{say(c.title, "Cash on delivery")}</Text>
      {c.note ? <Text style={styles.note}>{c.note}</Text> : null}

      <Field label="Name" value={form.customerName} onChange={set("customerName")} />
      <Field label="Phone" value={phone} onChange={() => {}} editable={false} />
      {c.askEmail ? <Field label="Email" value={form.email ?? ""} onChange={set("email")} /> : null}
      <Field label="Governorate" value={form.governorate} onChange={set("governorate")} />
      <Field label="City" value={form.city} onChange={set("city")} />
      <Field label="Address" value={form.address} onChange={set("address")} />
      {c.askNote ? <Field label="Order note" value={form.note ?? ""} onChange={set("note")} /> : null}

      {methods.length ? (
        <View style={styles.pay}>
          <Text style={styles.payHead}>Payment</Text>
          <View style={styles.payList}>
            {methods.map((m, i) => {
              const on = m.id === method;
              return (
                <View key={m.id} style={i ? styles.payRowTop : null}>
                  <Pressable style={styles.payRow} onPress={() => setMethod(m.id)}>
                    <View style={[styles.dot, on ? { borderColor: colors.accent } : null]}>
                      {on ? <View style={styles.dotOn} /> : null}
                    </View>
                    <Text style={styles.payName} numberOfLines={1}>{m.name}</Text>
                    {m.logo ? (
                      <Image source={{ uri: m.logo }} style={styles.payLogo} resizeMode="contain" />
                    ) : m.kind !== "cod" ? (
                      <Text style={styles.payKind}>INSTALMENTS</Text>
                    ) : null}
                  </Pressable>
                  {on && m.note ? <Text style={styles.payNote}>{m.note}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Pressable
        style={[styles.cta, !ready || busy ? styles.ctaOff : null]}
        disabled={!ready || busy}
        onPress={() => onPlace({ ...form, paymentMethod: method || null })}
      >
        <Text style={styles.ctaText}>{say(c.placeLabel, "Place the order")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        style={[styles.input, editable ? null : styles.inputOff]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  note: { fontSize: 12, color: colors.inkSoft },
  label: { fontSize: 11, fontWeight: "500", color: colors.inkMuted },
  input: { marginTop: 4, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, fontSize: 14, color: colors.ink },
  inputOff: { backgroundColor: colors.page, color: colors.inkMuted },
  pay: { marginTop: spacing.lg },
  payHead: { marginBottom: 6, fontSize: 11, fontWeight: "600", color: colors.inkMuted },
  payList: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  payRowTop: { borderTopWidth: 1, borderTopColor: colors.line },
  payRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  dot: { height: 16, width: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  dotOn: { height: 8, width: 8, borderRadius: 4, backgroundColor: colors.accent },
  payName: { flex: 1, fontSize: 13, fontWeight: "500", color: colors.ink },
  payLogo: { height: 16, width: 44 },
  payKind: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, color: colors.inkSoft },
  payNote: { paddingHorizontal: 12, paddingBottom: 10, fontSize: 11, lineHeight: 16, color: colors.inkMuted },
  cta: { marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.accent, paddingVertical: 13, alignItems: "center" },
  ctaOff: { opacity: 0.5 },
  ctaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
`,
  };
}

// ---------------------------------------------------------- searching --
function searchScreenFile(): GeneratedFile {
  return {
    path: "components/SearchResults.tsx",
    language: "tsx",
    contents: `/**
 * What the search box on the front page turns up.
 *
 * The shop does the matching. An app that filtered a downloaded list could
 * only ever find what it had already fetched, which on a catalogue of any
 * size is a search that quietly lies about what the shop sells.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { searchProducts, type Card } from "../api";
import { ProductTile } from "./Pieces";

export function SearchResults({
  query,
  onOpenProduct,
}: {
  query: string;
  onOpenProduct: (id: string) => void;
}) {
  const [rows, setRows] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Typing is not a request; a pause is. Without this every letter is a
  // round trip, and the answers race each other back.
  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    const timer = setTimeout(() => {
      searchProducts(query)
        .then((d) => live && setRows(d.products))
        .catch((e) => live && setError(String(e.message ?? e)));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (error) return <Text style={styles.note}>{error}</Text>;
  if (!rows) return <ActivityIndicator style={styles.spinner} color={colors.accent} />;
  if (!rows.length) return <Text style={styles.note}>Nothing matches “{query}”.</Text>;

  return (
    <FlatList
      data={rows}
      numColumns={2}
      keyExtractor={(p) => p.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <View style={{ flex: 0.5 }}>
          <ProductTile card={item} fill onPress={onOpenProduct} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  spinner: { marginVertical: spacing.xl },
  note: { padding: spacing.xl, textAlign: "center", fontSize: 13, color: colors.inkSoft },
});
`,
  };
}

// ------------------------------------------------------- one collection --
function collectionScreenFile(): GeneratedFile {
  return {
    path: "components/CollectionScreen.tsx",
    language: "tsx",
    contents: `/**
 * One collection, dressed as Beauty Bar's website: a dark banner with the name
 * in italic serif, brand chips, a bar with filters and sorting, and cream cards
 * with caramel prices. Every part is the merchant's - App → App theme →
 * Collection.
 *
 * Filtering and sorting are requests to the shop, not a shuffle of what
 * arrived, so they cover the whole collection and not only the loaded page.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Fade } from "./Fade";
import { theme } from "../theme";
import { screens } from "../screens";
import { fetchCollection, type Card, type CollectionFilters, type CollectionPayload, type Sort } from "../api";
import { money } from "./Pieces";

const SORTS: { key: Sort; label: string }[] = [
  { key: "manual", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-ascending", label: "Price: low to high" },
  { key: "price-descending", label: "Price: high to low" },
  { key: "title-ascending", label: "A–Z" },
];

const NONE: CollectionFilters = { brands: [], min: 0, max: 0, inStock: false, onSale: false };

/**
 * A collection link can carry a narrowing: "all?minPrice=3000&maxPrice=4999"
 * is the whole shop between those prices, which is how a price tier opens.
 */
function splitLink(link: string): { handle: string; filters: CollectionFilters } {
  const parts = link.split("?");
  const params: Record<string, string> = {};
  (parts[1] || "").split("&").forEach((pair) => {
    const kv = pair.split("=");
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || "");
  });
  return {
    handle: parts[0],
    filters: {
      brands: (params.vendor || "").split(",").map((v) => v.trim()).filter(Boolean),
      min: Number(params.minPrice) || 0,
      max: Number(params.maxPrice) || 0,
      inStock: params.inStock === "1",
      onSale: params.onSale === "1",
    },
  };
}

const off = (price: number | null, compareAt: number | null) =>
  price != null && compareAt != null && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;

export function CollectionScreen({
  handle: link,
  onOpenProduct,
  onAdd,
}: {
  handle: string;
  onOpenProduct: (id: string) => void;
  /** A card with a single option adds straight from the grid. */
  onAdd?: (variantId: string) => void;
}) {
  const c = screens.collection;
  const handle = splitLink(link).handle;
  const preset = splitLink(link).filters;
  const [sort, setSort] = useState<Sort>((c.sortDefault as Sort) || "manual");
  const [filters, setFilters] = useState<CollectionFilters>(preset);
  const [draft, setDraft] = useState<CollectionFilters>(preset);
  const [panel, setPanel] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [single, setSingle] = useState(false);
  const [data, setData] = useState<CollectionPayload | null>(null);
  const [products, setProducts] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = Math.min(Math.max(c.pageSize || 24, 6), 60);

  useEffect(() => {
    let live = true;
    setData(null);
    setProducts([]);
    setError(null);
    fetchCollection(handle, sort, 0, pageSize, filters)
      .then((d) => {
        if (!live) return;
        setData(d);
        setProducts(d.products);
      })
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [handle, sort, filters, pageSize]);

  const more = useCallback(() => {
    if (!data || loadingMore || products.length >= data.total) return;
    setLoadingMore(true);
    fetchCollection(handle, sort, products.length, pageSize, filters)
      .then((d) => setProducts((p) => [...p, ...d.products.filter((x) => !p.some((y) => y.id === x.id))]))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [data, handle, sort, products.length, loadingMore, pageSize, filters]);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={c.priceColor || "#b0603e"} /></View>;

  const ink = c.inkColor || "#211a15";
  const line = c.lineColor || "#eadfd2";
  const accent = c.priceColor || "#b0603e";
  const vendors = data.facets ? data.facets.vendors : [];
  const columns = single ? 1 : c.columns === 3 ? 3 : 2;
  const active =
    filters.brands.length + (filters.min > 0 || filters.max > 0 ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.onSale ? 1 : 0);
  const range =
    preset.min > 0 && preset.max > 0
      ? money(preset.min) + " – " + money(preset.max)
      : preset.max > 0
        ? "Under " + money(preset.max)
        : preset.min > 0
          ? money(preset.min) + "+"
          : "";
  const subtitle = range ? range + " · " + data.total + " pieces" :
    c.heroSubtitle ||
    [String(data.collection.productCount || data.total) + "+ pieces", vendors.slice(0, 5).map((v) => v.name).join(" · ")]
      .filter(Boolean)
      .join(" · ");
  const chip = (on: boolean) => [styles.chip, on ? { backgroundColor: ink, borderColor: ink } : { borderColor: line }];
  const chipText = (on: boolean) => [styles.chipText, { color: on ? "#ffffff" : ink }];

  const header = (
    <View>
      {c.showHero ? (
        <View style={[styles.hero, { backgroundColor: c.heroTo || "#3d2619" }]}>
          <Fade angle={135} colors={[c.heroFrom || "#1c1410", c.heroTo || "#3d2619"]} style={StyleSheet.absoluteFill} />
          {c.heroKicker ? <Text style={[styles.heroKicker, { color: c.heroAccent || "#d08159" }]}>{c.heroKicker.toUpperCase()}</Text> : null}
          <Text style={styles.heroTitle}>{data.collection.title.toUpperCase()}</Text>
          {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
        </View>
      ) : null}

      {c.showBrandChips && vendors.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brands}>
          {[{ name: "", count: 0 }, ...vendors.slice(0, 14)].map((v) => {
            const on = v.name ? filters.brands.length === 1 && filters.brands[0] === v.name : filters.brands.length === 0;
            return (
              <Pressable key={v.name || "all"} style={chip(on)} onPress={() => setFilters({ ...filters, brands: v.name ? [v.name] : [] })}>
                <Text style={chipText(on)}>{v.name ? v.name.toUpperCase() : "ALL"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.bar, { borderColor: line }]}>
        <Text style={styles.count}>{data.total + " products"}</Text>
        {c.showLayoutToggle ? (
          <Pressable style={[styles.round, { borderColor: line }]} onPress={() => setSingle(!single)}>
            <Text style={[styles.roundText, { color: ink }]}>{single ? "▦" : "▢"}</Text>
          </Pressable>
        ) : null}
        {c.showFilters ? (
          <Pressable
            style={[styles.pill, { borderColor: accent }]}
            onPress={() => {
              setDraft(filters);
              setPanel(!panel);
              setSorting(false);
            }}
          >
            <Text style={[styles.pillText, { color: ink }]}>{active ? "Filters · " + active : "Filters"}</Text>
          </Pressable>
        ) : null}
        {c.showSort ? (
          <Pressable
            style={[styles.pill, { borderColor: line }]}
            onPress={() => {
              setSorting(!sorting);
              setPanel(false);
            }}
          >
            <Text style={[styles.pillText, { color: ink }]}>{(SORTS.find((x) => x.key === sort) ?? SORTS[0]).label + " ▾"}</Text>
          </Pressable>
        ) : null}
      </View>

      {sorting ? (
        <View style={styles.panel}>
          {SORTS.map((o) => (
            <Pressable key={o.key} style={chip(o.key === sort)} onPress={() => { setSort(o.key); setSorting(false); }}>
              <Text style={chipText(o.key === sort)}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {panel ? (
        <View style={[styles.filters, { borderColor: line }]}>
          {vendors.length ? <Text style={styles.label}>BRAND</Text> : null}
          <View style={styles.wrap}>
            {vendors.map((v) => {
              const on = draft.brands.includes(v.name);
              return (
                <Pressable
                  key={v.name}
                  style={chip(on)}
                  onPress={() => setDraft({ ...draft, brands: on ? draft.brands.filter((b) => b !== v.name) : [...draft.brands, v.name] })}
                >
                  <Text style={chipText(on)}>{v.name + "  " + v.count}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>PRICE</Text>
          <View style={styles.wrap}>
            {[
              { label: "Under 5,000", min: 0, max: 5000 },
              { label: "5,000 – 10,000", min: 5000, max: 10000 },
              { label: "Over 10,000", min: 10000, max: 0 },
            ].map((r) => {
              const on = draft.min === r.min && draft.max === r.max;
              return (
                <Pressable key={r.label} style={chip(on)} onPress={() => setDraft(on ? { ...draft, min: 0, max: 0 } : { ...draft, min: r.min, max: r.max })}>
                  <Text style={chipText(on)}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.range}>
            <TextInput
              style={[styles.input, { borderColor: line }]}
              keyboardType="numeric"
              placeholder={String(data.facets ? data.facets.priceMin : 0)}
              value={draft.min ? String(draft.min) : ""}
              onChangeText={(t) => setDraft({ ...draft, min: Number(t) || 0 })}
            />
            <Text style={styles.count}>–</Text>
            <TextInput
              style={[styles.input, { borderColor: line }]}
              keyboardType="numeric"
              placeholder={String(data.facets ? data.facets.priceMax : 0)}
              value={draft.max ? String(draft.max) : ""}
              onChangeText={(t) => setDraft({ ...draft, max: Number(t) || 0 })}
            />
          </View>
          <View style={styles.wrap}>
            <Pressable style={chip(draft.inStock)} onPress={() => setDraft({ ...draft, inStock: !draft.inStock })}>
              <Text style={chipText(draft.inStock)}>In stock only</Text>
            </Pressable>
            <Pressable style={chip(draft.onSale)} onPress={() => setDraft({ ...draft, onSale: !draft.onSale })}>
              <Text style={chipText(draft.onSale)}>On sale</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.clear, { borderColor: line }]} onPress={() => { setDraft(NONE); setFilters(NONE); setPanel(false); }}>
              <Text style={[styles.clearText, { color: ink }]}>Clear</Text>
            </Pressable>
            <Pressable style={[styles.apply, { backgroundColor: ink }]} onPress={() => { setFilters(draft); setPanel(false); }}>
              <Text style={styles.applyText}>SHOW RESULTS</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      key={"columns-" + columns}
      style={{ flex: 1, backgroundColor: c.pageBg || "#f8f5f0" }}
      data={products}
      numColumns={columns}
      keyExtractor={(p) => p.id}
      columnWrapperStyle={columns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.grid}
      ListHeaderComponent={header}
      onEndReachedThreshold={0.5}
      onEndReached={more}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columns, paddingHorizontal: 12 * (columns === 1 ? 1 : 0) }}>
          <CollectionCard card={item} large={single} onOpen={onOpenProduct} onAdd={onAdd} />
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: ink }]}>Nothing matches that — yet</Text>
          {active ? (
            <Pressable style={[styles.apply, { backgroundColor: ink, marginTop: 12 }]} onPress={() => setFilters(NONE)}>
              <Text style={styles.applyText}>CLEAR FILTERS</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={accent} /> : null}
    />
  );
}

/** A tile as the website draws one: white picture, cream panel, serif name, caramel price. */
function CollectionCard({
  card,
  large,
  onOpen,
  onAdd,
}: {
  card: Card;
  large: boolean;
  onOpen: (id: string) => void;
  onAdd?: (variantId: string) => void;
}) {
  const c = screens.collection;
  const [added, setAdded] = useState(false);
  const discount = off(card.priceMin, card.compareAt);
  const accent = c.priceColor || "#b0603e";
  const ink = c.inkColor || "#211a15";
  return (
    <View style={[styles.card, { borderColor: c.lineColor || "#eadfd2" }]}>
      <Pressable onPress={() => onOpen(card.id)} style={[styles.picture, { aspectRatio: large ? 0.8 : 1 }]}>
        {card.image ? <Image source={{ uri: card.image }} style={styles.pictureImage} resizeMode="contain" /> : null}
        {c.showBadge && discount > 0 ? (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeText}>{"−" + discount + "%"}</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.info, { backgroundColor: c.cardBg || "#f3ece4" }]}>
        {c.showVendor && card.vendor ? <Text style={[styles.vendor, { color: accent }]} numberOfLines={1}>{card.vendor.toUpperCase()}</Text> : null}
        {c.showRating && c.ratingText ? <Text style={[styles.rating, { color: ink }]}>{"★ " + c.ratingText}</Text> : null}
        <Text style={[styles.name, { color: ink, fontSize: large ? 16 : 13 }]} numberOfLines={Math.min(Math.max(c.nameLines || 2, 1), 3)}>
          {card.name}
        </Text>
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, { color: accent, fontSize: large ? 19 : 14 }]}>{money(card.priceMin)}</Text>
            {discount > 0 ? <Text style={styles.compare}>{money(card.compareAt)}</Text> : null}
          </View>
          {c.showQuickAdd && onAdd ? (
            <Pressable
              style={[styles.plus, added ? { backgroundColor: "#4a7858", borderColor: "#4a7858" } : { borderColor: accent }]}
              onPress={() => {
                if (card.variantId) {
                  onAdd(card.variantId);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1400);
                } else onOpen(card.id);
              }}
            >
              <Text style={[styles.plusText, { color: added ? "#ffffff" : accent }]}>{added ? "✓" : "+"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, overflow: "hidden" },
  heroShade: { position: "absolute", top: 0, bottom: 0, left: 0, width: "62%", opacity: 0.85 },
  heroKicker: { fontSize: 10, fontWeight: "600", letterSpacing: 2.2 },
  heroTitle: { marginTop: 8, fontSize: 32, fontStyle: "italic", color: "#ffffff", fontFamily: theme.titleFont },
  heroSub: { marginTop: 10, fontSize: 12, lineHeight: 18, color: "rgba(255,255,255,0.7)" },
  brands: { gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#ffffff" },
  chipText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  count: { flex: 1, fontSize: 12, color: "#74685e" },
  round: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  roundText: { fontSize: 14 },
  pill: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  pillText: { fontSize: 12, fontWeight: "600" },
  panel: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  filters: { margin: 16, marginBottom: 4, padding: 12, borderWidth: 1, borderRadius: 16, backgroundColor: "#ffffff", gap: 8 },
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 1.6, color: "#74685e" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  range: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, height: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, fontSize: 12, backgroundColor: "#ffffff" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  clear: { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  clearText: { fontSize: 12, fontWeight: "600" },
  apply: { flex: 2, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  applyText: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: "#ffffff" },
  grid: { paddingBottom: 24 },
  row: { gap: 8, paddingHorizontal: 12, marginTop: 8 },
  card: { flex: 1, borderWidth: 1, backgroundColor: "#ffffff", overflow: "hidden", marginTop: 8 },
  picture: { width: "100%", backgroundColor: "#ffffff" },
  pictureImage: { position: "absolute", top: 8, right: 8, bottom: 8, left: 8 },
  badge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9.5, fontWeight: "700", color: "#ffffff" },
  info: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, flex: 1 },
  vendor: { fontSize: 9, fontWeight: "600", letterSpacing: 1.2 },
  rating: { marginTop: 2, fontSize: 10, fontWeight: "600" },
  name: { marginTop: 4, lineHeight: 18, fontFamily: theme.titleFont },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8 },
  price: { fontWeight: "600", fontFamily: theme.titleFont },
  compare: { fontSize: 10, color: "#9ca3af", textDecorationLine: "line-through" },
  plus: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  plusText: { fontSize: 16, lineHeight: 18 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 18, fontStyle: "italic", fontFamily: theme.titleFont },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#e11d48", fontSize: 13 },
});
`,
  };
}

// ---------------------------------------------------------- one product --
function productScreenFile(placed: boolean): GeneratedFile {
  return {
    path: "components/ProductScreen.tsx",
    language: "tsx",
    contents: `/**
 * One product, dressed as Beauty Bar's website. Every part is the merchant's -
 * App → App theme → Product.
 *
 * The basket holds variant ids, never products: a product with three sizes has
 * three different things to have in stock, and an order line that only knows
 * the product cannot say which one to send.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  PanGestureHandler,
  ScrollView as GestureScrollView,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { theme } from "../theme";
import { screens, say } from "../screens";
import { fetchProduct, searchProducts, track, type Card, type Product } from "../api";
import { money } from "./Pieces";${placed ? '\nimport { ProductSections } from "../HomeScreen";' : ""}

const NL = String.fromCharCode(10);

/** The description with its HTML taken out and its lists kept as lines. */
function plain(html: string) {
  return html
    .replace(/<br[^>]*>/gi, NL)
    .replace(/<[/](p|div|li|h[1-6])>/gi, NL)
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split(NL)
    .map((l) => l.trim())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join(NL)
    .trim();
}

/** A steady number for a product, so its viewer count does not jump between visits. */
function seeded(id: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000003;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + (h % (hi - lo + 1));
}

type Scroller = { scrollTo: (to: { x: number; animated?: boolean }) => void };

/** How far the finger travels down before letting go goes back to the reel. */
const PULL_BACK = 120;

export function ProductScreen({
  id,
  onPullBack,
  onAdd,
  onBuyNow,
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
  onAddBundle,
}: {
  id: string;
  /**
   * Set when the product was opened from a reel: pulling down from the top
   * of the page goes back to that reel.
   */
  onPullBack?: () => void;
  onAdd: (variantId: string, product: Product) => void;
  /** Add, then go to the basket. */
  onBuyNow?: (variantId: string, product: Product, quantity: number) => void;
  /** Where a section placed on this screen can send her. */
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
  /** A section placed here that fills the basket itself, like a bundle. */
  onAddBundle?: (variantId: string, productId: string) => void;
}) {
  const p = screens.product;
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [width, setWidth] = useState(0);
  const [fold, setFold] = useState<"description" | "shipping" | null>("description");
  const [more, setMore] = useState(false);
  const [related, setRelated] = useState<Card[]>([]);
  const [added, setAdded] = useState(false);
  const [viewers, setViewers] = useState(0);
  const gallery = useRef<Scroller | null>(null);

  // Opened from a reel, the page is a sheet over the video, and it moves the
  // way one does: at the top of the page, a finger going down takes the
  // whole page with it, a little behind, with the reel showing above; let go
  // far enough and it drops away, otherwise it settles back. Sideways is the
  // gallery's, upwards is reading on, and below the top it is all scrolling.
  // The movement runs on the native side, so it keeps up with the finger.
  const page = useRef(null);
  const [atTop, setAtTop] = useState(true);
  const drag = useRef(new Animated.Value(0)).current;
  const follow = drag.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7], extrapolateLeft: "clamp" });
  const dim = drag.interpolate({ inputRange: [0, 700], outputRange: [1, 0.82], extrapolate: "clamp" });
  const onDrag = Animated.event([{ nativeEvent: { translationY: drag } }], { useNativeDriver: true });
  const onDragState = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationY, velocityY } = e.nativeEvent;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;
    const away = state === State.END && (translationY > PULL_BACK || (translationY > 40 && velocityY > 900));
    if (away && onPullBack) {
      Animated.timing(drag, { toValue: 1400, duration: 220, useNativeDriver: true }).start(() => onPullBack());
      return;
    }
    Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
  };


  useEffect(() => {
    let live = true;
    setProduct(null);
    setError(null);
    setRelated([]);
    setQty(1);
    setSlide(0);
    fetchProduct(id)
      .then((d) => {
        if (!live) return;
        setProduct(d);
        track("product_view", { productId: d.id, productName: d.name, imageUrl: d.image, value: d.priceMin });
        const first = d.variants.find((v) => v.available > 0) ?? d.variants[0];
        setChosen(first ? first.id : null);
        if (d.vendor && p.showRelated) {
          searchProducts(d.vendor, 12)
            .then((r) => live && setRelated(r.products.filter((x) => x.id !== d.id && x.handle !== d.handle).slice(0, 10)))
            .catch(() => {});
        }
      })
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [id, p.showRelated]);

  // A few people come and go while the shopper looks.
  useEffect(() => {
    if (!p.showViewers) return;
    const base = seeded(id, p.viewersMin || 12, p.viewersMax || 40);
    setViewers(base);
    const t = setInterval(() => setViewers(base + Math.round(Math.random() * 4) - 2), 5000);
    return () => clearInterval(t);
  }, [id, p.showViewers, p.viewersMin, p.viewersMax]);

  const accent = p.accentColor || "#9d6540";
  const ink = p.inkColor || "#211a15";
  const muted = p.mutedColor || "#74685e";
  const dark = p.darkColor || "#211a15";

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!product) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;

  const variant = product.variants.find((v) => v.id === chosen) ?? product.variants[0];
  const price = variant && variant.price != null ? variant.price : product.priceMin;
  const compareAt = variant && variant.compareAt != null ? variant.compareAt : product.compareAt;
  const discount = price != null && compareAt != null && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
  const left = variant ? variant.available : product.available;
  const soldOut = !variant || left <= 0 || price == null;
  const images = product.images.length ? product.images : product.image ? [product.image] : [];
  const months = Math.max(1, p.instalmentMonths || 6);
  const providers = p.instalmentProviders.split(/[·,|]/).map((x) => x.trim()).filter(Boolean);
  const description = product.description ? plain(product.description) : "";
  const stars = Math.max(0, Math.min(5, Math.round(Number(p.ratingValue) || 0)));
  const starLine = (on: string, offColor: string) =>
    [0, 1, 2, 3, 4].map((i) => (
      <Text key={i} style={{ color: i < stars ? on : offColor, fontSize: 11 }}>★</Text>
    ));

  return (
    <PanGestureHandler
      enabled={Boolean(onPullBack) && atTop}
      activeOffsetY={12}
      failOffsetX={[-15, 15]}
      simultaneousHandlers={page}
      onGestureEvent={onDrag}
      onHandlerStateChange={onDragState}
    >
    <Animated.View style={{ flex: 1, backgroundColor: p.pageBg || "#f8f5f0", opacity: dim, transform: [{ translateY: follow }] }}>
      <GestureScrollView
        ref={page}
        contentContainerStyle={{ paddingBottom: 24 }}
        scrollEventThrottle={16}
        // The page itself moves at the top, so it does not also stretch or glow.
        bounces={!onPullBack}
        overScrollMode={onPullBack ? "never" : "auto"}
        onScroll={(e) => {
          const top = e.nativeEvent.contentOffset.y <= 1;
          if (top !== atTop) setAtTop(top);
        }}
      >
        {/* gallery */}
        <View style={styles.galleryWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <ScrollView
            ref={(node) => {
              gallery.current = node as unknown as Scroller | null;
            }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => width && setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {(images.length ? images : [""]).map((src, i) => (
              <View key={src + i} style={{ width: width || 1, aspectRatio: 1, backgroundColor: "#ffffff" }}>
                {src ? <Image source={{ uri: src }} style={styles.galleryImage} resizeMode="contain" /> : null}
              </View>
            ))}
          </ScrollView>
          {p.showBadge && discount > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{"−" + discount + "%"}</Text></View>
          ) : null}
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((src, i) => (
                <View key={src + i} style={[styles.dot, { width: i === slide ? 16 : 6, backgroundColor: i === slide ? accent : "rgba(0,0,0,0.13)" }]} />
              ))}
            </View>
          ) : null}
        </View>
        {p.showThumbs && images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {images.map((src, i) => (
              <Pressable
                key={src + i}
                onPress={() => {
                  setSlide(i);
                  if (gallery.current && width) gallery.current.scrollTo({ x: i * width, animated: true });
                }}
                style={[styles.thumb, { borderColor: i === slide ? accent : "transparent" }]}
              >
                <Image source={{ uri: src }} style={styles.thumbImage} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* the card over it */}
        <View style={styles.sheet}>
          {p.showBreadcrumb ? (
            <Text style={styles.crumb} numberOfLines={1}>{"Home / " + (product.category || "Shop") + " / " + product.name}</Text>
          ) : null}
          {product.vendor ? <Text style={[styles.vendor, { color: muted }]}>{product.vendor.toUpperCase()}</Text> : null}
          <Text style={[styles.name, { color: ink }]}>{product.name}</Text>

          {p.showRating && p.ratingValue ? (
            <View style={styles.ratingRow}>
              <View style={[styles.ratingChip, { backgroundColor: accent }]}>
                <Text style={styles.ratingValue}>{p.ratingValue}</Text>
                <View style={{ flexDirection: "row" }}>{starLine("#f5d27a", "rgba(255,255,255,0.35)")}</View>
              </View>
              <Text style={[styles.ratingMeta, { color: muted }]}>
                {[p.reviewCount ? p.reviewCount + " " + p.reviewsWord : "", p.verifiedLabel].filter(Boolean).join(" · ")}
              </Text>
              {onOpenScreen ? (
                <Pressable onPress={() => onOpenScreen("happy-customers")}>
                  <Text style={[styles.seeAll, { color: accent }]}>See all</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.priceBlock}>
            <Text style={[styles.price, { color: accent }]}>{money(price)}</Text>
            {discount > 0 ? (
              <View style={styles.saveRow}>
                <Text style={styles.compare}>{money(compareAt)}</Text>
                {p.showSave && compareAt != null && price != null ? (
                  <View style={styles.save}><Text style={styles.saveText}>{say(p.saveLabel, "Save") + " " + money(compareAt - price)}</Text></View>
                ) : null}
              </View>
            ) : null}
          </View>

          {p.showInstalments && price != null && price > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.label, { color: muted }]}>{say(p.instalmentsTitle, "Installments").toUpperCase()}</Text>
              <View style={styles.instalments}>
                <Text style={[styles.instalmentsText, { color: muted }]}>
                  {"Pay "}
                  <Text style={{ color: ink, fontWeight: "700" }}>{money(Math.round(price / months))}</Text>
                  {" per month for "}
                  <Text style={{ color: ink, fontWeight: "700" }}>{months + " months"}</Text>
                </Text>
                <View style={styles.providers}>
                  {providers.map((name, i) => (
                    <View key={name} style={[styles.provider, { backgroundColor: i === providers.length - 1 ? "#c83a2c" : dark }]}>
                      <Text style={[styles.providerText, { color: i === providers.length - 1 ? "#ffffff" : "#d9a36f" }]}>{name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {p.showVariants && product.variants.length > 1 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.label, { color: muted }]}>{"CHOOSE" + (variant && variant.variantTitle ? " · " + variant.variantTitle : "")}</Text>
              <View style={styles.variants}>
                {product.variants.map((v) => {
                  const on = variant ? v.id === variant.id : false;
                  const out = v.available <= 0;
                  return (
                    <Pressable
                      key={v.id}
                      disabled={out}
                      onPress={() => { setChosen(v.id); setQty(1); }}
                      style={[styles.variant, on ? { backgroundColor: ink, borderColor: ink } : null, out ? { opacity: 0.35 } : null]}
                    >
                      <Text style={[styles.variantText, { color: on ? "#ffffff" : ink }, out ? { textDecorationLine: "line-through" } : null]}>
                        {v.variantTitle ?? "One size"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {p.showQuantity && !soldOut ? (
            <View style={styles.qtyRow}>
              <Text style={[styles.label, { color: muted }]}>QTY</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.step} onPress={() => setQty(Math.max(1, qty - 1))}><Text style={[styles.stepText, { color: ink }]}>−</Text></Pressable>
                <Text style={[styles.qty, { color: ink }]}>{qty}</Text>
                <Pressable style={styles.step} onPress={() => setQty(Math.min(Math.max(1, left), qty + 1))}><Text style={[styles.stepText, { color: ink }]}>+</Text></Pressable>
              </View>
            </View>
          ) : null}

          {p.showViewers && viewers > 0 ? (
            <View style={styles.viewers}>
              <View style={styles.liveDot} />
              <Text style={styles.viewersText}>{say(p.viewersText, "{n} people are viewing this right now").split("{n}").join(String(viewers))}</Text>
            </View>
          ) : null}

          {p.showStock && !soldOut && left <= (p.lowStockAt || 5) ? (
            <View style={{ marginTop: 10 }}>
              <View style={styles.lowStock}>
                <Text style={[styles.lowStockText, { color: ink }]}>{"⏱  " + say(p.lowStockText, "Only {n} left in stock — order soon!").split("{n}").join(String(left))}</Text>
              </View>
              <View style={styles.stockTrack}>
                <View style={[styles.stockFill, { width: Math.max(8, Math.min(100, (left / Math.max(1, (p.lowStockAt || 5) * 2)) * 100)) + "%" }]} />
              </View>
            </View>
          ) : null}

          {p.showPerks ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {[["🚚", p.perk1], ["↩️", p.perk2], ["✦", p.perk3]].filter((x) => x[1]).map(([icon, text]) => (
                <View key={text} style={styles.perk}>
                  <View style={styles.perkIcon}><Text style={{ color: accent, fontSize: 12 }}>{icon}</Text></View>
                  <Text style={[styles.perkText, { color: ink }]}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {p.showDescription && description ? (
            <View style={styles.fold}>
              <Pressable style={styles.foldHead} onPress={() => setFold(fold === "description" ? null : "description")}>
                <Text style={[styles.foldTitle, { color: ink }]}>{say(p.descriptionTitle, "Description")}</Text>
                <Text style={{ color: ink }}>{fold === "description" ? "˄" : "˅"}</Text>
              </Pressable>
              {fold === "description" ? (
                <View>
                  <Text style={[styles.body, { color: muted }]} numberOfLines={more ? undefined : 4}>{description}</Text>
                  {description.length > 220 ? (
                    <Pressable onPress={() => setMore(!more)}><Text style={[styles.more, { color: accent }]}>{more ? "Show less" : "Read more"}</Text></Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          {p.shippingText ? (
            <View style={styles.fold}>
              <Pressable style={styles.foldHead} onPress={() => setFold(fold === "shipping" ? null : "shipping")}>
                <Text style={[styles.foldTitle, { color: ink }]}>{say(p.shippingTitle, "Delivery & returns")}</Text>
                <Text style={{ color: ink }}>{fold === "shipping" ? "˄" : "˅"}</Text>
              </Pressable>
              {fold === "shipping" ? <Text style={[styles.body, { color: muted }]}>{p.shippingText}</Text> : null}
            </View>
          ) : null}
        </View>

        {p.showReviewsCard && p.ratingValue ? (
          <View style={[styles.reviews, { backgroundColor: dark }]}>
            {p.reviewsKicker ? <Text style={styles.reviewsKicker}>{p.reviewsKicker.toUpperCase()}</Text> : null}
            <Text style={styles.reviewsHeading}>
              {p.reviewsHeading ? p.reviewsHeading + " " : ""}
              {p.reviewsItalic ? <Text style={styles.reviewsItalic}>{p.reviewsItalic}</Text> : null}
            </Text>
            <View style={styles.reviewsScore}>
              <Text style={styles.reviewsValue}>{p.ratingValue}</Text>
              <View>
                <View style={{ flexDirection: "row" }}>{starLine("#d9a441", "rgba(255,255,255,0.2)")}</View>
                {p.reviewCount ? <Text style={styles.reviewsCount}>{p.reviewCount + " " + p.reviewsWord}</Text> : null}
              </View>
            </View>
            {p.reviewsButton && onOpenScreen ? (
              <Pressable style={styles.reviewsButton} onPress={() => onOpenScreen("happy-customers")}>
                <Text style={styles.reviewsButtonText}>{p.reviewsButton.toUpperCase() + "  →"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {p.showRelated && related.length ? (
          <View style={{ paddingTop: 20, paddingHorizontal: 12 }}>
            {p.relatedKicker ? <Text style={[styles.label, { color: accent }]}>{p.relatedKicker.toUpperCase()}</Text> : null}
            {p.relatedTitle ? <Text style={[styles.relatedTitle, { color: ink }]}>{p.relatedTitle}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
              {related.map((r) => (
                <Pressable key={r.id} style={styles.related} onPress={() => onOpenProduct && onOpenProduct(r.id)}>
                  <View style={styles.relatedPicture}>
                    {r.image ? <Image source={{ uri: r.image }} style={styles.galleryImage} resizeMode="contain" /> : null}
                  </View>
                  <View style={styles.relatedInfo}>
                    <Text style={[styles.relatedName, { color: ink }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.relatedPrice, { color: accent }]}>{money(r.priceMin)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
${placed ? "\n        {/* What the merchant put on the product screen. */}\n        <ProductSections onOpenCollection={onOpenCollection} onOpenProduct={onOpenProduct} onOpenScreen={onOpenScreen} onAdd={onAddBundle} signedIn />\n" : ""}      </GestureScrollView>

      {/* the bar that stays */}
      <View style={styles.footer}>
        <Pressable
          disabled={soldOut}
          style={[styles.cta, { backgroundColor: added ? "#4a7858" : accent }, soldOut ? { opacity: 0.45 } : null]}
          onPress={() => {
            if (!variant) return;
            for (let i = 0; i < qty; i++) onAdd(variant.id, product);
            setAdded(true);
            setTimeout(() => setAdded(false), 1600);
          }}
        >
          <Text style={styles.ctaText}>
            {soldOut ? say(p.soldOutLabel, "Sold out").toUpperCase() : added ? "ADDED ✓" : say(p.addLabel, "Add to cart").toUpperCase()}
          </Text>
        </Pressable>
        {p.showBuyNow && !soldOut && onBuyNow && variant ? (
          <Pressable style={[styles.cta, { backgroundColor: dark }]} onPress={() => onBuyNow(variant.id, product, qty)}>
            <Text style={styles.ctaText}>{say(p.buyNowLabel, "Buy now")}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  galleryWrap: { backgroundColor: "#ffffff" },
  galleryImage: { position: "absolute", top: 12, right: 12, bottom: 12, left: 12 },
  badge: { position: "absolute", top: 12, left: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#c0644a" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  dots: { position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  thumbs: { gap: 8, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: "#ffffff" },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, overflow: "hidden", backgroundColor: "#f8fafc" },
  thumbImage: { width: "100%", height: "100%" },
  sheet: { marginTop: -8, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#ffffff", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  crumb: { fontSize: 11, color: "#64748b" },
  vendor: { marginTop: 8, fontSize: 10, fontWeight: "600", letterSpacing: 2 },
  name: { marginTop: 4, fontSize: 24, lineHeight: 28, fontFamily: theme.titleFont },
  ratingRow: { marginTop: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  ratingValue: { color: "#ffffff", fontSize: 14, fontFamily: theme.titleFont },
  ratingMeta: { flex: 1, fontSize: 12 },
  seeAll: { fontSize: 12, textDecorationLine: "underline" },
  priceBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(69,46,31,0.13)" },
  price: { fontSize: 34, fontWeight: "600", fontFamily: theme.titleFont },
  saveRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  compare: { fontSize: 13, color: "#9ca3af", textDecorationLine: "line-through" },
  save: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: "#e8f1ea" },
  saveText: { fontSize: 11, fontWeight: "600", color: "#3f6f4f" },
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 1.6 },
  instalments: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, borderColor: "#e6d6c4", backgroundColor: "#f4ebe1", paddingHorizontal: 12, paddingVertical: 10 },
  instalmentsText: { flex: 1, fontSize: 12, lineHeight: 17 },
  providers: { flexDirection: "row", gap: 4 },
  provider: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  providerText: { fontSize: 9.5, fontWeight: "700" },
  variants: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  variant: { minWidth: 44, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#e0d4c4", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ffffff" },
  variantText: { fontSize: 12, fontWeight: "600" },
  qtyRow: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: "#e0d4c4", backgroundColor: "#ffffff" },
  step: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 16 },
  qty: { width: 24, textAlign: "center", fontSize: 14, fontWeight: "600" },
  viewers: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: "#eed2c6", backgroundColor: "#f8e9e3", paddingHorizontal: 12, paddingVertical: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  viewersText: { flex: 1, fontSize: 12, fontWeight: "500", color: "#b0402c" },
  lowStock: { borderRadius: 12, borderWidth: 1, borderColor: "#e8dccb", backgroundColor: "#fbf6ef", paddingHorizontal: 12, paddingVertical: 10 },
  lowStockText: { fontSize: 12, fontWeight: "500" },
  stockTrack: { marginTop: 6, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#e5dbcd" },
  stockFill: { height: "100%", borderRadius: 2, backgroundColor: "#c0644a" },
  perk: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f4ebe1" },
  perkText: { flex: 1, fontSize: 12 },
  fold: { marginTop: 16, borderTopWidth: 1, borderTopColor: "rgba(69,46,31,0.13)" },
  foldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  foldTitle: { fontSize: 14, fontWeight: "600" },
  body: { fontSize: 13, lineHeight: 20 },
  more: { marginTop: 6, fontSize: 12, textDecorationLine: "underline" },
  reviews: { marginHorizontal: 12, marginTop: 12, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  reviewsKicker: { fontSize: 10, fontWeight: "600", letterSpacing: 2.2, color: "#c98b5e" },
  reviewsHeading: { marginTop: 6, fontSize: 24, color: "#ffffff", textAlign: "center", fontFamily: theme.titleFont },
  reviewsItalic: { fontStyle: "italic", color: "#e6c9a8" },
  reviewsScore: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  reviewsValue: { fontSize: 44, color: "#ffffff", fontFamily: theme.titleFont },
  reviewsCount: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  reviewsButton: { marginTop: 16, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingHorizontal: 20, paddingVertical: 8 },
  reviewsButtonText: { fontSize: 11, fontWeight: "600", letterSpacing: 1.6, color: "#ffffff" },
  relatedTitle: { fontSize: 22, fontFamily: theme.titleFont },
  related: { width: 132, borderRadius: 12, borderWidth: 1, borderColor: "#eadfd2", overflow: "hidden", backgroundColor: "#ffffff" },
  relatedPicture: { width: "100%", aspectRatio: 1, backgroundColor: "#ffffff" },
  relatedInfo: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, backgroundColor: "#f3ece4" },
  relatedName: { fontSize: 12, fontFamily: theme.titleFont },
  relatedPrice: { fontSize: 13, fontWeight: "600", fontFamily: theme.titleFont },
  footer: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "rgba(69,46,31,0.13)", backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 10 },
  cta: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  ctaText: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: "#ffffff", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#e11d48", fontSize: 13 },
});
`,
  };
}

// -------------------------------------------------- the real website, framed --
/**
 * A screen that is simply the real website, shown in the app.
 *
 * Cart, Orders, Account and Reels are pages that already exist and already
 * work — a second, native rebuild of each would be a second place for every
 * future change to be made and a second place for it to be forgotten. So
 * these four open the real site instead, in the app's own colour while it
 * loads, and every design or wording change made in the dashboard reaches
 * the app the moment it reaches the website. No re-generating, no rebuild.
 *
 * Product and collection browsing stay native (see HomeScreen,
 * CollectionScreen, ProductScreen) because that is the app doing something a
 * browser tab could not, which is the whole point of having an app at all.
 */
function webPageFile(): GeneratedFile {
  return {
    path: "components/WebPage.tsx",
    language: "tsx",
    contents: `import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "../theme";
import { SITE_ORIGIN } from "../api";

export function WebPage({
  path,
  onClose,
  onProduct,
  paused,
}: {
  /** Where on the site this opens, e.g. "/store/reels". */
  path: string;
  /**
   * Fired when the page itself asks to be closed — the reels feed's own X
   * button, posted across the bridge rather than left to try to navigate a
   * browser history that a native tab does not have.
   */
  onClose?: () => void;
  /**
   * Fired when the page asks the app to open a product — the reels feed,
   * where a product tapped under a video should open the app's own product
   * screen, not the website's product page inside this one. \`back\` is
   * the page to come back to, so she lands on the reel she left.
   */
  onProduct?: (id: string, back: string) => void;
  /** Covered by a product opened from it: its video stops until it is uncovered. */
  paused?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const view = useRef<WebView | null>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    view.current?.injectJavaScript(
      paused
        ? "document.querySelectorAll('video').forEach(function (v) { v.pause(); }); true;"
        : "(function () { var h = window.innerHeight / 2; document.querySelectorAll('video').forEach(function (v) { var r = v.getBoundingClientRect(); if (r.top < h && r.bottom > h) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }); })(); true;",
    );
  }, [paused]);
  // Stamped once per opening, so the phone asks the shop for the page again
  // rather than showing a copy it kept from before the shop last changed it.
  const [opened] = useState(() => Date.now());
  const fresh = SITE_ORIGIN + path + (path.indexOf("?") >= 0 ? "&" : "?") + "app=" + opened;

  function onMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data?.source !== "beautybar-app") return;
      if (data.action === "close") onClose?.();
      if (data.action === "product" && typeof data.id === "string") {
        onProduct?.(data.id, typeof data.back === "string" ? data.back : path);
      }
    } catch {
      // A message that is not ours to read. Every page on this site may one
      // day post one of its own; only this one shape means anything here.
    }
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={view}
        source={{ uri: fresh }}
        style={styles.fill}
        onLoadEnd={() => setLoading(false)}
        onMessage={onMessage}
        // The site keeps her signed in the same way the browser does — a
        // cookie — and a WebView that threw its cookies away on every open
        // would ask her to sign in again on every tap of this tab.
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
      />
      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.page,
  },
});
`,
  };
}

// ------------------------------------------------------------ signing in --
function signInScreenFile(): GeneratedFile {
  return {
    path: "components/SignInScreen.tsx",
    language: "tsx",
    contents: `/**
 * Signing in with a phone number.
 *
 * The number is asked first and checked before anything is sent, because a
 * shopper the shop already knows should not be made to wait for a code to be
 * told so. Only an unknown number is offered SMS or WhatsApp — and it is the
 * shopper who picks, since the one that reaches them is the one they use.
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { checkPhone, loginVerified, requestCode, verifyCode } from "../api";

type Stage = "phone" | "choose" | "code";

export function SignInScreen({ onSignedIn }: { onSignedIn: (token: string, phone: string) => void }) {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const check = () =>
    run(async () => {
      const res = await checkPhone(phone);
      setPhone(res.phone);
      if (res.status === "already_verified") {
        const t = await loginVerified(res.phone);
        onSignedIn(t.token, t.phone);
      } else {
        setStage("choose");
      }
    });

  const send = (channel: "sms" | "whatsapp") =>
    run(async () => {
      await requestCode(phone, channel);
      setStage("code");
    });

  const verify = () =>
    run(async () => {
      const t = await verifyCode(phone, code, name || undefined);
      onSignedIn(t.token, t.phone);
    });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sign in</Text>

      {stage === "phone" ? (
        <>
          <Text style={styles.help}>Your phone number is your account.</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
            placeholderTextColor={colors.inkSoft}
          />
          <Cta label="Continue" busy={busy} onPress={check} />
        </>
      ) : null}

      {stage === "choose" ? (
        <>
          <Text style={styles.help}>Where should we send your code?</Text>
          <View style={styles.row}>
            <Pressable style={styles.choice} onPress={() => send("whatsapp")}>
              <Text style={styles.choiceText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.choice} onPress={() => send("sms")}>
              <Text style={styles.choiceText}>SMS</Text>
            </Pressable>
          </View>
          {busy ? <ActivityIndicator color={colors.accent} /> : null}
        </>
      ) : null}

      {stage === "code" ? (
        <>
          <Text style={styles.help}>Enter the code we sent to {phone}.</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor={colors.inkSoft}
          />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.inkSoft}
          />
          <Cta label="Sign in" busy={busy} onPress={verify} />
          <Pressable onPress={() => setStage("choose")}>
            <Text style={styles.again}>Send it again</Text>
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Cta({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.cta, busy ? styles.ctaOff : null]} disabled={busy} onPress={onPress}>
      <Text style={styles.ctaText}>{busy ? "…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.page, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  help: { fontSize: 13, color: colors.inkMuted },
  input: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, fontSize: 15, color: colors.ink },
  row: { flexDirection: "row", gap: spacing.sm },
  choice: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 13, alignItems: "center" },
  choiceText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  cta: { borderRadius: radius.md, backgroundColor: colors.accent, paddingVertical: 13, alignItems: "center" },
  ctaOff: { opacity: 0.5 },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  again: { textAlign: "center", fontSize: 12, color: colors.accent },
  error: { fontSize: 12, color: "#e11d48" },
});
`,
  };
}

// ------------------------------------------------------- the app itself --
function appFile(): GeneratedFile {
  // There is no Live tab: a live is opened from the live row on the shop.
  const live = false;
  return {
    path: "App.tsx",
    language: "tsx",
    contents: `/**
 * The whole app: the tabs along the bottom, and what sits above them.
 *
 * Two things live here because everything else needs them and nothing else
 * owns them — the basket and the signed-in token. The basket is kept as ids
 * and quantities only; every price on screen comes back from the shop through
 * /cart/price, so a basket edited on the phone cannot make anything cheaper.
 *
 * Generated from the dashboard — App → App theme. The order and wording of
 * the tabs are the merchant's; edit them there, not here.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
// react-native's own SafeAreaView does nothing on Android, which put the
// header under the phone's status bar.
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Splash } from "./components/Splash";
import { AppChrome } from "./components/AppChrome";
import { OfferPopup } from "./components/OfferPopup";
import { HeaderIcon } from "./components/Icons";
import { AllCollectionsScreen, PageScreen } from "./components/PageScreen";
import { colors, spacing, theme } from "./theme";
import { screens, say } from "./screens";
import {
  fetchLoyalty,
  giftsFrom,
  nextGift,
  placeOrder,
  previewDiscount,
  priceCart,
  redeemReward,
  setToken,
  track,
  trackCart,
  type OfferContext,
  type Gift,
  type Loyalty,
  type PricedCart,
  type Product,
} from "./api";
import HomeScreen from "./HomeScreen";
import { TabBar, visibleTabs, type TabKey } from "./components/TabBar";
import { CollectionScreen } from "./components/CollectionScreen";
import { SearchResults } from "./components/SearchResults";
import { ProductScreen } from "./components/ProductScreen";
import { CartScreen } from "./components/CartScreen";
import { CheckoutScreen, type Address } from "./components/CheckoutScreen";
import { SignInScreen } from "./components/SignInScreen";
import { WebPage } from "./components/WebPage";
import { ReelsScreen } from "./components/ReelsScreen";${
      live ? '\nimport { LiveScreen } from "./components/LiveScreen";' : ""
    }

/** A screen pushed on top of a tab. Tabs themselves are not pushed. */
type Screen =
  | { kind: "collection"; handle: string; title?: string }
  | { kind: "page"; handle: string }
  | { kind: "collections" }
  | { kind: "search"; term: string }
  | { kind: "product"; id: string; fromReel?: boolean }
  | { kind: "checkout" }
  | { kind: "signin" }
  | { kind: "placed"; orderNumber: string }
  /** One of the website's pages, inside the app: the review form. */
  | { kind: "web"; path: string; title: string };

type Line = { itemId: string; quantity: number };

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => visibleTabs()[0]?.key ?? "shop");
  // What the empty search box offers, carried up from the home screen.
  const [suggest, setSuggest] = useState<string[]>([]);
  const [stack, setStack] = useState<Screen[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; amount: number } | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [giftBusy, setGiftBusy] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Which reel the feed opens on: the newest, unless a tap on a replay
  // somewhere else asked for one by name.
  const [reelStart, setReelStart] = useState<string | null>(null);
  // What is typed in the header's search. The header is above every tab, so
  // the words belong here rather than to the home screen.
  const [query, setQuery] = useState("");

  const top = stack[stack.length - 1];

  /** A note says its piece and goes; one that lingers is in the way. */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);
  const push = (s: Screen) => setStack((v) => [...v, s]);
  const pop = () => setStack((v) => v.slice(0, -1));

  /**
   * Re-price whenever the basket changes.
   *
   * The answer is the shop's, and it can disagree with the phone: a line that
   * sold out comes back missing, and one asked for in fives when three are
   * left comes back as three. The basket follows the shop, not the other way.
   */
  useEffect(() => {
    if (!lines.length) {
      setCart(null);
      return;
    }
    let live = true;
    priceCart(lines)
      .then((c) => {
        if (!live) return;
        setCart(c);
        const corrected = c.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity }));
        if (corrected.length !== lines.length || c.lines.some((l) => l.adjusted)) {
          setLines(corrected);
          if (c.removed.length) setNotice("Some items sold out and were removed.");
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [lines]);

  const count = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);

  // A code from a popup taken before there was anything to use it on: kept,
  // and put on the basket as soon as there is one.
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // The basket as she left it, for the shop's customer page.
  useEffect(() => {
    trackCart(
      (lines.length ? cart?.lines ?? [] : []).map((l) => ({
        itemId: l.itemId,
        name: l.variantTitle ? l.productName + " - " + l.variantTitle : l.productName,
        imageUrl: l.imageUrl,
        price: l.price,
        quantity: l.quantity,
      })),
    );
  }, [cart, lines.length]);

  const add = useCallback((variantId: string, product?: Product) => {
    track("add_to_cart", {
      productId: product ? product.id : variantId,
      productName: product ? product.name : undefined,
      imageUrl: product ? product.image : undefined,
      value: product ? product.priceMin : undefined,
      quantity: 1,
    });
    setLines((v) => {
      const found = v.find((l) => l.itemId === variantId);
      return found
        ? v.map((l) => (l.itemId === variantId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...v, { itemId: variantId, quantity: 1 }];
    });
    setNotice("Added to your basket");
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setLines((v) =>
      quantity <= 0
        ? v.filter((l) => l.itemId !== itemId)
        : v.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)),
    );
  }, []);

  const applyCoupon = useCallback(
    async (code: string) => {
      if (!code) return setCoupon(null);
      try {
        const res = await previewDiscount(code, lines);
        if (res.ok) {
          setCoupon({ code: res.code, amount: res.amount });
          setNotice(res.label);
        } else {
          setCoupon(null);
          setNotice("That code does not apply to this basket.");
        }
      } catch {
        setCoupon(null);
        setNotice("That code could not be checked.");
      }
    },
    [lines],
  );

  useEffect(() => {
    if (!pendingCode || !lines.length) return;
    applyCoupon(pendingCode);
    setPendingCode(null);
  }, [pendingCode, lines.length, applyCoupon]);

  /** Her standing, once she is signed in. A guest has no rewards to offer. */
  useEffect(() => {
    if (!phone) return setLoyalty(null);
    let alive = true;
    fetchLoyalty()
      .then((l) => {
        if (alive) setLoyalty(l);
      })
      .catch(() => {
        /* a shop without a loyalty programme simply has no rewards */
      });
    return () => {
      alive = false;
    };
  }, [phone]);

  const gifts = useMemo(() => giftsFrom(loyalty), [loyalty]);
  const giftNote = useMemo(() => {
    const next = nextGift(loyalty);
    if (!next) return null;
    return next.short + " more signatures for " + next.title + " — you have " + next.balance + " so far";
  }, [loyalty]);

  /**
   * Spend a gift on this basket.
   *
   * One already redeemed only needs applying. One she has not redeemed costs
   * signatures, and that spend happens on her tap and nowhere else - the app
   * never decides to spend her points for her.
   */
  const useGift = useCallback(
    async (g: Gift) => {
      if (giftBusy) return;
      setGiftBusy(g.id);
      try {
        let code = g.code;
        if (!g.ready) {
          const res = await redeemReward(g.id);
          code = (res.userReward && res.userReward.code) || "";
          fetchLoyalty()
            .then(setLoyalty)
            .catch(() => {});
          if (!code) {
            setNotice("Redeemed - it comes with your order.");
            return;
          }
        }
        await applyCoupon(code);
      } catch (e) {
        setNotice(String((e as Error).message ?? e));
      } finally {
        setGiftBusy(null);
      }
    },
    [applyCoupon, giftBusy],
  );

  const signedIn = (token: string, who: string) => {
    // The token is the account. A real build should keep it in secure storage
    // (react-native-keychain, or AsyncStorage at a minimum) and hand it back to
    // setToken() on launch, so a shopper signs in once rather than every time.
    setToken(token);
    setPhone(who);
    setStack((v) => v.filter((s) => s.kind !== "signin"));
  };

  const checkout = () => {
    track("checkout_start", { value: cart?.subtotal ?? null, quantity: count });
    if (!phone) return push({ kind: "signin" });
    push({ kind: "checkout" });
  };

  const place = async (address: Address) => {
    if (!phone) return;
    setBusy(true);
    try {
      const res = await placeOrder({
        ...address,
        phone,
        couponCode: coupon?.code ?? null,
        paymentMethod: address.paymentMethod ?? null,
        lines,
      });
      setLines([]);
      setCoupon(null);
      setStack([{ kind: "placed", orderNumber: res.orderNumber }]);
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };


  const goTab = (k: TabKey) => {
    setStack([]);
    setQuery("");
    setTab(k);
  };

  /**
   * A link that points at a whole screen. Home and search are both the shop
   * tab - the search field lives in its header - and the rest are tabs of
   * their own, so this is the tab bar answering a tap somewhere else.
   */
  const goScreen = (screen: string) => {
    // "search:<words>" - a link to the results for those words.
    if (screen.startsWith("search:")) return push({ kind: "search", term: screen.slice(7) });
    if (screen === "home" || screen === "search") return goTab("shop");
    // A specific replay, e.g. from a Home tile — open the feed on that one
    // rather than on whatever is newest.
    if (screen.startsWith("reel:")) {
      setReelStart(screen.slice(5));
      return goTab("reels");
    }
    // A live on air, from the row at the top of the shop: its broadcast,
    // inside the app.
    if (screen.startsWith("live:")) {
      return push({ kind: "web", path: "/store/live/" + encodeURIComponent(screen.slice(5)), title: "Live" });
    }
    if (screen === "live") return goTab("shop");
    if (
      screen === "cart" ||
      screen === "orders" ||
      screen === "account" ||
      screen === "reels"${
      live ? ' || screen === "live"' : ""
    }
    ) {
      return goTab(screen);
    }
    if (screen === "collections") return push({ kind: "collections" });
    // One of the merchant's own pages, if the handle names one.
    if ((theme.pages ?? []).some((p) => p.handle === screen)) {
      return push({ kind: "page", handle: screen });
    }
    // Reviews, Happy customers and Requests are pages of the shop that this
    // build has no screen for. Say so rather than doing nothing at all.
    setNotice(
      screen === "reviews"
        ? "Reviews are on the home screen."
        : "Coming soon in the app.",
    );
  };

  // The reels feed stays loaded while a product opened from it is on top, so
  // dragging the product down shows the reel behind it, and going back finds
  // the same video at the same moment rather than a page loading again.
  const reels = (
    <ReelsScreen
      key="reels"
      startId={reelStart}
      paused={stack.length > 0}
      cartCount={count}
      onClose={() => goTab("shop")}
      onOpenProduct={(id) => push({ kind: "product", id, fromReel: true })}
      onAdd={(itemId) => add(itemId)}
      onCheckout={() => goTab("cart")}
      onOpenPage={(path) => push({ kind: "web", path, title: "Review" })}
    />
  );

  const body = top ? (
    top.kind === "collections" ? (
      <AllCollectionsScreen onOpen={(handle, title) => push({ kind: "collection", handle, title })} />
    ) : top.kind === "page" ? (
      <PageScreen
        page={(theme.pages ?? []).find((p) => p.handle === top.handle) ?? { id: "", handle: top.handle, items: [] }}
        onOpen={(tile) => {
          if (tile.url) return Linking.openURL(tile.url);
          if (tile.productId) return push({ kind: "product", id: tile.productId });
          if (tile.screen) return goScreen(tile.screen);
          if (tile.handle) push({ kind: "collection", handle: tile.handle, title: tile.label });
        }}
      />
    ) : top.kind === "collection" ? (
      <CollectionScreen handle={top.handle} onOpenProduct={(id) => push({ kind: "product", id })} onAdd={(v) => add(v)} />
    ) : top.kind === "search" ? (
      <SearchResults query={top.term} onOpenProduct={(id) => push({ kind: "product", id })} />
    ) : top.kind === "product" ? (
      <ProductScreen
        id={top.id}
        onPullBack={top.fromReel ? pop : undefined}
        onAdd={add}
        onBuyNow={(v, product, quantity) => {
          for (let i = 0; i < quantity; i++) add(v, product);
          goTab("cart");
        }}
        onOpenProduct={(id) => push({ kind: "product", id })}
        onOpenScreen={goScreen}
      />
    ) : top.kind === "web" ? (
      <WebPage path={top.path} />
    ) : top.kind === "checkout" ? (
      <CheckoutScreen phone={phone ?? ""} busy={busy} onPlace={place} />
    ) : top.kind === "signin" ? (
      <SignInScreen onSignedIn={signedIn} />
    ) : (
      <View style={styles.done}>
        <Text style={styles.doneTitle}>Thank you</Text>
        <Text style={styles.doneText}>Your order is {top.orderNumber}.</Text>
        <Pressable style={styles.doneCta} onPress={() => { setStack([]); goTab("shop"); }}>
          <Text style={styles.doneCtaText}>Keep shopping</Text>
        </Pressable>
      </View>
    )
  ) : tab === "shop" && query.trim() ? (
    <SearchResults query={query.trim()} onOpenProduct={(id) => push({ kind: "product", id })} />
  ) : tab === "shop" ? (
    <HomeScreen
      onCollections={setSuggest}
      onOpenCollection={(handle) => push({ kind: "collection", handle })}
      onOpenProduct={(id) => push({ kind: "product", id })}
      onOpenScreen={goScreen}
      onAdd={(variantId) => add(variantId)}
      signedIn={Boolean(phone)}
    />
  )${
    live
      ? ' : tab === "live" ? (\n    <LiveScreen onOpenCollection={(handle) => push({ kind: "collection", handle })} onOpenProduct={(id) => push({ kind: "product", id })} onOpenScreen={goScreen} />\n  )'
      : ""
  } : tab === "reels" ? (
    // Drawn below, under whatever is opened from it.
    null
  ) : tab === "cart" ? (
    <CartScreen
      lines={cart?.lines ?? []}
      subtotal={cart?.subtotal ?? 0}
      discount={coupon?.amount ?? 0}
      gifts={gifts}
      giftNote={giftNote}
      giftBusy={giftBusy}
      onUseGift={useGift}
      onChangeQuantity={setQuantity}
      onApplyCoupon={screens.cart.showCoupon ? applyCoupon : undefined}
      onCheckout={checkout}
      onOpenCollection={(handle) => push({ kind: "collection", handle })}
      onOpenProduct={(id) => push({ kind: "product", id })}
      onOpenScreen={goScreen}
      onAddBundle={(variantId) => add(variantId)}
    />
  ) : tab === "orders" ? (
    <WebPage path="/store/account/orders" />
  ) : (
    <WebPage path="/store/account" />
  );

  const heading = top
    ? top.kind === "checkout"
      ? say(screens.checkout.title, "Checkout")
      : top.kind === "signin"
        ? "Sign in"
        : top.kind === "collection"
          ? top.title ?? ""
          : top.kind === "web"
            ? top.title
            : ""
    : theme.storeName;

  // Which screen she is on, for the shop to choose a popup for.
  const offerContext: OfferContext = top
    ? top.kind === "product"
      ? { pageType: "product", productKey: top.id }
      : top.kind === "collection"
        ? { pageType: "collection", collectionHandle: top.handle }
        : top.kind === "search"
          ? { pageType: "search" }
          : top.kind === "checkout" || top.kind === "signin" || top.kind === "placed"
            ? { pageType: "checkout" }
            : { pageType: "other" }
    : tab === "shop"
      ? { pageType: query.trim() ? "search" : "index" }
      : tab === "cart"
        ? { pageType: "cart" }
        : { pageType: "other" };

  // The reels feed is a full-screen page with its own header; everything else
  // wears the shop's, as it does in the editor.
  const chrome = !(tab === "reels" && !stack.length);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
    <SafeAreaView style={[styles.app, { direction: "ltr" }]} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {chrome ? (
        <AppChrome
          suggest={suggest}
          query={query}
          onQuery={(v) => {
            setQuery(v);
            if (v) {
              setStack([]);
              setTab("shop");
            }
          }}
          cartCount={count}
          onHome={() => goTab("shop")}
          onBag={() => goTab("cart")}
          // The saved list is kept on the website's account page.
          onWishlist={() => goTab("account")}
          onOpenCollection={(handle) => {
            setQuery("");
            setTab("shop");
            setStack([{ kind: "collection", handle }]);
          }}
          onOpenProduct={(id) => push({ kind: "product", id })}
          onOpenScreen={goScreen}
        />
      ) : null}
      {stack.length ? (
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={pop} hitSlop={10}>
            <HeaderIcon name="back" color={colors.ink} size={20} />
          </Pressable>
          <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {tab === "reels" ? reels : null}
        {tab !== "reels" ? (
          body
        ) : top ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              // A product from the reel shows the reel when dragged; anything
              // else opened on top of it covers it.
              top.kind === "product" && top.fromReel ? null : { backgroundColor: colors.page },
            ]}
          >
            {body}
          </View>
        ) : null}
      </View>

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <TabBar active={tab} cartCount={count} onSelect={goTab} />

      <OfferPopup
        context={offerContext}
        cartCount={count}
        onApplyCode={(code) => {
          if (count > 0) {
            applyCoupon(code);
            goTab("cart");
          } else {
            setPendingCode(code);
            setNotice("Your code " + code + " is saved - it goes on your basket as soon as you add something.");
          }
        }}
      />

      {/* Above everything, and gone by itself a moment later. */}
      <Splash
        onOpenCollection={(handle) => {
          setTab("shop");
          push({ kind: "collection", handle, title: handle });
        }}
        onOpenProduct={(id) => {
          setTab("shop");
          push({ kind: "product", id });
        }}
        onOpenScreen={(screen) => goScreen(screen)}
      />
    </SafeAreaView>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  back: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
  notice: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 78, borderRadius: 10, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { color: "#fff", fontSize: 12, textAlign: "center" },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  doneTitle: { fontSize: 22, fontWeight: "700", color: colors.ink },
  doneText: { fontSize: 14, color: colors.inkMuted },
  doneCta: { marginTop: spacing.md, borderRadius: 10, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12 },
  doneCtaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
`,
  };
}

/** Every file the app needs, current as of this theme. */
// What runs before the app: the shop's current theme, fetched and applied
// before any screen is loaded, so a change saved in the editor shows without
// a new build.
function bootFile(): GeneratedFile {
  return {
    path: "Boot.tsx",
    language: "tsx",
    contents: `/**
 * What runs first. Generated from the dashboard — App → App theme.
 *
 * It fetches the shop's current theme and applies it, then loads the app.
 * The order matters: every screen builds its styles from the theme when its
 * file is first loaded, so the app is only required once the theme is in.
 *
 * The last theme fetched is kept on the phone, so a start with no signal still
 * looks like the shop did last time rather than like the day it was built.
 */
import React, { useEffect, useRef, useState } from "react";
import { AppState, I18nManager, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setVisitor } from "./api";
import { applyPack, canApplyLive, isApplied, theme } from "./theme";

// The shop is laid out left to right. A phone set to Arabic would otherwise
// mirror every screen - the tab bar backwards, a reel's buttons on the wrong
// side. This holds from the next start; the root view below holds it now.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const SAVED = "app_theme_pack";
const VISITOR = "app_visitor";
/** How long a start waits for the network before going with what it has. */
const WAIT_MS = 1500;
/** Coming back to the app checks again, but not more than once a minute. */
const RECHECK_MS = 60000;

type AppComponent = React.ComponentType;

export default function Boot() {
  const [App, setApp] = useState<AppComponent | null>(null);
  // Bumped when a theme is put on screen mid-visit, which redraws the app
  // without resetting it - the basket and the screen she is on stay put.
  const [, setRev] = useState(0);
  const lastCheck = useRef(0);

  useEffect(() => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loaded = require("./App") as { default: AppComponent };
      setApp(() => loaded.default);
    };
    const keep = (pack: unknown) => {
      AsyncStorage.setItem(SAVED, JSON.stringify(pack)).catch(() => {});
    };
    // A theme that arrives once the app is showing goes on screen when it
    // only changes words, pictures and sections; one that changes colours
    // waits for the next start (see canApplyLive).
    const showNow = (pack: unknown) => {
      if (!isApplied(pack) && canApplyLive(pack) && applyPack(pack)) setRev((r) => r + 1);
    };

    (async () => {
      // This phone, for the shop's customer tracking: made once, kept here.
      try {
        let id = await AsyncStorage.getItem(VISITOR);
        if (!id) {
          id = "a-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
          await AsyncStorage.setItem(VISITOR, id);
        }
        setVisitor(id);
      } catch {
        /* untracked is fine */
      }
      try {
        const saved = await AsyncStorage.getItem(SAVED);
        if (saved) applyPack(JSON.parse(saved));
      } catch {
        /* nothing kept, or nothing readable: the built-in theme stands */
      }
      const timer = setTimeout(start, WAIT_MS);
      lastCheck.current = Date.now();
      try {
        const pack = await api<unknown>("/app-theme");
        keep(pack);
        if (!started) applyPack(pack);
        else showNow(pack);
      } catch {
        /* offline: the kept theme stands */
      }
      clearTimeout(timer);
      start();
    })();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !started || Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      api<unknown>("/app-theme")
        .then((pack) => {
          keep(pack);
          showNow(pack);
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!App) return <View style={{ flex: 1, backgroundColor: theme.splash.bg || theme.background }} />;
  return <App />;
}
`,
  };
}

export function generateApp(theme: AppTheme, baseUrl: string): GeneratedFile[] {
  return [
    // The project first. Without these the rest is a folder of TypeScript
    // that nothing knows how to install, run or name.
    ...projectFiles(theme, baseUrl),
    themeFile(theme),
    screensFile(theme),
    apiFile(baseUrl),
    bootFile(),
    homeScreenFile(),
    piecesFile(),
    splashFile(),
    pageScreenFile(),
    tabBarFile(),
    appFile(),
    collectionScreenFile(),
    // Sections placed beside a product or the basket are decided when the
    // app opens too, so both screens always have room for them.
    productScreenFile(true),
    searchScreenFile(),
    cartScreenFile(true),
    checkoutScreenFile(),
    signInScreenFile(),
    // Reels, Orders and Account are the real site, shown in the app.
    webPageFile(),
    iconsFile(),
    fadeFile(),
    chromeFile(),
    offerPopupFile(),
    reelsScreenFile(),
    ...(Object.keys(BLOCK_META) as BlockType[]).map(sectionFile).sort((a, b) => a.path.localeCompare(b.path)),
  ];
}
