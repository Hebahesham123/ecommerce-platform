// The look and wording of the Beauty Bar Society, as data.
//
// The Society pages were built with their palette written into the markup — the
// brown and beige from the design, about a hundred and fifty times over. That
// is fine until somebody wants to change it, at which point it is a hundred and
// fifty edits and a deploy. So the colours become named roles here, the pages
// read them as CSS variables, and the dashboard writes them.
//
// Client-safe: no server-only imports, because the editor, the customer page
// and the summary card all need these shapes.

/** One editable colour: the variable the pages read, and what it is for. */
export type ColourRole =
  | "page"
  | "card"
  | "panel"
  | "line"
  | "ink"
  | "inkMuted"
  | "inkSoft"
  | "accent"
  | "accentTo"
  | "gold"
  | "deep"
  | "deepTo"
  | "onDeep"
  | "onDeepSoft"
  | "success";

export type LoyaltyTheme = {
  colours: Record<ColourRole, string>;
  words: {
    /** The small line above the title, e.g. BEAUTY BAR. */
    brandLine: string;
    /** The big serif word, e.g. SOCIETY. */
    title: string;
    tagline: string;
    /** The label over the balance, e.g. YOUR STATUS. */
    statusLabel: string;
    /** What a point is called. Appears under every balance. */
    pointsWord: string;
    /** The mark a signature is drawn with. One character reads best. */
    glyph: string;
    /** The kicker on the compact card that links into the hub. */
    cardKicker: string;
  };
  /** The row of tabs across the hub. An empty label keeps the built-in word. */
  tabLabels: Record<TabKey, string>;
  /**
   * The wording inside each section: its headings, the line shown when it has
   * nothing to show, and the words on its buttons.
   *
   * Keyed by section, then by field, with an empty string meaning the page
   * keeps the word it ships with. What the fields are, and what those
   * built-in words say, is SECTION_FIELDS below - one table, read by the
   * editor to draw the controls and by the page to render, so a field can
   * never exist in one and not the other.
   */
  sections: Record<string, Record<string, string>>;
};

export type TabKey =
  | "overview"
  | "levels"
  | "vault"
  | "rewards"
  | "privileges"
  | "events"
  | "streak"
  | "activity";

export const TAB_KEYS: TabKey[] = [
  "overview",
  "levels",
  "vault",
  "rewards",
  "privileges",
  "events",
  "streak",
  "activity",
];

/** The word each tab uses when the merchant has not chosen one. */
export const TAB_FALLBACK: Record<TabKey, string> = {
  overview: "Society",
  levels: "Levels",
  vault: "Vault",
  rewards: "Rewards",
  privileges: "Privileges",
  events: "Events",
  streak: "Streak",
  activity: "Activity",
};

/** A section of the hub, plus the row of things every section shares. */
export type SectionScope = TabKey | "shared";

export type SectionFieldSpec = {
  scope: SectionScope;
  key: string;
  en: string;
  ar: string;
  /** What the page shows when the merchant has not set one. */
  fallback: string;
};

/**
 * Every word on the Society that is not a shopper's own data.
 *
 * The fallbacks are exactly the strings that were written into the markup, so
 * a store that never opens the editor reads the same as it did before any of
 * this existed.
 */
