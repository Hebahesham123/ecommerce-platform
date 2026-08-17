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

  // Predictive search / recommendations: themes fetch these and inject the
  // HTML. Serving an empty, valid document keeps them from erroring.
  if (path === "/search/suggest" || path.startsWith("/recommendations/")) {
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
  return toResponse(res);
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
    const cookie = cartCookie(next);
    if (ajax) {
      const catalog = await catalogFor();
      const cart = cartJson(buildCart(next, catalog, mount));
      const added = (cart.items as any[]).find((i) => String(i.id) === id) ?? null;
      return json(added ?? cart, 200, cookie);
    }
    return redirect(`${mount}/cart`, cookie);
  }

  if (base === "/cart/change") {
    const qty = Number(body.quantity ?? 0) || 0;
    let id = body.id ? String(body.id) : null;
    if (!id && body.line) id = lineIdAt(lines, Number(body.line) || 0);
    if (id) next = setLine(next, id, qty);
    const cookie = cartCookie(next);
    if (ajax) {
      const catalog = await catalogFor();
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
    const cookie = cartCookie(next);
    if (ajax) {
      const catalog = await catalogFor();
      return json(cartJson(buildCart(next, catalog, mount)), 200, cookie);
    }
    if (body.checkout !== undefined) return redirect(`${mount}/checkout`, cookie);
    return redirect(`${mount}/cart`, cookie);
  }

  // Any other posted form (newsletter, contact, …) — acknowledge and go back.
  return redirect(`${mount}${path === "/" ? "/" : path}`);
}
