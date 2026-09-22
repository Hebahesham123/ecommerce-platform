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
  | "hero"
  | "promo_bar"
  | "banner"
  | "categories"
  | "collection_row"
  | "collection_grid"
  | "collection_tabs"
  | "new_arrivals"
  | "cards"
  | "tiers"
  | "split"
  | "trust_badges"
  | "live_now"
  | "coming_up_live"
  | "countdown_deals"
  | "info_rows"
  | "shipping_goal"
  | "payment_plans"
  | "price_slider"
  | "offer_cards"
  | "product_reasons"
  | "circle_row"
  | "pick_colour"
  | "price_drop"
  | "style_profile"
  | "promo_card"
  | "complete_look"
  | "brand_timeline"
  | "review_summary"
  | "showcase"
  | "reviews"
  | "text";

/**
 * A repeatable thing inside a section — a slide, a category, a tab, a tier.
 *
 * Theme sections have blocks inside them; so do these, for the same reason:
 * a hero with three slides is one section the merchant arranges, not three
 * sections that happen to sit together. Stored in `settings.items`.
 */
export type Item = { id: string; [k: string]: unknown };

/** The items of a block, whatever shape they are. */
export function itemsOf(block: Block): Item[] {
  const raw = (block.settings ?? {}).items;
  return Array.isArray(raw) ? (raw as Item[]).filter((i) => i && typeof i === "object") : [];
}

/** Which block types hold a list, and what one new entry looks like. */
export const ITEM_SHAPE: Partial<Record<BlockType, { ar: string; en: string; blank: () => Item }>> = {
  hero: {
    ar: "شريحة",
    en: "Slide",
    blank: () => ({ id: itemId(), imageUrl: "", kicker: "", heading: "", subheading: "", handle: "" }),
  },
  categories: {
    ar: "قسم",
    en: "Category",
    blank: () => ({ id: itemId(), handle: "", label: "", emoji: "", imageUrl: "" }),
  },
  collection_tabs: {
    ar: "تبويب",
    en: "Tab",
    blank: () => ({ id: itemId(), handle: "", label: "", emoji: "" }),
  },
  cards: {
    ar: "بطاقة",
    en: "Card",
    blank: () => ({ id: itemId(), imageUrl: "", title: "", subtitle: "", handle: "" }),
  },
  tiers: {
    ar: "فئة سعرية",
    en: "Tier",
    blank: () => ({ id: itemId(), prefix: "From", amount: "", label: "", handle: "" }),
  },
  split: {
    ar: "لوحة",
    en: "Panel",
    blank: () => ({ id: itemId(), imageUrl: "", label: "", buttonLabel: "", handle: "" }),
  },
  trust_badges: {
    ar: "شارة",
    en: "Badge",
    blank: () => ({ id: itemId(), emoji: "", title: "", subtitle: "" }),
  },
  live_now: {
    ar: "بث",
    en: "Live",
    blank: () => ({ id: itemId(), imageUrl: "", name: "", viewers: "", handle: "", url: "" }),
  },
  coming_up_live: {
    ar: "موعد",
    en: "Session",
    blank: () => ({ id: itemId(), imageUrl: "", title: "", when: "", handle: "", url: "" }),
  },
  countdown_deals: {
    ar: "صفقة",
    en: "Deal",
    blank: () => ({
      id: itemId(),
      imageUrl: "",
      badge: "",
      price: "",
      comparePrice: "",
      claimed: "",
      handle: "",
      url: "",
    }),
  },
  info_rows: {
    ar: "سطر",
    en: "Row",
    blank: () => ({ id: itemId(), emoji: "", title: "", subtitle: "", note: "", handle: "", url: "" }),
  },
  payment_plans: {
    ar: "طريقة دفع",
    en: "Plan",
    blank: () => ({ id: itemId(), name: "", headline: "", note: "", color: "", handle: "", url: "" }),
  },
  price_slider: {
    ar: "خطة تقسيط",
    en: "Instalment plan",
    blank: () => ({ id: itemId(), name: "", months: "", badge: "", color: "" }),
  },
  offer_cards: {
    ar: "عرض",
    en: "Offer",
    blank: () => ({ id: itemId(), badge: "", title: "", subtitle: "", color: "", handle: "", url: "" }),
  },
  product_reasons: {
    ar: "منتج",
    en: "Product",
    blank: () => ({
      id: itemId(),
      imageUrl: "",
      reason: "",
      name: "",
      price: "",
      comparePrice: "",
      badge: "",
      rating: "",
      sold: "",
      handle: "",
      url: "",
    }),
  },
  circle_row: {
    ar: "دائرة",
    en: "Circle",
    blank: () => ({ id: itemId(), imageUrl: "", label: "", note: "", handle: "", url: "" }),
  },
  pick_colour: {
    ar: "لون",
    en: "Colour",
    blank: () => ({ id: itemId(), imageUrl: "", color: "", label: "", line1: "", line2: "", handle: "", url: "" }),
  },
  price_drop: {
    ar: "صورة",
    en: "Thumbnail",
    blank: () => ({ id: itemId(), imageUrl: "" }),
  },
  style_profile: {
    ar: "وسم",
    en: "Tag",
    blank: () => ({ id: itemId(), label: "", color: "", handle: "", url: "" }),
  },
  brand_timeline: {
    ar: "ماركة",
    en: "Brand",
    blank: () => ({ id: itemId(), logoText: "", label: "", title: "", description: "", imageUrl: "", focal: "", handle: "", url: "" }),
  },
  complete_look: {
    ar: "قاعدة توافق",
    en: "Pairing rule",
    blank: () => ({ id: itemId(), from: "", to1: "", to2: "", to3: "" }),
  },
};

