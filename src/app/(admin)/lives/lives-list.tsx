"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  deliveredMinutes,
  isTestStream,
  estimatedCost,
  STATUS_LABELS,
  type LiveStatus,
  type LiveStream,
} from "@/lib/live";
import {
  deleteLiveAction,
  listLivesAction,
  pinLiveProductAction,
  postHostMessageAction,
  prepareLiveAction,
  providerStatusAction,
  refreshRecordingAction,
  saveLiveAction,
  collectionProductsAction,
  listLiveCollectionsAction,
  setLiveProductsAction,
  setLiveStatusAction,
  useTestStreamAction,
} from "./actions";
import { listStoreProducts, type StoreProduct } from "../../store/actions";
import type { LiveCollection } from "@/lib/live-service";
import { CameraCheck } from "./camera-check";
import { Broadcast } from "./broadcast";
import { HostComments } from "./host-comments";
import { useLiveChat } from "@/lib/live-chat";
import { ImagePicker } from "@/components/image-picker";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  KpiRow,
  StatTile,
  StatusPill,
  Toolbar,
  SearchInput,
  Select,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import {
  IcVideo,
  IcAlert,
  IcPlus,
  IcX,
  IcTrash,
  IcCopy,
  IcRefresh,
  IcEye,
  IcImage,
} from "@/components/icons";

const statusTone: Record<LiveStatus, PillTone> = {
  scheduled: "info",
  live: "critical", // red, because it means the camera is on right now
  ended: "neutral",
  cancelled: "neutral",
};

/** Cloudflare's published rate, per thousand delivered minutes. */
const RATE_PER_1000_MIN = 1;

