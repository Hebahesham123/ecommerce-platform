// =============================================================================
// Supabase Edge Function: catalog-feed
// Returns a Meta Commerce Manager product feed (CSV) built live from
// inventory_items + inventory_levels. Meta pulls this URL on a schedule.
//
// Deploy PUBLIC (no JWT):  supabase functions deploy catalog-feed --no-verify-jwt
// Public URL: https://<your-project-ref>.supabase.co/functions/v1/catalog-feed
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---- Edit these two when your store goes live -------------------------------
const STORE_URL = "https://your-store.example.com"; // real domain later
const BRAND = "Fashion Beauty Bar";
const CURRENCY = "EGP";
// Placeholder image per product (swap for real photo URLs when ready).
const imageFor = (sku: string) =>
  `https://placehold.co/800x800/f5e1e6/8a3b53/png?text=${encodeURIComponent(sku)}`;
// -----------------------------------------------------------------------------

async function pg(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

Deno.serve(async () => {
  try {
    const items = await pg(
      "inventory_items?select=id,product_name,variant_title,sku,category,price",
    );
    const levels = await pg("inventory_levels?select=item_id,available");

    const stock = new Map<string, number>();
    for (const l of levels)
      stock.set(l.item_id, (stock.get(l.item_id) ?? 0) + (Number(l.available) || 0));

    const cols = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand", "product_type",
      "quantity_to_sell_on_facebook",
    ];
    const rows = [cols.join(",")];

    for (const it of items) {
      const qty = stock.get(it.id) ?? 0;
      const title = [it.product_name, it.variant_title].filter(Boolean).join(" - ");
      const desc = `${it.product_name}${it.category ? " — " + it.category : ""} من ${BRAND}`;
      rows.push([
        it.sku,
        title,
        desc,
        qty > 0 ? "in stock" : "out of stock",
        "new",
        `${Number(it.price).toFixed(2)} ${CURRENCY}`,
        `${STORE_URL}/products/${encodeURIComponent(it.sku)}`,
        imageFor(it.sku),
        BRAND,
        it.category ?? "",
        String(qty),
      ].map(cell).join(","));
    }

    // Leading BOM so Arabic renders correctly in Meta + Excel.
    const csv = "﻿" + rows.join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="catalog-feed.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`feed_error: ${(e as Error).message}`, { status: 500 });
  }
});
