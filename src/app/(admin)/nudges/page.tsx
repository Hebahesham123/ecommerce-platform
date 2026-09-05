"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { NudgeCampaign } from "@/lib/nudge";
import {
  loadNudge,
  loadNudgeResults,
  saveNudge,
  type NudgeResults,
  type OfferableCode,
} from "./actions";
import { NudgeEditor } from "./nudge-editor";
import { NudgeResultsView } from "./nudge-results";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { ViewTabs } from "@/components/dashboard-ui";
import { IcAlert } from "@/components/icons";

type Tab = "design" | "results";

export default function NudgesPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [tab, setTab] = useState<Tab>("design");
  const [campaign, setCampaign] = useState<NudgeCampaign | null>(null);
  const [codes, setCodes] = useState<OfferableCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [days, setDays] = useState(30);
  const [results, setResults] = useState<NudgeResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await loadNudge();
      if (res.ok) {
        setCampaign(res.data.campaign);
        setCodes(res.data.codes);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
  }, []);

  const fetchResults = useCallback(async (d: number) => {
    setResultsLoading(true);
    const res = await loadNudgeResults(d);
    if (res.ok) setResults(res.data);
    setResultsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "results") fetchResults(days);
  }, [tab, days, fetchResults]);

  async function onSave(next: NudgeCampaign) {
    setSaving(true);
    const res = await saveNudge(next);
    setSaving(false);
    if (res.ok) {
      setCampaign(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
    }
  }

  const subtitle = ar
    ? "ارصدي تردد العميل واعرضي عليه سبباً لإتمام الشراء"
    : "Catch a hesitating shopper and give them a reason to finish";

  if (error === "migration_missing") {
    return (
      <>
        <PageHeader title={ar ? "التنبيهات الذكية" : "Smart popups"} subtitle={subtitle} />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IcAlert className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">
              {ar ? "لم يتم تطبيق ترحيل قاعدة البيانات" : "Database migration not applied"}
            </div>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              {ar
                ? "شغّلي supabase/migrations/0020_nudges.sql ثم حدّثي الصفحة."
                : "Run supabase/migrations/0020_nudges.sql, then refresh this page."}
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={ar ? "التنبيهات الذكية" : "Smart popups"}
        subtitle={subtitle}
        actions={
          saved ? (
            <span className="badge bg-emerald-50 text-emerald-700">
              {ar ? "تم الحفظ" : "Saved"}
            </span>
          ) : campaign?.enabled ? (
            <span className="badge bg-emerald-50 text-emerald-700">{ar ? "مباشر" : "Live"}</span>
          ) : (
            <span className="badge bg-slate-100 text-ink-muted">{ar ? "متوقف" : "Off"}</span>
          )
        }
      />

      <div className="mb-5">
        <ViewTabs
          tabs={[
            { key: "design", label: ar ? "الإعداد" : "Design" },
            { key: "results", label: ar ? "النتائج" : "Results" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-ink-soft">
          {ar ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : tab === "design" ? (
        campaign && (
          <NudgeEditor initial={campaign} codes={codes} onSave={onSave} saving={saving} />
        )
      ) : (
        <NudgeResultsView
          data={results}
          days={days}
          onDays={setDays}
          loading={resultsLoading}
        />
      )}

      {error && error !== "migration_missing" && (
        <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>
      )}
    </>
  );
}
