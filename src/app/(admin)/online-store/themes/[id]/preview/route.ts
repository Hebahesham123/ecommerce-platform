import { getThemeHtml } from "@/lib/theme-render-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const result = await getThemeHtml(id, { fresh });

  if ("error" in result) {
    const msg =
      result.error === "not_configured"
        ? "Supabase is not connected."
        : result.error === "not_renderable"
          ? "This theme has no renderable template."
          : `Preview error: ${result.error}`;
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.6 system-ui;padding:40px;color:#475569}</style></head><body>${msg}</body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new Response(result.html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
