"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "@/lib/content";
import { isEditablePath, languageOf } from "@/lib/themes";
import { listThemeFiles, type ThemeFile } from "../../actions";
import {
  readThemeFile,
  saveThemeFile,
  revertThemeFile,
  listModifiedFiles,
} from "./actions";
import { Card } from "@/components/ui";
import {
  IcChevron,
  IcFile,
  IcSearch,
  IcAlert,
  IcRefresh,
  IcLink,
  IcEye,
} from "@/components/icons";

// ---- File tree --------------------------------------------------------------
type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children: TreeNode[];
};

function buildTree(files: ThemeFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, size: 0, children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isDir: !isLeaf,
          size: isLeaf ? f.size : 0,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    );
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

function TreeItem({
  node,
  depth,
  selected,
  modified,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string;
  modified: Set<string>;
  onSelect: (path: string) => void;
}) {
  // Sections and snippets are what people come here to edit — open them first.
  const [open, setOpen] = useState(
    depth < 1 || ["sections", "snippets", "templates"].includes(node.name),
  );

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-hover"
          style={{ paddingInlineStart: depth * 12 + 8 }}
        >
          <IcChevron
            className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} rtl:-scale-x-100`}
          />
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open &&
          node.children.map((c) => (
            <TreeItem
              key={c.path}
              node={c}
              depth={depth + 1}
              selected={selected}
              modified={modified}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const active = selected === node.path;
  const editable = isEditablePath(node.path);
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover"
      } ${editable ? "" : "opacity-50"}`}
      style={{ paddingInlineStart: depth * 12 + 22 }}
      dir="ltr"
    >
      <IcFile className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
      {modified.has(node.path) && (
        <span
          className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          title="Edited"
        />
      )}
    </button>
  );
}

