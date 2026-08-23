/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, buildCart, parseCart } from "@/lib/storefront-cart";
import { getStorefrontCatalog } from "@/lib/theme-render-service";

/**
 * One cart line, shaped for the React checkout's cart (`CartItem`).
 *
 * Kept structurally identical rather than importing the client type, so this
 * server-only module never pulls a "use client" file into the server graph.
 */
export type HandoffItem = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
};

/**
 * Read the theme storefront's cookie cart and resolve it against the live
 * catalog, so /store/checkout can render a populated summary on the very first
 * paint when a shopper arrives from the theme's "Buy it now".
 *
 * This is what removes the old handoff: there is no interstitial page copying
 * the cart into localStorage, and therefore no empty first render to cover up.
 * Prices are re-read from the catalog here — a stale cookie can never set one.
 */
export async function readThemeCartItems(mount = "/shop"): Promise<HandoffItem[]> {
  try {
    const raw = (await cookies()).get(CART_COOKIE)?.value;
    const lines = parseCart(raw);
    if (!lines.length) return [];

    const catalog = await getStorefrontCatalog(mount);
    const cart = buildCart(lines, catalog, mount);

    return ((cart.items as any[]) ?? []).map((i) => ({
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
  } catch {
    // A missing theme / unreachable catalog must never break checkout — the
    // shopper's own localStorage cart still renders.
    return [];
  }
}
