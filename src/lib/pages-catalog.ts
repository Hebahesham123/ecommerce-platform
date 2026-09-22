/**
 * Every page a shopper can land on, in one list.
 *
 * The store is four things wearing one brand — a Liquid theme at /shop, the
 * React pages embedded inside it, the widgets, and the app — and until now
 * there was nowhere to see that. A merchant asking "what does our login look
 * like?" had to know which of the four owned it and what its URL was.
 *
 * So: one catalogue. Each entry says where the page is, where a shopper meets
 * it, and where its look is changed. What is not editable yet says so rather
 * than pretending, because a dead Edit button is worse than an honest gap.
 */

export type Bi = { ar: string; en: string };

/** Which store the page belongs to. */
export type Surface = "web" | "app";

/**
 * How a page's look is changed.
 *
 * `theme` is the Liquid theme's own templates, edited in the theme editor.
 * `app-theme` is the app's data-driven screens. `copy` is this catalogue's own
 * wording and toggles, edited on the page's own screen here. `none` is honest:
 * the page is built in code and nothing about it is editable yet.
 */
export type EditKind = "theme" | "app-theme" | "copy" | "none";

export type PageEntry = {
  id: string;
  surface: Surface;
  group: Bi;
  title: Bi;
  what: Bi;
  /**
   * What to load in the frame. `{collection}`, `{product}` and `{order}` are
   * filled in with something real from this store before the frame is built.
   */
  preview: string;
  /** Where a shopper meets it, when that is not the preview URL. */
  live?: string;
  how: EditKind;
  /** The editor that owns it. `{theme}` becomes the published theme's id. */
  editHref?: string;
  /** Why it cannot be edited yet, for the ones that cannot. */
  note?: Bi;
};

const G = {
  shopping: { ar: "التسوّق", en: "Shopping" },
  account: { ar: "الحساب", en: "Account" },
  checkout: { ar: "الدفع", en: "Checkout" },
  service: { ar: "خدمة العملاء", en: "Service" },
} satisfies Record<string, Bi>;

const THEME_EDIT = "/online-store/themes/{theme}/customize";
const APP_EDIT = "/app/theme";

