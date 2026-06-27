"use client";

import { useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { formatBytes, fileKindKey, type FileAsset } from "@/lib/content";
import { updateFile, deleteFile } from "@/app/(admin)/content/files/actions";
import { IcX, IcCopy, IcTrash, IcLink, IcFile, IcImage, IcVideo } from "@/components/icons";

function KindThumb({ f, large }: { f: FileAsset; large?: boolean }) {
  const size = large ? "h-40" : "h-12 w-12";
  if (f.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={f.url}
        alt={f.alt ?? f.name}
        className={`${large ? "max-h-56 w-full object-contain" : "h-12 w-12 object-cover"} rounded-xl bg-surface-page`}
      />
    );
  }
  const Icon = f.kind === "video" ? IcVideo : f.kind === "document" ? IcFile : IcFile;
  return (
    <div className={`flex ${large ? "h-40 w-full" : "h-12 w-12"} items-center justify-center rounded-xl bg-surface-page text-ink-soft`}>
      <Icon className={large ? "h-10 w-10" : "h-6 w-6"} />
    </div>
  );
}

export function FileDrawer({
  file,
  onClose,
  onChange,
  onDelete,
}: {
  file: FileAsset;
  onClose: () => void;
  onChange: (f: FileAsset) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(file.name);
  const [alt, setAlt] = useState(file.alt ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await updateFile(file.id, { name, alt });
    setSaving(false);
    if (res.ok) onChange({ ...file, name, alt });
  }

  async function remove() {
    if (!window.confirm(t("delete_file_confirm"))) return;
    const res = await deleteFile(file.id);
    if (res.ok) onDelete(file.id);
  }

  function copy() {
    navigator.clipboard.writeText(file.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputCls =
    "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">{t("file_details")}</h3>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center justify-center rounded-2xl border border-line bg-surface-page p-4">
            <KindThumb f={file} large />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">{t("file_name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>

          {file.kind === "image" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">{t("alt_text")}</label>
              <input value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} />
              <p className="mt-1 text-xs text-ink-soft">{t("alt_hint")}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">URL</label>
            <div className="flex gap-2">
              <input value={file.url} readOnly className={`${inputCls} text-ink-muted`} dir="ltr" />
              <button onClick={copy} className="btn-outline shrink-0 gap-1.5">
                <IcCopy className="h-4 w-4" />
                {copied ? t("copied") : t("copy_url")}
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-ink-soft">{t("file_type")}</dt>
              <dd className="font-medium text-ink">{t(fileKindKey[file.kind])}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">{t("file_size")}</dt>
              <dd className="font-medium text-ink">{formatBytes(file.sizeBytes, lang)}</dd>
            </div>
            {file.width && file.height ? (
              <div>
                <dt className="text-ink-soft">{t("dimensions")}</dt>
                <dd className="font-medium text-ink" dir="ltr">
                  {file.width} × {file.height}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-soft">{t("date_added")}</dt>
              <dd className="font-medium text-ink" dir="ltr">
                {new Date(file.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">{t("references")}</dt>
              <dd className="font-medium text-ink">{num(file.referenceCount, lang)}</dd>
            </div>
            {file.isExternal && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-amber-700">
                <IcLink className="h-3.5 w-3.5" /> {t("external_file")}
              </div>
            )}
          </dl>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line p-4">
          <button onClick={remove} className="btn-ghost gap-1.5 text-rose-600 hover:bg-rose-50">
            <IcTrash className="h-4 w-4" /> {t("delete")}
          </button>
          <div className="flex gap-2">
            <a href={file.url} target="_blank" rel="noreferrer" className="btn-outline">
              {t("open_file")}
            </a>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
