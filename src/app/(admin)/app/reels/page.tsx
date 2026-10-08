"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import { IcEye, IcStar, IcTrash, IcUpload, IcVideo, IcX, IcEdit } from "@/components/icons";
import {
  attachReelVideoAction,
  createReelAction,
  deleteReelAction,
  listReelsAction,
  productOptionsAction,
  reelUploadAction,
  setReelProductsAction,
  setReelVisibleAction,
  type ProductOption,
  type ReelRow,
} from "./actions";

/**
 * Reels: the videos the app's Reels tab shows.
 *
 * Kept lives arrive here by themselves; this is also where a video made
 * anywhere else — a phone clip, an edited ad — is uploaded as a reel, with the
 * products it sells. The numbers are the real ones: a view is a viewer who let
 * the reel play for two seconds, a like is a heart somebody tapped.
 */

/** Choose products: type to find, tap to add, x to take away. */
function ProductPicker({
  options,
  selected,
  onChange,
  ar,
}: {
  options: ProductOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  ar: boolean;
}) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.itemId, o])), [options]);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? options.filter((o) => !selected.includes(o.itemId) && o.name.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pe-1 ps-2.5 text-xs text-brand-700">
              {byId.get(id)?.name ?? id}
              <button
                type="button"
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-brand-100"
                onClick={() => onChange(selected.filter((x) => x !== id))}
                aria-label="Remove"
              >
                <IcX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحثي عن منتج لإضافته…" : "Search a product to add…"} />
      {matches.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-line">
          {matches.map((o) => (
            <li key={o.itemId}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-surface-hover"
                onClick={() => {
                  onChange([...selected, o.itemId]);
                  setQ("");
                }}
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-surface-page">
                  {o.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{o.name}</span>
                <span className="text-xs text-ink-soft">EGP {num(o.price, "en")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReelsAdminPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [reels, setReels] = useState<ReelRow[] | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [stage, setStage] = useState<"idle" | "creating" | "uploading" | "done">("idle");
  const [editing, setEditing] = useState<string | null>(null);
  const [editIds, setEditIds] = useState<string[]>([]);

  const load = () => listReelsAction().then((r) => (r.ok ? setReels(r.data) : setError(r.error)));
  useEffect(() => {
    load();
    productOptionsAction().then(setOptions);
  }, []);

  async function upload() {
    if (!file || !title.trim()) return;
    setError(null);
    setStage("creating");
    const made = await createReelAction({ title, itemIds });
    if (!made.ok) {
      setStage("idle");
      return setError(made.error);
    }
    setStage("uploading");
    try {
      const extension = (file.name.split(".").pop() || "mp4").toLowerCase();
      const slot = await reelUploadAction(made.data.id, extension);
      if (!slot.ok) throw new Error(slot.error);
      // Straight from this browser to storage: a video is far bigger than a
      // request to our own server may be.
      const { error: upErr } = await getBrowserSupabase()
        .storage.from(slot.data.bucket)
        .uploadToSignedUrl(slot.data.path, slot.data.token, file, { contentType: file.type || "video/mp4", cacheControl: "31536000" });
      if (upErr) throw upErr;
      const attached = await attachReelVideoAction(made.data.id, slot.data.publicUrl);
      if (!attached.ok) throw new Error(attached.error);
      setStage("done");
      setTitle("");
      setFile(null);
      setItemIds([]);
      setOpen(false);
      load();
      setTimeout(() => setStage("idle"), 4000);
    } catch (e) {
      setStage("idle");
      const raw = (e as Error).message;
      setError(
        /maximum allowed size|exceeded|too large|413/i.test(raw)
          ? ar
            ? "الفيديو أكبر من حد الرفع في Supabase. ارفعي الحد من Storage ← Settings ثم حاولي مرة أخرى."
            : "The video is bigger than Supabase's upload limit. Raise it in Storage → Settings, then try again."
          : raw,
      );
      // The empty reel is of no use without its video.
      await deleteReelAction(made.data.id);
      load();
    }
  }

  async function toggle(r: ReelRow) {
    const res = await setReelVisibleAction(r.id, !r.visible);
    if (!res.ok) return setError(res.error);
    setReels((list) => (list ?? []).map((x) => (x.id === r.id ? { ...x, visible: !r.visible } : x)));
  }

  async function remove(r: ReelRow) {
    if (!confirm(ar ? `حذف "${r.title}" والفيديو الخاص به؟` : `Delete "${r.title}" and its video?`)) return;
    const res = await deleteReelAction(r.id);
    if (!res.ok) return setError(res.error);
    setReels((list) => (list ?? []).filter((x) => x.id !== r.id));
  }

  async function saveProducts(id: string) {
    const res = await setReelProductsAction(id, editIds);
    if (!res.ok) return setError(res.error);
    setEditing(null);
    load();
  }

  const totals = useMemo(
    () => ({
      views: (reels ?? []).reduce((n, r) => n + r.views, 0),
      likes: (reels ?? []).reduce((n, r) => n + r.likes, 0),
    }),
    [reels],
  );

  const busy = stage === "creating" || stage === "uploading";

  return (
    <>
      <PageHeader
        title={ar ? "الريلز" : "Reels"}
        subtitle={ar ? "الفيديوهات التي تظهر في تبويب الريلز بالتطبيق" : "The videos in the app's Reels tab"}
        primary={{
          label: ar ? "رفع ريل" : "Upload reel",
          onClick: () => setOpen(true),
          icon: <IcUpload className="h-4 w-4" />,
        }}
      />

      <div className="mb-4">
        <KpiRow cols={3}>
          <StatTile icon={IcVideo} label={ar ? "الريلز" : "Reels"} value={num(reels?.length ?? 0, lang)} accent="brand" />
          <StatTile icon={IcEye} label={ar ? "المشاهدات" : "Views"} value={num(totals.views, lang)} accent="sky" />
          <StatTile icon={IcStar} label={ar ? "الإعجابات" : "Likes"} value={num(totals.likes, lang)} accent="emerald" />
        </KpiRow>
      </div>

      {error && (
        <Card className="mb-4 p-4 text-sm text-rose-600">
          {error === "migration_missing"
            ? ar
              ? "شغّلي ملف قاعدة البيانات 0055_reel_views_uploads.sql في Supabase ثم حدّثي الصفحة."
              : "Run the database file 0055_reel_views_uploads.sql in Supabase, then refresh this page."
            : error}
        </Card>
      )}

      {stage === "done" && (
        <Card className="mb-4 p-4 text-sm text-emerald-700">
          {ar
            ? "تم رفع الريل. يظهر في التطبيق الآن، ويصبح أسرع خلال دقائق بعد تحويله للبث."
            : "Reel uploaded. It is in the app now, and gets faster within minutes once it is converted for streaming."}
        </Card>
      )}

      {open && (
        <Card className="mb-5 space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{ar ? "ريل جديد" : "New reel"}</h3>
            {!busy && (
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setOpen(false)} aria-label="Close">
                <IcX className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "العنوان" : "Title"}</span>
            <input className="inp mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ar ? "مثلاً: تنسيقات الصيف" : "e.g. Summer looks"} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "الفيديو" : "Video"}</span>
            <input
              type="file"
              accept="video/*"
              className="mt-1.5 block w-full text-sm text-ink file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="mt-1 block text-xs text-ink-soft">
              {ar ? "فيديو عمودي (9:16) يظهر بأفضل شكل." : "A vertical (9:16) video looks best."}
              {file ? ` · ${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
            </span>
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "المنتجات في هذا الريل" : "Products in this reel"}
            </span>
            <ProductPicker options={options} selected={itemIds} onChange={setItemIds} ar={ar} />
          </div>
          <button className="btn-primary h-10 px-5" disabled={busy || !file || !title.trim()} onClick={upload}>
            {stage === "creating"
              ? ar
                ? "جارٍ الإنشاء…"
                : "Creating…"
              : stage === "uploading"
                ? ar
                  ? "جارٍ رفع الفيديو… قد يستغرق دقيقة"
                  : "Uploading the video… this can take a minute"
                : ar
                  ? "رفع ونشر"
                  : "Upload and publish"}
          </button>
        </Card>
      )}

      {reels === null ? (
        <div className="py-16 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : reels.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-soft">
          {ar ? "لا توجد ريلز بعد. ارفعي أول فيديو." : "No reels yet. Upload your first video."}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {reels.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <div className="relative aspect-[3/4] bg-surface-page">
                {r.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumb} alt="" className={`h-full w-full object-cover ${r.visible ? "" : "opacity-40"}`} />
                )}
                <div className="absolute start-2 top-2 flex flex-wrap gap-1">
                  <Badge className="bg-black/60 text-white">{r.kind === "upload" ? (ar ? "مرفوع" : "Uploaded") : ar ? "من بث" : "From a live"}</Badge>
                  {!r.ready && r.hasVideo && <Badge className="bg-amber-500/90 text-white">{ar ? "يتم التحويل" : "Converting"}</Badge>}
                  {!r.visible && <Badge className="bg-slate-700/90 text-white">{ar ? "مخفي" : "Hidden"}</Badge>}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-sm font-semibold text-white">
                  <span className="inline-flex items-center gap-1">
                    <IcEye className="h-4 w-4" /> {num(r.views, lang)}
                  </span>
                  <span className="inline-flex items-center gap-1">♥ {num(r.likes, lang)}</span>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold text-ink">{r.title}</div>
                <div className="text-xs text-ink-soft">
                  {num(r.products.length, lang)} {ar ? "منتج" : r.products.length === 1 ? "product" : "products"}
                </div>

                {editing === r.id ? (
                  <div className="space-y-2">
                    <ProductPicker options={options} selected={editIds} onChange={setEditIds} ar={ar} />
                    <div className="flex gap-2">
                      <button className="btn-primary h-8 flex-1 text-xs" onClick={() => saveProducts(r.id)}>
                        {ar ? "حفظ" : "Save"}
                      </button>
                      <button className="btn-ghost h-8 px-2 text-xs" onClick={() => setEditing(null)}>
                        {ar ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn-outline h-8 px-2 text-xs" onClick={() => toggle(r)}>
                      {r.visible ? (ar ? "إخفاء" : "Hide") : ar ? "إظهار" : "Show"}
                    </button>
                    <button
                      className="btn-outline h-8 gap-1 px-2 text-xs"
                      onClick={() => {
                        setEditing(r.id);
                        setEditIds(r.products.map((p) => p.itemId).filter((v): v is string => Boolean(v)));
                      }}
                    >
                      <IcEdit className="h-3.5 w-3.5" /> {ar ? "المنتجات" : "Products"}
                    </button>
                    <button className="btn-ghost h-8 px-2 text-xs text-rose-600" onClick={() => remove(r)} aria-label="Delete">
                      <IcTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
