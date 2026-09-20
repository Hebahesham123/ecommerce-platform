"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The pieces every figures page is built from.
 *
 * One KPI card, one panel, one chart frame - so the overview and both
 * analytics pages read as the same product rather than three takes on it.
 * Flat surfaces, hairline borders, and a type scale where the number is the
 * loudest thing on the card and its label the quietest.
 */

export function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? "↑" : "↓"}
      {Math.abs(value)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  note,
  loading,
  /** Shown instead of a figure when nothing feeds this metric yet. */
  unavailable,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  note?: string;
  loading?: boolean;
  unavailable?: string;
}) {
  return (
    <div className="card p-4">
      <div className="kpi-label truncate">{label}</div>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-surface-hover" />
      ) : unavailable ? (
        <div className="mt-2 text-[15px] font-medium leading-tight text-ink-soft">—</div>
      ) : (
        <div className="kpi-value mt-2 truncate">{value}</div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && !unavailable && <Delta value={delta} />}
        {(unavailable || note) && (
          <span className="kpi-note truncate">{unavailable ?? note}</span>
        )}
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-3.5">
        <h2 className="section-title truncate">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A chart's box: a fixed height, left-to-right axes, and an honest empty state. */
export function ChartFrame({
  children,
  empty,
  emptyText,
  height = "h-64",
}: {
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
  height?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={`${height} w-full px-1 pb-3`} dir="ltr">
      {empty ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
          {emptyText ?? t("dt_empty")}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Axis styling shared by every chart, so they all read the same. */
export const chartAxis = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "#8b8b9c" },
} as const;

/**
 * A metric with no source yet.
 *
 * Better a card that says where the number would come from than a number
 * invented to fill the space.
 */
export function NotConnected({ what, how }: { what: string; how: string }) {
  return (
    <div className="card border-dashed p-4">
      <div className="kpi-label">{what}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{how}</p>
    </div>
  );
}
