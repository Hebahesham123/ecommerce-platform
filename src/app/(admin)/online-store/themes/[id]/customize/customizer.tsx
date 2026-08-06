"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type {
  FoundLink,
  SectionDef,
  SettingDef,
  ThemeCustomization,
} from "@/lib/theme-schema";
import { EMPTY_CUSTOMIZATION, sectionKey } from "@/lib/theme-schema";
import {
  loadCustomizer,
  saveCustomization,
  resetCustomization,
  scanPageLinks,
  type CustomizerData,
} from "./actions";
import { LinkPicker, ListPicker } from "./link-picker";
import { Card } from "@/components/ui";
import {
  IcAlert,
  IcChevron,
  IcDesktop,
  IcLink,
  IcMobile,
  IcRefresh,
  IcTheme,
} from "@/components/icons";

const ROUTES = [
  { path: "/", ar: "الرئيسية", en: "Home" },
  { path: "/collections", ar: "التصنيفات", en: "Collections" },
  { path: "/collections/all", ar: "كل المنتجات", en: "All products" },
  { path: "/cart", ar: "السلة", en: "Cart" },
  { path: "/search", ar: "البحث", en: "Search" },
];

/** Scope labels read better than raw file paths. */
function scopeLabel(scope: string, ar: boolean): string {
  if (scope === "layout") return ar ? "كل الصفحات" : "Every page";
  const g = scope.match(/^sections\/(.+)$/);
  if (g) return `${ar ? "مجموعة" : "Group"} · ${g[1]}`;
  const t = scope.match(/^templates\/(.+)$/);
  if (t) return `${ar ? "صفحة" : "Template"} · ${t[1]}`;
  return scope;
}

