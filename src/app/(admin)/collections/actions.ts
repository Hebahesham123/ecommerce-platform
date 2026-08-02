"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { invalidateCatalog } from "@/lib/storefront-data";
import {
  collectionHandle,
  RESERVED_HANDLES,
  type Collection,
  type CollectionMember,
  type CollectionRuleType,
} from "@/lib/collections";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

function rowToCollection(r: Row): Collection {
  const members = Array.isArray(r.collection_products)
    ? (r.collection_products as Row[])
    : [];
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    handle: String(r.handle ?? ""),
    description: str(r.description),
    imageUrl: str(r.image_url),
    isPublished: r.is_published !== false,
    sortOrder: Number(r.sort_order ?? 0),
    ruleType: (String(r.rule_type ?? "manual") as CollectionRuleType),
    ruleValue: str(r.rule_value),
    products: members
      .map(
        (m): CollectionMember => ({
          itemId: m.item_id ? String(m.item_id) : null,
          productName: String(m.product_name ?? ""),
          position: Number(m.position ?? 0),
        }),
      )
      .sort((a, b) => a.position - b.position),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

/**
 * Collections are new (migration 0010). If the table is missing we return an
 * explicit `migration_missing` so the page can tell the user to run it instead
 * of showing a raw Postgres error.
 */
function mapError(message: string): string {
  return /relation .*collections.* does not exist|could not find the table/i.test(message)
    ? "migration_missing"
    : message;
}

// ---- Reads ------------------------------------------------------------------
export async function listCollections(): Promise<ActionResult<Collection[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_products(item_id, product_name, position)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: (data ?? []).map(rowToCollection) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

// ---- Create / update --------------------------------------------------------
export type CollectionInput = {
  id?: string;
  title: string;
  handle?: string;
  description?: string | null;
  imageUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
  ruleType?: CollectionRuleType;
  ruleValue?: string | null;
  /** Manual membership. Ignored for automatic (rule-based) collections. */
  products?: { itemId: string | null; productName: string }[];
};

/** Find a handle not already taken by another collection. */
async function uniqueHandle(
  supabase: ReturnType<typeof getServerSupabase>,
  desired: string,
  ignoreId?: string,
): Promise<string> {
  const base = collectionHandle(desired) || "collection";
  const { data } = await supabase.from("collections").select("id, handle");
  const taken = new Set(
    (data ?? [])
      .filter((r: Row) => String(r.id) !== (ignoreId ?? ""))
      .map((r: Row) => String(r.handle)),
  );
  for (const h of RESERVED_HANDLES) taken.add(h);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function saveCollection(
  input: CollectionInput,
): Promise<ActionResult<Collection>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  try {
    const supabase = getServerSupabase();
    const ruleType = input.ruleType ?? "manual";
    if (ruleType !== "manual" && !str(input.ruleValue))
      return { ok: false, error: "rule_value_required" };

    const handle = await uniqueHandle(supabase, input.handle || title, input.id);
    const row = {
      title,
      handle,
      description: str(input.description),
      image_url: str(input.imageUrl),
      is_published: input.isPublished !== false,
      sort_order: Number(input.sortOrder ?? 0),
      rule_type: ruleType,
      rule_value: ruleType === "manual" ? null : str(input.ruleValue),
    };

    let id = input.id;
    if (id) {
      const { error } = await supabase.from("collections").update(row).eq("id", id);
      if (error) return { ok: false, error: mapError(error.message) };
    } else {
      const { data, error } = await supabase
        .from("collections")
        .insert(row)
        .select("id")
        .single();
      if (error) return { ok: false, error: mapError(error.message) };
      id = String(data.id);
    }

    // Manual membership is replaced wholesale — simplest way to keep the
    // stored order identical to what the editor shows.
    if (ruleType === "manual") {
      const { error: delErr } = await supabase
        .from("collection_products")
        .delete()
        .eq("collection_id", id);
      if (delErr) return { ok: false, error: mapError(delErr.message) };

      const members = (input.products ?? [])
        .filter((p) => p.productName.trim())
        .map((p, i) => ({
          collection_id: id,
          item_id: p.itemId || null,
          product_name: p.productName.trim(),
          position: i,
        }));
      if (members.length) {
        const { error: insErr } = await supabase
          .from("collection_products")
          .insert(members);
        if (insErr) return { ok: false, error: mapError(insErr.message) };
      }
    } else {
      await supabase.from("collection_products").delete().eq("collection_id", id);
    }

    const { data: saved, error: readErr } = await supabase
      .from("collections")
      .select("*, collection_products(item_id, product_name, position)")
      .eq("id", id)
      .single();
    if (readErr) return { ok: false, error: mapError(readErr.message) };

    invalidateCatalog();
    revalidatePath("/collections");
    return { ok: true, data: rowToCollection(saved) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function deleteCollection(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateCatalog();
    revalidatePath("/collections");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function setCollectionPublished(
  id: string,
  isPublished: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("collections")
      .update({ is_published: isPublished })
      .eq("id", id);
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateCatalog();
    revalidatePath("/collections");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** Persist the drag-free ordering used by the list view. */
export async function reorderCollections(ids: string[]): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("collections")
        .update({ sort_order: i })
        .eq("id", ids[i]);
      if (error) return { ok: false, error: mapError(error.message) };
    }
    invalidateCatalog();
    revalidatePath("/collections");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
