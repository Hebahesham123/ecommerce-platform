

/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  renderStorefront,
  getStorefrontCatalog,
  type StorefrontResponse,
} from "@/lib/theme-render-service";
import {
  CART_COOKIE,
  CART_MAX_AGE,
  addLine,
  buildCart,
  cartJson,
  lineIdAt,
  parseCart,
  serializeCart,
  setLine,
  type CartLine,
} from "@/lib/storefront-cart";
import { searchProducts, type ProductDrop } from "@/lib/storefront-data";

const escHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** A theme-agnostic predictive-search fragment (products the shopper is typing). */
function predictiveSearchHtml(results: ProductDrop[], mount: string, terms: string): string {
  if (!results.length)
    return `<div class="predictive-search"><p class="predictive-search__no-results" style="padding:14px;color:#64748b;font-size:14px">No results for "${escHtml(terms)}"</p></div>`;
  const items = results
    .map((p) => {
      const img = String((p as Record<string, unknown>).featured_image ?? "");
      const price = (Number((p as Record<string, unknown>).price ?? 0) / 100).toLocaleString();
      return `<li class="predictive-search__list-item" role="option"><a href="${mount}${escHtml(String(p.url))}" class="predictive-search__item" style="display:flex;align-items:center;gap:10px;padding:8px 12px;text-decoration:none;color:inherit">${img ? `<img src="${escHtml(img)}" alt="" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex:0 0 auto">` : ""}<span style="flex:1;font-size:14px">${escHtml(String(p.title))}</span><span style="font-size:13px;font-weight:600;white-space:nowrap">${price} EGP</span></a></li>`;
    })
    .join("");
  return `<div class="predictive-search" role="listbox"><ul class="predictive-search__results-list" style="list-style:none;margin:0;padding:6px 0">${items}</ul></div>`;
}

// ---- On-the-fly Arabic translation (theme-agnostic) -------------------------
const TR_CACHE = new Map<string, string>();
async function translateOne(text: string, tl: string): Promise<string> {
  const key = `${tl}||${text}`;
  const hit = TR_CACHE.get(key);
  if (hit !== undefined) return hit;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return text;
    const data = (await r.json()) as unknown;
    const seg = Array.isArray(data) ? (data[0] as unknown) : null;
    const out = Array.isArray(seg) ? seg.map((s) => (Array.isArray(s) ? String(s[0] ?? "") : "")).join("") : "";
    const result = out || text;
    if (TR_CACHE.size < 8000) TR_CACHE.set(key, result);
    return result;
  } catch {
    return text;
  }
}
async function translateBatch(texts: string[], tl: string): Promise<string[]> {
  const out: string[] = new Array(texts.length);
  let idx = 0;
  const worker = async () => {
    while (idx < texts.length) {
      const i = idx++;
      out[i] = await translateOne(texts[i], tl);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, texts.length || 1) }, () => worker()));
  return out;
}

/** Injected on every storefront page: a guaranteed always-on-top language toggle
 *  plus, when Arabic is selected, RTL + client-side machine translation of all
 *  visible text via our same-origin /translate proxy. */
