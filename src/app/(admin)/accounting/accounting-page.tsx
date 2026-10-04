"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcCash, IcCourier, IcChart, IcPlus } from "@/components/icons";
import type { AccountingEntry } from "@/lib/courier";
import { listAccountingEntries, accountingSummary, addAccountingEntry, type AccountingSummary } from "./actions";

export function AccountingPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sum, list] = await Promise.all([accountingSummary(30), listAccountingEntries(200)]);
    if (sum.ok) setSummary(sum.data);
    if (list.ok) setEntries(list.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxDay = Math.max(1, ...(summary?.daily ?? []).map((d) => d.amount));
  const fmtTime = (s: string) => new Date(s).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const methodLabel = (m: string | null) => (m === "cod" ? (ar ? "عند الاستلام" : "COD") : m === "card" ? (ar ? "بطاقة" : "Card") : m === "manual" ? (ar ? "يدوي" : "Manual") : m || "—");

  return (
    <>
      <PageHeader
        title={t("nav_accounting")}
        subtitle={ar ? "النقدية الواردة من الطلبات المؤكدة والمدفوعات" : "Cash in from confirmed orders & payments"}
        primary={{ label: ar ? "إضافة قيد" : "Add entry", onClick: () => setAddOpen(true) }}
      />

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile icon={IcCash} label={ar ? "إجمالي الوارد (٣٠ يوم)" : "Cash in (30d)"} value={egp(summary?.cashIn ?? 0, lang)} accent="emerald" />
          <StatTile icon={IcCourier} label={ar ? "رسوم المندوبين" : "Courier fees"} value={egp(summary?.courierFees ?? 0, lang)} accent="amber" />
          <StatTile icon={IcChart} label={ar ? "الصافي" : "Net"} value={egp(summary?.net ?? 0, lang)} accent="brand" />
          <StatTile icon={IcCash} label={ar ? "عدد القيود" : "Entries"} value={num(summary?.count ?? 0, lang)} accent="sky" />
        </KpiRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily chart */}
        <Card className="p-4 lg:col-span-1">
          <div className="mb-3 text-sm font-semibold text-ink">{ar ? "الوارد اليومي" : "Daily cash in"}</div>
          {loading ? (
            <div className="py-8 text-center text-sm text-ink-soft">{t("loading")}</div>
          ) : (summary?.daily.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-sm text-ink-soft">{ar ? "لا بيانات بعد" : "No data yet"}</div>
          ) : (
            <div className="space-y-1.5">
              {summary!.daily.slice(-14).map((d) => (
                <div key={d.day} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-ink-soft">{d.day.slice(5)}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-page">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${Math.round((d.amount / maxDay) * 100)}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-end text-[11px] font-medium text-ink-muted">{egp(d.amount, lang)}</span>
                </div>
              ))}
            </div>
          )}
          {summary && summary.byMethod.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "حسب الطريقة" : "By method"}</div>
              {summary.byMethod.map((m) => (
                <div key={m.method} className="flex items-center justify-between py-0.5 text-sm">
                  <span className="text-ink-muted">{methodLabel(m.method)}</span>
                  <span className="font-medium text-ink">{egp(m.amount, lang)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ledger */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{ar ? "دفتر القيود" : "Ledger"}</div>
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-soft">{t("loading")}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><IcCash className="h-6 w-6" /></span>
              <div className="font-semibold text-ink">{ar ? "لا قيود بعد" : "No entries yet"}</div>
              <p className="max-w-xs text-sm text-ink-soft">{ar ? "عند تأكيد تسليم مندوب، يُسجَّل النقد الوارد هنا تلقائياً." : "When you confirm a courier delivery, the cash collected posts here automatically."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-2 text-start font-medium">{ar ? "التاريخ" : "Date"}</th>
                    <th className="px-4 py-2 text-start font-medium">{ar ? "الطلب" : "Order"}</th>
                    <th className="px-4 py-2 text-start font-medium">{ar ? "الطريقة" : "Method"}</th>
                    <th className="px-4 py-2 text-start font-medium">{ar ? "المندوب" : "Courier"}</th>
                    <th className="px-4 py-2 text-end font-medium">{ar ? "وارد" : "In"}</th>
                    <th className="px-4 py-2 text-end font-medium">{ar ? "رسوم" : "Fee"}</th>
                    <th className="px-4 py-2 text-end font-medium">{ar ? "صافي" : "Net"}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 text-ink-muted">{fmtTime(e.createdAt)}</td>
                      <td className="px-4 py-2.5">{e.orderNumber ? <span className="font-medium text-ink">#{e.orderNumber}</span> : <span className="text-ink-soft">—</span>}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{methodLabel(e.method)}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{e.courierName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-end font-semibold text-emerald-700">{egp(e.amount, lang)}</td>
                      <td className="px-4 py-2.5 text-end text-amber-700">{e.courierFee > 0 ? `−${egp(e.courierFee, lang)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-end font-semibold text-ink">{egp(e.net, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {addOpen && <AddEntryModal ar={ar} onClose={() => setAddOpen(false)} onSaved={async () => { setAddOpen(false); await load(); }} />}
    </>
  );
}

function AddEntryModal({ ar, onClose, onSaved }: { ar: boolean; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("manual");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr(ar ? "أدخلي مبلغاً صحيحاً." : "Enter a valid amount."); return; }
    setBusy(true); setErr(null);
    const res = await addAccountingEntry({ amount: amt, method, note });
    setBusy(false);
    if (res.ok) onSaved(); else setErr(ar ? "تعذّر الحفظ." : "Couldn't save.");
  }

  return (
    <Modal
      title={ar ? "إضافة قيد وارد" : "Add a cash-in entry"}
      icon={IcPlus}
      accent="emerald"
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "إضافة" : "Add"}</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={ar ? "المبلغ" : "Amount"}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" dir="ltr" className={fieldClass} />
        </Field>
        <Field label={ar ? "الطريقة" : "Method"}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
            <option value="manual">{ar ? "يدوي" : "Manual"}</option>
            <option value="cod">{ar ? "عند الاستلام" : "COD"}</option>
            <option value="card">{ar ? "بطاقة" : "Card"}</option>
          </select>
        </Field>
        <Field label={ar ? "ملاحظة" : "Note"}><input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
