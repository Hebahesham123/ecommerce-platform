"use client";

import { useEffect, useState } from "react";
import { uploadFile } from "@/app/(admin)/content/files/actions";

/**
 * The colour and image controls the theme editor uses.
 *
 * Kept together because they are the two places a merchant stops typing and
 * starts pointing: pick the colour off something, drop the picture in. Every
 * colour in the editor goes through one control, so the eyedropper and the
 * palette arrive everywhere at once instead of on whichever field was built
 * most recently.
 */

/**
 * Chrome and Edge can sample any pixel on the screen, including outside the
 * browser window. It is not in lib.dom yet and Safari and Firefox do not have
 * it, so it is declared here and the button only appears where it works —
 * an eyedropper that silently does nothing is worse than no eyedropper.
 */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
declare global {
  interface Window {
    EyeDropper?: EyeDropperCtor;
  }
}

/** A spread wide enough to build a brand from, ordered so it reads as a palette. */
export const SWATCHES: string[] = [
  "#000000", "#1f2937", "#475569", "#94a3b8", "#cbd5e1", "#f1f5f9", "#ffffff",
  "#4c1d95", "#7c3aed", "#a855f7", "#2563eb", "#0ea5e9", "#06b6d4", "#14b8a6",
  "#166534", "#16a34a", "#84cc16", "#eab308", "#f59e0b", "#ea580c", "#dc2626",
  "#9f1239", "#e11d48", "#db2777", "#9d6540", "#c1674a", "#f3ede5", "#fde68a",
];

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorPicker({
  value,
  onChange,
  fallback,
  allowEmpty = false,
  brand = [],
  input,
  ar,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Drawn in the swatch when the value is empty, i.e. what "inherit" looks like. */
  fallback: string;
  /** Empty means "follow the brand", and a reset appears to get back to it. */
  allowEmpty?: boolean;
  /** The store's own colours, offered before the general palette. */
  brand?: string[];
  input: string;
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasDropper, setHasDropper] = useState(false);
  useEffect(() => {
    setHasDropper(typeof window !== "undefined" && typeof window.EyeDropper === "function");
  }, []);

  const hex = HEX.test(value) ? value : fallback;
  const own = brand.filter((c) => HEX.test(c));

  const pick = async () => {
    const Ctor = window.EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      onChange(sRGBHex);
    } catch {
      /* Escape closes the eyedropper; that is a choice, not a failure. */
    }
  };

  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      title={c}
      onClick={() => {
        onChange(c);
        setOpen(false);
      }}
      className={`h-6 w-6 rounded-md border transition hover:scale-110 ${
        c.toLowerCase() === value.toLowerCase() ? "border-brand-500 ring-2 ring-brand-500/40" : "border-line"
      }`}
      style={{ background: c }}
    />
  );

  return (
    <div>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface-page p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? (ar ? "لون الهوية" : "Brand colour") : "#000000"}
          className={`${input} font-mono`}
          dir="ltr"
        />
        {hasDropper && (
          <button
            type="button"
            onClick={pick}
            title={ar ? "التقطي لوناً من أي مكان على الشاشة" : "Pick a colour from anywhere on screen"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink-muted transition hover:border-brand-500 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 22 1-4 9-9" />
              <path d="M13 8 8 13" />
              <path d="m15.5 2.5 6 6-4 4-6-6z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={ar ? "لوحة الألوان" : "Colour palette"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
            open ? "border-brand-500 text-ink" : "border-line text-ink-muted hover:border-brand-500 hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="1.5" />
            <circle cx="17.5" cy="10.5" r="1.5" />
            <circle cx="8.5" cy="7.5" r="1.5" />
            <circle cx="6.5" cy="12.5" r="1.5" />
            <path d="M12 2a10 10 0 1 0 0 20c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H16a6 6 0 0 0 6-6c0-4.4-4.5-8-10-8Z" />
          </svg>
        </button>
        {allowEmpty && value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-ink-muted transition hover:bg-surface-hover"
          >
            {ar ? "افتراضي" : "Reset"}
          </button>
        ) : null}
      </span>

      {open && (
        <div className="mt-2 rounded-xl border border-line bg-surface-page p-2">
          {own.length > 0 && (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "ألوان متجرك" : "Your store"}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">{own.map(swatch)}</div>
            </>
          )}
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {ar ? "لوحة الألوان" : "Palette"}
          </div>
          <div className="grid grid-cols-7 gap-1.5">{SWATCHES.map(swatch)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Put a picture in without leaving for a file library first.
 *
 * The URL field stays beside it: a merchant who already has the image hosted
 * should not have to download and re-upload it to use it here.
 */
export function ImageUpload({
  onUploaded,
  ar,
  compact = false,
}: {
  onUploaded: (url: string) => void;
  ar: boolean;
  /** The tighter button used inside a section's item list. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <label
      title={ar ? "ارفعي صورة من جهازك" : "Upload from your device"}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-lg border transition ${
        compact ? "h-8 w-8" : "h-9 w-9"
      } ${err ? "border-rose-400 text-rose-500" : "border-line text-ink-muted hover:border-brand-500 hover:text-ink"} ${
        busy ? "opacity-60" : ""
      }`}
    >
      {busy ? (
        <span className="text-[11px]">…</span>
      ) : (
        <svg viewBox="0 0 24 24" className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          setErr(null);
          setBusy(true);
          const fd = new FormData();
          fd.append("file", file);
          const res = await uploadFile(fd);
          setBusy(false);
          if (res.ok) onUploaded(res.data.url);
          else setErr(res.error === "not_configured" ? "storage" : "failed");
        }}
      />
    </label>
  );
}