// ---- Editor -----------------------------------------------------------------
export function ThemeCodeEditor({ themeId }: { themeId: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [files, setFiles] = useState<ThemeFile[]>([]);
  const [modified, setModified] = useState<Set<string>>(new Set());
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [editable, setEditable] = useState(true);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [caret, setCaret] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const dirty = content !== original;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const [res, mod] = await Promise.all([
      listThemeFiles(themeId),
      listModifiedFiles(themeId),
    ]);
    if (res.ok) {
      setFiles(res.data.files);
      setError(null);
    } else setError(res.error);
    if (mod.ok) setModified(new Set(mod.data));
    setLoading(false);
  }, [themeId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const openFile = useCallback(
    async (next: string) => {
      if (dirty && !window.confirm(ar ? "تجاهل التعديلات غير المحفوظة؟" : "Discard unsaved changes?"))
        return;
      setBusy(true);
      setNotice(null);
      const res = await readThemeFile(themeId, next);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPath(next);
      setContent(res.data.content);
      setOriginal(res.data.content);
      setEditable(res.data.editable);
      setError(null);
    },
    [themeId, dirty, ar],
  );

  const onSave = useCallback(async () => {
    if (!path || !editable || !dirty) return;
    setBusy(true);
    setNotice(null);
    const res = await saveThemeFile(themeId, path, content);
    setBusy(false);
    if (res.ok) {
      setOriginal(content);
      setModified((m) => new Set(m).add(path));
      setNonce((n) => n + 1);
      setNotice(ar ? "تم الحفظ" : "Saved");
      setError(null);
    } else {
      setError(
        res.error.startsWith("invalid_json")
          ? `${ar ? "JSON غير صالح" : "Invalid JSON"} — ${res.error.slice("invalid_json: ".length)}`
          : res.error,
      );
    }
  }, [themeId, path, content, editable, dirty, ar]);

  // Ctrl/Cmd+S saves, like any editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  async function onRevert() {
    if (!path) return;
    if (
      !window.confirm(
        ar ? "استرجاع الملف كما تم رفعه؟" : "Restore this file as it was uploaded?",
      )
    )
      return;
    setBusy(true);
    const res = await revertThemeFile(themeId, path);
    setBusy(false);
    if (res.ok) {
      setContent(res.data.content);
      setOriginal(res.data.content);
      setModified((m) => {
        const next = new Set(m);
        next.delete(path);
        return next;
      });
      setNonce((n) => n + 1);
      setNotice(ar ? "تم الاسترجاع" : "Reverted");
    } else {
      setError(res.error === "no_original" ? (ar ? "لا توجد نسخة أصلية محفوظة" : "No original stored for this file") : res.error);
    }
  }

  const tree = useMemo(() => {
    const filtered = q
      ? files.filter((f) => f.path.toLowerCase().includes(q.toLowerCase()))
      : files;
    return buildTree(filtered);
  }, [files, q]);

  const lineCount = useMemo(() => content.split("\n").length, [content]);
  const currentSize = files.find((f) => f.path === path)?.size ?? 0;

  function updateCaret() {
    const el = textareaRef.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart);
    const lines = upto.split("\n");
    setCaret({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  }

  /** Tab inserts an indent instead of leaving the editor. */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: en } = el;
    const next = `${content.slice(0, s)}  ${content.slice(en)}`;
    setContent(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + 2;
    });
  }

  // `fresh=1` bypasses the server's cached copy of the theme's files, so the
  // preview shows the file that was just written rather than a stale bundle.
  const previewSrc = `/online-store/themes/${themeId}/preview?fresh=1&r=${nonce}`;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/online-store/themes" className="btn-ghost h-9 px-2">
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">
            {ar ? "محرر كود القالب" : "Theme code"}
          </h1>
          <p className="truncate font-mono text-xs text-ink-soft" dir="ltr">
            {path || (ar ? "اختر ملفاً" : "Pick a file")}
          </p>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {notice && <span className="text-xs font-medium text-emerald-600">{notice}</span>}
          <button
            className={`btn-ghost h-9 px-3 text-xs ${showPreview ? "bg-surface-page" : ""}`}
            onClick={() => setShowPreview((v) => !v)}
          >
            <IcEye className="h-4 w-4" /> {ar ? "معاينة" : "Preview"}
          </button>
          <button
            className="btn-ghost h-9 px-3 text-xs"
            onClick={onRevert}
            disabled={busy || !path || !modified.has(path)}
            title={ar ? "استرجاع الأصل" : "Restore the uploaded original"}
          >
            <IcRefresh className="h-4 w-4" /> {ar ? "استرجاع" : "Revert"}
          </button>
          <button
            className="btn-primary disabled:opacity-60"
            onClick={onSave}
            disabled={busy || !dirty || !editable}
          >
            {busy
              ? ar ? "…" : "…"
              : dirty
                ? ar ? "حفظ" : "Save"
                : ar ? "محفوظ" : "Saved"}
          </button>
        </div>
      </div>

      {error && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <IcAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-mono">{error}</span>
        </Card>
      )}

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${
          showPreview ? "lg:grid-cols-[240px_1fr_1fr]" : "lg:grid-cols-[260px_1fr]"
        }`}
      >
        {/* File tree */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-line p-2">
            <div className="relative">
              <IcSearch className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "ابحث في الملفات…" : "Search files…"}
                className="h-9 w-full rounded-xl border border-line bg-surface-page ps-8 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-1.5">
            {loading ? (
              <p className="p-4 text-sm text-ink-soft">{t("loading")}</p>
            ) : (
              tree.children.map((c) => (
                <TreeItem
                  key={c.path}
                  node={c}
                  depth={0}
                  selected={path}
                  modified={modified}
                  onSelect={openFile}
                />
              ))
            )}
          </div>
        </Card>

        {/* Code */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          {!path ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-soft">
              <IcFile className="h-7 w-7" />
              {ar
                ? "اختر ملفاً من الشجرة — ابدأ بمجلد sections"
                : "Pick a file from the tree — start with the sections folder"}
            </div>
          ) : !editable ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-soft">
              <IcFile className="h-7 w-7" />
              {ar ? "هذا الملف غير قابل للتحرير كنص" : "This file can't be edited as text"}
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1">
                {/* Line numbers */}
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
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={onKeyDown}
                  onKeyUp={updateCaret}
                  onClick={updateCaret}
                  onScroll={(e) => {
                    if (gutterRef.current)
                      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                  }}
                  spellCheck={false}
                  wrap="off"
                  dir="ltr"
                  className="min-h-0 flex-1 resize-none bg-white p-3 font-mono text-xs leading-5 text-ink outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-1.5 text-[11px] text-ink-soft">
                <span>{languageOf(path)}</span>
                <span>
                  {ar ? "سطر" : "Ln"} {caret.line}, {ar ? "عمود" : "Col"} {caret.col}
                </span>
                <span>
                  {lineCount} {ar ? "سطر" : "lines"}
                </span>
                {currentSize > 0 && <span>{formatBytes(currentSize, lang)}</span>}
                {modified.has(path) && (
                  <span className="text-amber-600">{ar ? "معدّل" : "edited"}</span>
                )}
                {dirty && (
                  <span className="ms-auto font-medium text-brand-600">
                    {ar ? "غير محفوظ · Ctrl+S" : "Unsaved · Ctrl+S"}
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Live preview */}
        {showPreview && (
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="text-xs font-medium text-ink-muted">
                {ar ? "معاينة مباشرة" : "Live preview"}
              </span>
              <button
                className="btn-ghost ms-auto h-7 px-2"
                onClick={() => setNonce((n) => n + 1)}
              >
                <IcRefresh className="h-3.5 w-3.5" />
              </button>
              <a className="btn-ghost h-7 px-2" href={previewSrc} target="_blank" rel="noreferrer">
                <IcLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe
              key={previewSrc}
              src={previewSrc}
              title="preview"
              className="min-h-0 flex-1 border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            />
          </Card>
        )}
      </div>
    </div>
  );
}