export const SECTION_FIELDS: SectionFieldSpec[] = [
  // ---- the parts every section sits under
  { scope: "shared", key: "balanceLabel", en: "Balance", ar: "الرصيد", fallback: "Balance" },
  { scope: "shared", key: "lifetimeLabel", en: "Lifetime", ar: "الإجمالي", fallback: "Lifetime" },
  { scope: "shared", key: "streakLabel", en: "Streak", ar: "التتابع", fallback: "Streak" },
  {
    scope: "shared",
    key: "topLevelText",
    en: "At the highest level",
    ar: "عند أعلى مستوى",
    fallback: "You've reached the highest level.",
  },
  { scope: "shared", key: "revealKicker", en: "Reward reveal kicker", ar: "عنوان الجائزة", fallback: "YOU UNLOCKED" },
  { scope: "shared", key: "revealCta", en: "Reward reveal button", ar: "زر الجائزة", fallback: "View reward" },

  // ---- overview
  { scope: "overview", key: "privilegesTitle", en: "Privileges heading", ar: "عنوان المزايا", fallback: "Your privileges" },
  {
    scope: "overview",
    key: "privilegesEmpty",
    en: "Privileges, when there are none",
    ar: "نص المزايا الفارغة",
    fallback: "Reach The Curated to unlock your first privilege.",
  },
  { scope: "overview", key: "privilegesLink", en: "Privileges link", ar: "رابط المزايا", fallback: "View all privileges →" },
  { scope: "overview", key: "rewardsTitle", en: "Rewards heading", ar: "عنوان المكافآت", fallback: "Rewards for you" },
  { scope: "overview", key: "rewardsLink", en: "Rewards link", ar: "رابط المكافآت", fallback: "See all rewards →" },
  { scope: "overview", key: "eventsTitle", en: "Events heading", ar: "عنوان الفعاليات", fallback: "Happening now" },

  // ---- levels
  { scope: "levels", key: "title", en: "Heading", ar: "العنوان", fallback: "The Levels" },
  { scope: "levels", key: "reachedLabel", en: "Reached", ar: "تم الوصول", fallback: "reached" },

  // ---- vault
  { scope: "vault", key: "title", en: "Heading", ar: "العنوان", fallback: "The Vaults" },
  { scope: "vault", key: "readyText", en: "Ready to open", ar: "جاهز للفتح", fallback: "Your reward is ready." },
  { scope: "vault", key: "openCta", en: "Open button", ar: "زر الفتح", fallback: "Open the Vault" },
  { scope: "vault", key: "openNowCta", en: "Open button, in the list", ar: "زر الفتح بالقائمة", fallback: "Open now" },
  { scope: "vault", key: "openingLabel", en: "While opening", ar: "أثناء الفتح", fallback: "Opening…" },
  { scope: "vault", key: "openedLabel", en: "Already opened", ar: "تم فتحه", fallback: "Opened ✓" },
  { scope: "vault", key: "lockedPrefix", en: "Locked line", ar: "سطر القفل", fallback: "🔒 Unlocks at" },

  // ---- rewards
  { scope: "rewards", key: "title", en: "Heading", ar: "العنوان", fallback: "Your rewards" },
  { scope: "rewards", key: "claimedTitle", en: "Claimed heading", ar: "عنوان المستلمة", fallback: "Claimed" },
  { scope: "rewards", key: "redeemCta", en: "Redeem button", ar: "زر الاستبدال", fallback: "Redeem" },
  { scope: "rewards", key: "lockedLabel", en: "Locked label", ar: "كلمة المقفل", fallback: "Locked" },
  { scope: "rewards", key: "levelRewardLabel", en: "Level reward", ar: "مكافأة مستوى", fallback: "Level reward" },

  // ---- privileges
  { scope: "privileges", key: "title", en: "Heading", ar: "العنوان", fallback: "Your privileges" },

  // ---- events
  { scope: "events", key: "title", en: "Heading", ar: "العنوان", fallback: "Society events" },
  {
    scope: "events",
    key: "empty",
    en: "When there are none",
    ar: "نص الفراغ",
    fallback: "No events right now — check back soon.",
  },

  // ---- streak
  { scope: "streak", key: "title", en: "Heading", ar: "العنوان", fallback: "Your society streak" },
  { scope: "streak", key: "currentLabel", en: "Current", ar: "الحالي", fallback: "Current" },
  { scope: "streak", key: "longestLabel", en: "Longest", ar: "الأطول", fallback: "Longest" },

  // ---- activity
  { scope: "activity", key: "title", en: "Heading", ar: "العنوان", fallback: "Your activity" },
  {
    scope: "activity",
    key: "empty",
    en: "When there is none",
    ar: "نص الفراغ",
    fallback: "No signatures yet — place an order to start earning.",
  },
  { scope: "activity", key: "moreCta", en: "Full history button", ar: "زر السجل", fallback: "See full history" },
  { scope: "activity", key: "loadingLabel", en: "While loading", ar: "أثناء التحميل", fallback: "Loading…" },
];

/** The sections in the order the editor lists them. */
export const SECTION_SCOPES: SectionScope[] = ["shared", ...TAB_KEYS];

