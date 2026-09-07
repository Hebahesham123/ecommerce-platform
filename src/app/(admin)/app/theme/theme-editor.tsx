"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui";
import {
  IcChevron,
  IcCode,
  IcDesktop,
  IcMobile,
  IcPlus,
  IcTrash,
  IcUp,
  IcDown,
  IcAlert,
} from "@/components/icons";
import { AppHome, type HomeData } from "@/components/app-home";
import {
  BLOCK_META,
  ITEM_FIELDS,
  ITEM_SHAPE,
  itemsOf,
  newBlock,
  normalizeTheme,
  type AppTheme,
  type Block,
  type BlockType,
  type Item,
} from "@/lib/app-theme";
import { componentName } from "@/lib/app-theme-codegen";
import {
  SCREEN_KEYS,
  type TabKey,
  SCREEN_LABELS,
  TAB_DEFAULTS,
  type ScreenKey,
  type ScreenSettings,
  type Tab as ThemeTab,
} from "@/lib/app-theme";
import { ScreenPanel, TabsPanel } from "./screen-panels";
import { loadThemeEditor, saveTheme, type ThemeEditorData } from "./actions";

/**
 * The app's theme editor.
 *
 * Built to the same shape as the website's customizer — a 380px rail of
 * collapsible sections beside a live preview, a device switch, Reset, and an
 * explicit Save — because the merchant already knows that shape and should not
 * have to learn a second one for the same job.
 *
 * The difference is what sits behind it. A website theme arrives as a folder
 * of Liquid, so its customizer *overrides* code that already exists and every
 * section row links to the file you would fix. An app has no such folder: the
 * screens do not exist until somebody writes them. So here, arranging a
 * section is what writes them — the code link opens what this editor just
 * generated rather than something you have to maintain.
 *
 * The phone is the app's own home-screen renderer, not a mock-up of it, so
 * what you arrange is what ships.
 */

const input =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

