"use client";

import { useCallback, useEffect, useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { IcX } from "@/components/icons";

/**
 * One modal shell for the whole admin — a blurred backdrop, a card that scales
 * in, a header with an icon chip, a scrolling body and a sticky footer. Every
 * dialog uses it so they stop looking hand-rolled and inconsistent.
 *
 * It owns its open/close animation: closing plays the exit first, then calls
 * onClose, so the parent can keep conditionally rendering `{open && <Modal/>}`.
 */

type Size = "sm" | "md" | "lg" | "xl";
type Accent = "brand" | "rose" | "emerald" | "amber" | "sky";

const SIZE: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const ACCENT: Record<Accent, string> = {
  brand: "from-brand-500 to-brand-700 text-white",
  rose: "from-rose-500 to-rose-700 text-white",
  emerald: "from-emerald-500 to-emerald-700 text-white",
  amber: "from-amber-400 to-amber-600 text-white",
  sky: "from-sky-500 to-sky-700 text-white",
};

export function Modal({
  title,
  subtitle,
  icon: Icon,
  accent = "brand",
  size = "md",
  onClose,
  children,
  footer,
  dir,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  accent?: Accent;
  size?: Size;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dir?: "rtl" | "ltr";
}) {
  const [show, setShow] = useState(false);

  // Mount → animate in.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Animate out, then unmount.
  const requestClose = useCallback(() => {
    setShow(false);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    // Lock background scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" dir={dir}>
      {/* Backdrop */}
      <div
        onClick={requestClose}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full ${SIZE[size]} flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl ring-1 ring-black/5 transition-all duration-200 sm:rounded-3xl ${
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0 sm:translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line/70 px-5 py-4">
          {Icon && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${ACCENT[accent]}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>}
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-surface-hover hover:text-ink"
          >
            <IcX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line/70 bg-surface-page/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/** A labelled field wrapper for modal forms. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );
}

/** Shared input styling, so every modal field matches. */
export const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
