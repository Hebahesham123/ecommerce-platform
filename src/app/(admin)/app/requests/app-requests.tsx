"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ReturnsList } from "../../returns/returns-list";
import { RequestsList } from "../../requests/requests-list";

/**
 * Everything a customer sent in from the app, in one place.
 *
 * On the storefront these are one form — the shopper picks return, exchange or
 * "something else" — so splitting them across two menu entries here made the
 * merchant do reassembly the customer never had to. They stay two tables
 * underneath, because a return moves stock and money through a transaction and
 * an enquiry moves nothing, and flattening that would mean one screen doing
 * two jobs badly.
 *
 * So: one entry, two tabs, each rendering the list that already knows how to
 * handle its own kind. The lists themselves are untouched and still shared
 * with the store-wide pages.
 */

type Tab = "returns" | "enquiries";

export function AppRequests({ initialTab = "returns" }: { initialTab?: Tab }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: "returns", label: ar ? "استرجاع واستبدال" : "Returns & exchanges" },
    { key: "enquiries", label: ar ? "استفسارات" : "Enquiries" },
  ];

  return (
    <>
      <div className="mb-4 flex rounded-xl border border-line bg-surface-page p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Both stay mounted-on-demand rather than side by side: each fetches on
          mount, and loading the other one's rows to keep them hidden is work
          the merchant pays for and never sees. */}
      {tab === "returns" ? (
        <ReturnsList lockChannel="app" />
      ) : (
        <RequestsList lockChannel="app" />
      )}
    </>
  );
}
