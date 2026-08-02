"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  deriveStatus,
  type Discount,
  type DiscountStatus,
} from "@/lib/discounts";

// ---- Row <-> domain mapping -------------------------------------------------
type Row = Record<string, unknown>;

function rowToDiscount(r: Row): Discount {
  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Discount["appliesToIds"]) : []);

  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    method: r.method as Discount["method"],
    code: (r.code as string) ?? null,
    discountType: r.discount_type as Discount["discountType"],
    status: r.status as DiscountStatus,
    valueType: (r.value_type as Discount["valueType"]) ?? null,
    value: num(r.value),
    appliesTo: (r.applies_to as Discount["appliesTo"]) ?? "all",
    appliesToIds: arr(r.applies_to_ids),
    buyType: (r.buy_type as Discount["buyType"]) ?? null,
    buyValue: num(r.buy_value),
    buyItemScope: (r.buy_item_scope as Discount["buyItemScope"]) ?? null,
    buyItemIds: arr(r.buy_item_ids),
    getQuantity: num(r.get_quantity),
    getItemScope: (r.get_item_scope as Discount["getItemScope"]) ?? null,
    getItemIds: arr(r.get_item_ids),
    getValueType: (r.get_value_type as Discount["getValueType"]) ?? null,
    getValue: num(r.get_value),
    getIsFree: Boolean(r.get_is_free),
    maxUsesPerOrder: num(r.max_uses_per_order),
    shipCountries: arr(r.ship_countries),
    shipExcludeOverAmount: num(r.ship_exclude_over_amount),
    minRequirement: (r.min_requirement as Discount["minRequirement"]) ?? "none",
    minAmount: num(r.min_amount),
    minQuantity: num(r.min_quantity),
    eligibility: (r.eligibility as Discount["eligibility"]) ?? "all",
    eligibilityIds: arr(r.eligibility_ids),
    usageLimitTotal: num(r.usage_limit_total),
    usageLimitOncePerCustomer: Boolean(r.usage_limit_once_per_customer),
    combineProduct: Boolean(r.combine_product),
    combineOrder: Boolean(r.combine_order),
    combineShipping: Boolean(r.combine_shipping),
    startsAt: String(r.starts_at),
    endsAt: (r.ends_at as string) ?? null,
    usedCount: Number(r.used_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function discountToRow(d: Discount): Row {
  return {
    title: d.title.trim(),
    method: d.method,
    code: d.method === "code" ? (d.code || d.title).trim() || null : null,
    discount_type: d.discountType,
    status: deriveStatus(d.startsAt, d.endsAt, d.status),
    value_type: d.valueType,
    value: d.value,
    applies_to: d.appliesTo,
    applies_to_ids: d.appliesToIds,
    buy_type: d.buyType,
    buy_value: d.buyValue,
    buy_item_scope: d.buyItemScope,
    buy_item_ids: d.buyItemIds,
    get_quantity: d.getQuantity,
    get_item_scope: d.getItemScope,
    get_item_ids: d.getItemIds,
    get_value_type: d.getValueType,
    get_value: d.getValue,
    get_is_free: d.getIsFree,
    max_uses_per_order: d.maxUsesPerOrder,
    ship_countries: d.shipCountries,
    ship_exclude_over_amount: d.shipExcludeOverAmount,
    min_requirement: d.minRequirement,
    min_amount: d.minAmount,
    min_quantity: d.minQuantity,
    eligibility: d.eligibility,
    eligibility_ids: d.eligibilityIds,
    usage_limit_total: d.usageLimitTotal,
    usage_limit_once_per_customer: d.usageLimitOncePerCustomer,
    combine_product: d.combineProduct,
    combine_order: d.combineOrder,
    combine_shipping: d.combineShipping,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
  };
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Reads ------------------------------------------------------------------
export async function listDiscounts(): Promise<ActionResult<Discount[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(rowToDiscount) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getDiscount(id: string): Promise<ActionResult<Discount>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: rowToDiscount(data) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Writes -----------------------------------------------------------------
export async function createDiscount(
  d: Discount,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("discounts")
      .insert(discountToRow(d))
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/discounts");
    return { ok: true, data: { id: String(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateDiscount(
  id: string,
  d: Discount,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("discounts")
      .update(discountToRow(d))
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/discounts");
    revalidatePath(`/discounts/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteDiscount(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/discounts");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setDiscountStatus(
  id: string,
  status: DiscountStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("discounts")
      .update({ status })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/discounts");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
