"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCatalog, invalidateCatalog } from "@/lib/storefront-data";
import { buildTree, flattenTree, type Menu, type NavItem } from "@/lib/navigation";
import type { LinkTargets } from "@/components/link-picker";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

function mapError(message: string): string {
  return /relation .*navigation_.*does not exist|could not find the table/i.test(message)
    ? "migration_missing"
    : message;
}

export type NavigationData = {
  menus: Menu[];
  targets: LinkTargets;
};

export async function loadNavigation(): Promise<ActionResult<NavigationData>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: menus, error } = await supabase
      .from("navigation_menus")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: mapError(error.message) };

    const { data: items, error: itemsErr } = await supabase
      .from("navigation_items")
      .select("id, menu_id, parent_id, title, url, position");
    if (itemsErr) return { ok: false, error: mapError(itemsErr.message) };

    const byMenu = new Map<string, Row[]>();
    for (const r of (items ?? []) as Row[]) {
      const k = String(r.menu_id);
      if (!byMenu.has(k)) byMenu.set(k, []);
      byMenu.get(k)!.push(r);
    }

    const catalog = await getCatalog("");
    return {
      ok: true,
      data: {
        menus: ((menus ?? []) as Row[]).map((m) => ({
          id: String(m.id),
          handle: String(m.handle ?? ""),
          title: String(m.title ?? ""),
          items: buildTree(
            (byMenu.get(String(m.id)) ?? []).map((r) => ({
              id: String(r.id),
              parent_id: r.parent_id ? String(r.parent_id) : null,
              title: String(r.title ?? ""),
              url: String(r.url ?? ""),
              position: Number(r.position ?? 0),
            })),
          ),
        })),
        targets: {
          collections: catalog.collections.map((c) => ({
            handle: c.handle,
            title: c.title,
            count: c.products_count,
          })),
          products: catalog.products.map((p) => ({
            handle: p.handle,
            title: String(p.title),
          })),
        },
      },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function createMenu(
  handle: string,
  title: string,
): Promise<ActionResult<Menu>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const h = handle.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!h) return { ok: false, error: "handle_required" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("navigation_menus")
      .insert({ handle: h, title: title.trim() || h })
      .select("*")
      .single();
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateCatalog();
    revalidatePath("/navigation");
    return {
      ok: true,
      data: { id: String(data.id), handle: String(data.handle), title: String(data.title), items: [] },
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function deleteMenu(menuId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("navigation_menus").delete().eq("id", menuId);
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateCatalog();
    revalidatePath("/navigation");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/**
 * Replace a menu's whole tree.
 *
 * The editor works on a client-side tree (new items carry temporary ids), so
 * the simplest correct persistence is delete-then-insert. Parents are inserted
 * before their children so `parent_id` always resolves; ids are re-mapped as
 * we go because the database assigns real UUIDs.
 */
export async function saveMenuItems(
  menuId: string,
  items: NavItem[],
): Promise<ActionResult<NavItem[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();

    const { error: delErr } = await supabase
      .from("navigation_items")
      .delete()
      .eq("menu_id", menuId);
    if (delErr) return { ok: false, error: mapError(delErr.message) };

    const flat = flattenTree(items).filter((r) => r.title.trim());
    const idMap = new Map<string, string>();

    for (const row of flat) {
      const parentId = row.parentId ? (idMap.get(row.parentId) ?? null) : null;
      // A child whose parent failed to insert would orphan itself — skip it.
      if (row.parentId && !parentId) continue;
      const { data, error } = await supabase
        .from("navigation_items")
        .insert({
          menu_id: menuId,
          parent_id: parentId,
          title: row.title.trim(),
          url: row.url.trim(),
          position: row.position,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: mapError(error.message) };
      idMap.set(row.id, String(data.id));
    }

    const { data: saved, error: readErr } = await supabase
      .from("navigation_items")
      .select("id, parent_id, title, url, position")
      .eq("menu_id", menuId);
    if (readErr) return { ok: false, error: mapError(readErr.message) };

    invalidateCatalog();
    revalidatePath("/navigation");
    return {
      ok: true,
      data: buildTree(
        ((saved ?? []) as Row[]).map((r) => ({
          id: String(r.id),
          parent_id: r.parent_id ? String(r.parent_id) : null,
          title: String(r.title ?? ""),
          url: String(r.url ?? ""),
          position: Number(r.position ?? 0),
        })),
      ),
    };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** Seed a menu from the store's collections — a usable starting point. */
export async function generateFromCollections(
  menuId: string,
): Promise<ActionResult<NavItem[]>> {
  const catalog = await getCatalog("");
  const items: NavItem[] = catalog.collections
    .filter((c) => c.handle !== "all")
    .map((c, i) => ({
      id: `gen-${i}`,
      title: String(c.title),
      url: `/collections/${c.handle}`,
      children: [],
    }));
  items.unshift({ id: "gen-home", title: "Home", url: "/", children: [] });
  items.push({
    id: "gen-all",
    title: "Shop all",
    url: "/collections/all",
    children: [],
  });
  return saveMenuItems(menuId, items);
}
