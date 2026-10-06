"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type BlogStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverImage: string | null;
  status: BlogStatus;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BlogPostInput = {
  id?: string;
  slug?: string;
  title: string;
  excerpt?: string | null;
  body?: string | null;
  coverImage?: string | null;
  status?: BlogStatus;
  tags?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  author?: string | null;
  publishedAt?: string | null;
};

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const toTags = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((t) => String(t)).filter(Boolean) : [];

/** A "table isn't there yet" error → the UI tells the merchant to run 0052. */
function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return err.code === "42P01" || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function mapPost(r: Row): BlogPost {
  return {
    id: s(r.id),
    slug: s(r.slug),
    title: s(r.title),
    excerpt: sn(r.excerpt),
    body: sn(r.body),
    coverImage: sn(r.cover_image),
    status: (s(r.status) as BlogStatus) || "draft",
    tags: toTags(r.tags),
    seoTitle: sn(r.seo_title),
    seoDescription: sn(r.seo_description),
    author: sn(r.author),
    publishedAt: sn(r.published_at),
    createdAt: sn(r.created_at),
    updatedAt: sn(r.updated_at),
  };
}

/** Turn a title into a URL-safe slug. Handles Arabic by keeping its letters. */
function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-") // any non letter/number → hyphen
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Make `base` unique among existing slugs, ignoring the row we're editing.
 * Suffixes -2, -3… until it's free.
 */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const supabase = getServerSupabase();
  const root = base || "post";
  let candidate = root;
  for (let i = 2; i < 500; i += 1) {
    const { data } = await supabase.from("blog_posts").select("id").eq("slug", candidate).maybeSingle();
    if (!data || (excludeId && s((data as Row).id) === excludeId)) return candidate;
    candidate = `${root}-${i}`;
  }
  // Extremely unlikely fallthrough: make it unique with a timestamp tail.
  return `${root}-${Date.now()}`;
}

export async function listPosts(): Promise<ActionResult<BlogPost[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase()
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: (data ?? []).map((r) => mapPost(r as Row)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getPost(id: string): Promise<ActionResult<BlogPost | null>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { data, error } = await getServerSupabase().from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    return { ok: true, data: data ? mapPost(data as Row) : null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Create or update a post. With an `id` it updates that row, otherwise it
 * inserts. The slug is auto-derived from the title when left blank and always
 * made unique. Publishing a post that has no `published_at` yet stamps it now,
 * so the storefront can order the feed and show a real date.
 */
export async function savePost(input: BlogPostInput): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const title = (input.title || "").trim();
  if (!title) return { ok: false, error: "title_required" };
  try {
    const supabase = getServerSupabase();
    const status: BlogStatus = input.status === "published" ? "published" : "draft";

    // Resolve the slug: use what was typed, else the title; always unique.
    const rawSlug = slugify(input.slug?.trim() || title);
    const slug = await uniqueSlug(rawSlug, input.id);

    const patch: Row = {
      slug,
      title,
      excerpt: input.excerpt?.trim() || null,
      body: input.body ?? null,
      cover_image: input.coverImage?.trim() || null,
      status,
      tags: (input.tags ?? []).map((t) => String(t).trim()).filter(Boolean),
      seo_title: input.seoTitle?.trim() || null,
      seo_description: input.seoDescription?.trim() || null,
      author: input.author?.trim() || null,
    };

    // An explicit published date wins; otherwise stamp "now" the moment a post
    // becomes published and has none yet.
    let existingPublishedAt: string | null = null;
    if (input.id) {
      const { data: cur } = await supabase.from("blog_posts").select("published_at").eq("id", input.id).maybeSingle();
      existingPublishedAt = sn((cur as Row | null)?.published_at);
    }
    if (input.publishedAt !== undefined) {
      patch.published_at = input.publishedAt ? input.publishedAt : null;
    } else if (status === "published" && !existingPublishedAt) {
      patch.published_at = new Date().toISOString();
    }

    if (input.id) {
      const { data, error } = await supabase.from("blog_posts").update(patch).eq("id", input.id).select("id").single();
      if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
      revalidatePath("/blog");
      revalidatePath("/store/blog");
      revalidatePath(`/store/blog/${slug}`);
      return { ok: true, data: { id: s(data.id) } };
    }

    const { data, error } = await supabase.from("blog_posts").insert(patch).select("id").single();
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    revalidatePath("/blog");
    revalidatePath("/store/blog");
    revalidatePath(`/store/blog/${slug}`);
    return { ok: true, data: { id: s(data.id) } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const { error } = await getServerSupabase().from("blog_posts").delete().eq("id", id);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    revalidatePath("/blog");
    revalidatePath("/store/blog");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Flip a post between draft and published, stamping published_at on first publish. */
export async function setPostStatus(id: string, status: BlogStatus): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const patch: Row = { status };
    if (status === "published") {
      const { data: cur } = await supabase.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
      if (!sn((cur as Row | null)?.published_at)) patch.published_at = new Date().toISOString();
    }
    const { data: slugRow } = await supabase.from("blog_posts").select("slug").eq("id", id).maybeSingle();
    const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
    if (error) return { ok: false, error: missing(error) ? "migration_missing" : error.message };
    revalidatePath("/blog");
    revalidatePath("/store/blog");
    const slug = s((slugRow as Row | null)?.slug);
    if (slug) revalidatePath(`/store/blog/${slug}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
