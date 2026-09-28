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

    /*
     * The shop's own logo as the splash screen.
     *
     * It is already uploaded, it is already the thing customers recognise,
     * and a splash is exactly what a wordmark is for: centred on a colour
     * while the app starts. Asking a merchant to produce a second copy of a
     * picture the shop is already using is asking her to do the computer's
     * job.
     *
     * The icon is deliberately not done this way. An icon is a square read at
     * the size of a fingernail, and a wide wordmark squeezed into one is
     * unreadable — worse than Expo's placeholder, which at least looks
     * deliberate.
     */
    const logo = theme.settings.logoUrl;
    if (logo) {
      try {
        const res = await fetch(logo, { signal: AbortSignal.timeout(8000) });
        const type = res.headers.get("content-type") ?? "";
        const bytes = res.ok && type.startsWith("image/") ? await res.arrayBuffer() : null;
        // A logo larger than this is not a logo, and a zip is not a good
        // place to discover that.
        if (bytes && bytes.byteLength > 0 && bytes.byteLength < 4_000_000) {
          zip.file("assets/splash.png", bytes);

          // Name it, now that it is actually there.
          const appJson = made.data.find((f) => f.path === "app.json");
          if (appJson) {
            const config = JSON.parse(appJson.contents) as {
              expo: { splash?: Record<string, unknown> };
            };
            config.expo.splash = {
              ...(config.expo.splash ?? {}),
              image: "./assets/splash.png",
            };
            zip.file("app.json", `${JSON.stringify(config, null, 2)}
`);
          }
        }
      } catch {
        // No logo in the zip, and the build still succeeds on Expo's own
        // placeholder. A download that fails because a picture would not
        // load is a worse outcome than a plain splash screen.
      }
    }

    // Somewhere for the pictures the build needs, with a note rather than an
    // empty folder a zip would drop on the way out.
    zip.file(
      "assets/README.txt",
      [
        "Nothing here is required to build. app.json names no icon and no",
        "splash image on purpose, so the first build cannot fail on a missing",
        "file — Expo uses its own placeholder in your accent colour.",
        "",
        "When you are ready to look like yourself rather than like Expo, put",
        "these here and name them in app.json:",
        "",
        "  icon.png     1024x1024, no transparency",
        "  splash.png   about 1284x2778, your logo centred",
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
