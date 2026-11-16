import { NextResponse, type NextRequest } from "next/server";

/**
 * The store now runs on our own server. Anyone who opens a page at an old Vercel address
 * (ecommerce-platform-*.vercel.app) is sent to the same page on the server.
 *
 * Only page visits (GET/HEAD) move. Webhooks and other API calls (/api/...: Meta, n8n, Paymob
 * until its dashboard is updated), form posts and build files keep working at the old address;
 * both copies use the same database and files, so nothing gets out of step.
 */
const SERVER = "https://srv2120209.hstgr.cloud";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (!host.endsWith(".vercel.app")) return NextResponse.next();
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next();
  return NextResponse.redirect(`${SERVER}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
}

export const config = {
  matcher: [
    "/((?!api/|_next/|favicon|brands/|.*\\.(?:png|jpe?g|webp|avif|svg|gif|ico|css|js|map|woff2?|ttf|txt|xml|json|webmanifest)$).*)",
  ],
};