export const SCOPE_LABELS: Record<SectionScope, { en: string; ar: string }> = {
  shared: { en: "Shared across the hub", ar: "مشترك في كل الصفحة" },
  overview: { en: "Society", ar: "الرئيسية" },
  levels: { en: "Levels", ar: "المستويات" },
  vault: { en: "Vault", ar: "الخزنة" },
  rewards: { en: "Rewards", ar: "المكافآت" },
  privileges: { en: "Privileges", ar: "المزايا" },
  events: { en: "Events", ar: "الفعاليات" },
  streak: { en: "Streak", ar: "التتابع" },
  activity: { en: "Activity", ar: "النشاط" },
};

/**
 * What each colour is called in the dashboard, and what it actually paints.
 *
 * The order here is the order of the controls, grouped so a merchant changing
 * "the beige" finds the three beiges together rather than hunting.
 */
export const COLOUR_FIELDS: {
  key: ColourRole;
  group: "surfaces" | "text" | "brand" | "dark" | "signal";
  en: string;
  ar: string;
}[] = [
  { key: "page", group: "surfaces", en: "Page background", ar: "خلفية الصفحة" },
  { key: "card", group: "surfaces", en: "Card background", ar: "خلفية البطاقات" },
  { key: "panel", group: "surfaces", en: "Inset panel", ar: "الخلفية الداخلية" },
  { key: "line", group: "surfaces", en: "Borders", ar: "الحدود" },
  { key: "ink", group: "text", en: "Headings", ar: "العناوين" },
  { key: "inkMuted", group: "text", en: "Body text", ar: "النص" },
  { key: "inkSoft", group: "text", en: "Faint labels", ar: "النص الخافت" },
  { key: "accent", group: "brand", en: "Brand colour", ar: "لون الهوية" },
  { key: "accentTo", group: "brand", en: "Brand gradient end", ar: "نهاية تدرّج الهوية" },
  { key: "gold", group: "brand", en: "Gold highlight", ar: "اللون الذهبي" },
  { key: "deep", group: "dark", en: "Dark card", ar: "البطاقة الداكنة" },
  { key: "deepTo", group: "dark", en: "Dark card gradient end", ar: "نهاية تدرّج الداكنة" },
  { key: "onDeep", group: "dark", en: "Text on dark", ar: "النص على الداكن" },
  { key: "onDeepSoft", group: "dark", en: "Faint text on dark", ar: "النص الخافت على الداكن" },
  { key: "success", group: "signal", en: "Positive", ar: "الإيجابي" },
];

export const GROUP_LABELS: Record<
  (typeof COLOUR_FIELDS)[number]["group"],
  { en: string; ar: string }
> = {
  surfaces: { en: "Surfaces", ar: "الأسطح" },
  text: { en: "Text", ar: "النص" },
  brand: { en: "Brand", ar: "الهوية" },
  dark: { en: "The dark card", ar: "البطاقة الداكنة" },
  signal: { en: "Signals", ar: "الإشارات" },
};

/**
 * Exactly what the pages looked like before any of this existed.
 *
 * A store that never opens the editor must see no change at all, so these are
 * the hexes that were in the markup, not an approximation of them.
 */
export const DEFAULT_LOYALTY_THEME: LoyaltyTheme = {
  colours: {
    page: "#f4ece1",
    card: "#fffaf3",
    panel: "#f6ede0",
    line: "#e7d8c4",
    ink: "#3b2a1e",
    inkMuted: "#8a6e57",
    inkSoft: "#a0876d",
    accent: "#8a5a2b",
    accentTo: "#c79a5b",
    gold: "#e0b877",
    deep: "#2b2119",
    deepTo: "#43301f",
    onDeep: "#f0e6d8",
    onDeepSoft: "#c9b79f",
    success: "#2f7d4f",
  },
  words: {
    brandLine: "BEAUTY BAR",
    title: "SOCIETY",
    tagline: "Collect Signatures. Unlock Privileges.",
    statusLabel: "YOUR STATUS",
    pointsWord: "signatures",
    glyph: "✦",
    cardKicker: "YOUR SOCIETY",
  },
  sections: {},
  tabLabels: {
    overview: "",
    levels: "",
    vault: "",
    rewards: "",
    privileges: "",
    events: "",
    streak: "",
    activity: "",
  },
};

