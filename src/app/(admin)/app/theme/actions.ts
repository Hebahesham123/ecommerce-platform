"use server";

import { revalidatePath } from "next/cache";
import { getAppTheme, saveAppTheme } from "@/lib/app-theme-service";
import { getCatalog } from "@/lib/storefront-data";
import { generateApp, type GeneratedFile } from "@/lib/app-theme-codegen";
import { headers } from "next/headers";
import type { AppTheme } from "@/lib/app-theme";
import type { ActionResult } from "@/lib/orders";

/**
 * The theme editor's two jobs: load what to edit, and save what was edited.
 *
 * `collections` and `menus` come back with the theme because every block that
 * points at something points at one of those, and a dropdown that has to fetch
 * its own options is a dropdown that is empty for the first half-second.
 */

export type ThemeEditorData = {
  theme: AppTheme;
  collections: { handle: string; title: string; count: number }[];
  menus: { handle: string; title: string }[];
};

export async function loadThemeEditor(): Promise<ActionResult<ThemeEditorData>> {
  try {
    const [theme, catalog] = await Promise.all([getAppTheme(), getCatalog("")]);
    return {
      ok: true,
      data: {
        theme,
        collections: catalog.collections
          .filter((c) => c.handle !== "all")
          .map((c) => ({
            handle: String(c.handle),
            title: String(c.title),
            count: Number(c.products_count ?? 0),
          })),
        menus: catalog.menus.map((m) => ({ handle: m.handle, title: m.title })),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveTheme(theme: AppTheme): Promise<ActionResult> {
  const res = await saveAppTheme(theme);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/app/theme");
  return { ok: true, data: undefined };
}

/**
 * The app's code, as of a given theme.
 *
 * Generated rather than stored: there is no folder of app files to fix, the
 * way a website theme has Liquid to fix, so arranging a section is what writes
 * the code for it. Taking the draft as an argument means the code page can
 * show what an unsaved edit would produce, which is the whole point of showing
 * it at all.
 */
export async function generatedFiles(theme: AppTheme): Promise<ActionResult<GeneratedFile[]>> {
  try {
    // The base URL is this deployment's, so the generated api.ts points at the
    // store the merchant is actually looking at rather than a placeholder.
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return { ok: true, data: generateApp(theme, `${proto}://${host}/api/storefront`) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
