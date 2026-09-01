"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import {
  deleteReview,
  listReviews,
  setReviewFeatured,
  setReviewStatus,
  type ReviewStatus,
  type StoreReview,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import {
  KpiRow,
  StatTile,
  StatusPill,
  Toolbar,
  SearchInput,
  Select,
  ViewTabs,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import { IcStar, IcAlert, IcEye, IcTrash, IcX, IcLink, IcRefresh } from "@/components/icons";

const statusTone: Record<ReviewStatus, PillTone> = {
  pending: "warning",
  published: "success",
  hidden: "neutral",
};

const statusText: Record<ReviewStatus, { ar: string; en: string }> = {
  pending: { ar: "قيد المراجعة", en: "Pending" },
  published: { ar: "منشور", en: "Published" },
  hidden: { ar: "مخفي", en: "Hidden" },
};

type Tab = "all" | ReviewStatus | "featured";

/** Five stars, filled to the rating. */
function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-soft">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IcStar
          key={i}
          className={`h-3.5 w-3.5 ${i <= value ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
        />
      ))}
    </span>
  );
}

const avg = (values: (number | null)[]) => {
  const real = values.filter((v): v is number => v != null);
  return real.length ? real.reduce((s, v) => s + v, 0) / real.length : null;
};

export default function ReviewsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [rows, setRows] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [rating, setRating] = useState<"all" | "5" | "4" | "3" | "low">("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await listReviews();
    if (res.ok) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "featured" ? !r.featured : tab !== "all" && r.status !== tab) return false;
      const overall = avg([r.productRating, r.shippingRating, r.supportRating]);
      if (rating !== "all") {
        if (overall == null) return false;
        if (rating === "low" && overall >= 3) return false;
        if (rating !== "low" && Math.round(overall) !== Number(rating)) return false;
      }
      if (needle) {
        const hay = `${r.reviewerName} ${r.comment ?? ""} ${r.orderNumber ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, tab, rating, q]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${tab}|${rating}|${q}` });

  const kpi = useMemo(() => {
    const overall = avg(rows.flatMap((r) => [r.productRating, r.shippingRating, r.supportRating]));
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      featured: rows.filter((r) => r.featured).length,
      average: overall,
    };
  }, [rows]);

  async function patch(id: string, run: () => Promise<{ ok: boolean; error?: string }>, apply: (r: StoreReview) => StoreReview) {
    setBusy(id);
    const res = await run();
    setBusy(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setRows((cur) => cur.map((r) => (r.id === id ? apply(r) : r)));
  }

  const onStatus = (r: StoreReview, status: ReviewStatus) =>
    patch(r.id, () => setReviewStatus(r.id, status), (cur) => ({
      ...cur,
      status,
      featured: status === "published" ? cur.featured : false,
    }));

  const onFeature = (r: StoreReview) =>
    patch(r.id, () => setReviewFeatured(r.id, !r.featured), (cur) => ({
      ...cur,
      featured: !r.featured,
      status: !r.featured ? "published" : cur.status,
    }));

  async function onDelete(r: StoreReview) {
    if (!window.confirm(ar ? "حذف هذا التقييم؟" : "Delete this review?")) return;
    setBusy(r.id);
    const res = await deleteReview(r.id);
    setBusy(null);
    if (res.ok) setRows((cur) => cur.filter((x) => x.id !== r.id));
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title={t("nav_reviews")}
        subtitle={
          ar
            ? "تقييمات العملاء — اختاري ما يظهر في صفحة العملاء السعداء"
            : "Customer reviews — pick which ones appear on the Happy Customers page"
        }
        actions={
          <>
            <a className="btn-outline" href="/store/happy-customers" target="_blank" rel="noreferrer">
              <IcLink className="h-4 w-4" /> {ar ? "صفحة العملاء السعداء" : "Happy Customers page"}
            </a>
            <a className="btn-outline" href="/shop/reviews" target="_blank" rel="noreferrer">
              <IcEye className="h-4 w-4" /> {ar ? "نموذج التقييم" : "Review form"}
            </a>
            <button className="btn-outline" onClick={load}>
              <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
            </button>
          </>
        }
      />

      {error === "migration_missing" && (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">
              {ar ? "شغّلي ترحيل قاعدة البيانات الخاص بالتقييمات" : "Run the reviews database migration"}
            </div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0017_reviews.sql</code>
          </div>
        </Card>
      )}
      {error && error !== "migration_missing" && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      )}

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile
            icon={IcStar}
            label={ar ? "إجمالي التقييمات" : "Total reviews"}
            value={num(kpi.total, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcStar}
            label={ar ? "المتوسط العام" : "Average rating"}
            value={kpi.average == null ? "—" : `${kpi.average.toFixed(1)} / 5`}
            accent="amber"
          />
          <StatTile
            icon={IcAlert}
            label={ar ? "قيد المراجعة" : "Awaiting review"}
            value={num(kpi.pending, lang)}
            accent="sky"
            active={tab === "pending"}
            onClick={() => setTab(tab === "pending" ? "all" : "pending")}
          />
          <StatTile
            icon={IcStar}
            label={ar ? "في صفحة العملاء السعداء" : "On Happy Customers"}
            value={num(kpi.featured, lang)}
            accent="emerald"
            active={tab === "featured"}
            onClick={() => setTab(tab === "featured" ? "all" : "featured")}
          />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs
            tabs={[
              { key: "all", label: t("filter_all") },
              { key: "pending", label: statusText.pending[ar ? "ar" : "en"] },
              { key: "published", label: statusText.published[ar ? "ar" : "en"] },
              { key: "hidden", label: statusText.hidden[ar ? "ar" : "en"] },
              { key: "featured", label: ar ? "العملاء السعداء" : "Happy Customers" },
            ]}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
          />
        </div>

        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={ar ? "ابحثي بالاسم أو نص التقييم…" : "Search name or comment…"}
          />
          <Select value={rating} onChange={(v) => setRating(v as typeof rating)}>
            <option value="all">{ar ? "كل التقييمات" : "All ratings"}</option>
            <option value="5">★ 5</option>
            <option value="4">★ 4</option>
            <option value="3">★ 3</option>
            <option value="low">{ar ? "أقل من ٣" : "Below 3"}</option>
          </Select>
          {(q || rating !== "all" || tab !== "all") && (
            <button
              onClick={() => { setQ(""); setRating("all"); setTab("all"); }}
              className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
            >
              <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
            </button>
          )}
          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="w-12 ps-5 pe-2 py-3 text-start font-medium" title={ar ? "العملاء السعداء" : "Happy Customers"}>
                  ★
                </th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "العميل" : "Reviewer"}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "المنتج" : "Product"}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "الشحن" : "Shipping"}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "الدعم" : "Support"}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "التعليق" : "Comment"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_date")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-5 py-3 text-end font-medium" />
              </tr>
            </thead>
            <tbody>
              {pg.items.map((r) => (
                <tr key={r.id} className={`group border-b border-line transition-colors last:border-0 hover:bg-surface-page ${busy === r.id ? "opacity-50" : ""}`}>
                  <td className="ps-5 pe-2 py-3">
                    <button
                      onClick={() => onFeature(r)}
                      title={
                        r.featured
                          ? ar ? "إزالة من صفحة العملاء السعداء" : "Remove from Happy Customers"
                          : ar ? "إضافة إلى صفحة العملاء السعداء" : "Add to Happy Customers"
                      }
                      className="rounded-lg p-1 transition-colors hover:bg-surface-hover"
                    >
                      <IcStar
                        className={`h-5 w-5 ${r.featured ? "text-amber-500" : "text-slate-300 hover:text-amber-400 dark:text-slate-600"}`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.reviewerName} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{r.reviewerName}</div>
                        {(r.orderNumber || r.phone) && (
                          <div className="truncate text-xs text-ink-soft" dir="ltr">
                            {r.orderNumber ? `#${r.orderNumber}` : r.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Stars value={r.productRating} /></td>
                  <td className="px-3 py-3"><Stars value={r.shippingRating} /></td>
                  <td className="px-3 py-3"><Stars value={r.supportRating} /></td>
                  <td className="max-w-[280px] px-3 py-3">
                    <p className="line-clamp-2 text-ink-muted">{r.comment || "—"}</p>
                    {r.experienceLevel && (
                      <span className="badge mt-1 bg-slate-500/10 text-slate-600 dark:text-slate-300">
                        {r.experienceLevel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <StatusPill label={statusText[r.status][ar ? "ar" : "en"]} tone={statusTone[r.status]} />
                  </td>
                  <td className="px-5 py-3 text-end">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== "published" && (
                        <button
                          onClick={() => onStatus(r, "published")}
                          className="btn-ghost h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                        >
                          {ar ? "نشر" : "Publish"}
                        </button>
                      )}
                      {r.status !== "hidden" && (
                        <button
                          onClick={() => onStatus(r, "hidden")}
                          className="btn-ghost h-8 px-2 text-xs text-ink-muted"
                        >
                          {ar ? "إخفاء" : "Hide"}
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(r)}
                        className="btn-ghost h-8 w-8 p-0 text-rose-600 opacity-0 hover:bg-rose-50 group-hover:opacity-100"
                        aria-label="delete"
                      >
                        <IcTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <div className="py-14 text-center text-sm text-ink-soft">{t("loading")}</div>}
          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcStar className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {ar ? "لا توجد تقييمات بعد" : "No reviews yet"}
                </div>
                <p className="mt-1 max-w-sm text-sm text-ink-soft">
                  {ar
                    ? "التقييمات المُرسلة من نموذج المتجر تظهر هنا للمراجعة."
                    : "Reviews submitted from the storefront form land here for moderation."}
                </p>
              </div>
            </div>
          )}
        </div>

        {!loading && <Pagination {...pg} />}
      </Card>
    </>
  );
}