export function itemId(): string {
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * What one field of an item is, so the editor knows which control to draw.
 *
 * "link" and "collection" look alike and are not: a link is where tapping the
 * item takes the shopper, and can be a collection, a product, a screen or a
 * web address. A "collection" is which collection the item is *made of* - the
 * tab strip reads its products - and only a collection will do.
 */
export type FieldKind = "text" | "image" | "link" | "collection" | "emoji" | "color";
export type FieldSpec = { key: string; kind: FieldKind; ar: string; en: string };

/**
 * The fields each kind of item has.
 *
 * One list, used by the editor to draw the controls and by the code generator
 * to decide what travels with the block. Adding a field in one place and
 * forgetting the other is exactly the drift this avoids.
 */
export const ITEM_FIELDS: Partial<Record<BlockType, FieldSpec[]>> = {
  hero: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Image" },
    { key: "kicker", kind: "text", ar: "سطر علوي", en: "Kicker" },
    { key: "heading", kind: "text", ar: "العنوان", en: "Heading" },
    { key: "subheading", kind: "text", ar: "سطر فرعي", en: "Subheading" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  categories: [
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
    { key: "label", kind: "text", ar: "الاسم", en: "Label" },
    { key: "emoji", kind: "emoji", ar: "أيقونة", en: "Emoji" },
  ],
  collection_tabs: [
    { key: "handle", kind: "collection", ar: "القسم", en: "Collection" },
    { key: "label", kind: "text", ar: "اسم التبويب", en: "Tab label" },
    { key: "emoji", kind: "emoji", ar: "أيقونة", en: "Emoji" },
  ],
  cards: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Image" },
    { key: "title", kind: "text", ar: "العنوان", en: "Title" },
    { key: "subtitle", kind: "text", ar: "سطر فرعي", en: "Subtitle" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  tiers: [
    { key: "prefix", kind: "text", ar: "قبل السعر", en: "Prefix" },
    { key: "amount", kind: "text", ar: "السعر", en: "Amount" },
    { key: "label", kind: "text", ar: "الوصف", en: "Label" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  split: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Image" },
    { key: "label", kind: "text", ar: "العنوان", en: "Label" },
    { key: "buttonLabel", kind: "text", ar: "نص الزر", en: "Button text" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  trust_badges: [
    { key: "emoji", kind: "emoji", ar: "أيقونة", en: "Emoji" },
    { key: "title", kind: "text", ar: "العنوان", en: "Title" },
    { key: "subtitle", kind: "text", ar: "سطر فرعي", en: "Subtitle" },
  ],
  live_now: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" },
    { key: "name", kind: "text", ar: "الاسم", en: "Name" },
    { key: "viewers", kind: "text", ar: "المشاهدون", en: "Viewers" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  coming_up_live: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" },
    { key: "title", kind: "text", ar: "العنوان", en: "Title" },
    { key: "when", kind: "text", ar: "الموعد", en: "When" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  countdown_deals: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" },
    { key: "badge", kind: "text", ar: "الشارة", en: "Badge" },
    { key: "price", kind: "text", ar: "السعر", en: "Price" },
    { key: "comparePrice", kind: "text", ar: "قبل الخصم", en: "Was" },
    { key: "claimed", kind: "text", ar: "نسبة المباع", en: "Claimed" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  info_rows: [
    { key: "emoji", kind: "emoji", ar: "أيقونة", en: "Icon" },
    { key: "title", kind: "text", ar: "العنوان", en: "Title" },
    { key: "subtitle", kind: "text", ar: "سطر فرعي", en: "Subtitle" },
    { key: "note", kind: "text", ar: "على اليسار", en: "Right note" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  payment_plans: [
    { key: "name", kind: "text", ar: "الجهة", en: "Provider" },
    { key: "headline", kind: "text", ar: "العرض", en: "Headline" },
    { key: "note", kind: "text", ar: "التفاصيل", en: "Detail" },
    { key: "color", kind: "color", ar: "لون البطاقة", en: "Card colour" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  price_slider: [
    { key: "logo", kind: "image", ar: "الشعار", en: "Logo" },
    { key: "name", kind: "text", ar: "الجهة", en: "Provider" },
    { key: "months", kind: "text", ar: "عدد الشهور", en: "Months" },
    { key: "badge", kind: "text", ar: "الشارة", en: "Badge" },
    { key: "perks", kind: "text", ar: "المزايا (افصلي بـ ·)", en: "Perks (separate with ·)" },
    { key: "color", kind: "color", ar: "لون الشارة", en: "Badge colour" },
  ],
  offer_cards: [
    { key: "badge", kind: "text", ar: "الرقم الكبير", en: "Big number" },
    { key: "title", kind: "text", ar: "العنوان", en: "Title" },
    { key: "subtitle", kind: "text", ar: "الشرح", en: "Detail" },
    { key: "color", kind: "color", ar: "اللون", en: "Colour" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  product_reasons: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" },
    { key: "reason", kind: "text", ar: "سبب الاقتراح", en: "Why this" },
    { key: "name", kind: "text", ar: "اسم المنتج", en: "Product name" },
    { key: "price", kind: "text", ar: "السعر", en: "Price" },
    { key: "comparePrice", kind: "text", ar: "قبل الخصم", en: "Was" },
    { key: "badge", kind: "text", ar: "الشارة", en: "Badge" },
    { key: "rating", kind: "text", ar: "التقييم", en: "Rating" },
    { key: "sold", kind: "text", ar: "عدد المبيعات", en: "Sold" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  circle_row: [
    { key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" },
    { key: "label", kind: "text", ar: "الاسم", en: "Label" },
    { key: "note", kind: "text", ar: "تحت الاسم", en: "Under the label" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  pick_colour: [
    { key: "imageUrl", kind: "image", ar: "الصورة (شكل اللوحة)", en: "Picture (palette look)" },
    { key: "color", kind: "color", ar: "اللون", en: "Colour" },
    { key: "label", kind: "text", ar: "الاسم", en: "Label" },
    { key: "line1", kind: "text", ar: "السطر الأول", en: "First line" },
    { key: "line2", kind: "text", ar: "السطر الثاني", en: "Second line" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  price_drop: [{ key: "imageUrl", kind: "image", ar: "الصورة", en: "Photo" }],
  style_profile: [
    { key: "label", kind: "text", ar: "الوسم", en: "Tag" },
    { key: "color", kind: "color", ar: "لونه", en: "Its colour" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  // Read by the server, never shipped to the app: what someone bought decides
  // where the suggestions come from.
  brand_timeline: [
    { key: "imageUrl", kind: "image", ar: "صورة البطاقة", en: "Card picture" },
    { key: "logoText", kind: "text", ar: "الشعار داخل الدائرة (مثل LV)", en: "Logo in the circle (e.g. LV)" },
    { key: "label", kind: "text", ar: "الاسم تحت الدائرة", en: "Name under the circle" },
    { key: "title", kind: "text", ar: "العنوان على البطاقة", en: "Title on the card" },
    { key: "description", kind: "text", ar: "سطر تحت العنوان", en: "Line under the title" },
    { key: "focal", kind: "text", ar: "موضع الصورة (مثل 70% 30%)", en: "Picture position (e.g. 70% 30%)" },
    { key: "handle", kind: "link", ar: "يفتح", en: "Opens" },
  ],
  complete_look: [
    { key: "from", kind: "collection", ar: "إذا اشترت من", en: "When they bought from" },
    { key: "to1", kind: "collection", ar: "اقترحي من", en: "Suggest from" },
    { key: "to2", kind: "collection", ar: "ومن", en: "And from" },
    { key: "to3", kind: "collection", ar: "ومن", en: "And from" },
  ],
};

export type Block = {
  /** Stable across reorders, so React and the editor can follow a block. */
  id: string;
  type: BlockType;
  settings: Record<string, unknown>;
};

/** One shortcut in the row under the header. */
export type StripItem = {
  id: string;
  label: string;
  /** Exactly one of these four is set: where the chip goes. */
  handle: string;
  url: string;
  productId: string;
  screen: string;
};

export type AppSettings = {
  storeName: string;
  logoUrl: string | null;
  /** The one colour the app is built around: buttons, prices, the active tab. */
  accent: string;
  /** What every screen sits on, behind the cards. */
  background: string;
  announcement: string;
  announcementEnabled: boolean;
  /** Which navigation menu fills the app's drawer. */
  menuHandle: string;
  showSearch: boolean;

  /**
   * The header the app wears on every screen: a wordmark, a search field and
   * the two icons a shopper reaches for.
   *
   * The wordmark is two fields rather than one so the second half can carry
   * the accent - BEAUTY in ink, BAR in the brand colour - without asking a
   * merchant to write markup. An uploaded logo wins over both.
   */
  logoText: string;
  logoAccentText: string;
  searchPlaceholder: string;
  showWishlist: boolean;
  showBag: boolean;
  headerBg: string;
  headerInk: string;
  /**
   * The row of shortcuts that sits under the header on every screen.
   *
   * Chrome rather than a home block: it stays put while the page scrolls, so
   * it cannot be one of the sections a merchant drags around.
   */
  stripEnabled: boolean;
  strip: StripItem[];
  /**
   * What section titles are set in. "serif" is the face the website already
   * uses, which is most of why the site reads as more expensive than the app.
   */
  titleFont: string;
  /**
   * How much air the home screen leaves, in pixels.
   *
   * `sectionGap` is the space between one section and the next, and the
   * padding inside a banded section. `itemGap` is the space between the cards,
   * chips and tiles within a section - it scales the whole set rather than
   * flattening them, so a row of chips stays tighter than a row of cards.
   *
   * A phone screen is small and scrolling is the cost of every pixel of air,
   * so the defaults are tighter than a desktop page would use.
   */
  sectionGap: number;
  itemGap: number;
};

/**
 * The bottom tab bar.
 *
 * Order, wording and which of them appear are the merchant's, because a shop
 * that never takes returns should not have a tab for them and a shop in Cairo
 * should not be stuck with English labels. The keys are fixed, though: each
 * one is a screen the app knows how to draw, and a tab pointing at a screen
 * that does not exist is a tab that crashes.
 */
export type TabKey = "shop" | "live" | "cart" | "orders" | "account";

export type Tab = { key: TabKey; label: string; visible: boolean };

export const TAB_KEYS: TabKey[] = ["shop", "live", "cart", "orders", "account"];

export const TAB_DEFAULTS: Record<TabKey, { ar: string; en: string; icon: string }> = {
  shop: { ar: "المتجر", en: "Shop", icon: "◳" },
  live: { ar: "البث", en: "Live", icon: "◉" },
  cart: { ar: "السلة", en: "Cart", icon: "◔" },
  orders: { ar: "طلباتي", en: "Orders", icon: "◨" },
  account: { ar: "حسابي", en: "Account", icon: "◍" },
};

/**
 * Everything below the home screen.
 *
 * The home screen is blocks the merchant arranges; these are screens the app
 * already knows how to draw, where what varies is the wording and which
 * optional parts appear. Keeping them here rather than as more block types is
 * the honest split: nobody reorders a checkout.
 */
export type ScreenSettings = {
  collection: {
    columns: 2 | 3;
    showSort: boolean;
    sortDefault: string;
    /** The dark banner at the top: a small line, the title, and a line under it. */
    showHero: boolean;
    heroKicker: string;
    /** Empty writes "326 pieces · Chanel · Gucci…" from the collection itself. */
    heroSubtitle: string;
    heroFrom: string;
    heroTo: string;
    heroAccent: string;
    showBrandChips: boolean;
    showFilters: boolean;
    showLayoutToggle: boolean;
    showBadge: boolean;
    showWishlist: boolean;
    showVendor: boolean;
    showRating: boolean;
    ratingText: string;
    showQuickAdd: boolean;
    nameLines: number;
    pageSize: number;
    pageBg: string;
    cardBg: string;
    priceColor: string;
    inkColor: string;
    lineColor: string;
  };
  product: {
    showDescription: boolean;
    showVariants: boolean;
    showStock: boolean;
    addLabel: string;
    soldOutLabel: string;
    showThumbs: boolean;
    showBadge: boolean;
    showWishlist: boolean;
    showBreadcrumb: boolean;
    showRating: boolean;
    ratingValue: string;
    reviewCount: string;
    reviewsWord: string;
    verifiedLabel: string;
    showSave: boolean;
    saveLabel: string;
    showInstalments: boolean;
    instalmentsTitle: string;
    instalmentMonths: number;
    /** Provider names, split on a middle dot, a comma or a bar. */
    instalmentProviders: string;
    showQuantity: boolean;
    showBuyNow: boolean;
    buyNowLabel: string;
    showViewers: boolean;
    viewersMin: number;
    viewersMax: number;
    /** {n} is the number of people. */
    viewersText: string;
    lowStockAt: number;
    /** {n} is how many are left. */
    lowStockText: string;
    showPerks: boolean;
    perk1: string;
    perk2: string;
    perk3: string;
    descriptionTitle: string;
    shippingTitle: string;
    shippingText: string;
    showReviewsCard: boolean;
    reviewsKicker: string;
    reviewsHeading: string;
    reviewsItalic: string;
    reviewsButton: string;
    showRelated: boolean;
    relatedKicker: string;
    relatedTitle: string;
    pageBg: string;
    accentColor: string;
    inkColor: string;
    mutedColor: string;
    darkColor: string;
  };
  cart: {
    emptyText: string;
    showCoupon: boolean;
    couponLabel: string;
    checkoutLabel: string;
    totalLabel: string;
  };
  checkout: {
    title: string;
    note: string;
    placeLabel: string;
    askEmail: boolean;
    askNote: boolean;
  };
  account: {
    signedOutText: string;
    showReturns: boolean;
    showRequests: boolean;
    showReviews: boolean;
    returnsLabel: string;
    requestsLabel: string;
    reviewsLabel: string;
  };
};

export type ScreenKey = keyof ScreenSettings;
export const SCREEN_KEYS: ScreenKey[] = [
  "collection",
  "product",
  "cart",
  "checkout",
  "account",
];

export const SCREEN_LABELS: Record<ScreenKey | "home", { ar: string; en: string }> = {
  home: { ar: "الرئيسية", en: "Home" },
  collection: { ar: "قسم", en: "Collection" },
  product: { ar: "منتج", en: "Product" },
  cart: { ar: "السلة", en: "Cart" },
  checkout: { ar: "إتمام الطلب", en: "Checkout" },
  account: { ar: "الحساب", en: "Account" },
};

export type AppTheme = {
  settings: AppSettings;
  blocks: Block[];
  tabs: Tab[];
  screens: ScreenSettings;
};

/**
 * Live is off until a merchant turns it on.
 *
 * Every other tab is a place the app already has. A Live tab on a shop that
 * never streams is a tab onto nothing, so it has to be asked for.
 */
export const DEFAULT_TABS: Tab[] = TAB_KEYS.map((key) => ({
  key,
  label: "",
  visible: true,
}));

export const DEFAULT_SCREENS: ScreenSettings = {
  // Beauty Bar's own look: a dark roast banner, cream cards, caramel prices.
  collection: {
    columns: 2,
    showSort: true,
    sortDefault: "manual",
    showHero: true,
    heroKicker: "Summer 2026 · New arrivals",
    heroSubtitle: "",
    heroFrom: "#1c1410",
    heroTo: "#3d2619",
    heroAccent: "#d08159",
    showBrandChips: true,
    showFilters: true,
    showLayoutToggle: true,
    showBadge: true,
    showWishlist: true,
    showVendor: true,
    showRating: true,
    ratingText: "5",
    showQuickAdd: true,
    nameLines: 2,
    pageSize: 24,
    pageBg: "#f8f5f0",
    cardBg: "#f3ece4",
    priceColor: "#b0603e",
    inkColor: "#211a15",
    lineColor: "#eadfd2",
  },
  product: {
    showDescription: true,
    showVariants: true,
    showStock: true,
    addLabel: "",
    soldOutLabel: "",
    showThumbs: true,
    showBadge: true,
    showWishlist: true,
    showBreadcrumb: true,
    showRating: true,
    ratingValue: "4.9",
    reviewCount: "1,627",
    reviewsWord: "reviews",
    verifiedLabel: "Verified",
    showSave: true,
    saveLabel: "",
    showInstalments: true,
    instalmentsTitle: "",
    instalmentMonths: 6,
    instalmentProviders: "TRU · valU · Sympl",
    showQuantity: true,
    showBuyNow: true,
    buyNowLabel: "",
    showViewers: true,
    viewersMin: 18,
    viewersMax: 45,
    viewersText: "",
    lowStockAt: 5,
    lowStockText: "",
    showPerks: true,
    perk1: "Express delivery · Cairo & Giza tomorrow",
    perk2: "Free returns within 14 days",
    perk3: "100% authentic · box & dust bag",
    descriptionTitle: "",
    shippingTitle: "",
    shippingText: "Express delivery tomorrow in Cairo and Giza when you order before 6pm, 2–4 days everywhere else. Returns are free within 14 days — we collect from your door.",
    showReviewsCard: true,
    reviewsKicker: "Customer reviews",
    reviewsHeading: "What They're",
    reviewsItalic: "Saying",
    reviewsButton: "Read all reviews",
    showRelated: true,
    relatedKicker: "You may also like",
    relatedTitle: "Complete the look",
    pageBg: "#f8f5f0",
    accentColor: "#9d6540",
    inkColor: "#211a15",
    mutedColor: "#74685e",
    darkColor: "#211a15",
  },
  cart: {
    emptyText: "",
    showCoupon: true,
    couponLabel: "",
    checkoutLabel: "",
    totalLabel: "",
  },
  checkout: { title: "", note: "", placeLabel: "", askEmail: false, askNote: true },
  account: {
    signedOutText: "",
    showReturns: true,
    showRequests: true,
    showReviews: true,
    returnsLabel: "",
    requestsLabel: "",
    reviewsLabel: "",
  },
};

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
  // The published web theme's own colours, so a store that has never opened
  // this editor still gets an app that matches the site shoppers already know:
  // its terracotta on its cream, not a stock violet on near-white.
  accent: "#c1674a",
  background: "#f3ede5",
  announcement: "",
  announcementEnabled: false,
  menuHandle: "main-menu",
  showSearch: true,
  logoText: "BEAUTY",
  logoAccentText: "BAR",
  searchPlaceholder: "Sahel sandals",
  showWishlist: true,
  showBag: true,
  headerBg: "",
  headerInk: "",
  stripEnabled: false,
  strip: [],
  titleFont: "system",
  sectionGap: 12,
  itemGap: 8,
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
  hero: {
    ar: "الواجهة",
    en: "Hero",
    hintAr: "شرائح كبيرة أعلى الشاشة، كل شريحة صورة وعنوان ورابط",
    hintEn: "Big slides at the top of the screen — an image, a heading and a link each",
  },
  promo_bar: {
    ar: "شريط العرض",
    en: "Offer bar",
    hintAr: "عرض قصير مع كود خصم ينسخه العميل بضغطة",
    hintEn: "A short offer with a discount code the shopper taps to copy",
  },
  collection_tabs: {
    ar: "تبويبات المنتجات",
    en: "Product tabs",
    hintAr: "عدة أقسام في تبويبات، منتجات القسم المختار تظهر تحتها",
    hintEn: "Several collections as tabs, with the chosen one's products underneath",
  },
  cards: {
    ar: "بطاقات",
    en: "Image cards",
    hintAr: "بطاقات بصور وعناوين — للماركات أو الأجواء أو أي تجميعة",
    hintEn: "Cards with images and titles — for brands, moods, or any edit",
  },
  tiers: {
    ar: "فئات الأسعار",
    en: "Price tiers",
    hintAr: "تسوّق حسب الميزانية — كل بطاقة سعر وقسم",
    hintEn: "Shop by budget — each card a price and a collection",
  },
  split: {
    ar: "لوحتان",
    en: "Split panels",
    hintAr: "لوحتان جنباً إلى جنب، مثل «لها» و«له»",
    hintEn: "Two panels side by side, the way Her / Him works on the website",
  },
  trust_badges: {
    ar: "شارات الثقة",
    en: "Trust badges",
    hintAr: "الدفع عند الاستلام، الاستبدال، الشحن — بأيقونة وسطرين",
    hintEn: "Cash on delivery, returns, shipping — an icon and two lines each",
  },
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
  live_now: {
    ar: "البث المباشر",
    en: "Live now",
    hintAr: "صور دائرية لمن يبثّون الآن، وتحتها عرض خاص بالعميل مع عدّاد",
    hintEn: "Round photos of whoever is live now, with a private countdown offer underneath",
  },
  coming_up_live: {
    ar: "بث قادم",
    en: "Coming up live",
    hintAr: "مواعيد البث القادمة، لكل موعد صورة ووقت وزر تذكير",
    hintEn: "The sessions coming up — a picture, a time and a remind button each",
  },
  countdown_deals: {
    ar: "صفقات اليوم",
    en: "Deals of the day",
    hintAr: "عروض بعدّاد ينتهي، وشريط يوضح كم بيع من كل صفقة",
    hintEn: "Offers on a countdown, each showing how much of it has gone",
  },
  info_rows: {
    ar: "أسطر معلومات",
    en: "Info rows",
    hintAr: "الشحن، الاسترجاع، طرق الدفع — أيقونة وسطران ورقم على اليسار",
    hintEn: "Delivery, returns, ways to pay — an icon, two lines and a note on the end",
  },
  shipping_goal: {
    ar: "شريط الشحن المجاني",
    en: "Free delivery bar",
    hintAr: "كم تبقّى على الشحن المجاني، كشريط تقدّم",
    hintEn: "How far the basket is from free delivery, as a progress bar",
  },
  payment_plans: {
    ar: "طرق الدفع",
    en: "Pay your way",
    hintAr: "بطاقات التقسيط وعروض البنوك، كل بطاقة بلونها",
    hintEn: "Instalment and bank offers, each card in its own colour",
  },
  price_slider: {
    ar: "قسّطي أي سعر",
    en: "Split any price",
    hintAr: "شريط يحرّكه العميل ليرى القسط الشهري لكل جهة",
    hintEn: "A slider the shopper moves to see the monthly amount from each provider",
  },
  offer_cards: {
    ar: "عروض لك",
    en: "Offers for you",
    hintAr: "عروض يمكن للعميل المطالبة بها، كل عرض ببطاقة",
    hintEn: "Offers the shopper can claim, one card each",
  },
  product_reasons: {
    ar: "مقترح لك",
    en: "Because you viewed",
    hintAr: "منتجات مع سبب اقتراح كل واحد، وسعره وتقييمه وزر إضافة",
    hintEn: "Products with the reason each is being shown, its price, rating and an add button",
  },
  circle_row: {
    ar: "صف دائري",
    en: "Circle row",
    hintAr: "صور دائرية باسم وسطر تحته — «اشتري مرة أخرى» أو «تسوّقي حسب القسم»",
    hintEn: "Round pictures with a label and a line under it — Buy it again, or Shop by department",
  },
  pick_colour: {
    ar: "اختاري اللون",
    en: "Pick a colour",
    hintAr: "دوائر ألوان، كل لون يفتح قسمه",
    hintEn: "Colour circles, each opening its own collection",
  },
  price_drop: {
    ar: "تنبيه انخفاض السعر",
    en: "Price drop",
    hintAr: "بطاقة تقول إن قطعاً محفوظة نزل سعرها، بصور صغيرة وزر",
    hintEn: "A card saying saved pieces have dropped, with thumbnails and a button",
  },
  style_profile: {
    ar: "ملف ذوقك",
    en: "Style profile",
    hintAr: "وسوم تصف ذوق العميلة، كل وسم يفتح ما يناسبه",
    hintEn: "Tags describing the shopper's taste, each opening what matches it",
  },
  review_summary: {
    ar: "ملخص التقييمات",
    en: "Rating summary",
    hintAr: "متوسط التقييم بالنجوم وعدد المراجعات وأشرطة النِّسب وزر لكل المراجعات — مثل الموقع",
    hintEn: "The average score, stars, review count, a bar per star and a button to every review — as on the website",
  },
  brand_timeline: {
    ar: "تسوّقي حسب الماركة",
    en: "Shop by brand",
    hintAr: "دوائر شعارات الماركات فوق بطاقة صورة كبيرة تتبدّل تلقائياً — مثل الموقع",
    hintEn: "A row of brand logo circles over a big photo card that slides on its own — as on the website",
  },
  complete_look: {
    ar: "أكملي إطلالتك",
    en: "Complete your look",
    hintAr: "منتجات تناسب ما اشترته العميلة من قبل — تختفي للزوار ولمن لم تشترِ بعد",
    hintEn: "Pieces that go with what the shopper already bought — hidden for guests and first-time shoppers",
  },
  promo_card: {
    ar: "بطاقة عرض",
    en: "Promo card",
    hintAr: "بطاقة بلون واحد بعنوان ونص وزر — مثل «الصندوق الغامض»",
    hintEn: "A solid colour card with a heading, a line and a button — a Mystery box, say",
  },
  showcase: {
    ar: "صورة بعرض الشاشة",
    en: "Full-bleed image",
    hintAr: "صورة واحدة من حافة الشاشة إلى حافتها، بعنوان فوقها — لتكسر إيقاع الصفوف",
    hintEn: "One picture from edge to edge with a line over it — what breaks up a page of rows",
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

/**
 * Who is live, and who is coming up, read off the sections that already say so.
 *
 * The Live tab could have had its own list of streams, but then a merchant
 * would keep two of them and they would disagree by the second week. It reads
 * the Live now and Coming up live sections instead: one place to edit, and a
 * tab that empties honestly when those sections are removed.
 */
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

/**
 * The Live tab, from the shop's real lives.
 *
 * The tab used to draw whatever the two home blocks had typed into them,
 * which is how it went on listing people who were not broadcasting. Given
 * actual lives it lists those instead, on air first, then what is coming.
 */
export function liveSessionsFromLives(
  lives: {
    id: string;
    title: string;
    hostName: string | null;
    coverUrl: string | null;
    status: string;
    scheduledAt: string | null;
    peakViewers: number;
    href: string;
  }[],
): LiveSession[] {
  const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
  return lives
    .filter((l) => rank(l.status) < 2)
    .sort(
      (a, b) =>
        rank(a.status) - rank(b.status) ||
        String(a.scheduledAt ?? "").localeCompare(String(b.scheduledAt ?? "")),
    )
    .map((l) => ({
      id: l.id,
      name: l.hostName || l.title,
      detail:
        l.status === "live"
          ? l.peakViewers ? String(l.peakViewers) : ""
          : l.scheduledAt
            ? new Date(l.scheduledAt).toLocaleString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
      imageUrl: l.coverUrl ?? "",
      url: l.href,
      handle: "",
      productId: "",
      screen: "",
      live: l.status === "live",
    }));
}

export function liveSessionsOf(theme: AppTheme): LiveSession[] {
  const out: LiveSession[] = [];
  for (const block of theme.blocks ?? []) {
    if (block.type !== "live_now" && block.type !== "coming_up_live") continue;
    const live = block.type === "live_now";
    for (const item of itemsOf(block)) {
      const name = str(item.name) || str(item.title);
      const imageUrl = str(item.imageUrl);
      if (!name && !imageUrl) continue;
      out.push({
        id: str(item.id),
        name,
        detail: str(item.viewers) || str(item.when),
        imageUrl,
        url: str(item.url),
        handle: str(item.handle),
        productId: str(item.productId),
        screen: str(item.screen),
        live,
      });
    }
  }
  // On air first, then what is coming.
  return out.sort((a, b) => Number(b.live) - Number(a.live));
}

/** A block of this type, with settings that make sense on day one. */
export function newBlock(type: BlockType): Block {
  const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const shape = ITEM_SHAPE[type];
  const settings: Record<string, Record<string, unknown>> = {
    hero: { items: shape ? [shape.blank()] : [] },
    promo_bar: { lead: "", rest: "", code: "" },
    collection_tabs: {
      kicker: "",
      title: "",
      limit: 8,
      align: "left",
      stretchTabs: false,
      showLink: true,
      imageShape: "square",
      imageFit: "cover",
      fade: false,
      items: shape ? [shape.blank()] : [],
    },
    cards: { kicker: "", title: "", items: shape ? [shape.blank()] : [] },
    tiers: {
      title: "",
      // Empty is "the store's own paper and ink"; a merchant who wants a
      // different card can say so without touching the ones that are right.
      cardBg: "",
      lineColor: "",
      inkColor: "",
      mutedColor: "",
      items: shape ? [shape.blank()] : [],
    },
    split: { title: "", items: shape ? [shape.blank(), shape.blank()] : [] },
    trust_badges: { items: shape ? [shape.blank()] : [] },
    live_now: {
      title: "",
      liveLabel: "LIVE",
      showReplays: true,
      replaysLabel: "Replays",
      replaysHandle: "",
      offerEnabled: true,
      offerTitle: "{name}, your private offer is live",
      offerText: "",
      offerMinutes: 10,
      offerHandle: "",
      offerUrl: "",
      replaysUrl: "",
      // Shape and size. Colours are left empty on purpose: empty means "follow
      // the brand", so a store that changes its accent takes this with it
      // instead of stranding a hex someone typed once.
      avatarShape: "circle",
      avatarSize: 56,
      ringWidth: 2,
      ringColor: "",
      badgeBg: "",
      badgeTextColor: "#ffffff",
      nameSize: 10,
      viewersSize: 9,
      bannerRadius: 16,
      offerBg: "",
      offerTextColor: "#ffffff",
      offerTitleSize: 13,
      offerTextSize: 11,
      timerBg: "",
      timerTextColor: "#ffffff",
      items: shape ? [shape.blank()] : [],
    },
    coming_up_live: {
      title: "Coming up live",
      remindLabel: "Remind me",
      remindedLabel: "Reminder set",
      cardBg: "",
      radius: 16,
      items: shape ? [shape.blank()] : [],
    },
    countdown_deals: {
      featureFirst: false,
      title: "Deals of the day",
      endsInMinutes: 135,
      showTimer: true,
      showClaimed: true,
      badgeBg: "",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    info_rows: {
      title: "",
      cardBg: "",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    shipping_goal: {
      title: "Free delivery unlocked",
      subtitle: "",
      startLabel: "EGP 0",
      endLabel: "EGP 5,000",
      percent: 100,
      barColor: "",
      cardBg: "",
      radius: 14,
    },
    payment_plans: {
      title: "Pay your way",
      subtitle: "Instalments and bank offers",
      seeAllLabel: "All offers",
      seeAllHandle: "",
      seeAllUrl: "",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    price_slider: {
      title: "Split any price",
      subtitle: "Move the slider to see the monthly amount",
      priceLabel: "Piece price",
      currency: "EGP",
      minPrice: 2999,
      maxPrice: 16000,
      startPrice: 7750,
      cardBg: "",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    offer_cards: {
      title: "Offers for you",
      subtitle: "",
      claimLabel: "Claim",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    product_reasons: {
      featureFirst: false,
      title: "Because you viewed",
      subtitle: "",
      seeAllLabel: "See all",
      seeAllHandle: "",
      seeAllUrl: "",
      buttonLabel: "Add to bag",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    circle_row: {
      title: "Buy it again",
      subtitle: "",
      seeAllLabel: "",
      seeAllHandle: "",
      seeAllUrl: "",
      size: 64,
      showLabel: true,
      showNote: true,
      items: shape ? [shape.blank()] : [],
    },
    pick_colour: {
      title: "Pick your colour",
      subtitle: "",
      size: 44,
      items: shape ? [shape.blank()] : [],
    },
    price_drop: {
      title: "",
      subtitle: "",
      buttonLabel: "View",
      handle: "",
      url: "",
      cardBg: "",
      radius: 14,
      items: shape ? [shape.blank()] : [],
    },
    review_summary: {
      kicker: "",
      eyebrow: "Customer reviews",
      heading: "What They're",
      headingItalic: "Saying",
      average: "4.9",
      reviewCount: "1,627",
      reviewsWord: "reviews",
      trustNote: "Verified buyers",
      pct5: 88,
      pct4: 8,
      pct3: 3,
      pct2: 1,
      pct1: 0,
      buttonLabel: "Read all reviews",
      handle: "",
      url: "",
      productId: "",
      screen: "happy-customers",
      animate: true,
      avgSize: 58,
      radius: 18,
      bg: "",
      panelFrom: "",
      panelTo: "",
      starColor: "",
      barTrack: "",
      barFrom: "",
      barTo: "",
      brownColor: "",
      accentColor: "",
      inkColor: "",
      mutedColor: "",
    },
    brand_timeline: {
      eyebrow: "Shop by brand",
      heading: "",
      intro: "",
      linkLabel: "Shop Now",
      autoplay: 3,
      cardHeight: 150,
      radius: 20,
      overlay: 72,
      bg: "",
      accentColor: "",
      brownColor: "",
      inkColor: "",
      lineColor: "",
      items: shape ? [shape.blank()] : [],
    },
    complete_look: {
      title: "Complete your look",
      subtitle: "To go with your {product}",
      fallbackTitle: "Recommended for you",
      fallbackSubtitle: "Picked from what you shop",
      limit: 8,
      items: shape ? [shape.blank()] : [],
    },
    style_profile: {
      title: "Your style profile",
      subtitle: "Tap to change what we show you",
      cardTitle: "{name}'s profile",
      cardSubtitle: "Built from what you save and buy",
      footNote: "",
      cardBg: "",
      radius: 14,
      /**
       * "society" is the card in the loyalty club's own colours - deep roast
       * and gold, the way a member's status card looks. "plain" is the white
       * card it used to be, for a store with no club.
       */
      style: "society",
      kicker: "Your society",
      glyph: "✦",
      deepFrom: "",
      deepTo: "",
      gold: "",
      onDeep: "",
      onDeepSoft: "",
      // Where the card itself goes - the Society screen, usually.
      handle: "",
      screen: "",
      url: "",
      items: shape ? [shape.blank()] : [],
    },
    showcase: {
      imageUrl: "",
      heading: "",
      subheading: "",
      buttonLabel: "",
      handle: "",
      url: "",
      height: 360,
      overlay: 45,
      textColor: "#ffffff",
      align: "bottom",
    },
    promo_card: {
      /** "card" is the plain colour card; "banner" is the mystery box banner. */
      style: "card",
      kicker: "",
      title: "",
      body: "",
      price: "",
      worth: "",
      stockNote: "",
      buttonLabel: "",
      handle: "",
      url: "",
      imageUrl: "",
      bg: "",
      bg2: "",
      glow: "",
      textColor: "#ffffff",
      radius: 16,
      height: 0,
    },
    banner: { imageUrl: "", handle: "", heading: "", subheading: "" },
    collection_row: { handle: "", title: "", limit: 8 },
    collection_grid: { handle: "", title: "", limit: 6 },
    new_arrivals: { title: "New arrivals", limit: 12 },
    categories: { title: "" },
    reviews: {
      title: "What customers say",
      subtitle: "",
      ratingLabel: "",
      seeAllLabel: "",
      seeAllHandle: "",
      seeAllUrl: "",
      limit: 6,
    },
    text: { heading: "", body: "" },
  };
  return { id, type, settings: settings[type] ?? {} };
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

/** A whole number of pixels inside the range a phone can actually use. */
function size(v: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** A hex colour, or the given default. Anything else would reach the app as CSS. */
function colour(v: unknown, fallback: string = DEFAULT_SETTINGS.accent): string {
  const s = String(v ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
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
  const row = (raw ?? {}) as {
    settings?: unknown;
    blocks?: unknown;
    tabs?: unknown;
    screens?: unknown;
  };
  const s = (row.settings ?? {}) as Record<string, unknown>;

  const settings: AppSettings = {
    storeName: str(s.storeName, DEFAULT_SETTINGS.storeName).slice(0, 60),
    logoUrl: str(s.logoUrl) || null,
    accent: colour(s.accent),
    background: colour(s.background, DEFAULT_SETTINGS.background),
    announcement: str(s.announcement).slice(0, 200),
    announcementEnabled: Boolean(s.announcementEnabled),
    menuHandle: str(s.menuHandle, DEFAULT_SETTINGS.menuHandle).slice(0, 60),
    showSearch: s.showSearch !== false,
    logoText: str(s.logoText, DEFAULT_SETTINGS.logoText).slice(0, 24),
    logoAccentText: str(s.logoAccentText, DEFAULT_SETTINGS.logoAccentText).slice(0, 24),
    searchPlaceholder: str(s.searchPlaceholder, DEFAULT_SETTINGS.searchPlaceholder).slice(0, 60),
    showWishlist: s.showWishlist !== false,
    showBag: s.showBag !== false,
    headerBg: /^#[0-9a-f]{6}$/i.test(str(s.headerBg)) ? str(s.headerBg) : "",
    headerInk: /^#[0-9a-f]{6}$/i.test(str(s.headerInk)) ? str(s.headerInk) : "",
    titleFont: str(s.titleFont) === "serif" ? "serif" : "system",
    sectionGap: size(s.sectionGap, 12, 0, 40),
    itemGap: size(s.itemGap, 8, 0, 24),
    stripEnabled: Boolean(s.stripEnabled),
    strip: Array.isArray(s.strip)
      ? (s.strip as unknown[])
          .map((raw, i) => {
            const item = (raw ?? {}) as Record<string, unknown>;
            return {
              id: str(item.id) || `s-${i}`,
              label: str(item.label).slice(0, 40),
              handle: str(item.handle).slice(0, 60),
              url: str(item.url).slice(0, 300),
              productId: str(item.productId).slice(0, 60),
              screen: str(item.screen).slice(0, 40),
            };
          })
          // A shortcut with no wording is a gap in the row, not a shortcut.
          .filter((item) => item.label)
          .slice(0, 12)
      : [],
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

  // Tabs: the merchant's order and wording, but only over keys the app can
  // actually draw, and never an empty bar.
  const rawTabs = Array.isArray(row.tabs) ? (row.tabs as unknown[]) : [];
  const seen = new Set<TabKey>();
  const tabs: Tab[] = [];
  for (const t of rawTabs) {
    const tab = (t ?? {}) as Record<string, unknown>;
    const key = str(tab.key) as TabKey;
    if (!TAB_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    tabs.push({ key, label: str(tab.label, "").slice(0, 24), visible: tab.visible !== false });
  }
  for (const key of TAB_KEYS) {
    if (!seen.has(key)) tabs.push({ key, label: "", visible: key !== "live" });
  }
  if (!tabs.some((t) => t.visible)) tabs[0].visible = true;

  const rawScreens = (row.screens ?? {}) as Record<string, Record<string, unknown>>;
  const pick = <K extends ScreenKey>(key: K): ScreenSettings[K] => {
    const base = DEFAULT_SCREENS[key] as Record<string, unknown>;
    const given = (rawScreens[key] ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(base)) {
      const g = given[k];
      if (typeof v === "boolean") out[k] = typeof g === "boolean" ? g : v;
      else if (typeof v === "number") out[k] = g !== "" && g != null && Number.isFinite(Number(g)) && Number(g) >= 0 ? Number(g) : v;
      else out[k] = str(g, v as string).slice(0, 200);
    }
    return out as ScreenSettings[K];
  };

  const screens: ScreenSettings = {
    collection: { ...pick("collection"), columns: Number(rawScreens.collection?.columns) === 3 ? 3 : 2 },
    product: pick("product"),
    cart: pick("cart"),
    checkout: pick("checkout"),
    account: pick("account"),
  };

  return { settings, blocks, tabs, screens };
}
