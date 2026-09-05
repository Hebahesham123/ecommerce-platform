/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Resolve a client's cart against the live catalogue.
 *
 * An app holds its cart on the device, so it arrives here as nothing but ids
 * and quantities — which is the only safe shape. Every price, title and stock
 * ceiling is read from the database on each call, so a cart that sat on a
 * phone for a week cannot check out at last week's price, and a tampered one
 * cannot invent its own.
 */

export type CartRequestLine = { itemId: string; quantity: number };

export type PricedLine = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
  /** True when the requested quantity had to be reduced or dropped. */
  adjusted: boolean;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  itemCount: number;
  /** Lines that no longer exist or are sold out, so the app can say so. */
  removed: string[];
};

export async function priceCart(requested: CartRequestLine[]): Promise<PricedCart> {
  const empty: PricedCart = { lines: [], subtotal: 0, itemCount: 0, removed: [] };
  const wanted = requested.filter((l) => l.itemId && l.quantity > 0).slice(0, 100);
  if (!wanted.length || !isSupabaseConfigured()) return empty;

  const { data, error } = await getServerSupabase()
    .from("inventory_items")
    .select("id,product_name,variant_title,sku,image_url,price,tracked,status,inventory_levels(on_hand,committed)")
    .in(
      "id",
      wanted.map((l) => l.itemId),
    );
  if (error || !data) return empty;

  const byId = new Map(data.map((r: any) => [String(r.id), r]));
  const lines: PricedLine[] = [];
  const removed: string[] = [];

  for (const want of wanted) {
    const r: any = byId.get(want.itemId);
    // Deleted, unpublished, or never priced — all of them mean "not for sale".
    if (!r || String(r.status ?? "active") !== "active" || !(Number(r.price) > 0)) {
      removed.push(want.itemId);
      continue;
    }

    const available = (r.inventory_levels ?? []).reduce(
      (s: number, l: any) => s + Math.max(0, Number(l.on_hand ?? 0) - Number(l.committed ?? 0)),
      0,
    );
    const tracked = r.tracked !== false;
    const cap = tracked ? available : want.quantity;
    const quantity = Math.min(want.quantity, cap);
    if (quantity <= 0) {
      removed.push(want.itemId);
      continue;
    }

    lines.push({
      itemId: String(r.id),
      productName: String(r.product_name ?? ""),
      variantTitle:
        r.variant_title && r.variant_title !== "Default Title" ? String(r.variant_title) : null,
      sku: r.sku ?? null,
      imageUrl: r.image_url ? String(r.image_url) : null,
      price: Number(r.price ?? 0),
      quantity,
      maxAvailable: tracked ? available : 99,
      adjusted: quantity !== want.quantity,
    });
  }

  return {
    lines,
    subtotal: Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    removed,
  };
}
