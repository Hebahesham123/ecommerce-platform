"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useI18n, num } from "@/lib/i18n";
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
  brand: "#8b5cf6", // violet (was the old rose/pink)
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
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
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

// Subtle color-tinted fills that read well on BOTH light and dark surfaces.
const PILL: Record<PillTone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-slate-500/10 text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  info: { wrap: "bg-sky-500/10 text-sky-600 dark:text-sky-400", dot: "bg-sky-500" },
  success: { wrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { wrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  attention: { wrap: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  critical: { wrap: "bg-rose-500/10 text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
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
  brand: "bg-brand-100 text-brand-600",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-500 dark:text-slate-300",
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
              className={`badge ${up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}
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
        className="h-9 w-full rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-surface"
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
        className="h-9 appearance-none rounded-xl border border-line bg-surface-page ps-3 pe-8 text-sm text-ink outline-none focus:border-brand-600 focus:bg-surface"
      >
        {children}
      </select>
      <IcChevron className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-ink-soft" />
    </div>
  );
}

// ---- Pagination -------------------------------------------------------------
// Every admin list renders one page at a time instead of the whole result set,
// so a catalog of thousands stays as light to paint as a catalog of ten.

export type PaginationState<T> = {
  /** The rows to render for the current page. */
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-based inclusive range of the current page, for "21–40 of 340". */
  from: number;
  to: number;
  perPage: number;
  /** Accepts a page number or an updater, so rapid Prev/Next clicks all land. */
  setPage: (p: number | ((cur: number) => number)) => void;
  setPerPage: (n: number) => void;
};

/**
 * Slices an already-filtered/sorted array down to a single page.
 *
 * `resetKey` should carry the filter state (search text, tab, sort…): whenever
 * it changes the view jumps back to page 1, so narrowing a filter never leaves
 * you stranded on a page that no longer exists. Shrinking data is clamped too.
 */
export function usePagination<T>(
  rows: T[],
  opts?: { perPage?: number; resetKey?: string },
): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(opts?.perPage ?? 20);
  const resetKey = opts?.resetKey ?? "";

  useEffect(() => {
    setPage(1);
  }, [resetKey, perPage]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const items = useMemo(
    () => rows.slice(start, start + perPage),
    [rows, start, perPage],
  );

  return {
    items,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, total),
    perPage,
    setPage: (p) =>
      setPage((cur) => {
        const target = typeof p === "function" ? p(Math.min(cur, pageCount)) : p;
        return Math.min(Math.max(1, target), pageCount);
      }),
    setPerPage,
  };
}

/** Page numbers around the current page, with gaps collapsed to an ellipsis. */
function pageWindow(page: number, pageCount: number, max = 7): (number | "…")[] {
  if (pageCount <= max) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const span = Math.floor((max - 3) / 2); // slots left for neighbours of `page`
  let lo = Math.max(2, page - span);
  let hi = Math.min(pageCount - 1, page + span);
  if (page - span < 2) hi = Math.min(pageCount - 1, hi + (2 - (page - span)));
  if (page + span > pageCount - 1) lo = Math.max(2, lo - (page + span - (pageCount - 1)));
  if (lo > 2) out.push("…");
  for (let p = lo; p <= hi; p += 1) out.push(p);
  if (hi < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

/**
 * Footer bar for a paginated list: result range, rows-per-page, page numbers.
 * Spread a `usePagination` result straight into it — `<Pagination {...pg} />`.
 */
export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  perPage,
  setPage,
  setPerPage,
  perPageOptions = [10, 20, 50, 100],
}: Omit<PaginationState<unknown>, "items"> & { perPageOptions?: number[] }) {
  const { t, lang } = useI18n();
  if (total === 0) return null;

  // Keep an unusual default (a grid's 24, say) selectable rather than dropping it.
  const sizes = [...new Set([...perPageOptions, perPage])].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-ink-soft">
          {num(from, lang)}–{num(to, lang)} {t("pag_of")} {num(total, lang)}
        </span>
        <Select value={String(perPage)} onChange={(v) => setPerPage(Number(v))}>
          {sizes.map((n) => (
            <option key={n} value={n}>
              {num(n, lang)} / {t("pag_per_page")}
            </option>
          ))}
        </Select>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="btn-ghost h-8 px-2.5 text-xs disabled:opacity-40"
          >
            {t("pag_prev")}
          </button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-ink-soft">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`${t("pag_page")} ${p}`}
                className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium ${
                  p === page ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {num(p, lang)}
              </button>
            ),
          )}
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pageCount}
            className="btn-ghost h-8 px-2.5 text-xs disabled:opacity-40"
          >
            {t("pag_next")}
          </button>
        </div>
      )}
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
          ? "bg-brand text-white"
          : "bg-surface-page text-ink-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
