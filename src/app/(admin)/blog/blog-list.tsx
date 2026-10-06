"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  Toolbar,
  SearchInput,
  Select,
  StatusPill,
  Pagination,
  usePagination,
} from "@/components/dashboard-ui";
import { DataTable, type Column } from "@/components/data-table";
import { IcContent, IcPlus } from "@/components/icons";
import { listPosts, type BlogPost } from "./actions";

export function BlogList() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const ar = lang === "ar";

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPosts();
    if (res.ok) {
      setPosts(res.data);
      setErr(null);
    } else {
      setErr(res.error);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (needle) {
        const hay = `${p.title} ${p.excerpt ?? ""} ${p.tags.join(" ")} ${p.author ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [posts, q, status]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${q}|${status}` });

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";

  const columns: Column<BlogPost>[] = [
    {
      key: "title",
      header: t("col_title"),
      rank: "title",
      cell: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {p.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverImage} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <IcContent className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{p.title || (ar ? "بدون عنوان" : "Untitled")}</div>
              <div dir="ltr" className="truncate text-xs text-ink-soft">/{p.slug}</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("col_status"),
      rank: "primary",
      cell: (p) =>
        p.status === "published" ? (
          <StatusPill label={ar ? "منشور" : "Published"} tone="success" />
        ) : (
          <StatusPill label={ar ? "مسودة" : "Draft"} tone="neutral" />
        ),
    },
    {
      key: "tags",
      header: t("fld_tags"),
      rank: "secondary",
      hideBelow: "lg",
      cell: (p) =>
        p.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {p.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge bg-surface-page text-ink-muted">
                {tag}
              </span>
            ))}
            {p.tags.length > 3 && <span className="text-xs text-ink-soft">+{num(p.tags.length - 3, lang)}</span>}
          </div>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "date",
      header: t("col_date"),
      rank: "secondary",
      align: "end",
      hideBelow: "md",
      cell: (p) => <span className="text-ink-muted">{fmtDate(p.publishedAt ?? p.createdAt)}</span>,
    },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={t("nav_blog")}
        subtitle={ar ? "اكتب وانشر مقالات مدونتك" : "Write and publish your blog articles"}
        primary={{
          label: ar ? "مقال جديد" : "New post",
          href: "/blog/new",
          icon: <IcPlus className="h-4 w-4" />,
        }}
      />

      {err === "migration_missing" && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {ar ? "شغّلي ترحيل 0052 لتفعيل المدونة." : "Run migration 0052 to enable the blog."}
        </div>
      )}
      {err && err !== "migration_missing" && (
        <div className="mb-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {err === "not_configured"
            ? ar
              ? "لم يتم ربط Supabase."
              : "Supabase is not connected."
            : err}
        </div>
      )}

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder={ar ? "ابحث في المقالات…" : "Search posts…"} />
          <Select value={status} onChange={setStatus}>
            <option value="all">{ar ? "كل الحالات" : "All statuses"}</option>
            <option value="published">{ar ? "منشور" : "Published"}</option>
            <option value="draft">{ar ? "مسودة" : "Draft"}</option>
          </Select>
        </Toolbar>

        {loading ? (
          <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <IcContent className="h-6 w-6" />
            </span>
            <div className="font-semibold text-ink">
              {posts.length === 0
                ? ar
                  ? "لا توجد مقالات بعد"
                  : "No posts yet"
                : ar
                  ? "لا نتائج مطابقة"
                  : "No matching posts"}
            </div>
            <p className="max-w-xs text-sm text-ink-soft">
              {ar ? "اكتب أول مقال ليظهر في مدونة متجرك." : "Write your first article to see it on your store blog."}
            </p>
            <button onClick={() => router.push("/blog/new")} className="btn-primary mt-1">
              <IcPlus className="h-4 w-4" /> {ar ? "مقال جديد" : "New post"}
            </button>
          </div>
        ) : (
          <div className="p-3 pt-0">
            <DataTable
              rows={pg.items}
              columns={columns}
              getKey={(p) => p.id}
              onRowClick={(p) => router.push(`/blog/${p.id}`)}
              flush
              footer={<Pagination {...pg} />}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