export function ThemeEditor() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [data, setData] = useState<ThemeEditorData | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [draft, setDraft] = useState<AppTheme | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  /**
   * Where the phone has been.
   *
   * A stack rather than a single screen, because home → collection → product
   * is a path, and Back from a product should return to the collection it came
   * from rather than all the way out. Arranging links you cannot follow is
   * arranging blind, and following one link only to hit a dead end is barely
   * better.
   */
  // Which screen the editor is on. Home is blocks; the rest are settings.
  const [page, setPage] = useState<ScreenKey | "home">("home");
  const [stack, setStack] = useState<Screen[]>([]);
  const screen = stack[stack.length - 1] ?? null;
  const push = useCallback((next: Screen) => setStack((s) => [...s, next]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Which tab the page being edited belongs to, so the bar in the preview
  // agrees with what is on screen above it. Collection and product are reached
  // from the shop tab, so that is the one lit.
  const activeTab: TabKey =
    page === "cart" ? "cart" : page === "account" ? "account" : "shop";

  // Landing on the Collection or Product tab with nothing tapped yet shows the
  // first real one, so the settings have something to act on immediately.
  useEffect(() => {
    if (page === "home" || stack.length) return;
    if (page === "collection" && data?.collections[0]) {
      const c = data.collections[0];
      setStack([{ kind: "collection", handle: c.handle, title: c.title }]);
    }
    if (page === "product") {
      // New arrivals are only fetched when a block asks for them, so a theme
      // without that section has none. Any product in any row will do — the
      // point is to have something real to edit against.
      const anyProduct =
        home?.newArrivals[0] ?? Object.values(home?.rows ?? {}).flat()[0];
      if (anyProduct) setStack([{ kind: "product", id: anyProduct.id }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, data, home]);

  useEffect(() => {
    loadThemeEditor().then((r) => {
      if (!r.ok) return setMsg({ tone: "err", text: r.error });
      setData(r.data);
      setDraft(r.data.theme);
      setSavedJson(JSON.stringify(r.data.theme));
    });
    // The preview draws from the endpoint the app itself calls, so the data is
    // real even while the theme is a draft.
    fetch("/api/storefront/home", { headers: { "x-store-channel": "app" }, cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setHome(
          j?.ok
            ? {
                collections: j.data.collections ?? [],
                rows: j.data.rows ?? {},
                newArrivals: j.data.newArrivals ?? [],
                reviews: j.data.reviews ?? [],
              }
            : { collections: [], rows: {}, newArrivals: [], reviews: [] },
        ),
      )
      .catch(() => setHome({ collections: [], rows: {}, newArrivals: [], reviews: [] }));
  }, []);

  const dirty = useMemo(
    () => Boolean(draft) && JSON.stringify(draft) !== savedJson,
    [draft, savedJson],
  );

  const missingHandles = useMemo(() => {
    if (!draft || !data) return [];
    const have = new Set(data.collections.map((c) => c.handle));
    return referencedHandles(draft).filter((h) => !have.has(h));
  }, [draft, data]);

  // Hovering a block in the phone opens and scrolls to its row, the way
  // hovering a section in the storefront preview does on the website.
  useEffect(() => {
    if (!hovered) return;
    const el = railRef.current?.querySelector(`[data-block-key="${CSS.escape(hovered)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hovered]);

  // Editing a section while the phone is showing a collection would hide the
  // very thing being changed, so any edit brings the phone home.
  const home_ = useCallback(() => setStack([]), []);

  const patchTabs = useCallback((tabs: ThemeTab[]) => {
    setDraft((d) => (d ? { ...d, tabs } : d));
  }, []);

  const patchScreen = useCallback(
    <K extends ScreenKey>(key: K, patch: Partial<ScreenSettings[K]>) => {
      setDraft((d) =>
        d ? { ...d, screens: { ...d.screens, [key]: { ...d.screens[key], ...patch } } } : d,
      );
    },
    [],
  );

  const patchSettings = useCallback((patch: Partial<AppTheme["settings"]>) => {
    home_();
    setDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d));
  }, [home_]);

  const patchBlock = useCallback((id: string, patch: Record<string, unknown>) => {
    home_();
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
  }, [home_]);

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
    setOpen((s) => ({ ...s, [block.id]: true }));
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    const res = await saveTheme(normalizeTheme(draft));
    setSaving(false);
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
    setSavedJson(JSON.stringify(draft));
  }

  function onReset() {
    if (!data) return;
    const question = ar
      ? "إرجاع المظهر إلى آخر نسخة محفوظة؟"
      : "Put the theme back to the last saved version?";
    if (!window.confirm(question)) return;
    setDraft(JSON.parse(savedJson) as AppTheme);
    setMsg(null);
  }

  if (!draft || !data) {
    return (
      <Card className="p-12 text-center text-sm text-ink-soft">
        {msg?.text ?? (ar ? "جارٍ التحميل…" : "Loading…")}
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* ------------------------------- header --------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app" className="btn-ghost h-9 px-2">
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">
            {ar ? "مظهر التطبيق" : "App theme"}
          </div>
          <div className="truncate text-xs text-ink-soft">
            {ar
              ? "رتّبي شاشة التطبيق — كل قسم تعدّلينه يُكتب له الكود"
              : "Arrange the app's screen. Editing a section writes the code for it"}
          </div>
        </div>

        <div className="ms-auto flex items-center gap-1 rounded-xl bg-surface-page p-1">
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                device === d ? "bg-white text-ink shadow-card" : "text-ink-muted"
              }`}
            >
              {d === "desktop" ? (
                <IcDesktop className="h-4 w-4" />
              ) : (
                <IcMobile className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>

        <Link href="/app/theme/code" className="btn-outline h-9 gap-1.5 px-3 text-xs">
          <IcCode className="h-3.5 w-3.5" />
          {ar ? "الكود" : "Code"}
        </Link>
        <button onClick={onReset} disabled={!dirty} className="btn-ghost h-9 px-3 text-xs disabled:opacity-40">
          {ar ? "تراجع" : "Reset"}
        </button>
        <button onClick={onSave} disabled={saving || !dirty} className="btn-primary disabled:opacity-60">
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : dirty ? (ar ? "حفظ" : "Save") : ar ? "محفوظ" : "Saved"}
        </button>
      </div>

      {msg && (
        <Card
          className={`p-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.tone === "err" && <IcAlert className="me-1.5 inline h-4 w-4" />}
          {msg.text}
        </Card>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        {/* ------------------------------ rail ---------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div ref={railRef} className="flex-1 overflow-y-auto p-3">
            {missingHandles.length > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <span className="font-semibold">
                  {missingHandles.length}{" "}
                  {ar
                    ? "قسماً مذكوراً في المظهر غير موجود في هذا المتجر"
                    : missingHandles.length === 1
                      ? "collection this theme points at isn't in this store"
                      : "collections this theme points at aren't in this store"}
                </span>
                <p className="mt-1">
                  {ar
                    ? "المظهر مأخوذ من ثيم شوبيفاي، وهذه الأقسام لم تُنشأ هنا. الأقسام التي تشير إليها ستظهر فارغة حتى توجّهيها لقسم موجود — وهي معلّمة بالأصفر."
                    : "This came from your Shopify theme, and these collections were never recreated here. Sections pointing at them will be empty until you repoint them — they're marked in amber."}
                </p>
              </div>
            )}
            <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "إعدادات عامة" : "Theme settings"}
            </div>
            <Group
              id="__settings"
              title={ar ? "الهوية" : "Brand"}
              subtitle="theme.ts"
              open={open["__settings"] ?? true}
              onToggle={() => setOpen((s) => ({ ...s, __settings: !(s["__settings"] ?? true) }))}
              codeHref="/app/theme/code?file=theme.ts"
            >
              <Field label={ar ? "اسم المتجر" : "Store name"} type="text">
                <input
                  value={draft.settings.storeName}
                  onChange={(e) => patchSettings({ storeName: e.target.value })}
                  className={input}
                />
              </Field>
              <Field label={ar ? "اللون الأساسي" : "Accent colour"} type="color">
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.settings.accent}
                    onChange={(e) => patchSettings({ accent: e.target.value })}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface-page p-1"
                  />
                  <input
                    value={draft.settings.accent}
                    onChange={(e) => patchSettings({ accent: e.target.value })}
                    className={`${input} font-mono`}
                    dir="ltr"
                  />
                </span>
              </Field>
              <Field label={ar ? "الشعار" : "Logo"} type="image_picker">
                <input
                  value={draft.settings.logoUrl ?? ""}
                  onChange={(e) => patchSettings({ logoUrl: e.target.value || null })}
                  placeholder="https://…"
                  className={input}
                  dir="ltr"
                />
              </Field>
              <Field label={ar ? "قائمة التنقّل" : "Navigation menu"} type="link_list">
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
              </Field>
              <Field label={ar ? "شريط البحث" : "Search bar"} type="checkbox">
                <Toggle
                  on={draft.settings.showSearch}
                  onChange={(v) => patchSettings({ showSearch: v })}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "شريط إعلان" : "Announcement bar"} type="checkbox">
                <Toggle
                  on={draft.settings.announcementEnabled}
                  onChange={(v) => patchSettings({ announcementEnabled: v })}
                  ar={ar}
                />
              </Field>
              {draft.settings.announcementEnabled && (
                <Field label={ar ? "نص الإعلان" : "Announcement text"} type="text">
                  <input
                    value={draft.settings.announcement}
                    onChange={(e) => patchSettings({ announcement: e.target.value })}
                    placeholder={ar ? "شحن مجاني فوق ١٠٠٠ ج.م" : "Free delivery over 1,000 EGP"}
                    className={input}
                  />
                </Field>
              )}
            </Group>

            <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "شريط التبويبات" : "Tab bar"}
            </div>
            <Group
              id="__tabs"
              title={ar ? "أزرار أسفل الشاشة" : "The bar along the bottom"}
              subtitle="TabBar.tsx"
              open={open["__tabs"] ?? false}
              onToggle={() => setOpen((s) => ({ ...s, __tabs: !s["__tabs"] }))}
              codeHref="/app/theme/code?file=components/TabBar.tsx"
            >
              <TabsPanel tabs={draft.tabs} ar={ar} onChange={patchTabs} />
            </Group>

            {page !== "home" && (
              <>
                <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {SCREEN_LABELS[page][ar ? "ar" : "en"]}
                </div>
                <Group
                  id={`__screen-${page}`}
                  title={SCREEN_LABELS[page][ar ? "ar" : "en"]}
                  subtitle={`${screenFile(page)}.tsx`}
                  open
                  onToggle={() => {}}
                  codeHref={`/app/theme/code?file=components/${screenFile(page)}.tsx`}
                >
                  <ScreenPanel
                    screen={page}
                    screens={draft.screens}
                    ar={ar}
                    onChange={patchScreen}
                  />
                </Group>
              </>
            )}

            {page === "home" && (
            <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "الشاشة الرئيسية" : "Home screen"}
            </div>
            )}

            {page === "home" && draft.blocks.map((block, i) => (
              <BlockGroup
                key={block.id}
                block={block}
                ar={ar}
                open={open[block.id] ?? false}
                highlighted={hovered === block.id}
                first={i === 0}
                last={i === draft.blocks.length - 1}
                collections={data.collections}
                input={input}
                onToggle={() => setOpen((s) => ({ ...s, [block.id]: !s[block.id] }))}
                onHover={setHovered}
                onPatch={(patch) => patchBlock(block.id, patch)}
                onMove={(by) => move(block.id, by)}
                onRemove={() =>
                  setDraft((d) => (d ? { ...d, blocks: d.blocks.filter((b) => b.id !== block.id) } : d))
                }
              />
            ))}

            {page === "home" && draft.blocks.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-ink-soft">
                {ar ? "لا توجد أقسام بعد." : "No sections yet."}
              </p>
            )}

            {page === "home" && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "إضافة قسم" : "Add a section"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(BLOCK_META) as BlockType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => add(type)}
                    title={ar ? BLOCK_META[type].hintAr : BLOCK_META[type].hintEn}
                    className="btn-outline h-8 gap-1 px-2.5 text-xs"
                  >
                    <IcPlus className="h-3 w-3" />
                    {ar ? BLOCK_META[type].ar : BLOCK_META[type].en}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>
        </Card>

        {/* ---------------------------- preview --------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
            {(["home", ...SCREEN_KEYS] as (ScreenKey | "home")[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setPage(key);
                  setStack([]);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  page === key
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {SCREEN_LABELS[key][ar ? "ar" : "en"]}
              </button>
            ))}
            <Link
              href="/app-preview"
              className="ms-auto text-[11px] font-medium text-brand-600 hover:underline"
            >
              {ar ? "فتح التطبيق كاملاً" : "Open the full app"}
            </Link>
          </div>

          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-surface-page p-4">
            <div
              className={`${
                device === "mobile" ? "w-[390px]" : "w-full max-w-[900px]"
              } max-w-full self-start overflow-hidden rounded-[1.75rem] border-8 border-slate-900 bg-slate-50 shadow-card`}
            >
              <div className="flex items-center justify-between bg-slate-900 px-4 pb-2 pt-1.5 text-[11px] font-medium text-white">
                <span className="flex items-center gap-1.5">
                  {draft.settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.settings.logoUrl} alt="" className="h-4 w-auto" />
                  ) : null}
                  {draft.settings.storeName}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: `${draft.settings.accent}66` }}
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

              {page !== "home" && page !== "collection" && page !== "product" ? (
                <MockScreen page={page} theme={draft} ar={ar} />
              ) : page !== "home" && !screen ? (
                <p className="bg-slate-50 px-6 py-16 text-center text-sm leading-relaxed text-slate-400">
                  {page === "collection"
                    ? ar
                      ? "لا يوجد قسم لعرضه. افتحي أي قسم من الشاشة الرئيسية."
                      : "Nothing to stand in for a collection. Open one from the home screen."
                    : ar
                      ? "لا يوجد منتج لعرضه. افتحي أي منتج من الشاشة الرئيسية."
                      : "Nothing to stand in for a product. Open one from the home screen."}
                </p>
              ) : screen ? (
                screen.kind === "collection" ? (
                  <CollectionScreen
                    handle={screen.handle}
                    title={screen.title}
                    accent={draft.settings.accent}
                    ar={ar}
                    onBack={pop}
                    onOpenProduct={(id) => push({ kind: "product", id })}
                  />
                ) : (
                  <ProductScreen
                    id={screen.id}
                    accent={draft.settings.accent}
                    ar={ar}
                    onBack={pop}
                  />
                )
              ) : (
              <div className="bg-slate-50 p-4">
                {draft.settings.showSearch && (
                  <div className="mb-4 h-10 rounded-full border border-slate-300 bg-white px-4 text-sm leading-10 text-slate-400">
                    {ar ? "ابحثي…" : "Search…"}
                  </div>
                )}
                {home ? (
                  <div className="space-y-5">
                    {draft.blocks.map((block) => (
                      <div
                        key={block.id}
                        onMouseEnter={() => {
                          setHovered(block.id);
                          setOpen((s) => (s[block.id] ? s : { ...s, [block.id]: true }));
                        }}
                        onMouseLeave={() => setHovered(null)}
                        className={`rounded-2xl transition-shadow ${
                          hovered === block.id ? "shadow-[0_0_0_2px_rgb(139,92,246)]" : ""
                        }`}
                      >
                        <AppHome
                          theme={{ ...draft, blocks: [block] }}
                          data={home}
                          ar={ar}
                          handlers={{
                            onOpenCollection: (handle, title) =>
                              push({ kind: "collection", handle, title }),
                            onOpenProduct: (id) => push({ kind: "product", id }),
                          }}
                          showPlaceholders
                        />
                      </div>
                    ))}
                    {draft.blocks.length === 0 && (
                      <p className="py-16 text-center text-sm text-slate-400">
                        {ar ? "الشاشة فارغة" : "The screen is empty"}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    {ar ? "جارٍ بناء المعاينة…" : "Building the preview…"}
                  </p>
                )}
              </div>
              )}

              {/* The bar the merchant just arranged, on every screen. */}
              <nav className="flex border-t border-slate-200 bg-white">
                {draft.tabs
                  .filter((t) => t.visible)
                  .map((t) => (
                    <span
                      key={t.key}
                      className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
                      style={{ color: t.key === activeTab ? draft.settings.accent : "#94a3b8" }}
                    >
                      <span className="text-base leading-none">{TAB_DEFAULTS[t.key].icon}</span>
                      {t.label || TAB_DEFAULTS[t.key][ar ? "ar" : "en"]}
                    </span>
                  ))}
              </nav>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces --
function Group({
  id,
  title,
  subtitle,
  open,
  onToggle,
  codeHref,
  highlighted,
  blockKey,
  onHover,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  codeHref?: string;
  highlighted?: boolean;
  blockKey?: string;
  onHover?: (key: string | null) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-block-key={blockKey}
      onMouseEnter={() => blockKey && onHover?.(blockKey)}
      onMouseLeave={() => onHover?.(null)}
      className={`mb-1.5 rounded-xl border transition-colors ${
        highlighted ? "border-violet-400 bg-violet-50/40 ring-1 ring-violet-300" : "border-line"
      }`}
    >
      <div className="flex items-center gap-1 px-3 py-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-start">
          <IcChevron
            className={`h-3 w-3 shrink-0 text-ink-soft transition-transform ${
              open ? "rotate-90" : ""
            } rtl:-scale-x-100`}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</span>
          {subtitle && (
            <span className="shrink-0 font-mono text-[10px] text-ink-soft">{subtitle}</span>
          )}
        </button>
        {actions}
        {codeHref && (
          <Link
            href={codeHref}
            className="shrink-0 rounded-lg px-1.5 py-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
            title="Code"
          >
            <IcCode className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {open && <div className="border-t border-line px-3 pb-2">{children}</div>}
      <span className="hidden">{id}</span>
    </div>
  );
}

function Field({
  label,
  type,
  children,
}: {
  label: string;
  type: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="badge bg-slate-100 text-[10px] text-ink-soft">{type}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  ar,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  ar: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
        on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded border ${
          on ? "border-emerald-600 bg-emerald-600" : "border-line bg-surface"
        }`}
      />
      {on ? (ar ? "مُفعّل" : "On") : ar ? "متوقّف" : "Off"}
    </button>
  );
}

function BlockGroup({
  block,
  ar,
  open,
  highlighted,
  first,
  last,
  collections,
  input,
  onToggle,
  onHover,
  onPatch,
  onMove,
  onRemove,
}: {
  block: Block;
  ar: boolean;
  open: boolean;
  highlighted: boolean;
  first: boolean;
  last: boolean;
  collections: { handle: string; title: string; count: number; image: string | null }[];
  input: string;
  onToggle: () => void;
  onHover: (key: string | null) => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onMove: (by: 1 | -1) => void;
  onRemove: () => void;
}) {
  const meta = BLOCK_META[block.type];
  const s = block.settings ?? {};
  const text = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  const num = (k: string, d: number) => (Number(s[k]) > 0 ? Number(s[k]) : d);
  const chosen = collections.find((c) => c.handle === text("handle"));

  return (
    <Group
      id={block.id}
      blockKey={block.id}
      highlighted={highlighted}
      onHover={onHover}
      title={ar ? meta.ar : meta.en}
      subtitle={`${componentName(block.type)}.tsx`}
      open={open}
      onToggle={onToggle}
      codeHref={`/app/theme/code?file=components/${componentName(block.type)}.tsx`}
      actions={
        <>
          <button
            onClick={() => onMove(-1)}
            disabled={first}
            className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
            aria-label={ar ? "لأعلى" : "Move up"}
          >
            <IcUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={last}
            className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
            aria-label={ar ? "لأسفل" : "Move down"}
          >
            <IcDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="btn-ghost h-7 w-7 shrink-0 p-0 text-rose-600"
            aria-label={ar ? "حذف" : "Remove"}
          >
            <IcTrash className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      <p className="pt-2 text-[11px] leading-relaxed text-ink-soft">
        {ar ? meta.hintAr : meta.hintEn}
      </p>

      {block.type === "banner" && (
        <>
          <Field label={ar ? "الصورة" : "Image"} type="image_picker">
            <input
              value={text("imageUrl")}
              onChange={(e) => onPatch({ imageUrl: e.target.value })}
              placeholder="https://…"
              className={input}
              dir="ltr"
            />
          </Field>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input
              value={text("heading")}
              onChange={(e) => onPatch({ heading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "سطر فرعي" : "Subheading"} type="text">
            <input
              value={text("subheading")}
              onChange={(e) => onPatch({ subheading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="collection">
            <CollectionSelect
              collections={collections}
              value={text("handle")}
              onChange={(handle) => onPatch({ handle })}
              anyLabel={ar ? "لا شيء" : "Nothing"}
              className={input}
            />
          </Field>
        </>
      )}

      {(block.type === "collection_row" || block.type === "collection_grid") && (
        <>
          <Field label={ar ? "القسم" : "Collection"} type="collection">
            <CollectionSelect
              collections={collections}
              value={text("handle")}
              onChange={(handle) => onPatch({ handle })}
              anyLabel={ar ? "أول ٨ أقسام بالترتيب" : "Your first 8 collections, in your order"}
              className={input}
            />
          </Field>
          {text("handle") && (
            <Field label={ar ? "عنوان بديل" : "Title override"} type="text">
              <input
                value={text("title")}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder={chosen?.title ?? ""}
                className={input}
              />
            </Field>
          )}
          <Field label={ar ? "عدد المنتجات" : "How many products"} type="range">
            <input
              type="number"
              min={2}
              max={12}
              value={num("limit", block.type === "collection_row" ? 8 : 6)}
              onChange={(e) => onPatch({ limit: Number(e.target.value) })}
              className={input}
            />
          </Field>
        </>
      )}

      {(block.type === "new_arrivals" ||
        block.type === "reviews" ||
        block.type === "categories") && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input
              value={text("title")}
              onChange={(e) => onPatch({ title: e.target.value })}
              className={input}
            />
          </Field>
          {block.type !== "categories" && (
            <Field label={ar ? "العدد" : "How many"} type="range">
              <input
                type="number"
                min={2}
                max={20}
                value={num("limit", block.type === "reviews" ? 6 : 12)}
                onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                className={input}
              />
            </Field>
          )}
        </>
      )}

      {block.type === "promo_bar" && (
        <>
          <Field label={ar ? "العرض" : "Offer"} type="text">
            <input
              value={text("lead")}
              onChange={(e) => onPatch({ lead: e.target.value })}
              placeholder={ar ? "خصم ١٠٪ على أول طلب" : "Extra 10% off"}
              className={input}
            />
          </Field>
          <Field label={ar ? "تفاصيل" : "Detail"} type="text">
            <input
              value={text("rest")}
              onChange={(e) => onPatch({ rest: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "كود الخصم" : "Discount code"} type="text">
            <input
              value={text("code")}
              onChange={(e) => onPatch({ code: e.target.value.toUpperCase() })}
              className={`${input} font-mono`}
              dir="ltr"
            />
          </Field>
        </>
      )}

      {(block.type === "hero" ||
        block.type === "cards" ||
        block.type === "tiers" ||
        block.type === "split" ||
        block.type === "collection_tabs" ||
        block.type === "trust_badges") && (
        <>
          {block.type !== "hero" && block.type !== "trust_badges" && (
            <Field label={ar ? "العنوان" : "Title"} type="text">
              <input
                value={text("title")}
                onChange={(e) => onPatch({ title: e.target.value })}
                className={input}
              />
            </Field>
          )}
          {block.type === "collection_tabs" && (
            <Field label={ar ? "عدد المنتجات" : "How many products"} type="range">
              <input
                type="number"
                min={2}
                max={12}
                value={num("limit", 8)}
                onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                className={input}
              />
            </Field>
          )}
        </>
      )}

      {ITEM_FIELDS[block.type] && (
        <ItemList
          block={block}
          ar={ar}
          collections={collections}
          input={input}
          onPatch={onPatch}
        />
      )}

      {block.type === "text" && (
        <>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input
              value={text("heading")}
              onChange={(e) => onPatch({ heading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "النص" : "Body"} type="richtext">
            <textarea
              value={text("body")}
              onChange={(e) => onPatch({ body: e.target.value })}
              rows={3}
              className={`${input} h-auto py-2`}
            />
          </Field>
        </>
      )}
    </Group>
  );
}

/**
 * The repeatable part of a section: slides, tabs, tiers, cards, badges.
 *
 * A theme section has blocks inside it and so does this, for the same reason —
 * a hero with three slides is one thing the merchant arranges, not three
 * things that happen to sit together. Each row collapses so a section with ten
 * categories does not bury the section after it.
 */
function ItemList({
  block,
  ar,
  collections,
  input,
  onPatch,
}: {
  block: Block;
  ar: boolean;
  collections: { handle: string; title: string; count: number; image: string | null }[];
  input: string;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const fields = ITEM_FIELDS[block.type] ?? [];
  const shape = ITEM_SHAPE[block.type];
  const items = itemsOf(block);

  const write = (next: Item[]) => onPatch({ items: next });
  const patchItem = (id: string, patch: Record<string, unknown>) =>
    write(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const moveItem = (id: string, by: 1 | -1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  const labelOf = (item: Item) => {
    for (const f of fields) {
      if (f.kind === "image") continue;
      const v = item[f.key];
      if (typeof v === "string" && v) {
        return f.kind === "collection"
          ? collections.find((c) => c.handle === v)?.title ?? v
          : v;
      }
    }
    return ar ? "بدون عنوان" : "Untitled";
  };

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface-page p-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {shape ? (ar ? shape.ar : shape.en) : ""} · {items.length}
        </span>
        {shape && (
          <button
            onClick={() => {
              const created = shape.blank();
              write([...items, created]);
              setOpenItem(created.id);
            }}
            className="btn-ghost h-6 gap-1 px-1.5 text-[11px]"
          >
            <IcPlus className="h-3 w-3" />
            {ar ? "إضافة" : "Add"}
          </button>
        )}
      </div>

      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => {
          const isOpen = openItem === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-line bg-surface">
              <div className="flex items-center gap-0.5 px-2 py-1.5">
                <button
                  onClick={() => setOpenItem(isOpen ? null : item.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                >
                  <IcChevron
                    className={`h-2.5 w-2.5 shrink-0 text-ink-soft transition-transform ${
                      isOpen ? "rotate-90" : ""
                    } rtl:-scale-x-100`}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{labelOf(item)}</span>
                </button>
                <button
                  onClick={() => moveItem(item.id, -1)}
                  disabled={i === 0}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 disabled:opacity-30"
                  aria-label={ar ? "لأعلى" : "Move up"}
                >
                  <IcUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveItem(item.id, 1)}
                  disabled={i === items.length - 1}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 disabled:opacity-30"
                  aria-label={ar ? "لأسفل" : "Move down"}
                >
                  <IcDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => write(items.filter((x) => x.id !== item.id))}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 text-rose-600"
                  aria-label={ar ? "حذف" : "Remove"}
                >
                  <IcTrash className="h-3 w-3" />
                </button>
              </div>

              {isOpen && (
                <div className="space-y-2 border-t border-line px-2 pb-2 pt-1.5">
                  {fields.map((f) => {
                    const value = typeof item[f.key] === "string" ? (item[f.key] as string) : "";
                    const linked = collections.find(
                      (c) => c.handle === (typeof item.handle === "string" ? item.handle : ""),
                    );
                    // What this field will show if left empty, because the
                    // collection supplies it. Saying so beats a blank box that
                    // looks like nothing happened.
                    const inherited =
                      f.kind === "image"
                        ? linked?.image ?? ""
                        : f.key === "title" || f.key === "label"
                          ? linked?.title ?? ""
                          : "";
                    return (
                      <label key={f.key} className="block">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {ar ? f.ar : f.en}
                        </span>
                        {f.kind === "collection" ? (
                          <CollectionSelect
                            collections={collections}
                            value={value}
                            onChange={(handle) => patchItem(item.id, { [f.key]: handle })}
                            anyLabel={ar ? "لا شيء" : "Nothing"}
                            className={`${input} mt-0.5 h-8 text-xs`}
                          />
                        ) : (
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {f.kind === "image" && (value || inherited) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={value || inherited}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded object-cover"
                              />
                            )}
                            <input
                              value={value}
                              onChange={(e) => patchItem(item.id, { [f.key]: e.target.value })}
                              placeholder={
                                inherited
                                  ? ar
                                    ? "من القسم"
                                    : "from the collection"
                                  : f.kind === "image"
                                    ? "https://…"
                                    : ""
                              }
                              dir={f.kind === "image" ? "ltr" : undefined}
                              className={`${input} h-8 text-xs`}
                            />
                          </span>
                        )}
                        {inherited && !value && (
                          <span className="mt-0.5 block text-[10px] text-ink-soft">
                            {ar
                              ? "يأخذها من القسم المرتبط تلقائياً"
                              : "Taken from the linked collection"}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && (
        <p className="py-3 text-center text-[11px] text-ink-soft">
          {ar ? "لا عناصر بعد" : "Nothing here yet"}
        </p>
      )}
    </div>
  );
}

/**
 * Pick a collection — including one this store does not have.
 *
 * The theme was exported from Shopify, and most of the collections it points
 * at were never recreated here. A plain select would show those as blank and
 * quietly overwrite them the moment anything else in the section changed, so
 * an unknown handle keeps its place in the list and says what it is. Losing
 * the merchant's own wiring while claiming to have imported it would be worse
 * than not importing it at all.
 */
function CollectionSelect({
  collections,
  value,
  onChange,
  anyLabel,
  className,
}: {
  collections: { handle: string; title: string; count: number; image: string | null }[];
  value: string;
  onChange: (handle: string) => void;
  anyLabel: string;
  className: string;
}) {
  const missing = Boolean(value) && !collections.some((c) => c.handle === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} ${missing ? "border-amber-400 text-amber-700" : ""}`}
    >
      <option value="">{anyLabel}</option>
      {missing && <option value={value}>{value} — not in this store</option>}
      {collections.map((c) => (
        <option key={c.handle} value={c.handle}>
          {c.title} ({c.count})
        </option>
      ))}
    </select>
  );
}

/**
 * Where a tap in the preview lands.
 *
 * The editor is for arranging the home screen, so this is deliberately plain —
 * enough to prove the link goes where the merchant pointed it and that the
 * collection has something in it. The full app is one click away for the rest.
 */
/** Which generated file a screen's settings end up in. */
function screenFile(key: ScreenKey): string {
  return {
    collection: "CollectionScreen",
    product: "ProductScreen",
    cart: "CartScreen",
    checkout: "CheckoutScreen",
    account: "AccountScreen",
  }[key];
}

type Screen =
  | { kind: "collection"; handle: string; title: string }
  | { kind: "product"; id: string };

/** The bar every screen below home wears. */
function ScreenBar({
  title,
  trailing,
  accent,
  ar,
  onBack,
}: {
  title: string;
  trailing?: React.ReactNode;
  accent: string;
  ar: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <button onClick={onBack} className="shrink-0 text-sm font-semibold" style={{ color: accent }}>
        ‹ {ar ? "رجوع" : "Back"}
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{title}</span>
      {trailing}
    </div>
  );
}

function money(v: number | null, ar: boolean) {
  return v == null
    ? "—"
    : `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(v)} ${
        ar ? "ج.م" : "EGP"
      }`;
}

/** A refusal the merchant can act on, rather than a spinner that never ends. */
function ScreenError({ error, ar }: { error: string; ar: boolean }) {
  return (
    <div className="m-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
      <code className="font-mono">{error}</code>
      <p className="mt-1">
        {error === "not_found"
          ? ar
            ? "غير موجود في هذا المتجر — غيّري الوجهة من المحرّر."
            : "That isn't in this store. Repoint the section in the panel beside you."
          : ar
            ? "تعذّر التحميل."
            : "Couldn't load it."}
      </p>
    </div>
  );
}

function CollectionScreen({
  handle,
  title,
  accent,
  ar,
  onBack,
  onOpenProduct,
}: {
  handle: string;
  title: string;
  accent: string;
  ar: boolean;
  onBack: () => void;
  onOpenProduct: (id: string) => void;
}) {
  const [products, setProducts] = useState<
    { id: string; name: string; image: string | null; priceMin: number | null }[] | null
  >(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(null);
    setError(null);
    fetch(`/api/storefront/collections/${encodeURIComponent(handle)}?limit=12`, {
      headers: { "x-store-channel": "app" },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return setError(j?.error ?? "not_found");
        setProducts(j.data.products ?? []);
        setTotal(j.data.total ?? 0);
      })
      .catch((e) => setError(String((e as Error).message)));
  }, [handle]);

  return (
    <div className="bg-slate-50">
      <ScreenBar
        title={title || handle}
        accent={accent}
        ar={ar}
        onBack={onBack}
        trailing={products ? <span className="shrink-0 text-[11px] text-slate-400">{total}</span> : null}
      />
      {error ? (
        <ScreenError error={error} ar={ar} />
      ) : (
        <div className="p-4">
          {!products ? (
            <p className="py-16 text-center text-sm text-slate-400">…</p>
          ) : products.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              {ar ? "لا منتجات في هذا القسم" : "Nothing in this collection"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onOpenProduct(p.id)}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-start transition hover:border-violet-300"
                >
                  <div className="aspect-square bg-slate-100">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-2">
                    <div className="line-clamp-2 text-[11px] leading-snug text-slate-800">
                      {p.name}
                    </div>
                    <div className="mt-1 text-sm font-bold" style={{ color: accent }}>
                      {money(p.priceMin, ar)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A product, as the app would show it.
 *
 * Its variants and their stock are the part worth seeing here: a collection
 * that looks full but whose products are all sold out is a section the
 * merchant should know about before a shopper finds it.
 */
function ProductScreen({
  id,
  accent,
  ar,
  onBack,
}: {
  id: string;
  accent: string;
  ar: boolean;
  onBack: () => void;
}) {
  const [product, setProduct] = useState<{
    name: string;
    image: string | null;
    description: string | null;
    priceMin: number | null;
    compareAt: number | null;
    variants: { id: string; variantTitle: string | null; price: number | null; available: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProduct(null);
    setError(null);
    fetch(`/api/storefront/products/${encodeURIComponent(id)}`, {
      headers: { "x-store-channel": "app" },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setProduct(j.data) : setError(j?.error ?? "not_found")))
      .catch((e) => setError(String((e as Error).message)));
  }, [id]);

  return (
    <div className="bg-slate-50">
      <ScreenBar title={product?.name ?? "…"} accent={accent} ar={ar} onBack={onBack} />
      {error ? (
        <ScreenError error={error} ar={ar} />
      ) : !product ? (
        <p className="py-16 text-center text-sm text-slate-400">…</p>
      ) : (
        <div className="space-y-3 p-4">
          <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold" style={{ color: accent }}>
                {money(product.priceMin, ar)}
              </span>
              {product.compareAt != null &&
                product.priceMin != null &&
                product.compareAt > product.priceMin && (
                  <span className="text-xs text-slate-400 line-through">
                    {money(product.compareAt, ar)}
                  </span>
                )}
            </div>
          </div>
          {product.description && (
            <p className="line-clamp-4 text-xs leading-relaxed text-slate-600">
              {product.description.replace(/<[^>]*>/g, " ").trim()}
            </p>
          )}
          <ul className="space-y-1.5">
            {product.variants.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {v.variantTitle ?? (ar ? "الأساسي" : "Default")}
                </span>
                <span className="shrink-0 text-slate-500">{money(v.price, ar)}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    v.available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {v.available > 0
                    ? `${v.available} ${ar ? "متاح" : "left"}`
                    : ar
                      ? "نفد"
                      : "sold out"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Cart, checkout and account, drawn from their settings.
 *
 * These are the one place the editor shows something the shopper's own data
 * would fill in — an empty basket has nothing to preview, and a checkout
 * cannot be filled in on the merchant's behalf. So they are drawn with sample
 * rows, clearly a sample, to show the wording and which parts appear. The full
 * app one click away is where they are exercised for real.
 */
function MockScreen({
  page,
  theme,
  ar,
}: {
  page: ScreenKey;
  theme: AppTheme;
  ar: boolean;
}) {
  const accent = theme.settings.accent;
  const s = theme.screens;

  if (page === "cart") {
    const c = s.cart;
    return (
      <div className="space-y-3 bg-slate-50 p-4">
        <div className="rounded-2xl border border-dashed border-slate-300 p-2 text-center text-[10px] text-slate-400">
          {ar ? "سلة كمثال" : "a sample basket"}
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5"
          >
            <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" />
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-4/5 rounded bg-slate-200" />
              <div className="mt-1.5 text-sm font-bold text-slate-900">
                {(i * 1250).toLocaleString()} {ar ? "ج.م" : "EGP"}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300">
                −
              </span>
              <span className="w-4 text-center text-sm font-semibold text-slate-700">1</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300">
                +
              </span>
            </div>
          </div>
        ))}

        {c.showCoupon && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <div className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm leading-10 text-slate-400">
                {c.couponLabel || (ar ? "كود الخصم" : "Discount code")}
              </div>
              <span className="flex h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">
                {ar ? "تطبيق" : "Apply"}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-slate-900 p-4 text-white">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{c.totalLabel || (ar ? "الإجمالي" : "Total")}</span>
            <span className="text-lg font-bold">3,750 {ar ? "ج.م" : "EGP"}</span>
          </div>
          <div
            className="mt-3 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            {c.checkoutLabel || (ar ? "إتمام الطلب" : "Checkout")}
          </div>
        </div>

        <p className="pt-2 text-center text-[11px] text-slate-400">
          {ar ? "عند الفراغ: " : "When empty: "}
          {c.emptyText || (ar ? "السلة فارغة" : "The basket is empty")}
        </p>
      </div>
    );
  }

  if (page === "checkout") {
    const c = s.checkout;
    const fields: string[] = [
      ar ? "الاسم" : "Name",
      ar ? "رقم الموبايل" : "Phone",
      ...(c.askEmail ? [ar ? "البريد" : "Email"] : []),
      ar ? "المحافظة" : "Governorate",
      ar ? "المدينة" : "City",
      ar ? "العنوان" : "Address",
      ...(c.askNote ? [ar ? "ملاحظات" : "Order note"] : []),
    ];
    return (
      <div className="space-y-3 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">
          {c.title || (ar ? "الدفع عند الاستلام" : "Cash on delivery")}
        </h3>
        {c.note && <p className="text-[11px] text-slate-500">{c.note}</p>}
        {fields.map((f) => (
          <div key={f}>
            <div className="text-[11px] font-medium text-slate-600">{f}</div>
            <div className="mt-1 h-10 rounded-xl border border-slate-300 bg-white" />
          </div>
        ))}
        <div
          className="rounded-xl py-2.5 text-center text-sm font-semibold text-white"
          style={{ background: accent }}
        >
          {c.placeLabel || (ar ? "تأكيد الطلب" : "Place the order")}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          {ar
            ? "الرقم مقفول على حساب العميل — الخادم يرفض أي رقم آخر."
            : "The phone is locked to the signed-in account; the server refuses any other."}
        </p>
      </div>
    );
  }

  const a = s.account;
  const rows: string[] = [
    ...(a.showReturns
      ? [a.returnsLabel || (ar ? "الاسترجاع والاستبدال" : "Returns & exchanges")]
      : []),
    ...(a.showRequests ? [a.requestsLabel || (ar ? "اسألينا" : "Ask us a question")] : []),
    ...(a.showReviews ? [a.reviewsLabel || (ar ? "التقييمات" : "Reviews")] : []),
  ];
  return (
    <div className="space-y-3 bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          {a.signedOutText || (ar ? "سجّلي الدخول برقم الموبايل" : "Sign in with your phone number")}
        </p>
        <div
          className="mt-3 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
          style={{ background: accent }}
        >
          {ar ? "تسجيل الدخول" : "Sign in"}
        </div>
      </div>
      {rows.map((r) => (
        <div
          key={r}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-800"
        >
          {r}
          <span className="text-slate-300">›</span>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="py-8 text-center text-[11px] text-slate-400">
          {ar ? "كل الصفوف مخفية" : "Every row is hidden"}
        </p>
      )}
    </div>
  );
}

/** Every collection handle a theme points at, from sections and their items. */
function referencedHandles(theme: AppTheme): string[] {
  const out = new Set<string>();
  for (const block of theme.blocks) {
    const handle = block.settings?.handle;
    if (typeof handle === "string" && handle) out.add(handle);
    for (const item of itemsOf(block)) {
      if (typeof item.handle === "string" && item.handle) out.add(item.handle);
    }
  }
  return [...out];
}
