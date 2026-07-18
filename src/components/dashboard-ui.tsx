"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { IcSearch, IcChevron, IcUp, IcDown } from "@/components/icons";

// Shared premium dashboard primitives used across every admin page so the whole
// product reads as one system: KPI tiles, filter toolbars, segmented controls.

export type Accent = "brand" | "sky" | "emerald" | "amber" | "rose" | "violet" | "slate";

const ACCENTS: Record<Accent, string> = {
  brand: "bg-brand-50 text-brand-600",
  sky: "bg-sky-50 text-sky-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-500",
};

/** Grid wrapper for a row of stat tiles. */
export function KpiRow({
  children,
  cols = 4,
}: {
  children: ReactNode;
  cols?: 3 | 4 | 5;
}) {
  const c =
    cols === 5 ? "lg:grid-cols-5" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return <div className={`grid grid-cols-2 gap-3 ${c}`}>{children}</div>;
}

/** Headline metric tile. Optionally clickable (acts as a filter) or shows a delta. */
export function StatTile({
  icon: Icon,
  label,
  value,
  accent = "brand",
  sub,
  delta,
  active,
  onClick,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  accent?: Accent;
  sub?: string;
  delta?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`card flex items-start gap-3 p-4 text-start transition-shadow ${
        onClick ? "cursor-pointer hover:shadow-pop" : "cursor-default"
      } ${active ? "ring-2 ring-brand-500" : ""}`}
    >
      {Icon && (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-soft">{label}</span>
          {delta !== undefined && (
            <span
              className={`badge ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
            >
              {up ? <IcUp className="h-3 w-3" /> : <IcDown className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xl font-bold tracking-tight text-ink">
          {value}
        </span>
        {sub && <span className="mt-0.5 block truncate text-xs text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
}

/** Horizontal wrapper for filters — "filters in one row above the table". */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
      />
    </div>
  );
}

/** Styled native select with a chevron. */
export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-xl border border-line bg-surface-page ps-3 pe-8 text-sm text-ink outline-none focus:border-brand-600 focus:bg-white"
      >
        {children}
      </select>
      <IcChevron className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-ink-soft" />
    </div>
  );
}

/** Pill segmented-control button. */
export function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-ink text-white"
          : "bg-surface-page text-ink-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