export const PAGES: PageEntry[] = [
  // ----------------------------------------------------------------- web ---
  {
    id: "web-home",
    surface: "web",
    group: G.shopping,
    title: { ar: "الصفحة الرئيسية", en: "Home" },
    what: { ar: "أول ما يراه الزائر", en: "The first thing a visitor sees" },
    preview: "/shop",
    how: "theme",
    editHref: THEME_EDIT,
  },
  {
    id: "web-collection",
    surface: "web",
    group: G.shopping,
    title: { ar: "صفحة المجموعة", en: "Collection" },
    what: { ar: "قائمة المنتجات داخل قسم", en: "The products inside one section" },
    preview: "/shop/collections/{collection}",
    how: "theme",
    editHref: THEME_EDIT,
  },
  {
    id: "web-product",
    surface: "web",
    group: G.shopping,
    title: { ar: "صفحة المنتج", en: "Product" },
    what: { ar: "الصور والسعر وزر الإضافة", en: "Photos, price and the add button" },
    preview: "/shop/products/{product}",
    how: "theme",
    editHref: THEME_EDIT,
  },
  {
    id: "web-search",
    surface: "web",
    group: G.shopping,
    title: { ar: "نتائج البحث", en: "Search results" },
    what: { ar: "ما تجده العميلة حين تبحث", en: "What a search turns up" },
    preview: "/shop/search?q=bag",
    how: "theme",
    editHref: THEME_EDIT,
  },
  {
    id: "web-cart",
    surface: "web",
    group: G.checkout,
    title: { ar: "السلة", en: "Cart" },
    what: { ar: "ما اختارته قبل الدفع", en: "What she picked, before paying" },
    preview: "/shop/cart",
    how: "theme",
    editHref: THEME_EDIT,
  },
  {
    id: "web-checkout",
    surface: "web",
    group: G.checkout,
    title: { ar: "الدفع", en: "Checkout & payment" },
    what: { ar: "العنوان وطريقة الدفع وإتمام الطلب", en: "Address, payment method, placing the order" },
    preview: "/store/checkout",
    live: "/shop/checkout",
    how: "copy",
  },
  {
    id: "web-login",
    surface: "web",
    group: G.account,
    title: { ar: "تسجيل الدخول", en: "Login" },
    what: { ar: "الدخول برقم الهاتف", en: "Signing in with a phone number" },
    preview: "/store/login",
    how: "copy",
  },
  {
    id: "web-signup",
    surface: "web",
    group: G.account,
    title: { ar: "إنشاء حساب", en: "Sign up" },
    what: { ar: "حساب جديد لعميلة جديدة", en: "A new account for a new shopper" },
    preview: "/store/signup",
    how: "copy",
  },
  {
    id: "web-account",
    surface: "web",
    group: G.account,
    title: { ar: "حساب العميلة", en: "Customer account" },
    what: { ar: "الطلبات والعناوين والنقاط", en: "Orders, addresses and points" },
    preview: "/store/account",
    live: "/shop/account",
    how: "copy",
    note: {
      ar: "المعاينة تعرض صفحة الدخول ما لم تكوني داخلة بحساب عميلة في هذا المتصفّح — الحساب نفسه خلف تسجيل الدخول.",
      en: "The preview shows the login page unless you are signed in as a shopper in this browser: the account itself sits behind a sign-in.",
    },
  },
  {
    id: "web-order",
    surface: "web",
    group: G.account,
    title: { ar: "حالة الطلب", en: "Order status" },
    what: { ar: "أين وصل طلبها", en: "Where her order has got to" },
    preview: "/store/order/{order}",
    how: "none",
    note: {
      ar: "تُبنى من بيانات الطلب نفسه.",
      en: "Built from the order's own data — nothing to set here yet.",
    },
  },
  {
    id: "web-requests",
    surface: "web",
    group: G.service,
    title: { ar: "الطلبات والمرتجعات", en: "Returns & requests" },
    what: { ar: "طلب إرجاع أو استبدال", en: "Asking to return or exchange" },
    preview: "/store/requests",
    live: "/shop/requests",
    how: "none",
    note: {
      ar: "النموذج يتبع سياسة الإرجاع في الإعدادات.",
      en: "The form follows the return policy in Settings.",
    },
  },
  {
    id: "web-happy",
    surface: "web",
    group: G.service,
    title: { ar: "عملاء سعداء", en: "Happy customers" },
    what: { ar: "التقييمات المميّزة", en: "The reviews you featured" },
    preview: "/store/happy-customers",
    live: "/shop/happy-customers",
    how: "none",
    note: {
      ar: "محتواها من التقييمات المميّزة في صفحة التقييمات.",
      en: "Its content is whatever you feature under Reviews.",
    },
  },
  {
    id: "web-reviews",
    surface: "web",
    group: G.service,
    title: { ar: "اكتبي تقييمًا", en: "Write a review" },
    what: { ar: "النموذج الذي تملؤه العميلة", en: "The form a shopper fills in" },
    preview: "/widgets/reviews.html",
    live: "/shop/reviews",
    how: "none",
    note: {
      ar: "ويدجت ثابتة في public/widgets.",
      en: "A static widget under public/widgets.",
    },
  },
  {
    id: "web-society",
    surface: "web",
    group: G.account,
    title: { ar: "النادي", en: "The society" },
    what: { ar: "الولاء والمستويات", en: "Loyalty tiers and rewards" },
    preview: "/store/society",
    how: "app-theme",
    editHref: "/loyalty/theme",
  },

  // ----------------------------------------------------------------- app ---
  {
    id: "app-home",
    surface: "app",
    group: G.shopping,
    title: { ar: "الشاشة الرئيسية", en: "Home screen" },
    what: { ar: "الأقسام التي ترتّبينها بنفسك", en: "The sections you arrange yourself" },
    preview: "/app-preview?bare=1&screen=home",
    how: "app-theme",
    editHref: APP_EDIT,
  },
  {
    id: "app-menu",
    surface: "app",
    group: G.shopping,
    title: { ar: "القائمة", en: "Menu" },
    what: { ar: "الأقسام خلف زر القائمة", en: "The sections behind the menu button" },
    preview: "/app-preview?bare=1&screen=menu",
    how: "app-theme",
    editHref: "/navigation",
  },
  {
    id: "app-collection",
    surface: "app",
    group: G.shopping,
    title: { ar: "شاشة المجموعة", en: "Collection screen" },
    what: { ar: "الفلاتر وشكل البطاقات", en: "Filters and the shape of the cards" },
    preview: "/app-preview?bare=1&collection={collection}",
    how: "app-theme",
    editHref: APP_EDIT,
  },
  {
    id: "app-product",
    surface: "app",
    group: G.shopping,
    title: { ar: "شاشة المنتج", en: "Product screen" },
    what: { ar: "المعرض والتقسيط والمقاسات", en: "The gallery, instalments and sizes" },
    preview: "/app-preview?bare=1&product={productId}",
    how: "app-theme",
    editHref: APP_EDIT,
  },
  {
    id: "app-search",
    surface: "app",
    group: G.shopping,
    title: { ar: "البحث", en: "Search" },
    what: { ar: "نتائج البحث داخل التطبيق", en: "What a search turns up in the app" },
    preview: "/app-preview?bare=1&screen=search:bag",
    how: "none",
    note: {
      ar: "النتائج تأتي من الكتالوج مباشرة.",
      en: "The results come straight from the catalogue.",
    },
  },
  {
    id: "app-cart",
    surface: "app",
    group: G.checkout,
    title: { ar: "السلة", en: "Bag" },
    what: { ar: "ما اختارته داخل التطبيق", en: "What she picked in the app" },
    preview: "/app-preview?bare=1&screen=cart",
    how: "none",
    note: {
      ar: "شاشة مكتوبة بالكود — لا إعدادات لها بعد.",
      en: "Built in code — no settings for it yet.",
    },
  },
  {
    id: "app-orders",
    surface: "app",
    group: G.account,
    title: { ar: "طلباتي", en: "Orders" },
    what: { ar: "طلبات العميلة داخل التطبيق", en: "Her orders, inside the app" },
    preview: "/app-preview?bare=1&screen=orders",
    how: "none",
    note: {
      ar: "شاشة مكتوبة بالكود — لا إعدادات لها بعد.",
      en: "Built in code — no settings for it yet.",
    },
  },
  {
    id: "app-account",
    surface: "app",
    group: G.account,
    title: { ar: "الحساب", en: "Account" },
    what: { ar: "الدخول والبيانات والنقاط", en: "Signing in, details and points" },
    preview: "/app-preview?bare=1&screen=account",
    how: "none",
    note: {
      ar: "شاشة مكتوبة بالكود — لا إعدادات لها بعد.",
      en: "Built in code — no settings for it yet.",
    },
  },
  {
    id: "app-live",
    surface: "app",
    group: G.service,
    title: { ar: "البث المباشر", en: "Live" },
    what: { ar: "البث والتسجيلات", en: "Sessions and replays" },
    preview: "/app-preview?bare=1&screen=live",
    how: "app-theme",
    editHref: "/lives",
  },
];

