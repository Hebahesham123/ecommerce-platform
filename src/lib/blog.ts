import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Server-only blog reads for the storefront (and the sitemap). These see only
 * PUBLISHED posts — a draft never leaks onto the public site. Never throws: a
 * missing table or a Supabase hiccup yields an empty list / null, so a blog
 * that was never migrated simply shows nothing rather than 500-ing the store.
 */

export type PublishedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverImage: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  author: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
};

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const tags = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((t) => String(t)).filter(Boolean) : [];

function mapPost(r: Row): PublishedPost {
  return {
    id: s(r.id),
    slug: s(r.slug),
    title: s(r.title),
    excerpt: sn(r.excerpt),
    body: sn(r.body),
    coverImage: sn(r.cover_image),
    tags: tags(r.tags),
    seoTitle: sn(r.seo_title),
    seoDescription: sn(r.seo_description),
    author: sn(r.author),
    publishedAt: sn(r.published_at),
    updatedAt: sn(r.updated_at),
  };
}

/** Every published post, newest `published_at` first. Empty on any error. */
export async function listPublishedPosts(limit = 200): Promise<PublishedPost[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await getServerSupabase()
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map((r) => mapPost(r as Row));
  } catch {
    return [];
  }
}

/** One published post by slug, or null when it's missing / still a draft. */
export async function getPublishedPost(slug: string): Promise<PublishedPost | null> {
  if (!isSupabaseConfigured()) return null;
  const clean = (slug || "").trim();
  if (!clean) return null;
  try {
    const { data, error } = await getServerSupabase()
      .from("blog_posts")
      .select("*")
      .eq("slug", clean)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;
    return mapPost(data as Row);
  } catch {
    return null;
  }
}
