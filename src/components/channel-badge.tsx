"use client";

import { useI18n } from "@/lib/i18n";
import { IcGlobe, IcMobile } from "@/components/icons";
import { channelLabel, normalizeChannel } from "@/lib/channel";

/**
 * Where a row came from.
 *
 * One component for orders, returns and requests, because "which surface is
 * this?" has to look identical everywhere — a merchant scanning three lists
 * should not have to re-learn the mark on each one. An icon carries it as well
 * as the word, so it reads at a glance down a column.
 */
export function ChannelBadge({ value, className = "" }: { value: unknown; className?: string }) {
  const { lang } = useI18n();
  const channel = normalizeChannel(value);
  const Icon = channel === "app" ? IcMobile : IcGlobe;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        channel === "app"
          ? "bg-violet-50 text-violet-700"
          : "bg-slate-100 text-ink-muted"
      } ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {channelLabel(value, lang === "ar" ? "ar" : "en")}
    </span>
  );
}
