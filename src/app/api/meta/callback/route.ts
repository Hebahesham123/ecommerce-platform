import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  fetchAssets,
  META_SCOPES,
} from "@/lib/meta";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function publicOrigin(req: Request): string {
  const env = process.env.META_PUBLIC_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const back = (q: string) => NextResponse.redirect(`${origin}/channels/meta?${q}`);

  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) return back(`error=${encodeURIComponent(error)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("meta_oauth_state")?.value;
  if (!code || !state || !saved || state !== saved) return back("error=state_mismatch");
  if (!isSupabaseConfigured()) return back("error=supabase_not_configured");

  try {
    const redirectUri = `${origin}/api/meta/callback`;
    const short = await exchangeCodeForToken(code, redirectUri);
    let token = short.access_token;
    let expires = short.expires_in;
    try {
      const ll = await getLongLivedToken(token);
      token = ll.access_token;
      expires = ll.expires_in ?? expires;
    } catch {
      /* keep short-lived token if exchange fails */
    }

    const assets = await fetchAssets(token);
    const supabase = getServerSupabase();
    const { data: existing } = await supabase
      .from("meta_connection")
      .select("pixel_id,catalog_id")
      .eq("id", "default")
      .single();

    const pixel =
      assets.pixels.find((p) => p.id === existing?.pixel_id) ??
      (assets.pixels.length === 1 ? assets.pixels[0] : null);
    const catalog =
      assets.catalogs.find((c) => c.id === existing?.catalog_id) ??
      (assets.catalogs.length === 1 ? assets.catalogs[0] : null);
    const biz = assets.businesses[0] ?? null;

    await supabase
      .from("meta_connection")
      .update({
        connected: true,
        fb_user_id: assets.user?.id ?? null,
        fb_user_name: assets.user?.name ?? null,
        access_token: token,
        token_expires_at: expires ? new Date(Date.now() + expires * 1000).toISOString() : null,
        scopes: META_SCOPES,
        business_id: biz?.id ?? null,
        business_name: biz?.name ?? null,
        pixel_id: pixel?.id ?? existing?.pixel_id ?? null,
        pixel_name: pixel?.name ?? null,
        catalog_id: catalog?.id ?? existing?.catalog_id ?? null,
        catalog_name: catalog?.name ?? null,
        available: assets,
      })
      .eq("id", "default");

    const res = back("connected=1");
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    return back(`error=${encodeURIComponent((e as Error).message)}`);
  }
}
