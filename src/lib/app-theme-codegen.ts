import {
  BLOCK_META,
  itemsOf,
  liveSessionsOf,
  TAB_DEFAULTS,
  type AppTheme,
  type Block,
  type BlockType,
  type Item,
} from "@/lib/app-theme";

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
  language: "tsx" | "ts" | "json";
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
function themeFile(theme: AppTheme): GeneratedFile {
  const t = theme.settings;
  return {
    path: "theme.ts",
    language: "ts",
    contents: `/**
 * Generated from the dashboard: App → App theme.
 * Edit it there — anything typed here is replaced on the next change.
 */

import { Platform } from "react-native";

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

export const theme = {
  storeName: ${q(t.storeName)},
  /** Section titles. undefined means the platform's own face. */
  titleFont: ${
    t.titleFont === "serif" ? 'Platform.OS === "ios" ? "Georgia" : "serif"' : "undefined"
  },
  logoUrl: ${t.logoUrl ? q(t.logoUrl) : "null"},
  accent: ${q(t.accent)},
  background: ${q(t.background)},
  menuHandle: ${q(t.menuHandle)},
  /** The merchant's own pages - For Her, For Him - behind their handles. */
  pages: ([${(t.pages ?? []).map((p) => `{ id: ${q(p.id)}, handle: ${q(p.handle)}, kicker: ${q(p.kicker)}, line1: ${q(p.line1)}, line2: ${q(p.line2)}, layout: ${q(p.layout)}, items: [${p.items.map((i) => `{ id: ${q(i.id)}, imageUrl: ${q(i.imageUrl)}, label: ${q(i.label)}, handle: ${q(i.handle)}, url: ${q(i.url)}, productId: ${q(i.productId)}, screen: ${q(i.screen)} }`).join(", ")}] }`).join(",\n    ")}] as ThemePage[]),
  /** The picture the app opens on, and how it leaves. */
  splash: {
    enabled: ${t.splashEnabled && t.splashImageUrl ? "true" : "false"},
    imageUrl: ${q(t.splashImageUrl)},
    bg: ${q(t.splashBg)},
    seconds: ${t.splashSeconds},
    /** Widened on purpose: the component compares it with every option. */
    exit: ${q(t.splashExit)} as string,
    fit: ${q(t.splashFit)} as string,
    show: ${q(t.splashShow)} as string,
    skipLabel: ${q(t.splashSkipLabel)},
    handle: ${q(t.splashHandle)},
    url: ${q(t.splashUrl)},
    productId: ${q(t.splashProductId)},
    screen: ${q(t.splashScreen)},
  },
  showSearch: ${t.showSearch},
  announcement: {
    enabled: ${t.announcementEnabled},
    text: ${q(t.announcement)},
  },
  header: {
    logoText: ${q(t.logoText)},
    logoAccentText: ${q(t.logoAccentText)},
    searchPlaceholder: ${q(t.searchPlaceholder)},
    showWishlist: ${t.showWishlist},
    showBag: ${t.showBag},
    bg: ${q(t.headerBg)},
    ink: ${q(t.headerInk)},
  },
  live: [${liveSessionsOf(theme)
    .map(
      (s) =>
        `{ id: ${q(s.id)}, name: ${q(s.name)}, detail: ${q(s.detail)}, imageUrl: ${q(
          s.imageUrl,
        )}, url: ${q(s.url)}, handle: ${q(s.handle)}, productId: ${q(
          s.productId,
        )}, screen: ${q(s.screen)}, live: ${s.live} }`,
    )
    .join(", ")}] as LiveSession[],
  strip: {
    enabled: ${t.stripEnabled},
    items: [${t.strip
      .map(
        (i) =>
          `{ id: ${q(i.id)}, label: ${q(i.label)}, handle: ${q(i.handle)}, url: ${q(
            i.url,
          )}, productId: ${q(i.productId)}, screen: ${q(i.screen)} }`,
      )
      .join(", ")}] as StripShortcut[],
  },
} as const;

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
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * How much air the home screen leaves. Set in the dashboard, App - App theme.
 *
 * "section" is the space between one section and the next, and the padding
 * inside a banded one. "item" is the space between cards; "itemTight" is the
 * same number scaled down for chips and small tiles, which read better
 * closer together than cards do - so one control moves the whole set without
 * flattening the rhythm between them.
 */
export const gap = {
  section: ${t.sectionGap},
  item: ${t.itemGap},
  itemTight: ${Math.max(2, Math.round(t.itemGap * 0.67))},
} as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
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

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

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
    href: string;
  }[];
};

/** Everything the front page needs, in one request. */
export const fetchHome = () => api<HomePayload>("/home");

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
    contents: `import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
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

export function money(v: number | null) {
  return v == null ? "—" : \`\${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)} EGP\`;
}

export function ProductTile({
  card,
  width = 128,
  fill = false,
  shape = "square",
  fit = "cover",
  onPress,
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
}) {
  const ratio = shape === "wide" ? 0.75 : shape === "tall" ? 1.34 : 1;
  const box = fill ? styles.fillImage : { width, height: Math.round(width * ratio) };
  return (
    <Pressable style={[styles.tile, fill ? styles.fill : { width }]} onPress={() => onPress?.(card.id)}>
      {card.image ? (
        <Image source={{ uri: card.image }} style={[styles.tileImage, box]} resizeMode={fit === "contain" ? "contain" : "cover"} />
      ) : (
        <View style={[styles.tileImage, box]} />
      )}
      <View style={{ padding: spacing.sm }}>
        <Text style={styles.tileName} numberOfLines={2}>{card.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(card.priceMin)}</Text>
          {card.compareAt != null && card.priceMin != null && card.compareAt > card.priceMin ? (
            <Text style={styles.compareAt}>{money(card.compareAt)}</Text>
          ) : null}
        </View>
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
  tileImage: { backgroundColor: colors.page },
  tileName: { fontSize: 11, lineHeight: 15, color: colors.ink },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
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

    hero: `import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
export type HeroSettings = { items?: Slide[] };

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
  if (!slides.length) return null;
  const slide = slides[Math.min(at, slides.length - 1)];
  // A slide with no picture of its own borrows the collection's.
  const image =
    slide.imageUrl || collections.find((c) => c.handle === slide.handle)?.image || undefined;

  return (
    <View>
      <Pressable
        onPress={() => openLink(slide, { onOpenCollection, onOpenProduct, onOpenScreen })}
        style={styles.wrap}
      >
        {image ? <Image source={{ uri: image }} style={styles.image} /> : null}
        <View style={styles.overlay}>
          {slide.kicker ? <Text style={styles.kicker}>{slide.kicker}</Text> : null}
          {slide.heading ? <Text style={styles.heading}>{slide.heading}</Text> : null}
          {slide.subheading ? <Text style={styles.sub}>{slide.subheading}</Text> : null}
        </View>
      </Pressable>
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => setAt(i)}
              style={[styles.dot, i === at ? styles.dotOn : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", height: 176, backgroundColor: colors.page },
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

    free_shipping: `import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
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

  const look = settings.style || "photo";
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
        <View style={styles.scrim} />
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
  banner: { overflow: "hidden" },
  photoWrap: { marginHorizontal: -16, overflow: "hidden" },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%", backgroundColor: "rgba(20,12,7,0.5)" },
  photoBody: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 16 },
  photoKicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.9, color: "#e7c9a9" },
  photoTitle: { marginTop: 4, fontSize: 24, fontWeight: "700", color: "#ffffff" },
  photoSub: { marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.85)" },
  photoCta: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 14, paddingVertical: 6 },
  photoCtaText: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "#2b1b10" },
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
import { colors, gap, spacing } from "../theme";
import { SectionHeading, openLink, type LinkTo } from "./Pieces";

export type Moment = { id: string; imageUrl?: string; label?: string; focal?: string } & LinkTo;
export type MomentsSettings = {
  title?: string;
  subtitle?: string;
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

  return (
    <View>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.card, { width: w, height: h, borderRadius: r }]}
            onPress={() => openLink(m, { onOpenCollection, onOpenProduct, onOpenScreen })}
          >
            {m.imageUrl ? (
              <Image source={{ uri: m.imageUrl }} style={styles.img} resizeMode="cover" resizeMethod="resize" />
            ) : (
              <View style={[styles.img, { backgroundColor: colors.line }]} />
            )}
            <View style={styles.scrim} />
            {m.label ? (
              <Text style={[styles.word, { color: word }]} numberOfLines={1}>
                {m.label}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.inkSoft },
  row: { gap: gap.itemTight, paddingVertical: spacing.sm },
  card: { overflow: "hidden", backgroundColor: colors.line },
  img: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: "rgba(0,0,0,0.34)" },
  word: { position: "absolute", left: 12, right: 12, bottom: 10, fontSize: 13, fontWeight: "600" },
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
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, gap, radius, spacing } from "../theme";
import { SectionHeading, inherit, openLink, type LinkTo } from "./Pieces";
import { fetchAccount, type HomePayload } from "../api";

export type LivePerson = {
  id: string;
  imageUrl?: string;
  name?: string;
  viewers?: string;
  /** A recording, if this circle is one. */
  videoUrl?: string;
  /** False for a recording, true for a live that is on air now. */
  onAir?: boolean;
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
  const cell = Math.max(size + 12, 56);

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
          {people.map((p) => {
            const borrowed = inherit(p, collections);
            const photo = p.imageUrl || borrowed.image;
            const onAirNow = p.onAir !== false;
            return (
              <Pressable
                key={p.id}
                style={[styles.person, { width: cell }]}
                onPress={() => (p.videoUrl ? Linking.openURL(p.videoUrl) : go(p))}
              >
                <View
                  style={{
                    backgroundColor: ringW > 0 ? ringColor : "transparent",
                    padding: ringW,
                    borderRadius: photoRadius + ringW,
                  }}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: photoRadius }} />
                  ) : (
                    <View style={{ width: size, height: size, borderRadius: photoRadius, backgroundColor: colors.page }} />
                  )}
                </View>
                {!onAirNow && p.videoUrl ? (
                  <View style={[styles.play, { width: size, height: size, borderRadius: photoRadius }]}>
                    <View style={styles.playDot}>
                      <Text style={styles.playMark}>{"\u25B6"}</Text>
                    </View>
                  </View>
                ) : null}
                {(onAirNow ? liveLabel : replayBadge) ? (
                  <View style={[styles.badge, { backgroundColor: onAirNow ? badgeBg : "#2b1b10" }]}>
                    <Text style={[styles.badgeText, { color: badgeFg }]}>
                      {onAirNow ? liveLabel : replayBadge}
                    </Text>
                  </View>
                ) : null}
                {p.name || borrowed.title ? (
                  <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>
                    {p.name || borrowed.title}
                  </Text>
                ) : null}
                {p.viewers ? (
                  <Text style={[styles.viewers, { fontSize: viewersSize }]} numberOfLines={1}>
                    {p.viewers}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          {showReplays ? (
            <Pressable
              style={[styles.person, { width: cell }]}
              onPress={() => go({ url: settings.replaysUrl, handle: settings.replaysHandle, productId: settings.replaysProductId, screen: settings.replaysScreen })}
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

const styles = StyleSheet.create({
  row: { gap: gap.item, paddingVertical: spacing.sm },
  person: { alignItems: "center" },
  play: { position: "absolute", top: 0, alignItems: "center", justifyContent: "center" },
  playDot: { height: 28, width: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  playMark: { color: "#fff", fontSize: 10 },
  badge: { marginTop: -9, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  name: { marginTop: 7, fontWeight: "600", color: colors.ink, textAlign: "center" },
  viewers: { color: colors.inkSoft, textAlign: "center" },
  replays: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.page },
  replaysIcon: { color: colors.inkSoft },
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
  photo: { width: "100%", height: 124, backgroundColor: colors.page },
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
import { Image, StyleSheet, Text, View } from "react-native";
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

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {items.map((i) => {
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
export type CircleRowSettings = {
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const round = { width: size, height: size, borderRadius: tileRadius };
          return (
            <Pressable key={i.id} style={[styles.cell, { width: cell }]} onPress={() => go(i)}>
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
      </ScrollView>
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
  const kicker = settings.kicker === undefined ? "Your society" : settings.kicker;
  const glyph = settings.glyph === undefined ? "✦" : settings.glyph;

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
        {society ? <View style={[styles.wash, { backgroundColor: deepTo }]} /> : null}
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
            borderRadius: typeof settings.radius === "number" ? settings.radius : 18,
            backgroundColor: settings.panelFrom || "#fdf9f3",
          },
        ]}
      >
        <View style={[styles.cardLower, { backgroundColor: settings.panelTo || "#f3e9db" }]} />
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
                  <View style={[styles.fillStart, { backgroundColor: settings.barFrom || "#c9a227" }]} />
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
              <View style={[styles.shadeFull, { opacity: shade * 0.25 }]} />
              <View style={[styles.shadeHalf, { opacity: shade * 0.45 }]} />
              <View style={[styles.shadeEdge, { opacity: shade * 0.4 }]} />
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
      {/* React Native has no gradient without a library, so the scrim is a
          plain wash over the lower half - enough to keep the words legible. */}
      <View style={[styles.scrim, { backgroundColor: "rgba(0,0,0," + overlay / 100 + ")" }]} />
      <View style={[styles.body, centred ? styles.centred : styles.bottom]}>
        {settings.heading ? (
          <Text style={[styles.heading, { color: ink }]}>{settings.heading}</Text>
        ) : null}
        {settings.subheading ? (
          <Text style={[styles.sub, { color: ink }]}>{settings.subheading}</Text>
        ) : null}
        {settings.buttonLabel ? (
          <Pressable style={[styles.cta, { backgroundColor: ink }]} onPress={go}>
            <Text style={styles.ctaText}>{settings.buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 28 },
  bottom: { justifyContent: "flex-end" },
  centred: { alignItems: "center", justifyContent: "center" },
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
function homeScreenFile(theme: AppTheme): GeneratedFile {
  const used = [...new Set(theme.blocks.map((b) => b.type))];
  const imports = used
    .map((t) => `import { ${exportName(t)} } from "./components/${componentName(t)}";`)
    .join("\n");
  const search = theme.settings.showSearch;
  const recsUsed = used.includes("complete_look");

  // A section can carry a line above it and a colour under it. Resolved here,
  // at generation time, so the screen stays a plain list of sections rather
  // than every component having to learn about bands.
  const rendered = theme.blocks
    .map((b) => {
      const set = b.settings ?? {};
      // The mystery box banner carries its line as a tag inside itself.
      // Said inside the section itself, so not again above it.
      const ownsKicker = (b.type === "promo_card" && s(set.style) === "banner") || b.type === "free_shipping";
      const kicker = ownsKicker ? "" : s(set.kicker);
      const band = s(set.band);
      const washed = band === "tint" || band === "paper";
      // A band bleeds to the screen edges, so the page padding comes off and
      // is put back on inside it.
      const wash =
        band === "paper" ? `"#ffffff"` : `colors.accent + "12"`;
      const bandStyle = washed
        ? `, { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: gap.section, backgroundColor: ${wash} }`
        : band === "divider"
          ? `, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: gap.section }`
          : ``
      const above = kicker
        ? `\n          <Text style={styles.kicker}>{${q(kicker)}}</Text>`
        : ``
      const section = `        <View key=${q(b.id)} style={[styles.block${bandStyle}]}>${above}\n${renderCall(b, 10)}\n        </View>`;
      // Nothing to suggest means no section at all - not an empty band.
      return b.type === "complete_look"
        ? `        {recs && recs.products.length ? (\n${section}\n        ) : null}`
        : section;
    })
    .join(`\n`);

  return {
    path: "HomeScreen.tsx",
    language: "tsx",
    contents: `/**
 * The app's home screen. Generated from the dashboard — App → App theme.
 *
 * The order below is the order of the blocks in the editor. Change it there;
 * anything typed here is replaced the next time a section moves.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, gap, radius, spacing, theme } from "./theme";
import { fetchHome, ${recsUsed ? "fetchRecommendations, type Recommendations, " : ""}type HomePayload } from "./api";
import { openLink } from "./components/Pieces";
${search ? 'import { SearchResults } from "./components/SearchResults";\n' : ""}${imports}

export default function HomeScreen({
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,${recsUsed ? "\n  signedIn," : ""}
}: {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
  /** Whether someone is signed in - what Complete your look is built from. */
  signedIn?: boolean;
}) {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);${
    search ? "\n  const [query, setQuery] = useState(\"\");" : ""
  }

  useEffect(() => {
    fetchHome().then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  // A shortcut row that ends at the screen's edge looks like it ends there,
  // and the ones past the fold are never seen - so it drifts, slowly enough
  // to read, and stops for good the moment a thumb lands on it.
  const strip = useRef<{ scrollTo: (to: { x: number; animated?: boolean }) => void } | null>(null);
  const stripSize = useRef({ rail: 0, content: 0 });
  const [stripHeld, setStripHeld] = useState(false);
  useEffect(() => {
    if (stripHeld) return;
    let at = 0;
    let way = 1;
    const drift = setInterval(() => {
      const far = stripSize.current.content - stripSize.current.rail;
      if (far <= 1) return;
      at = at + way * 0.8;
      if (at >= far) {
        at = far;
        way = -1;
      } else if (at <= 0) {
        at = 0;
        way = 1;
      }
      if (strip.current) strip.current.scrollTo({ x: at, animated: false });
    }, 30);
    return () => clearInterval(drift);
  }, [stripHeld]);${
    recsUsed
      ? "\n\n  // Asked again whenever someone signs in or out; a failure just hides it.\n  const [recs, setRecs] = useState<Recommendations | null>(null);\n  useEffect(() => {\n    if (!signedIn) return setRecs(null);\n    fetchRecommendations().then(setRecs).catch(() => setRecs(null));\n  }, [signedIn]);"
      : ""
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={styles.screen}>
      {theme.announcement.enabled && theme.announcement.text ? (
        <View style={styles.announcement}>
          <Text style={styles.announcementText}>{theme.announcement.text}</Text>
        </View>
      ) : null}
      {theme.strip.enabled && theme.strip.items.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={(r) => {
            strip.current = r;
          }}
          onLayout={(e) => {
            stripSize.current.rail = e.nativeEvent.layout.width;
          }}
          onContentSizeChange={(w) => {
            stripSize.current.content = w;
          }}
          onTouchStart={() => setStripHeld(true)}
          style={styles.strip}
          contentContainerStyle={styles.stripRow}
        >
          {theme.strip.items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => openLink(item, { onOpenCollection, onOpenProduct, onOpenScreen })}
              style={[styles.stripItem, i === 0 ? styles.stripItemOn : null]}
            >
              <Text style={[styles.stripText, i === 0 ? styles.stripTextOn : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
${
      search
        ? `      <View style={[styles.appHeader, theme.header.bg ? { backgroundColor: theme.header.bg } : null]}>
        {theme.logoUrl ? (
          <Image source={{ uri: theme.logoUrl }} style={styles.logoImg} />
        ) : (
          <Text style={[styles.wordmark, theme.header.ink ? { color: theme.header.ink } : null]}>
            {theme.header.logoText || theme.storeName}
            <Text style={styles.wordmarkAccent}>{theme.header.logoAccentText}</Text>
          </Text>
        )}
        <TextInput
          style={[styles.search, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder={theme.header.searchPlaceholder}
          placeholderTextColor={colors.inkSoft}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {theme.header.showWishlist ? <Text style={styles.headerIcon}>♡</Text> : null}
        {theme.header.showBag ? <Text style={styles.headerIcon}>🛍</Text> : null}
      </View>

      {query.trim() ? (
        <SearchResults query={query.trim()} onOpenProduct={(id) => onOpenProduct?.(id)} />
      ) : (
      <ScrollView contentContainerStyle={styles.content}>
${rendered}
      </ScrollView>
      )}`
        : `      <ScrollView contentContainerStyle={styles.content}>
${rendered}
      </ScrollView>`
    }
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: gap.section },
  block: {},
  kicker: { marginBottom: 6, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, color: colors.accent },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  error: { color: "#e11d48", fontSize: 13 },
  announcement: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12 },
  announcementText: { color: "#fff", fontSize: 11, fontWeight: "600", textAlign: "center" },
  strip: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  stripRow: { paddingHorizontal: 16, gap: 16 },
  stripItem: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  stripItemOn: { borderBottomColor: colors.accent },
  stripText: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  stripTextOn: { color: colors.accent },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  appHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  logoImg: { height: 20, width: 90, resizeMode: "contain" },
  wordmark: { fontSize: 13, fontWeight: "800", color: colors.ink },
  wordmarkAccent: { color: colors.accent },
  headerIcon: { fontSize: 17, color: colors.ink },
  search: { height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, fontSize: 14, color: colors.ink },
});
`,
  };
}

function exportName(type: BlockType): string {
  return type === "text" ? "TextBlock" : componentName(type);
}

/** How the home screen calls one block: its own settings, plus what it reads. */
function renderCall(block: Block, indent: number): string {
  const pad = " ".repeat(indent);
  const name = exportName(block.type);
  const extras: Record<BlockType, string[]> = {
    hero: ["collections={data.collections}", "onOpenCollection={onOpenCollection}", "onOpenProduct={onOpenProduct}", "onOpenScreen={onOpenScreen}"],
    promo_bar: [],
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
  const props = [`settings={${settingsLiteral(block)}}`, ...extras[block.type]];
  return `${pad}<${name}\n${props.map((p) => `${pad}  ${p}`).join("\n")}\n${pad}/>`;
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

/** A block's settings as a JS object literal, keeping only what it uses. */
function settingsLiteral(block: Block): string {
  const keep: Record<BlockType, string[]> = {
    hero: [],
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
  const parts = keep[block.type]
    .map((k) => {
      const v = set[k];
      if (k === "limit") return `${k}: ${n(v, 8)}`;
      // Not every setting is a string: a toggle that arrived as text would be
      // truthy in the app whichever way the merchant set it, and a size would
      // be compared as one.
      if (k === "offerMinutes") return `${k}: ${n(v, 10)}`;
      if (k === "endsInMinutes") return `${k}: ${n(v, 135)}`;
      if (k === "labelBold") return v === true ? `${k}: true` : null;
      if (
        k === "showReplays" ||
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
        return `${k}: ${v === false ? "false" : "true"}`;
      }
      // Sizes are only sent when the merchant actually set one, so the
      // component's own default stays the single source of that number.
      if (SIZE_KEYS.has(k)) {
        const size = Number(v);
        return Number.isFinite(size) && size >= 0 ? `${k}: ${size}` : null;
      }
      const text = s(v);
      return text ? `${k}: ${q(text)}` : null;
    })
    .filter(Boolean);

  // Slides, tabs, cards, tiers, panels and badges travel with the block —
  // they are the merchant's content, not the component's business.
  // Pairing rules are read by the shop, not the app.
  const items = block.type === "complete_look" ? [] : itemsOf(block);
  if (items.length) parts.push(`items: ${itemsLiteral(block.type, items)}`);

  return parts.length ? `{ ${parts.join(", ")} }` : "{}";
}

/** Only the fields a given block type's items actually carry. */
function itemsLiteral(type: BlockType, items: Item[]): string {
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
    moments: ["imageUrl", "label", "focal", "handle", "url", "productId", "screen"],
    pick_colour: ["color", "label", "imageUrl", "line1", "line2", "handle", "url", "productId", "screen"],
    brand_timeline: ["logoText", "label", "title", "description", "imageUrl", "focal", "handle", "url", "productId", "screen"],
    price_drop: ["imageUrl"],
    style_profile: ["label", "color", "handle", "url", "productId", "screen"],
  };
  const keys = fields[type] ?? [];
  const rendered = items.map((item) => {
    const parts = [`id: ${q(item.id)}`];
    for (const k of keys) {
      const text = s(item[k]);
      if (text) parts.push(`${k}: ${q(text)}`);
    }
    return `{ ${parts.join(", ")} }`;
  });
  return `[${rendered.join(", ")}]`;
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
function liveScreenFile(): GeneratedFile {
  return {
    path: "components/LiveScreen.tsx",
    language: "tsx",
    contents: `/**
 * The Live tab. Generated from the dashboard - App - App theme.
 *
 * The sessions come from the Live now and Coming up live sections, so there is
 * one list to keep rather than two that drift apart.
 */
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, theme } from "../theme";
import { openLink, type LinkTo } from "./Pieces";

export function LiveScreen({
  onOpenCollection,
  onOpenProduct,
  onOpenScreen,
}: {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
}) {
  const sessions = theme.live;
  if (!sessions.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Nothing live yet. Add a Live now or Coming up live section to the home screen.
        </Text>
      </View>
    );
  }
  const go = (to: LinkTo) => openLink(to, { onOpenCollection, onOpenProduct, onOpenScreen });
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {sessions.map((s) => (
        <Pressable key={s.id} style={styles.row} onPress={() => go(s)}>
          <View>
            {s.imageUrl ? (
              <Image source={{ uri: s.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            {s.live ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            {s.detail ? <Text style={styles.detail} numberOfLines={1}>{s.detail}</Text> : null}
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{s.live ? "Watch" : "Remind me"}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  empty: { padding: 32 },
  emptyText: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.page },
  badge: { position: "absolute", bottom: -4, alignSelf: "center", borderRadius: 4, backgroundColor: "#e11d48", paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  name: { fontSize: 12, fontWeight: "700", color: colors.ink },
  detail: { fontSize: 11, color: colors.inkSoft },
  cta: { borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },
  ctaText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,
  };
}

function tabBarFile(theme: AppTheme): GeneratedFile {
  const tabs = theme.tabs
    .filter((t) => t.visible)
    .map(
      (t) =>
        `  { key: ${q(t.key)}, label: ${q(t.label || TAB_DEFAULTS[t.key].en)}, icon: ${q(
          TAB_DEFAULTS[t.key].icon,
        )} },`,
    )
    .join("\n");

  return {
    path: "components/TabBar.tsx",
    language: "tsx",
    contents: `/** The bar along the bottom. Generated from the dashboard — App → App theme. */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export type TabKey = "shop" | "live" | "cart" | "orders" | "account";

/** Order, wording and which appear are the merchant's; the keys are not. */
export const TABS: { key: TabKey; label: string; icon: string }[] = [
${tabs}
];

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
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)}>
            <Text style={[styles.icon, on ? styles.on : styles.off]}>{t.icon}</Text>
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
  icon: { fontSize: 18, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: "500" },
  on: { color: colors.accent },
  off: { color: colors.inkSoft },
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

function cartScreenFile(): GeneratedFile {
  return {
    path: "components/CartScreen.tsx",
    language: "tsx",
    contents: `/** The basket. Wording comes from screens.ts — App → App theme. */
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens, say } from "../screens";
import { money } from "./Pieces";

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
  onChangeQuantity,
  onApplyCoupon,
  onCheckout,
}: {
  lines: CartLine[];
  subtotal: number;
  discount?: number;
  onChangeQuantity: (itemId: string, quantity: number) => void;
  onApplyCoupon?: (code: string) => void;
  onCheckout: () => void;
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

function accountScreenFile(): GeneratedFile {
  return {
    path: "components/AccountScreen.tsx",
    language: "tsx",
    contents: `/** The account tab. Wording and rows come from screens.ts — App → App theme. */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens, say } from "../screens";

export type AccountRow = "returns" | "requests" | "reviews";

export function AccountScreen({
  phone,
  name,
  onSignIn,
  onSignOut,
  onOpen,
}: {
  phone: string | null;
  name?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpen: (row: AccountRow) => void;
}) {
  const a = screens.account;
  const rows: { key: AccountRow; label: string }[] = [
    ...(a.showReturns ? [{ key: "returns" as const, label: say(a.returnsLabel, "Returns & exchanges") }] : []),
    ...(a.showRequests ? [{ key: "requests" as const, label: say(a.requestsLabel, "Ask us a question") }] : []),
    ...(a.showReviews ? [{ key: "reviews" as const, label: say(a.reviewsLabel, "Reviews") }] : []),
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.card}>
        {phone ? (
          <>
            <Text style={styles.name}>{name || "Customer"}</Text>
            <Text style={styles.phone}>{phone}</Text>
            <Pressable onPress={onSignOut}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.prompt}>
              {say(a.signedOutText, "Sign in with your phone number")}
            </Text>
            <Pressable style={styles.cta} onPress={onSignIn}>
              <Text style={styles.ctaText}>Sign in</Text>
            </Pressable>
          </>
        )}
      </View>

      {rows.map((r) => (
        <Pressable key={r.key} style={styles.row} onPress={() => onOpen(r.key)}>
          <Text style={styles.rowText}>{r.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  phone: { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  signOut: { marginTop: 12, fontSize: 12, fontWeight: "600", color: "#e11d48" },
  prompt: { fontSize: 14, color: colors.inkMuted },
  cta: { marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent, paddingVertical: 12, alignItems: "center" },
  ctaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  rowText: { fontSize: 14, fontWeight: "500", color: colors.ink },
  chevron: { fontSize: 18, color: colors.inkSoft },
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
          <View style={[styles.heroShade, { backgroundColor: c.heroFrom || "#1c1410" }]} />
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
function productScreenFile(): GeneratedFile {
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
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import { screens, say } from "../screens";
import { fetchProduct, searchProducts, type Card, type Product } from "../api";
import { money } from "./Pieces";

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

export function ProductScreen({
  id,
  onAdd,
  onBuyNow,
  onOpenProduct,
  onOpenScreen,
}: {
  id: string;
  onAdd: (variantId: string, product: Product) => void;
  /** Add, then go to the basket. */
  onBuyNow?: (variantId: string, product: Product, quantity: number) => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
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
    <View style={{ flex: 1, backgroundColor: p.pageBg || "#f8f5f0" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
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
      </ScrollView>

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
    </View>
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

// --------------------------------------------------------------- orders --
function ordersScreenFile(): GeneratedFile {
  return {
    path: "components/OrdersScreen.tsx",
    language: "tsx",
    contents: `/** Past orders for the signed-in number. */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, theme } from "../theme";
import { fetchOrders, type Order } from "../api";
import { money } from "./Pieces";

export function OrdersScreen({
  signedIn,
  onSignIn,
}: {
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetchOrders()
      .then((d) => live && setOrders(d.orders))
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Sign in to see your orders.</Text>
        <Pressable style={styles.cta} onPress={onSignIn}>
          <Text style={styles.ctaText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!orders) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!orders.length)
    return <View style={styles.center}><Text style={styles.empty}>No orders yet.</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {orders.map((o) => (
        <View key={o.orderNumber} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.number}>{o.orderNumber}</Text>
            <Text style={styles.total}>{money(o.total)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.date}>{new Date(o.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.status}>{o.fulfillmentStatus || o.lifecycle}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  number: { fontSize: 14, fontWeight: "700", color: colors.ink },
  total: { fontSize: 14, fontWeight: "700", color: colors.accent },
  date: { fontSize: 12, color: colors.inkSoft },
  status: { fontSize: 11, fontWeight: "600", color: colors.inkMuted, textTransform: "capitalize" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  empty: { fontSize: 14, color: colors.inkSoft },
  error: { color: "#e11d48", fontSize: 13 },
  cta: { borderRadius: radius.md, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
`,
  };
}

// ------------------------------------------------------- the app itself --
function appFile(theme: AppTheme): GeneratedFile {
  const first = (theme.tabs.find((t) => t.visible) ?? theme.tabs[0]).key;
  // The Live tab's screen is only generated when the merchant shows the tab, so
  // nothing above may name it otherwise.
  const live = theme.tabs.some((t) => t.key === "live" && t.visible);
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
import { Linking, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Splash } from "./components/Splash";
import { AllCollectionsScreen, PageScreen } from "./components/PageScreen";
import { colors, spacing, theme } from "./theme";
import { screens, say } from "./screens";
import {
  placeOrder,
  previewDiscount,
  priceCart,
  setToken,
  type PricedCart,
  type Product,
} from "./api";
import HomeScreen from "./HomeScreen";
import { TabBar, type TabKey } from "./components/TabBar";
import { CollectionScreen } from "./components/CollectionScreen";
import { SearchResults } from "./components/SearchResults";
import { ProductScreen } from "./components/ProductScreen";
import { CartScreen } from "./components/CartScreen";
import { CheckoutScreen, type Address } from "./components/CheckoutScreen";
import { AccountScreen, type AccountRow } from "./components/AccountScreen";
import { OrdersScreen } from "./components/OrdersScreen";
import { SignInScreen } from "./components/SignInScreen";${
      theme.tabs.some((t) => t.key === "live" && t.visible)
        ? '\nimport { LiveScreen } from "./components/LiveScreen";'
        : ""
    }

/** A screen pushed on top of a tab. Tabs themselves are not pushed. */
type Screen =
  | { kind: "collection"; handle: string; title?: string }
  | { kind: "page"; handle: string }
  | { kind: "collections" }
  | { kind: "search"; term: string }
  | { kind: "product"; id: string }
  | { kind: "checkout" }
  | { kind: "signin" }
  | { kind: "placed"; orderNumber: string };

type Line = { itemId: string; quantity: number };

export default function App() {
  const [tab, setTab] = useState<TabKey>(${q(first)});
  const [stack, setStack] = useState<Screen[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; amount: number } | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const add = useCallback((variantId: string, _product?: Product) => {
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

  const signedIn = (token: string, who: string) => {
    // The token is the account. A real build should keep it in secure storage
    // (react-native-keychain, or AsyncStorage at a minimum) and hand it back to
    // setToken() on launch, so a shopper signs in once rather than every time.
    setToken(token);
    setPhone(who);
    setStack((v) => v.filter((s) => s.kind !== "signin"));
  };

  const checkout = () => {
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

  const openAccountRow = (row: AccountRow) => {
    // Returns, questions and reviews each have their own endpoint; until this
    // build wires a screen for them, say so rather than doing nothing at all.
    setNotice(row === "reviews" ? "Reviews are on the home screen." : "Coming soon in the app.");
  };

  const goTab = (k: TabKey) => {
    setStack([]);
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
    if (screen === "cart" || screen === "orders" || screen === "account"${
      live ? ' || screen === "live"' : ""
    }) {
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
        onAdd={add}
        onBuyNow={(v, product, quantity) => {
          for (let i = 0; i < quantity; i++) add(v, product);
          goTab("cart");
        }}
        onOpenProduct={(id) => push({ kind: "product", id })}
        onOpenScreen={goScreen}
      />
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
  ) : tab === "shop" ? (
    <HomeScreen
      onOpenCollection={(handle) => push({ kind: "collection", handle })}
      onOpenProduct={(id) => push({ kind: "product", id })}
      onOpenScreen={goScreen}
      signedIn={Boolean(phone)}
    />
  )${
    live
      ? ' : tab === "live" ? (\n    <LiveScreen onOpenCollection={(handle) => push({ kind: "collection", handle })} onOpenProduct={(id) => push({ kind: "product", id })} onOpenScreen={goScreen} />\n  )'
      : ""
  } : tab === "cart" ? (
    <CartScreen
      lines={cart?.lines ?? []}
      subtotal={cart?.subtotal ?? 0}
      discount={coupon?.amount ?? 0}
      onChangeQuantity={setQuantity}
      onApplyCoupon={screens.cart.showCoupon ? applyCoupon : undefined}
      onCheckout={checkout}
    />
  ) : tab === "orders" ? (
    <OrdersScreen signedIn={Boolean(phone)} onSignIn={() => push({ kind: "signin" })} />
  ) : (
    <AccountScreen
      phone={phone}
      onSignIn={() => push({ kind: "signin" })}
      onSignOut={() => { setToken(null); setPhone(null); }}
      onOpen={openAccountRow}
    />
  );

  const heading = top
    ? top.kind === "checkout"
      ? say(screens.checkout.title, "Checkout")
      : top.kind === "signin"
        ? "Sign in"
        : ""
    : theme.storeName;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" />
      {stack.length || tab !== "shop" ? (
        <View style={styles.header}>
          {stack.length ? (
            <Pressable style={styles.back} onPress={pop} hitSlop={8}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>{body}</View>

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <TabBar active={tab} cartCount={count} onSelect={goTab} />

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
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  back: { width: 24 },
  backText: { fontSize: 26, lineHeight: 28, color: colors.ink },
  heading: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink, fontFamily: theme.titleFont },
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
export function generateApp(theme: AppTheme, baseUrl: string): GeneratedFile[] {
  const used = [...new Set(theme.blocks.map((b) => b.type))];
  return [
    themeFile(theme),
    screensFile(theme),
    apiFile(baseUrl),
    homeScreenFile(theme),
    piecesFile(),
    splashFile(),
    pageScreenFile(),
    tabBarFile(theme),
    appFile(theme),
    collectionScreenFile(),
    productScreenFile(),
    searchScreenFile(),
    cartScreenFile(),
    checkoutScreenFile(),
    accountScreenFile(),
    ordersScreenFile(),
    signInScreenFile(),
    ...(theme.tabs.some((t) => t.key === "live" && t.visible) ? [liveScreenFile()] : []),
    ...used.map(sectionFile).sort((a, b) => a.path.localeCompare(b.path)),
  ];
}
