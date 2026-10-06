import type { MetadataRoute } from "next";

/** Request-independent site origin, no trailing slash. "" when none is known. */
function baseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "";
}

/**
 * robots.txt: let crawlers into the storefront, keep them out of the admin and
 * API surface, and point them at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const BASE = baseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/orders",
        "/accounting",
        "/courier-system",
        "/couriers",
        "/inventory",
        "/settings",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
