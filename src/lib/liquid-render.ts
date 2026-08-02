/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { Liquid } from "liquidjs";
import type { Catalog, CollectionDrop, ProductDrop } from "@/lib/storefront-data";

export type FileMap = Record<string, string>;

export type RouteType =
  | "index"
  | "collection"
  | "list-collections"
  | "product"
  | "search"
  | "cart"
  | "page"
  | "404";

export type RenderRoute = {
  type: RouteType;
  /** Path inside the storefront, without the mount prefix. e.g. "/collections/all" */
  path: string;
  query: Record<string, string>;
  page: number;
  product?: ProductDrop | null;
  variant?: Record<string, unknown> | null;
  collection?: CollectionDrop | null;
  searchTerms?: string;
  searchResults?: ProductDrop[];
  cart?: Record<string, unknown>;
};

export type RenderInput = {
  /** Theme sources, keyed relative to the theme root ("layout/theme.liquid"). */
  files: FileMap;
  /** Public URL of the theme root, with a trailing slash. */
  assetBase: string;
  /** URL prefix the storefront is mounted at, e.g. "/shop" (no trailing slash). */
  mount: string;
  catalog: Catalog;
  route: RenderRoute;
  /** CSS files force-linked into <head> — many themes load CSS ways we can't emit. */
  cssAssets?: string[];
  shopName?: string;
};