function localizationScript(mount: string): string {
  return `<script>(function(){
var M=${JSON.stringify(mount)};
function ck(n){var m=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return m?decodeURIComponent(m[1]):''}
function setLoc(l){document.cookie='sf_locale='+l+';path=/;max-age=31536000;samesite=lax';location.reload()}
var L=ck('sf_locale')||'en';
function toggle(){if(document.getElementById('sf-lang-toggle'))return;var b=document.createElement('button');b.id='sf-lang-toggle';b.type='button';b.textContent=L==='ar'?'EN':'\\u0639\\u0631\\u0628\\u064a';b.style.cssText='position:fixed;z-index:2147483647;bottom:18px;'+(L==='ar'?'left':'right')+':18px;min-width:54px;height:44px;padding:0 14px;border-radius:24px;border:none;background:#111;color:#fff;font:700 14px system-ui;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28)';b.onclick=function(){setLoc(L==='ar'?'en':'ar')};document.body.appendChild(b)}
if(document.body)toggle();else document.addEventListener('DOMContentLoaded',toggle);
if(L!=='ar')return;
var de=document.documentElement;de.setAttribute('dir','rtl');de.setAttribute('lang','ar');
var CK='sf_tr_ar',cache={};try{cache=JSON.parse(sessionStorage.getItem(CK)||'{}')}catch(e){}
var AR=/[\\u0600-\\u06FF]/,LAT=/[A-Za-z]/;
function collect(root){var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n,a=[];while(n=w.nextNode()){var s=n.nodeValue;if(!s||!s.trim())continue;var p=n.parentNode,t=p&&p.nodeName;if(t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||t==='TEXTAREA')continue;if(AR.test(s)||!LAT.test(s))continue;a.push(n)}return a}
function apply(nodes){nodes.forEach(function(n){var s=n.nodeValue,k=s.trim(),v=cache[k];if(v)n.nodeValue=s.replace(k,v)})}
function run(nodes){var need=[],seen={};nodes.forEach(function(n){var k=n.nodeValue.trim();if(!cache[k]&&!seen[k]){seen[k]=1;need.push(k)}});if(!need.length){apply(nodes);return}var i=0;(function nx(){if(i>=need.length){try{sessionStorage.setItem(CK,JSON.stringify(cache))}catch(e){}apply(nodes);return}var c=need.slice(i,i+40);i+=40;fetch(M+'/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({q:c})}).then(function(r){return r.json()}).then(function(j){var t=(j&&j.t)||[];c.forEach(function(s,x){if(t[x])cache[s]=t[x]});nx()}).catch(function(){nx()})})()}
document.addEventListener('DOMContentLoaded',function(){run(collect(document.body));var mo=new MutationObserver(function(ms){var ns=[];ms.forEach(function(m){[].forEach.call(m.addedNodes,function(x){if(x.nodeType===3){if(x.nodeValue&&x.nodeValue.trim())ns.push(x)}else if(x.nodeType===1){ns=ns.concat(collect(x))}})});if(ns.length)run(ns)});mo.observe(document.body,{childList:true,subtree:true})});
})();</script>`;
}

// ---- Bundle / "you may also like" recommendations ---------------------------
/** Pick up to `limit` random, buyable products, excluding the current one.
 *  Powers the theme's product-recommendations API (and the bundle widget) so it
 *  fills with real products without anyone having to build a collection. */
function recommendationProducts(catalog: any, excludeId: string, limit: number): any[] {
  const all: any[] = Array.from(catalog.productByHandle?.values?.() ?? []);
  const pool = all.filter((p) => {
    if (!p) return false;
    if (String(p.id) === excludeId) return false;
    if (Array.isArray(p.variants) && p.variants.some((v: any) => String(v.id) === excludeId)) return false;
    if (!p.featured_image) return false; // never recommend an imageless product
    return p.available !== false; // don't recommend sold-out products
  });
  // Fisher–Yates shuffle (server-side, so Math.random is fine).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, Math.max(0, limit));
}

// ---- Quantity stepper stock guard (injected on every page) ------------------
/** Client script: cap every quantity input to live stock and block the "+" at
 *  the ceiling. The server already refuses to oversell — this keeps the on-page
 *  stepper honest since the uploaded theme's own JS ignores stock. */
