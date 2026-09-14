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
  /**
   * The shape of the thing, rather than its colour or its wording: what the
   * corners do, which face the headings are set in, whether a level card
   * carries its numeral. The design these screens are built to has answers
   * for all of them; these are those answers, and the merchant's if they
   * decide otherwise.
   */
  design: {
    /** "serif" is the display face the design uses for every heading. */
    headingFont: string;
    /** Corner radius, in pixels, for cards and panels. */
    radius: number;
    /** Corner radius for buttons. The design squares them off. */
    buttonRadius: number;
    /** The 01..05 numerals down the side of the level cards. */
    levelNumerals: boolean;
    /** Level cards deepen as the levels rise, the way the design does. */
    levelGradient: boolean;
    /** How many privileges sit in a row on the overview. */
    privilegeColumns: number;
    /** A picture beside each reward. */
    rewardThumbs: boolean;
    /** The picture behind the vault's header. */
    vaultHeroImage: string;
    /** Headings in capitals with the letters spaced, as in the design. */
    headingUppercase: boolean;
    /**
     * Which way the hub reads.
     *
     * It has to be its own answer rather than inherited: the dashboard is
     * right-to-left, and the hub rendered inside it turned "340 / 500" into
     * "500 / 340" and filled the level marks from the wrong end. The design
     * is left-to-right, so that is the default, and a merchant writing the
     * whole thing in Arabic can say so.
     */
    direction: string;
  };
  /**
   * The overview's sections, in order, and whether each is shown.
   *
   * The same idea as the app theme's home screen: the merchant arranges what
   * a shopper meets first. Unknown keys are dropped and missing ones appended
   * on the way in, so a stored order can never hide a section that exists or
   * name one that does not.
   */
  overview: { key: OverviewKey; visible: boolean }[];
};

/** The sections the overview can show, in the order the design has them. */
export type OverviewKey = "status" | "vault" | "privileges" | "rewards" | "events";

export const OVERVIEW_KEYS: OverviewKey[] = ["status", "vault", "privileges", "rewards", "events"];

