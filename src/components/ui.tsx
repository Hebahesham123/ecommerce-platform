"use client";

import type { ReactNode } from "react";

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Dot({ className = "" }: { className?: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}

export function Avatar({ name, online }: { name: string; online?: boolean }) {
  const initial = name.trim().charAt(0);
  return (
    <div className="relative">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {initial}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </div>
  );
}
