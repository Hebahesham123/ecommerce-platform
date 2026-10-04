"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { slotLabel } from "@/lib/offers";
import { IcCash, IcCourier, IcChevron, IcX, IcRedo, IcRefresh, IcEdit, IcMail, IcFile, IcLink } from "@/components/icons";
import { kindLabel, statusLabel } from "@/lib/returns";
import type { ReturnRequest } from "@/lib/returns";
import type { InventoryItem } from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import {
  getOrderDetail,
  getOrderReturns,
  getReturnableLines,
  getOrderTimeline,
  getOrderConversion,
  getMailerStatus,
  createOrderReturn,
  addOrderComment,
  updateOrderTags,
  saveAdminNote,
  setOrderHold,
  cancelOrder,
  archiveOrder,
  restockOrder,
  markOrderPaid,
  sendOrderInvoice,
  fulfillOrder,
  undoFulfillment,
  type OrderDetail,
  type OrderReturnSummary,
  type TimelineEntry,
  type OrderConversion,
} from "./actions";
import type { ReturnableLine } from "@/lib/returns-service";
import { createPaymobCheckout } from "../payments/actions";
import { getShipmentForOrder, assignOrderToCourier, confirmCourierReport, listCouriers } from "../couriers/actions";
import { SHIPMENT_STATUS, type Shipment, type Courier } from "@/lib/courier";
import { Modal, Field, fieldClass } from "@/components/modal";
import {
  paymentMeta,
  fulfillMeta,
  methodLabel,
  orderErrorText,
  SummaryRow,
  StatusPill,
  PaymentModal,
  FulfillModal,
} from "./order-ui";

/**
 * The full-page order view — a Shopify-style order screen at its own URL.
 *
 * Everything the merchant does to an order lives here: fulfil (with holds),
 * collect / refund / mark-paid, send the invoice by email, return or exchange,
 * cancel, archive, restock, tag, note, and read the timeline. The right rail
 * carries the customer, their conversion history and the order's risk.
 */
