"use client";

import type { ReactNode } from "react";

/**
 * The preview's own small set of pieces.
 *
 * Written against plain Tailwind colours rather than the dashboard's theme
 * tokens on purpose: this is meant to look like a phone app sitting inside the
 * admin, not like another admin panel, and it must not flip to dark when the
 * dashboard does.
 */

export const money = (v: number, ar: boolean) =>
  `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(v)} ${
    ar ? "ج.م" : "EGP"
  }`;

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  full,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "outline";
  full?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300"
      : variant === "outline"
        ? "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
        : "text-violet-700 hover:bg-violet-50 disabled:text-slate-400";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${
        full ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 disabled:bg-slate-100 disabled:text-slate-500"
      />
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{hint}</span>}
    </label>
  );
}

/** A bottom sheet, because that is what a phone does instead of a modal. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "bad" | "good";
  children: ReactNode;
}) {
  const styles =
    tone === "bad"
      ? "bg-rose-50 text-rose-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : tone === "good"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-sky-50 text-sky-800";
  return (
    <div className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${styles}`}>{children}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-12 text-center text-sm text-slate-400">{children}</p>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
    </div>
  );
}
