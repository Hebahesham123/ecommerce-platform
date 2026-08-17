import { renderStorefront } from "@/lib/theme-render-service";
import type { ThemeCustomization } from "@/lib/theme-schema";

export const dynamic = "force-dynamic";

/**
 * Renders a theme page from UNSAVED state.
 *
 * The customizer and the code editor post their working draft here on every
 * change, so the preview reflects what you are editing without anything being
 * written to the database or to storage first.
 */
type DraftBody = {
  path?: string;
  customization?: ThemeCustomization;
  fileOverrides?: Record<string, string>;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: DraftBody = {};
  try {
    body = (await req.json()) as DraftBody;
  } catch {
    /* an empty body just renders the saved state */
  }

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const res = await renderStorefront({
    themeId: id,
    mount: `/online-store/themes/${id}/preview`,
    path: body.path || "/",
    query,
    cartLines: [],
    // Draft renders must never read a cached copy of the theme's files.
    fresh: false,
    inspect: true,
    customization: body.customization,
    fileOverrides: body.fileOverrides,
  });

  return new Response(res.html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
