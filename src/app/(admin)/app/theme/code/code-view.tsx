"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { IcChevron, IcCopy, IcSearch, IcAlert, IcFile, IcCode } from "@/components/icons";
import type { GeneratedFile } from "@/lib/app-theme-codegen";
import { generatedFiles, loadThemeEditor } from "../actions";

/**
 * The app's code.
 *
 * Same shape as the theme code editor — file tree, line numbers, a status bar
 * — with one deliberate difference: you cannot type in it.
 *
 * A website theme is a folder of Liquid that arrived from somewhere else, so
 * editing it is the only way to change it. An app has no such folder; these
 * files are written from the theme every time a section moves. If they were
 * editable, the next edit in the customizer would silently throw the typing
 * away — so instead of a Save button that lies, there is a Copy button that
 * does not.
 */

function languageOf(path: string) {
  return path.endsWith(".tsx") ? "typescriptreact" : path.endsWith(".ts") ? "typescript" : "json";
}

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function CodeView() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const params = useSearchParams();

  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>(params.get("file") ?? "HomeScreen.tsx");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const editor = await loadThemeEditor();
      if (!editor.ok) return setError(editor.error);
      const gen = await generatedFiles(editor.data.theme);
      if (!gen.ok) return setError(gen.error);
      setFiles(gen.data);
    })();
  }, []);

  const current = useMemo(
    () => files?.find((f) => f.path === path) ?? files?.[0] ?? null,
    [files, path],
  );
  const content = current?.contents ?? "";
  const lineCount = useMemo(() => content.split("\n").length, [content]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (files ?? []).filter((f) => !needle || f.path.toLowerCase().includes(needle));
  }, [files, q]);

  function copy() {
    navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadAll() {
    // One file, because a zip needs a library and this is meant to be pasted
    // into a project rather than unpacked into one.
    const body = (files ?? [])
      .map((f) => `// ===== ${f.path} ${"=".repeat(Math.max(0, 60 - f.path.length))}\n\n${f.contents}`)
      .join("\n\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "app-home-screen.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <IcAlert className="h-6 w-6" />
        </span>
        <p className="text-sm text-ink-muted">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app/theme" className="btn-ghost h-9 px-2">
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{ar ? "كود التطبيق" : "App code"}</div>
          <div className="truncate text-xs text-ink-soft">
            {ar
              ? "يُكتب من المظهر عند كل تعديل — للنسخ، لا للتعديل"
              : "Written from the theme on every edit. To copy, not to edit"}
          </div>
        </div>
        <button onClick={downloadAll} className="btn-outline ms-auto h-9 px-3 text-xs">
          {ar ? "تنزيل الكل" : "Download all"}
        </button>
        <button onClick={copy} disabled={!current} className="btn-primary h-9 gap-1.5 px-3 text-xs">
          <IcCopy className="h-3.5 w-3.5" />
          {copied ? (ar ? "تم النسخ" : "Copied") : ar ? "نسخ الملف" : "Copy file"}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
        {/* ---------------------------- file tree ------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-line p-2">
            <div className="relative">
              <IcSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "بحث…" : "Search…"}
                className="h-8 w-full rounded-lg border border-line bg-surface-page ps-8 pe-2 text-xs text-ink outline-none focus:border-brand-600"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {shown.map((f) => {
              const active = current?.path === f.path;
              const depth = f.path.split("/").length - 1;
              return (
                <button
                  key={f.path}
                  onClick={() => setPath(f.path)}
                  style={{ paddingInlineStart: depth * 12 + 10 }}
                  className={`flex w-full items-center gap-1.5 py-1.5 pe-2 text-start text-xs transition-colors ${
                    active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  <IcFile className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">
                    {f.path.split("/").pop()}
                  </span>
                </button>
              );
            })}
            {files && shown.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-soft">
                {ar ? "لا نتائج" : "No matches"}
              </p>
            )}
            {!files && (
              <p className="p-4 text-center text-xs text-ink-soft">
                {ar ? "جارٍ التوليد…" : "Generating…"}
              </p>
            )}
          </div>
        </Card>

        {/* ------------------------------ code ---------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <IcCode className="h-3.5 w-3.5 text-ink-soft" />
            <span className="min-w-0 truncate font-mono text-xs text-ink" dir="ltr">
              {current?.path ?? "—"}
            </span>
            <span className="badge ms-auto bg-slate-100 text-[10px] text-ink-soft">
              {ar ? "مولَّد" : "generated"}
            </span>
          </div>

          <div className="flex min-h-0 flex-1">
            <div
              ref={gutterRef}
              className="select-none overflow-hidden border-e border-line bg-surface-page py-3 text-end font-mono text-xs leading-5 text-ink-soft"
              style={{ width: `${String(lineCount).length + 2}ch` }}
              dir="ltr"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="pe-2">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={content}
              readOnly
              spellCheck={false}
              wrap="off"
              dir="ltr"
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              className="min-h-0 flex-1 resize-none bg-surface p-3 font-mono text-xs leading-5 text-ink outline-none"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-line px-3 py-1.5 text-[11px] text-ink-soft">
            <span>{current ? languageOf(current.path) : "—"}</span>
            <span>
              {lineCount} {ar ? "سطر" : "lines"}
            </span>
            <span>{formatBytes(content.length)}</span>
            <span className="ms-auto">
              {ar
                ? "عدّلي القسم في المظهر ليتغيّر هذا"
                : "Change the section in the theme and this changes with it"}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
