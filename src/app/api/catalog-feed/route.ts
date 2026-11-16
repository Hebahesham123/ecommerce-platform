import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { handleize } from "@/lib/storefront-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta Commerce Manager product feed (CSV), built live from the store's own products and stock.
 * Replaces the Supabase edge function supabase/functions/catalog-feed. Meta pulls this address on a
 * schedule:  https://<store address>/api/catalog-feed
 */
const BRAND = "Fashion Beauty Bar";
const CURRENCY = "EGP";

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Item = {
  id: string;
  product_name: string | null;
  variant_title: string | null;
  sku: string | null;
  category: string | null;
  price: number | string | null;
  status: string | null;
  image_url: string | null;
};

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return new Response("feed_error: not configured", { status: 503 });
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");
  try {
    const supabase = getServerSupabase();
    const items: Item[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id,product_name,variant_title,sku,category,price,status,image_url")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      items.push(...((data ?? []) as Item[]));
      if (!data || data.length < 1000) break;
    }
    const stock = new Map<string, number>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("inventory_levels").select("item_id,available").range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const l of data ?? []) {
        const id = String(l.item_id);
        stock.set(id, (stock.get(id) ?? 0) + (Number(l.available) || 0));
      }
      if (!data || data.length < 1000) break;
    }

    const cols = [
      "id", "title", "description", "availability", "condition", "price",
      "link", "image_link", "brand", "product_type", "quantity_to_sell_on_facebook",
    ];
    const rows = [cols.join(",")];
    for (const it of items) {
      // Same rule as the store: only active products with a price are on sale.
      if (!it.sku || (it.status ?? "active") !== "active" || !(Number(it.price) > 0)) continue;
      const qty = stock.get(it.id) ?? 0;
      const title = [it.product_name, it.variant_title].filter(Boolean).join(" - ");
      const desc = `${it.product_name ?? ""}${it.category ? " — " + it.category : ""} من ${BRAND}`;
      const link = `${site}/store/products/${encodeURIComponent(handleize(it.product_name))}`;
      rows.push(
        [
          it.sku, title, desc, qty > 0 ? "in stock" : "out of stock", "new",
          `${Number(it.price ?? 0).toFixed(2)} ${CURRENCY}`, link, it.image_url ?? "",
          BRAND, it.category ?? "", String(qty),
        ].map(cell).join(","),
      );
    }
    // Leading BOM so Arabic renders correctly in Meta and Excel.
    return new Response("﻿" + rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="catalog-feed.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`feed_error: ${(e as Error).message}`, { status: 500 });
  }
}
