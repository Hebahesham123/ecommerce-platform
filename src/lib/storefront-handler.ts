

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

/** A shared edge-cached page always ships the cart-LESS variant, so its cart
 *  badge reads empty. This tiny script re-syncs the common cart-count elements
 *  from /cart.js on load, so a returning shopper with items always sees the
 *  right count even on a cached shell — independent of whether the CDN honored
 *  our `Vary: Cookie`. It only ever rewrites numeric/empty badges, never rich
 *  markup, so it can't corrupt a theme's header. */
function cartCountSyncScript(mount: string): string {
  return `<script>(function(){try{
var M=${JSON.stringify(mount)};
fetch(M+'/cart.js',{headers:{accept:'application/json'},credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(c){
if(!c)return;var n=c.item_count||0;
var sel='[data-cart-count],[data-cart-item-count],.cart-count,.cart-count-bubble,.js-cart-count,.cart-link__bubble,.site-header__cart-count,.header__cart-count,#cart-icon-bubble .cart-count-bubble';
var els=document.querySelectorAll(sel);
for(var i=0;i<els.length;i++){var e=els[i];var t=(e.textContent||'').trim();
if(e.children.length===0&&(t===''||/^[0-9]+$/.test(t)))e.textContent=String(n);
if(n>0){e.removeAttribute&&e.removeAttribute('hidden');e.classList&&e.classList.remove('hidden','visually-hidden');}}
try{document.dispatchEvent(new CustomEvent('cart:refresh',{bubbles:true,detail:{cart:c}}));}catch(_e){}
}).catch(function(){});
}catch(_e){}})();</script>`;
}

// ---- Image optimization -----------------------------------------------------
// Next's image optimizer returns HTTP 400 for any `w` that isn't one of the
// widths in `images.deviceSizes ∪ images.imageSizes`. next.config.mjs doesn't
// override those, so these are Next's defaults. EVERY `w` we hand to
// /_next/image must be snapped onto this list or the image fails to load.
const NEXT_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048];
/** Round a requested width UP to the nearest width Next will actually serve. */
function snapWidth(w: number): number {
  for (const allowed of NEXT_WIDTHS) if (allowed >= w) return allowed;
  return NEXT_WIDTHS[NEXT_WIDTHS.length - 1];
}

/** Route a Supabase-hosted raster image through Next's optimizer (WebP + resize).
 *  Non-Supabase, non-raster, SVG and data: URLs are left untouched. */