async function stockGuardScript(mount: string, path: string, lines: CartLine[]): Promise<string> {
  let catalog: any;
  try {
    catalog = await getStorefrontCatalog(mount);
  } catch {
    return "";
  }
  const stock: Record<string, number | null> = {};
  const add = (v: any) => {
    if (!v || v.id == null) return;
    const tracked = v.inventory_management === "shopify";
    stock[String(v.id)] = tracked ? Math.max(0, Number(v.inventory_quantity) || 0) : null;
  };
  // Fallback cap for the product page's own quantity input, used when we can't
  // map the input to a specific variant id (theme markup varies wildly).
  let pageMax: number | null = null;
  const pm = path.match(/^\/products\/([^/]+)/);
  if (pm) {
    let handle = pm[1];
    try {
      handle = decodeURIComponent(handle);
    } catch {
      /* keep raw handle */
    }
    const product: any = catalog.productByHandle?.get(handle);
    if (product?.variants?.length) {
      for (const v of product.variants) add(v);
      const tracked = product.variants.filter((v: any) => v.inventory_management === "shopify");
      // Only set a page cap when every variant is tracked, so an untracked
      // variant is never wrongly limited. Min across variants = safe ceiling.
      if (tracked.length === product.variants.length) {
        pageMax = Math.min(
          ...tracked.map((v: any) => Math.max(0, Number(v.inventory_quantity) || 0)),
        );
      }
    }
  }
  for (const l of lines) {
    const hit = catalog.variantById?.get(l.id);
    if (hit) add(hit.variant);
  }
  const GUARD = `(function(){
if(window.__BB_SG__)return;window.__BB_SG__=1;
var S=window.__BB_STOCK__||{};var MOUNT=window.__BB_MOUNT__||'';
function digits(s){var o='';for(var i=0;i<s.length;i++){var c=s[i];if(c>='0'&&c<='9')o+=c;else break;}return o;}
function idFor(input){var n=input.getAttribute('name')||'';if(n.indexOf('updates[')===0){var e=n.indexOf(']');if(e>8)return n.slice(8,e);}var d=input.getAttribute('data-quantity-variant-id')||input.getAttribute('data-variant-id')||input.getAttribute('data-id');if(d)return d;var f=input.closest&&input.closest('form');if(f){var el=f.querySelector('[name="id"]');if(el&&el.value)return el.value;}var row=input.closest&&input.closest('[class*="cart-item"],[class*="cart__row"],[class*="line-item"],[class*="CartItem"],tr,li');if(row){var a=row.querySelector('a[href*="variant="]');if(a){var h=a.getAttribute('href')||'';var q=h.indexOf('variant=');if(q>=0){var num=digits(h.slice(q+8));if(num)return num;}}}return null;}
function isQty(input){if(!input||input.tagName!=='INPUT')return false;var t=(input.getAttribute('type')||'').toLowerCase();var n=input.getAttribute('name')||'';return t==='number'||n==='quantity'||n.indexOf('updates[')===0||(input.className||'').indexOf('quantity')>-1;}
function capFor(input){var id=idFor(input);if(id!=null){var s=S[id];if(s!=null)return s;}var n=input.getAttribute('name')||'';var isCart=n.indexOf('updates[')===0;var pmx=window.__BB_PAGE_MAX__;if(pmx!=null&&!isCart)return pmx;var mx=parseInt(input.getAttribute('max')||'',10);return isNaN(mx)?Infinity:mx;}
function note(input,cap){var host=(input.closest&&(input.closest('.quantity')||input.closest('[class*=quantity]')||input.closest('[class*=qty]')))||input.parentElement;if(!host||!host.parentElement)return;var el=host.parentElement.querySelector('.bb-stock-note');if(!el){el=document.createElement('div');el.className='bb-stock-note';el.style.cssText='font:600 12px system-ui,-apple-system,sans-serif;color:#b91c1c;margin-top:6px';host.parentElement.insertBefore(el,host.nextSibling);}el.textContent=(cap<=0?'Out of stock':'Only '+cap+' left in stock');clearTimeout(el._t);el._t=setTimeout(function(){if(el)el.textContent='';},2600);}
function clamp(input,silent){if(!isQty(input))return;var cap=capFor(input);if(cap===Infinity){setPlus(input,false);return;}input.setAttribute('max',cap<1?1:cap);var v=parseInt(input.value||'1',10);if(isNaN(v))v=1;if(v>cap){input.value=(cap<1?1:cap);v=(cap<1?1:cap);if(!silent)note(input,cap);}setPlus(input,v>=cap);}
function guardInput(input){if(input.__bbG)return;input.__bbG=1;var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(!d||!d.set)return;try{Object.defineProperty(input,'value',{configurable:true,get:function(){return d.get.call(this);},set:function(v){var cap=capFor(this);var num=parseInt(v,10);if(!isNaN(num)&&cap!==Infinity&&num>cap){v=(cap<1?1:cap);note(this,cap);}d.set.call(this,v);}});}catch(e){}}
function plusHit(t){if(!t.getAttribute)return false;var s=((t.getAttribute('name')||'')+' '+(t.getAttribute('data-action')||'')+' '+(t.className||'')+' '+(t.getAttribute('aria-label')||'')).toLowerCase();if(/plus|increase|increment|qty-up|quantity-up/.test(s))return true;return (t.textContent||'').replace(/\\s/g,'')==='+';}
function findPlus(input){var wrap=(input.closest&&(input.closest('.quantity')||input.closest('[class*=quantity]')||input.closest('[class*=qty]')))||input.parentElement;if(!wrap)return null;var c=wrap.querySelectorAll('button,a,[role="button"],span,div,input[type="button"],input[type="submit"]');for(var i=0;i<c.length;i++){if(plusHit(c[i]))return c[i];}return null;}
function setPlus(input,off){var p=findPlus(input);if(!p)return;if(off){if(p.__bbOff)return;p.__bbOff=1;p.style.opacity='0.35';p.style.pointerEvents='none';p.style.cursor='not-allowed';p.setAttribute('aria-disabled','true');if(p.tagName==='BUTTON'||p.tagName==='INPUT')p.disabled=true;}else{if(!p.__bbOff)return;p.__bbOff=0;p.style.opacity='';p.style.pointerEvents='';p.style.cursor='';p.removeAttribute('aria-disabled');if(p.tagName==='BUTTON'||p.tagName==='INPUT')p.disabled=false;}}
document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"],span,div,input');if(!t||!plusHit(t))return;var wrap=(t.closest&&(t.closest('.quantity')||t.closest('[class*=quantity]')||t.closest('[class*=qty]')))||t.parentElement;var input=wrap&&(wrap.querySelector('input[type=number]')||wrap.querySelector('input[name=quantity]')||wrap.querySelector('input[name^=updates]')||wrap.querySelector('input[class*=quantity]'));if(!input||!isQty(input))return;var cap=capFor(input);if(cap===Infinity)return;var cur=parseInt(input.value||'1',10);if(isNaN(cur))cur=1;if(cur>=cap){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();note(input,cap);}},true);
['input','change'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.tagName==='INPUT')clamp(e.target,ev==='input');},true);});
var pend=false;function scan(){pend=false;var ns=document.querySelectorAll('input[type=number],input[name=quantity],input[name^=updates],input[class*=quantity]');for(var i=0;i<ns.length;i++){if(isQty(ns[i]))guardInput(ns[i]);clamp(ns[i],true);}}
function schedule(){if(pend)return;pend=true;(window.requestAnimationFrame||setTimeout)(scan);}
function loadProductStock(){var p=location.pathname,i=p.indexOf('/products/');if(i<0)return;var h=p.slice(i+10);var sl=h.indexOf('/');if(sl>=0)h=h.slice(0,sl);h=(h.split('?')[0]||'').split('#')[0];if(!h)return;fetch(MOUNT+'/products/'+h+'.js',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(pr){if(!pr||!pr.variants||!pr.variants.length)return;var mins=[],all=true;pr.variants.forEach(function(v){var tracked=v.inventory_management==='shopify';if(tracked){var q=Math.max(0,parseInt(v.inventory_quantity,10)||0);S[String(v.id)]=q;mins.push(q);}else{S[String(v.id)]=null;all=false;}});if(all&&mins.length)window.__BB_PAGE_MAX__=Math.min.apply(null,mins);scan();}).catch(function(){});}
loadProductStock();
if(document.readyState!=='loading')scan();else document.addEventListener('DOMContentLoaded',scan);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setInterval(scan,500);
})();`;
  return `<script>window.__BB_STOCK__=${JSON.stringify(stock)};window.__BB_PAGE_MAX__=${JSON.stringify(pageMax)};window.__BB_MOUNT__=${JSON.stringify(mount)};${GUARD}</script>`;
}

