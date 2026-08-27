/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, parseCart } from "@/lib/storefront-cart";
import { getServerSupabase } from "@/lib/supabase/server";

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
export async function readThemeCartItems(): Promise<HandoffItem[]> {
  try {
    const raw = (await cookies()).get(CART_COOKIE)?.value;
    const lines = parseCart(raw);
    if (!lines.length) return [];

    // Resolve only the variants in the cart. Building the whole catalog here
    // meant fetching every product in the store to render one or two lines —
    // the single slowest step on the way to checkout.
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        "id,product_name,variant_title,sku,image_url,price,tracked," +
          "inventory_levels(on_hand,committed)",
      )
      .in(
        "id",
        lines.map((l) => l.id),
      );
    if (error || !data) return [];

    const byId = new Map(data.map((r: any) => [String(r.id), r]));
    const items: HandoffItem[] = [];

    for (const line of lines) {
      const r: any = byId.get(line.id);
      if (!r) continue; // variant deleted since it went in the cart

      // Same stock rule the storefront cart applies: untracked variants are
      // always sellable, tracked ones are capped at what is actually available.
      const available = (r.inventory_levels ?? []).reduce(
        (s: number, l: any) => s + Math.max(0, Number(l.on_hand ?? 0) - Number(l.committed ?? 0)),
        0,
      );
      const tracked = r.tracked !== false;
      const cap = tracked ? available : line.quantity;
      const quantity = Math.min(line.quantity, cap);
      if (quantity <= 0) continue; // sold out — drop rather than oversell

      items.push({
        itemId: String(r.id),
        productName: String(r.product_name ?? ""),
        variantTitle:
          r.variant_title && r.variant_title !== "Default Title" ? String(r.variant_title) : null,
        sku: r.sku ?? null,
        imageUrl: r.image_url ? String(r.image_url) : null,
        // Price is read from the database, never the cookie, so a tampered
        // cookie can't set one.
        price: Number(r.price ?? 0),
        quantity,
        maxAvailable: tracked ? available : 99,
      });
    }
    return items;
  } catch {
    // A missing theme / unreachable catalog must never break checkout — the
    // shopper's own localStorage cart still renders.
    return [];
  }
}
