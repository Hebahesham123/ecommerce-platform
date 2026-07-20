"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { IcSearch, IcChevron, IcUp, IcDown } from "@/components/icons";

// =============================================================================
// Shopify-grade primitives: sparkline KPI strip, status pills, view tabs,
// checkboxes, sortable headers.
// =============================================================================

type SparkTone = "emerald" | "rose" | "sky" | "slate" | "brand";
const SPARK_HEX: Record<SparkTone, string> = {
  emerald: "#10b981",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  slate: "#94a3b8",
  brand: "#e11d48",
};

/** Tiny dependency-free SVG sparkline (area + line). */
export function Sparkline({
  data,
  tone = "slate",
  width = 104,
  height = 34,
}: {
  data: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 6) - 3;
  const pts = data.map((v, i) => [i * stepX, y(v)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const color = SPARK_HEX[tone];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      preserveAspectRatio="none"
    >
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <IcUp className="h-3 w-3" /> : <IcDown className="h-3 w-3" />}
      {Math.abs(v)}%
    </span>
  );
}

export type KpiSegment = {
  label: string;
  value: string;
  delta?: number;
  data?: number[];
  tone?: SparkTone;
  active?: boolean;
  onClick?: () => void;
};

/** Shopify-style horizontal KPI strip: one card, divided segments, sparklines. */
export function KpiStrip({
  period,
  segments,
}: {
  period?: ReactNode;
  segments: KpiSegment[];
}) {
  return (
    <div className="card flex divide-x divide-line overflow-x-auto rtl:divide-x-reverse">
      {period !== undefined && (
        <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium text-ink-muted">
          {period}
        </div>
      )}
      {segments.map((s, i) => {
        const Tag = s.onClick ? "button" : "div";
        return (
          <Tag
            key={i}
            onClick={s.onClick}
            className={`min-w-[150px] flex-1 px-4 py-3 text-start transition-colors ${
              s.onClick ? "cursor-pointer hover:bg-surface-page" : ""
            } ${s.active ? "bg-surface-page" : ""}`}
          >
            <div className="truncate text-[13px] text-ink-muted">{s.label}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tracking-tight text-ink">{s.value}</span>
                {s.delta !== undefined && <Delta v={s.delta} />}
              </div>
              {s.data && <Sparkline data={s.data} tone={s.tone ?? "slate"} />}
            </div>
          </Tag>
        );
      })}
    </div>
  );
}

// ---- Status pill (dot + label), Shopify semantics ---------------------------
export type PillTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "attention"
  | "critical";

const PILL: Record<PillTone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  info: { wrap: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  success: { wrap: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  warning: { wrap: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  attention: { wrap: "bg-yellow-100 text-yellow-900", dot: "bg-yellow-500" },
  critical: { wrap: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
};

export function StatusPill({
  label,
  tone = "neutral",
  hollow,
}: {
  label: string;
  tone?: PillTone;
  hollow?: boolean;
}) {
  const s = PILL[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.wrap}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${hollow ? `border-[1.5px] border-current bg-transparent` : s.dot}`}
      />
      {label}
    </span>
  );
}

/** Saved-view style tab bar. */
export function ViewTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tb) => (
        <button
          key={tb.key}
          onClick={() => onChange(tb.key)}
          className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${
            active === tb.key
              ? "bg-surface-page text-ink"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink"
          }`}
        >
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  indeterminate,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 rounded border-line accent-brand-600"
    />
  );
}

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