/**
 * Shared request handling for every place a theme is served from:
 * the public storefront and the admin theme preview. Both mount the same
 * renderer at a different URL prefix.
 */

export type MountConfig = {
  themeId: string;
  /** URL prefix, no trailing slash — e.g. "/shop". */
  mount: string;
  shopName?: string;
};

// ---- Cookie helpers ---------------------------------------------------------
function readCart(req: Request): CartLine[] {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CART_COOKIE}=`));
  return parseCart(match ? match.slice(CART_COOKIE.length + 1) : undefined);
}

function cartCookie(lines: CartLine[]): string {
  return `${CART_COOKIE}=${serializeCart(lines)}; Path=/; Max-Age=${CART_MAX_AGE}; SameSite=Lax`;
}

// ---- Stock guard ------------------------------------------------------------
/** Max sellable units for a variant: its live stock, or ∞ when untracked. */
function variantCap(catalog: any, id: string): number {
  const hit = catalog.variantById.get(id);
  if (!hit) return 0; // variant deleted in the dashboard → not sellable
  const v = hit.variant as Record<string, unknown>;
  const tracked = v.inventory_management === "shopify";
  if (!tracked) return Number.POSITIVE_INFINITY;
  return Math.max(0, Number(v.inventory_quantity) || 0);
}

/** Clamp every cart line to its live stock; drop lines that are sold out.
 *  This is the real anti-oversell guard — buildCart only caps the *display*,
 *  but the cookie itself must never hold more than can actually ship. */
function clampLinesToStock(catalog: any, lines: CartLine[]): CartLine[] {
  const out: CartLine[] = [];
  for (const l of lines) {
    const q = Math.min(l.quantity, variantCap(catalog, l.id));
    if (q > 0) out.push({ id: l.id, quantity: q });
  }
  return out;
}

const HTML = "text/html; charset=utf-8";

function html(body: string, status = 200, cookie?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": HTML,
    "Cache-Control": "no-store",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(body, { status, headers });
}

function json(data: unknown, status = 200, cookie?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}

function redirect(to: string, cookie?: string): Response {
  const headers: Record<string, string> = { Location: to, "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 303, headers });
}

function toResponse(res: StorefrontResponse): Response {
  return html(res.html, res.status);
}

// ---- Path helpers -----------------------------------------------------------
function pathAndQuery(req: Request, mount: string) {
  const url = new URL(req.url);
  // Handles can be non-latin (Arabic categories), so the pathname arrives
  // percent-encoded — decode before matching it against catalog handles.
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* malformed escape — match on the raw path */
  }
  if (mount && path.startsWith(mount)) path = path.slice(mount.length);
  if (!path.startsWith("/")) path = `/${path}`;
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  return { path: path.replace(/\/+$/, "") || "/", query, url };
}

/** Handoff page: copies the theme cart into the existing checkout's storage. */
function checkoutBridge(lines: unknown[], mount: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Checkout…</title>
<style>body{font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#475569}</style></head>
<body><p>Taking you to checkout…</p>
<script>try{localStorage.setItem("bb_cart",${JSON.stringify(JSON.stringify(lines))});}catch(e){}
location.replace(${JSON.stringify(lines.length ? "/store/checkout" : `${mount}/cart`)});</script>
</body></html>`;
}

