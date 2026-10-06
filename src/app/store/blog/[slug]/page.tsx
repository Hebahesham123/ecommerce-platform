import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@/lib/blog";
import { readSeoSettings } from "@/lib/seo-settings";

export const dynamic = "force-dynamic";

async function locale(): Promise<"ar" | "en"> {
  const l = (await cookies()).get("sf_locale")?.value;
  return l === "ar" ? "ar" : "en";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Not found" };
  const seo = await readSeoSettings();
  const site = seo.siteName || "BeautyBar";
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || seo.defaultDescription || "";
  const images = post.coverImage ? [post.coverImage] : seo.socialImage ? [seo.socialImage] : [];
  return {
    title: `${title} · ${site}`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images,
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

function fmtDate(iso: string | null, ar: boolean): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, lang] = await Promise.all([getPublishedPost(slug), locale()]);
  if (!post) notFound();
  const ar = lang === "ar";

  const seo = await readSeoSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.coverImage ? { image: [post.coverImage] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
    ...(post.excerpt || post.seoDescription ? { description: post.seoDescription || post.excerpt } : {}),
    publisher: { "@type": "Organization", name: seo.siteName || "BeautyBar" },
  };

  return (
    <article dir={ar ? "rtl" : "ltr"} className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-2xl">
        <Link href="/store/blog" className="text-sm text-ink-muted hover:text-ink">
          {ar ? "→ كل المقالات" : "← All posts"}
        </Link>

        <header className="mt-4">
          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface-page px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {post.author && <span className="font-medium text-ink-muted">{post.author}</span>}
            {post.author && post.publishedAt && <span aria-hidden>·</span>}
            {post.publishedAt && <time dateTime={post.publishedAt}>{fmtDate(post.publishedAt, ar)}</time>}
          </div>
        </header>

        {post.coverImage && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface-page">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImage} alt={post.title} className="max-h-[480px] w-full object-cover" />
          </div>
        )}

        {post.body ? (
          <div
            className="prose prose-neutral mt-8 max-w-none text-[16px] leading-relaxed text-ink [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-s-4 [&_blockquote]:border-line [&_blockquote]:ps-4 [&_blockquote]:text-ink-muted [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-6 [&_img]:rounded-xl [&_li]:my-1 [&_ol]:ps-6 [&_ol]:list-decimal [&_p]:my-4 [&_ul]:ps-6 [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        ) : post.excerpt ? (
          <p className="mt-8 text-[16px] leading-relaxed text-ink">{post.excerpt}</p>
        ) : null}
      </div>
    </article>
  );
}
