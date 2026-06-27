/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { Liquid } from "liquidjs";

export type FileMap = Record<string, string>;

export type RenderInput = {
  files: FileMap; // keys relative to theme root, e.g. "layout/theme.liquid"
  assetBase: string; // public URL of theme root, trailing slash
  shopName: string;
  currency: string;
  cssAssets?: string[]; // absolute URLs of CSS files to force-link into <head>
};

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

function extractSchema(src: string): {
  settings: Record<string, unknown>;
  blockDefaults: Record<string, Record<string, unknown>>;
} {
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  const out = { settings: {} as Record<string, unknown>, blockDefaults: {} as Record<string, Record<string, unknown>> };
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
  return out;
}

export async function renderThemeHome(input: RenderInput): Promise<string> {
  const { files, assetBase, shopName, currency, cssAssets = [] } = input;
  const asset = (name: unknown) => `${assetBase}assets/${String(name ?? "").replace(/^\//, "")}`;

  // ---- Settings ----
  const schema = tryJSON<any[]>(files["config/settings_schema.json"]);
  const schemaDefaults: Record<string, unknown> = {};
  if (Array.isArray(schema))
    for (const panel of schema)
      for (const s of panel?.settings ?? []) if (s?.id) schemaDefaults[s.id] = s.default ?? "";

  const settingsData = tryJSON<any>(files["config/settings_data.json"]);
  let current: any = settingsData?.current;
  if (typeof current === "string") current = settingsData?.presets?.[current] ?? {};
  const settings = { ...schemaDefaults, ...(current ?? {}) };

  // ---- Locales (best-effort translation) ----
  const localeKey =
    Object.keys(files).find((k) => /^locales\/.*\.default\.json$/.test(k)) ??
    Object.keys(files).find((k) => /^locales\/en\.json$/.test(k));
  const locale = tryJSON<any>(localeKey ? files[localeKey] : undefined) ?? {};
  const translate = (key: unknown): string => {
    const parts = String(key ?? "").split(".");
    let cur: any = locale;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return String(key ?? "");
    }
    return typeof cur === "string" ? cur : String(key ?? "");
  };

  const money = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${currency} ${(n / 100).toFixed(2)}` : "";
  };

  const routes = {
    root_url: "/", account_url: "/account", account_login_url: "/account/login",
    account_logout_url: "/account/logout", account_register_url: "/account/register",
    cart_url: "/cart", cart_add_url: "/cart/add", cart_change_url: "/cart/change",
    search_url: "/search", collections_url: "/collections", all_products_collection_url: "/collections/all",
    predictive_search_url: "/search/suggest",
  };

  const globals: Record<string, unknown> = {
    settings,
    shop: { name: shopName, email: "", currency, money_format: `${currency} {{amount}}`, url: "", secure_url: "", domain: "", permanent_domain: "", description: "", enabled_payment_types: [], address: {}, brand: {}, types: [], vendors: [] },
    request: { design_mode: false, visual_preview_mode: false, page_type: "index", host: "", origin: "", path: "/", locale: { iso_code: "en" } },
    template: { name: "index", suffix: "", directory: "" },
    routes,
    cart: { item_count: 0, items: [], total_price: 0, currency, empty: true, note: "", attributes: {} },
    customer: null,
    collections: {}, all_products: {}, articles: {}, blogs: {}, pages: {},
    linklists: {}, search: { performed: false, results: [], terms: "" },
    localization: { language: { iso_code: "en", endonym_name: "English" }, country: { iso_code: "EG", currency: { iso_code: currency } }, available_languages: [], available_countries: [] },
    current_tags: [], page_title: shopName, page_description: "", canonical_url: "",
    powered_by_link: "", content_for_header: "", scripts: [],
  };

  function resolveKey(name: string): string | null {
    const n = name.replace(/\.liquid$/, "").replace(/^\.?\//, "");
    for (const t of [`snippets/${n}.liquid`, `sections/${n}.liquid`, `${n}.liquid`, n]) if (t in files) return t;
    return null;
  }

  const engine: any = new Liquid({
    extname: ".liquid",
    strictFilters: false,
    strictVariables: false,
    jsTruthy: true,
    relativeReference: false,
    fs: {
      sep: "/",
      async exists(fp: string) { return resolveKey(fp) !== null; },
      async read(fp: string) { const k = resolveKey(fp); return k ? files[k] : ""; },
      existsSync(fp: string) { return resolveKey(fp) !== null; },
      readFileSync(fp: string) { const k = resolveKey(fp); return k ? files[k] : ""; },
      resolve(_dir: string, file: string) { return file; },
      contains() { return true; },
      dirname(p: string) { return p; },
    },
  } as any);

  // ---- Filters ----
  const imgUrl = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return /^https?:\/\//.test(v) || v.startsWith("//") ? v : asset(v);
    return v.src || v.url || v.preview_image?.src || "";
  };
  const filters: Record<string, (...a: any[]) => any> = {
    asset_url: asset, global_asset_url: asset, shopify_asset_url: asset,
    asset_img_url: (v) => asset(v), file_url: asset, file_img_url: asset,
    img_url: imgUrl, image_url: imgUrl, product_img_url: imgUrl, collection_img_url: imgUrl, article_img_url: imgUrl,
    stylesheet_tag: (u) => `<link rel="stylesheet" href="${u}" media="all">`,
    script_tag: (u) => `<script src="${u}" defer></script>`,
    image_tag: (u) => `<img src="${u}" loading="lazy" alt="">`,
    t: translate, translate,
    money, money_with_currency: (v) => `${money(v)} ${currency}`,
    money_without_currency: (v) => { const n = Number(v); return Number.isFinite(n) ? (n / 100).toFixed(2) : ""; },
    money_without_trailing_zeros: money,
    json: (v) => JSON.stringify(v ?? null),
    handle: slugify, handleize: slugify,
    placeholder_svg_tag: () => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e7eaee"/></svg>`,
    payment_type_img_url: () => "", font_modify: (v) => v, font_url: () => "", font_face: () => "",
    weight_with_unit: (v) => String(v ?? ""),
    link_to: (text, url) => `<a href="${url ?? "#"}">${text ?? ""}</a>`,
    highlight: (v) => v, format_address: (v) => v, metafield_tag: (v) => v, metafield_text: (v) => v, structured_data: (v) => v,
  };
  for (const [name, fn] of Object.entries(filters)) engine.registerFilter(name, fn);

  // ---- Block tags ----
  function registerWrap(name: string, open: string, close: string, scopeVar?: () => Record<string, unknown>) {
    engine.registerTag(name, {
      parse(this: any, _token: any, remain: any[]) {
        this.tpls = [];
        const stream = engine.parser.parseStream(remain);
        stream
          .on(`tag:end${name}`, () => stream.stop())
          .on("template", (tpl: any) => this.tpls.push(tpl))
          .on("end", () => { throw new Error(`tag ${name} not closed`); });
        stream.start();
      },
      *render(this: any, ctx: any, emitter: any): any {
        if (open) emitter.write(open);
        if (scopeVar) ctx.push(scopeVar());
        const html = yield engine.renderer.renderTemplates(this.tpls, ctx);
        if (scopeVar) ctx.pop();
        emitter.write(String(html ?? ""));
        if (close) emitter.write(close);
      },
    });
  }
  registerWrap("style", "<style>", "</style>");
  registerWrap("stylesheet", "<style>", "</style>");
  registerWrap("javascript", "<script>", "</script>");
  registerWrap("form", '<form method="post" action="#">', "</form>", () => ({ form: { errors: null, posted_successfully: false } }));
  registerWrap("paginate", "", "", () => ({ paginate: { pages: 1, current_page: 1, items: 0, parts: [], next: null, previous: null } }));

  engine.registerTag("schema", {
    parse(this: any, _t: any, remain: any[]) {
      const stream = engine.parser.parseStream(remain);
      stream.on("tag:endschema", () => stream.stop()).on("template", () => {}).on("end", () => { throw new Error("schema not closed"); });
      stream.start();
    },
    render() { return ""; },
  });
  engine.registerTag("layout", { parse() {}, render() { return ""; } });

  async function renderSectionInstance(type: string, instance: any): Promise<string> {
    if (instance?.disabled) return "";
    const src = files[`sections/${type}.liquid`];
    if (!src) return `<!-- section ${type} not found -->`;
    const sc = extractSchema(src);
    const id = instance?.id || type;
    const order: string[] = instance?.block_order ?? Object.keys(instance?.blocks ?? {});
    const blocks = order.map((bid) => {
      const b = instance?.blocks?.[bid] ?? {};
      const bt = b.type ?? "";
      return { id: bid, type: bt, settings: { ...(sc.blockDefaults[bt] ?? {}), ...(b.settings ?? {}) }, shopify_attributes: "" };
    });
    const section = { id, settings: { ...sc.settings, ...(instance?.settings ?? {}) }, blocks, blocks_count: blocks.length, location: "", index: 0, index0: 0, shopify_attributes: "" };
    try {
      const html = await engine.parseAndRender(src, { ...globals, section });
      return `<div class="shopify-section shopify-section--${type}" id="shopify-section-${id}">${html}</div>`;
    } catch (e) {
      return `<!-- section ${type} failed: ${(e as Error).message} -->`;
    }
  }

  async function renderGroup(name: string): Promise<string> {
    const group = tryJSON<any>(files[`sections/${name}.json`]);
    if (!group?.order) return "";
    let out = "";
    for (const id of group.order) {
      const inst = group.sections?.[id];
      if (inst?.type) out += await renderSectionInstance(inst.type, { id, ...inst });
    }
    return out;
  }

  const argString = (token: any): string => (token?.args ?? "").trim().replace(/^['"]|['"]$/g, "");
  engine.registerTag("section", {
    parse(this: any, token: any) { this.name = argString(token); },
    *render(this: any, _ctx: any, emitter: any): any {
      const html = yield renderSectionInstance(this.name, { id: this.name });
      emitter.write(html);
    },
  });
  engine.registerTag("sections", {
    parse(this: any, token: any) { this.name = argString(token); },
    *render(this: any, _ctx: any, emitter: any): any {
      const html = yield renderGroup(this.name);
      emitter.write(html);
    },
  });

  // ---- Homepage content ----
  let content = "";
  const indexJson = tryJSON<any>(files["templates/index.json"]);
  if (indexJson?.order) {
    for (const id of indexJson.order) {
      const inst = indexJson.sections?.[id];
      if (inst?.type) content += await renderSectionInstance(inst.type, { id, ...inst });
    }
  } else if (files["templates/index.liquid"]) {
    try { content = await engine.parseAndRender(files["templates/index.liquid"], globals); }
    catch (e) { content = `<!-- index failed: ${(e as Error).message} -->`; }
  }

  // ---- Layout ----
  const layoutSrc = files["layout/theme.liquid"];
  let html: string;
  if (layoutSrc) {
    try { html = await engine.parseAndRender(layoutSrc, { ...globals, content_for_layout: content }); }
    catch (e) { html = `<!doctype html><html><head></head><body><!-- layout failed: ${(e as Error).message} -->${content}</body></html>`; }
  } else {
    html = `<!doctype html><html><head></head><body>${content}</body></html>`;
  }

  // Inject <base> (so relative URLs resolve to the theme root) and force-link
  // the theme's stylesheets — many themes load CSS in ways our shim can't emit.
  const cssLinks = cssAssets.map((href) => `<link rel="stylesheet" href="${href}" media="all">`).join("");
  const headInject = `<base href="${assetBase}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${cssLinks}`;
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}${headInject}`)
    : /<html[^>]*>/i.test(html)
      ? html.replace(/<html[^>]*>/i, (m) => `${m}<head>${headInject}</head>`)
      : `${headInject}${html}`;
  return html;
}