export function Customizer({ themeId }: { themeId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [data, setData] = useState<CustomizerData | null>(null);
  const [draft, setDraft] = useState<ThemeCustomization>(EMPTY_CUSTOMIZATION);
  const [links, setLinks] = useState<FoundLink[]>([]);
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadCustomizer(themeId);
    if (res.ok) {
      setData(res.data);
      setDraft(res.data.customization);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [themeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the hardcoded-button list whenever the previewed page changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await scanPageLinks(themeId, path);
      if (!cancelled && res.ok) setLinks(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [themeId, path, nonce]);

  const previewSrc = `/online-store/themes/${themeId}/preview${path === "/" ? "" : path}${
    nonce ? `?r=${nonce}` : ""
  }`;

  // ---- Draft mutation -------------------------------------------------------
  function setGlobal(id: string, value: unknown) {
    setDraft((d) => ({ ...d, settings: { ...d.settings, [id]: value } }));
    setDirty(true);
  }
  function setSection(key: string, id: string, value: unknown) {
    setDraft((d) => ({
      ...d,
      sections: {
        ...d.sections,
        [key]: { ...d.sections[key], settings: { ...d.sections[key]?.settings, [id]: value } },
      },
    }));
    setDirty(true);
  }
  function setBlock(key: string, blockId: string, id: string, value: unknown) {
    setDraft((d) => {
      const sec = d.sections[key] ?? {};
      return {
        ...d,
        sections: {
          ...d.sections,
          [key]: {
            ...sec,
            blocks: { ...sec.blocks, [blockId]: { ...sec.blocks?.[blockId], [id]: value } },
          },
        },
      };
    });
    setDirty(true);
  }
  /** Overrides are identified by href + anchor text, matching the scan rows. */
  function setLinkOverride(from: string, to: string, label?: string) {
    setDraft((d) => {
      const rest = d.links.filter(
        (l) => !(l.from === from && (l.label ?? "") === (label ?? "")),
      );
      return { ...d, links: to ? [...rest, { from, to, label }] : rest };
    });
    setDirty(true);
  }

  async function onSave() {
    setSaving(true);
    const res = await saveCustomization(themeId, draft);
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setNonce((n) => n + 1); // reload the preview with the saved values
    } else {
      setError(res.error);
    }
  }

  async function onReset() {
    if (!window.confirm(ar ? "إرجاع كل الروابط للأصل؟" : "Reset every link to the theme default?"))
      return;
    setSaving(true);
    await resetCustomization(themeId);
    setSaving(false);
    setDirty(false);
    setNonce((n) => n + 1);
    load();
  }

  /** Effective value: saved theme value unless the merchant overrode it. */
  function sectionValue(sec: SectionDef, id: string): unknown {
    return draft.sections[sec.key]?.settings?.[id] ?? sec.values[id];
  }

  const editable = useMemo(
    () =>
      (data?.map.sections ?? []).filter(
        (s) => s.settings.length > 0 || s.blocks.some((b) => b.settings.length > 0),
      ),
    [data],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, SectionDef[]>();
    for (const s of editable) {
      if (!m.has(s.scope)) m.set(s.scope, []);
      m.get(s.scope)!.push(s);
    }
    return [...m.entries()];
  }, [editable]);

  if (error === "migration_missing")
    return (
      <Notice
        tone="amber"
        title={ar ? "شغّل ترحيل تخصيص القوالب" : "Run the theme customization migration"}
        body="supabase/migrations/0012_theme_customization.sql"
      />
    );
  if (error === "not_liquid")
    return (
      <Notice
        tone="amber"
        title={ar ? "هذا القالب HTML ثابت" : "This theme is static HTML"}
        body={
          ar
            ? "التخصيص متاح لقوالب Liquid فقط. ارفع قالب Shopify مضغوطاً."
            : "Customizing works on Liquid themes. Upload a Shopify theme zip to use it."
        }
      />
    );
  if (error)
    return <Notice tone="rose" title={ar ? "خطأ" : "Error"} body={error} />;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/online-store/themes" className="btn-ghost h-9 px-2">
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">
            {data?.themeName ?? (ar ? "تخصيص القالب" : "Customize theme")}
          </h1>
          <p className="text-xs text-ink-soft">
            {ar
              ? "وجّه كل زر ورابط في القالب إلى أي منتج أو تصنيف"
              : "Point every button and link in the theme at any product or collection"}
          </p>
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
              {d === "desktop" ? <IcDesktop className="h-4 w-4" /> : <IcMobile className="h-4 w-4" />}
            </button>
          ))}
        </div>
        <button className="btn-ghost h-9 px-3 text-xs" onClick={onReset} disabled={saving}>
          {ar ? "إرجاع" : "Reset"}
        </button>
        <button
          className="btn-primary disabled:opacity-60"
          onClick={onSave}
          disabled={saving || !dirty}
        >
          {saving
            ? ar
              ? "جارٍ الحفظ…"
              : "Saving…"
            : dirty
              ? ar
                ? "حفظ وتحديث"
                : "Save & refresh"
              : ar
                ? "محفوظ"
                : "Saved"}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        {/* Editor */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-soft">
                {ar ? "جارٍ التحميل…" : "Loading…"}
              </p>
            ) : (
              <div className="space-y-3">
                {/* Global settings */}
                {data && data.map.global.settings.length > 0 && (
                  <Group
                    title={ar ? "إعدادات القالب العامة" : "Global theme settings"}
                    openState={open}
                    setOpen={setOpen}
                    id="__global"
                  >
                    {data.map.global.settings.map((s) => (
                      <FieldRow key={s.id} def={s} ar={ar}>
                        <Control
                          def={s}
                          value={draft.settings[s.id] ?? data.map.global.values[s.id]}
                          targets={data.targets}
                          ar={ar}
                          onChange={(v) => setGlobal(s.id, v)}
                        />
                      </FieldRow>
                    ))}
                  </Group>
                )}

                {/* Sections */}
                {grouped.map(([scope, secs]) => (
                  <div key={scope}>
                    <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      {scopeLabel(scope, ar)}
                    </div>
                    <div className="space-y-2">
                      {secs.map((sec) => (
                        <Group
                          key={sec.key}
                          title={sec.name}
                          subtitle={sec.type}
                          openState={open}
                          setOpen={setOpen}
                          id={sec.key}
                        >
                          {sec.settings.map((s) => (
                            <FieldRow key={s.id} def={s} ar={ar}>
                              <Control
                                def={s}
                                value={sectionValue(sec, s.id)}
                                targets={data!.targets}
                                ar={ar}
                                onChange={(v) => setSection(sec.key, s.id, v)}
                              />
                            </FieldRow>
                          ))}

                          {sec.blocks
                            .filter((b) => b.settings.length > 0)
                            .map((b) => (
                              <div
                                key={b.id}
                                className="mt-2 rounded-xl border border-line bg-surface-page p-2.5"
                              >
                                <div className="mb-1.5 text-xs font-semibold text-ink-muted">
                                  {b.label}
                                </div>
                                {b.settings.map((s) => (
                                  <FieldRow key={s.id} def={s} ar={ar}>
                                    <Control
                                      def={s}
                                      value={
                                        draft.sections[sec.key]?.blocks?.[b.id]?.[s.id] ??
                                        b.values[s.id]
                                      }
                                      targets={data!.targets}
                                      ar={ar}
                                      onChange={(v) => setBlock(sec.key, b.id, s.id, v)}
                                    />
                                  </FieldRow>
                                ))}
                              </div>
                            ))}
                        </Group>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Hardcoded links found on the previewed page */}
                <div>
                  <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {ar ? "أزرار هذه الصفحة" : "Buttons on this page"}
                  </div>
                  <Group
                    title={ar ? "روابط مكتوبة داخل القالب" : "Links hardcoded in the theme"}
                    subtitle={`${links.length}`}
                    openState={open}
                    setOpen={setOpen}
                    id="__links"
                    defaultOpen
                  >
                    {links.length === 0 ? (
                      <p className="py-2 text-xs text-ink-soft">
                        {ar ? "لا توجد روابط في هذه الصفحة." : "No links found on this page."}
                      </p>
                    ) : (
                      links.map((l) => {
                        const override = draft.links.find(
                          (o) => o.from === l.href && (o.label ?? "") === (l.label ?? ""),
                        );
                        return (
                          <div
                            key={`${l.href} ${l.label}`}
                            className="border-b border-line py-2 last:border-b-0"
                          >
                            <div className="mb-1 flex items-baseline gap-1.5">
                              <span className="truncate text-sm font-medium text-ink">
                                {l.label || (ar ? "(بدون نص)" : "(no label)")}
                              </span>
                              {l.count > 1 && (
                                <span className="badge bg-slate-100 text-[10px] text-ink-muted">
                                  ×{l.count}
                                </span>
                              )}
                            </div>
                            <div className="mb-1 truncate font-mono text-[11px] text-ink-soft">
                              {l.href}
                            </div>
                            {l.count > 1 && (
                              <p className="mb-1 text-[11px] text-amber-700">
                                {ar
                                  ? `${l.count} أزرار متطابقة في هذه الصفحة — ستتغير كلها.`
                                  : `${l.count} identical buttons on this page — all of them will move.`}
                              </p>
                            )}
                            <LinkPicker
                              type="url"
                              value={override?.to ?? ""}
                              targets={data!.targets}
                              ar={ar}
                              onChange={(v) => setLinkOverride(l.href, v, l.label)}
                            />
                          </div>
                        );
                      })
                    )}
                  </Group>
                </div>

                {editable.length === 0 && (
                  <div className="rounded-xl border border-line bg-surface-page p-3 text-xs text-ink-soft">
                    <IcTheme className="mb-1 h-4 w-4" />
                    {ar
                      ? "هذا القالب لا يعرّف إعدادات روابط في الـ schema — استخدم قائمة أزرار الصفحة بالأعلى."
                      : "This theme declares no link settings in its schema — use the page buttons list above."}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Preview */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2">
            {ROUTES.map((r) => (
              <button
                key={r.path}
                onClick={() => setPath(r.path)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  path === r.path
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {ar ? r.ar : r.en}
              </button>
            ))}
            <button
              className="btn-ghost ms-auto h-8 px-2"
              onClick={() => setNonce((n) => n + 1)}
              title={ar ? "تحديث" : "Refresh"}
            >
              <IcRefresh className="h-4 w-4" />
            </button>
            <a
              className="btn-ghost h-8 px-2"
              href={previewSrc}
              target="_blank"
              rel="noreferrer"
              title={ar ? "فتح في تبويب" : "Open in a tab"}
            >
              <IcLink className="h-4 w-4" />
            </a>
          </div>
          <div className="flex min-h-0 flex-1 justify-center bg-surface-page p-2">
            <iframe
              key={previewSrc}
              src={previewSrc}
              title="preview"
              className={`h-full rounded-xl border-0 bg-white shadow-card ${
                device === "mobile" ? "w-[390px] max-w-full" : "w-full"
              }`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---- Small building blocks --------------------------------------------------
function Control({
  def,
  value,
  targets,
  ar,
  onChange,
}: {
  def: SettingDef;
  value: unknown;
  targets: CustomizerData["targets"];
  ar: boolean;
  onChange: (v: unknown) => void;
}) {
  if (def.type === "text")
    return (
      <input
        className="h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600 focus:bg-white"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (def.type === "collection_list" || def.type === "product_list")
    return (
      <ListPicker type={def.type} value={value} targets={targets} ar={ar} onChange={onChange} />
    );
  return (
    <LinkPicker type={def.type} value={value} targets={targets} ar={ar} onChange={onChange} />
  );
}

function FieldRow({
  def,
  ar,
  children,
}: {
  def: SettingDef;
  ar: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-ink-muted">{def.label}</span>
        <span className="badge bg-slate-100 text-[10px] text-ink-soft">{def.type}</span>
      </div>
      {children}
      {def.info && <p className="mt-0.5 text-[11px] text-ink-soft">{ar ? def.info : def.info}</p>}
    </div>
  );
}

function Group({
  id,
  title,
  subtitle,
  openState,
  setOpen,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  openState: Record<string, boolean>;
  setOpen: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const expanded = openState[id] ?? Boolean(defaultOpen);
  return (
    <div className="rounded-xl border border-line">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-start"
        onClick={() => setOpen((s) => ({ ...s, [id]: !expanded }))}
      >
        <IcChevron
          className={`h-3 w-3 shrink-0 text-ink-soft transition-transform ${
            expanded ? "rotate-90" : ""
          } rtl:-scale-x-100`}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</span>
        {subtitle && (
          <span className="shrink-0 font-mono text-[10px] text-ink-soft">{subtitle}</span>
        )}
      </button>
      {expanded && <div className="border-t border-line px-3 pb-2">{children}</div>}
    </div>
  );
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: "amber" | "rose";
  title: string;
  body: string;
}) {
  const cls = tone === "amber" ? "bg-amber-50/60 text-amber-800" : "bg-rose-50 text-rose-700";
  return (
    <Card className={`flex items-start gap-3 p-4 ${cls}`}>
      <IcAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <code className="mt-1 block font-mono text-xs opacity-80">{body}</code>
      </div>
    </Card>
  );
}

export { sectionKey };
