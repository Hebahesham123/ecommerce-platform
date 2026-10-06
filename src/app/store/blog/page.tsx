import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { listPublishedPosts } from "@/lib/blog";
import { readSeoSettings } from "@/lib/seo-settings";

// Always fresh: a post published in the admin should appear here on the next
// visit, not after a rebuild.
export const dynamic = "force-dynamic";

async function locale(): Promise<"ar" | "en"> {
  const l = (await cookies()).get("sf_locale")?.value;
  return l === "ar" ? "ar" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await readSeoSettings();
  const site = seo.siteName || "BeautyBar";
  const description = seo.defaultDescription || "Stories, guides and news from our team.";
  return {
    title: `Blog · ${site}`,
    description,
    openGraph: { title: `Blog · ${site}`, description, type: "website" },
  };
}

function fmtDate(iso: string | null, ar: boolean): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function StoreBlogPage() {
  const [posts, lang] = await Promise.all([listPublishedPosts(), locale()]);
  const ar = lang === "ar";

  return (
    <div dir={ar ? "rtl" : "ltr"} className="py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {ar ? "المدونة" : "Blog"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {ar ? "قصص وأدلة وأخبار من فريقنا." : "Stories, guides and news from our team."}
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-line p-10 text-center">
          <p className="text-sm text-ink-muted">
            {ar ? "لا توجد مقالات منشورة بعد." : "No posts published yet — check back soon."}
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/store/blog/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-pop"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-brand-50 to-slate-50">
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-4xl">📝</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  {p.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-page px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:text-brand-700">
                    {p.title}
                  </h2>
                  {p.excerpt && <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-ink-muted">{p.excerpt}</p>}
                  <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                    {p.author && <span>{p.author}</span>}
                    {p.author && p.publishedAt && <span aria-hidden>·</span>}
                    <time dateTime={p.publishedAt ?? undefined}>{fmtDate(p.publishedAt, ar)}</time>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