export const pageById = (id: string): PageEntry | undefined => PAGES.find((p) => p.id === id);

/** What the previews need filled in before they point anywhere real. */
export type Samples = {
  collection: string;
  /** The website addresses a product by handle, the app by id. */
  product: string;
  productId: string;
  order: string;
  theme: string;
};

/** The flag that says "this is a preview": nothing here counts as a visit. */
export const PREVIEW_FLAG = "bbpreview=1";

/** A filled preview URL, marked so analytics leaves it alone. */
export function previewUrl(path: string, s: Samples): string {
  const url = fill(path, s);
  return url + (url.includes("?") ? "&" : "?") + PREVIEW_FLAG;
}

/** `/shop/products/{product}` → `/shop/products/kate-bag`. */
export function fill(path: string, s: Samples): string {
  return path
    .replace("{collection}", encodeURIComponent(s.collection))
    .replace("{productId}", encodeURIComponent(s.productId))
    .replace("{product}", encodeURIComponent(s.product))
    .replace("{order}", encodeURIComponent(s.order))
    .replace("{theme}", encodeURIComponent(s.theme));
}

/** True when the entry still needs something this store does not have. */
export function unresolved(path: string, s: Samples): boolean {
  return (
    (path.includes("{collection}") && !s.collection) ||
    (path.includes("{productId}") && !s.productId) ||
    (path.includes("{product}") && !s.product) ||
    (path.includes("{order}") && !s.order) ||
    (path.includes("{theme}") && !s.theme)
  );
}

export const howLabel: Record<EditKind, Bi> = {
  theme: { ar: "قالب الويب", en: "Web theme" },
  "app-theme": { ar: "محرّر التطبيق", en: "App editor" },
  copy: { ar: "النصوص هنا", en: "Wording here" },
  none: { ar: "غير قابلة للتعديل بعد", en: "Not editable yet" },
};