export function LivesList() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [rows, setRows] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<"all" | LiveStatus>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<LiveStream | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const [res, prov] = await Promise.all([listLivesAction(), providerStatusAction()]);
    setProvider(prov.configured);
    setMissing(prov.missing ?? []);
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
      if (status !== "all" && r.status !== status) return false;
      if (needle && !`${r.title} ${r.hostName ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, q]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${status}|${q}` });

  const kpi = useMemo(() => {
    const onAir = rows.filter((r) => r.status === "live").length;
    const upcoming = rows.filter((r) => r.status === "scheduled").length;
    const minutes = rows.reduce(
      (s, r) => s + deliveredMinutes(r.peakViewers, r.startedAt, r.endedAt),
      0,
    );
    return { onAir, upcoming, total: rows.length, spend: estimatedCost(minutes, RATE_PER_1000_MIN) };
  }, [rows]);

  function replace(next: LiveStream) {
    setRows((cur) => (cur.some((r) => r.id === next.id) ? cur.map((r) => (r.id === next.id ? next : r)) : [next, ...cur]));
    setOpen((cur) => (cur && cur.id === next.id ? next : cur));
  }

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString(ar ? "ar-EG" : "en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <>
      <PageHeader
        title={ar ? "البث المباشر" : "Lives"}
        subtitle={
          ar
            ? "بث مباشر داخل التطبيق — جدوليه، ثبّتي المنتجات، وابدئي"
            : "Live shopping in the app — schedule it, pin the products, go on air"
        }
        actions={
          <>
            <button className="btn-outline" onClick={load}>
              <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
            </button>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <IcPlus className="h-4 w-4" /> {ar ? "بث جديد" : "New live"}
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
              {ar ? "شغّلي ترحيل قاعدة البيانات الخاص بالبث" : "Run the lives database migration"}
            </div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0032_lives.sql</code>
          </div>
        </Card>
      )}
      {error && error !== "migration_missing" && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      )}

      {/* The streaming account is the one thing that cannot be faked from here,
          so say exactly what is missing rather than failing at air time. */}
      {provider === false && (
        <Card className="mb-4 flex items-start gap-3 bg-sky-50/70 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-sky-600 shadow-card">
            <IcVideo className="h-4 w-4" />
          </span>
          <div className="text-sm text-sky-900">
            <div className="font-medium">
              {ar ? "حساب البث غير مربوط بعد" : "Streaming account not connected yet"}
            </div>
            <p className="mt-1 text-sky-800/90">
              {ar
                ? "يمكنك جدولة البث وتجهيز المنتجات الآن. للبث فعلياً يحتاج الخادم إلى المتغيّرات التالية:"
                : "You can schedule lives and line up products now. To actually broadcast, the server needs these variables:"}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {(missing.length ? missing : ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_TOKEN"]).map((name) => (
                <li key={name} className="font-mono text-[11px] text-sky-900">
                  {name}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-sky-800/80">
              {ar
                ? "إن كانت مضافة بالفعل: تأكدي أنها على بيئة Production وأن النشر تم بعد إضافتها."
                : "If they are already added: check they are on the Production environment and that the deploy happened after adding them."}
            </p>
          </div>
        </Card>
      )}

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile
            icon={IcVideo}
            label={ar ? "على الهواء الآن" : "On air now"}
            value={num(kpi.onAir, lang)}
            accent={kpi.onAir > 0 ? "rose" : "slate"}
          />
          <StatTile
            icon={IcEye}
            label={ar ? "بث قادم" : "Scheduled"}
            value={num(kpi.upcoming, lang)}
            accent="sky"
            active={status === "scheduled"}
            onClick={() => setStatus(status === "scheduled" ? "all" : "scheduled")}
          />
          <StatTile
            icon={IcVideo}
            label={ar ? "إجمالي البثوث" : "Total lives"}
            value={num(kpi.total, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcAlert}
            label={ar ? "تكلفة البث التقديرية" : "Estimated streaming cost"}
            value={`$${kpi.spend.toFixed(2)}`}
            sub={ar ? "حسب دقائق المشاهدة" : "from minutes watched"}
            accent="amber"
          />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={ar ? "ابحثي بالعنوان أو المقدّمة…" : "Search title or host…"}
          />
          <Select value={status} onChange={(v) => setStatus(v as "all" | LiveStatus)}>
            <option value="all">{t("col_status")}: {t("filter_all")}</option>
            {(Object.keys(STATUS_LABELS) as LiveStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s][ar ? "ar" : "en"]}</option>
            ))}
          </Select>
          {(q || status !== "all") && (
            <button
              onClick={() => { setQ(""); setStatus("all"); }}
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
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{ar ? "البث" : "Live"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "الموعد" : "When"}</th>
                <th className="px-3 py-3 text-end font-medium">{ar ? "أعلى مشاهدة" : "Peak viewers"}</th>
                <th className="px-3 py-3 text-end font-medium">{ar ? "منتجات" : "Products"}</th>
                <th className="px-5 py-3 text-end font-medium" />
              </tr>
            </thead>
            <tbody>
              {pg.items.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpen(r)}
                  className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-page"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                        {r.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <IcVideo className="h-4 w-4 text-ink-soft" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{r.title}</div>
                        {r.hostName && <div className="truncate text-xs text-ink-soft">{r.hostName}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusPill label={STATUS_LABELS[r.status][ar ? "ar" : "en"]} tone={statusTone[r.status]} />
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{fmtDate(r.scheduledAt ?? r.startedAt)}</td>
                  <td className="px-3 py-3.5 text-end text-ink">{num(r.peakViewers, lang)}</td>
                  <td className="px-3 py-3.5 text-end text-ink-muted">{num(r.products.length, lang)}</td>
                  <td className="px-5 py-3.5 text-end" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpen(r)} className="btn-ghost h-8 px-2 text-xs">
                      {ar ? "فتح" : "Open"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <div className="py-14 text-center text-sm text-ink-soft">{t("loading")}</div>}
          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcVideo className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">{ar ? "لا يوجد بث بعد" : "No lives yet"}</div>
                <p className="mt-1 max-w-sm text-sm text-ink-soft">
                  {ar
                    ? "جدولي بثاً، ثبّتي المنتجات التي ستعرضينها، وسيظهر في تبويب البث داخل التطبيق."
                    : "Schedule one, pin the products you will show, and it appears in the app's Live tab."}
                </p>
              </div>
              <button className="btn-primary mt-1" onClick={() => setCreating(true)}>
                <IcPlus className="h-4 w-4" /> {ar ? "بث جديد" : "New live"}
              </button>
            </div>
          )}
        </div>

        {!loading && <Pagination {...pg} />}
      </Card>

      {creating && (
        <LiveForm
          ar={ar}
          onClose={() => setCreating(false)}
          onSaved={(live) => {
            replace(live);
            setCreating(false);
            setOpen(live);
          }}
        />
      )}

      {open && (
        <LiveDrawer
          live={open}
          ar={ar}
          lang={lang}
          providerReady={provider === true}
          onClose={() => setOpen(null)}
          onChanged={replace}
          onDeleted={(id) => {
            setRows((cur) => cur.filter((r) => r.id !== id));
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------- new / edit ------------------------------- */

function LiveForm({
  ar,
  live,
  onClose,
  onSaved,
}: {
  ar: boolean;
  live?: LiveStream;
  onClose: () => void;
  onSaved: (live: LiveStream) => void;
}) {
  const [title, setTitle] = useState(live?.title ?? "");
  const [subtitle, setSubtitle] = useState(live?.subtitle ?? "");
  const [hostName, setHostName] = useState(live?.hostName ?? "");
  const [coverUrl, setCoverUrl] = useState(live?.coverUrl ?? "");
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const [when, setWhen] = useState(
    live?.scheduledAt ? new Date(live.scheduledAt).toISOString().slice(0, 16) : "",
  );
  const [replay, setReplay] = useState(live?.replayEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [collections, setCollections] = useState<LiveCollection[]>([]);
  const [picking, setPicking] = useState(false);
  const [addingCollection, setAddingCollection] = useState<string | null>(null);
  // Products pulled in from a collection, kept apart from the ticked ones so
  // a collection can be added without losing a hand-picked item.
  const [fromCollection, setFromCollection] = useState<
    { itemId: string; productName: string; imageUrl: string | null; price: number | null }[]
  >([]);

  useEffect(() => {
    listStoreProducts().then((res) => {
      if (res.ok) setCatalog(res.data);
    });
    listLiveCollectionsAction().then((res) => {
      if (res.ok) setCollections(res.data);
    });
  }, []);

  async function addCollection(id: string) {
    if (!id) return;
    setAddingCollection(id);
    const res = await collectionProductsAction(id);
    setAddingCollection(null);
    if (!res.ok) return;
    setFromCollection((cur) => {
      const byId = new Map(cur.map((c) => [c.itemId, c]));
      for (const prod of res.data) {
        if (!prod.itemId) continue;
        byId.set(prod.itemId, {
          itemId: prod.itemId,
          productName: prod.productName,
          imageUrl: prod.imageUrl,
          price: prod.price,
        });
      }
      return [...byId.values()];
    });
  }

  const picked = catalog.filter((c) => chosen[c.id]);
  const shownProducts = (() => {
    const needle = search.trim().toLowerCase();
    const list = needle ? catalog.filter((c) => c.name.toLowerCase().includes(needle)) : catalog;
    return list.slice(0, 40);
  })();

  async function save() {
    setErr(null);
    setBusy(true);
    const res = await saveLiveAction({
      id: live?.id,
      title,
      subtitle,
      hostName,
      coverUrl,
      scheduledAt: when ? new Date(when).toISOString() : null,
      replayEnabled: replay,
    });
    if (!res.ok) {
      setBusy(false);
      setErr(res.error === "missing_title" ? (ar ? "أدخلي عنواناً" : "Enter a title") : res.error);
      return;
    }

    // A live is advertised by its products, so they are chosen here rather
    // than left for a second visit: the host picks what she will hold up
    // before she has a stream key, let alone a camera pointed at her.
    let saved = res.data;
    // Ticked products and whole collections end up in one list, with an item
    // that appears in both counted once.
    const byItem = new Map<string, { itemId: string; productName: string; imageUrl: string | null; price: number | null; discountCode: string | null }>();
    for (const c of picked) {
      byItem.set(c.id, {
        itemId: c.id,
        productName: c.name,
        imageUrl: c.image,
        price: c.priceMin,
        discountCode: null,
      });
    }
    for (const c of fromCollection) {
      if (!byItem.has(c.itemId)) {
        byItem.set(c.itemId, { ...c, discountCode: null });
      }
    }
    if (byItem.size > 0) {
      const withProducts = await setLiveProductsAction(saved.id, [...byItem.values()]);
      if (withProducts.ok) saved = withProducts.data;
    }
    setBusy(false);
    onSaved(saved);
  }

  const field = "h-11 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">
            {live ? (ar ? "تعديل البث" : "Edit live") : ar ? "بث جديد" : "New live"}
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0"><IcX className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-muted">{ar ? "العنوان" : "Title"}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">{ar ? "وصف قصير" : "Subtitle"}</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted">{ar ? "المقدّمة" : "Host"}</label>
              <input value={hostName} onChange={(e) => setHostName(e.target.value)} className={`${field} mt-1`} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{ar ? "الموعد" : "Scheduled for"}</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} mt-1`} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted">
              {ar ? "صورة الغلاف" : "Cover image"}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-page"
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IcImage className="h-5 w-5 text-ink-soft" />
                )}
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPicking(true)} className="btn-outline h-9 px-3 text-xs">
                  {coverUrl ? (ar ? "تغيير" : "Change") : ar ? "اختاري صورة" : "Choose image"}
                </button>
                {coverUrl && (
                  <button type="button" onClick={() => setCoverUrl("")} className="btn-ghost h-9 px-2 text-xs text-ink-muted">
                    {ar ? "إزالة" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand-600" />
            {ar ? "احفظي التسجيل ليُشاهد بعد البث" : "Keep the replay so it sells afterwards"}
          </label>

          <div>
            <label className="text-xs font-medium text-ink-muted">
              {ar ? "المنتجات التي سيعرضها البث" : "Products this live advertises"}
            </label>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {ar
                ? "يمكن للمشاهدين إضافة أي منها للسلة أثناء البث وإتمام الطلب."
                : "Viewers can add any of these to their cart during the live and check out."}
            </p>

            {collections.length > 0 && (
              <div className="mt-2">
                <select
                  value=""
                  onChange={(e) => addCollection(e.target.value)}
                  disabled={Boolean(addingCollection)}
                  className={field}
                >
                  <option value="">
                    {addingCollection
                      ? (ar ? "جارٍ الإضافة…" : "Adding…")
                      : ar ? "أضيفي تصنيفاً كاملاً…" : "Add a whole collection…"}
                  </option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.productCount})
                    </option>
                  ))}
                </select>
                {fromCollection.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span>
                      {fromCollection.length}{" "}
                      {ar ? "منتج من التصنيفات" : "added from collections"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFromCollection([])}
                      className="text-rose-600 hover:underline"
                    >
                      {ar ? "إزالة" : "Clear"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ar ? "ابحثي عن منتج…" : "Search products…"}
              className={`${field} mt-2`}
            />
            <div className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {shownProducts.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(chosen[c.id])}
                    onChange={(e) => setChosen((cur) => ({ ...cur, [c.id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-line accent-brand-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                  <span className="shrink-0 text-xs text-ink-soft">{c.available}</span>
                </label>
              ))}
              {shownProducts.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-ink-soft">
                  {ar ? "لا توجد نتائج" : "No matches"}
                </p>
              )}
            </div>
            {picked.length > 0 && (
              <p className="mt-1.5 text-xs text-ink-muted">
                {picked.length} {ar ? "منتج مختار" : "selected"}
              </p>
            )}
          </div>
        </div>

        {picking && (
          <ImagePicker
            value={coverUrl}
            onChange={setCoverUrl}
            onClose={() => setPicking(false)}
            ar={ar}
            title={ar ? "صورة غلاف البث" : "Live cover image"}
          />
        )}

        {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "حفظ" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- drawer --------------------------------- */

function LiveDrawer({
  live,
  ar,
  lang,
  providerReady,
  onClose,
  onChanged,
  onDeleted,
}: {
  live: LiveStream;
  ar: boolean;
  lang: "ar" | "en";
  providerReady: boolean;
  onClose: () => void;
  onChanged: (live: LiveStream) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [picker, setPicker] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // One chat for the drawer and the broadcast panel together. Realtime
  // refuses a second connection to the same channel, and the refusal is
  // silent: the count stops at zero and comments fall back to polling.
  const chat = useLiveChat(live.id, {
    enabled: live.status === "live",
    keep: 100,
    role: "host",
    postVia: async ({ authorName, body }) => {
      const res = await postHostMessageAction(live.id, authorName, body);
      return res.ok ? res.data : null;
    },
  });

  // The host is the observer always present, so the peak is reported here.
  useEffect(() => {
    if (live.status !== "live" || chat.viewers <= 0) return;
    const t = setTimeout(() => {
      fetch(`/api/storefront/lives/${live.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewers: chat.viewers }),
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [chat.viewers, live.status, live.id]);
  const [broadcasting, setBroadcasting] = useState(false);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    setErr(null);
    setBusy(label);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setErr(
        res.error === "provider_not_configured"
          ? ar
            ? "أضيفي بيانات Cloudflare في إعدادات البيئة أولاً."
            : "Add your Cloudflare credentials to the environment first."
          : res.error === "not_prepared"
            ? ar
              ? "جهّزي البث أولاً للحصول على مفتاح البث."
              : "Prepare the live first to get a stream key."
            : (res.error ?? null),
      );
      return;
    }
    if (res.data) onChanged(res.data as LiveStream);
  }

  const minutes = deliveredMinutes(live.peakViewers, live.startedAt, live.endedAt);
  const copy = (v: string) => navigator.clipboard?.writeText(v);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-ink">{live.title}</h2>
              <StatusPill label={STATUS_LABELS[live.status][ar ? "ar" : "en"]} tone={statusTone[live.status]} />
              {isTestStream(live) && (
                <span className="badge bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {ar ? "فيديو تجريبي" : "Test stream"}
                </span>
              )}
            </div>
            {live.subtitle && <p className="mt-0.5 truncate text-sm text-ink-muted">{live.subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 shrink-0 p-0"><IcX className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

          {/* Going on air */}
          <section className="rounded-2xl border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">{ar ? "البث" : "Broadcast"}</h3>
            {!live.streamKey ? (
              <>
                <p className="mt-1 text-sm text-ink-muted">
                  {ar
                    ? "جهّزي البث أولاً، ثم يظهر زر البدء والكاميرا تفتح هنا مباشرة."
                    : "Prepare the live first — then the camera opens right here and one button starts it."}
                </p>
                <button
                  onClick={() => run("prepare", () => prepareLiveAction(live.id))}
                  disabled={busy === "prepare" || !providerReady}
                  className="btn-primary mt-3 h-10 px-4 text-sm disabled:opacity-50"
                >
                  {busy === "prepare" ? (ar ? "جارٍ التجهيز…" : "Preparing…") : ar ? "تجهيز البث" : "Prepare live"}
                </button>
                {!providerReady && (
                  <div className="mt-3 rounded-xl border border-dashed border-line p-3">
                    <p className="text-xs text-ink-soft">
                      {ar
                        ? "لا يوجد حساب بث بعد. يمكنك تجربة كل شيء — البدء، الدردشة، تثبيت المنتج، الإنهاء، التسجيل — على مقطع جاهز. ملاحظة: هذا ليس كاميرتك، بل فيديو ثابت لتجربة الخطوات فقط."
                        : "No streaming account yet. You can rehearse everything — going on air, chat, pinning, ending, the replay — on a fixed clip. Note it is NOT your camera: it is a stand-in so the steps can be walked."}
                    </p>
                    <button
                      onClick={() => run("test", () => useTestStreamAction(live.id))}
                      disabled={busy === "test"}
                      className="btn-outline mt-2 h-9 px-3 text-xs"
                    >
                      {ar ? "استخدمي فيديو تجريبي" : "Use a test stream"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {live.whipUrl && live.status !== "ended" && (
                  <>
                    <button
                      onClick={() => setBroadcasting(true)}
                      className="mt-3 h-12 w-full rounded-xl bg-rose-600 text-base font-semibold text-white transition hover:bg-rose-700"
                    >
                      {ar ? "ابدئي البث من هذا الهاتف" : "Go live from this phone"}
                    </button>
                    <p className="mt-1.5 text-center text-xs text-ink-soft">
                      {ar
                        ? "الكاميرا تفتح هنا — لا حاجة لأي تطبيق آخر."
                        : "The camera opens right here — no other app needed."}
                    </p>
                  </>
                )}

                {/* Kept, not pushed: a broadcasting app is one way to reach
                    the same input, and some hosts prefer one. It is not the
                    way this shop broadcasts, so it waits behind a line. */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-ink-soft">
                    {ar ? "أو استخدمي تطبيق بث خارجي" : "Or use an external broadcasting app"}
                  </summary>
                  <div className="mt-2 space-y-2 text-sm">
                {/* A phone app wants one address with the key on the end —
                    its URL schema is server/application/streamkey. Asking
                    someone to copy two fields and join them by hand, on a
                    phone, is how the first attempt fails. */}
                <KeyRow
                  label={ar ? "الرابط الكامل (لتطبيق الهاتف)" : "Full URL (for the phone app)"}
                  value={showKey ? fullIngestUrl(live) : "•".repeat(30)}
                  secret
                  revealed={showKey}
                  onReveal={() => setShowKey((v) => !v)}
                  onCopy={() => copy(fullIngestUrl(live))}
                  ar={ar}
                />
                <KeyRow
                  label={ar ? "عنوان البث (لبرامج الكمبيوتر)" : "Server URL (for desktop apps)"}
                  value={live.ingestUrl ?? ""}
                  onCopy={copy}
                  ar={ar}
                />
                <KeyRow
                  label={ar ? "مفتاح البث" : "Stream key"}
                  value={showKey ? live.streamKey : "•".repeat(24)}
                  secret
                  revealed={showKey}
                  onReveal={() => setShowKey((v) => !v)}
                  onCopy={() => copy(live.streamKey ?? "")}
                  ar={ar}
                />
                    <p className="pt-1 text-xs text-ink-soft">
                      {ar
                        ? "الصقي «الرابط الكامل» في خانة URL بتطبيق الهاتف. الحقلان الآخران لبرامج الكمبيوتر التي تطلبهما منفصلين."
                        : "Paste the full URL into the phone app's URL field. The two below are for desktop software that asks for them separately."}
                    </p>
                  </div>
                </details>
              </>
            )}


            <div className="mt-4 flex flex-wrap gap-2">
              {live.status !== "live" && live.status !== "ended" && (
                <button
                  onClick={() => run("live", () => setLiveStatusAction(live.id, "live"))}
                  disabled={busy === "live"}
                  className="btn-primary h-10 px-4 text-sm disabled:opacity-50"
                >
                  {ar ? "ابدئي البث" : "Go live"}
                </button>
              )}
              {live.status === "live" && (
                <button
                  onClick={() => run("end", () => setLiveStatusAction(live.id, "ended"))}
                  disabled={busy === "end"}
                  className="btn-outline h-10 px-4 text-sm"
                >
                  {ar ? "إنهاء البث" : "End live"}
                </button>
              )}
              {live.status === "ended" && live.replayEnabled && (
                <button
                  onClick={() => run("rec", async () => {
                    const r = await refreshRecordingAction(live.id);
                    return r.ok ? { ok: true } : r;
                  })}
                  disabled={busy === "rec"}
                  className="btn-outline h-10 px-4 text-sm"
                >
                  <IcRefresh className="h-4 w-4" /> {ar ? "تحديث التسجيل" : "Check for replay"}
                </button>
              )}
              <a
                href={`/store/live/${live.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline h-10 px-4 text-sm"
              >
                <IcEye className="h-4 w-4" /> {ar ? "صفحة المشاهدة" : "Viewer page"}
              </a>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/store/live/${live.id}`;
                  navigator.clipboard?.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="btn-outline h-10 px-4 text-sm"
              >
                <IcCopy className="h-4 w-4" />
                {copied ? (ar ? "تم النسخ" : "Copied") : ar ? "نسخ الرابط" : "Copy link"}
              </button>
              <button onClick={() => setChecking(true)} className="btn-outline h-10 px-4 text-sm">
                {ar ? "فحص الكاميرا" : "Camera check"}
              </button>
              <button onClick={() => setEditing(true)} className="btn-outline h-10 px-4 text-sm">
                {ar ? "تعديل" : "Edit"}
              </button>
            </div>
          </section>

          {/* Products on air */}
          <section className="rounded-2xl border border-line p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{ar ? "المنتجات المعروضة" : "Products on air"}</h3>
              <button onClick={() => setPicker(true)} className="btn-outline h-8 px-2.5 text-xs">
                <IcPlus className="h-3.5 w-3.5" /> {ar ? "إضافة" : "Add"}
              </button>
            </div>
            {live.products.length === 0 ? (
              <p className="py-3 text-sm text-ink-soft">
                {ar
                  ? "لم تُضف منتجات بعد. المنتج المثبّت يظهر أسفل الفيديو ليُضاف للسلة دون مغادرة البث."
                  : "None yet. The pinned product shows under the video so viewers can add it without leaving the stream."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {live.products.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <IcImage className="h-4 w-4 text-ink-soft" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{p.productName}</div>
                      <div className="text-xs text-ink-soft">
                        {p.price != null ? egp(p.price, lang) : "—"}
                        {p.discountCode ? ` · ${p.discountCode}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => run("pin", () => pinLiveProductAction(live.id, p.pinned ? null : p.id))}
                      className={`badge px-2.5 py-1 text-xs ${p.pinned ? "bg-brand text-white" : "bg-surface-page text-ink-muted hover:bg-surface-hover"}`}
                    >
                      {p.pinned ? (ar ? "مثبّت" : "Pinned") : ar ? "تثبيت" : "Pin"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <HostComments chat={chat} live={live.status === "live"} ar={ar} />

          {/* After the fact */}
          <section className="rounded-2xl border border-line p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-ink">{ar ? "النتائج" : "Results"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={ar ? "أعلى مشاهدة" : "Peak viewers"} value={num(live.peakViewers, lang)} />
              <Stat label={ar ? "دقائق مشاهدة" : "Minutes watched"} value={num(minutes, lang)} />
              <Stat
                label={ar ? "تكلفة تقديرية" : "Estimated cost"}
                value={`$${estimatedCost(minutes, RATE_PER_1000_MIN).toFixed(2)}`}
              />
              <Stat
                label={ar ? "التسجيل" : "Replay"}
                value={live.recordingUrl ? (ar ? "جاهز" : "Ready") : ar ? "غير متاح" : "Not yet"}
              />
            </div>
            {live.recordingUrl && (
              <a
                href={live.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-outline mt-3 inline-flex h-9 px-3 text-xs"
              >
                <IcEye className="h-3.5 w-3.5" /> {ar ? "مشاهدة التسجيل" : "Watch replay"}
              </a>
            )}
          </section>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-4">
          <button
            onClick={async () => {
              if (!window.confirm(ar ? "حذف هذا البث؟" : "Delete this live?")) return;
              const res = await deleteLiveAction(live.id);
              if (res.ok) onDeleted(live.id);
            }}
            className="btn-ghost h-9 px-2 text-xs text-rose-600 hover:bg-rose-50"
          >
            <IcTrash className="h-4 w-4" /> {ar ? "حذف" : "Delete"}
          </button>
          <button onClick={onClose} className="btn-outline">{ar ? "إغلاق" : "Close"}</button>
        </div>
      </div>

      {editing && (
        <LiveForm
          ar={ar}
          live={live}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            onChanged(next);
            setEditing(false);
          }}
        />
      )}

      {checking && <CameraCheck ar={ar} onClose={() => setChecking(false)} />}

      {broadcasting && live.whipUrl && (
        <Broadcast
          chat={chat}
          whipUrl={live.whipUrl}
          title={live.title}
          ar={ar}
          onLive={() => run("live", () => setLiveStatusAction(live.id, "live"))}
          onEnded={() => run("end", () => setLiveStatusAction(live.id, "ended"))}
          onClose={() => setBroadcasting(false)}
        />
      )}

      {picker && (
        <ProductPicker
          ar={ar}
          lang={lang}
          live={live}
          onClose={() => setPicker(false)}
          onSaved={(next) => {
            onChanged(next);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}

/** Server URL + key, as a phone broadcasting app expects to receive it. */
function fullIngestUrl(live: LiveStream): string {
  const base = live.ingestUrl ?? "";
  const key = live.streamKey ?? "";
  if (!base || !key) return base || key;
  return base.endsWith("/") ? `${base}${key}` : `${base}/${key}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-page p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function KeyRow({
  label,
  value,
  secret,
  revealed,
  onReveal,
  onCopy,
  ar,
}: {
  label: string;
  value: string;
  secret?: boolean;
  revealed?: boolean;
  onReveal?: () => void;
  onCopy: (v: string) => void;
  ar: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-page px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-soft">{label}</div>
        <div className="truncate font-mono text-xs text-ink" dir="ltr">{value || "—"}</div>
      </div>
      {secret && (
        <button onClick={onReveal} className="btn-ghost h-8 px-2 text-xs">
          {revealed ? (ar ? "إخفاء" : "Hide") : ar ? "إظهار" : "Show"}
        </button>
      )}
      <button onClick={() => onCopy(value)} className="btn-ghost h-8 w-8 p-0" aria-label="copy">
        <IcCopy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ----------------------------- product picker ----------------------------- */

function ProductPicker({
  ar,
  lang,
  live,
  onClose,
  onSaved,
}: {
  ar: boolean;
  lang: "ar" | "en";
  live: LiveStream;
  onClose: () => void;
  onSaved: (live: LiveStream) => void;
}) {
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Record<string, boolean>>(
    Object.fromEntries(live.products.filter((p) => p.itemId).map((p) => [p.itemId as string, true])),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listStoreProducts().then((res) => {
      if (res.ok) setCatalog(res.data);
    });
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? catalog.filter((p) => p.name.toLowerCase().includes(needle)) : catalog;
    return list.slice(0, 60);
  }, [catalog, q]);

  async function save() {
    setBusy(true);
    const picked = catalog
      .filter((p) => chosen[p.id])
      .map((p) => ({
        itemId: p.id,
        productName: p.name,
        imageUrl: p.image,
        price: p.priceMin,
        discountCode: null as string | null,
      }));
    const res = await setLiveProductsAction(live.id, picked);
    setBusy(false);
    if (res.ok) onSaved(res.data);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{ar ? "اختاري المنتجات" : "Choose products"}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0"><IcX className="h-4 w-4" /></button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "ابحثي عن منتج…" : "Search products…"}
          className="h-11 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-brand-600"
        />
        <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={Boolean(chosen[p.id])}
                onChange={(e) => setChosen((c) => ({ ...c, [p.id]: e.target.checked }))}
                className="h-4 w-4 rounded border-line accent-brand-600"
              />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IcImage className="h-4 w-4 text-ink-soft" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                <div className="text-xs text-ink-soft">
                  {p.priceMin != null ? egp(p.priceMin, lang) : "—"} · {p.available} {ar ? "متاح" : "in stock"}
                </div>
              </div>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="py-8 text-center text-sm text-ink-soft">{ar ? "لا توجد نتائج" : "No matches"}</li>
          )}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "حفظ" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
