import {
  BLOCK_META,
  itemsOf,
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

export const theme = {
  storeName: ${q(t.storeName)},
  logoUrl: ${t.logoUrl ? q(t.logoUrl) : "null"},
  accent: ${q(t.accent)},
  background: ${q(t.background)},
  menuHandle: ${q(t.menuHandle)},
  showSearch: ${t.showSearch},
  announcement: {
    enabled: ${t.announcementEnabled},
    text: ${q(t.announcement)},
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

export const API_BASE = ${q(baseUrl)};

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: {
      "x-store-channel": "app",
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
};

export type HomePayload = {
  theme: typeof import("./theme").theme;
  collections: { handle: string; title: string; image: string | null; productCount: number }[];
  rows: Record<string, Card[]>;
  newArrivals: Card[];
  reviews: { id: string; name: string; productRating: number | null; comment: string | null }[];
};

/** Everything the front page needs, in one request. */
export const fetchHome = () => api<HomePayload>("/home");

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
};

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
export const fetchCollection = (handle: string, sort: Sort = "manual", offset = 0, limit = 24) =>
  api<CollectionPayload>(
    \`/collections/\${encodeURIComponent(handle)}?sort=\${sort}&offset=\${offset}&limit=\${limit}\`,
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
  lines: { itemId: string; quantity: number }[];
};

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

// ------------------------------------------------------------- shared bits --
function piecesFile(): GeneratedFile {
  return {
    path: "components/Pieces.tsx",
    language: "tsx",
    contents: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { Card, HomePayload } from "../api";

/** The bits every section is made of, so they all look like one app. */

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
  onPress,
}: {
  card: Card;
  width?: number;
  /** True in a grid, where the column decides the width and the picture squares itself. */
  fill?: boolean;
  onPress?: (id: string) => void;
}) {
  const box = fill ? styles.fillImage : { width, height: width };
  return (
    <Pressable style={[styles.tile, fill ? styles.fill : { width }]} onPress={() => onPress?.(card.id)}>
      {card.image ? (
        <Image source={{ uri: card.image }} style={[styles.tileImage, box]} />
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
  heading: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
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
import type { HomePayload } from "../api";

export type BannerSettings = {
  imageUrl?: string;
  heading?: string;
  subheading?: string;
  /** Collection handle to open when tapped. */
  handle?: string;
};

export function Banner({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: BannerSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const { heading, subheading, handle } = settings;
  const imageUrl =
    settings.imageUrl || collections.find((c) => c.handle === handle)?.image || undefined;
  if (!imageUrl && !heading) return null;
  return (
    <Pressable onPress={() => handle && onOpenCollection?.(handle)} style={styles.wrap}>
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
import { colors, radius, spacing } from "../theme";
import { inherit, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type Category = { id: string; handle?: string; label?: string; emoji?: string };
export type CategoriesSettings = { title?: string; items?: Category[] };

export function Categories({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: CategoriesSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  // The merchant's own picks when they made some; otherwise every collection,
  // which is what a store that has not curated this wants anyway.
  const picked = (settings.items ?? []).filter((i) => i.handle);
  const chips = picked.length
    ? picked.map((i) => {
        const { image, title } = inherit(i, collections);
        return { handle: i.handle!, title, image, emoji: i.emoji };
      })
    : collections.map((c) => ({ handle: c.handle, title: c.title, image: c.image ?? undefined, emoji: undefined }));
  if (!chips.length) return null;

  return (
    <>
      <SectionHeading title={settings.title ?? ""} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips.map((c) => (
          <Pressable key={c.handle} style={styles.chip} onPress={() => onOpenCollection?.(c.handle)}>
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
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingStart: 6, paddingEnd: 12, paddingVertical: 4 },
  chipImage: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.page },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.inkMuted },
});
`,

    new_arrivals: `import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { spacing } from "../theme";
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

const styles = StyleSheet.create({ row: { gap: spacing.md, paddingVertical: spacing.sm } });
`,

    collection_row: `import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { spacing } from "../theme";
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

const styles = StyleSheet.create({ row: { gap: spacing.md, paddingVertical: spacing.sm } });
`,

    collection_grid: `import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
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
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm },
});
`,

    reviews: `import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
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
  row: { gap: spacing.md, paddingVertical: spacing.sm },
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
import type { HomePayload } from "../api";

export type Slide = {
  id: string;
  imageUrl?: string;
  kicker?: string;
  heading?: string;
  subheading?: string;
  /** Collection handle to open when tapped. */
  handle?: string;
};
export type HeroSettings = { items?: Slide[] };

export function Hero({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: HeroSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
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
        onPress={() => slide.handle && onOpenCollection?.(slide.handle)}
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
import { colors, radius, spacing } from "../theme";
import { ProductTile, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type Tab = { id: string; handle?: string; label?: string; emoji?: string };
export type CollectionTabsSettings = { kicker?: string; title?: string; limit?: number; items?: Tab[] };

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

  return (
    <View>
      {settings.kicker ? <Text style={styles.kicker}>{settings.kicker}</Text> : null}
      <SectionHeading
        title={settings.title ?? ""}
        onSeeAll={() => onOpenCollection?.(active.handle!)}
      />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {products.map((p) => <ProductTile key={p.id} card={p} onPress={onOpenProduct} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.inkSoft },
  tabs: { gap: 6, paddingVertical: spacing.sm },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  tab: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tabOn: { backgroundColor: colors.accent },
  tabOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tabTextOn: { fontSize: 12, fontWeight: "500", color: "#fff" },
  tabTextOff: { fontSize: 12, fontWeight: "500", color: colors.inkMuted },
});
`,

    cards: `import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { inherit, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type ImageCard = { id: string; imageUrl?: string; title?: string; subtitle?: string; handle?: string };
export type CardsSettings = { kicker?: string; title?: string; items?: ImageCard[] };

export function Cards({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: CardsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
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
            <Pressable key={c.id} style={styles.card} onPress={() => c.handle && onOpenCollection?.(c.handle)}>
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
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  card: { width: 144, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
  image: { width: 144, height: 180, backgroundColor: colors.page },
  title: { fontSize: 12, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 10, color: colors.inkSoft },
});
`,

    tiers: `import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type Tier = { id: string; prefix?: string; amount?: string; label?: string; handle?: string };
export type TiersSettings = { title?: string; items?: Tier[] };

export function Tiers({
  settings,
  onOpenCollection,
}: {
  settings: TiersSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const tiers = settings.items ?? [];
  if (!tiers.length) return null;
  return (
    <View>
      <SectionHeading title={settings.title ?? ""} />
      <View style={styles.grid}>
        {tiers.map((t) => (
          <Pressable key={t.id} style={styles.card} onPress={() => t.handle && onOpenCollection?.(t.handle)}>
            {t.prefix ? <Text style={styles.prefix}>{t.prefix}</Text> : null}
            <Text style={styles.amount}>{t.amount}</Text>
            <Text style={styles.label} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.sm },
  card: { flexGrow: 1, flexBasis: "46%", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md },
  prefix: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.inkSoft },
  amount: { fontSize: 15, fontWeight: "700", color: colors.accent },
  label: { fontSize: 11, color: colors.inkMuted },
});
`,

    split: `import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { inherit, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type Panel = { id: string; imageUrl?: string; label?: string; buttonLabel?: string; handle?: string };
export type SplitSettings = { title?: string; items?: Panel[] };

export function Split({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: SplitSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
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
            <Pressable key={p.id} style={styles.panel} onPress={() => p.handle && onOpenCollection?.(p.handle)}>
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
  row: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  panel: { flex: 1, height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.page },
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  caption: { position: "absolute", right: 0, bottom: 0, left: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.35)" },
  label: { fontSize: 14, fontWeight: "700", color: "#fff" },
  button: { fontSize: 10, color: "rgba(255,255,255,0.85)" },
});
`,

    trust_badges: `import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

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
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  card: { width: 112, alignItems: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 10 },
  emoji: { fontSize: 18 },
  title: { marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 10, color: colors.inkSoft },
});
`,

    live_now: `import React, { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { inherit, SectionHeading } from "./Pieces";
import { fetchAccount, type HomePayload } from "../api";

export type LivePerson = {
  id: string;
  imageUrl?: string;
  name?: string;
  viewers?: string;
  handle?: string;
  url?: string;
};

export type LiveNowSettings = {
  title?: string;
  liveLabel?: string;
  showReplays?: boolean;
  replaysLabel?: string;
  replaysHandle?: string;
  replaysUrl?: string;
  offerEnabled?: boolean;
  offerTitle?: string;
  offerText?: string;
  offerMinutes?: number;
  offerHandle?: string;
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
  collections,
  onOpenCollection,
}: {
  settings: LiveNowSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const people = (settings.items ?? []).filter((i) => i.name || i.imageUrl);
  const showReplays = settings.showReplays !== false;
  const liveLabel = settings.liveLabel || "LIVE";

  // An empty colour means "follow the brand", so the section keeps up with the
  // accent instead of stranding a hex somebody typed once and forgot.
  const ringColor = settings.ringColor || colors.accent;
  const badgeBg = settings.badgeBg || "#e11d48";
  const badgeFg = settings.badgeTextColor || "#ffffff";
  const offerBg = settings.offerBg || colors.accent;
  const offerFg = settings.offerTextColor || "#ffffff";
  const timerBg = settings.timerBg || "rgba(255,255,255,0.22)";
  const timerFg = settings.timerTextColor || "#ffffff";

  const size = settings.avatarSize && settings.avatarSize > 0 ? settings.avatarSize : 56;
  // Zero is a real answer here — it means no ring at all — so this cannot use
  // the "positive or default" rule the other numbers use.
  const ringW = typeof settings.ringWidth === "number" && settings.ringWidth >= 0 ? settings.ringWidth : 2;
  const shape = settings.avatarShape || "circle";
  const photoRadius = shape === "square" ? 4 : shape === "rounded" ? Math.round(size * 0.28) : Math.round(size / 2);
  const nameSize = settings.nameSize && settings.nameSize > 0 ? settings.nameSize : 10;
  const viewersSize = settings.viewersSize && settings.viewersSize > 0 ? settings.viewersSize : 9;
  const bannerRadius = settings.bannerRadius && settings.bannerRadius > 0 ? settings.bannerRadius : radius.lg;
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
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}

      {people.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {people.map((p) => {
            const borrowed = inherit(p, collections);
            const photo = p.imageUrl || borrowed.image;
            return (
              <Pressable key={p.id} style={[styles.person, { width: cell }]} onPress={() => go(p.url, p.handle)}>
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
                {liveLabel ? (
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeFg }]}>{liveLabel}</Text>
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
              onPress={() => go(settings.replaysUrl, settings.replaysHandle)}
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
          style={[styles.offer, { backgroundColor: offerBg, borderRadius: bannerRadius }]}
          onPress={() => go(settings.offerUrl, settings.offerHandle)}
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
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  person: { alignItems: "center" },
  badge: { marginTop: -9, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  name: { marginTop: 7, fontWeight: "600", color: colors.ink, textAlign: "center" },
  viewers: { color: colors.inkSoft, textAlign: "center" },
  replays: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.page },
  replaysIcon: { color: colors.inkSoft },
  offer: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 14, paddingVertical: 12 },
  offerTitle: { fontWeight: "700" },
  offerText: { marginTop: 2, opacity: 0.85 },
  timer: { paddingHorizontal: 10, paddingVertical: 6 },
  timerText: { fontWeight: "700" },
});
`,

    coming_up_live: `import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { inherit, SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type Session = { id: string; imageUrl?: string; title?: string; when?: string; handle?: string; url?: string };
export type ComingUpLiveSettings = {
  title?: string;
  remindLabel?: string;
  cardBg?: string;
  radius?: number;
  items?: Session[];
};

export function ComingUpLive({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: ComingUpLiveSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.title || i.imageUrl);
  if (!items.length) return null;

  /** A typed link wins over a collection: it is the more specific thing to set. */
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };

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
              {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{i.title || borrowed.title}</Text>
                {i.when ? <Text style={styles.when} numberOfLines={1}>{i.when}</Text> : null}
              </View>
              {remind ? (
                <Pressable style={styles.remind} onPress={() => go(i.url, i.handle)}>
                  <Text style={styles.remindText}>{remind}</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.page },
  title: { fontSize: 12, fontWeight: "700", color: colors.ink },
  when: { fontSize: 11, color: colors.inkSoft },
  remind: { borderRadius: radius.pill, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },
  remindText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,

    countdown_deals: `import React, { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { inherit } from "./Pieces";
import type { HomePayload } from "../api";

export type Deal = {
  id: string;
  imageUrl?: string;
  badge?: string;
  price?: string;
  comparePrice?: string;
  claimed?: string;
  handle?: string;
  url?: string;
};
export type CountdownDealsSettings = {
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
}: {
  settings: CountdownDealsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.price || i.imageUrl);
  const total = Math.max(0, Math.trunc((settings.endsInMinutes ?? 135) * 60));
  const [left, setLeft] = useState(total);
  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  if (!items.length) return null;

  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };

  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const badgeBg = settings.badgeBg || colors.accent;
  const parts = [two(Math.floor(left / 3600)), two(Math.floor((left % 3600) / 60)), two(left % 60)];

  return (
    <>
      <View style={styles.head}>
        <Text style={styles.heading} numberOfLines={1}>{settings.title ?? ""}</Text>
        {settings.showTimer !== false ? (
          <View style={styles.timer}>
            {parts.map((p, i) => (
              <View key={i} style={[styles.tick, { backgroundColor: colors.accent }]}>
                <Text style={styles.tickText}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const pct = Math.max(0, Math.min(100, parseInt(i.claimed ?? "", 10) || 0));
          return (
            <Pressable key={i.id} style={[styles.card, { borderRadius: r }]} onPress={() => go(i.url, i.handle)}>
              <View>
                {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={styles.photo} />}
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
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  heading: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
  timer: { flexDirection: "row", gap: 4 },
  tick: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tickText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  card: { width: 132, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  photo: { width: "100%", height: 104, backgroundColor: colors.page },
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
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type InfoRow = {
  id: string;
  emoji?: string;
  title?: string;
  subtitle?: string;
  note?: string;
  handle?: string;
  url?: string;
};
export type InfoRowsSettings = { title?: string; cardBg?: string; radius?: number; items?: InfoRow[] };

export function InfoRows({
  settings,
  onOpenCollection,
}: {
  settings: InfoRowsSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.title);
  if (!items.length) return null;

  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };

  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;
  const bg = settings.cardBg || colors.surface;

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            style={[styles.row, { backgroundColor: bg, borderRadius: r }]}
            onPress={() => go(i.url, i.handle)}
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10 },
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
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export type Plan = { id: string; name?: string; headline?: string; note?: string; color?: string; handle?: string; url?: string };
export type PaymentPlansSettings = {
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllUrl?: string;
  radius?: number;
  items?: Plan[];
};

export function PaymentPlans({
  settings,
  onOpenCollection,
}: {
  settings: PaymentPlansSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.name || i.headline);
  if (!items.length) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go(settings.seeAllUrl, settings.seeAllHandle)}>
            <Text style={styles.seeAll}>{settings.seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            style={[styles.card, { backgroundColor: i.color || colors.accent, borderRadius: r }]}
            onPress={() => go(i.url, i.handle)}
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
  title: { fontSize: 14, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  card: { width: 136, padding: 12 },
  name: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  headline: { marginTop: 4, fontSize: 15, fontWeight: "700", color: "#fff" },
  note: { marginTop: 4, fontSize: 10, lineHeight: 14, color: "rgba(255,255,255,0.75)" },
});
`,

    price_slider: `import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type InstalmentPlan = { id: string; name?: string; months?: string; badge?: string; color?: string };
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
                <Text style={styles.provider}>{i.name}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.monthly}>{cur + " " + nf(price / months) + " / month"}</Text>
                  <Text style={styles.months}>{months + " months"}</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  provider: { width: 56, fontSize: 11, fontWeight: "600", color: colors.inkMuted },
  monthly: { fontSize: 13, fontWeight: "700", color: colors.accent },
  months: { fontSize: 10, color: colors.inkSoft },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: "600" },
});
`,

    offer_cards: `import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

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
}: {
  settings: OfferCardsSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.badge || i.title);
  if (!items.length) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
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
                <Pressable style={[styles.cta, { backgroundColor: colour }]} onPress={() => go(i.url, i.handle)}>
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
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  card: { width: 136, borderWidth: 1, borderStyle: "dashed", padding: 12, gap: 4 },
  badge: { fontSize: 20, fontWeight: "700" },
  title: { fontSize: 11, fontWeight: "700", color: colors.ink },
  detail: { fontSize: 10, lineHeight: 14, color: colors.inkSoft },
  cta: { marginTop: 4, borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  ctaText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
`,

    product_reasons: `import React from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { inherit } from "./Pieces";
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
  url?: string;
};
export type ProductReasonsSettings = {
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllUrl?: string;
  buttonLabel?: string;
  radius?: number;
  items?: Suggestion[];
};

export function ProductReasons({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: ProductReasonsSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.name || i.imageUrl);
  if (!items.length) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go(settings.seeAllUrl, settings.seeAllHandle)}>
            <Text style={styles.seeAll}>{settings.seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          return (
            <View key={i.id} style={[styles.card, { borderRadius: r }]}>
              <Pressable onPress={() => go(i.url, i.handle)}>
                {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={styles.photo} />}
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
                  <Pressable style={styles.cta} onPress={() => go(i.url, i.handle)}>
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
  title: { fontSize: 14, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  card: { width: 150, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  photo: { width: "100%", height: 120, backgroundColor: colors.page },
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
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { inherit } from "./Pieces";
import type { HomePayload } from "../api";

export type Circle = { id: string; imageUrl?: string; label?: string; note?: string; handle?: string; url?: string };
export type CircleRowSettings = {
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  seeAllHandle?: string;
  seeAllUrl?: string;
  size?: number;
  showLabel?: boolean;
  showNote?: boolean;
  items?: Circle[];
};

export function CircleRow({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: CircleRowSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.imageUrl || i.label || i.handle);
  if (!items.length) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
  const size = settings.size && settings.size > 0 ? settings.size : 64;
  const cell = Math.max(size + 14, 56);

  return (
    <>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          {settings.title ? <Text style={styles.title}>{settings.title}</Text> : null}
          {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
        </View>
        {settings.seeAllLabel ? (
          <Pressable onPress={() => go(settings.seeAllUrl, settings.seeAllHandle)}>
            <Text style={styles.seeAll}>{settings.seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => {
          const borrowed = inherit(i, collections);
          const photo = i.imageUrl || borrowed.image;
          const round = { width: size, height: size, borderRadius: Math.round(size / 2) };
          return (
            <Pressable key={i.id} style={[styles.cell, { width: cell }]} onPress={() => go(i.url, i.handle)}>
              {photo ? (
                <Image source={{ uri: photo }} style={round} />
              ) : (
                <View style={[round, { backgroundColor: colors.page }]} />
              )}
              {settings.showNote !== false && i.note ? (
                <Text style={styles.note} numberOfLines={1}>{i.note}</Text>
              ) : null}
              {settings.showLabel !== false ? (
                <Text style={styles.label} numberOfLines={1}>{i.label || borrowed.title}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  title: { fontSize: 14, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft },
  seeAll: { fontSize: 12, fontWeight: "600", color: colors.accent },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  cell: { alignItems: "center" },
  note: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.accent, textAlign: "center" },
  label: { fontSize: 10, color: colors.inkSoft, textAlign: "center" },
});
`,

    pick_colour: `import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type Swatch = { id: string; color?: string; label?: string; handle?: string; url?: string };
export type PickColourSettings = { title?: string; subtitle?: string; size?: number; items?: Swatch[] };

export function PickColour({
  settings,
  onOpenCollection,
}: {
  settings: PickColourSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.color);
  if (!items.length) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
  const size = settings.size && settings.size > 0 ? settings.size : 44;

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((i) => (
          <Pressable key={i.id} style={[styles.cell, { width: size + 16 }]} onPress={() => go(i.url, i.handle)}>
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

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  cell: { alignItems: "center", gap: 4 },
  label: { fontSize: 10, color: colors.inkMuted, textAlign: "center" },
});
`,

    price_drop: `import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export type DropThumb = { id: string; imageUrl?: string };
export type PriceDropSettings = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  handle?: string;
  url?: string;
  cardBg?: string;
  radius?: number;
  items?: DropThumb[];
};

export function PriceDrop({
  settings,
  onOpenCollection,
}: {
  settings: PriceDropSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  if (!settings.title && !settings.subtitle) return null;
  const go = () => {
    if (settings.url) {
      Linking.openURL(settings.url).catch(() => {});
      return;
    }
    if (settings.handle) onOpenCollection?.(settings.handle);
  };
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
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { SectionHeading } from "./Pieces";

export type Tag = { id: string; label?: string; color?: string; handle?: string; url?: string };
export type StyleProfileSettings = {
  title?: string;
  subtitle?: string;
  cardTitle?: string;
  cardSubtitle?: string;
  footNote?: string;
  cardBg?: string;
  radius?: number;
  items?: Tag[];
};

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
}: {
  settings: StyleProfileSettings;
  shopperName?: string | null;
  onOpenCollection?: (handle: string) => void;
}) {
  const items = (settings.items ?? []).filter((i) => i.label);
  const cardTitle = personalise(settings.cardTitle ?? "", shopperName ?? null);
  if (!items.length && !cardTitle) return null;
  const go = (url?: string, handle?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (handle) onOpenCollection?.(handle);
  };
  const r = settings.radius && settings.radius > 0 ? settings.radius : 14;

  return (
    <>
      {settings.title ? <SectionHeading title={settings.title} /> : null}
      {settings.subtitle ? <Text style={styles.subtitle}>{settings.subtitle}</Text> : null}
      <View style={[styles.card, { backgroundColor: settings.cardBg || colors.surface, borderRadius: r }]}>
        {cardTitle ? <Text style={styles.cardTitle}>{cardTitle}</Text> : null}
        {settings.cardSubtitle ? <Text style={styles.cardSubtitle}>{settings.cardSubtitle}</Text> : null}
        <View style={styles.tags}>
          {items.map((i) => (
            <Pressable
              key={i.id}
              style={[styles.tag, { borderColor: i.color || colors.line }]}
              onPress={() => go(i.url, i.handle)}
            >
              <Text style={[styles.tagText, { color: i.color || colors.inkMuted }]}>{i.label}</Text>
            </Pressable>
          ))}
        </View>
        {settings.footNote ? <Text style={styles.foot}>{settings.footNote}</Text> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: colors.inkSoft },
  card: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  cardTitle: { fontSize: 12, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 11, color: colors.inkSoft },
  tags: { marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: "500" },
  foot: { marginTop: spacing.sm, fontSize: 11, color: colors.inkSoft },
});
`,

    promo_card: `import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export type PromoCardSettings = {
  title?: string;
  body?: string;
  buttonLabel?: string;
  handle?: string;
  url?: string;
  imageUrl?: string;
  bg?: string;
  textColor?: string;
  radius?: number;
};

export function PromoCard({
  settings,
  onOpenCollection,
}: {
  settings: PromoCardSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  if (!settings.title && !settings.body) return null;
  const go = () => {
    if (settings.url) {
      Linking.openURL(settings.url).catch(() => {});
      return;
    }
    if (settings.handle) onOpenCollection?.(settings.handle);
  };
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

const styles = StyleSheet.create({
  photo: { width: "100%", height: 112, backgroundColor: colors.page },
  body: { padding: spacing.lg },
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  text: { marginTop: 4, fontSize: 11, lineHeight: 16, opacity: 0.8 },
  cta: { marginTop: spacing.md, alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  ctaText: { fontSize: 12, fontWeight: "700" },
});
`,

    text: `import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

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

  const rendered = theme.blocks
    .map((b, i) => `        <View key=${q(b.id)} style={styles.block}>\n${renderCall(b, 10)}\n        </View>`)
    .join("\n");

  return {
    path: "HomeScreen.tsx",
    language: "tsx",
    contents: `/**
 * The app's home screen. Generated from the dashboard — App → App theme.
 *
 * The order below is the order of the blocks in the editor. Change it there;
 * anything typed here is replaced the next time a section moves.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radius, spacing, theme } from "./theme";
import { fetchHome, type HomePayload } from "./api";
${search ? 'import { SearchResults } from "./components/SearchResults";\n' : ""}${imports}

export default function HomeScreen({
  onOpenCollection,
  onOpenProduct,
}: {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
}) {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);${
    search ? "\n  const [query, setQuery] = useState(\"\");" : ""
  }

  useEffect(() => {
    fetchHome().then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={styles.screen}>
      {theme.announcement.enabled && theme.announcement.text ? (
        <View style={styles.announcement}>
          <Text style={styles.announcementText}>{theme.announcement.text}</Text>
        </View>
      ) : null}
${
      search
        ? `      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.inkSoft}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
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
  content: { padding: spacing.lg, gap: spacing.xl },
  block: {},
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  error: { color: "#e11d48", fontSize: 13 },
  announcement: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12 },
  announcementText: { color: "#fff", fontSize: 11, fontWeight: "600", textAlign: "center" },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
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
    hero: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    promo_bar: [],
    collection_tabs: [
      "rows={data.rows}",
      "onOpenCollection={onOpenCollection}",
      "onOpenProduct={onOpenProduct}",
    ],
    cards: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    tiers: ["onOpenCollection={onOpenCollection}"],
    split: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    trust_badges: [],
    live_now: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    coming_up_live: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    countdown_deals: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    info_rows: ["onOpenCollection={onOpenCollection}"],
    shipping_goal: [],
    payment_plans: ["onOpenCollection={onOpenCollection}"],
    price_slider: [],
    offer_cards: ["onOpenCollection={onOpenCollection}"],
    product_reasons: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    circle_row: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    pick_colour: ["onOpenCollection={onOpenCollection}"],
    price_drop: ["onOpenCollection={onOpenCollection}"],
    style_profile: ["onOpenCollection={onOpenCollection}"],
    promo_card: ["onOpenCollection={onOpenCollection}"],
    banner: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    categories: ["collections={data.collections}", "onOpenCollection={onOpenCollection}"],
    new_arrivals: ["products={data.newArrivals}", "onOpenProduct={onOpenProduct}"],
    collection_row: [
      "collections={data.collections}",
      "rows={data.rows}",
      "onOpenCollection={onOpenCollection}",
      "onOpenProduct={onOpenProduct}",
    ],
    collection_grid: [
      "collections={data.collections}",
      "rows={data.rows}",
      "onOpenCollection={onOpenCollection}",
      "onOpenProduct={onOpenProduct}",
    ],
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
  "offerTitleSize",
  "offerTextSize",
  "radius",
  "percent",
  "minPrice",
  "maxPrice",
  "startPrice",
  "size",
]);

/** A block's settings as a JS object literal, keeping only what it uses. */
function settingsLiteral(block: Block): string {
  const keep: Record<BlockType, string[]> = {
    hero: [],
    promo_bar: ["lead", "rest", "code"],
    collection_tabs: ["kicker", "title", "limit"],
    cards: ["kicker", "title"],
    tiers: ["title"],
    split: ["title"],
    trust_badges: [],
    live_now: [
      "title",
      "liveLabel",
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
      "offerBg",
      "offerTextColor",
      "offerTitleSize",
      "offerTextSize",
      "timerBg",
      "timerTextColor",
    ],
    coming_up_live: ["title", "remindLabel", "cardBg", "radius"],
    countdown_deals: [
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
    payment_plans: ["title", "subtitle", "seeAllLabel", "seeAllHandle", "seeAllUrl", "radius"],
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
      "title",
      "subtitle",
      "seeAllLabel",
      "seeAllHandle",
      "seeAllUrl",
      "buttonLabel",
      "radius",
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
    ],
    pick_colour: ["title", "subtitle", "size"],
    price_drop: ["title", "subtitle", "buttonLabel", "handle", "url", "cardBg", "radius"],
    banner: ["imageUrl", "heading", "subheading", "handle"],
    categories: ["title"],
    new_arrivals: ["title", "limit"],
    collection_row: ["handle", "title", "limit"],
    collection_grid: ["handle", "title", "limit"],
    reviews: ["title", "subtitle", "ratingLabel", "seeAllLabel", "seeAllHandle", "seeAllUrl", "limit"],
    style_profile: [
      "title",
      "subtitle",
      "cardTitle",
      "cardSubtitle",
      "footNote",
      "cardBg",
      "radius",
    ],
    promo_card: [
      "title",
      "body",
      "buttonLabel",
      "handle",
      "url",
      "imageUrl",
      "bg",
      "textColor",
      "radius",
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
      if (
        k === "showReplays" ||
        k === "offerEnabled" ||
        k === "showTimer" ||
        k === "showClaimed" ||
        k === "showLabel" ||
        k === "showNote"
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
  const items = itemsOf(block);
  if (items.length) parts.push(`items: ${itemsLiteral(block.type, items)}`);

  return parts.length ? `{ ${parts.join(", ")} }` : "{}";
}

/** Only the fields a given block type's items actually carry. */
function itemsLiteral(type: BlockType, items: Item[]): string {
  const fields: Partial<Record<BlockType, string[]>> = {
    hero: ["imageUrl", "kicker", "heading", "subheading", "handle"],
    categories: ["handle", "label", "emoji", "imageUrl"],
    collection_tabs: ["handle", "label", "emoji"],
    cards: ["imageUrl", "title", "subtitle", "handle"],
    tiers: ["prefix", "amount", "label", "handle"],
    split: ["imageUrl", "label", "buttonLabel", "handle"],
    trust_badges: ["emoji", "title", "subtitle"],
    live_now: ["imageUrl", "name", "viewers", "handle", "url"],
    coming_up_live: ["imageUrl", "title", "when", "handle", "url"],
    countdown_deals: ["imageUrl", "badge", "price", "comparePrice", "claimed", "handle", "url"],
    info_rows: ["emoji", "title", "subtitle", "note", "handle", "url"],
    payment_plans: ["name", "headline", "note", "color", "handle", "url"],
    price_slider: ["name", "months", "badge", "color"],
    offer_cards: ["badge", "title", "subtitle", "color", "handle", "url"],
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
    ],
    circle_row: ["imageUrl", "label", "note", "handle", "url"],
    pick_colour: ["color", "label", "handle", "url"],
    price_drop: ["imageUrl"],
    style_profile: ["label", "color", "handle", "url"],
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

export type TabKey = "shop" | "cart" | "orders" | "account";

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
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens, say } from "../screens";

export type Address = {
  customerName: string;
  governorate: string;
  city: string;
  address: string;
  email?: string;
  note?: string;
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

      <Pressable
        style={[styles.cta, !ready || busy ? styles.ctaOff : null]}
        disabled={!ready || busy}
        onPress={() => onPlace(form)}
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
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  note: { fontSize: 12, color: colors.inkSoft },
  label: { fontSize: 11, fontWeight: "500", color: colors.inkMuted },
  input: { marginTop: 4, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, fontSize: 14, color: colors.ink },
  inputOff: { backgroundColor: colors.page, color: colors.inkMuted },
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
 * One collection, as a grid. Columns, sorting and the default order are the
 * merchant's — App → App theme → Collection.
 *
 * Sorting is a request to the shop, not a shuffle of what arrived: sorting
 * twenty-four loaded products by price would put the cheapest of that page
 * first and quietly hide the cheaper ones on page two.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens } from "../screens";
import { fetchCollection, type Card, type CollectionPayload, type Sort } from "../api";
import { ProductTile } from "./Pieces";

const SORTS: { key: Sort; label: string }[] = [
  { key: "manual", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-ascending", label: "Price ↑" },
  { key: "price-descending", label: "Price ↓" },
  { key: "title-ascending", label: "A–Z" },
];

const PAGE = 24;

export function CollectionScreen({
  handle,
  onOpenProduct,
}: {
  handle: string;
  onOpenProduct: (id: string) => void;
}) {
  const c = screens.collection;
  const [sort, setSort] = useState<Sort>((c.sortDefault as Sort) || "manual");
  const [data, setData] = useState<CollectionPayload | null>(null);
  const [products, setProducts] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setProducts([]);
    setError(null);
    fetchCollection(handle, sort, 0, PAGE)
      .then((d) => {
        if (!live) return;
        setData(d);
        setProducts(d.products);
      })
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [handle, sort]);

  const more = useCallback(() => {
    if (!data || loadingMore || products.length >= data.total) return;
    setLoadingMore(true);
    fetchCollection(handle, sort, products.length, PAGE)
      .then((d) => setProducts((p) => [...p, ...d.products]))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [data, handle, sort, products.length, loadingMore]);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const columns = c.columns === 3 ? 3 : 2;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>{data.collection.title}</Text>
        <Text style={styles.count}>{data.total} products</Text>
      </View>

      {c.showSort ? (
        <View style={styles.sorts}>
          {SORTS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.sort, s.key === sort ? styles.sortOn : null]}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.sortText, s.key === sort ? styles.sortTextOn : null]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        key={columns}
        data={products}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        onEndReachedThreshold={0.5}
        onEndReached={more}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / columns }}>
            <ProductTile card={item} fill onPress={onOpenProduct} />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing in this collection yet.</Text>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.accent} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  count: { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  sorts: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: spacing.lg, paddingBottom: 0 },
  sort: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 5 },
  sortOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortText: { fontSize: 11, color: colors.inkMuted },
  sortTextOn: { color: "#fff", fontWeight: "600" },
  grid: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  empty: { padding: spacing.xl, textAlign: "center", fontSize: 13, color: colors.inkSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
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
 * One product. What appears is the merchant's — App → App theme → Product.
 *
 * The basket holds variant ids, never products: a product with three sizes has
 * three different things to have in stock, and an order line that only knows
 * the product cannot say which one to send.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing } from "../theme";
import { screens, say } from "../screens";
import { fetchProduct, type Product, type Variant } from "../api";
import { money } from "./Pieces";

export function ProductScreen({
  id,
  onAdd,
}: {
  id: string;
  onAdd: (variantId: string, product: Product) => void;
}) {
  const p = screens.product;
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setProduct(null);
    setError(null);
    fetchProduct(id)
      .then((d) => {
        if (!live) return;
        setProduct(d);
        const first = d.variants.find((v) => v.available > 0) ?? d.variants[0];
        setChosen(d.selectedVariantId ?? first?.id ?? null);
      })
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, [id]);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!product) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const variant: Variant | undefined =
    product.variants.find((v) => v.id === chosen) ?? product.variants[0];
  const price = variant?.price ?? product.priceMin;
  const compareAt = variant?.compareAt ?? product.compareAt;
  const left = variant ? variant.available : product.available;
  const soldOut = left <= 0;
  const images = product.images.length ? product.images : product.image ? [product.image] : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {images.length ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {images.map((src) => (
              <Image key={src} source={{ uri: src }} style={styles.hero} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.hero} />
        )}

        <View style={styles.body}>
          {product.vendor ? <Text style={styles.vendor}>{product.vendor}</Text> : null}
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(price)}</Text>
            {compareAt != null && price != null && compareAt > price ? (
              <Text style={styles.compareAt}>{money(compareAt)}</Text>
            ) : null}
          </View>

          {p.showVariants && product.variants.length > 1 ? (
            <View style={styles.variants}>
              {product.variants.map((v) => {
                const on = v.id === chosen;
                const out = v.available <= 0;
                return (
                  <Pressable
                    key={v.id}
                    disabled={out}
                    style={[styles.variant, on ? styles.variantOn : null, out ? styles.variantOut : null]}
                    onPress={() => setChosen(v.id)}
                  >
                    <Text style={[styles.variantText, on ? styles.variantTextOn : null]}>
                      {v.variantTitle ?? "One size"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {p.showStock && !soldOut && left <= 5 ? (
            <Text style={styles.stock}>Only {left} left</Text>
          ) : null}

          {p.showDescription && product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, soldOut ? styles.ctaOff : null]}
          disabled={soldOut || !variant}
          onPress={() => variant && onAdd(variant.id, product)}
        >
          <Text style={styles.ctaText}>
            {soldOut ? say(p.soldOutLabel, "Sold out") : say(p.addLabel, "Add to basket")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: spacing.xl },
  hero: { width: 320, height: 320, backgroundColor: colors.surface },
  body: { padding: spacing.lg, gap: spacing.sm },
  vendor: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.inkSoft },
  name: { fontSize: 20, fontWeight: "700", color: colors.ink },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  price: { fontSize: 20, fontWeight: "700", color: colors.accent },
  compareAt: { fontSize: 13, color: colors.inkSoft, textDecorationLine: "line-through" },
  variants: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  variant: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 },
  variantOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  variantOut: { opacity: 0.35 },
  variantText: { fontSize: 12, color: colors.ink },
  variantTextOn: { color: "#fff", fontWeight: "600" },
  stock: { fontSize: 12, fontWeight: "600", color: "#b45309" },
  description: { marginTop: spacing.sm, fontSize: 13, lineHeight: 20, color: colors.inkMuted },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg },
  cta: { borderRadius: radius.md, backgroundColor: colors.accent, paddingVertical: 14, alignItems: "center" },
  ctaOff: { opacity: 0.45 },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
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
import { colors, radius, spacing } from "../theme";
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
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
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
import { ProductScreen } from "./components/ProductScreen";
import { CartScreen } from "./components/CartScreen";
import { CheckoutScreen, type Address } from "./components/CheckoutScreen";
import { AccountScreen, type AccountRow } from "./components/AccountScreen";
import { OrdersScreen } from "./components/OrdersScreen";
import { SignInScreen } from "./components/SignInScreen";

/** A screen pushed on top of a tab. Tabs themselves are not pushed. */
type Screen =
  | { kind: "collection"; handle: string; title?: string }
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

  const add = useCallback((variantId: string, _product: Product) => {
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

  const body = top ? (
    top.kind === "collection" ? (
      <CollectionScreen handle={top.handle} onOpenProduct={(id) => push({ kind: "product", id })} />
    ) : top.kind === "product" ? (
      <ProductScreen id={top.id} onAdd={add} />
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
    />
  ) : tab === "cart" ? (
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
      <View style={styles.header}>
        {stack.length ? (
          <Pressable style={styles.back} onPress={pop} hitSlop={8}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
      </View>

      <View style={{ flex: 1 }}>{body}</View>

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <TabBar active={tab} cartCount={count} onSelect={goTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  back: { width: 24 },
  backText: { fontSize: 26, lineHeight: 28, color: colors.ink },
  heading: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
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
    tabBarFile(theme),
    appFile(theme),
    collectionScreenFile(),
    productScreenFile(),
    ...(theme.settings.showSearch ? [searchScreenFile()] : []),
    cartScreenFile(),
    checkoutScreenFile(),
    accountScreenFile(),
    ordersScreenFile(),
    signInScreenFile(),
    ...used.map(sectionFile).sort((a, b) => a.path.localeCompare(b.path)),
  ];
}
