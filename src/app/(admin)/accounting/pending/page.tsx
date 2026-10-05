"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Badge, Spinner } from "@/components/accounting/ui";
import { PageHeader } from "@/components/accounting/ReportToolbar";
import { fmtMoney } from "@/lib/accounting/format";
import { collectionMethodLabel } from "@/lib/courier";
import { listPendingEntries, confirmPendingEntry, rejectPendingEntry, type PendingResult } from "../pending-actions";

const TABS: { key: "pending" | "posted" | "rejected"; label: string }[] = [
  { key: "pending", label: "بانتظار الاعتماد" },
  { key: "posted", label: "معتمدة" },
  { key: "rejected", label: "مرفوضة" },
];

const SOURCE_LABEL: Record<string, string> = {
  cod: "عند التسليم",
  paymob: "باي موب",
  payment: "دفع",
  card: "بطاقة",
  manual: "يدوي",
};

export default function PendingPage() {
  const [tab, setTab] = useState<"pending" | "posted" | "rejected">("pending");
  const [data, setData] = useState<PendingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPendingEntries(tab);
    if (res.ok) { setData(res.data); setErr(null); }
    else setErr(res.error === "migration_missing" ? "شغّلي ترحيل 0047." : res.error);
    setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  async function confirm(id: string) {
    setBusyId(id); setErr(null);
    const res = await confirmPendingEntry(id);
    setBusyId(null);
    if (res.ok) await load();
    else setErr(res.error === "no_entity_or_chart" ? "أضيفي كياناً وشجرة حسابات أولاً." : "تعذّر الاعتماد.");
  }
  async function reject(id: string) {
    if (!window.confirm("رفض هذا القيد؟ لن يُسجَّل في الدفاتر.")) return;
    setBusyId(id);
    const res = await rejectPendingEntry(id);
    setBusyId(null);
    if (res.ok) await load();
  }

  const fmtTime = (x: string) => new Date(x).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div dir="rtl">
      <PageHeader title="القيود المعلّقة" subtitle="يعتمد المحاسب تحصيلات الطلبات قبل تسجيلها في الدفاتر" />

      {/* Per-method totals (the "total of each method") */}
      {tab === "pending" && data && data.totals.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.totals.map((t) => (
            <div key={t.method} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">{collectionMethodLabel(t.method, true)}</div>
              <div className="num mt-1 text-lg font-bold text-slate-800">{fmtMoney(t.amount)}</div>
              <div className="num text-[11px] text-slate-400">{t.count} قيد</div>
            </div>
          ))}
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 shadow-sm">
            <div className="text-xs font-semibold text-brand-700">الإجمالي المعلّق</div>
            <div className="num mt-1 text-lg font-bold text-brand-800">{fmtMoney(data.total)}</div>
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4 flex gap-1 border-b border-slate-100 pb-2">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === tb.key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{err}</p>}

        {loading ? (
          <Spinner />
        ) : !data || data.entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {tab === "pending" ? "لا توجد قيود بانتظار الاعتماد." : "لا توجد قيود."}
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="sheet">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الطلب</th>
                  <th>المصدر</th>
                  <th>طريقة التحصيل</th>
                  <th>المندوب</th>
                  <th>المبلغ</th>
                  {tab === "pending" && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-slate-500">{fmtTime(e.createdAt)}</td>
                    <td className="font-semibold text-slate-700">{e.orderNumber ? `#${e.orderNumber}` : "—"}</td>
                    <td>{SOURCE_LABEL[e.source] ?? e.source}</td>
                    <td><Badge color="blue">{collectionMethodLabel(e.method, true)}</Badge></td>
                    <td>{e.courierName ?? "—"}</td>
                    <td className="num font-semibold">{fmtMoney(e.amount)}</td>
                    {tab === "pending" && (
                      <td>
                        <div className="flex gap-1">
                          <Button onClick={() => confirm(e.id)} disabled={busyId === e.id}>
                            {busyId === e.id ? "…" : "اعتماد"}
                          </Button>
                          <Button variant="ghost" className="text-red-600" onClick={() => reject(e.id)} disabled={busyId === e.id}>
                            رفض
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
