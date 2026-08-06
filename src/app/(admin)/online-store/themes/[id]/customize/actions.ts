"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getThemeMap,
  loadCustomization,
  renderStorefront,
  invalidateThemeBundle,
} from "@/lib/theme-render-service";
import { getCatalog } from "@/lib/storefront-data";
import {
  EMPTY_CUSTOMIZATION,
  type FoundLink,
  type ThemeCustomization,
  type ThemeMap,
} from "@/lib/theme-schema";

import type { LinkTargets } from "@/components/link-picker";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type CustomizerData = {
  themeName: string;
  map: ThemeMap;
  customization: ThemeCustomization;
  targets: LinkTargets;
};

function mapError(message: string): string {
  return /relation .*theme_customizations.* does not exist|could not find the table/i.test(
    message,
  )
    ? "migration_missing"
    : message;
}

export async function loadCustomizer(themeId: string): Promise<ActionResult<CustomizerData>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("themes")
      .select("name")
      .eq("id", themeId)
      .maybeSingle();

    const customization = await loadCustomization(themeId);
    const res = await getThemeMap(themeId, customization);
    if ("error" in res) return { ok: false, error: res.error };

    const catalog = await getCatalog("");
    return {
      ok: true,
      data: {
        themeName: String(row?.name ?? "Theme"),
        map: res.map,
        customization,
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

export async function saveCustomization(
  themeId: string,
  customization: ThemeCustomization,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("theme_customizations").upsert(
      {
        theme_id: themeId,
        settings: customization.settings ?? {},
        sections: customization.sections ?? {},
        links: (customization.links ?? []).filter((l) => l.from && l.to),
      },
      { onConflict: "theme_id" },
    );
    if (error) return { ok: false, error: mapError(error.message) };
    // Rendered output is derived from these values — drop any cached bundle.
    invalidateThemeBundle(themeId);
    revalidatePath(`/online-store/themes/${themeId}/customize`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

export async function resetCustomization(themeId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("theme_customizations")
      .delete()
      .eq("theme_id", themeId);
    if (error) return { ok: false, error: mapError(error.message) };
    invalidateThemeBundle(themeId);
    revalidatePath(`/online-store/themes/${themeId}/customize`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/**
 * Render one storefront page and report the anchors it contains, so buttons
 * the theme hardcodes (no schema setting behind them) can still be re-pointed.
 */
export async function scanPageLinks(
  themeId: string,
  path: string,
): Promise<ActionResult<FoundLink[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    let found: FoundLink[] = [];
    await renderStorefront({
      themeId,
      mount: `/online-store/themes/${themeId}/preview`,
      path: path || "/",
      query: {},
      cartLines: [],
      // Scan the theme's own hrefs, i.e. before any overrides are applied.
      customization: EMPTY_CUSTOMIZATION,
      collectLinks: (links) => {
        found = links;
      },
    });
    return { ok: true, data: found };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
