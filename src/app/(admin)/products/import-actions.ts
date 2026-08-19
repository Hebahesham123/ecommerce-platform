"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { invalidateCatalog } from "@/lib/storefront-data";
import type { ImportRow } from "@/lib/product-import";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ImportSummary = {
  created: number;
  updated: number;
  failed: number;
  /** First few failures, so a bad sheet is debuggable without guesswork. */
  errors: string[];
};

/** Supabase rejects very large payloads; write in chunks. */
const CHUNK = 200;

function toRow(r: ImportRow) {
  return {
    product_name: r.productName.trim(),
    variant_title: r.variantTitle,
    sku: r.sku,
    barcode: r.barcode,
    category: r.category,
    vendor: r.vendor,
    product_type: r.productType,
    tags: r.tags,
    price: r.price,
    compare_at_price: r.compareAtPrice,
    cost: r.cost,
    image_url: r.imageUrl,
    images: r.images,
    status: r.status,
    tracked: true,
  };
}

/**
 * Write prepared spreadsheet rows into inventory.
 *
 * Each row becomes one inventory_item (a variant); rows sharing a product_name
 * group into one product everywhere else in the app. When a row carries a SKU
 * that already exists, it updates that item instead of creating a duplicate —
 * so re-importing a corrected sheet is safe.
 */
export async function importInventoryRows(
  rows: ImportRow[],
  opts: { locationId?: string | null; updateExisting?: boolean } = {},
): Promise<ActionResult<ImportSummary>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!rows.length) return { ok: true, data: { created: 0, updated: 0, failed: 0, errors: [] } };

  const summary: ImportSummary = { created: 0, updated: 0, failed: 0, errors: [] };
  const note = (msg: string) => {
    summary.failed++;
    if (summary.errors.length < 5) summary.errors.push(msg);
  };

  try {
    const supabase = getServerSupabase();

    // Where quantities land. Falls back to the default location.
    let locationId = opts.locationId ?? null;
    if (!locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("id")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      locationId = loc?.id ? String(loc.id) : null;
    }

    // Existing SKUs, so a re-import updates rather than duplicates.
    const skus = rows.map((r) => r.sku).filter((s): s is string => Boolean(s));
    const bySku = new Map<string, string>();
    if (opts.updateExisting !== false && skus.length) {
      for (let i = 0; i < skus.length; i += CHUNK) {
        const { data } = await supabase
          .from("inventory_items")
          .select("id, sku")
          .in("sku", skus.slice(i, i + CHUNK));
        for (const r of data ?? []) if (r.sku) bySku.set(String(r.sku), String(r.id));
      }
    }

    const toInsert: { row: ImportRow; payload: ReturnType<typeof toRow> }[] = [];
    const toUpdate: { id: string; row: ImportRow }[] = [];
    for (const r of rows) {
      const existing = r.sku ? bySku.get(r.sku) : undefined;
      if (existing) toUpdate.push({ id: existing, row: r });
      else toInsert.push({ row: r, payload: toRow(r) });
    }

    // ---- Inserts -----------------------------------------------------------
    const quantityById = new Map<string, number>();
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const slice = toInsert.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(slice.map((s) => s.payload))
        .select("id");
      if (error) {
        slice.forEach(() => note(error.message));
        continue;
      }
      (data ?? []).forEach((d, j) => {
        summary.created++;
        const qty = slice[j]?.row.quantity ?? 0;
        if (qty > 0) quantityById.set(String(d.id), qty);
      });
    }

    // ---- Updates -----------------------------------------------------------
    for (const { id, row } of toUpdate) {
      const { error } = await supabase.from("inventory_items").update(toRow(row)).eq("id", id);
      if (error) {
        note(`${row.sku}: ${error.message}`);
        continue;
      }
      summary.updated++;
      if (row.quantity > 0) quantityById.set(id, row.quantity);
    }

    // ---- Stock -------------------------------------------------------------
    // A trigger seeds a zero level per location on insert, so this sets the
    // starting quantity rather than creating the level row.
    if (locationId && quantityById.size) {
      for (const [itemId, qty] of quantityById) {
        const { error } = await supabase
          .from("inventory_levels")
          .update({ on_hand: qty })
          .eq("item_id", itemId)
          .eq("location_id", locationId);
        if (error) note(`stock for ${itemId}: ${error.message}`);
      }
    }

    invalidateCatalog();
    revalidatePath("/products");
    revalidatePath("/inventory");
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
