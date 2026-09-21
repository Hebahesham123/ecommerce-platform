"use client";

/**
 * Shared order UI: the status → pill vocabulary, the payment-method list, and
 * the Collect-payment / Refund / Fulfill modals.
 *
 * These live here rather than in orders-list so the full-page order view and the
 * list's status popovers can use the exact same pills and modals. A forked copy
 * of "what does 'partially_paid' look like" drifts within a month.
 */

import { useState } from "react";
import { egp, num, type Lang } from "@/lib/i18n";
import { StatusPill, type PillTone } from "@/components/dashboard-ui";
import { collectPayment, refundPayment, fulfillOrder } from "./actions";

export type StatusMeta = { tone: PillTone; hollow: boolean; ar: string; en: string };

export function paymentMeta(status: string): StatusMeta {
  switch (status) {
    case "paid": return { tone: "success", hollow: false, ar: "مدفوع", en: "Paid" };
    case "partially_paid": return { tone: "warning", hollow: false, ar: "مدفوع جزئياً", en: "Partially paid" };
    case "partially_refunded": return { tone: "neutral", hollow: false, ar: "مسترجع جزئياً", en: "Partially refunded" };
    case "refunded": return { tone: "neutral", hollow: false, ar: "مسترجع", en: "Refunded" };
    case "authorized": return { tone: "info", hollow: false, ar: "محجوز", en: "Authorized" };
    default: return { tone: "warning", hollow: true, ar: "غير مدفوع", en: "Unpaid" };
  }
}

export function fulfillMeta(status: string): StatusMeta {
  switch (status) {
    case "fulfilled": return { tone: "success", hollow: false, ar: "مُنفّذ", en: "Fulfilled" };
    case "partial": return { tone: "warning", hollow: false, ar: "مُنفّذ جزئياً", en: "Partially fulfilled" };
    case "delivered": return { tone: "success", hollow: false, ar: "تم التسليم", en: "Delivered" };
    case "returned": return { tone: "critical", hollow: false, ar: "مرتجع", en: "Returned" };
    default: return { tone: "neutral", hollow: true, ar: "غير مُنفّذ", en: "Unfulfilled" };
  }
}

export const PAY_METHODS: { value: string; ar: string; en: string }[] = [
  { value: "cash", ar: "نقدي", en: "Cash" },
  { value: "cod", ar: "عند الاستلام", en: "Cash on delivery" },
  { value: "card", ar: "بطاقة", en: "Card" },
  { value: "instapay", ar: "إنستاباي", en: "InstaPay" },
  { value: "wallet", ar: "محفظة", en: "Wallet" },
  { value: "bank_transfer", ar: "تحويل بنكي", en: "Bank transfer" },
  { value: "other", ar: "أخرى", en: "Other" },
];

export function methodLabel(v: string, ar: boolean): string {
  const m = PAY_METHODS.find((x) => x.value === v);
  return m ? (ar ? m.ar : m.en) : v;
}

export function orderErrorText(code: string, ar: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    migration_missing: { ar: "شغّلي ترحيل قاعدة البيانات 0028.", en: "Run database migration 0028." },
    refund_exceeds_paid: { ar: "المبلغ أكبر من المدفوع.", en: "Refund exceeds what was paid." },
    invalid_amount: { ar: "أدخلي مبلغاً صحيحاً.", en: "Enter a valid amount." },
    nothing_to_fulfill: { ar: "لا يوجد ما يُنفَّذ.", en: "Nothing left to fulfill." },
    order_not_found: { ar: "الطلب غير موجود.", en: "Order not found." },
    no_items: { ar: "اختاري صنفاً واحداً على الأقل.", en: "Choose at least one item." },
    no_replacement: { ar: "اختاري بديلاً واحداً على الأقل.", en: "Choose at least one replacement." },
    nothing_returnable: { ar: "لا يوجد ما يُرتجع في هذا الطلب.", en: "Nothing left to return on this order." },
    replacement_out_of_stock: { ar: "البديل غير متوفر بالمخزون.", en: "That replacement is out of stock." },
  };
  const e = map[code];
  return e ? (ar ? e.ar : e.en) : ar ? "حدث خطأ." : "Something went wrong.";
}

