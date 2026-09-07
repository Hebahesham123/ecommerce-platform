import { BLOCK_META, type AppTheme, type Block, type BlockType } from "@/lib/app-theme";

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
  page: "#f8fafc",
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
import type { Card } from "../api";

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

export function money(v: number | null) {
  return v == null ? "—" : \`\${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)} EGP\`;
}

export function ProductTile({
  card,
  width = 128,
  onPress,
}: {
  card: Card;
  width?: number;
  onPress?: (id: string) => void;
}) {
  return (
    <Pressable style={[styles.tile, { width }]} onPress={() => onPress?.(card.id)}>
      {card.image ? (
        <Image source={{ uri: card.image }} style={[styles.tileImage, { width, height: width }]} />
      ) : (
        <View style={[styles.tileImage, { width, height: width }]} />
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

export type BannerSettings = {
  imageUrl?: string;
  heading?: string;
  subheading?: string;
  /** Collection handle to open when tapped. */
  handle?: string;
};

export function Banner({
  settings,
  onOpenCollection,
}: {
  settings: BannerSettings;
  onOpenCollection?: (handle: string) => void;
}) {
  const { imageUrl, heading, subheading, handle } = settings;
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
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../theme";
import { SectionHeading } from "./Pieces";
import type { HomePayload } from "../api";

export type CategoriesSettings = { title?: string };

export function Categories({
  settings,
  collections,
  onOpenCollection,
}: {
  settings: CategoriesSettings;
  collections: HomePayload["collections"];
  onOpenCollection?: (handle: string) => void;
}) {
  if (!collections.length) return null;
  return (
    <>
      <SectionHeading title={settings.title ?? ""} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {collections.map((c) => (
          <Pressable key={c.handle} style={styles.chip} onPress={() => onOpenCollection?.(c.handle)}>
            <Text style={styles.chipText}>{c.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6 },
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

export type ReviewsSettings = { title?: string; limit?: number };

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
      <SectionHeading title={settings.title || "What customers say"} />
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
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, theme } from "./theme";
import { fetchHome, type HomePayload } from "./api";
${imports}

export default function HomeScreen({
  onOpenCollection,
  onOpenProduct,
}: {
  onOpenCollection?: (handle: string) => void;
  onOpenProduct?: (id: string) => void;
}) {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <ScrollView contentContainerStyle={styles.content}>
${rendered}
      </ScrollView>
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
    banner: ["onOpenCollection={onOpenCollection}"],
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

/** A block's settings as a JS object literal, keeping only what it uses. */
function settingsLiteral(block: Block): string {
  const keep: Record<BlockType, string[]> = {
    banner: ["imageUrl", "heading", "subheading", "handle"],
    categories: ["title"],
    new_arrivals: ["title", "limit"],
    collection_row: ["handle", "title", "limit"],
    collection_grid: ["handle", "title", "limit"],
    reviews: ["title", "limit"],
    text: ["heading", "body"],
  };
  const set = block.settings ?? {};
  const parts = keep[block.type]
    .map((k) => {
      const v = set[k];
      if (k === "limit") return `${k}: ${n(v, 8)}`;
      const text = s(v);
      return text ? `${k}: ${q(text)}` : null;
    })
    .filter(Boolean);
  return parts.length ? `{ ${parts.join(", ")} }` : "{}";
}

/** Every file the app needs for its home screen, current as of this theme. */
export function generateApp(theme: AppTheme, baseUrl: string): GeneratedFile[] {
  const used = [...new Set(theme.blocks.map((b) => b.type))];
  return [
    themeFile(theme),
    apiFile(baseUrl),
    homeScreenFile(theme),
    piecesFile(),
    ...used.map(sectionFile).sort((a, b) => a.path.localeCompare(b.path)),
  ];
}
