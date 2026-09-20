"use client";

import { useEffect, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { IcAlert, IcRefresh, IcSignature } from "@/components/icons";
import { getLoyaltyOverview, setRewardActive, setRewardCost, type RewardRow } from "../actions";

const TYPE_TONE: Record<string, string> = {
  discount: "bg-brand-50 text-brand-700",
  delivery: "bg-sky-50 text-sky-700",
  product: "bg-emerald-50 text-emerald-700",
  access: "bg-violet-50 text-violet-700",
  experience: "bg-amber-50 text-amber-700",
  signatures: "bg-slate-100 text-slate-600",
};

export default function LoyaltyRewardsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await getLoyaltyOverview();
    if (res.ok) {
      setRewards(res.data.rewards);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(r: RewardRow) {
    setRewards((cur) => cur.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    await setRewardActive(r.id, !r.active);
  }
  async function saveCost(r: RewardRow, cost: number) {
    setRewards((cur) => cur.map((x) => (x.id === r.id ? { ...x, signature_cost: cost } : x)));
    await setRewardCost(r.id, cost);
  }

  // Ranked by use: the reward names the card, its cost and whether it is on
  // sit on the face, and its type and minimum level wait behind a tap.
  const columns: Column<(typeof rewards)[number]>[] = [
    {
      key: "reward",
      header: ar ? "المكافأة" : "Reward",
      rank: "title",
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{ar ? r.title_ar ?? r.title_en : r.title_en}</span>
          {r.discount_kind && (
            <span className="block text-xs font-normal text-ink-soft">
              {r.discount_kind === "free_shipping"
                ? ar ? "شحن مجاني" : "Free shipping"
                : `${r.discount_value}${r.discount_kind === "percent" ? "%" : " EGP"}`}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "cost",
      header: ar ? "التكلفة (✦)" : "Cost (✦)",
      rank: "primary",
      cell: (r) => <CostEditor value={r.signature_cost} onSave={(c) => saveCost(r, c)} />,
    },
    {
      key: "active",
      header: ar ? "الحالة" : "Status",
      rank: "primary",
      align: "end",
      cell: (r) => (
        <button
          onClick={() => toggle(r)}
          className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${
            r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {r.active ? (ar ? "نشطة" : "Active") : ar ? "متوقّفة" : "Off"}
        </button>
      ),
    },
    {
      key: "type",
      header: ar ? "النوع" : "Type",
      rank: "secondary",
      cell: (r) => <Badge className={TYPE_TONE[r.type] ?? "bg-slate-100 text-slate-600"}>{r.type}</Badge>,
    },
    {
      key: "min_level",
      header: ar ? "أدنى مستوى" : "Min level",
      rank: "secondary",
      cell: (r) => <span className="text-ink-muted">{r.min_level ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={ar ? "مكافآت الولاء" : "Loyalty rewards"}
        subtitle={ar ? "كتالوج المكافآت القابلة للاستبدال بالتواقيع" : "The signature-redeemable reward catalogue"}
        actions={
          <button className="btn-outline" onClick={load}>
            <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
          </button>
        }
      />

      {error === "migration_missing" && (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card"><IcAlert className="h-4 w-4" /></span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">{ar ? "شغّلي ترحيل قاعدة بيانات الولاء" : "Run the loyalty migration"}</div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0027_loyalty.sql</code>
          </div>
        </Card>
      )}

      {loading && rewards.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <DataTable
            flush
            rows={rewards}
            columns={columns}
            getKey={(r) => r.id}
            empty={ar ? "لا توجد مكافآت بعد." : "No rewards yet."}
          />
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-ink-soft">
            <IcSignature className="h-3.5 w-3.5" /> {ar ? "المكافآت بتكلفة صفر تُمنَح عبر الخزائن أو المستويات، لا بالشراء." : "Zero-cost rewards are granted via vaults or levels, not purchased."}
          </p>
        </Card>
      )}
    </>
  );
}

function CostEditor({ value, onSave }: { value: number; onSave: (cost: number) => void }) {
  const [v, setV] = useState(String(value));
  const dirty = String(value) !== v.trim();
  return (
    <span className="inline-flex items-center gap-1.5">
      <input value={v} onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))} className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-600" />
      {dirty && <button onClick={() => onSave(Number(v) || 0)} className="btn-primary h-7 px-2 text-xs">Save</button>}
    </span>
  );
}
