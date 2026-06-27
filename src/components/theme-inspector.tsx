"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "@/lib/content";
import type { Theme } from "@/lib/themes";
import { listThemeFiles, type ThemeFile } from "@/app/(admin)/online-store/themes/actions";
import { IcX, IcFile, IcChevron, IcSearch, IcLink, IcAlert } from "@/components/icons";

type FileClass = "image" | "video" | "audio" | "html" | "code" | "binary";

function classify(path: string): FileClass {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["html", "htm"].includes(ext)) return "html";
  if (
    ["liquid", "css", "scss", "js", "mjs", "ts", "json", "txt", "md", "xml", "yml", "yaml", "csv"].includes(ext)
  )
    return "code";
  return "binary";
}

// ---- Build a nested tree from flat paths ----
type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  url: string;
  children: TreeNode[];
};

function buildTree(files: ThemeFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, size: 0, url: "", children: [] };
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
          url: isLeaf ? f.url : "",
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
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (n: TreeNode) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-hover"
          style={{ paddingInlineStart: depth * 12 + 8 }}
        >
          <IcChevron className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} rtl:-scale-x-100`} />
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open &&
          node.children.map((c) => (
            <TreeItem key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
      </div>
    );
  }
  const active = selected === node.path;
  return (
    <button
      onClick={() => onSelect(node)}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover"
      }`}
      style={{ paddingInlineStart: depth * 12 + 22 }}
    >
      <IcFile className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function Viewer({ node }: { node: TreeNode | null }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const cls = node ? classify(node.path) : "binary";

  useEffect(() => {
    setText(null);
    if (!node || cls !== "code") return;
    if (node.size > 1_000_000) return; // skip very large files
    setLoadingText(true);
    fetch(node.url)
      .then((r) => r.text())
      .then((tx) => setText(tx))
      .catch(() => setText(null))
      .finally(() => setLoadingText(false));
  }, [node, cls]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-soft">
        {t("select_a_file")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink" dir="ltr">{node.path}</div>
          <div className="text-[11px] text-ink-soft">{formatBytes(node.size, lang)}</div>
        </div>
        <a href={node.url} target="_blank" rel="noreferrer" className="btn-outline h-8 shrink-0 gap-1.5 px-3 text-xs">
          <IcLink className="h-3.5 w-3.5" /> {t("open_file")}
        </a>
      </div>

      <div className="flex-1 overflow-auto bg-surface-page p-4">
        {cls === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.url} alt={node.name} className="mx-auto max-h-full max-w-full rounded-lg bg-white" />
        )}
        {cls === "video" && <video src={node.url} controls className="mx-auto max-h-full max-w-full rounded-lg" />}
        {cls === "audio" && <audio src={node.url} controls className="mx-auto mt-6 w-full max-w-md" />}
        {cls === "html" && (
          <iframe
            src={node.url}
            title={node.name}
            className="h-full min-h-[60vh] w-full rounded-lg border border-line bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {cls === "code" &&
          (loadingText ? (
            <div className="text-sm text-ink-soft">{t("loading")}</div>
          ) : text !== null ? (
            <pre className="overflow-auto rounded-lg bg-white p-3 text-xs leading-relaxed text-ink" dir="ltr">
              <code>{text}</code>
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-ink-soft">
              <IcFile className="h-8 w-8" />
              {t("binary_no_preview")}
            </div>
          ))}
        {cls === "binary" && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-ink-soft">
            <IcFile className="h-8 w-8" />
            {t("binary_no_preview")}
          </div>
        )}
      </div>
    </div>
  );
}

export function ThemeInspector({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<ThemeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    listThemeFiles(theme.id).then((res) => {
      if (res.ok) setFiles(res.data.files);
      else setError(res.error);
      setLoading(false);
    });
  }, [theme.id]);

  const tree = useMemo(() => {
    const filtered = q
      ? files.filter((f) => f.path.toLowerCase().includes(q.toLowerCase()))
      : files;
    return buildTree(filtered);
  }, [files, q]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-ink px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{theme.name}</div>
          <div className="text-[11px] text-white/60">{t("theme_inspector")}</div>
        </div>
        <button
          onClick={onClose}
          className="ms-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20"
        >
          <IcX className="h-4 w-4" /> {t("close")}
        </button>
      </div>

      {/* Liquid note */}
      <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        <IcAlert className="h-4 w-4 shrink-0" />
        {t("shopify_theme_note")}
      </div>

      {/* Body */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden bg-white md:grid-cols-[300px_1fr]">
        {/* File tree */}
        <div className="flex flex-col border-e border-line">
          <div className="border-b border-line p-2.5">
            <div className="relative">
              <IcSearch className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search_files")}
                className="h-9 w-full rounded-xl border border-line bg-surface-page ps-8 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-1.5">
            {loading ? (
              <div className="p-4 text-sm text-ink-soft">{t("loading")}</div>
            ) : error ? (
              <div className="p-4 text-sm text-rose-600">{error}</div>
            ) : (
              tree.children.map((c) => (
                <TreeItem key={c.path} node={c} depth={0} selected={selected?.path ?? ""} onSelect={setSelected} />
              ))
            )}
          </div>
        </div>

        {/* Viewer */}
        <div className="min-h-0 overflow-hidden">
          <Viewer node={selected} />
        </div>
      </div>
    </div>
  );
}
