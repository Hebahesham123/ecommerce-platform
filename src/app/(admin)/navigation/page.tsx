"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { countItems, depthOf, type Menu, type NavItem } from "@/lib/navigation";
import {
  loadNavigation,
  saveMenuItems,
  createMenu,
  deleteMenu,
  generateFromCollections,
} from "./actions";
import { MenuTree } from "./menu-tree";
import type { LinkTargets } from "@/components/link-picker";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiStrip } from "@/components/dashboard-ui";
import { IcPlus, IcAlert, IcTrash, IcLink, IcMenu } from "@/components/icons";

const EMPTY_TARGETS: LinkTargets = { collections: [], products: [] };

export default function NavigationPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [menus, setMenus] = useState<Menu[]>([]);
  const [targets, setTargets] = useState<LinkTargets>(EMPTY_TARGETS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NavItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(selectId?: string) {
    setLoading(true);
    const res = await loadNavigation();
    if (res.ok) {
      setMenus(res.data.menus);
      setTargets(res.data.targets);
      const pick =
        selectId ??
        activeId ??
        res.data.menus.find((m) => m.handle === "main-menu")?.id ??
        res.data.menus[0]?.id ??
        null;
      setActiveId(pick);
      setDraft(res.data.menus.find((m) => m.id === pick)?.items ?? []);
      setDirty(false);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => menus.find((m) => m.id === activeId) ?? null, [menus, activeId]);

  function selectMenu(m: Menu) {
    if (dirty && !window.confirm(ar ? "تجاهل التعديلات غير المحفوظة؟" : "Discard unsaved changes?"))
      return;
    setActiveId(m.id);
    setDraft(m.items);
    setDirty(false);
  }

  async function onSave() {
    if (!activeId) return;
    setSaving(true);
    const res = await saveMenuItems(activeId, draft);
    setSaving(false);
    if (res.ok) {
      setDraft(res.data);
      setMenus((cur) => cur.map((m) => (m.id === activeId ? { ...m, items: res.data } : m)));
      setDirty(false);
    } else {
      setError(res.error);
    }
  }

  async function onGenerate() {
    if (!activeId) return;
    if (
      !window.confirm(
        ar
          ? "سيتم استبدال عناصر هذه القائمة بتصنيفات متجرك. متابعة؟"
          : "This replaces the menu's items with your store's collections. Continue?",
      )
    )
      return;
    setSaving(true);
    const res = await generateFromCollections(activeId);
    setSaving(false);
    if (res.ok) {
      setDraft(res.data);
      setMenus((cur) => cur.map((m) => (m.id === activeId ? { ...m, items: res.data } : m)));
      setDirty(false);
    } else setError(res.error);
  }

  async function onCreate() {
    const title = window.prompt(ar ? "اسم القائمة" : "Menu name");
    if (!title) return;
    const handle = window.prompt(
      ar ? "المعرّف (كما يطلبه القالب)" : "Handle (what the theme asks for)",
      title.toLowerCase().replace(/\s+/g, "-"),
    );
    if (!handle) return;
    const res = await createMenu(handle, title);
    if (res.ok) load(res.data.id);
    else setError(res.error);
  }

  async function onDeleteMenu(m: Menu) {
    if (!window.confirm(ar ? `حذف قائمة "${m.title}"؟` : `Delete the "${m.title}" menu?`)) return;
    const res = await deleteMenu(m.id);
    if (res.ok) load(menus.find((x) => x.id !== m.id)?.id);
    else setError(res.error);
  }

  const kpis = useMemo(
    () => [
      { label: ar ? "القوائم" : "Menus", value: num(menus.length, lang) },
      { label: ar ? "العناصر" : "Items", value: num(countItems(draft), lang) },
      { label: ar ? "المستويات" : "Levels", value: num(depthOf(draft), lang) },
      {
        label: ar ? "التصنيفات المتاحة" : "Collections available",
        value: num(targets.collections.length, lang),
      },
    ],
    [menus, draft, targets, ar, lang],
  );

  return (
    <>
      <PageHeader
        title={ar ? "قوائم التنقّل" : "Navigation"}
        subtitle={
          ar
            ? "ابنِ قوائم متعددة المستويات ووجّه كل عنصر لأي منتج أو تصنيف"
            : "Build multi-level menus and point each item at any product or collection"
        }
        actions={
          <>
            <button className="btn-outline" onClick={onCreate} disabled={Boolean(error)}>
              <IcPlus className="h-4 w-4" /> {ar ? "قائمة جديدة" : "New menu"}
            </button>
            <button
              className="btn-primary disabled:opacity-60"
              onClick={onSave}
              disabled={saving || !dirty || !activeId}
            >
              {saving
                ? ar
                  ? "جارٍ الحفظ…"
                  : "Saving…"
                : dirty
                  ? ar
                    ? "حفظ"
                    : "Save"
                  : ar
                    ? "محفوظ"
                    : "Saved"}
            </button>
          </>
        }
      />

      {error === "migration_missing" ? (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">
              {ar ? "شغّل ترحيل قوائم التنقّل" : "Run the navigation migration"}
            </div>
            <code className="mt-1 block font-mono text-xs">
              supabase/migrations/0013_navigation.sql
            </code>
          </div>
        </Card>
      ) : error === "not_configured" ? (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("supabase_missing")}</span>
        </Card>
      ) : error ? (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      ) : null}

      {!error && <KpiStrip segments={kpis} />}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        {/* Menu list */}
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {ar ? "القوائم" : "Menus"}
          </div>
          {loading ? (
            <p className="p-6 text-center text-sm text-ink-soft">{t("loading")}</p>
          ) : menus.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-soft">
              {ar ? "لا توجد قوائم" : "No menus"}
            </p>
          ) : (
            <div className="divide-y divide-line">
              {menus.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2.5 ${
                    m.id === activeId ? "bg-brand-50" : "hover:bg-surface-hover"
                  }`}
                >
                  <button className="min-w-0 flex-1 text-start" onClick={() => selectMenu(m)}>
                    <div
                      className={`truncate text-sm font-medium ${
                        m.id === activeId ? "text-brand-700" : "text-ink"
                      }`}
                    >
                      {m.title}
                    </div>
                    <div className="truncate font-mono text-[11px] text-ink-soft">{m.handle}</div>
                  </button>
                  <Badge className="bg-slate-100 text-slate-600">
                    {num(countItems(m.items), lang)}
                  </Badge>
                  <button
                    className="text-ink-soft hover:text-rose-600"
                    onClick={() => onDeleteMenu(m)}
                    title={ar ? "حذف" : "Delete"}
                  >
                    <IcTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tree editor */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">
                {active?.title ?? (ar ? "اختر قائمة" : "Pick a menu")}
              </div>
              <div className="text-[11px] text-ink-soft">
                {ar
                  ? `حتى ٣ مستويات · القالب يقرأها بالمعرّف "${active?.handle ?? ""}"`
                  : `Up to 3 levels · the theme reads it by the handle "${active?.handle ?? ""}"`}
              </div>
            </div>
            <button
              className="btn-ghost h-8 px-3 text-xs"
              onClick={onGenerate}
              disabled={!activeId || saving}
            >
              {ar ? "توليد من التصنيفات" : "Generate from collections"}
            </button>
            <a
              className="btn-ghost h-8 px-3 text-xs"
              href="/shop"
              target="_blank"
              rel="noreferrer"
            >
              <IcLink className="h-3.5 w-3.5" /> {ar ? "عرض" : "View"}
            </a>
          </div>

          <div className="p-3">
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-soft">{t("loading")}</p>
            ) : !activeId ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-soft">
                <IcMenu className="h-6 w-6" />
                {ar ? "اختر قائمة لتحريرها" : "Pick a menu to edit"}
              </div>
            ) : (
              <MenuTree
                items={draft}
                targets={targets}
                onChange={(next) => {
                  setDraft(next);
                  setDirty(true);
                }}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
