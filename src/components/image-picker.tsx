"use client";

import { useEffect, useRef, useState } from "react";
import { listFiles, uploadFile } from "@/app/(admin)/content/files/actions";
import type { FileAsset } from "@/lib/content";
import { IcX, IcUpload, IcImage, IcLink, IcSearch } from "@/components/icons";

/**
 * Choosing a picture, the three ways anyone expects to.
 *
 * From the pictures already uploaded, from this computer, or by pasting a link.
 * Only the last of those existed, which meant a merchant who had just uploaded
 * an image in Content had to go and find its URL to use it again.
 *
 * Uploads go through the same action the Files page uses, so a picture chosen
 * here also lands in the library and can be used again.
 */
export function ImagePicker({
  value,
  onChange,
  onClose,
  ar,
  title,
}: {
  value: string;
  onChange: (url: string) => void;
  onClose: () => void;
  ar: boolean;
  title?: string;
}) {
  const [tab, setTab] = useState<"library" | "link">("library");
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listFiles()
      .then((res) => {
        if (res.ok) setFiles(res.data.filter((f) => f.kind === "image"));
        else setError(res.error);
      })
      .finally(() => setLoading(false));
  }, []);

  async function upload(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await uploadFile(form);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFiles((cur) => [res.data, ...cur]);
    onChange(res.data.url);
    onClose();
  }

  const shown = (() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? files.filter((f) => f.name.toLowerCase().includes(needle)) : files;
    return list.slice(0, 60);
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">
            {title ?? (ar ? "اختاري صورة" : "Choose an image")}
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex gap-1.5">
          <button
            onClick={() => setTab("library")}
            className={`badge px-3 py-1.5 text-sm ${tab === "library" ? "bg-brand text-white" : "bg-surface-page text-ink-muted"}`}
          >
            <IcImage className="h-3.5 w-3.5" /> {ar ? "الصور المرفوعة" : "Media"}
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="badge bg-surface-page px-3 py-1.5 text-sm text-ink-muted disabled:opacity-60"
          >
            <IcUpload className="h-3.5 w-3.5" />
            {uploading ? (ar ? "جارٍ الرفع…" : "Uploading…") : ar ? "من الجهاز" : "From this device"}
          </button>
          <button
            onClick={() => setTab("link")}
            className={`badge px-3 py-1.5 text-sm ${tab === "link" ? "bg-brand text-white" : "bg-surface-page text-ink-muted"}`}
          >
            <IcLink className="h-3.5 w-3.5" /> {ar ? "رابط" : "Link"}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />

        {error && (
          <p className="mb-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>
        )}

        {tab === "link" ? (
          <div className="space-y-3">
            <div className="relative">
              <IcLink className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                dir="ltr"
                className="h-11 w-full rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600"
              />
            </div>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-40 w-full rounded-xl border border-line object-cover" />
            )}
            <button
              onClick={() => {
                onChange(url.trim());
                onClose();
              }}
              className="btn-primary h-11 w-full justify-center text-sm"
            >
              {ar ? "استخدام هذا الرابط" : "Use this link"}
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "ابحثي في الصور…" : "Search images…"}
                className="h-10 w-full rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="py-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
              ) : shown.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-ink-soft">
                    {ar ? "لا توجد صور بعد" : "No images yet"}
                  </p>
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="btn-outline mt-3 h-9 px-3 text-xs"
                  >
                    <IcUpload className="h-3.5 w-3.5" /> {ar ? "ارفعي صورة" : "Upload one"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {shown.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onChange(f.url);
                        onClose();
                      }}
                      className={`overflow-hidden rounded-xl border-2 transition ${
                        value === f.url ? "border-brand-600" : "border-transparent hover:border-line"
                      }`}
                      title={f.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.alt ?? f.name} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
