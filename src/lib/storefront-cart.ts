/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import type { Catalog, ProductDrop, VariantDrop } from "@/lib/storefront-data";

/**
 * A cookie-backed cart for theme-rendered pages.
 *
 * The cookie only stores `{ id, quantity }` pairs — every price, title and
 * image is re-read from the live catalog on render, so a price change in the
 * dashboard is reflected immediately and a stale cookie can never fake a price.
 */

export const CART_COOKIE = "sf_cart";
export const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type CartLine = { id: string; quantity: number };

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    const out: CartLine[] = [];
    for (const l of parsed) {
      const id = String((l as any)?.id ?? "");
      const quantity = Math.max(0, Math.min(999, Number((l as any)?.quantity) || 0));
      if (id && quantity > 0) out.push({ id, quantity });
    }
    return out.slice(0, 100);
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return encodeURIComponent(JSON.stringify(lines.filter((l) => l.quantity > 0)));
}

export function addLine(lines: CartLine[], id: string, quantity: number): CartLine[] {
  const qty = Math.max(1, Math.min(999, Math.floor(quantity) || 1));
  const next = lines.map((l) => ({ ...l }));
  const found = next.find((l) => l.id === id);
  if (found) found.quantity = Math.min(999, found.quantity + qty);
  else next.push({ id, quantity: qty });
  return next;
}

export function setLine(lines: CartLine[], id: string, quantity: number): CartLine[] {
  const qty = Math.max(0, Math.min(999, Math.floor(quantity) || 0));
  return lines
    .map((l) => (l.id === id ? { ...l, quantity: qty } : { ...l }))
    .filter((l) => l.quantity > 0);
}

/** Resolve a line index (Shopify's `line` param is 1-based) to a variant id. */
export function lineIdAt(lines: CartLine[], index: number): string | null {
  const l = lines[index - 1];
  return l ? l.id : null;
}

// ---- Liquid drop ------------------------------------------------------------
export type CartDrop = Record<string, unknown>;

export function buildCart(
  lines: CartLine[],
  catalog: Catalog,
  mount: string,
): CartDrop {
  const items: Record<string, unknown>[] = [];
  let total = 0;
  let originalTotal = 0;

  lines.forEach((line, i) => {
    const hit = catalog.variantById.get(line.id);
    if (!hit) return; // variant deleted in the dashboard → silently drop the line
    const { variant, product } = hit;
    // Never show / check out more than is in stock (tracked variants only).
    const tracked = variant.inventory_management === "shopify";
    const cap = tracked ? Math.max(0, Number(variant.inventory_quantity) || 0) : line.quantity;
    const qty = Math.min(line.quantity, cap);
    if (qty <= 0) return; // sold out → drop the line entirely
    const linePrice = variant.price * qty;
    const original =
      (variant.compare_at_price && variant.compare_at_price > variant.price
        ? variant.compare_at_price
        : variant.price) * qty;
    total += linePrice;
    originalTotal += original;

    const image = (variant.featured_image ?? product.featured_image) as unknown;
    items.push({
      id: variant.id,
      key: variant.id,
      line: i + 1,
      quantity: qty,
      title:
        variant.title && variant.title !== "Default Title"
          ? `${product.title} - ${variant.title}`
          : product.title,
      product_title: product.title,
      variant_title: variant.title === "Default Title" ? null : variant.title,
      product: product as unknown,
      variant: variant as unknown,
      product_id: product.id,
      variant_id: variant.id,
      sku: variant.sku,
      vendor: product.vendor,
      url: `${product.url}?variant=${variant.id}`,
      image,
      featured_image: image,
      price: variant.price,
      original_price: variant.price,
      final_price: variant.price,
      line_price: linePrice,
      original_line_price: original,
      final_line_price: linePrice,
      total_discount: 0,
      discounts: [],
      line_level_discount_allocations: [],
      line_level_total_discount: 0,
      properties: {},
      requires_shipping: true,
      taxable: true,
      gift_card: false,
      grams: 0,
      selling_plan_allocation: null,
    });
  });

  const count = items.reduce((s, i) => s + Number(i.quantity), 0);
  return {
    items,
    item_count: count,
    total_price: total,
    original_total_price: originalTotal,
    items_subtotal_price: total,
    total_discount: Math.max(0, originalTotal - total),
    cart_level_discount_applications: [],
    discount_applications: [],
    empty: items.length === 0,
    requires_shipping: items.length > 0,
    note: "",
    attributes: {},
    currency: catalog.shop.currency,
    checkout_url: `${mount}/checkout`,
    taxes_included: true,
  };
}

/** Shopify's /cart.js JSON shape (used by AJAX themes). */
export function cartJson(cart: CartDrop): Record<string, unknown> {
  return {
    token: "sf-cart",
    note: cart.note,
    attributes: cart.attributes,
    item_count: cart.item_count,
    items: (cart.items as Record<string, unknown>[]).map((i) => ({
      id: i.id,
      key: i.key,
      quantity: i.quantity,
      title: i.title,
      product_title: i.product_title,
      variant_title: i.variant_title,
      price: i.price,
      line_price: i.line_price,
      final_price: i.final_price,
      final_line_price: i.final_line_price,
      original_line_price: i.original_line_price,
      sku: i.sku,
      vendor: i.vendor,
      url: i.url,
      image: i.image ? String(i.image) : null,
      featured_image: { url: i.image ? String(i.image) : null, alt: i.product_title },
      properties: {},
      handle: (i.product as ProductDrop | undefined)?.handle ?? "",
      variant_id: (i.variant as VariantDrop | undefined)?.id ?? i.id,
      requires_shipping: true,
    })),
    total_price: cart.total_price,
    original_total_price: cart.original_total_price,
    items_subtotal_price: cart.items_subtotal_price,
    total_discount: cart.total_discount,
    requires_shipping: cart.requires_shipping,
    currency: cart.currency,
  };
}
