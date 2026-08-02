import { NextResponse } from "next/server";
import { buildOAuthUrl, metaAppConfigured } from "@/lib/meta";

export const dynamic = "force-dynamic";

function publicOrigin(req: Request): string {
  const env = process.env.META_PUBLIC_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const origin = publicOrigin(req);
  if (!metaAppConfigured()) {
    return NextResponse.redirect(`${origin}/channels/meta?error=app_not_configured`);
  }
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/meta/callback`;
  const res = NextResponse.redirect(buildOAuthUrl(redirectUri, state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
