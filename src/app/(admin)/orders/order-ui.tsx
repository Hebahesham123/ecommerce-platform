"use client";

/**
 * Shared order UI: the status → pill vocabulary, the payment-method list, and
 * the Collect-payment / Refund / Fulfill modals.
 *
 * These live here rather than in orders-list so the full-page order view and the
 * list's status popovers can use the exact same pills and modals. A forked copy
 * of "what does 'partially_paid' look like" drifts within a month. The timeline
 * row is here for the same reason: it is rendered on the order page and in the
 * list's comment popover, and an edit must behave identically in both.
 */

import { useState } from "react";
import { egp, num, type Lang } from "@/lib/i18n";
import { StatusPill, type PillTone } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcCash, IcCourier, IcEdit, IcChevron } from "@/components/icons";
import { collectPayment, refundPayment, fulfillOrder, updateOrderEvent, type TimelineEntry } from "./actions";
import { isEditableEntry } from "@/lib/order-timeline";

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
    paymob_not_configured: { ar: "أضيفي مفاتيح باي موب في «تكامل الدفع» أولاً.", en: "Set up Paymob keys in Payment integration first." },
    paymob_no_client_secret: { ar: "لم يرد باي موب برمز الدفع. راجعي المفاتيح.", en: "Paymob didn't return a checkout secret — check the keys." },
    smtp_not_configured: { ar: "أضيفي بيانات البريد (Outlook) أولاً.", en: "Set up the email (Outlook) mailbox first." },
    no_customer_email: { ar: "لا يوجد بريد لهذا العميل لإرسال الفاتورة.", en: "This customer has no email to send the invoice to." },
    send_failed: { ar: "تعذّر إرسال البريد.", en: "Couldn't send the email." },
    empty_comment: { ar: "اكتبي نصاً أولاً.", en: "Write something first." },
    entry_not_found: { ar: "لم يعد هذا السطر موجوداً.", en: "That entry is no longer there." },
    note_locked: {
      ar: "الملاحظة تُكتب مرة واحدة ولا تُعدَّل بعدها. اكتبي تعليقاً على المخطط الزمني بدلاً من ذلك.",
      en: "A note is written once and can't be changed afterwards — add a timeline comment instead.",
    },
    name_required: { ar: "الاسم مطلوب.", en: "A name is required." },
    phone_required: { ar: "رقم الهاتف مطلوب.", en: "A phone number is required." },
    edit_migration_missing: {
      ar: "تعديل الطلبات يحتاج ترحيل قاعدة البيانات 0062 أولاً.",
      en: "Editing orders needs database migration 0062 to be run first.",
    },
    line_fulfilled: {
      ar: "لا يمكن إنقاص صنف تم شحنه. تراجعي عن التنفيذ أولاً.",
      en: "A line that has already shipped can't be reduced — undo the fulfillment first.",
    },
    line_not_found: { ar: "هذا السطر لم يعد في الطلب.", en: "That line is no longer on the order." },
    entry_not_editable: {
      ar: "هذا السطر مبني على سجل آخر (الطلب أو الدفع أو التنفيذ) ولا يُعدَّل من هنا.",
      en: "This entry comes from another record (the order, a payment, a fulfillment) and can't be changed here.",
    },
  };
  const e = map[code];
  return e ? (ar ? e.ar : e.en) : ar ? "حدث خطأ." : "Something went wrong.";
}


/**
 * One line of an order's timeline.
 *
 * Comments and logged events are rows in `order_events`, so a wrong one can be
 * corrected here. Nothing can be removed: the timeline is the order's record.
 * The entries derived from the order, the payments and the fulfillments cannot
 * even be corrected — see `isEditableEntry`.
 *
 * The control is always rendered rather than revealed on hover: this screen is
 * used on a phone, where there is no hover to reveal it with.
 */
