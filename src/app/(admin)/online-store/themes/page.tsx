"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import {
  type Theme,
  themeStatusKey,
  themeStatusTone,
} from "@/lib/themes";
import { formatBytes } from "@/lib/content";
import {
  listThemes,
  uploadTheme,
  publishTheme,
  renameTheme,
  deleteTheme,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { ThemePreview } from "@/components/theme-preview";
import {
  IcUpload,
  IcEye,
  IcTrash,
  IcTheme,
  IcAlert,
} from "@/components/icons";

/** Non-interactive thumbnail of a theme's entry page. */
function ThemeThumb({ theme }: { theme: Theme }) {
  if (!theme.previewUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-slate-50 text-ink-soft">
        <IcTheme className="h-10 w-10" />
      </div>
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <iframe
        src={theme.previewUrl}
        title={theme.name}
        tabIndex={-1}
        scrolling="no"
        className="pointer-events-none h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
      <div className="absolute inset-0" />
    </div>
  );
}

export default function ThemesPage() {
  const { t, lang } = useI18n();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Theme | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await listThemes();
    if (res.ok) {
      setThemes(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadTheme(fd);
    setUploading(false);
    if (res.ok) {
      await load();
    } else {
      const msgs: Record<string, string> = {
        empty_zip: lang === "ar" ? "الملف المضغوط فارغ" : "The zip is empty",
        unsupported_type: lang === "ar" ? "نوع ملف غير مدعوم (استخدم zip أو html)" : "Unsupported file (use zip or html)",
        not_configured: t("supabase_missing"),
      };
      setError(msgs[res.error] ?? res.error);
    }
  }

  async function onPublish(id: string) {
    setBusyId(id);
    const res = await publishTheme(id);
    setBusyId(null);
    if (res.ok)
      setThemes((cur) =>
        cur.map((th) => ({
          ...th,
          isCurrent: th.id === id,
          status: th.id === id ? "published" : th.isCurrent ? "unpublished" : th.status,
        })),
      );
  }

  async function onRename(th: Theme) {
    const name = window.prompt(t("theme_name"), th.name);
    if (!name || name === th.name) return;
    const res = await renameTheme(th.id, name);
    if (res.ok) setThemes((cur) => cur.map((x) => (x.id === th.id ? { ...x, name } : x)));
  }

  async function onDelete(id: string) {
    if (!window.confirm(t("delete_theme_confirm"))) return;
    setBusyId(id);
    const res = await deleteTheme(id);
    setBusyId(null);
    if (res.ok) setThemes((cur) => cur.filter((x) => x.id !== id));
  }

  const current = themes.find((th) => th.isCurrent) ?? null;
  const library = themes.filter((th) => !th.isCurrent);

  return (
    <>
      <PageHeader
        title={t("nav_themes")}
        subtitle={t("themes_subtitle")}
        actions={
          <button
            className="btn-primary disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <IcUpload className="h-4 w-4" /> {uploading ? t("theme_uploading") : t("upload_theme")}
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept=".zip,.html,.htm,application/zip,text/html"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

      {error === "not_configured" ? (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("supabase_missing")}</span>
        </Card>
      ) : error ? (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      ) : null}

      {/* Upload dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleUpload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mb-5 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:bg-surface-page"
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <IcUpload className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">
          {uploading ? t("theme_uploading") : t("drop_theme_here")}
        </p>
        <p className="text-xs text-ink-soft">{t("theme_hint")}</p>
      </div>

      {/* Live / current theme */}
      {current && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-ink">{t("live_theme")}</h3>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
              <div className="relative aspect-[16/10] border-b border-line md:border-b-0 md:border-e">
                <ThemeThumb theme={current} />
                <span className="absolute start-3 top-3">
                  <Badge className={themeStatusTone.published}>{t("th_published")}</Badge>
                </span>
              </div>
              <div className="flex flex-col justify-between p-5">
                <div>
                  <h4 className="text-lg font-bold text-ink">{current.name}</h4>
                  <p className="mt-1 text-sm text-ink-muted">
                    {num(current.fileCount, lang)} {t("theme_files")} · {formatBytes(current.sizeBytes, lang)}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => setPreview(current)}>
                    <IcEye className="h-4 w-4" /> {t("preview")}
                  </button>
                  <button className="btn-outline" onClick={() => onRename(current)}>
                    {t("rename")}
                  </button>
                  <button
                    className="btn-ghost text-rose-600 hover:bg-rose-50"
                    onClick={() => onDelete(current.id)}
                    disabled={busyId === current.id}
                  >
                    <IcTrash className="h-4 w-4" /> {t("delete")}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Theme library */}
      <h3 className="mb-2 text-sm font-semibold text-ink">{t("theme_library")}</h3>

      {loading ? (
        <Card className="p-12 text-center text-sm text-ink-soft">{t("loading")}</Card>
      ) : library.length === 0 && !current ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IcTheme className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">{t("no_themes")}</div>
            <p className="mt-1 text-sm text-ink-soft">{t("no_themes_hint")}</p>
          </div>
          <button className="btn-primary mt-1" onClick={() => inputRef.current?.click()}>
            <IcUpload className="h-4 w-4" /> {t("upload_theme")}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {library.map((th) => (
            <Card key={th.id} className="overflow-hidden transition-shadow hover:shadow-pop">
              <button
                className="relative block aspect-[16/10] w-full border-b border-line"
                onClick={() => setPreview(th)}
                title={t("preview")}
              >
                <ThemeThumb theme={th} />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition hover:bg-ink/20 hover:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card">
                    <IcEye className="h-4 w-4" /> {t("preview")}
                  </span>
                </span>
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="min-w-0 truncate font-semibold text-ink">{th.name}</h4>
                  <Badge className={themeStatusTone[th.status]}>{t(themeStatusKey[th.status])}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {num(th.fileCount, lang)} {t("theme_files")} · {formatBytes(th.sizeBytes, lang)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <button
                    className="btn-primary h-8 px-3 text-xs disabled:opacity-60"
                    onClick={() => onPublish(th.id)}
                    disabled={busyId === th.id}
                  >
                    {t("publish")}
                  </button>
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => setPreview(th)}>
                    {t("preview")}
                  </button>
                  <button className="btn-ghost h-8 px-2 text-xs" onClick={() => onRename(th)}>
                    {t("rename")}
                  </button>
                  <button
                    className="btn-ghost ms-auto h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    onClick={() => onDelete(th.id)}
                    disabled={busyId === th.id}
                  >
                    <IcTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview && <ThemePreview theme={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