/** A single label/value line in a money summary. */
export function SummaryRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-ink-soft" : "text-ink-muted"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : muted ? "text-ink-soft" : "text-ink"}>{value}</span>
    </div>
  );
}

/** Re-export so callers get the pill without a second import path. */
export { StatusPill };

// ---- Collect payment / refund modal -----------------------------------------
export function PaymentModal({
  kind,
  orderNumber,
  defaultAmount,
  maxAmount,
  ar,
  lang,
  onClose,
  onDone,
}: {
  kind: "payment" | "refund";
  orderNumber: string;
  defaultAmount: number;
  maxAmount: number;
  ar: boolean;
  lang: Lang;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr(ar ? "أدخلي مبلغاً صحيحاً." : "Enter a valid amount.");
      return;
    }
    setBusy(true);
    const res =
      kind === "payment"
        ? await collectPayment(orderNumber, { amount: amt, method, reference, note })
        : await refundPayment(orderNumber, { amount: amt, method, note });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(orderErrorText(res.error, ar));
  }

  const title =
    kind === "payment" ? (ar ? "تحصيل الدفع" : "Collect payment") : ar ? "استرجاع مبلغ" : "Refund";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-base font-semibold text-ink">{title}</div>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">
            {ar ? "المبلغ" : "Amount"}{" "}
            <span className="text-ink-soft">({ar ? "بحد أقصى" : "max"} {egp(maxAmount, lang)})</span>
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            inputMode="decimal"
          />
        </label>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "طريقة الدفع" : "Payment method"}</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {PAY_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>
            ))}
          </select>
        </label>
        {kind === "payment" && (
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "مرجع (اختياري)" : "Reference (optional)"}</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={ar ? "رقم الإيصال / المعاملة" : "Receipt / transaction no."}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </label>
        )}
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </label>
        {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">
            {busy ? "…" : title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Fulfill items modal ----------------------------------------------------
export function FulfillModal({
  orderNumber,
  items,
  ar,
  lang,
  onClose,
  onDone,
}: {
  orderNumber: string;
  items: { id: string; productName: string; quantity: number; fulfilledQuantity: number }[];
  ar: boolean;
  lang: Lang;
  onClose: () => void;
  onDone: () => void;
}) {
  const outstanding = items.filter((li) => li.quantity - li.fulfilledQuantity > 0);
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(outstanding.map((li) => [li.id, li.quantity - li.fulfilledQuantity])),
  );
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const chosen = outstanding
      .map((li) => ({ orderItemId: li.id, quantity: Math.max(0, Math.min(qty[li.id] ?? 0, li.quantity - li.fulfilledQuantity)) }))
      .filter((x) => x.quantity > 0);
    if (chosen.length === 0) {
      setErr(ar ? "اختاري كمية واحدة على الأقل." : "Choose at least one item.");
      return;
    }
    setBusy(true);
    const res = await fulfillOrder(orderNumber, { items: chosen, tracking, carrier });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(orderErrorText(res.error, ar));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-base font-semibold text-ink">{ar ? "تنفيذ الأصناف" : "Fulfill items"}</div>
        <div className="mb-3 space-y-2">
          {outstanding.map((li) => {
            const max = li.quantity - li.fulfilledQuantity;
            return (
              <div key={li.id} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm text-ink">{li.productName}</div>
                  <div className="text-xs text-ink-soft">{ar ? `متبقٍ ${num(max, lang)}` : `${max} remaining`}</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={qty[li.id] ?? 0}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [li.id]: Math.max(0, Math.min(Number(e.target.value) || 0, max)) }))
                  }
                  className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "شركة الشحن" : "Carrier"}</span>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "رقم التتبّع" : "Tracking no."}</span>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </label>
        </div>
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">
            {busy ? "…" : ar ? "تنفيذ" : "Fulfill"}
          </button>
        </div>
      </div>
    </div>
  );
}
