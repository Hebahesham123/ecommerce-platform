"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { IcChevron } from "@/components/icons";

/**
 * One table, two shapes.
 *
 * On a desktop it is a table, because comparing rows down a column is what a
 * table is for. On a phone it is a list of cards, because a table squeezed
 * into 360 points is either unreadable type or a sideways scroll that hides
 * half the data - and a shopkeeper checking an order on their phone should not
 * have to do either.
 *
 * Columns are ranked by use rather than by position: the two or three a person
 * actually scans (who, how much, what state) are on the face of the card, and
 * the rest wait behind a tap. Rank them here once and both shapes follow.
 */

export type Column<T> = {
  /** Stable key, also used for the mobile label. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /**
   * "title" is the card's heading (one per table, the thing being named),
   * "primary" sits on the face of the card (at most two), "secondary" waits
   * inside the fold, and "hidden" never appears on a phone.
   */
  rank?: "title" | "primary" | "secondary" | "hidden";
  align?: "start" | "end";
  /** Desktop only: a width hint, e.g. "w-32" or "w-[140px]". */
  width?: string;
  /** Desktop only: hide below this breakpoint to keep the table honest. */
  hideBelow?: "md" | "lg" | "xl";
};

export function DataTable<T>({
  rows,
  columns,
  getKey,
  onRowClick,
  empty,
  footer,
  selectable,
  selectAll,
  flush,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
  /** A checkbox or menu rendered at the start of each row. */
  selectable?: (row: T) => ReactNode;
  /** The select-all control, shown above the rows. */
  selectAll?: ReactNode;
  /** Already inside a card: drop this one border so they do not nest. */
  flush?: boolean;
}) {
  const { t } = useI18n();

  if (!rows.length) {
    return (
      <div className={`p-10 text-center text-sm text-ink-muted ${flush ? "" : "card"}`}>
        {empty ?? t("dt_empty")}
      </div>
    );
  }

  const shown = columns.filter((c) => c.rank !== "hidden" || true);
  const title = columns.find((c) => c.rank === "title") ?? columns[0];
  const primary = columns.filter((c) => c.rank === "primary").slice(0, 2);
  const folded = columns.filter(
    (c) => c !== title && !primary.includes(c) && c.rank !== "hidden",
  );

  return (
    <>
      {/* ---------------- desktop: a table ---------------- */}
      <div className={`hidden overflow-hidden sm:block ${flush ? "" : "card"}`}>
        <table className="w-full table-auto border-collapse text-sm">
          <thead className="border-b border-line bg-surface-page">
            <tr>
              {selectable && <th className="th w-10">{selectAll}</th>}
              {shown.map((c) => (
                <th
                  key={c.key}
                  className={`th ${c.width ?? ""} ${c.align === "end" ? "text-end" : ""} ${
                    c.hideBelow ? `hidden ${c.hideBelow}:table-cell` : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer transition-colors hover:bg-surface-page" : ""}
              >
                {selectable && (
                  <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                    {selectable(row)}
                  </td>
                )}
                {shown.map((c) => (
                  <td
                    key={c.key}
                    className={`td ${c.align === "end" ? "text-end" : ""} ${
                      c.hideBelow ? `hidden ${c.hideBelow}:table-cell` : ""
                    }`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {footer && <div className="border-t border-line px-3 py-2.5">{footer}</div>}
      </div>

      {/* ---------------- phone: cards that open ---------------- */}
      <div className="space-y-2 sm:hidden">
        {selectAll && (
          <div className="flex items-center gap-2 px-1 pb-1 text-[12px] text-ink-muted">
            {selectAll}
            {t("dt_select_all")}
          </div>
        )}
        {rows.map((row) => (
          <MobileRow
            key={getKey(row)}
            row={row}
            title={title}
            primary={primary}
            folded={folded}
            onOpen={onRowClick}
            selectable={selectable}
          />
        ))}
        {footer && <div className={`px-3 py-2.5 ${flush ? "" : "card"}`}>{footer}</div>}
      </div>
    </>
  );
}

function MobileRow<T>({
  row,
  title,
  primary,
  folded,
  onOpen,
  selectable,
}: {
  row: T;
  title: Column<T>;
  primary: Column<T>[];
  folded: Column<T>[];
  onOpen?: (row: T) => void;
  selectable?: (row: T) => ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        {selectable && <div className="pt-0.5">{selectable(row)}</div>}
        <button
          type="button"
          onClick={() => (onOpen ? onOpen(row) : setOpen((v) => !v))}
          className="min-w-0 flex-1 text-start"
        >
          <div className="text-[15px] font-semibold leading-snug text-ink">{title.cell(row)}</div>
          {primary.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
              {primary.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5">
                  {c.cell(row)}
                </span>
              ))}
            </div>
          )}
        </button>
        {folded.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("dt_less") : t("dt_more")}
            className="-me-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-surface-hover"
          >
            <IcChevron className={`h-4 w-4 transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
          </button>
        )}
      </div>

      {open && folded.length > 0 && (
        <dl className="border-t border-line bg-surface-page px-3 py-2">
          {folded.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-3 py-1.5">
              <dt className="text-[12px] text-ink-soft">{c.header}</dt>
              <dd className="min-w-0 text-end text-[13px] text-ink">{c.cell(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
