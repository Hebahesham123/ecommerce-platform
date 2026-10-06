import type { MetadataRoute } from "next";
import { getStorefrontCatalog } from "@/lib/theme-render-service";
import { listPublishedPosts } from "@/lib/blog";

// Regenerate at most hourly: the sitemap is read by crawlers, not shoppers, so
// an hour-stale list of products/collections is fine and keeps it cheap.
export const revalidate = 3600;

const MOUNT = "/shop";
// A few thousand URLs is plenty for a sitemap; past ~50k Google wants an index.
const MAX_URLS = 5000;

/** Request-independent site origin, no trailing slash. "" when none is known. */
function baseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "";
}

/**
 * The storefront sitemap: the home page, every collection and product, and the
 * public custom pages. Handles come from the same catalog the storefront
 * renders from, so the sitemap can never drift from what is actually served.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = baseUrl();
  const out: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  const push = (url: string, extra: Omit<MetadataRoute.Sitemap[number], "url"> = {}) => {
    if (out.length >= MAX_URLS || seen.has(url)) return;
    seen.add(url);
    out.push({ url, ...extra });
  };

  try {
    const now = new Date();
    push(`${BASE}${MOUNT}`, { lastModified: now, changeFrequency: "daily", priority: 1 });

    const catalog = await getStorefrontCatalog(MOUNT);

    // Collections (c.url already carries the mount, e.g. "/shop/collections/x").
    for (const c of catalog.collections) {
      if (!c.handle) continue;
      push(`${BASE}${c.url}`, { changeFrequency: "weekly", priority: 0.7 });
    }

    // Products.
    for (const p of catalog.productByHandle.values()) {
      if (!p.handle) continue;
      push(`${BASE}${p.url}`, { changeFrequency: "weekly", priority: 0.8 });
    }

    // Public custom pages served through the theme. (Requests is intentionally
    // excluded: it shows the signed-in shopper their own orders.)
    for (const page of ["/reviews", "/happy-customers"]) {
      push(`${BASE}${MOUNT}${page}`, { changeFrequency: "monthly", priority: 0.4 });
    }
  } catch {
    // Never serve an empty sitemap on a catalog error — at least the home URL.
  }

  // The native blog: its index and each published article. Kept in its own
  // try/catch so a blog table that was never migrated can't drop the catalog
  // entries above.
  try {
    push(`${BASE}/store/blog`, { changeFrequency: "weekly", priority: 0.5 });
    for (const post of await listPublishedPosts()) {
      if (!post.slug) continue;
      push(`${BASE}/store/blog/${post.slug}`, {
        lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Blog is optional; ignore any failure.
  }

  if (!out.length) out.push({ url: `${BASE}${MOUNT}` });
  return out;
}
