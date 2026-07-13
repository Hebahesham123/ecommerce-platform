"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type { InventoryItem, Level, Location } from "@/lib/inventory";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

const int = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v == null ? null : Number(v);
const str = (v: unknown): string | null => (v == null ? null : String(v));

// ---- Row <-> domain mapping -------------------------------------------------
function rowToLocation(r: Row): Location {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    code: str(r.code),
    address: str(r.address),
    city: str(r.city),
    governorate: str(r.governorate),
    country: String(r.country ?? "EG"),
    phone: str(r.phone),
    isActive: Boolean(r.is_active),
    isDefault: Boolean(r.is_default),
    fulfillsOnlineOrders: Boolean(r.fulfills_online_orders),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

function locationToRow(l: Location): Row {
  return {
    name: l.name.trim(),
    code: l.code?.trim() || null,
    address: l.address?.trim() || null,
    city: l.city?.trim() || null,
    governorate: l.governorate?.trim() || null,
    country: l.country?.trim() || "EG",
    phone: l.phone?.trim() || null,
    is_active: l.isActive,
    fulfills_online_orders: l.fulfillsOnlineOrders,
  };
}

function rowToLevel(r: Row): Level {
  const onHand = int(r.on_hand);
  const committed = int(r.committed);
  return {
    locationId: String(r.location_id),
    onHand,
    committed,
    incoming: int(r.incoming),
    available: r.available != null ? int(r.available) : onHand - committed,
  };
}

function rowToItem(r: Row): InventoryItem {
  const levels = Array.isArray(r.inventory_levels)
    ? (r.inventory_levels as Row[]).map(rowToLevel)
    : [];
  return {
    id: String(r.id),
    productName: String(r.product_name ?? ""),
    variantTitle: str(r.variant_title),
    sku: str(r.sku),
    barcode: str(r.barcode),
    category: str(r.category),
    price: numOrNull(r.price),
    cost: numOrNull(r.cost),
    tracked: Boolean(r.tracked),
    levels,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

function itemToRow(i: InventoryItem): Row {
  return {
    product_name: i.productName.trim(),
    variant_title: i.variantTitle?.trim() || null,
    sku: i.sku?.trim() || null,
    barcode: i.barcode?.trim() || null,
    category: i.category?.trim() || null,
    price: i.price,
    cost: i.cost,
    tracked: i.tracked,
  };
}

// =============================================================================
// Locations
// =============================================================================
export async function listLocations(): Promise<ActionResult<Location[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(rowToLocation) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createLocation(
  l: Location,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("locations")
      .insert(locationToRow(l))
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory/locations");
    revalidatePath("/inventory");
    return { ok: true, data: { id: String(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateLocation(
  id: string,
  l: Location,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("locations")
      .update(locationToRow(l))
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory/locations");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    // Guard: never leave the store with zero locations.
    const { count } = await supabase
      .from("locations")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) return { ok: false, error: "last_location" };
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory/locations");
    revalidatePath("/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Make one location the default; clears the flag on all others first. */
export async function setDefaultLocation(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    // Clear existing default (partial unique index forbids two defaults).
    const clr = await supabase
      .from("locations")
      .update({ is_default: false })
      .eq("is_default", true);
    if (clr.error) return { ok: false, error: clr.error.message };
    const { error } = await supabase
      .from("locations")
      .update({ is_default: true })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory/locations");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setLocationActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("locations")
      .update({ is_active: active })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory/locations");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Inventory items + levels
// =============================================================================
export async function listInventory(): Promise<ActionResult<InventoryItem[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*, inventory_levels(*)")
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(rowToItem) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createItem(
  item: InventoryItem,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert(itemToRow(item))
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    const id = String(data.id);
    // A DB trigger seeds a zero level per location; apply any provided starts.
    for (const lv of item.levels) {
      if (lv.onHand === 0 && lv.committed === 0 && lv.incoming === 0) continue;
      await supabase
        .from("inventory_levels")
        .update({
          on_hand: lv.onHand,
          committed: lv.committed,
          incoming: lv.incoming,
        })
        .eq("item_id", id)
        .eq("location_id", lv.locationId);
    }
    revalidatePath("/inventory");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateItem(
  id: string,
  item: InventoryItem,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("inventory_items")
      .update(itemToRow(item))
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteItem(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Set the stock of one item at one location. Upserts the level row so a
 * location added after the item still works. `available` is a generated
 * column, so we only write on_hand / committed / incoming.
 */
export async function setLevel(
  itemId: string,
  locationId: string,
  fields: { onHand?: number; committed?: number; incoming?: number },
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const patch: Row = {};
    if (fields.onHand != null) patch.on_hand = Math.max(0, Math.round(fields.onHand));
    if (fields.committed != null)
      patch.committed = Math.max(0, Math.round(fields.committed));
    if (fields.incoming != null)
      patch.incoming = Math.max(0, Math.round(fields.incoming));

    const { error } = await supabase
      .from("inventory_levels")
      .upsert(
        { item_id: itemId, location_id: locationId, ...patch },
        { onConflict: "item_id,location_id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