function crashPage(e: unknown): Response {
  return html(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px/1.7 system-ui,-apple-system,Segoe UI,sans-serif;padding:48px;max-width:640px;margin:0 auto;color:#475569}code{background:#f1f5f9;padding:2px 6px;border-radius:6px;word-break:break-all}</style></head><body><h1 style="color:#0f172a">Storefront error</h1><p><code>${String(
      (e as Error)?.message ?? e,
    ).replace(/[<>&]/g, "")}</code></p></body></html>`,
    500,
  );
}

// ---- GET --------------------------------------------------------------------
export async function handleStorefrontGet(
  req: Request,
  config: MountConfig,
): Promise<Response> {
  try {
    return await storefrontGet(req, config);
  } catch (e) {
    return crashPage(e);
  }
}

async function storefrontGet(req: Request, config: MountConfig): Promise<Response> {
  const { mount, themeId, shopName } = config;
  const { path, query } = pathAndQuery(req, mount);
  const lines = readCart(req);

  // --- Shopify AJAX / JSON endpoints ---------------------------------------
  if (path === "/cart.js" || path === "/cart.json") {
    const catalog = await getStorefrontCatalog(mount);
    return json(cartJson(buildCart(lines, catalog, mount)));
  }

  if (path.startsWith("/products/") && path.endsWith(".js")) {
    const handle = path.slice("/products/".length, -3);
    const catalog = await getStorefrontCatalog(mount);
    const product = catalog.productByHandle.get(handle);
    if (!product) return json({ error: "not_found" }, 404);
    return json(product);
  }

  // Predictive (typeahead) search: return real matching products so the theme's
  // search dropdown populates as the shopper types.
  if (path === "/search/suggest") {
    const terms = String(query.q ?? "").trim();
    if (!terms) return html('<div class="predictive-search"></div>');
    const catalog = await getStorefrontCatalog(mount);
    const results = searchProducts(catalog, terms).slice(0, 8);
    return html(predictiveSearchHtml(results, mount, terms));
  }
  // Product recommendations (Shopify's API): power "you may also like" and the
  // bundle widget with real, random products so no collection is required.
  if (path.startsWith("/recommendations/products")) {
    const catalog = await getStorefrontCatalog(mount);
    const excludeId = String(query.product_id ?? "");
    const limit = Math.max(1, Math.min(12, Number(query.limit) || 4));
    const recs = recommendationProducts(catalog, excludeId, limit).map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      url: p.url,
      price: p.price,
      compare_at_price: p.compare_at_price ?? null,
      available: p.available !== false,
      vendor: p.vendor ?? "",
      // Image drops stringify to their URL — force strings so the widget never
      // gets "[object Object]" as an <img src>.
      featured_image: p.featured_image ? String(p.featured_image) : null,
      images: Array.isArray(p.images) ? p.images.map((im: any) => String(im)) : [],
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            available: v.available !== false,
            inventory_quantity: v.inventory_quantity,
          }))
        : [],
    }));
    return json({ products: recs });
  }
  if (path.startsWith("/recommendations/")) {
    return html('<div class="predictive-search"></div>');
  }

  // --- Checkout handoff to the existing COD flow ---------------------------
  if (path === "/checkout" || path === "/cart/checkout") {
    const catalog = await getStorefrontCatalog(mount);
    const cart = buildCart(lines, catalog, mount);
    const items = (cart.items as any[]).map((i) => ({
      itemId: String(i.variant_id ?? i.id),
      productName: String(i.product_title ?? ""),
      variantTitle: i.variant_title ?? null,
      sku: i.sku ?? null,
      imageUrl: i.image ? String(i.image) : null,
      // The React checkout works in decimal currency; Liquid works in minor units.
      price: Number(i.price) / 100,
      quantity: Number(i.quantity),
      maxAvailable: Number((i.variant as any)?.inventory_quantity ?? 99),
    }));
    return html(checkoutBridge(items, mount));
  }

  const fresh = query.fresh === "1";
  const inspect = query.inspect === "1";
  const res = await renderStorefront({
    themeId,
    mount,
    path,
    query,
    cartLines: lines,
    fresh,
    shopName,
    inspect,
  });
  // Inject the language toggle + Arabic translation, plus a stock guard that
  // caps every quantity stepper to live stock, on every page.
  const stockGuard = await stockGuardScript(mount, path, lines);
  const inject = `${stockGuard}${localizationScript(mount)}`;
  const withLoc = res.html.includes("</body>")
    ? res.html.replace(/<\/body>/i, `${inject}</body>`)
    : res.html + inject;
  // Safety net: a linked/object setting printed directly by the theme renders as
  // the literal "[object Object]". A shopper must never see that — strip it.
  const clean = withLoc
    .replace(/\[object Object\]/g, "")
    // Perf: lazy-load + async-decode any image the theme didn't already flag, so
    // image-heavy pages stop blocking on every full-size image up front.
    .replace(/<img (?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
  return html(clean, res.status);
}

// ---- POST -------------------------------------------------------------------
export async function handleStorefrontPost(
  req: Request,
  config: MountConfig,
): Promise<Response> {
  try {
    return await storefrontPost(req, config);
  } catch (e) {
    return crashPage(e);
  }
}

async function storefrontPost(req: Request, config: MountConfig): Promise<Response> {
  const { mount } = config;
  const { path } = pathAndQuery(req, mount);

  // On-the-fly translation proxy for the injected Arabic translator.
  if (path === "/translate") {
    let payload: { q?: unknown } = {};
    try { payload = (await req.json()) as { q?: unknown }; } catch {}
    const q = Array.isArray(payload.q) ? payload.q.filter((s): s is string => typeof s === "string").slice(0, 60) : [];
    return json({ t: await translateBatch(q, "ar") });
  }
  // Theme's native language switcher (Shopify posts here) — set the locale cookie.
  if (path === "/localization") {
    const fd = await req.formData().catch(() => null);
    const code = String(fd?.get("locale_code") ?? fd?.get("locale") ?? "").toLowerCase();
    const loc = code.startsWith("ar") ? "ar" : "en";
    const back = String(fd?.get("return_to") ?? req.headers.get("referer") ?? `${mount}/`);
    return new Response(null, {
      status: 303,
      headers: { Location: back, "Set-Cookie": `sf_locale=${loc}; Path=/; Max-Age=31536000; SameSite=Lax` },
    });
  }

  const lines = readCart(req);

  const ajax = path.endsWith(".js") || path.endsWith(".json");
  const contentType = req.headers.get("content-type") ?? "";

  // Read the body as either JSON or form data.
  let body: Record<string, any> = {};
  let updatesList: string[] = [];
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, any>;
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        if (k === "updates[]") updatesList.push(String(v));
        else body[k] = typeof v === "string" ? v : String(v);
      }
      if (!updatesList.length) {
        // Shopify also accepts updates[<variant id>]=<qty>
        for (const [k, v] of fd.entries()) {
          const m = k.match(/^updates\[(.+)\]$/);
          if (m) body[`__update_${m[1]}`] = String(v);
        }
      }
    }
  } catch {
    body = {};
  }

  const base = path.replace(/\.(js|json)$/, "");
  let next = lines;

  const catalogFor = async () => getStorefrontCatalog(mount);

  if (base === "/cart/add") {
    const id = String(body.id ?? body.items?.[0]?.id ?? "");
    const qty = Number(body.quantity ?? body.items?.[0]?.quantity ?? 1) || 1;
    // Multi-item AJAX add.
    if (Array.isArray(body.items) && body.items.length) {
      for (const it of body.items) {
        const iid = String(it?.id ?? "");
        if (iid) next = addLine(next, iid, Number(it?.quantity) || 1);
      }
    } else if (id) {
      next = addLine(next, id, qty);
    }
    const catalog = await catalogFor();
    const wanted = next.find((l) => l.id === id)?.quantity ?? 0;
    next = clampLinesToStock(catalog, next);
    const cookie = cartCookie(next);
    if (ajax) {
      const cart = cartJson(buildCart(next, catalog, mount));
      const added = (cart.items as any[]).find((i) => String(i.id) === id) ?? null;
      const got = next.find((l) => l.id === id)?.quantity ?? 0;
      // Sold out, or already at the stock ceiling → Shopify-style 422 so the
      // theme shows an "out of stock" message instead of silently overselling.
      if (id && wanted > 0 && got === 0) {
        return json(
          { status: 422, message: "Sold out", description: "Sorry, this item is out of stock." },
          422,
          cookie,
        );
      }
      return json(added ?? cart, 200, cookie);
    }
    return redirect(`${mount}/cart`, cookie);
  }

  if (base === "/cart/change") {
    const qty = Number(body.quantity ?? 0) || 0;
    let id = body.id ? String(body.id) : null;
    if (!id && body.line) id = lineIdAt(lines, Number(body.line) || 0);
    if (id) next = setLine(next, id, qty);
    const catalog = await catalogFor();
    next = clampLinesToStock(catalog, next);
    const cookie = cartCookie(next);
    if (ajax) {
      return json(cartJson(buildCart(next, catalog, mount)), 200, cookie);
    }
    return redirect(`${mount}/cart`, cookie);
  }

  if (base === "/cart/clear") {
    const cookie = cartCookie([]);
    if (ajax) {
      const catalog = await catalogFor();
      return json(cartJson(buildCart([], catalog, mount)), 200, cookie);
    }
    return redirect(`${mount}/cart`, cookie);
  }

  // /cart/update and the cart page's own form (updates[] + checkout/update button)
  if (base === "/cart/update" || base === "/cart" || base === "") {
    if (updatesList.length) {
      updatesList.forEach((raw, i) => {
        const id = lineIdAt(lines, i + 1);
        if (id) next = setLine(next, id, Number(raw) || 0);
      });
    }
    for (const [k, v] of Object.entries(body)) {
      if (k.startsWith("__update_")) next = setLine(next, k.slice(9), Number(v) || 0);
    }
    if (body.updates && typeof body.updates === "object" && !Array.isArray(body.updates)) {
      for (const [id, v] of Object.entries(body.updates as Record<string, unknown>))
        next = setLine(next, id, Number(v) || 0);
    }
    const catalog = await catalogFor();
    next = clampLinesToStock(catalog, next);
    const cookie = cartCookie(next);
    if (ajax) {
      return json(cartJson(buildCart(next, catalog, mount)), 200, cookie);
    }
    if (body.checkout !== undefined) return redirect(`${mount}/checkout`, cookie);
    return redirect(`${mount}/cart`, cookie);
  }

  // Any other posted form (newsletter, contact, …) — acknowledge and go back.
  return redirect(`${mount}${path === "/" ? "/" : path}`);
}
