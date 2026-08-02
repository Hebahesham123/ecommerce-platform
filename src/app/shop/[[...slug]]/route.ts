import {
  handleStorefrontGet,
  handleStorefrontPost,
  type MountConfig,
} from "@/lib/storefront-handler";
import { getPublishedThemeId } from "@/lib/theme-render-service";

export const dynamic = "force-dynamic";

const MOUNT = "/shop";

const NO_THEME = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No theme published</title>
<style>body{font:15px/1.7 system-ui,-apple-system,Segoe UI,sans-serif;padding:48px;max-width:640px;margin:0 auto;color:#475569}a{color:#0f172a}</style></head>
<body><h1 style="color:#0f172a">No theme published</h1>
<p>Upload a theme in <a href="/online-store/themes">Online Store → Themes</a> and press <strong>Publish</strong> to serve it here.</p></body></html>`;

async function config(): Promise<MountConfig | null> {
  const themeId = await getPublishedThemeId();
  return themeId ? { themeId, mount: MOUNT } : null;
}

function noTheme(): Response {
  return new Response(NO_THEME, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** The live storefront: the published theme, rendered from dashboard data. */
export async function GET(req: Request) {
  const cfg = await config();
  return cfg ? handleStorefrontGet(req, cfg) : noTheme();
}

export async function POST(req: Request) {
  const cfg = await config();
  return cfg ? handleStorefrontPost(req, cfg) : noTheme();
}