// ---- Small helpers ----------------------------------------------------------
function slugify(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tryJSON<T = any>(txt: string | undefined): T | null {
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function extractSchema(src: string): {
  settings: Record<string, unknown>;
  blockDefaults: Record<string, Record<string, unknown>>;
  presetBlocks: { type: string; settings: Record<string, unknown> }[];
} {
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  const out = {
    settings: {} as Record<string, unknown>,
    blockDefaults: {} as Record<string, Record<string, unknown>>,
    presetBlocks: [] as { type: string; settings: Record<string, unknown> }[],
  };
  if (!m) return out;
  const schema = tryJSON<any>(m[1]);
  if (!schema) return out;
  for (const s of schema.settings ?? []) if (s?.id) out.settings[s.id] = s.default ?? "";
  for (const b of schema.blocks ?? []) {
    if (!b?.type) continue;
    const d: Record<string, unknown> = {};
    for (const s of b.settings ?? []) if (s?.id) d[s.id] = s.default ?? "";
    out.blockDefaults[b.type] = d;
  }
  // A section dropped on the page with no saved blocks still shows its preset.
  const preset = Array.isArray(schema.presets) ? schema.presets[0] : null;
  for (const b of preset?.blocks ?? []) {
    if (!b?.type) continue;
    out.presetBlocks.push({
      type: b.type,
      settings: { ...(out.blockDefaults[b.type] ?? {}), ...(b.settings ?? {}) },
    });
  }
  return out;
}

// ---- URL rewriting ----------------------------------------------------------
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i;
const THEME_ASSET_RE = /^\/(assets|cdn|files|media|fonts|images|img|css|js|static)\//i;
const STOREFRONT_RE =
  /^\/(collections|products|cart|search|checkout|account|pages|blogs|policies|apps|recommendations)(?:[/?#]|$)/i;

/**
 * Make a theme-emitted URL work under our mount:
 *  - relative paths + /assets/… resolve against the theme's storage root
 *  - storefront paths (/collections/…, /cart, …) get the mount prefix
 */
function makeUrlResolver(assetBase: string, mount: string) {
  return (raw: string): string => {
    const u = raw.trim();
    if (!u || EXTERNAL_RE.test(u)) return raw;
    if (u.startsWith("/")) {
      if (THEME_ASSET_RE.test(u)) return assetBase + u.slice(1);
      if (mount && u.startsWith(`${mount}/`)) return raw;
      if (u === "/") return mount ? `${mount}/` : raw;
      if (mount && STOREFRONT_RE.test(u)) return mount + u;
      return raw;
    }
    return assetBase + u.replace(/^\.\//, "");
  };
}

const URL_ATTR_RE =
  /\b(href|src|action|poster|data-src|data-href|data-image|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const SRCSET_ATTR_RE =
  /\b(srcset|data-srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_URL_RE = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;

function rewriteUrls(html: string, assetBase: string, mount: string): string {
  const fix = makeUrlResolver(assetBase, mount);
  let out = html.replace(URL_ATTR_RE, (m, attr, dq, sq) => {
    const val = dq !== undefined ? dq : sq;
    const next = fix(val);
    return next === val ? m : `${attr}="${next.replace(/"/g, "&quot;")}"`;
  });
  out = out.replace(SRCSET_ATTR_RE, (m, attr, dq, sq) => {
    const val: string = dq !== undefined ? dq : sq;
    const next = val
      .split(",")
      .map((part) => {
        const t = part.trim();
        if (!t) return t;
        const [url, ...rest] = t.split(/\s+/);
        return [fix(url), ...rest].join(" ");
      })
      .join(", ");
    return next === val ? m : `${attr}="${next.replace(/"/g, "&quot;")}"`;
  });
  out = out.replace(CSS_URL_RE, (m, q, val) => {
    const next = fix(val);
    return next === val ? m : `url(${q}${next}${q})`;
  });
  return out;
}

// ---- Client bridge ----------------------------------------------------------
/** Keeps theme JS (fetch/XHR/dynamic forms) pointed at the mounted storefront. */
function bridgeScript(mount: string, currency: string): string {
  const m = JSON.stringify(mount);
  return `<script>(function(){var M=${m};
function fix(u){try{if(typeof u!=="string"||!u)return u;
if(/^(?:[a-z][a-z0-9+.-]*:|\\/\\/)/i.test(u))return u;
if(u.charAt(0)!=="/")return u;
if(M&&u.indexOf(M+"/")===0)return u;
if(/^\\/(cart|products|collections|search|checkout|recommendations|account|pages|blogs|policies)(?:[\\/?#.]|$)/i.test(u))return M+u;
return u;}catch(e){return u;}}
window.Shopify=window.Shopify||{};window.Shopify.shop="";window.Shopify.locale="en";
window.Shopify.currency={active:${JSON.stringify(currency)},rate:"1.0"};
window.Shopify.routes=window.Shopify.routes||{root:M+"/"};window.Shopify.designMode=false;
window.Shopify.formatMoney=window.Shopify.formatMoney||function(c){return (Number(c)/100).toFixed(2);};
var of_=window.fetch;if(of_)window.fetch=function(i,o){try{if(typeof i==="string")i=fix(i);
else if(i&&typeof i.url==="string")i=new Request(fix(i.url),i);}catch(e){}return of_.call(this,i,o);};
var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){
try{arguments[1]=fix(arguments[1]);}catch(e){}return oo.apply(this,arguments);};
document.addEventListener("submit",function(e){var f=e.target;if(f&&f.tagName==="FORM"){
var a=f.getAttribute("action");var n=fix(a);if(a&&n!==a)f.setAttribute("action",n);}},true);
})();</script>`;
}

// ---- Built-in fallbacks (used only when the theme has no such template) -----
const FALLBACK_CSS = `<style>
.sf-fb{font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:1200px;margin:0 auto;padding:24px}
.sf-fb a{color:inherit;text-decoration:none}
.sf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}
.sf-card{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
.sf-card img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#f1f5f9}
.sf-card .b{padding:10px 12px}
.sf-t{font-size:14px;margin:0 0 4px}
.sf-p{font-weight:700}
.sf-mut{color:#64748b;font-size:13px}
.sf-btn{display:inline-block;background:#0f172a;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:14px;cursor:pointer}
.sf-row{display:flex;gap:24px;flex-wrap:wrap}
.sf-row>*{flex:1 1 320px}
table.sf-tb{width:100%;border-collapse:collapse}table.sf-tb td,table.sf-tb th{border-bottom:1px solid #e2e8f0;padding:10px;text-align:start}
</style>`;

function fbCard(p: ProductDrop, money: (v: unknown) => string): string {
  const img = p.featured_image ? String(p.featured_image) : "";
  return `<a class="sf-card" href="${escapeHtml(p.url)}">
    ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy">` : `<div style="aspect-ratio:1;background:#f1f5f9"></div>`}
    <div class="b"><h3 class="sf-t">${escapeHtml(p.title)}</h3>
    <div class="sf-p">${escapeHtml(money(p.price_min))}</div>
    ${p.available ? "" : `<div class="sf-mut">Sold out</div>`}</div></a>`;
}

function fallbackTemplate(
  route: RenderRoute,
  catalog: Catalog,
  mount: string,
  money: (v: unknown) => string,
): string {
  const wrap = (inner: string) => `${FALLBACK_CSS}<div class="sf-fb">${inner}</div>`;

  if (route.type === "product" && route.product) {
    const p = route.product;
    const img = p.featured_image ? String(p.featured_image) : "";
    const opts = p.variants
      .map(
        (v) =>
          `<option value="${escapeHtml(v.id)}"${v.available ? "" : " disabled"}>${escapeHtml(v.title)} — ${escapeHtml(money(v.price))}${v.available ? "" : " (sold out)"}</option>`,
      )
      .join("");
    return wrap(`<div class="sf-row">
      <div>${img ? `<img src="${escapeHtml(img)}" alt="" style="width:100%;border-radius:14px">` : ""}</div>
      <div><h1>${escapeHtml(p.title)}</h1>
      <p class="sf-p" style="font-size:22px">${escapeHtml(money(p.price_min))}</p>
      <div class="sf-mut">${escapeHtml(p.description)}</div>
      <form method="post" action="${mount}/cart/add" style="margin-top:16px">
        <select name="id" style="padding:10px;border-radius:10px;border:1px solid #cbd5e1">${opts}</select>
        <input type="hidden" name="quantity" value="1">
        <button class="sf-btn" type="submit"${p.available ? "" : " disabled"}>${p.available ? "Add to cart" : "Sold out"}</button>
      </form></div></div>`);
  }

  if (route.type === "collection" && route.collection) {
    const c = route.collection;
    return wrap(`<h1>${escapeHtml(c.title)}</h1><p class="sf-mut">${c.products_count} products</p>
      <div class="sf-grid">${c.products.map((p) => fbCard(p, money)).join("")}</div>`);
  }

  if (route.type === "list-collections") {
    return wrap(`<h1>Collections</h1><div class="sf-grid">${catalog.collections
      .map(
        (c) =>
          `<a class="sf-card" href="${escapeHtml(c.url)}"><div class="b"><h3 class="sf-t">${escapeHtml(c.title)}</h3><div class="sf-mut">${c.products_count} products</div></div></a>`,
      )
      .join("")}</div>`);
  }

  if (route.type === "search") {
    const res = route.searchResults ?? [];
    return wrap(`<h1>Search</h1>
      <form action="${mount}/search" method="get"><input name="q" value="${escapeHtml(route.searchTerms ?? "")}" style="padding:10px;border-radius:10px;border:1px solid #cbd5e1"><button class="sf-btn">Search</button></form>
      <p class="sf-mut">${res.length} results</p>
      <div class="sf-grid">${res.map((p) => fbCard(p, money)).join("")}</div>`);
  }

  if (route.type === "cart") {
    const cart = (route.cart ?? {}) as any;
    const items = (cart.items ?? []) as any[];
    if (!items.length)
      return wrap(`<h1>Your cart</h1><p class="sf-mut">Your cart is empty.</p><a class="sf-btn" href="${mount}/collections/all">Continue shopping</a>`);
    return wrap(`<h1>Your cart</h1>
      <form method="post" action="${mount}/cart"><table class="sf-tb"><tbody>
      ${items
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.title)}</td><td>${escapeHtml(money(i.price))}</td>
             <td><input name="updates[]" type="number" min="0" value="${i.quantity}" style="width:64px;padding:6px"></td>
             <td>${escapeHtml(money(i.line_price))}</td></tr>`,
        )
        .join("")}
      </tbody></table>
      <p class="sf-p">Subtotal: ${escapeHtml(money(cart.total_price))}</p>
      <button class="sf-btn" name="update" value="1" type="submit">Update</button>
      <button class="sf-btn" name="checkout" value="1" type="submit">Checkout</button>
      </form>`);
  }

  if (route.type === "404") {
    return wrap(`<h1>Page not found</h1><p class="sf-mut">The page <code>${escapeHtml(route.path)}</code> does not exist in this theme.</p>
      <a class="sf-btn" href="${mount}/collections/all">Shop all products</a>`);
  }

  // index
  const featured = catalog.products.slice(0, 12);
  return wrap(`<h1>${escapeHtml(catalog.shop.name)}</h1>
    <p class="sf-mut">${catalog.products.length} products · ${catalog.collections.length} collections</p>
    <div class="sf-grid">${featured.map((p) => fbCard(p, money)).join("")}</div>`);
}

// ---- Main renderer ----------------------------------------------------------
export async function renderThemePage(input: RenderInput): Promise<string> {
  const { files, catalog, route, cssAssets = [] } = input;
  const mount = input.mount.replace(/\/$/, "");
  const assetBase = input.assetBase.endsWith("/") ? input.assetBase : `${input.assetBase}/`;
  const currency = catalog.shop.currency || "EGP";
  const shopName = input.shopName || catalog.shop.name || "Store";

  const asset = (name: unknown) =>
    `${assetBase}assets/${String(name ?? "").replace(/^\//, "")}`;

  // ---- Theme settings -------------------------------------------------------
  const schema = tryJSON<any[]>(files["config/settings_schema.json"]);
  const schemaDefaults: Record<string, unknown> = {};
  if (Array.isArray(schema))
    for (const panel of schema)
      for (const s of panel?.settings ?? []) if (s?.id) schemaDefaults[s.id] = s.default ?? "";

  const settingsData = tryJSON<any>(files["config/settings_data.json"]);
  let currentSettings: any = settingsData?.current;
  if (typeof currentSettings === "string")
    currentSettings = settingsData?.presets?.[currentSettings] ?? {};
  const settings = { ...schemaDefaults, ...(currentSettings ?? {}) };

  // ---- Locales --------------------------------------------------------------
  const localeKey =
    Object.keys(files).find((k) => /^locales\/[\w-]+\.default\.json$/.test(k)) ??
    Object.keys(files).find((k) => /^locales\/en\.json$/.test(k)) ??
    Object.keys(files).find((k) => /^locales\/[\w-]+\.json$/.test(k) && !k.includes("schema"));
  const locale = tryJSON<any>(localeKey ? files[localeKey] : undefined) ?? {};
  const translate = (key: unknown, ...args: any[]): string => {
    const parts = String(key ?? "").split(".");
    let cur: any = locale;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return String(key ?? "");
    }
    let out = typeof cur === "string" ? cur : String(key ?? "");
    // liquidjs hands named filter arguments over as [key, value] pairs.
    const named: Record<string, unknown> = {};
    for (const a of args) {
      if (Array.isArray(a) && a.length === 2 && typeof a[0] === "string") named[a[0]] = a[1];
      else if (a && typeof a === "object" && !Array.isArray(a)) Object.assign(named, a);
    }
    // Shopify pluralises with a `count` argument (key.one / key.other).
    if ("count" in named && cur && typeof cur === "object") {
      const n = Number(named.count);
      const form = n === 0 ? "zero" : n === 1 ? "one" : "other";
      out = String((cur as any)[form] ?? (cur as any).other ?? String(key ?? ""));
    }
    return out.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) =>
      k in named ? String(named[k]) : m,
    );
  };

  // ---- Money ----------------------------------------------------------------
  const amount = (v: unknown): string => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return (n / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const money = (v: unknown) => `${currency} ${amount(v)}`;

  // ---- Routes ---------------------------------------------------------------
  const routes = {
    root_url: `${mount}/`,
    account_url: `${mount}/account`,
    account_login_url: `${mount}/account/login`,
    account_logout_url: `${mount}/account/logout`,
    account_register_url: `${mount}/account/register`,
    account_addresses_url: `${mount}/account/addresses`,
    account_recover_url: `${mount}/account/recover`,
    cart_url: `${mount}/cart`,
    cart_add_url: `${mount}/cart/add`,
    cart_change_url: `${mount}/cart/change`,
    cart_clear_url: `${mount}/cart/clear`,
    cart_update_url: `${mount}/cart/update`,
    search_url: `${mount}/search`,
    collections_url: `${mount}/collections`,
    all_products_collection_url: `${mount}/collections/all`,
    predictive_search_url: `${mount}/search/suggest`,
    product_recommendations_url: `${mount}/recommendations/products`,
  };

  // ---- Navigation menus -----------------------------------------------------
  const navCollections = catalog.collections.filter((c) => c.handle !== "all").slice(0, 8);
  const mainMenu = {
    title: "Main menu",
    handle: "main-menu",
    levels: 1,
    links: [
      { title: "Home", url: routes.root_url, type: "frontpage_link", active: route.type === "index", child_active: false, current: route.type === "index", links: [], object: null },
      { title: "Shop all", url: routes.all_products_collection_url, type: "collection_link", active: false, child_active: false, current: false, links: [], object: null },
      ...navCollections.map((c) => ({
        title: c.title,
        url: c.url,
        type: "collection_link",
        active: route.collection?.handle === c.handle,
        child_active: false,
        current: route.collection?.handle === c.handle,
        links: [],
        object: c as unknown,
      })),
    ],
  };
  // Any menu handle a theme asks for resolves to the store's real navigation.
  const linklists = new Proxy(
    { "main-menu": mainMenu, footer: mainMenu, "footer-menu": mainMenu } as Record<string, unknown>,
    {
      get(target, prop: string | symbol) {
        if (typeof prop !== "string") return (target as any)[prop];
        if (prop in target) return (target as any)[prop];
        if (prop === "toLiquid" || prop === "then" || prop === "toJSON") return undefined;
        return mainMenu;
      },
      has() {
        return true;
      },
    },
  );

  // Shopify-style keyed lookups: collections['handle'], all_products['handle'].
  const collectionsByHandle: Record<string, unknown> = {};
  for (const c of catalog.collections) collectionsByHandle[c.handle] = c;
  const allProducts: Record<string, unknown> = {};
  for (const p of catalog.products) allProducts[p.handle] = p;

  const canonicalPath = `${mount}${route.path === "/" ? "/" : route.path}`;
  const pageTitleFor = (): string => {
    if (route.type === "product" && route.product) return `${route.product.title} — ${shopName}`;
    if (route.type === "collection" && route.collection) return `${route.collection.title} — ${shopName}`;
    if (route.type === "search") return `Search — ${shopName}`;
    if (route.type === "cart") return `Cart — ${shopName}`;
    if (route.type === "404") return `Page not found — ${shopName}`;
    return shopName;
  };

  const templateName =
    route.type === "list-collections" ? "list-collections" : route.type;

  const globals: Record<string, unknown> = {
    settings,
    shop: {
      name: shopName,
      email: catalog.shop.email,
      phone: catalog.shop.phone,
      description: catalog.shop.description,
      currency,
      money_format: `${currency} {{amount}}`,
      money_with_currency_format: `${currency} {{amount}}`,
      url: mount || "/",
      secure_url: mount || "/",
      domain: "",
      permanent_domain: "",
      enabled_payment_types: ["cash_on_delivery"],
      address: catalog.shop.address,
      brand: {},
      types: [...new Set(catalog.products.map((p) => String(p.type)).filter(Boolean))],
      vendors: [...new Set(catalog.products.map((p) => String(p.vendor)).filter(Boolean))],
      products_count: catalog.products.length,
      collections_count: catalog.collections.length,
      customer_accounts_enabled: false,
      customer_accounts_optional: true,
      policies: [],
      metafields: {},
    },
    request: {
      design_mode: false,
      visual_preview_mode: false,
      page_type: templateName,
      host: "",
      origin: "",
      path: canonicalPath,
      locale: { iso_code: "en", endonym_name: "English", primary: true, root_url: routes.root_url },
    },
    // Boxed so both `{{ template }}` / `template contains 'x'` and
    // `template.name` behave the way Shopify themes expect.
    template: Object.assign(new String(templateName), {
      name: templateName,
      suffix: "",
      directory: "",
    }),
    routes,
    linklists,
    collections: collectionsByHandle,
    all_products: allProducts,
    articles: {},
    blogs: {},
    pages: {},
    customer: null,
    cart: route.cart ?? {
      items: [],
      item_count: 0,
      total_price: 0,
      original_total_price: 0,
      items_subtotal_price: 0,
      total_discount: 0,
      empty: true,
      currency,
      note: "",
      attributes: {},
      requires_shipping: false,
    },
    search: {
      performed: route.type === "search",
      terms: route.searchTerms ?? "",
      results: route.searchResults ?? [],
      results_count: (route.searchResults ?? []).length,
      types: ["product"],
      default_sort_by: "relevance",
      filters: [],
    },
    localization: {
      language: { iso_code: "en", endonym_name: "English", name: "English", primary: true },
      country: { iso_code: "EG", name: "Egypt", currency: { iso_code: currency, symbol: currency } },
      available_languages: [],
      available_countries: [],
      market: { handle: "main", id: "main" },
    },
    current_tags: [],
    current_page: route.page,
    page_title: pageTitleFor(),
    page_description: catalog.shop.description,
    canonical_url: canonicalPath,
    powered_by_link: "",
    content_for_header: "",
    content_for_index: "",
    scripts: [],
    handle: route.product?.handle ?? route.collection?.handle ?? "",
    // Page-scoped objects
    product: route.product ?? null,
    variant: route.variant ?? null,
    collection: route.collection ?? null,
    // Shopify exposes an array of every collection on list-collections pages.
    all_collections: catalog.collections,
  };

  // ---- Liquid engine --------------------------------------------------------
  function resolveKey(name: string): string | null {
    const n = String(name).replace(/\.liquid$/, "").replace(/^\.?\//, "");
    for (const t of [`snippets/${n}.liquid`, `sections/${n}.liquid`, `${n}.liquid`, n])
      if (t in files) return t;
    return null;
  }

  const engine: any = new Liquid({
    extname: ".liquid",
    strictFilters: false,
    strictVariables: false,
    jsTruthy: true,
    relativeReference: false,
    // NOTE: liquidjs requires `readFile`/`readFileSync` — a `read` method is
    // ignored and every {% render %} / {% include %} then throws.
    fs: {
      sep: "/",
      async exists(fp: string) {
        return resolveKey(fp) !== null;
      },
      async readFile(fp: string) {
        const k = resolveKey(fp);
        return k ? files[k] : "";
      },
      existsSync(fp: string) {
        return resolveKey(fp) !== null;
      },
      readFileSync(fp: string) {
        const k = resolveKey(fp);
        return k ? files[k] : "";
      },
      resolve(_dir: string, file: string) {
        return file;
      },
      async contains() {
        return true;
      },
      containsSync() {
        return true;
      },
      dirname(p: string) {
        return p;
      },
    },
  } as any);

  // ---- Filters --------------------------------------------------------------
  const imgUrl = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string")
      return /^https?:\/\//.test(v) || v.startsWith("//") ? v : asset(v);
    return String(v.src || v.url || v.preview_image?.src || v || "");
  };
  const withinUrl = (url: any, col: any): string => {
    const u = String(url ?? "");
    const h = col?.handle;
    return h ? `${mount}/collections/${h}${u.startsWith(mount) ? u.slice(mount.length) : u}` : u;
  };

  const filters: Record<string, (...a: any[]) => any> = {
    asset_url: asset,
    global_asset_url: asset,
    shopify_asset_url: asset,
    asset_img_url: (v) => asset(v),
    file_url: asset,
    file_img_url: asset,
    img_url: imgUrl,
    image_url: imgUrl,
    product_img_url: imgUrl,
    collection_img_url: imgUrl,
    article_img_url: imgUrl,
    external_video_url: (v) => String(v ?? ""),
    stylesheet_tag: (u) => `<link rel="stylesheet" href="${u}" media="all">`,
    script_tag: (u) => `<script src="${u}" defer></script>`,
    image_tag: (u, ...rest) => {
      const named = rest.find((a) => a && typeof a === "object" && !Array.isArray(a)) as any;
      const alt = named?.alt ? ` alt="${escapeHtml(named.alt)}"` : ` alt=""`;
      const cls = named?.class ? ` class="${escapeHtml(named.class)}"` : "";
      return `<img src="${imgUrl(u)}" loading="lazy"${alt}${cls}>`;
    },
    img_tag: (u, alt = "") => `<img src="${imgUrl(u)}" alt="${escapeHtml(alt)}" loading="lazy">`,
    t: translate,
    translate,
    money,
    money_with_currency: (v) => `${money(v)}`,
    money_without_currency: amount,
    money_without_trailing_zeros: (v) => {
      const n = Number(v) / 100;
      return `${currency} ${Number.isInteger(n) ? n.toString() : amount(v)}`;
    },
    json: (v) => {
      try {
        return JSON.stringify(v ?? null);
      } catch {
        return "null";
      }
    },
    handle: slugify,
    handleize: slugify,
    url_for_type: (v: any) => `${mount}/collections/types?q=${encodeURIComponent(String(v ?? ""))}`,
    url_for_vendor: (v: any) => `${mount}/collections/vendors?q=${encodeURIComponent(String(v ?? ""))}`,
    within: withinUrl,
    link_to: (text: any, url: any) => `<a href="${url ?? "#"}">${text ?? ""}</a>`,
    link_to_type: (v: any) => `<a href="${mount}/collections/all">${v ?? ""}</a>`,
    link_to_vendor: (v: any) => `<a href="${mount}/collections/all">${v ?? ""}</a>`,
    placeholder_svg_tag: () =>
      `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%"><rect width="100" height="100" fill="#e7eaee"/></svg>`,
    payment_type_img_url: () => "",
    payment_type_svg_tag: () => "",
    font_modify: (v: any) => v,
    font_url: () => "",
    font_face: () => "",
    weight_with_unit: (v: any) => `${Number(v ?? 0)} kg`,
    highlight: (v: any) => v,
    highlight_active_tag: (v: any) => v,
    format_address: (v: any) => (v && typeof v === "object" ? String(v.summary ?? "") : String(v ?? "")),
    metafield_tag: (v: any) => v,
    metafield_text: (v: any) => v,
    structured_data: () => "",
    pluralize: (n: any, single: any, plural: any) => (Number(n) === 1 ? single : plural),
    camelize: (v: any) =>
      String(v ?? "").replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")),
    camelcase: (v: any) => String(v ?? ""),
    time_tag: (v: any) => `<time>${escapeHtml(v)}</time>`,
    default_pagination: () => "",
    sort_by: (url: any, key: any) => `${url ?? ""}?sort_by=${key ?? ""}`,
    currency_selector: () => "",
    brightness_difference: () => 0,
    color_brightness: () => 128,
    color_modify: (v: any) => v,
    color_lighten: (v: any) => v,
    color_darken: (v: any) => v,
    color_mix: (v: any) => v,
    color_extract: () => 0,
    color_to_rgb: (v: any) => v,
    color_to_hex: (v: any) => v,
    color_to_hsl: (v: any) => v,
    color_saturate: (v: any) => v,
    color_desaturate: (v: any) => v,
    color_contrast: () => 1,
    color_difference: () => 0,
    hex_to_rgba: (v: any) => v,
  };
  for (const [name, fn] of Object.entries(filters)) engine.registerFilter(name, fn);

  // ---- Tags -----------------------------------------------------------------
  function registerWrap(
    name: string,
    open: string | ((args: string) => string),
    close: string,
    scopeVar?: () => Record<string, unknown>,
  ) {
    engine.registerTag(name, {
      parse(this: any, token: any, remain: any[]) {
        this.tpls = [];
        this.args = String(token?.args ?? "").trim();
        const stream = engine.parser.parseStream(remain);
        stream
          .on(`tag:end${name}`, () => stream.stop())
          .on("template", (tpl: any) => this.tpls.push(tpl))
          .on("end", () => {
            throw new Error(`tag ${name} not closed`);
          });
        stream.start();
      },
      *render(this: any, ctx: any, emitter: any): any {
        const opening = typeof open === "function" ? open(this.args) : open;
        if (opening) emitter.write(opening);
        if (scopeVar) ctx.push(scopeVar());
        const html = yield engine.renderer.renderTemplates(this.tpls, ctx);
        if (scopeVar) ctx.pop();
        emitter.write(String(html ?? ""));
        if (close) emitter.write(close);
      },
    });
  }

  /** A block tag whose body is parsed but never rendered (e.g. {% doc %}). */
  function registerSwallow(name: string) {
    engine.registerTag(name, {
      parse(this: any, _t: any, remain: any[]) {
        const stream = engine.parser.parseStream(remain);
        stream
          .on(`tag:end${name}`, () => stream.stop())
          .on("template", () => {})
          .on("end", () => stream.stop());
        stream.start();
      },
      render: () => "",
    });
  }

  registerWrap("style", "<style>", "</style>");
  registerWrap("stylesheet", "<style>", "</style>");
  registerWrap("javascript", "<script>", "</script>");
  registerSwallow("doc");

  // {% form 'product', product %} → a real, working post target.
  registerWrap(
    "form",
    (args: string) => {
      const kind = (args.match(/^['"]([\w-]+)['"]/) ?? [])[1] ?? "";
      const action =
        kind === "product"
          ? routes.cart_add_url
          : kind === "cart"
            ? routes.cart_url
            : kind === "localization"
              ? routes.root_url
              : "#";
      return `<form method="post" action="${action}" accept-charset="UTF-8" class="shopify-form shopify-form--${kind}"><input type="hidden" name="form_type" value="${escapeHtml(kind)}"><input type="hidden" name="utf8" value="✓">`;
    },
    "</form>",
    () => ({ form: { errors: null, posted_successfully: false } }),
  );

  // {% schema %} … {% endschema %} — configuration, never output.
  engine.registerTag("schema", {
    parse(this: any, _t: any, remain: any[]) {
      const stream = engine.parser.parseStream(remain);
      stream
        .on("tag:endschema", () => stream.stop())
        .on("template", () => {})
        .on("end", () => {
          throw new Error("schema not closed");
        });
      stream.start();
    },
    render() {
      return "";
    },
  });
  // Shopify's {% layout %} / {% content_for %} have no equivalent here.
  engine.registerTag("layout", { parse() {}, render: () => "" });
  engine.registerTag("content_for", { parse() {}, render: () => "" });

  // ---- Pagination -----------------------------------------------------------
  function buildPaginate(total: number, size: number, current: number) {
    const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
    const page = Math.min(Math.max(1, current), pages);
    const qs = (n: number) => {
      const q = new URLSearchParams(route.query);
      if (n <= 1) q.delete("page");
      else q.set("page", String(n));
      const s = q.toString();
      return `${canonicalPath}${s ? `?${s}` : ""}`;
    };
    const parts: any[] = [];
    for (let n = 1; n <= pages; n++)
      parts.push({ title: String(n), url: qs(n), is_link: n !== page });
    return {
      items: total,
      pages,
      page_size: size,
      current_page: page,
      current_offset: (page - 1) * size,
      parts,
      next: page < pages ? { title: "Next", url: qs(page + 1), is_link: true } : null,
      previous: page > 1 ? { title: "Previous", url: qs(page - 1), is_link: true } : null,
    };
  }

  engine.registerTag("paginate", {
    parse(this: any, token: any, remain: any[]) {
      const args = String(token?.args ?? "").trim();
      const m = args.match(/^(.+?)\s+by\s+(\d+)/);
      this.expr = (m ? m[1] : args).trim();
      this.size = m ? parseInt(m[2], 10) : 20;
      this.tpls = [];
      const stream = engine.parser.parseStream(remain);
      stream
        .on("tag:endpaginate", () => stream.stop())
        .on("template", (tpl: any) => this.tpls.push(tpl))
        .on("end", () => {
          throw new Error("paginate not closed");
        });
      stream.start();
    },
    *render(this: any, ctx: any, emitter: any): any {
      let scope: Record<string, unknown> = {};
      try {
        const all = yield engine.evalValue(this.expr, ctx);
        const arr: any[] = Array.isArray(all) ? all : [];
        const pg = buildPaginate(arr.length, this.size, route.page);
        const slice = arr.slice(pg.current_offset, pg.current_offset + pg.page_size);
        scope = { paginate: pg };
        // Re-bind the paginated path (e.g. collection.products) to this page's slice.
        const parts = this.expr.split(".").map((s: string) => s.trim());
        if (parts.length === 1) {
          scope[parts[0]] = slice;
        } else {
          const base = yield engine.evalValue(parts[0], ctx);
          const clone: any = { ...(base ?? {}) };
          let cur = clone;
          for (let i = 1; i < parts.length - 1; i++) {
            cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = slice;
          scope[parts[0]] = clone;
        }
      } catch {
        scope = { paginate: buildPaginate(0, this.size, 1) };
      }
      ctx.push(scope);
      const html = yield engine.renderer.renderTemplates(this.tpls, ctx);
      ctx.pop();
      emitter.write(String(html ?? ""));
    },
  });

  // ---- Sections -------------------------------------------------------------
  const argString = (token: any): string =>
    String(token?.args ?? "").trim().replace(/^['"]|['"]$/g, "");

  async function renderSectionInstance(type: string, instance: any): Promise<string> {
    if (instance?.disabled) return "";
    const src = files[`sections/${type}.liquid`];
    if (!src) return `<!-- section "${type}" not found -->`;
    const sc = extractSchema(src);
    const id = instance?.id || type;
    const savedOrder: string[] =
      instance?.block_order ?? Object.keys(instance?.blocks ?? {});
    let blocks = savedOrder.map((bid) => {
      const b = instance?.blocks?.[bid] ?? {};
      const bt = b.type ?? "";
      return {
        id: bid,
        type: bt,
        settings: { ...(sc.blockDefaults[bt] ?? {}), ...(b.settings ?? {}) },
        shopify_attributes: "",
      };
    });
    // No saved blocks → fall back to the schema preset so the section isn't blank.
    if (blocks.length === 0 && sc.presetBlocks.length)
      blocks = sc.presetBlocks.map((b, i) => ({
        id: `${id}-${i}`,
        type: b.type,
        settings: b.settings,
        shopify_attributes: "",
      }));

    const section = {
      id,
      type,
      settings: { ...sc.settings, ...(instance?.settings ?? {}) },
      blocks,
      blocks_count: blocks.length,
      location: "",
      index: 0,
      index0: 0,
      shopify_attributes: "",
    };
    try {
      const html = await engine.parseAndRender(src, { ...globals, section });
      return `<div class="shopify-section shopify-section--${type}" id="shopify-section-${id}">${html}</div>`;
    } catch (e) {
      return `<!-- section "${type}" failed: ${escapeHtml((e as Error).message)} -->`;
    }
  }

  async function renderSectionGroup(name: string): Promise<string> {
    const group = tryJSON<any>(files[`sections/${name}.json`]);
    if (!group?.order) return "";
    let out = "";
    for (const id of group.order) {
      const inst = group.sections?.[id];
      if (inst?.type) out += await renderSectionInstance(inst.type, { id, ...inst });
    }
    return out;
  }

  engine.registerTag("section", {
    parse(this: any, token: any) {
      this.name = argString(token);
    },
    *render(this: any, _ctx: any, emitter: any): any {
      const html = yield renderSectionInstance(this.name, { id: this.name });
      emitter.write(html);
    },
  });
  engine.registerTag("sections", {
    parse(this: any, token: any) {
      this.name = argString(token);
    },
    *render(this: any, _ctx: any, emitter: any): any {
      const html = yield renderSectionGroup(this.name);
      emitter.write(html);
    },
  });

  // ---- Safety net: never fail to parse on an unknown Shopify tag ------------
  const SUBTAGS = new Set([
    "else", "elsif", "when", "empty", "break", "continue",
    "endif", "endfor", "endunless", "endcase", "endcapture", "endcomment",
    "endraw", "endtablerow", "endblock", "endliquid", "endschema", "endform",
    "endstyle", "endstylesheet", "endjavascript", "endpaginate", "enddoc",
    "endsection", "endsections", "endcontent_for", "endlayout",
  ]);
  const known = new Set(Object.keys(engine.tags));
  const seen = new Set<string>();
  for (const [path, src] of Object.entries(files)) {
    if (!path.endsWith(".liquid") || typeof src !== "string") continue;
    for (const m of src.matchAll(/\{%-?\s*([a-zA-Z_][\w]*)/g)) seen.add(m[1]);
  }
  for (const name of seen) {
    if (known.has(name) || SUBTAGS.has(name)) continue;
    // Rendered as nothing; a matching {% endX %} is neutralised the same way,
    // so the body of an unknown block tag still renders.
    engine.registerTag(name, { parse() {}, render: () => "" });
  }

  // ---- Page content ---------------------------------------------------------
  async function renderTemplate(name: string): Promise<string | null> {
    const json = tryJSON<any>(files[`templates/${name}.json`]);
    if (json?.order) {
      let out = "";
      for (const id of json.order) {
        const inst = json.sections?.[id];
        if (inst?.type) out += await renderSectionInstance(inst.type, { id, ...inst });
      }
      return out;
    }
    const liquid = files[`templates/${name}.liquid`];
    if (liquid != null) {
      try {
        return await engine.parseAndRender(liquid, globals);
      } catch (e) {
        return `<!-- template "${name}" failed: ${escapeHtml((e as Error).message)} -->${fallbackTemplate(route, catalog, mount, money)}`;
      }
    }
    return null;
  }

  const candidates: string[] =
    route.type === "list-collections"
      ? ["list-collections", "collection", "index"]
      : route.type === "404"
        ? ["404"]
        : [route.type];

  let content: string | null = null;
  for (const name of candidates) {
    content = await renderTemplate(name);
    if (content != null) break;
  }
  if (content == null) content = fallbackTemplate(route, catalog, mount, money);

  // ---- Layout ---------------------------------------------------------------
  const layoutSrc = files["layout/theme.liquid"];
  let html: string;
  if (layoutSrc) {
    try {
      html = await engine.parseAndRender(layoutSrc, {
        ...globals,
        content_for_layout: content,
      });
    } catch (e) {
      html = `<!doctype html><html><head><title>${escapeHtml(globals.page_title)}</title></head><body><!-- layout failed: ${escapeHtml((e as Error).message)} -->${content}</body></html>`;
    }
  } else {
    html = `<!doctype html><html><head><title>${escapeHtml(globals.page_title)}</title></head><body>${content}</body></html>`;
  }

  // ---- Post-processing ------------------------------------------------------
  html = rewriteUrls(html, assetBase, mount);

  const cssLinks = cssAssets
    .map((href) => `<link rel="stylesheet" href="${href}" media="all">`)
    .join("");
  const headInject = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${cssLinks}${bridgeScript(mount, currency)}`;
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}${headInject}`)
    : /<html[^>]*>/i.test(html)
      ? html.replace(/<html[^>]*>/i, (m) => `${m}<head>${headInject}</head>`)
      : `${headInject}${html}`;

  return html;
}
