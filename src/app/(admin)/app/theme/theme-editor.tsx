"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcPlus, IcTrash, IcUp, IcDown, IcAlert, IcEye } from "@/components/icons";
import { AppHome, type HomeData } from "@/components/app-home";
import {
  BLOCK_META,
  newBlock,
  normalizeTheme,
  type AppTheme,
  type Block,
  type BlockType,
} from "@/lib/app-theme";
import { loadThemeEditor, saveTheme, type ThemeEditorData } from "./actions";

/**
 * The app's theme editor.
 *
 * Shaped like the website's customizer for a reason: the merchant already
 * knows that shape. Controls on one side, the thing itself on the other,
 * redrawing as you type — and the phone really is the app's own home-screen
 * renderer, not a mock-up of it, so what you arrange here is what ships.
 *
 * Nothing saves as you go. Editing a live shop's front page one keystroke at a
 * time is how a half-typed heading ends up in front of a customer, so the
 * draft is yours until you press Save.
 */

const input =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-ink-soft">{hint}</span>}
    </label>
  );
}

export function ThemeEditor() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [data, setData] = useState<ThemeEditorData | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [draft, setDraft] = useState<AppTheme | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [openBlock, setOpenBlock] = useState<string | null>(null);

  useEffect(() => {
    loadThemeEditor().then((r) => {
      if (!r.ok) return setMsg({ tone: "err", text: r.error });
      setData(r.data);
      setDraft(r.data.theme);
      setSaved(JSON.stringify(r.data.theme));
    });
    // The preview draws from the same endpoint the app calls, so what you see
    // is what a phone would get — the theme is the draft, the data is real.
    fetch("/api/storefront/home", { headers: { "x-store-channel": "app" }, cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setHome({
            collections: j.data.collections ?? [],
            rows: j.data.rows ?? {},
            newArrivals: j.data.newArrivals ?? [],
            reviews: j.data.reviews ?? [],
          });
        }
      })
      .catch(() => setHome({ collections: [], rows: {}, newArrivals: [], reviews: [] }));
  }, []);

  const dirty = useMemo(
    () => Boolean(draft) && JSON.stringify(draft) !== saved,
    [draft, saved],
  );

  const patchSettings = useCallback((patch: Partial<AppTheme["settings"]>) => {
    setDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d));
  }, []);

  const patchBlock = useCallback((id: string, patch: Record<string, unknown>) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            blocks: d.blocks.map((b) =>
              b.id === id ? { ...b, settings: { ...b.settings, ...patch } } : b,
            ),
          }
        : d,
    );
  }, []);

  function move(id: string, by: 1 | -1) {
    setDraft((d) => {
      if (!d) return d;
      const i = d.blocks.findIndex((b) => b.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  }

  function add(type: BlockType) {
    const block = newBlock(type);
    setDraft((d) => (d ? { ...d, blocks: [...d.blocks, block] } : d));
    setOpenBlock(block.id);
  }

  function remove(id: string) {
    setDraft((d) => (d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d));
  }

  async function onSave() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    const res = await saveTheme(normalizeTheme(draft));
    setBusy(false);
    if (!res.ok) {
      setMsg({
        tone: "err",
        text:
          res.error === "migration_missing"
            ? ar
              ? "شغّلي supabase/migrations/0023_app_theme.sql"
              : "Run supabase/migrations/0023_app_theme.sql"
            : res.error,
      });
      return;
    }
    setSaved(JSON.stringify(draft));
    setMsg({ tone: "ok", text: ar ? "تم الحفظ — التطبيق سيراه فوراً." : "Saved. The app sees it on its next launch." });
  }

  if (!draft || !data) {
    return (
      <>
        <PageHeader title={ar ? "مظهر التطبيق" : "App theme"} />
        <Card className="p-12 text-center text-sm text-ink-soft">
          {msg?.text ?? (ar ? "جارٍ التحميل…" : "Loading…")}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={ar ? "مظهر التطبيق" : "App theme"}
        subtitle={
          ar
            ? "رتّبي الصفحة الرئيسية للتطبيق واختاري ألوانه — المعاينة على اليسار هي شاشة التطبيق نفسها"
            : "Arrange the app's home screen and choose its colours. The phone beside you is the app's own home screen, not a mock-up of it"
        }
        actions={
          <>
            {dirty && (
              <span className="text-xs font-medium text-amber-600">
                {ar ? "تغييرات غير محفوظة" : "Unsaved changes"}
              </span>
            )}
            <button
              onClick={onSave}
              disabled={busy || !dirty}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? (ar ? "…" : "…") : ar ? "حفظ" : "Save"}
            </button>
          </>
        }
      />

      {msg && (
        <Card
          className={`mb-4 p-3.5 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.tone === "err" && <IcAlert className="me-1.5 inline h-4 w-4" />}
          {msg.text}
        </Card>
      )}

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* ------------------------------ controls ------------------------- */}
        <div className="min-w-0 flex-1 space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">{ar ? "الهوية" : "Brand"}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Row label={ar ? "اسم المتجر" : "Store name"}>
                <input
                  value={draft.settings.storeName}
                  onChange={(e) => patchSettings({ storeName: e.target.value })}
                  className={input}
                />
              </Row>
              <Row
                label={ar ? "اللون الأساسي" : "Accent colour"}
                hint={ar ? "الأزرار والأسعار والتبويب النشط" : "Buttons, prices, the active tab"}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.settings.accent}
                    onChange={(e) => patchSettings({ accent: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-surface-page p-1"
                  />
                  <input
                    value={draft.settings.accent}
                    onChange={(e) => patchSettings({ accent: e.target.value })}
                    className={`${input} font-mono`}
                    dir="ltr"
                  />
                </span>
              </Row>
              <Row
                label={ar ? "رابط الشعار" : "Logo URL"}
                hint={ar ? "من مكتبة الملفات أو أي رابط صورة" : "From your file library, or any image URL"}
              >
                <input
                  value={draft.settings.logoUrl ?? ""}
                  onChange={(e) => patchSettings({ logoUrl: e.target.value || null })}
                  placeholder="https://…"
                  className={input}
                  dir="ltr"
                />
              </Row>
              <Row label={ar ? "قائمة التنقّل" : "Navigation menu"}>
                <select
                  value={draft.settings.menuHandle}
                  onChange={(e) => patchSettings({ menuHandle: e.target.value })}
                  className={input}
                >
                  {data.menus.length === 0 && <option value="main-menu">main-menu</option>}
                  {data.menus.map((m) => (
                    <option key={m.handle} value={m.handle}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Row>
            </div>

            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.settings.showSearch}
                  onChange={(e) => patchSettings({ showSearch: e.target.checked })}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                <span className="text-sm text-ink">{ar ? "إظهار البحث" : "Show the search bar"}</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.settings.announcementEnabled}
                  onChange={(e) => patchSettings({ announcementEnabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                <span className="text-sm text-ink">
                  {ar ? "شريط إعلان أعلى الشاشة" : "Announcement bar at the top"}
                </span>
              </label>
              {draft.settings.announcementEnabled && (
                <input
                  value={draft.settings.announcement}
                  onChange={(e) => patchSettings({ announcement: e.target.value })}
                  placeholder={ar ? "شحن مجاني فوق ١٠٠٠ ج.م" : "Free delivery over 1,000 EGP"}
                  className={input}
                />
              )}
            </div>
          </Card>

          {/* ---------------------------- blocks --------------------------- */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                {ar ? "الصفحة الرئيسية" : "Home screen"}
              </h2>
              <span className="text-xs text-ink-soft">
                {draft.blocks.length} {ar ? "قسم" : "blocks"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {ar
                ? "الترتيب هنا هو الترتيب على الشاشة."
                : "The order here is the order on the screen."}
            </p>

            <ul className="mt-4 space-y-2">
              {draft.blocks.map((block, i) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  ar={ar}
                  open={openBlock === block.id}
                  first={i === 0}
                  last={i === draft.blocks.length - 1}
                  collections={data.collections}
                  onToggle={() => setOpenBlock(openBlock === block.id ? null : block.id)}
                  onPatch={(patch) => patchBlock(block.id, patch)}
                  onMove={(by) => move(block.id, by)}
                  onRemove={() => remove(block.id)}
                />
              ))}
            </ul>

            <div className="mt-4 border-t border-line pt-4">
              <div className="text-xs font-medium text-ink-muted">
                {ar ? "أضيفي قسماً" : "Add a block"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(BLOCK_META) as BlockType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => add(type)}
                    title={ar ? BLOCK_META[type].hintAr : BLOCK_META[type].hintEn}
                    className="btn-outline h-9 gap-1.5 px-3 text-xs"
                  >
                    <IcPlus className="h-3.5 w-3.5" />
                    {ar ? BLOCK_META[type].ar : BLOCK_META[type].en}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ------------------------------- phone --------------------------- */}
        <div className="mx-auto w-full max-w-[380px] shrink-0 xl:sticky xl:top-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <IcEye className="h-3.5 w-3.5" />
            {ar ? "معاينة حيّة" : "Live preview"}
          </div>
          <div className="overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-50 shadow-xl">
            <div
              className="flex items-center justify-between px-4 pb-2 pt-1.5 text-[11px] font-medium text-white"
              style={{ background: "#0f172a" }}
            >
              <span className="flex items-center gap-1.5">
                {draft.settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.settings.logoUrl} alt="" className="h-4 w-auto" />
                ) : null}
                {draft.settings.storeName}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: `${draft.settings.accent}40` }}
              >
                {ar ? "معاينة" : "preview"}
              </span>
            </div>

            {draft.settings.announcementEnabled && draft.settings.announcement && (
              <div
                className="px-3 py-1.5 text-center text-[11px] font-medium text-white"
                style={{ background: draft.settings.accent }}
              >
                {draft.settings.announcement}
              </div>
            )}

            <div className="h-[620px] overflow-y-auto bg-slate-50 p-4">
              {draft.settings.showSearch && (
                <div className="mb-4 h-10 rounded-full border border-slate-300 bg-white px-4 text-sm leading-10 text-slate-400">
                  {ar ? "ابحثي…" : "Search…"}
                </div>
              )}
              {home ? (
                <AppHome theme={draft} data={home} ar={ar} showPlaceholders />
              ) : (
                <p className="py-16 text-center text-sm text-slate-400">
                  {ar ? "جارٍ التحميل…" : "Loading…"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --------------------------------------------------------------- one block --
function BlockCard({
  block,
  ar,
  open,
  first,
  last,
  collections,
  onToggle,
  onPatch,
  onMove,
  onRemove,
}: {
  block: Block;
  ar: boolean;
  open: boolean;
  first: boolean;
  last: boolean;
  collections: { handle: string; title: string; count: number }[];
  onToggle: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onMove: (by: 1 | -1) => void;
  onRemove: () => void;
}) {
  const meta = BLOCK_META[block.type];
  const s = block.settings ?? {};
  const text = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  const num = (k: string, d: number) => (Number(s[k]) > 0 ? Number(s[k]) : d);

  const chosen = collections.find((c) => c.handle === text("handle"));
  const summary =
    block.type === "collection_row" || block.type === "collection_grid"
      ? chosen?.title ?? (ar ? "كل الأقسام" : "Every collection")
      : text("title") || text("heading") || (ar ? meta.ar : meta.en);

  return (
    <li className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 bg-surface-page px-3 py-2.5">
        <button onClick={onToggle} className="min-w-0 flex-1 text-start">
          <div className="text-sm font-medium text-ink">{ar ? meta.ar : meta.en}</div>
          <div className="truncate text-[11px] text-ink-soft">{summary}</div>
        </button>
        <button
          onClick={() => onMove(-1)}
          disabled={first}
          className="btn-ghost h-7 w-7 p-0 disabled:opacity-30"
          aria-label={ar ? "لأعلى" : "Move up"}
        >
          <IcUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={last}
          className="btn-ghost h-7 w-7 p-0 disabled:opacity-30"
          aria-label={ar ? "لأسفل" : "Move down"}
        >
          <IcDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="btn-ghost h-7 w-7 p-0 text-rose-600"
          aria-label={ar ? "حذف" : "Remove"}
        >
          <IcTrash className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {ar ? meta.hintAr : meta.hintEn}
          </p>

          {block.type === "banner" && (
            <>
              <Row label={ar ? "رابط الصورة" : "Image URL"}>
                <input
                  value={text("imageUrl")}
                  onChange={(e) => onPatch({ imageUrl: e.target.value })}
                  placeholder="https://…"
                  className={input}
                  dir="ltr"
                />
              </Row>
              <Row label={ar ? "العنوان" : "Heading"}>
                <input
                  value={text("heading")}
                  onChange={(e) => onPatch({ heading: e.target.value })}
                  className={input}
                />
              </Row>
              <Row label={ar ? "سطر فرعي" : "Subheading"}>
                <input
                  value={text("subheading")}
                  onChange={(e) => onPatch({ subheading: e.target.value })}
                  className={input}
                />
              </Row>
              <CollectionPicker
                ar={ar}
                collections={collections}
                value={text("handle")}
                onChange={(handle) => onPatch({ handle })}
                label={ar ? "يفتح عند الضغط" : "Opens when tapped"}
                anyLabel={ar ? "لا شيء" : "Nothing"}
              />
            </>
          )}

          {(block.type === "collection_row" || block.type === "collection_grid") && (
            <>
              <CollectionPicker
                ar={ar}
                collections={collections}
                value={text("handle")}
                onChange={(handle) => onPatch({ handle })}
                label={ar ? "القسم" : "Collection"}
                anyLabel={
                  ar ? "أول ٨ أقسام بالترتيب" : "Your first 8 collections, in your order"
                }
              />
              {text("handle") && (
                <Row label={ar ? "عنوان بديل" : "Title override"}>
                  <input
                    value={text("title")}
                    onChange={(e) => onPatch({ title: e.target.value })}
                    placeholder={chosen?.title ?? ""}
                    className={input}
                  />
                </Row>
              )}
              <Row label={ar ? "عدد المنتجات" : "How many products"}>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={num("limit", 8)}
                  onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                  className={input}
                />
              </Row>
            </>
          )}

          {(block.type === "new_arrivals" ||
            block.type === "reviews" ||
            block.type === "categories") && (
            <>
              <Row label={ar ? "العنوان" : "Title"}>
                <input
                  value={text("title")}
                  onChange={(e) => onPatch({ title: e.target.value })}
                  className={input}
                />
              </Row>
              {block.type !== "categories" && (
                <Row label={ar ? "العدد" : "How many"}>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={num("limit", block.type === "reviews" ? 6 : 12)}
                    onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                    className={input}
                  />
                </Row>
              )}
            </>
          )}

          {block.type === "text" && (
            <>
              <Row label={ar ? "العنوان" : "Heading"}>
                <input
                  value={text("heading")}
                  onChange={(e) => onPatch({ heading: e.target.value })}
                  className={input}
                />
              </Row>
              <Row label={ar ? "النص" : "Body"}>
                <textarea
                  value={text("body")}
                  onChange={(e) => onPatch({ body: e.target.value })}
                  rows={3}
                  className={`${input} h-auto py-2`}
                />
              </Row>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function CollectionPicker({
  ar,
  collections,
  value,
  onChange,
  label,
  anyLabel,
}: {
  ar: boolean;
  collections: { handle: string; title: string; count: number }[];
  value: string;
  onChange: (handle: string) => void;
  label: string;
  anyLabel: string;
}) {
  return (
    <Row label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        <option value="">{anyLabel}</option>
        {collections.map((c) => (
          <option key={c.handle} value={c.handle}>
            {c.title} ({c.count})
          </option>
        ))}
      </select>
    </Row>
  );
}