export const OVERVIEW_LABELS: Record<OverviewKey, { en: string; ar: string }> = {
  status: { en: "Status card", ar: "بطاقة الحالة" },
  vault: { en: "Vault teaser", ar: "تشويق الخزنة" },
  privileges: { en: "Privileges", ar: "المزايا" },
  rewards: { en: "Rewards", ar: "المكافآت" },
  events: { en: "Events", ar: "الفعاليات" },
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
  { scope: "shared", key: "viewLevelsCta", en: "Levels button", ar: "زر المستويات", fallback: "VIEW LEVELS" },

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
  { scope: "vault", key: "subtitle", en: "Subtitle", ar: "الوصف", fallback: "Your personal space for exclusive rewards." },
  { scope: "vault", key: "collectionsTitle", en: "Collections heading", ar: "عنوان المجموعات", fallback: "VAULT COLLECTIONS" },
  { scope: "vault", key: "remainingText", en: "How many more are needed", ar: "كم تبقّى", fallback: "more Signatures to unlock your reward." },

  // ---- rewards
  { scope: "rewards", key: "title", en: "Heading", ar: "العنوان", fallback: "Your rewards" },
  { scope: "rewards", key: "claimedTitle", en: "Claimed heading", ar: "عنوان المستلمة", fallback: "Claimed" },
  { scope: "rewards", key: "redeemCta", en: "Redeem button", ar: "زر الاستبدال", fallback: "Redeem" },
  { scope: "rewards", key: "lockedLabel", en: "Locked label", ar: "كلمة المقفل", fallback: "Locked" },
  { scope: "rewards", key: "levelRewardLabel", en: "Level reward", ar: "مكافأة مستوى", fallback: "Level reward" },
  { scope: "rewards", key: "filterAvailable", en: "Filter: available", ar: "متاح الآن", fallback: "AVAILABLE NOW" },
  { scope: "rewards", key: "filterLocked", en: "Filter: locked", ar: "مقفل", fallback: "LOCKED" },
  { scope: "rewards", key: "filterAll", en: "Filter: everything", ar: "الكل", fallback: "ALL" },

  // ---- privileges
  { scope: "privileges", key: "title", en: "Heading", ar: "العنوان", fallback: "Your privileges" },
  { scope: "privileges", key: "lockedNote", en: "Locked note", ar: "ملاحظة القفل", fallback: "Reach {level} to unlock." },

  // ---- events
  { scope: "events", key: "title", en: "Heading", ar: "العنوان", fallback: "Society events" },
  {
    scope: "events",
    key: "empty",
    en: "When there are none",
    ar: "نص الفراغ",
    fallback: "No events right now — check back soon.",
  },
  { scope: "events", key: "subtitle", en: "Subtitle", ar: "الوصف", fallback: "Exclusive moments, just for you." },

  // ---- streak
  { scope: "streak", key: "title", en: "Heading", ar: "العنوان", fallback: "Your society streak" },
  { scope: "streak", key: "currentLabel", en: "Current", ar: "الحالي", fallback: "Current" },
  { scope: "streak", key: "longestLabel", en: "Longest", ar: "الأطول", fallback: "Longest" },
  { scope: "streak", key: "subtitle", en: "Subtitle", ar: "الوصف", fallback: "Keep the momentum going." },
  { scope: "streak", key: "milestoneKicker", en: "Next milestone kicker", ar: "عنوان الهدف", fallback: "NEXT MILESTONE" },
  { scope: "streak", key: "monthsWord", en: "The word for months", ar: "كلمة الأشهر", fallback: "MONTH STREAK" },

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
  design: {
    headingFont: "serif",
    radius: 18,
    buttonRadius: 8,
    levelNumerals: true,
    levelGradient: true,
    privilegeColumns: 3,
    rewardThumbs: true,
    vaultHeroImage: "",
    headingUppercase: true,
    direction: "ltr",
  },
  overview: OVERVIEW_KEYS.map((key) => ({ key, visible: true })),
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
  const defaults = DEFAULT_LOYALTY_THEME;
  const row = (raw ?? {}) as Record<string, unknown>;
  const c = (row.colours ?? {}) as Record<string, unknown>;
  const w = (row.words ?? {}) as Record<string, unknown>;
  const t = (row.tabLabels ?? {}) as Record<string, unknown>;

  const colours = {} as Record<ColourRole, string>;
  for (const f of COLOUR_FIELDS) colours[f.key] = colour(c[f.key], defaults.colours[f.key]);

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

  const d = (row.design ?? {}) as Record<string, unknown>;
  const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const size = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  // The merchant's order, over the keys that exist, and never short: a stored
  // list from an older build would otherwise hide whatever was added since.
  const seen = new Set<OverviewKey>();
  const overview: { key: OverviewKey; visible: boolean }[] = [];
  for (const raw of Array.isArray(row.overview) ? (row.overview as unknown[]) : []) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const key = String(item.key) as OverviewKey;
    if (!OVERVIEW_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    overview.push({ key, visible: item.visible !== false });
  }
  for (const key of OVERVIEW_KEYS) if (!seen.has(key)) overview.push({ key, visible: true });

  return {
    colours,
    sections,
    design: {
      headingFont: str(d.headingFont, defaults.design.headingFont, 24) === "system" ? "system" : "serif",
      radius: size(d.radius, defaults.design.radius, 0, 40),
      buttonRadius: size(d.buttonRadius, defaults.design.buttonRadius, 0, 40),
      levelNumerals: flag(d.levelNumerals, defaults.design.levelNumerals),
      levelGradient: flag(d.levelGradient, defaults.design.levelGradient),
      privilegeColumns: size(d.privilegeColumns, defaults.design.privilegeColumns, 2, 4),
      rewardThumbs: flag(d.rewardThumbs, defaults.design.rewardThumbs),
      vaultHeroImage: /^https?:\/\//i.test(String(d.vaultHeroImage ?? "")) ? String(d.vaultHeroImage) : "",
      headingUppercase: flag(d.headingUppercase, defaults.design.headingUppercase),
      direction: str(d.direction, defaults.design.direction, 4) === "rtl" ? "rtl" : "ltr",
    },
    overview,
    words: {
      brandLine: str(w.brandLine, defaults.words.brandLine, 40),
      title: str(w.title, defaults.words.title, 40),
      tagline: str(w.tagline, defaults.words.tagline, 120),
      statusLabel: str(w.statusLabel, defaults.words.statusLabel, 40),
      pointsWord: str(w.pointsWord, defaults.words.pointsWord, 24),
      // One character reads best, but an emoji is two code units, so this
      // counts characters rather than slicing bytes off the middle of one.
      glyph: [...str(w.glyph, defaults.words.glyph, 8)].slice(0, 2).join(""),
      cardKicker: str(w.cardKicker, defaults.words.cardKicker, 40),
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
    // The shape of things, so a card and a button can read their corners from
    // the same place the colours come from.
    "--ls-radius": theme.design.radius + "px",
    "--ls-button-radius": theme.design.buttonRadius + "px",
  };
}

/**
 * The display face for headings.
 *
 * The design sets every heading in a serif; "system" hands the page back to
 * whatever the shopper's phone uses, for a merchant who wants plainer.
 */
export const headingClass = (theme: LoyaltyTheme): string =>
  theme.design.headingFont === "serif" ? "font-serif" : "font-sans";

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
