"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import {
  formatBytes,
  fileKindKey,
  FILE_KINDS,
  type FileAsset,
  type FileKind,
} from "@/lib/content";
import { listFiles, uploadFile, addFromUrl } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { FileDrawer } from "@/components/file-drawer";
import {
  IcSearch,
  IcUpload,
  IcImage,
  IcVideo,
  IcFile,
  IcLink,
  IcCopy,
  IcTrash,
  IcAlert,
} from "@/components/icons";
import { deleteFile } from "./actions";

type Filter = "all" | FileKind;
type Sort = "newest" | "oldest" | "name" | "size";

/** Read image dimensions in the browser before upload. */
function readImageSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function Thumb({ f }: { f: FileAsset }) {
  if (f.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={f.url} alt={f.alt ?? f.name} className="h-full w-full object-cover" />;
  }
  const Icon = f.kind === "video" ? IcVideo : IcFile;
  return (
    <div className="flex h-full w-full items-center justify-center text-ink-soft">
      <Icon className="h-9 w-9" />
    </div>
  );
}

export default function FilesPage() {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [urlVal, setUrlVal] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [selected, setSelected] = useState<FileAsset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await listFiles();
    if (res.ok) {
      setFiles(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    setPending((p) => [...p, ...arr.map((f) => f.name)]);
    for (const file of arr) {
      const dims = await readImageSize(file);
      const fd = new FormData();
      fd.append("file", file);
      if (dims) {
        fd.append("width", String(dims.w));
        fd.append("height", String(dims.h));
      }
      const res = await uploadFile(fd);
      if (res.ok) setFiles((cur) => [res.data, ...cur]);
      else setError(res.error);
      setPending((p) => p.filter((n) => n !== file.name));
    }
  }

  async function handleAddUrl() {
    if (!urlVal.trim()) return;
    setUrlBusy(true);
    const res = await addFromUrl(urlVal);
    setUrlBusy(false);
    if (res.ok) {
      setFiles((cur) => [res.data, ...cur]);
      setUrlVal("");
    } else {
      setError(res.error === "invalid_url" ? "Invalid URL" : res.error);
    }
  }

  async function quickDelete(id: string) {
    if (!window.confirm(t("delete_file_confirm"))) return;
    const res = await deleteFile(id);
    if (res.ok) setFiles((cur) => cur.filter((f) => f.id !== id));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: t("ft_all") },
    ...FILE_KINDS.filter((k) => k !== "other").map((k) => ({
      key: k as Filter,
      label: t(fileKindKey[k]),
    })),
  ];

  const shown = useMemo(() => {
    let r = files.filter((f) => {
      if (filter !== "all" && f.kind !== filter) return false;
      if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return r;
  }, [files, filter, q, sort]);

  return (
    <>
      <PageHeader
        title={t("nav_files")}
        subtitle={t("files_subtitle")}
        actions={
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            <IcUpload className="h-4 w-4" /> {t("upload_files")}
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error === "not_configured" && (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("supabase_missing")}</span>
        </Card>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mb-4 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-brand-600 bg-brand-50"
            : "border-line bg-white hover:bg-surface-page"
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <IcUpload className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">{t("drop_files_here")}</p>
        <p className="text-xs text-ink-soft">{t("or_browse")}</p>
      </div>

      {/* Add from URL */}
      <Card className="mb-4 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <IcLink className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={urlVal}
              onChange={(e) => setUrlVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              placeholder={t("url_placeholder")}
              className="h-10 w-full rounded-xl border border-line bg-surface-page ps-10 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
              dir="ltr"
            />
          </div>
          <button onClick={handleAddUrl} disabled={urlBusy} className="btn-outline shrink-0 disabled:opacity-60">
            {urlBusy ? t("uploading") : t("add_from_url")}
          </button>
        </div>
      </Card>

      {/* Toolbar */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  filter === f.key
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
            >
              <option value="newest">{t("sort_newest")}</option>
              <option value="oldest">{t("sort_oldest")}</option>
              <option value="name">{t("sort_name")}</option>
              <option value="size">{t("sort_size")}</option>
            </select>
            <div className="relative">
              <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search")}
                className="h-9 w-48 rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="p-4">
          {(shown.length > 0 || pending.length > 0) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {pending.map((name) => (
                <div key={`p-${name}`} className="rounded-xl border border-line p-2">
                  <div className="flex aspect-square animate-pulse items-center justify-center rounded-lg bg-surface-page text-ink-soft">
                    <IcUpload className="h-6 w-6" />
                  </div>
                  <div className="mt-2 truncate text-xs text-ink-soft">{name}</div>
                  <div className="text-[11px] text-ink-soft">{t("uploading")}</div>
                </div>
              ))}
              {shown.map((f) => (
                <div
                  key={f.id}
                  className="group relative cursor-pointer rounded-xl border border-line p-2 transition-shadow hover:shadow-card"
                  onClick={() => setSelected(f)}
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-page">
                    <Thumb f={f} />
                  </div>
                  <div className="mt-2 truncate text-xs font-medium text-ink">{f.name}</div>
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>{t(fileKindKey[f.kind])}</span>
                    <span>{formatBytes(f.sizeBytes, lang)}</span>
                  </div>

                  {/* hover quick actions */}
                  <div
                    className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => copyUrl(f.url)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-ink-muted shadow-card hover:text-ink"
                      title={t("copy_url")}
                    >
                      <IcCopy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => quickDelete(f.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-rose-500 shadow-card hover:text-rose-700"
                      title={t("delete")}
                    >
                      <IcTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="py-12 text-center text-sm text-ink-soft">{t("loading")}</div>
          )}
          {!loading && shown.length === 0 && pending.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcImage className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">{t("no_files")}</div>
                <p className="mt-1 text-sm text-ink-soft">{t("no_files_hint")}</p>
              </div>
              <button className="btn-primary mt-1" onClick={() => inputRef.current?.click()}>
                <IcUpload className="h-4 w-4" /> {t("upload_files")}
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* count */}
      {shown.length > 0 && (
        <p className="mt-3 text-center text-xs text-ink-soft">
          {num(shown.length, lang)} {t("files_count")}
        </p>
      )}

      {selected && (
        <FileDrawer
          file={selected}
          onClose={() => setSelected(null)}
          onChange={(f) => {
            setFiles((cur) => cur.map((x) => (x.id === f.id ? f : x)));
            setSelected(f);
          }}
          onDelete={(id) => {
            setFiles((cur) => cur.filter((x) => x.id !== id));
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