export function OrderDetailPage({ orderNumber, basePath }: { orderNumber: string; basePath: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [d, setD] = useState<OrderDetail | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [conv, setConv] = useState<OrderConversion | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [mailerReady, setMailerReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "collect" | "refund" | "fulfill" | "return" | "cancel" | "conversion" | "assign">(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [detail, rq, tl, cv, mail, sh, cs] = await Promise.all([
      getOrderDetail(orderNumber),
      getOrderReturns(orderNumber),
      getOrderTimeline(orderNumber),
      getOrderConversion(orderNumber),
      getMailerStatus(),
      getShipmentForOrder(orderNumber),
      listCouriers(),
    ]);
    if (detail.ok) { setD(detail.data); setErr(null); } else setErr(detail.error);
    if (rq.ok) setReturns(rq.data);
    if (tl.ok) setTimeline(tl.data);
    if (cv.ok) setConv(cv.data);
    if (mail.ok) setMailerReady(mail.data.ready);
    if (sh.ok) setShipment(sh.data);
    if (cs.ok) setCouriers(cs.data);
    setLoading(false);
  }, [orderNumber]);
  useEffect(() => { load(); }, [load]);

  const flashOk = (msg: string) => { setFlash(msg); setErr(null); };
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) { flashOk(ok); await load(); }
    else setErr(res.error ?? "error");
  };

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString(ar ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtTime = (s: string) =>
    new Date(s).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const payStatus = d?.paymentStatus ?? "pending";
  const fulStatus = d?.fulfillmentStatus ?? "unfulfilled";
  const pm = paymentMeta(payStatus);
  const fm = fulfillMeta(fulStatus);
  const remainingTotal = d ? d.items.reduce((s, li) => s + (li.quantity - li.fulfilledQuantity), 0) : 0;
  const cancelled = !!d?.cancelledAt;
  const archived = !!d?.archivedAt;
  const holdLabel = d?.fulfillmentHold === "in_progress" ? (ar ? "قيد التنفيذ" : "In progress")
    : d?.fulfillmentHold === "on_hold" ? (ar ? "معلّق" : "On hold") : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5" dir={ar ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <IcChevron className={`h-4 w-4 ${ar ? "rotate-0" : "rotate-180"}`} />
            {t("nav_orders")}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink">#{orderNumber}</h1>
            <StatusPill label={ar ? pm.ar : pm.en} tone={pm.tone} hollow={pm.hollow} />
            <StatusPill label={ar ? fm.ar : fm.en} tone={fm.tone} hollow={fm.hollow} />
            {holdLabel && <StatusPill label={holdLabel} tone="warning" />}
            {cancelled && <StatusPill label={ar ? "ملغي" : "Cancelled"} tone="critical" />}
            {archived && <StatusPill label={ar ? "مؤرشف" : "Archived"} tone="neutral" />}
          </div>
          {d && (
            <p className="mt-1 text-xs text-ink-soft">
              {fmt(d.createdAt)} · {d.channel === "app" ? (ar ? "التطبيق" : "App") : (ar ? "المتجر" : "Online Store")}
            </p>
          )}
        </div>
        {d && (
          <div className="flex flex-wrap items-center gap-2">
            {!cancelled && (
              <button onClick={() => setModal("return")} className="btn-outline h-9">
                <IcRedo className="h-4 w-4" /> {ar ? "إرجاع/استبدال" : "Return or exchange"}
              </button>
            )}
            <DropMenu trigger={<span className="btn-outline h-9 cursor-pointer">{ar ? "المزيد" : "More actions"} <IcChevron className="h-4 w-4 rotate-90" /></span>}>
              {!cancelled && <MenuItem onClick={() => setModal("cancel")} danger><IcX className="h-4 w-4" /> {ar ? "إلغاء الطلب" : "Cancel order"}</MenuItem>}
              <MenuItem onClick={() => run(() => restockOrder(orderNumber), ar ? "أُعيد للمخزون" : "Restocked")}><IcRefresh className="h-4 w-4" /> {ar ? "إعادة للمخزون" : "Restock items"}</MenuItem>
              <MenuItem onClick={() => run(() => archiveOrder(orderNumber, !archived), archived ? (ar ? "أُلغيت الأرشفة" : "Unarchived") : (ar ? "تمت الأرشفة" : "Archived"))}>
                <IcFile className="h-4 w-4" /> {archived ? (ar ? "إلغاء الأرشفة" : "Unarchive") : (ar ? "أرشفة" : "Archive")}
              </MenuItem>
              <a href={`/store/order/${orderNumber}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-ink hover:bg-surface-page">
                <IcLink className="h-4 w-4" /> {ar ? "صفحة حالة الطلب" : "View order status page"}
              </a>
              <MenuItem onClick={() => window.print()}><IcFile className="h-4 w-4" /> {ar ? "طباعة الطلب" : "Print order page"}</MenuItem>
              <MenuItem onClick={() => d && openPackingSlip(d, ar)}><IcFile className="h-4 w-4" /> {ar ? "طباعة قسيمة التغليف" : "Print packing slip"}</MenuItem>
            </DropMenu>
          </div>
        )}
      </div>

      {err && <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{orderErrorText(err, ar)}</div>}
      {flash && <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{flash}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Fulfillment */}
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCourier className="h-4 w-4 text-ink-soft" />
                <StatusPill label={ar ? fm.ar : fm.en} tone={fm.tone} hollow={fm.hollow} />
                {holdLabel && <StatusPill label={holdLabel} tone="warning" />}
              </div>
              {d && !cancelled && (
                <div className="flex">
                  <button onClick={() => remainingTotal > 0 ? fulfillAll() : undefined} disabled={remainingTotal === 0} className="btn-primary h-9 rounded-e-none disabled:opacity-50">
                    {ar ? "تعليم كمنفّذ" : "Mark as fulfilled"}
                  </button>
                  <DropMenu trigger={<span className="btn-primary flex h-9 cursor-pointer items-center rounded-s-none border-s border-white/20 px-2"><IcChevron className="h-4 w-4 rotate-90" /></span>}>
                    <MenuItem onClick={() => run(() => setOrderHold(orderNumber, "in_progress"), ar ? "قيد التنفيذ" : "Marked in progress")}>{ar ? "تعليم قيد التنفيذ" : "Mark as in progress"}</MenuItem>
                    <MenuItem onClick={() => run(() => setOrderHold(orderNumber, "on_hold"), ar ? "تم التعليق" : "Placed on hold")}>{ar ? "تعليق" : "Mark as on hold"}</MenuItem>
                    {d.fulfillmentHold && <MenuItem onClick={() => run(() => setOrderHold(orderNumber, null), ar ? "أُزيل التعليق" : "Hold cleared")}>{ar ? "إزالة التعليق" : "Clear hold"}</MenuItem>}
                    {remainingTotal > 0 && <MenuItem onClick={() => setModal("fulfill")}>{ar ? "تنفيذ أصناف محددة" : "Fulfill specific items"}</MenuItem>}
                  </DropMenu>
                </div>
              )}
            </div>
            {loading ? (
              <div className="px-4 py-4 text-sm text-ink-soft">{t("loading")}</div>
            ) : d && d.items.length ? (
              <div className="divide-y divide-line">
                {d.items.map((li) => {
                  const remaining = li.quantity - li.fulfilledQuantity;
                  return (
                    <div key={li.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                        {li.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={li.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-medium text-ink">{li.productName}</div>
                        <div className="text-xs text-ink-soft">
                          {li.variantTitle ? `${li.variantTitle} · ` : ""}
                          {li.sku ? <span dir="ltr">{li.sku}</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {remaining === 0 ? (
                            <span className="text-emerald-600">{ar ? "تم التنفيذ" : "Fulfilled"} ✓</span>
                          ) : (
                            <span className="text-amber-600">
                              {ar ? `${num(li.fulfilledQuantity, lang)} من ${num(li.quantity, lang)} مُنفّذ` : `${li.fulfilledQuantity} of ${li.quantity} fulfilled`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-end text-sm">
                        <div className="text-ink-muted">{egp(li.price, lang)} × {num(li.quantity, lang)}</div>
                        <div className="font-semibold text-ink">{egp(li.price * li.quantity, lang)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-ink-soft">{ar ? "لا توجد أصناف." : "No line items."}</div>
            )}

            {d && d.fulfillments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "سجل التنفيذ" : "Fulfillment history"}</div>
                <ul className="space-y-2">
                  {d.fulfillments.map((f) => (
                    <li key={f.id} className="rounded-lg bg-surface-page px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-ink">{f.items.reduce((s, i) => s + i.quantity, 0)} {ar ? "قطعة" : "items"} · {fmtTime(f.createdAt)}</span>
                        <button onClick={() => undo(f.id)} className="text-rose-500 hover:underline">{ar ? "تراجع" : "Undo"}</button>
                      </div>
                      {f.tracking && <div className="mt-0.5 text-ink-soft" dir="ltr">{f.carrier ? `${f.carrier} · ` : ""}{f.tracking}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCash className="h-4 w-4 text-ink-soft" />
                <StatusPill label={ar ? pm.ar : pm.en} tone={pm.tone} hollow={pm.hollow} />
              </div>
              {d && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => run(() => sendOrderInvoice(orderNumber), ar ? "تم إرسال الفاتورة" : "Invoice sent")}
                    disabled={busy}
                    className="btn-outline h-9 disabled:opacity-50"
                    title={mailerReady ? undefined : ar ? "لم يتم إعداد البريد بعد" : "Email not set up yet"}
                  >
                    <IcMail className="h-4 w-4" /> {ar ? "إرسال الفاتورة" : "Send invoice"}
                    {!mailerReady && <span className="ms-1 text-[10px] text-amber-600">●</span>}
                  </button>
                  {d.balance > 0 && !cancelled && (
                    <div className="flex">
                      <button onClick={() => setModal("collect")} className="btn-primary h-9 rounded-e-none">{ar ? "تحصيل الدفع" : "Collect payment"}</button>
                      <DropMenu trigger={<span className="btn-primary flex h-9 cursor-pointer items-center rounded-s-none border-s border-white/20 px-2"><IcChevron className="h-4 w-4 rotate-90" /></span>}>
                        <MenuItem onClick={payByCard}>{ar ? "بطاقة ائتمان (باي موب)" : "Credit card (Paymob)"}</MenuItem>
                        <MenuItem onClick={() => run(() => markOrderPaid(orderNumber), ar ? "تم التعليم كمدفوع" : "Marked as paid")}>{ar ? "تعليم كمدفوع" : "Mark as paid"}</MenuItem>
                      </DropMenu>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <SummaryRow label={ar ? "الإجمالي الفرعي" : "Subtotal"} value={egp(d?.subtotal ?? 0, lang)} />
              {d && d.discountAmount > 0 && (
                <SummaryRow label={`${ar ? "خصم" : "Discount"}${d.discountCode ? ` · ${d.discountCode}` : ""}`} value={`-${egp(d.discountAmount, lang)}`} muted />
              )}
              <SummaryRow label={ar ? "الشحن" : "Shipping"} value={d && d.shipping > 0 ? egp(d.shipping, lang) : (ar ? "مجاني" : "Free")} muted />
              <div className="my-1 border-t border-line" />
              <SummaryRow label={ar ? "الإجمالي" : "Total"} value={egp(d?.total ?? 0, lang)} bold />
              <SummaryRow label={ar ? "المدفوع" : "Paid"} value={egp(d?.amountPaid ?? 0, lang)} muted />
              <SummaryRow label={ar ? "المتبقي" : "Balance"} value={egp(d?.balance ?? 0, lang)} bold />
            </div>

            {d && d.payments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "سجل المدفوعات" : "Payment history"}</div>
                <ul className="space-y-1.5">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        {p.kind === "refund" ? (ar ? "استرجاع" : "Refund") : (ar ? "دفعة" : "Payment")} · {methodLabel(p.method, ar)} · {fmtTime(p.createdAt)}
                        {p.reference ? <span className="text-ink-soft" dir="ltr"> · {p.reference}</span> : null}
                      </span>
                      <span className={p.kind === "refund" ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
                        {p.kind === "refund" ? "−" : "+"}{egp(p.amount, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d && d.amountPaid > 0 && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                <button onClick={() => setModal("refund")} className="btn-outline h-9">{ar ? "استرجاع" : "Refund"}</button>
              </div>
            )}
          </div>

          {/* Courier / shipping */}
          {d && (
            <div className="rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <IcCourier className="h-4 w-4 text-ink-soft" />
                  {ar ? "المندوب" : "Courier"}
                  {shipment && <StatusPill label={ar ? SHIPMENT_STATUS[shipment.status].ar : SHIPMENT_STATUS[shipment.status].en} tone={SHIPMENT_STATUS[shipment.status].tone} />}
                </div>
                {!cancelled && (
                  <button onClick={() => setModal("assign")} className="btn-outline h-9">
                    {shipment ? (ar ? "إعادة التعيين" : "Reassign") : (ar ? "تعيين مندوب" : "Assign courier")}
                  </button>
                )}
              </div>
              {!shipment ? (
                <div className="px-4 py-4 text-sm text-ink-soft">{ar ? "لم يُعيَّن مندوب لهذا الطلب بعد." : "No courier assigned to this order yet."}</div>
              ) : (
                <div className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{shipment.courierName || "—"}</span>
                    <span className="text-ink-muted">{ar ? "الأجر" : "Fee"}: {egp(shipment.fee, lang)}</span>
                  </div>

                  {/* Pending report awaiting confirmation */}
                  {shipment.reportedStatus ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
                        {ar ? "تقرير المندوب — بانتظار التأكيد" : "Courier report — awaiting confirmation"}
                      </div>
                      <div className="text-sm text-amber-900">
                        {ar ? SHIPMENT_STATUS[shipment.reportedStatus].ar : SHIPMENT_STATUS[shipment.reportedStatus].en}
                        {shipment.reportedStatus === "delivered" && <> · {ar ? "حصّل" : "collected"} {egp(shipment.reportedCash ?? 0, lang)}</>}
                      </div>
                      {shipment.reportedNote && <div className="mt-0.5 text-xs text-amber-800/80">{shipment.reportedNote}</div>}
                      <button
                        onClick={() => run(() => confirmCourierReport(orderNumber), ar ? "تم تأكيد التقرير" : "Report confirmed")}
                        disabled={busy}
                        className="btn-primary mt-2 h-8 px-4 text-xs disabled:opacity-50"
                      >
                        {ar ? "تأكيد التقرير" : "Confirm report"}
                      </button>
                    </div>
                  ) : shipment.confirmedAt ? (
                    <div className="text-xs text-ink-soft">
                      {ar ? "آخر تأكيد" : "Confirmed"}: {new Date(shipment.confirmedAt).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {shipment.cashCollected > 0 && <> · {ar ? "النقد" : "cash"} {egp(shipment.cashCollected, lang)}</>}
                    </div>
                  ) : (
                    <div className="text-xs text-ink-soft">{ar ? "بانتظار تحديث المندوب من بوابته." : "Waiting for the courier to update from their portal."}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Returns & exchanges */}
          {returns.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                <IcRedo className="h-4 w-4 text-ink-soft" /> {ar ? "المرتجعات والاستبدالات" : "Returns & exchanges"}
              </div>
              <ul className="divide-y divide-line">
                {returns.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink" dir="ltr">{r.reference}</span>
                        <span className="text-xs text-ink-muted">{kindLabel[r.kind][ar ? "ar" : "en"]}</span>
                        <StatusPill label={statusLabel[r.status][ar ? "ar" : "en"]} tone={r.status === "completed" ? "success" : r.status === "rejected" || r.status === "cancelled" ? "critical" : "warning"} />
                      </div>
                      <div className="text-xs text-ink-muted">
                        {r.refundAmount > 0 && <span className="text-rose-600">{ar ? "استرجاع" : "Refund"} {egp(r.refundAmount, lang)}</span>}
                        {r.extraAmount > 0 && <span className="text-emerald-700">{ar ? "مستحق" : "Due"} {egp(r.extraAmount, lang)}</span>}
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {r.lines.map((li) => (
                        <div key={li.id} className="flex items-center justify-between text-xs text-ink-soft">
                          <span>
                            <span className={li.direction === "replacement" ? "text-emerald-700" : "text-rose-600"}>{li.direction === "replacement" ? (ar ? "بديل" : "New") : (ar ? "مرتجع" : "Back")}</span>{" "}
                            {li.productName}{li.variantTitle ? ` · ${li.variantTitle}` : ""}
                          </span>
                          <span>× {num(li.quantity, lang)}</span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          <TimelineCard orderNumber={orderNumber} ar={ar} entries={timeline} onPosted={(e) => setTimeline((prev) => [e, ...prev])} fmtTime={fmtTime} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <NotesCard orderNumber={orderNumber} ar={ar} initial={d?.adminNote ?? ""} />

          <div className="rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-ink">{ar ? "العميل" : "Customer"}</div>
            <div className="text-sm font-medium text-ink">{d?.customerName || "—"}</div>
            {conv && <div className="mt-0.5 text-sm text-brand-600">{ar ? `${num(conv.totalOrders, lang)} طلب` : `${conv.totalOrders} order${conv.totalOrders === 1 ? "" : "s"}`}</div>}
            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "معلومات التواصل" : "Contact information"}</div>
            {d?.customerEmail ? <div className="mt-1 text-sm text-brand-600" dir="ltr">{d.customerEmail}</div> : <div className="mt-1 text-sm text-ink-soft">{ar ? "لا يوجد بريد" : "No email"}</div>}
            <div className="mt-0.5 text-sm text-ink-muted" dir="ltr">{d?.phone || ""}</div>

            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "عنوان الشحن" : "Shipping address"}</div>
            <div className="mt-1 text-sm text-ink-muted">
              {[d?.address, d?.city, d?.governorate].filter(Boolean).join("، ") || "—"}
              {(d?.address || d?.city || d?.governorate) ? `، ${ar ? "مصر" : "Egypt"}` : ""}
            </div>
            {(d?.address || d?.city || d?.governorate) && (
              <a href={`https://www.google.com/maps/search/${encodeURIComponent([d?.address, d?.city, d?.governorate, "Egypt"].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-brand-600 hover:underline">
                {ar ? "عرض الخريطة" : "View map"}
              </a>
            )}

            {(d?.preferredDeliveryDate || d?.preferredDeliverySlot) && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "موعد التوصيل المطلوب" : "Requested delivery"}</div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {[
                    d?.preferredDeliveryDate ? new Date(d.preferredDeliveryDate).toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "short" }) : null,
                    slotLabel(d?.preferredDeliverySlot ?? null, ar ? "ar" : "en") || null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </>
            )}
          </div>

          {/* Conversion summary */}
          {conv && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-ink">{ar ? "ملخّص التحويل" : "Conversion summary"}</div>
              <ul className="space-y-1.5 text-sm text-ink-muted">
                <li>🛍️ {ar ? `هذا طلبهم رقم ${num(conv.orderIndex, lang)}` : `This is their ${ordinal(conv.orderIndex)} order`}</li>
                <li>💳 {ar ? `أنفقوا ${egp(conv.totalSpent, lang)} إجمالاً` : `${egp(conv.totalSpent, lang)} spent across ${conv.totalOrders} order${conv.totalOrders === 1 ? "" : "s"}`}</li>
                {conv.firstOrderAt && <li>📅 {ar ? `أول طلب ${fmt(conv.firstOrderAt)}` : `First order ${fmt(conv.firstOrderAt)}`}</li>}
              </ul>
              <button onClick={() => setModal("conversion")} className="mt-2 text-sm text-brand-600 hover:underline">{ar ? "عرض التفاصيل" : "View conversion details"}</button>
            </div>
          )}

          {/* Order risk */}
          {conv && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-ink">{ar ? "مخاطر الطلب" : "Order risk"}</div>
              <RiskBar risk={conv.risk} ar={ar} />
              <p className="mt-2 text-sm text-ink-muted">{conv.riskReason}</p>
            </div>
          )}

          {/* Tags */}
          {d && <TagsCard orderNumber={orderNumber} ar={ar} initial={d.tags} />}
        </div>
      </div>

      {/* Modals */}
      {modal === "collect" && d && (
        <PaymentModal kind="payment" orderNumber={orderNumber} defaultAmount={d.balance} maxAmount={d.balance} ar={ar} lang={lang} onClose={() => setModal(null)} onDone={async () => { setModal(null); await load(); }} />
      )}
      {modal === "refund" && d && (
        <PaymentModal kind="refund" orderNumber={orderNumber} defaultAmount={d.amountPaid} maxAmount={d.amountPaid} ar={ar} lang={lang} onClose={() => setModal(null)} onDone={async () => { setModal(null); await load(); }} />
      )}
      {modal === "fulfill" && d && (
        <FulfillModal orderNumber={orderNumber} items={d.items} ar={ar} lang={lang} onClose={() => setModal(null)} onDone={async () => { setModal(null); await load(); }} />
      )}
      {modal === "cancel" && (
        <CancelModal orderNumber={orderNumber} ar={ar} onClose={() => setModal(null)} onDone={async (msg) => { setModal(null); flashOk(msg); await load(); }} />
      )}
      {modal === "conversion" && conv && (
        <ConversionModal conv={conv} ar={ar} lang={lang} fmt={fmt} onClose={() => setModal(null)} />
      )}
      {modal === "assign" && (
        <AssignCourierModal
          orderNumber={orderNumber}
          ar={ar}
          couriers={couriers}
          current={shipment}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); flashOk(ar ? "تم تعيين المندوب" : "Courier assigned"); await load(); }}
        />
      )}
      {modal === "return" && d && (
        <ReturnModal
          orderNumber={orderNumber}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async (summary) => {
            setModal(null);
            const kindWord = summary.kind === "exchange" ? (ar ? "استبدال" : "Exchange") : (ar ? "إرجاع" : "Return");
            const parts = [
              `${kindWord} ${summary.reference}`,
              summary.refunded > 0 ? `${ar ? "استرجاع" : "refunded"} ${egp(summary.refunded, lang)}` : null,
              summary.extraDue > 0 ? `${ar ? "مستحق" : "due"} ${egp(summary.extraDue, lang)}` : null,
              `${ar ? "أُعيد للمخزون" : "restocked"} ${num(summary.returnCount, lang)}`,
            ].filter(Boolean);
            flashOk(parts.join(" · "));
            await load();
          }}
        />
      )}
    </div>
  );

  async function fulfillAll() {
    setBusy(true);
    const res = await fulfillOrder(orderNumber);
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else flashOk(ar ? "تم التنفيذ" : "Fulfilled");
    await load();
  }
  async function undo(id: string) {
    await undoFulfillment(id);
    flashOk(ar ? "تم التراجع" : "Fulfillment undone");
    await load();
  }
  async function payByCard() {
    setBusy(true);
    const res = await createPaymobCheckout(orderNumber);
    setBusy(false);
    if (res.ok) {
      window.open(res.data.url, "_blank", "noopener");
      flashOk(ar ? "تم فتح صفحة الدفع بالبطاقة" : "Opened Paymob card checkout");
    } else setErr(res.error);
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A proper, print-ready packing slip in its own window: shop header, ship-to,
// the items and quantities a picker actually needs, and a clean total.
function openPackingSlip(d: OrderDetail, ar: boolean) {
  const esc = (str: string) => str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const money = (v: number) => `LE ${v.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const totalQty = d.items.reduce((s, li) => s + li.quantity, 0);
  const addr = [d.address, d.city, d.governorate].filter(Boolean).map((x) => esc(String(x))).join("<br>");

  const rows = d.items.map((li) => `
    <tr>
      <td class="it">${esc(li.productName)}${li.variantTitle ? `<span class="v"> · ${esc(li.variantTitle)}</span>` : ""}</td>
      <td class="sku">${li.sku ? esc(li.sku) : "—"}</td>
      <td class="q">${li.quantity}</td>
    </tr>`).join("");

  const html = `<!doctype html><html lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8">
<title>${ar ? "قسيمة تغليف" : "Packing slip"} #${esc(d.orderNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fff}
  .sheet{max-width:720px;margin:0 auto;padding:40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
  .brand{font-size:24px;font-weight:800;letter-spacing:.06em}
  .brand span{font-style:italic;font-weight:600;color:#7a4b27}
  .meta{text-align:right;color:#555;font-size:13px}
  .meta .n{color:#111;font-weight:700;font-size:15px}
  .label{margin:26px 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888}
  .ship{font-size:14px;line-height:1.7}
  .ship .name{font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;text-align:left;padding:8px 10px;border-bottom:2px solid #111}
  th.q,td.q{text-align:center;width:64px}
  th.sku,td.sku{width:180px;color:#777}
  td{padding:12px 10px;border-bottom:1px solid #eee;vertical-align:top}
  td.it{font-weight:600}
  td.it .v{font-weight:400;color:#888}
  .totrow{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:2px solid #111}
  .totrow .k{color:#555}
  .totrow .val{font-size:22px;font-weight:800}
  .count{margin-top:10px;color:#666;font-size:13px}
  .thanks{margin-top:40px;text-align:center;color:#777}
  @media print{.sheet{padding:24px}@page{margin:14mm}}
</style></head>
<body onload="window.print()">
  <div class="sheet">
    <div class="top">
      <div class="brand">BEAUTY <span>BAR</span></div>
      <div class="meta"><div class="n">${ar ? "طلب" : "Order"} #${esc(d.orderNumber)}</div><div>${esc(date)}</div></div>
    </div>

    <div class="label">${ar ? "الشحن إلى" : "Ship to"}</div>
    <div class="ship" dir="auto">
      <div class="name">${esc(d.customerName || "")}</div>
      ${addr ? `<div>${addr}</div>` : ""}
      <div>${ar ? "مصر" : "Egypt"}</div>
      ${d.phone ? `<div dir="ltr">${esc(d.phone)}</div>` : ""}
    </div>

    <div class="label">${ar ? "الأصناف" : "Items"}</div>
    <table>
      <thead><tr><th>${ar ? "الصنف" : "Item"}</th><th class="sku">SKU</th><th class="q">${ar ? "الكمية" : "Qty"}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="count">${totalQty} ${ar ? "قطعة في هذا الطلب" : `item${totalQty === 1 ? "" : "s"} in this order`}</div>

    <div class="totrow"><div class="k">${ar ? "الإجمالي" : "Total"}</div><div class="val">${money(d.total)}</div></div>

    <div class="thanks">${ar ? "شكراً لتسوقك معنا!" : "Thank you for shopping with us!"}</div>
  </div>
</body></html>`;

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---- Small dropdown menu primitive ------------------------------------------
function DropMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 min-w-[210px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg end-0" onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
function MenuItem({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-surface-page ${danger ? "text-rose-600" : "text-ink"}`}>
      {children}
    </button>
  );
}

function RiskBar({ risk, ar }: { risk: "low" | "medium" | "high"; ar: boolean }) {
  const map = { low: { w: "33%", c: "bg-emerald-500", label: ar ? "منخفض" : "Low" }, medium: { w: "66%", c: "bg-amber-500", label: ar ? "متوسط" : "Medium" }, high: { w: "100%", c: "bg-rose-500", label: ar ? "مرتفع" : "High" } }[risk];
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-page"><div className={`h-full ${map.c}`} style={{ width: map.w }} /></div>
      <div className="mt-1 text-xs font-medium text-ink">{map.label}</div>
    </div>
  );
}

// ---- Notes card -------------------------------------------------------------
function NotesCard({ orderNumber, ar, initial }: { orderNumber: string; ar: boolean; initial: string }) {
  const [note, setNote] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setNote(initial); }, [initial]);

  async function save() {
    await saveAdminNote(orderNumber, note);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{ar ? "ملاحظات" : "Notes"}</span>
        {!editing && <button onClick={() => setEditing(true)} className="text-ink-soft hover:text-ink"><IcEdit className="h-4 w-4" /></button>}
      </div>
      {editing ? (
        <div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => { setNote(initial); setEditing(false); }} className="btn-outline h-8 px-3 text-xs">{ar ? "إلغاء" : "Cancel"}</button>
            <button onClick={save} className="btn-primary h-8 px-3 text-xs">{ar ? "حفظ" : "Save"}</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{note || (ar ? "لا توجد ملاحظات." : "No notes yet.")}{saved && <span className="ms-2 text-emerald-600">✓</span>}</p>
      )}
    </div>
  );
}

// ---- Tags card --------------------------------------------------------------
function TagsCard({ orderNumber, ar, initial }: { orderNumber: string; ar: boolean; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [input, setInput] = useState("");
  useEffect(() => { setTags(initial); }, [initial]);

  async function commit(next: string[]) {
    setTags(next);
    await updateOrderTags(orderNumber, next);
  }
  function add() {
    const v = input.trim();
    if (!v || tags.includes(v)) { setInput(""); return; }
    commit([...tags, v]);
    setInput("");
  }
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="mb-2 text-sm font-semibold text-ink">{ar ? "الوسوم" : "Tags"}</div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={ar ? "أضيفي وسماً…" : "Add a tag…"}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
      />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tg) => (
            <span key={tg} className="inline-flex items-center gap-1 rounded-lg bg-surface-page px-2 py-1 text-xs text-ink">
              {tg}
              <button onClick={() => commit(tags.filter((x) => x !== tg))} className="text-ink-soft hover:text-rose-600"><IcX className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Timeline card ----------------------------------------------------------
function TimelineCard({ orderNumber, ar, entries, onPosted, fmtTime }: {
  orderNumber: string; ar: boolean; entries: TimelineEntry[]; onPosted: (e: TimelineEntry) => void; fmtTime: (s: string) => string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function post() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const res = await addOrderComment(orderNumber, body);
    setBusy(false);
    if (res.ok) { onPosted(res.data); setText(""); }
  }
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="mb-2 text-sm font-semibold text-ink">{ar ? "المخطط الزمني" : "Timeline"}</div>
      <div className="rounded-xl border border-line p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={ar ? "اترك تعليقاً…" : "Leave a comment…"} className="w-full resize-none bg-transparent text-sm outline-none" />
        <div className="mt-2 flex justify-end">
          <button onClick={post} disabled={busy || !text.trim()} className="btn-primary h-8 px-4 text-xs disabled:opacity-50">{ar ? "نشر" : "Post"}</button>
        </div>
      </div>
      <p className="mt-2 text-end text-xs text-ink-soft">{ar ? "يراها الموظفون فقط" : "Only you and other staff can see comments"}</p>
      <ul className="mt-3 space-y-3 border-t border-line pt-3">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink-soft" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{e.message}</div>
              <div className="text-xs text-ink-soft">{fmtTime(e.createdAt)}</div>
            </div>
          </li>
        ))}
        {entries.length === 0 && <li className="text-sm text-ink-soft">{ar ? "لا يوجد نشاط بعد." : "No activity yet."}</li>}
      </ul>
    </div>
  );
}

// ---- Cancel modal -----------------------------------------------------------
function CancelModal({ orderNumber, ar, onClose, onDone }: { orderNumber: string; ar: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    const res = await cancelOrder(orderNumber, { reason, restock });
    setBusy(false);
    if (res.ok) onDone(`${ar ? "أُلغي الطلب" : "Order cancelled"}${res.data.restocked > 0 ? ` · ${ar ? "أُعيد" : "restocked"} ${res.data.restocked}` : ""}`);
    else setErr(res.error);
  }
  return (
    <Modal
      title={ar ? "إلغاء الطلب" : "Cancel order"}
      subtitle={`#${orderNumber}`}
      icon={IcX}
      accent="rose"
      size="sm"
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "رجوع" : "Keep order"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "تأكيد الإلغاء" : "Cancel order"}</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={ar ? "السبب (اختياري)" : "Reason (optional)"}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> {ar ? "إعادة الأصناف للمخزون" : "Restock the items"}
        </label>
        {err && <p className="text-sm text-rose-600">{orderErrorText(err, ar)}</p>}
      </div>
    </Modal>
  );
}

// ---- Conversion details modal -----------------------------------------------
function ConversionModal({ conv, ar, lang, fmt, onClose }: { conv: OrderConversion; ar: boolean; lang: "ar" | "en"; fmt: (s: string) => string; onClose: () => void }) {
  return (
    <Modal
      title={ar ? "تفاصيل التحويل" : "Conversion details"}
      icon={IcRedo}
      accent="sky"
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={<button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إغلاق" : "Close"}</button>}
    >
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-page p-4 text-center">
        <div><div className="text-2xl font-bold text-ink">{num(conv.totalOrders, lang)}</div><div className="text-xs text-ink-soft">{ar ? "إجمالي الطلبات" : "Total orders"}</div></div>
        <div><div className="text-2xl font-bold text-ink">{egp(conv.totalSpent, lang)}</div><div className="text-xs text-ink-soft">{ar ? "إجمالي الإنفاق" : "Total spent"}</div></div>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex items-center justify-between"><span className="text-ink-muted">{ar ? "هذا الطلب" : "This order"}</span><span className="font-medium text-ink">{ar ? `رقم ${num(conv.orderIndex, lang)}` : ordinal(conv.orderIndex)}</span></li>
        {conv.firstOrderAt && <li className="flex items-center justify-between"><span className="text-ink-muted">{ar ? "أول طلب" : "First order"}</span><span className="font-medium text-ink">{fmt(conv.firstOrderAt)}</span></li>}
        {conv.lastOrderAt && <li className="flex items-center justify-between"><span className="text-ink-muted">{ar ? "آخر طلب" : "Latest order"}</span><span className="font-medium text-ink">{fmt(conv.lastOrderAt)}</span></li>}
      </ul>
    </Modal>
  );
}

// ---- Assign courier modal ---------------------------------------------------
function AssignCourierModal({ orderNumber, ar, couriers, current, onClose, onDone }: {
  orderNumber: string; ar: boolean; couriers: Courier[]; current: Shipment | null; onClose: () => void; onDone: () => void;
}) {
  const active = couriers.filter((c) => c.active);
  const [courierId, setCourierId] = useState(current?.courierId ?? active[0]?.id ?? "");
  const [fee, setFee] = useState(String(current?.fee ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!courierId) { setErr(ar ? "اختاري مندوباً." : "Pick a courier."); return; }
    setBusy(true); setErr(null);
    const res = await assignOrderToCourier(orderNumber, courierId, Number(fee) || 0);
    setBusy(false);
    if (res.ok) onDone();
    else setErr(res.error === "courier_not_found" ? (ar ? "المندوب غير موجود." : "Courier not found.") : res.error === "migration_missing" ? (ar ? "شغّلي ترحيل 0045." : "Run migration 0045.") : (ar ? "تعذّر التعيين." : "Couldn't assign."));
  }

  return (
    <Modal
      title={ar ? "تعيين مندوب" : "Assign a courier"}
      subtitle={`#${orderNumber}`}
      icon={IcCourier}
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "تعيين" : "Assign"}</button>
        </>
      }
    >
      {active.length === 0 ? (
        <p className="text-sm text-ink-soft">{ar ? "لا يوجد مندوبون نشطون. أضيفيهم من صفحة المندوبين." : "No active couriers — add them from the Couriers page."}</p>
      ) : (
        <div className="space-y-3">
          <Field label={ar ? "المندوب" : "Courier"}>
            <select value={courierId} onChange={(e) => setCourierId(e.target.value)} className={fieldClass}>
              {active.map((c) => <option key={c.id} value={c.id}>{c.name}{c.zone ? ` · ${c.zone}` : ""}</option>)}
            </select>
          </Field>
          <Field label={ar ? "أجر التوصيل" : "Delivery fee"} hint={ar ? "يُخصم من صافي المحاسبة عند التأكيد" : "Netted off in accounting on confirm"}>
            <input value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" dir="ltr" className={fieldClass} />
          </Field>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>
      )}
    </Modal>
  );
}

// ---- Return / exchange modal ------------------------------------------------
function ReturnModal({ orderNumber, ar, lang, onClose, onDone }: {
  orderNumber: string; ar: boolean; lang: "ar" | "en"; onClose: () => void; onDone: (summary: OrderReturnSummary) => void;
}) {
  const [kind, setKind] = useState<"return" | "exchange">("return");
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [stock, setStock] = useState<InventoryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [repl, setRepl] = useState<{ item: InventoryItem; qty: number }[]>([]);

  useEffect(() => {
    (async () => {
      const res = await getReturnableLines(orderNumber);
      if (res.ok) setLines(res.data.filter((l) => l.returnable > 0));
      else setErr(res.error);
      setLoading(false);
    })();
  }, [orderNumber]);

  async function ensureStock() { if (!stock) { const res = await listInventory(); if (res.ok) setStock(res.data); } }
  const availableOf = (it: InventoryItem) => it.levels.reduce((s, l) => s + Math.max(0, l.available), 0);

  const searchResults = useMemo(() => {
    if (!stock) return [];
    const q = search.trim().toLowerCase();
    return stock
      .filter((it) => availableOf(it) > 0 && (it.status ?? "active") === "active")
      .filter((it) => !q || it.productName.toLowerCase().includes(q) || (it.sku ?? "").toLowerCase().includes(q) || (it.variantTitle ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [stock, search]);

  const returnedValue = lines.reduce((s, l) => s + (qty[l.orderItemId] ?? 0) * l.price, 0);
  const replacementValue = repl.reduce((s, r) => s + r.qty * (r.item.price ?? 0), 0);
  const diff = replacementValue - returnedValue;
  const refundPreview = kind === "return" ? returnedValue : diff < 0 ? -diff : 0;
  const extraPreview = kind === "exchange" && diff > 0 ? diff : 0;
  const chosenCount = lines.reduce((s, l) => s + (qty[l.orderItemId] ?? 0), 0);

  function addRepl(it: InventoryItem) {
    setRepl((prev) => {
      const found = prev.find((r) => r.item.id === it.id);
      if (found) return prev.map((r) => (r.item.id === it.id ? { ...r, qty: Math.min(r.qty + 1, availableOf(it)) } : r));
      return [...prev, { item: it, qty: 1 }];
    });
    setSearch("");
  }

  async function submit() {
    if (chosenCount <= 0) { setErr("no_items"); return; }
    if (kind === "exchange" && repl.length === 0) { setErr("no_replacement"); return; }
    setBusy(true);
    setErr(null);
    const res = await createOrderReturn(orderNumber, {
      kind,
      returnLines: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: qty[l.orderItemId] ?? 0 })).filter((l) => l.quantity > 0),
      replacementLines: repl.map((r) => ({ itemId: r.item.id, quantity: r.qty })),
      reason,
      note,
    });
    setBusy(false);
    if (res.ok) onDone(res.data);
    else setErr(res.error);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="text-base font-semibold text-ink">{ar ? "إرجاع أو استبدال" : "Return or exchange"}</div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0"><IcX className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="inline-flex rounded-xl border border-line p-0.5">
            {(["return", "exchange"] as const).map((k) => (
              <button key={k} onClick={() => { setKind(k); if (k === "exchange") ensureStock(); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-brand-600 text-white" : "text-ink-muted"}`}>
                {k === "return" ? (ar ? "إرجاع" : "Return") : (ar ? "استبدال" : "Exchange")}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "الأصناف المُرتجعة" : "Items coming back"}</div>
            {loading ? <div className="text-sm text-ink-soft">…</div> : lines.length === 0 ? (
              <div className="rounded-lg bg-surface-page px-3 py-3 text-sm text-ink-soft">{ar ? "لا يوجد ما يُرتجع في هذا الطلب." : "Nothing left to return on this order."}</div>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.orderItemId} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm text-ink">{l.productName}</div>
                      <div className="text-xs text-ink-soft">{egp(l.price, lang)} · {ar ? `متاح ${num(l.returnable, lang)}` : `${l.returnable} returnable`}</div>
                    </div>
                    <input type="number" min={0} max={l.returnable} value={qty[l.orderItemId] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [l.orderItemId]: Math.max(0, Math.min(Number(e.target.value) || 0, l.returnable)) }))} className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {kind === "exchange" && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">{ar ? "البدائل" : "Replacements"}</div>
              {repl.length > 0 && (
                <div className="mb-2 space-y-2">
                  {repl.map((r) => (
                    <div key={r.item.id} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm text-ink">{r.item.productName}</div>
                        <div className="text-xs text-ink-soft">{egp(r.item.price ?? 0, lang)} · {ar ? `متاح ${num(availableOf(r.item), lang)}` : `${availableOf(r.item)} in stock`}</div>
                      </div>
                      <input type="number" min={1} max={availableOf(r.item)} value={r.qty} onChange={(e) => setRepl((prev) => prev.map((x) => x.item.id === r.item.id ? { ...x, qty: Math.max(1, Math.min(Number(e.target.value) || 1, availableOf(r.item))) } : x))} className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm" />
                      <button onClick={() => setRepl((prev) => prev.filter((x) => x.item.id !== r.item.id))} className="text-rose-500"><IcX className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <input value={search} onFocus={ensureStock} onChange={(e) => setSearch(e.target.value)} placeholder={ar ? "ابحثي عن منتج بديل…" : "Search a replacement product…"} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
              {search && (
                <div className="mt-1 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line p-1">
                  {!stock ? <div className="px-2 py-2 text-sm text-ink-soft">…</div> : searchResults.length === 0 ? <div className="px-2 py-2 text-sm text-ink-soft">{ar ? "لا نتائج" : "No matches"}</div> : (
                    searchResults.map((it) => (
                      <button key={it.id} onClick={() => addRepl(it)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-surface-page">
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm text-ink">{it.productName}</div>
                          <div className="text-xs text-ink-soft">{egp(it.price ?? 0, lang)} · {ar ? `متاح ${num(availableOf(it), lang)}` : `${availableOf(it)} in stock`}</div>
                        </div>
                        <span className="text-xs text-brand-600">{ar ? "إضافة" : "Add"}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "السبب" : "Reason"}</span><input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "ملاحظة" : "Note"}</span><input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" /></label>
          </div>

          <div className="space-y-1.5 rounded-xl bg-surface-page px-3 py-2.5 text-sm">
            <SummaryRow label={ar ? "قيمة المُرتجع" : "Returned value"} value={egp(returnedValue, lang)} muted />
            {kind === "exchange" && <SummaryRow label={ar ? "قيمة البديل" : "Replacement value"} value={egp(replacementValue, lang)} muted />}
            {refundPreview > 0 && <SummaryRow label={ar ? "استرجاع للعميل" : "Refund to customer"} value={egp(refundPreview, lang)} bold />}
            {extraPreview > 0 && <SummaryRow label={ar ? "مستحق على العميل" : "Customer owes"} value={egp(extraPreview, lang)} bold />}
          </div>

          {err && <p className="text-xs text-rose-600">{orderErrorText(err, ar)}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <span className="text-xs text-ink-soft">{ar ? "سيُعاد للمخزون فور التأكيد." : "Restocks on confirm."}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
            <button onClick={submit} disabled={busy || chosenCount <= 0} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">{busy ? "…" : kind === "return" ? (ar ? "تأكيد الإرجاع" : "Confirm return") : (ar ? "تأكيد الاستبدال" : "Confirm exchange")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