function optimizeUrl(src: string, w = 1200): string {
  if (!/^https?:\/\//i.test(src)) return src;
  let host = "";
  try {
    host = new URL(src).host;
  } catch {
    return src;
  }
  if (/\.(svg|gif)(\?|$)/i.test(src)) return src; // don't touch vector/animated
  if (src.replace(/\?.*$/, "").endsWith("/")) return src; // empty/directory URL
  // Shopify's CDN resizes and serves WebP itself (via the Accept header), so
  // just ask it for the right width — no Vercel optimizer cost. (1115KB PNG ->
  // ~112KB WebP measured.)
  if (/(^|\.)shopify\.com$/i.test(host)) {
    if (/[?&]width=/i.test(src)) return src; // already sized
    return src + (src.includes("?") ? "&" : "?") + "width=" + w;
  }
  // Merchant uploads on Supabase go through Next's optimizer -> WebP. The width
  // MUST be one Next allows, else it 400s and the image never loads.
  if (/(^|\.)supabase\.co$/i.test(host)) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${snapWidth(w)}&q=75`;
  }
  return src;
}

/** Width a `srcset` descriptor asks for (`600w` → 600, `2x` → ~2× a base).
 *  Capped so we never encode anything larger than a full-bleed hero. */
function descriptorWidth(descriptor: string): number {
  const w = /^(\d+)w$/i.exec(descriptor);
  if (w) return Math.min(1600, Math.max(64, parseInt(w[1], 10)));
  const x = /^(\d+(?:\.\d+)?)x$/i.exec(descriptor);
  if (x) return Math.min(1600, Math.round(parseFloat(x[1]) * 800));
  return 1200;
}

/** Optimize every candidate URL in a `srcset`, sized to its own descriptor.
 *  The uploaded themes emit a `srcset` whose entries all point at the SAME
 *  full-size image (their `image_url: width:` filter ignores the width), so the
 *  descriptors were a lie. Re-encoding each candidate at the width it claims
 *  makes the `srcset` honest — the browser, guided by the theme's own layout
 *  `sizes`, now downloads a right-sized WebP instead of the full raster. */
function optimizeSrcset(value: string): string {
  return value
    .split(",")
    .map((part) => {
      const seg = part.trim();
      if (!seg) return "";
      let url = seg;
      let descriptor = "";
      const sp = seg.lastIndexOf(" ");
      if (sp > 0 && /^\d+(?:\.\d+)?[wx]$/i.test(seg.slice(sp + 1).trim())) {
        url = seg.slice(0, sp).trim();
        descriptor = seg.slice(sp + 1).trim();
      }
      const opt = optimizeUrl(url, descriptorWidth(descriptor));
      return descriptor ? `${opt} ${descriptor}` : opt;
    })
    .filter(Boolean)
    .join(", ");
}

/** Rewrite every <img> in rendered HTML to serve optimized WebP: the `src` and,
 *  crucially, each `srcset` candidate at its own width. The theme's `sizes`
 *  attribute is preserved so responsive selection stays layout-correct. */
function optimizeImages(html: string): string {
  let out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag;
    const m = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
    if (m) {
      const opt = optimizeUrl(m[1]);
      if (opt !== m[1]) t = t.replace(/\ssrc\s*=\s*["'][^"']+["']/i, ` src="${opt}"`);
    }
    // Keep (don't strip) srcset/sizes — re-point each srcset URL at an optimized,
    // correctly-sized WebP so the responsive image machinery actually pays off.
    t = t.replace(/\ssrcset\s*=\s*["']([^"']*)["']/i, (_m, val: string) => {
      const next = optimizeSrcset(val);
      return next ? ` srcset="${next}"` : "";
    });
    return t;
  });

  // A theme that preloads its hero still names the ORIGINAL file, while the
  // <img> above now points at the optimizer. Left alone the browser fetches the
  // largest image on the page twice — once full size for a preload nothing
  // consumes, then again optimized — which delays LCP and is what Chrome warns
  // about ("preloaded ... but not used within a few seconds").
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']preload["']/i.test(tag)) return tag;
    if (!/\bas\s*=\s*["']image["']/i.test(tag)) return tag;
    const m = tag.match(/\shref\s*=\s*["']([^"']+)["']/i);
    if (!m) return tag;
    const opt = optimizeUrl(m[1]);
    let t = opt === m[1] ? tag : tag.replace(/\shref\s*=\s*["'][^"']+["']/i, ` href="${opt}"`);
    // The <img> now keeps an optimized srcset, so optimize the preload's
    // imagesrcset the same way (and leave imagesizes as authored). The preloaded
    // resource then matches exactly what the browser selects — no double fetch.
    t = t.replace(/\simagesrcset\s*=\s*["']([^"']*)["']/i, (_m, val: string) => {
      const next = optimizeSrcset(val);
      return next ? ` imagesrcset="${next}"` : "";
    });
    return t;
  });

  // <picture> sources bypass the <img> rewrite entirely and would win over it.
  out = out.replace(/<source\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\ssrcset\s*=\s*["']([^"']+)["']/i);
    if (!m) return tag;
    const next = m[1]
      .split(",")
      .map((part) => {
        const t = part.trim();
        if (!t) return t;
        const [url, ...rest] = t.split(/\s+/);
        return [optimizeUrl(url), ...rest].join(" ");
      })
      .join(", ");
    return next === m[1]
      ? tag
      : tag.replace(/\ssrcset\s*=\s*["'][^"']+["']/i, ` srcset="${next}"`);
  });

  return out;
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
function clamp(input,silent){if(!isQty(input))return;var cap=capFor(input);if(cap===Infinity){setPlus(input,false);return;}input.setAttribute('max',cap<1?1:cap);var v=parseInt(input.value||'1',10);if(isNaN(v))v=1;if(v>cap){input.value=(cap<1?1:cap);v=(cap<1?1:cap);if(!silent)note(input,cap);}capDisplays(findWrap(input),cap);setPlus(input,v>=cap);}
function guardInput(input){if(input.__bbG)return;input.__bbG=1;var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(!d||!d.set)return;try{Object.defineProperty(input,'value',{configurable:true,get:function(){return d.get.call(this);},set:function(v){var cap=capFor(this);var num=parseInt(v,10);if(!isNaN(num)&&cap!==Infinity&&num>cap){v=(cap<1?1:cap);note(this,cap);}d.set.call(this,v);}});}catch(e){}}
function plusHit(t){if(!t.getAttribute)return false;var s=((t.getAttribute('name')||'')+' '+(t.getAttribute('data-action')||'')+' '+(t.className||'')+' '+(t.getAttribute('aria-label')||'')).toLowerCase();if(/plus|increase|increment|qty-up|quantity-up/.test(s))return true;return (t.textContent||'').replace(/\\s/g,'')==='+';}
function findPlus(input){var wrap=(input.closest&&(input.closest('.quantity')||input.closest('[class*=quantity]')||input.closest('[class*=qty]')))||input.parentElement;if(!wrap)return null;var c=wrap.querySelectorAll('button,a,[role="button"],span,div,input[type="button"],input[type="submit"]');for(var i=0;i<c.length;i++){if(plusHit(c[i]))return c[i];}return null;}
function setPlus(input,off){var p=findPlus(input);if(!p)return;if(off){if(p.__bbOff)return;p.__bbOff=1;p.style.opacity='0.35';p.style.pointerEvents='none';p.style.cursor='not-allowed';p.setAttribute('aria-disabled','true');if(p.tagName==='BUTTON'||p.tagName==='INPUT')p.disabled=true;}else{if(!p.__bbOff)return;p.__bbOff=0;p.style.opacity='';p.style.pointerEvents='';p.style.cursor='';p.removeAttribute('aria-disabled');if(p.tagName==='BUTTON'||p.tagName==='INPUT')p.disabled=false;}}
function findWrap(input){return (input.closest&&(input.closest('.quantity')||input.closest('[class*=quantity]')||input.closest('[class*=qty]')))||input.parentElement;}
function capDisplays(wrap,cap){if(!wrap)return;var els=wrap.querySelectorAll('*');for(var i=0;i<els.length;i++){var e=els[i];if(e.tagName==='INPUT'||e.tagName==='TEXTAREA')continue;if(e.children&&e.children.length)continue;var tx=(e.textContent||'').trim();if(/^[0-9]+$/.test(tx)){var n=parseInt(tx,10);if(n>cap)e.textContent=String(cap<1?1:cap);}}}
/* This theme's product stepper: #qty-plus / #qty-minus, visible #qty-display,
   hidden #pdp-qty, variant in #pdp-variant-id — all in separate containers. */
function pdpCap(){var vid=document.getElementById('pdp-variant-id');if(vid&&vid.value&&S[vid.value]!=null)return S[vid.value];if(window.__BB_PAGE_MAX__!=null)return window.__BB_PAGE_MAX__;return Infinity;}
function pdpPlus(off){var p=document.getElementById('qty-plus');if(!p)return;p.style.opacity=off?'0.35':'';p.style.pointerEvents=off?'none':'';p.style.cursor=off?'not-allowed':'';if(off)p.setAttribute('aria-disabled','true');else p.removeAttribute('aria-disabled');}
function pdpGuard(){var disp=document.getElementById('qty-display');var qin=document.getElementById('pdp-qty');if(!disp&&!qin)return;var cap=pdpCap();if(cap===Infinity){pdpPlus(false);return;}var cur=parseInt((disp?disp.textContent:(qin?qin.value:'1'))||'1',10);if(isNaN(cur))cur=1;if(cur>cap){cur=(cap<1?1:cap);if(disp)disp.textContent=String(cur);if(qin)qin.value=String(cur);note(disp||qin,cap);}else if(qin&&disp&&qin.value!==disp.textContent){qin.value=disp.textContent;}pdpPlus(cur>=cap);}
/* This theme's cart line stepper: button.qty-btn[data-qty-change] with
   data-key=variant id, visible count in <span data-qty>. */
function cartGuard(){var bs=document.querySelectorAll('[data-qty-change]');for(var i=0;i<bs.length;i++){var b=bs[i];var chg=parseInt(b.getAttribute('data-qty-change'),10)||0;if(chg<=0)continue;var key=b.getAttribute('data-key')||'';var cap=(key&&S[key]!=null)?S[key]:Infinity;if(cap===Infinity)continue;var grp=(b.closest&&(b.closest('.cart-item__qty')||b.closest('[class*=qty]')))||b.parentElement;var disp=grp&&grp.querySelector('[data-qty]');var cur=disp?parseInt((disp.textContent||'').trim(),10):NaN;if(isNaN(cur))cur=1;if(cur>cap){cur=(cap<1?1:cap);if(disp)disp.textContent=String(cur);note(disp||b,cap);}var off=cur>=cap;b.style.opacity=off?'0.35':'';b.style.pointerEvents=off?'none':'';b.style.cursor=off?'not-allowed':'';if(off)b.setAttribute('aria-disabled','true');else b.removeAttribute('aria-disabled');}}
document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"],span,div,input');if(!t||!plusHit(t))return;var wrap=(t.closest&&(t.closest('.quantity')||t.closest('[class*=quantity]')||t.closest('[class*=qty]')))||t.parentElement;var input=wrap&&(wrap.querySelector('input[type=number]')||wrap.querySelector('input[name=quantity]')||wrap.querySelector('input[name^=updates]')||wrap.querySelector('input[class*=quantity]'));if(!input||!isQty(input))return;var cap=capFor(input);if(cap===Infinity)return;var cur=parseInt(input.value||'1',10);if(isNaN(cur))cur=1;if(cur>=cap){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();note(input,cap);}},true);
document.addEventListener('click',function(e){var p=e.target&&e.target.closest&&e.target.closest('#qty-plus');if(!p)return;var cap=pdpCap();if(cap===Infinity)return;var disp=document.getElementById('qty-display');var qin=document.getElementById('pdp-qty');var cur=parseInt((disp?disp.textContent:(qin?qin.value:'1'))||'1',10);if(isNaN(cur))cur=1;if(cur>=cap){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();note(disp||qin,cap);pdpPlus(true);}},true);
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-qty-change]');if(!b)return;var chg=parseInt(b.getAttribute('data-qty-change'),10)||0;if(chg<=0)return;var key=b.getAttribute('data-key')||'';var cap=(key&&S[key]!=null)?S[key]:Infinity;if(cap===Infinity)return;var grp=(b.closest&&(b.closest('.cart-item__qty')||b.closest('[class*=qty]')))||b.parentElement;var disp=grp&&grp.querySelector('[data-qty]');var cur=disp?parseInt((disp.textContent||'').trim(),10):NaN;if(isNaN(cur))cur=1;if(cur>=cap){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();note(disp||b,cap);}},true);
['input','change'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.tagName==='INPUT')clamp(e.target,ev==='input');},true);});
var pend=false;function scan(){pend=false;var ns=document.querySelectorAll('input[type=number],input[name=quantity],input[name^=updates],input[class*=quantity]');for(var i=0;i<ns.length;i++){if(isQty(ns[i]))guardInput(ns[i]);clamp(ns[i],true);}pdpGuard();cartGuard();}
function schedule(){if(pend)return;pend=true;(window.requestAnimationFrame||setTimeout)(scan);}
function loadProductStock(){var p=location.pathname,i=p.indexOf('/products/');if(i<0)return;var h=p.slice(i+10);var sl=h.indexOf('/');if(sl>=0)h=h.slice(0,sl);h=(h.split('?')[0]||'').split('#')[0];if(!h)return;fetch(MOUNT+'/products/'+h+'.js',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(pr){if(!pr||!pr.variants||!pr.variants.length)return;var mins=[],all=true;pr.variants.forEach(function(v){var tracked=v.inventory_management==='shopify';if(tracked){var q=Math.max(0,parseInt(v.inventory_quantity,10)||0);S[String(v.id)]=q;mins.push(q);}else{S[String(v.id)]=null;all=false;}});if(all&&mins.length)window.__BB_PAGE_MAX__=Math.min.apply(null,mins);scan();}).catch(function(){});}
loadProductStock();
if(document.readyState!=='loading')scan();else document.addEventListener('DOMContentLoaded',scan);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setInterval(scan,150);
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
  /**
   * Allow the CDN to cache shared, non-personalized responses at the edge.
   * Only the *public* storefront sets this — the admin theme preview must never
   * cache, so a merchant always sees their edits instantly.
   */
  edgeCache?: boolean;
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

// ---- Cache policy -----------------------------------------------------------
export const NO_STORE = "no-store";
// Shared, catalog-derived responses (product JSON, recommendations, search
// suggestions): identical for every shopper, so cache them at the edge. A short
// fresh window keeps stock/price current (matching the 120s catalog cache);
// stale-while-revalidate keeps TTFB instant by serving the stale copy while a
// fresh one is fetched in the background.
export const PUBLIC_SHARED = "public, s-maxage=30, stale-while-revalidate=300";

function html(body: string, status = 200, cookie?: string, cache = NO_STORE): Response {
  // Never let a response that sets a cookie be shared-cached.
  const cc = cookie ? NO_STORE : cache;
  const headers: Record<string, string> = {
    "Content-Type": HTML,
    "Cache-Control": cc,
  };
  if (cc !== NO_STORE) headers["Vary"] = "Cookie";
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(body, { status, headers });
}

function json(data: unknown, status = 200, cookie?: string, cache = NO_STORE): Response {
  const cc = cookie ? NO_STORE : cache;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cc,
  };
  if (cc !== NO_STORE) headers["Vary"] = "Cookie";
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
/**
 * Resolve a `return_to` param to a same-origin path under the mount.
 *
 * Only plain relative paths are honoured ("/checkout"), never a scheme or a
 * protocol-relative "//evil.com" — otherwise the cart link becomes an open
 * redirect. Returns null when the value can't be trusted.
 */
function safeReturnTo(raw: string, mount: string): string | null {
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  return v.startsWith(mount) ? v : `${mount}${v}`;
}

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
  // Cache policy for catalog-derived, non-personalized responses. Off (no-store)
  // for the admin preview, which must always reflect unsaved edits.
  const shared = config.edgeCache ? PUBLIC_SHARED : NO_STORE;

  // The theme's "Buy it now" is a plain link, not a form post:
  //   GET /cart/add?id=<variant>&quantity=1&return_to=/checkout
  // Add the line, then honour return_to so the shopper lands on checkout
  // rather than the cart page.
  if (path === "/cart/add") {
    const id = String(query.id ?? "");
    const qty = Math.max(1, Number(query.quantity ?? 1) || 1);
    const catalog = await getStorefrontCatalog(mount);
    const next = clampLinesToStock(catalog, id ? addLine(lines, id, qty) : lines);
    const cookie = cartCookie(next);
    // Sold out or already at the stock ceiling → show the cart, not an empty
    // checkout, so the shopper sees what actually happened.
    const added = next.find((l) => l.id === id)?.quantity ?? 0;
    if (id && added === 0) return redirect(`${mount}/cart`, cookie);
    const dest = safeReturnTo(String(query.return_to ?? ""), mount);
    return redirect(dest ?? `${mount}/cart`, cookie);
  }

  // --- Shopify AJAX / JSON endpoints ---------------------------------------
  if (path === "/cart.js" || path === "/cart.json") {
    // Personalized (this shopper's cart) — never share-cache.
    const catalog = await getStorefrontCatalog(mount);
    return json(cartJson(buildCart(lines, catalog, mount)));
  }

  if (path.startsWith("/products/") && path.endsWith(".js")) {
    const handle = path.slice("/products/".length, -3);
    const catalog = await getStorefrontCatalog(mount);
    const product = catalog.productByHandle.get(handle);
    if (!product) return json({ error: "not_found" }, 404);
    return json(product, 200, undefined, shared);
  }

  // Predictive (typeahead) search: return real matching products so the theme's
  // search dropdown populates as the shopper types.
  if (path === "/search/suggest") {
    const terms = String(query.q ?? "").trim();
    if (!terms) return html('<div class="predictive-search"></div>', 200, undefined, shared);
    const catalog = await getStorefrontCatalog(mount);
    const results = searchProducts(catalog, terms).slice(0, 8);
    return html(predictiveSearchHtml(results, mount, terms), 200, undefined, shared);
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
      // Raw URLs: the bundle widget applies its own `_300x300` sizing.
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
    return json({ products: recs }, 200, undefined, shared);
  }
  if (path.startsWith("/recommendations/")) {
    return html('<div class="predictive-search"></div>', 200, undefined, shared);
  }

  // --- Checkout handoff to the existing COD flow ---------------------------
  if (path === "/checkout" || path === "/cart/checkout") {
    // /store/checkout reads the same sf_cart cookie server-side, so we can hand
    // straight over — no interstitial page copying the cart into localStorage.
    if (!lines.length) return redirect(`${mount}/cart`);
    return redirect("/store/checkout");
  }

  const fresh = query.fresh === "1";
  const inspect = query.inspect === "1";

  /**
   * Catalogue pages hold nothing specific to a shopper: locale and customer are
   * applied client-side, the cart badge is hydrated from /cart.js, and the only
   * other cart trace was the stock map below listing the cart's variants.
   * Rendering them with an empty cart makes the bytes identical for everyone,
   * which is what lets a shared CDN serve them instead of the origin.
   *
   * Cart, checkout and account genuinely differ per shopper and stay private.
   */
  const shopperSpecific =
    /^\/(cart|checkout|account)(?:[/?#]|$)/i.test(path) || inspect || fresh;
  const cacheable = !shopperSpecific;
  const renderLines = cacheable ? [] : lines;

  const res = await renderStorefront({
    themeId,
    mount,
    path,
    query,
    cartLines: renderLines,
    fresh,
    shopName,
    inspect,
  });
  // Inject the language toggle + Arabic translation, plus a stock guard that
  // caps every quantity stepper to live stock, on every page.
  const stockGuard = await stockGuardScript(mount, path, renderLines);
  // Catalogue pages are rendered cart-LESS so they can be shared-cached; re-sync
  // the cart badge from /cart.js so a returning shopper still sees their real
  // item count. Only on the public storefront (the admin preview isn't cached).
  const cartSync = config.edgeCache ? cartCountSyncScript(mount) : "";
  const inject = `${stockGuard}${localizationScript(mount)}${cartSync}`;
  const withLoc = res.html.includes("</body>")
    ? res.html.replace(/<\/body>/i, `${inject}</body>`)
    : res.html + inject;
  // Safety net: a linked/object setting printed directly by the theme renders as
  // the literal "[object Object]". A shopper must never see that — strip it.
  const clean = optimizeImages(
    withLoc
      .replace(/\[object Object\]/g, "")
      // Perf: lazy-load + async-decode any image the theme didn't already flag,
      // so image-heavy pages stop blocking on every full-size image up front.
      .replace(/<img (?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" '),
  );

  return new Response(clean, {
    status: res.status,
    headers: {
      "Content-Type": HTML,
      // stale-while-revalidate is what makes this fast: the edge always answers
      // immediately and refreshes in the background, so s-maxage governs how
      // stale a page may be, NOT how fast it is served. That makes a short
      // window nearly free — 15s instead of 60s costs no perceived speed and
      // means a price or stock edit reaches shoppers four times sooner.
      //
      // The matching browser max-age lets a prefetched page be reused on click
      // without a revalidation round trip, which is what makes navigation feel
      // instant. It also bounds how long one shopper can hold a stale price.
      "Cache-Control": cacheable
        ? "public, max-age=15, s-maxage=15, stale-while-revalidate=86400"
        : "private, no-store",
    },
  });
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
    // "Buy it now" posts the same product form with checkout=1 — skip the cart
    // page and go straight to checkout. If the line was clamped away (sold out
    // or already at the stock ceiling) fall back to the cart so the shopper
    // sees what actually happened instead of an empty checkout.
    const addedQty = next.find((l) => l.id === id)?.quantity ?? 0;
    if (body.checkout !== undefined && (!id || addedQty > 0)) {
      return redirect(`${mount}/checkout`, cookie);
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