const str = (v: unknown, fallback: string, max: number): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : fallback;
};

/** A hex colour, or the default. Anything else would reach the page as CSS. */
const colour = (v: unknown, fallback: string): string => {
  const s = String(v ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
};

/**
 * Whatever is in the settings document, as a theme the pages can render.
 *
 * Every field is checked rather than trusted: this JSON is written by the
 * dashboard today, but a colour that reached a page unchecked would be CSS
 * somebody typed, and the page has no way to tell the difference.
 */
export function normalizeLoyaltyTheme(raw: unknown): LoyaltyTheme {
  const d = DEFAULT_LOYALTY_THEME;
  const row = (raw ?? {}) as Record<string, unknown>;
  const c = (row.colours ?? {}) as Record<string, unknown>;
  const w = (row.words ?? {}) as Record<string, unknown>;
  const t = (row.tabLabels ?? {}) as Record<string, unknown>;

  const colours = {} as Record<ColourRole, string>;
  for (const f of COLOUR_FIELDS) colours[f.key] = colour(c[f.key], d.colours[f.key]);

  const tabLabels = {} as Record<TabKey, string>;
  for (const key of TAB_KEYS) {
    const label = typeof t[key] === "string" ? (t[key] as string).trim().slice(0, 24) : "";
    tabLabels[key] = label;
  }

  const sections: Record<string, Record<string, string>> = {};
  const rawSections = (row.sections ?? {}) as Record<string, unknown>;
  for (const f of SECTION_FIELDS) {
    const scope = (rawSections[f.scope] ?? {}) as Record<string, unknown>;
    const value = typeof scope[f.key] === "string" ? (scope[f.key] as string).trim().slice(0, 160) : "";
    if (!sections[f.scope]) sections[f.scope] = {};
    sections[f.scope][f.key] = value;
  }

  return {
    colours,
    sections,
    words: {
      brandLine: str(w.brandLine, d.words.brandLine, 40),
      title: str(w.title, d.words.title, 40),
      tagline: str(w.tagline, d.words.tagline, 120),
      statusLabel: str(w.statusLabel, d.words.statusLabel, 40),
      pointsWord: str(w.pointsWord, d.words.pointsWord, 24),
      // One character reads best, but an emoji is two code units, so this
      // counts characters rather than slicing bytes off the middle of one.
      glyph: [...str(w.glyph, d.words.glyph, 8)].slice(0, 2).join(""),
      cardKicker: str(w.cardKicker, d.words.cardKicker, 40),
    },
    tabLabels,
  };
}

/** The theme as the CSS variables the Society pages read. */
export function loyaltyVars(theme: LoyaltyTheme): Record<string, string> {
  return {
    "--ls-page": theme.colours.page,
    "--ls-card": theme.colours.card,
    "--ls-panel": theme.colours.panel,
    "--ls-line": theme.colours.line,
    "--ls-ink": theme.colours.ink,
    "--ls-ink-muted": theme.colours.inkMuted,
    "--ls-ink-soft": theme.colours.inkSoft,
    "--ls-accent": theme.colours.accent,
    "--ls-accent-to": theme.colours.accentTo,
    "--ls-gold": theme.colours.gold,
    "--ls-deep": theme.colours.deep,
    "--ls-deep-to": theme.colours.deepTo,
    "--ls-on-deep": theme.colours.onDeep,
    "--ls-on-deep-soft": theme.colours.onDeepSoft,
    "--ls-success": theme.colours.success,
  };
}

/**
 * A section's word: the merchant's, or the one the page ships with.
 *
 * Unknown keys fall back to an empty string rather than throwing, so a page
 * that asks for a field nobody has added yet renders blank instead of white.
 */
export function sectionText(
  theme: LoyaltyTheme,
  scope: SectionScope,
  key: string,
): string {
  const set = theme.sections?.[scope]?.[key];
  if (set) return set;
  return SECTION_FIELDS.find((f) => f.scope === scope && f.key === key)?.fallback ?? "";
}

/** The tab's word: the merchant's, or the one the app ships with. */
export const tabLabel = (theme: LoyaltyTheme, key: TabKey): string =>
  theme.tabLabels[key] || TAB_FALLBACK[key];
