"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AUDIENCE_LABELS, CHANNEL_LABELS, type NudgeCampaign } from "@/lib/nudge";
import {
  createNudge,
  deleteNudge,
  loadNudge,
  loadNudgeResults,
  saveNudge,
  type NudgeResults,
  type OfferableCode,
  type TargetOptions,
} from "./actions";
import { NudgeEditor } from "./nudge-editor";
import { NudgeResultsView } from "./nudge-results";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { ViewTabs } from "@/components/dashboard-ui";
import { IcAlert, IcPlus, IcTrash } from "@/components/icons";

type Tab = "design" | "results";

export default function NudgesPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [tab, setTab] = useState<Tab>("design");
  const [campaigns, setCampaigns] = useState<NudgeCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [codes, setCodes] = useState<OfferableCode[]>([]);
  const [options, setOptions] = useState<TargetOptions>({ products: [], collections: [], customers: [] });
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
        setCampaigns(res.data.campaigns);
        setSelectedId(res.data.campaigns[0]?.id ?? null);
        setCodes(res.data.codes);
        setOptions(res.data.options);
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

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  async function onSave(next: NudgeCampaign) {
    setSaving(true);
    const res = await saveNudge(next);
    setSaving(false);
    if (res.ok) {
      setCampaigns((list) =>
        list.map((c) => (c.id === next.id ? next : c)).sort((a, b) => b.priority - a.priority),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
    }
  }

  async function onCreate() {
    const res = await createNudge();
    if (!res.ok) return setError(res.error);
    setCampaigns((list) => [...list, res.data]);
    setSelectedId(res.data.id);
    setTab("design");
  }

  async function onDelete(c: NudgeCampaign) {
    if (!confirm(ar ? `حذف "${c.name}"؟` : `Delete "${c.name}"?`)) return;
    const res = await deleteNudge(c.id);
    if (!res.ok) return setError(res.error);
    const rest = campaigns.filter((x) => x.id !== c.id);
    setCampaigns(rest);
    setSelectedId(rest[0]?.id ?? null);
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
                ? "شغّلي supabase/migrations/0020_nudges.sql و 0054_offers_targeting.sql ثم حدّثي الصفحة."
                : "Run supabase/migrations/0020_nudges.sql and 0054_offers_targeting.sql, then refresh this page."}
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
          <>
            {saved && <span className="badge bg-emerald-50 text-emerald-700">{ar ? "تم الحفظ" : "Saved"}</span>}
            <button className="btn-outline h-9 gap-1.5 px-3 text-sm" onClick={onCreate}>
              <IcPlus className="h-4 w-4" /> {ar ? "نافذة جديدة" : "New popup"}
            </button>
          </>
        }
      />

      <div className="mb-5">
        <ViewTabs
          tabs={[
            { key: "design", label: ar ? "الحملات" : "Campaigns" },
            { key: "results", label: ar ? "النتائج" : "Results" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : tab === "design" ? (
        <>
          {/* Every campaign at a glance; the one chosen is edited below. */}
          <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
            {campaigns.map((c) => {
              const on = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`min-w-[220px] rounded-2xl border p-3.5 text-start transition-colors ${
                    on ? "border-brand-600 bg-brand-50" : "border-line bg-surface hover:bg-surface-hover"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm font-semibold ${on ? "text-brand-700" : "text-ink"}`}>{c.name}</span>
                    {c.enabled ? (
                      <span className="badge bg-emerald-50 text-emerald-700">{ar ? "مباشر" : "Live"}</span>
                    ) : (
                      <span className="badge bg-slate-100 text-ink-muted">{ar ? "متوقف" : "Off"}</span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-soft">
                    {AUDIENCE_LABELS[c.audience][lang]} · {c.channels.map((ch) => CHANNEL_LABELS[ch][lang]).join(", ") || "—"}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {c.codeMode === "unique"
                      ? ar
                        ? "كود خاص لكل عميلة"
                        : "Code per shopper"
                      : c.discountCode || (ar ? "بدون كود" : "No code")}
                    {c.priority ? ` · ${ar ? "أولوية" : "priority"} ${c.priority}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <>
              <NudgeEditor key={selected.id} initial={selected} codes={codes} options={options} onSave={onSave} saving={saving} />
              {campaigns.length > 1 && (
                <button className="btn-ghost mt-4 gap-1.5 text-sm text-rose-600" onClick={() => onDelete(selected)}>
                  <IcTrash className="h-4 w-4" /> {ar ? "حذف هذه الحملة" : "Delete this campaign"}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <NudgeResultsView data={results} days={days} onDays={setDays} loading={resultsLoading} />
      )}

      {error && error !== "migration_missing" && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}
    </>
  );
}