export function TimelineRow({ orderNumber, ar, entry, onChanged, fmtTime }: {
  orderNumber: string; ar: boolean; entry: TimelineEntry;
  onChanged: (e: TimelineEntry) => void;
  fmtTime: (s: string) => string;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState(entry.message);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const editable = isEditableEntry(entry.id);
  // A note change carries its wording and an order edit carries its changes;
  // everything else is just the one line.
  const note = entry.note;
  const changes = entry.changes?.length ? entry.changes : null;
  const hasDetail = Boolean(note || changes);

  async function save() {
    const body = draft.trim();
    if (!body || body === entry.message) { setMode("view"); setDraft(entry.message); return; }
    setBusy(true);
    setErr(null);
    const res = await updateOrderEvent(orderNumber, entry.id, body);
    setBusy(false);
    if (res.ok) { onChanged(res.data); setMode("view"); }
    else setErr(orderErrorText(res.error, ar));
  }

  return (
    <li className="flex gap-3">
      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink-soft" />
      <div className="min-w-0 flex-1">
        {mode === "edit" ? (
          <div className="rounded-xl border border-line p-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              className="w-full resize-none bg-transparent text-sm text-ink outline-none"
            />
            <div className="mt-1 flex justify-end gap-2">
              <button onClick={() => { setDraft(entry.message); setMode("view"); }} className="btn-outline h-7 px-3 text-xs">
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button onClick={save} disabled={busy || !draft.trim()} className="btn-primary h-7 px-3 text-xs disabled:opacity-50">
                {busy ? "…" : ar ? "حفظ" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-sm text-ink">
                {entry.message}
                {hasDetail && (
                  <button
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-label={note ? (ar ? "عرض نص الملاحظة" : "Show the note") : (ar ? "عرض التغييرات" : "Show what changed")}
                    className="ms-1 inline-flex align-middle text-ink-soft hover:text-ink"
                  >
                    <IcChevron className={"h-3.5 w-3.5 transition " + (open ? "-rotate-90" : "rotate-90")} />
                  </button>
                )}
              </div>
              {editable && mode === "view" && (
                <button
                  onClick={() => { setDraft(entry.message); setMode("edit"); }}
                  title={ar ? "تعديل" : "Edit"}
                  aria-label={ar ? "تعديل" : "Edit"}
                  className="shrink-0 rounded-md p-1 text-ink-soft opacity-70 hover:bg-surface-page hover:text-ink hover:opacity-100"
                >
                  <IcEdit className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {open && changes && (
              <ul className="mt-1.5 space-y-1 rounded-xl border border-line bg-surface-page px-3 py-2" dir="auto">
                {changes.map((c, i) => (
                  <li key={i} className="text-sm text-ink">· {c}</li>
                ))}
              </ul>
            )}
            {open && note && (
              <div className="mt-1.5 rounded-xl border border-line bg-surface-page px-3 py-2" dir="auto">
                {note.after ? (
                  <>
                    <div className="text-xs font-semibold text-ink">{ar ? "الملاحظة" : "Note"}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{note.after}</div>
                  </>
                ) : (
                  <div className="text-xs font-semibold text-ink">{ar ? "حُذفت الملاحظة" : "Note removed"}</div>
                )}
                {note.before && note.before !== note.after && (
                  <>
                    <div className="mt-2 text-xs font-semibold text-ink-soft">{ar ? "قبل التعديل" : "Previously"}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink-muted">{note.before}</div>
                  </>
                )}
              </div>
            )}
            <div className="text-xs text-ink-soft">
              {fmtTime(entry.createdAt)}
              {entry.edited && <span className="ms-1">· {ar ? "مُعدَّل" : "edited"}</span>}
            </div>
          </>
        )}
        {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
      </div>
    </li>
  );
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
    <Modal
      title={title}
      subtitle={`#${orderNumber} · ${ar ? "بحد أقصى" : "max"} ${egp(maxAmount, lang)}`}
      icon={IcCash}
      accent={kind === "refund" ? "rose" : "emerald"}
      size="sm"
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : title}</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={ar ? "المبلغ" : "Amount"}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className={fieldClass} inputMode="decimal" dir="ltr" />
        </Field>
        <Field label={ar ? "طريقة الدفع" : "Payment method"}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
            {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>)}
          </select>
        </Field>
        {kind === "payment" && (
          <Field label={ar ? "مرجع (اختياري)" : "Reference (optional)"}>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={ar ? "رقم الإيصال / المعاملة" : "Receipt / transaction no."} className={fieldClass} />
          </Field>
        )}
        <Field label={ar ? "ملاحظة (اختياري)" : "Note (optional)"}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
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
  items: {
    id: string;
    productName: string;
    quantity: number;
    fulfilledQuantity: number;
    sku?: string | null;
    imageUrl?: string | null;
  }[];
  ar: boolean;
  lang: Lang;
  onClose: () => void;
  onDone: () => void;
}) {
  const outstanding = items.filter((li) => li.quantity - li.fulfilledQuantity > 0);
  const remainingOf = (li: (typeof outstanding)[number]) => li.quantity - li.fulfilledQuantity;

  // Everything starts ticked at its full remaining quantity, so confirming
  // without touching anything fulfils the whole order — the common case, and
  // the one the button used to do without asking.
  const [picked, setPicked] = useState<Record<string, boolean>>(
    Object.fromEntries(outstanding.map((li) => [li.id, true])),
  );
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(outstanding.map((li) => [li.id, remainingOf(li)])),
  );
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chosenLines = outstanding.filter((li) => picked[li.id] && (qty[li.id] ?? 0) > 0);
  const allPicked = chosenLines.length === outstanding.length;
  const toggleAll = () => {
    const next = !allPicked;
    setPicked(Object.fromEntries(outstanding.map((li) => [li.id, next])));
    if (next) setQty(Object.fromEntries(outstanding.map((li) => [li.id, remainingOf(li)])));
  };

  async function submit() {
    const chosen = chosenLines.map((li) => ({
      orderItemId: li.id,
      quantity: Math.max(0, Math.min(qty[li.id] ?? 0, remainingOf(li))),
    }));
    if (chosen.length === 0) {
      setErr(ar ? "اختاري صنفاً واحداً على الأقل." : "Choose at least one item.");
      return;
    }
    setBusy(true);
    const res = await fulfillOrder(orderNumber, { items: chosen, tracking, carrier });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(orderErrorText(res.error, ar));
  }

  return (
    <Modal
      title={ar ? "تنفيذ الأصناف" : "Fulfill items"}
      subtitle={`#${orderNumber}`}
      icon={IcCourier}
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy || chosenLines.length === 0} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">
            {busy ? "…" : allPicked ? (ar ? "تنفيذ الكل" : "Fulfill all") : ar ? "تنفيذ المحدد" : "Fulfill selected"}
          </button>
        </>
      }
    >
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={allPicked}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-line accent-brand-600"
        />
        {ar
          ? `${num(chosenLines.length, lang)} من ${num(outstanding.length, lang)} أصناف محددة`
          : `${chosenLines.length} of ${outstanding.length} item${outstanding.length === 1 ? "" : "s"} selected`}
      </label>
      <div className="space-y-2">
        {outstanding.map((li) => {
          const max = remainingOf(li);
          const on = Boolean(picked[li.id]);
          return (
            <div
              key={li.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${on ? "border-brand-600/40 bg-surface-page" : "border-line opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  setPicked((p) => ({ ...p, [li.id]: !on }));
                  if (!on && (qty[li.id] ?? 0) === 0) setQty((q) => ({ ...q, [li.id]: max }));
                }}
                className="h-4 w-4 shrink-0 rounded border-line accent-brand-600"
                aria-label={li.productName}
              />
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                {li.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={li.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm text-ink">{li.productName}</div>
                <div className="text-xs text-ink-soft">
                  {li.sku ? <span dir="ltr">{li.sku} · </span> : null}
                  {ar ? `متبقٍ ${num(max, lang)}` : `${max} remaining`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm text-ink-soft">
                <input
                  type="number"
                  min={0}
                  max={max}
                  disabled={!on}
                  value={qty[li.id] ?? 0}
                  onChange={(e) => setQty((q) => ({ ...q, [li.id]: Math.max(0, Math.min(Number(e.target.value) || 0, max)) }))}
                  className="w-14 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm disabled:opacity-40"
                />
                <span className="whitespace-nowrap">{ar ? `من ${num(max, lang)}` : `of ${max}`}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label={ar ? "شركة الشحن" : "Carrier"}><input value={carrier} onChange={(e) => setCarrier(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "رقم التتبّع" : "Tracking no."}><input value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" className={fieldClass} /></Field>
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
    </Modal>
  );
}
