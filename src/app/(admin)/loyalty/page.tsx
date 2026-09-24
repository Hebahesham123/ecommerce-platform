"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import { IcSignature, IcCustomers, IcStar, IcAlert, IcEye, IcRefresh } from "@/components/icons";
import { getLoyaltyOverview, setLevelColor, setLevelThreshold, type LoyaltyOverview } from "./actions";

export default function LoyaltyOverviewPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [data, setData] = useState<LoyaltyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await getLoyaltyOverview();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        title="Beauty Bar Society"
        subtitle={ar ? "برنامج الولاء — التواقيع، المستويات، الخزائن والمكافآت" : "Loyalty — signatures, levels, vaults & rewards"}
        actions={
          <>
            <a className="btn-outline" href="/store/society" target="_blank" rel="noreferrer">
              <IcEye className="h-4 w-4" /> {ar ? "معاينة العميل" : "Customer preview"}
            </a>
            <button className="btn-outline" onClick={load}>
              <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
            </button>
          </>
        }
      />

      {error === "migration_missing" && (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">{ar ? "شغّلي ترحيل قاعدة بيانات الولاء" : "Run the loyalty database migration"}</div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0027_loyalty.sql</code>
          </div>
        </Card>
      )}
      {error && error !== "migration_missing" && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      )}

      {loading && !data ? (
        <Card className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</Card>
      ) : data ? (
        <div className="space-y-4">
          <KpiRow cols={4}>
            <StatTile icon={IcCustomers} label={ar ? "الأعضاء" : "Members"} value={num(data.stats.members, lang)} accent="brand" />
            <StatTile icon={IcSignature} label={ar ? "تواقيع صادرة" : "Signatures issued"} value={num(data.stats.signaturesIssued, lang)} accent="emerald" />
            <StatTile icon={IcSignature} label={ar ? "تواقيع مستهلكة" : "Signatures spent"} value={num(data.stats.signaturesSpent, lang)} accent="sky" />
            <StatTile icon={IcStar} label={ar ? "مكافآت مُطالب بها" : "Rewards claimed"} value={num(data.stats.rewardsClaimed, lang)} accent="amber" />
          </KpiRow>

          {/* Levels */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">{ar ? "المستويات" : "Levels"}</h3>
              <Link href="/loyalty/members" className="text-sm text-brand-600 hover:underline">{ar ? "الأعضاء" : "Members"} →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-soft">
                    <th className="px-4 py-2 text-start font-medium">{ar ? "المستوى" : "Level"}</th>
                    <th className="px-3 py-2 text-start font-medium">{ar ? "عتبة التواقيع (مدى الحياة)" : "Lifetime threshold"}</th>
                    <th className="px-3 py-2 text-start font-medium">{ar ? "اللون" : "Colour"}</th>
                    <th className="px-3 py-2 text-start font-medium">{ar ? "أعضاء" : "Members"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.levels.map((l) => (
                    <tr key={l.key} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-ink">{ar ? l.name_ar : l.name_en}</span>
                        <span className="ms-2 text-xs text-ink-soft">{l.key}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <ThresholdEditor levelKey={l.key} value={l.threshold} onSaved={load} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ColorEditor levelKey={l.key} value={l.color} onSaved={load} />
                      </td>
                      <td className="px-3 py-2.5 text-ink">{num(data.stats.membersByLevel[l.key] ?? 0, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Earning rules */}
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">{ar ? "قواعد الكسب" : "Earning rules"}</h3>
              <ul className="space-y-2">
                {data.rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg bg-surface-page px-3 py-2 text-sm">
                    <span className="text-ink">{r.title || r.action_type}</span>
                    <span className="font-medium text-ink">
                      {r.action_type === "order" ? `${r.rate_per_egp}✦ / EGP` : `+${num(r.signatures, lang)}✦`}
                      {!r.active && <span className="ms-2 text-xs text-rose-500">{ar ? "متوقّف" : "off"}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Events */}
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">{ar ? "فعاليات المجتمع" : "Society events"}</h3>
              {data.events.length === 0 ? (
                <p className="text-sm text-ink-soft">{ar ? "لا توجد فعاليات." : "No events."}</p>
              ) : (
                <ul className="space-y-2">
                  {data.events.map((e) => {
                    const now = Date.now();
                    const live = e.active && new Date(e.start_date).getTime() <= now && new Date(e.end_date).getTime() >= now;
                    return (
                      <li key={e.id} className="flex items-center justify-between rounded-lg bg-surface-page px-3 py-2 text-sm">
                        <span className="text-ink">{e.title_en} <span className="text-xs text-ink-soft">×{e.multiplier}</span></span>
                        <Badge className={live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                          {live ? (ar ? "نشطة" : "Live") : (ar ? "غير نشطة" : "Off")}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Vaults */}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">{ar ? "الخزائن" : "Vaults"}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.vaults.map((v) => (
                <div key={v.id} className="rounded-xl border border-line p-3 text-center">
                  <div className="text-sm font-semibold text-ink">{v.title_en}</div>
                  <div className="mt-1 text-xs text-ink-soft">{ar ? "التقدّم المطلوب" : "goal"}: {v.required_progress}</div>
                  {v.level_required && <div className="mt-0.5 text-xs text-ink-soft">{v.level_required}+</div>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/**
 * The colour a level is shown in.
 *
 * One value, because every shade the storefront needs — the panel tint, its
 * border, the accent — is mixed from it. Choosing five shades by hand and
 * keeping them in step is the job this avoids.
 */
function ColorEditor({
  levelKey,
  value,
  onSaved,
}: {
  levelKey: string;
  value: string | null;
  onSaved: () => void;
}) {
  const fallback = "#a46c3c";
  const [v, setV] = useState(value ?? fallback);
  const [saving, setSaving] = useState(false);
  const dirty = (value ?? fallback).toLowerCase() !== v.toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="color"
        value={v}
        onChange={(e) => setV(e.target.value)}
        aria-label="Level colour"
        className="h-7 w-9 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
      />
      <span className="font-mono text-xs uppercase text-ink-soft">{v}</span>
      {dirty && (
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await setLevelColor(levelKey, v);
            setSaving(false);
            onSaved();
          }}
          className="btn-primary h-7 px-2 text-xs"
        >
          {saving ? "…" : "Save"}
        </button>
      )}
    </span>
  );
}

function ThresholdEditor({ levelKey, value, onSaved }: { levelKey: string; value: number; onSaved: () => void }) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const dirty = String(value) !== v.trim();
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
        className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-600"
      />
      {dirty && (
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await setLevelThreshold(levelKey, Number(v) || 0);
            setSaving(false);
            onSaved();
          }}
          className="btn-primary h-7 px-2 text-xs"
        >
          {saving ? "…" : "Save"}
        </button>
      )}
    </span>
  );
}
