"use server";

import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { getAppTheme, saveAppTheme } from "@/lib/app-theme-service";
import { getCatalog } from "@/lib/storefront-data";
import { generateApp, type GeneratedFile } from "@/lib/app-theme-codegen";
import { headers } from "next/headers";
import type { AppTheme } from "@/lib/app-theme";
import type { ActionResult } from "@/lib/orders";

const imageOf = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  const src = (v as Record<string, unknown>).src ?? (v as Record<string, unknown>).url;
  return typeof src === "string" && src ? src : null;
};

/**
 * The theme editor's two jobs: load what to edit, and save what was edited.
 *
 * `collections` and `menus` come back with the theme because every block that
 * points at something points at one of those, and a dropdown that has to fetch
 * its own options is a dropdown that is empty for the first half-second.
 */

export type ThemeEditorData = {
  theme: AppTheme;
  collections: { handle: string; title: string; count: number; image: string | null }[];
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
            // The editor shows this where a card has no image of its own, so
            // inheriting a collection's picture is visible rather than magic.
            image: imageOf(c.featured_image ?? c.image),
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
/**
 * The whole project as one file, ready to unzip and install.
 *
 * Reading the code on screen is useful for seeing what a section produces;
 * it is no use at all for actually having an app. This is the same files,
 * zipped, so the folder that comes out is one `npm install` from running on
 * a phone.
 *
 * Base64 rather than a stream: a server action returns a value, and the app
 * is a few hundred kilobytes of text — small enough that the simple thing is
 * also the right one.
 */
export async function downloadApp(
  theme: AppTheme,
): Promise<ActionResult<{ name: string; base64: string }>> {
  const made = await generatedFiles(theme);
  if (!made.ok) return made;
  try {
    const zip = new JSZip();
    for (const f of made.data) zip.file(f.path, f.contents);

    // Somewhere for the pictures the build needs, with a note rather than an
    // empty folder a zip would drop on the way out.
    zip.file(
      "assets/README.txt",
      [
        "Put three images here before building:",
        "",
        "  icon.png           1024x1024, no transparency",
        "  splash.png         about 1284x2778, your logo centred",
        "  adaptive-icon.png  1024x1024, the middle two thirds kept clear",
        "",
        "The build fails without them, and that is the right behaviour: an app",
        "shipped with Expo's placeholder icon is worse than one that would not",
        "build.",
      ].join("\n"),
    );

    const base64 = await zip.generateAsync({ type: "base64" });
    const name = (theme.settings.storeName || "shop")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shop";
    return { ok: true, data: { name: `${name}-app.zip`, base64 } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

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
