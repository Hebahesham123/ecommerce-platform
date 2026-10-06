"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { Field, fieldClass } from "@/components/modal";
import { IcContent, IcTrash, IcX, IcChevron, IcEye } from "@/components/icons";
import { getPost, savePost, deletePost, setPostStatus, type BlogStatus } from "../actions";

/** Mirror of the server slugify, for the live slug preview only. */
function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function PostEditor({ id }: { id: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<BlogStatus>("draft");
  const [publishedAt, setPublishedAt] = useState<string>(""); // yyyy-MM-dd for <input type=date>
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);

  const slugRef = useRef(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const res = await getPost(id);
      if (res.ok && res.data) {
        const p = res.data;
        setTitle(p.title);
        setSlug(p.slug);
        setSlugTouched(true);
        slugRef.current = true;
        setExcerpt(p.excerpt ?? "");
        setBody(p.body ?? "");
        setCoverImage(p.coverImage ?? "");
        setAuthor(p.author ?? "");
        setTags(p.tags);
        setStatus(p.status);
        setPublishedAt(p.publishedAt ? p.publishedAt.slice(0, 10) : "");
        setSeoTitle(p.seoTitle ?? "");
        setSeoDescription(p.seoDescription ?? "");
        if (p.seoTitle || p.seoDescription) setSeoOpen(true);
      } else if (res.ok && !res.data) {
        setErr("not_found");
      } else if (!res.ok) {
        setErr(res.error);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  // Keep the slug tracking the title until the merchant edits it by hand.
  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugRef.current) setSlug(slugify(v));
  };
  const onSlug = (v: string) => {
    setSlug(v);
    setSlugTouched(true);
    slugRef.current = true;
  };

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft("");
  };
  const onTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const errText = useCallback(
    (code: string | null) => {
      if (!code) return null;
      const map: Record<string, string> = {
        title_required: ar ? "العنوان مطلوب." : "A title is required.",
        migration_missing: ar ? "شغّلي ترحيل 0052." : "Run migration 0052.",
        not_configured: ar ? "لم يتم ربط Supabase." : "Supabase is not connected.",
        not_found: ar ? "المقال غير موجود." : "Post not found.",
      };
      return map[code] ?? (ar ? "حدث خطأ." : "Something went wrong.");
    },
    [ar],
  );

  async function save(statusOverride?: BlogStatus) {
    if (!title.trim()) {
      setErr("title_required");
      return;
    }
    setBusy(true);
    setErr(null);
    const nextStatus = statusOverride ?? status;
    const res = await savePost({
      id: isNew ? undefined : id,
      slug: slugTouched ? slug : undefined,
      title,
      excerpt,
      body,
      coverImage,
      author,
      tags,
      status: nextStatus,
      seoTitle,
      seoDescription,
      // Only send an explicit date when the merchant set one; otherwise let the
      // server stamp published_at on first publish.
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    });
    setBusy(false);
    if (res.ok) {
      router.push("/blog");
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  async function remove() {
    if (isNew) return;
    if (!window.confirm(ar ? "حذف هذا المقال نهائياً؟" : "Permanently delete this post?")) return;
    setBusy(true);
    const res = await deletePost(id);
    setBusy(false);
    if (res.ok) {
      router.push("/blog");
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  // Quick publish / unpublish toggle for an existing post (saves just status).
  async function togglePublish() {
    if (isNew) {
      await save(status === "published" ? "draft" : "published");
      return;
    }
    const next: BlogStatus = status === "published" ? "draft" : "published";
    setBusy(true);
    setErr(null);
    const res = await setPostStatus(id, next);
    setBusy(false);
    if (res.ok) {
      setStatus(next);
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  const message = errText(err);

  const previewEmpty = ar ? "ستظهر المعاينة هنا…" : "Your preview appears here…";

  const inputBase = useMemo(() => fieldClass, []);

  if (loading) {
    return (
      <div dir={ar ? "rtl" : "ltr"} className="py-20 text-center text-sm text-ink-soft">
        {ar ? "جارٍ التحميل…" : "Loading…"}
      </div>
    );
  }

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={isNew ? (ar ? "مقال جديد" : "New post") : ar ? "تعديل المقال" : "Edit post"}
        subtitle={ar ? "اكتب المحتوى وانشره في مدونتك" : "Write the content and publish it to your blog"}
        actions={
          <>
            <Link href="/blog" className="btn-outline h-10">
              {ar ? "رجوع" : "Back"}
            </Link>
            {!isNew && status === "published" && (
              <a href={`/store/blog/${slug}`} target="_blank" rel="noreferrer" className="btn-outline h-10">
                <IcEye className="h-4 w-4" /> {ar ? "عرض" : "View"}
              </a>
            )}
            {!isNew && (
              <button onClick={remove} disabled={busy} className="btn-outline h-10 text-rose-600 disabled:opacity-50">
                <IcTrash className="h-4 w-4" /> {ar ? "حذف" : "Delete"}
              </button>
            )}
            <button onClick={togglePublish} disabled={busy} className="btn-outline h-10 disabled:opacity-50">
              {status === "published" ? (ar ? "إلغاء النشر" : "Unpublish") : ar ? "نشر" : "Publish"}
            </button>
          </>
        }
        primary={{ label: busy ? "…" : ar ? "حفظ" : "Save", onClick: () => save() }}
      />

      {message && (
        <div
          className={`mb-4 rounded-xl px-3 py-2.5 text-sm ${
            err === "migration_missing" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-4 p-5">
            <Field label={ar ? "العنوان" : "Title"}>
              <input
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder={ar ? "عنوان المقال" : "Post title"}
                className={inputBase}
              />
            </Field>
            <Field
              label={ar ? "الرابط (Slug)" : "Slug"}
              hint={ar ? "يُشتق تلقائياً من العنوان، ويمكن تعديله." : "Auto-derived from the title; editable."}
            >
              <div className="flex items-center gap-1 rounded-xl border border-line bg-surface ps-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                <span dir="ltr" className="text-sm text-ink-soft">
                  /store/blog/
                </span>
                <input
                  value={slug}
                  dir="ltr"
                  onChange={(e) => onSlug(e.target.value)}
                  placeholder="my-post"
                  className="h-10 flex-1 bg-transparent pe-3 text-sm outline-none"
                />
              </div>
            </Field>
            <Field label={ar ? "المقتطف" : "Excerpt"} hint={ar ? "ملخص قصير يظهر في قائمة المدونة." : "A short summary shown in the blog list."}>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder={ar ? "سطر أو سطران عن المقال…" : "A line or two about the post…"}
                className={`${inputBase} resize-y`}
              />
            </Field>
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{ar ? "المحتوى" : "Body"}</span>
              <span className="text-[11px] text-ink-soft">{ar ? "يُسمح بوسوم HTML" : "HTML is allowed"}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                dir="ltr"
                placeholder={"<h2>Heading</h2>\n<p>Write your article…</p>"}
                className={`${inputBase} resize-y font-mono text-[13px] leading-relaxed`}
              />
              <div className="rounded-xl border border-line bg-surface-page p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "معاينة" : "Preview"}
                </div>
                {body.trim() ? (
                  <div
                    className="prose prose-sm max-w-none text-ink [&_a]:text-brand-700 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:rounded-lg [&_p]:my-2 [&_ul]:list-disc [&_ul]:ps-5"
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                ) : (
                  <p className="text-sm text-ink-soft">{previewEmpty}</p>
                )}
              </div>
            </div>
          </Card>

          {/* SEO (collapsible) */}
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSeoOpen((o) => !o)}
              className="flex w-full items-center justify-between px-5 py-4 text-start"
            >
              <span>
                <span className="block text-sm font-semibold text-ink">{ar ? "تحسين محركات البحث (SEO)" : "SEO"}</span>
                <span className="block text-xs text-ink-soft">
                  {ar ? "عنوان ووصف مخصصان لمحركات البحث" : "Custom search title & description"}
                </span>
              </span>
              <IcChevron className={`h-4 w-4 text-ink-soft transition-transform ${seoOpen ? "rotate-90" : ""} rtl:-scale-x-100`} />
            </button>
            {seoOpen && (
              <div className="space-y-4 border-t border-line px-5 py-4">
                <Field label={ar ? "عنوان SEO" : "SEO title"} hint={ar ? "يُستخدم عنوان المقال إن تُرك فارغاً." : "Falls back to the post title if empty."}>
                  <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={inputBase} />
                </Field>
                <Field label={ar ? "وصف SEO" : "SEO description"} hint={ar ? "يُستخدم المقتطف إن تُرك فارغاً." : "Falls back to the excerpt if empty."}>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    rows={2}
                    className={`${inputBase} resize-y`}
                  />
                </Field>
              </div>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <span className="text-sm font-semibold text-ink">{ar ? "الحالة" : "Status"}</span>
            <div className="flex rounded-xl border border-line p-1">
              {(["draft", "published"] as BlogStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    status === st ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  {st === "published" ? (ar ? "منشور" : "Published") : ar ? "مسودة" : "Draft"}
                </button>
              ))}
            </div>
            <Field label={ar ? "تاريخ النشر" : "Published date"} hint={ar ? "يُحدَّد تلقائياً عند النشر إن تُرك فارغاً." : "Set automatically on publish if left blank."}>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className={inputBase}
              />
            </Field>
            <Field label={ar ? "الكاتب" : "Author"}>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputBase} />
            </Field>
          </Card>

          <Card className="space-y-3 p-5">
            <span className="text-sm font-semibold text-ink">{ar ? "صورة الغلاف" : "Cover image"}</span>
            <input
              value={coverImage}
              dir="ltr"
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://…"
              className={inputBase}
            />
            {coverImage.trim() && (
              <div className="overflow-hidden rounded-xl border border-line bg-surface-page">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="" className="h-40 w-full object-cover" />
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <span className="text-sm font-semibold text-ink">{ar ? "الوسوم" : "Tags"}</span>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-page px-2.5 py-1 text-xs text-ink">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                      className="text-ink-soft hover:text-rose-600"
                      aria-label="Remove tag"
                    >
                      <IcX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagDraft)}
              placeholder={ar ? "أضف وسماً ثم Enter" : "Add a tag, press Enter"}
              className={inputBase}
            />
          </Card>

          <div className="rounded-xl border border-line bg-surface-page p-4 text-xs text-ink-soft">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink-muted">
              <IcContent className="h-3.5 w-3.5" /> {ar ? "نصيحة" : "Tip"}
            </div>
            {ar
              ? "يظهر المقال في /store/blog فور نشره."
              : "A post shows on /store/blog as soon as it is published."}
          </div>
        </div>
      </div>
    </div>
  );
}
