"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { JourneyView } from "@/components/journey-view";
import type { Journey } from "@/lib/analytics-reports";
import { journeyAction } from "../../report-actions";

/** One visitor's whole journey. */
export default function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitor = decodeURIComponent(id);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [journey, setJourney] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    journeyAction(visitor).then((r) => (r.ok ? setJourney(r.data) : setError(r.error)));
  }, [visitor]);

  return (
    <>
      <Link href="/analytics/visitors" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <span aria-hidden>{ar ? "→" : "←"}</span> {ar ? "كل الزوار" : "All visitors"}
      </Link>
      <PageHeader title={ar ? "رحلة الزائر" : "Visitor journey"} subtitle={visitor} />
      {error ? (
        <div className="card p-4 text-sm text-rose-600">
          {error === "migration_missing"
            ? ar
              ? "شغّلي ملف قاعدة البيانات 0059_visitor_journey.sql في Supabase ثم حدّثي الصفحة."
              : "Run the database file 0059_visitor_journey.sql in Supabase, then refresh this page."
            : error}
        </div>
      ) : journey ? (
        <JourneyView journey={journey} />
      ) : (
        <div className="card p-8 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      )}
    </>
  );
}
