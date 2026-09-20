"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The top of every page: what this page is, and what you can do on it.
 *
 * On a desktop the actions sit top-right, where the eye ends its sweep across
 * the title. On a phone the main action moves to a bar at the bottom of the
 * screen - a thumb reaches the bottom of a phone, not the top corner - while
 * the lesser actions stay by the title as outline buttons.
 */

export type PrimaryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  primary,
}: {
  title: string;
  subtitle?: string;
  /** Secondary actions: outline or ghost buttons, never solid. */
  actions?: ReactNode;
  /** The one action this page is for. Also shown in the phone's bottom bar. */
  primary?: PrimaryAction;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {primary && (
            // The phone gets this same action in the bottom bar instead.
            <span className="hidden sm:inline-flex">
              <PrimaryButton {...primary} />
            </span>
          )}
        </div>
      </div>

      {primary && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur sm:hidden lg:bottom-0">
          <PrimaryButton {...primary} full />
        </div>
      )}
    </>
  );
}

function PrimaryButton({ label, href, onClick, icon, disabled, full }: PrimaryAction & { full?: boolean }) {
  const cls = `btn-primary h-10 ${full ? "w-full" : ""} ${disabled ? "pointer-events-none opacity-50" : ""}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {icon}
      {label}
    </button>
  );
}
