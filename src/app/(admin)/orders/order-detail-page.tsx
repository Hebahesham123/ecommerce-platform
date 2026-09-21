"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { slotLabel } from "@/lib/offers";
import { IcCash, IcCourier, IcChevron, IcX, IcRedo } from "@/components/icons";
import { kindLabel, statusLabel } from "@/lib/returns";
import type { ReturnRequest } from "@/lib/returns";
import type { InventoryItem } from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import {
  getOrderDetail,
  getOrderReturns,
  getReturnableLines,
  createOrderReturn,
  fulfillOrder,
  undoFulfillment,
  type OrderDetail,
  type OrderReturnSummary,
} from "./actions";
import type { ReturnableLine } from "@/lib/returns-service";
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
 * The full-page order view — a Shopify-style order screen at its own URL, so a
 * click on a row opens a page a merchant can bookmark, share and go Back from,
 * rather than a drawer that vanishes. It carries everything the drawer did
 * (fulfillment, the money ledger, the customer) plus the one thing it couldn't:
 * opening a return or an exchange against the order, in place.
 */
export function OrderDetailPage({ orderNumber, basePath }: { orderNumber: string; basePath: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [d, setD] = useState<OrderDetail | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "collect" | "refund" | "fulfill" | "return">(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [detail, rq] = await Promise.all([getOrderDetail(orderNumber), getOrderReturns(orderNumber)]);
    if (detail.ok) {
      setD(detail.data);
      setErr(null);
    } else setErr(detail.error);
    if (rq.ok) setReturns(rq.data);
    setLoading(false);
  }, [orderNumber]);
  useEffect(() => {
    load();
  }, [load]);

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString(ar ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtTime = (s: string) =>
    new Date(s).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const payStatus = d?.paymentStatus ?? "pending";
  const fulStatus = d?.fulfillmentStatus ?? "unfulfilled";
  const pm = paymentMeta(payStatus);
  const fm = fulfillMeta(fulStatus);
  const remainingTotal = d ? d.items.reduce((s, li) => s + (li.quantity - li.fulfilledQuantity), 0) : 0;

  async function fulfillAll() {
    const res = await fulfillOrder(orderNumber);
    if (!res.ok) setErr(res.error);
    await load();
  }
  async function undo(id: string) {
    await undoFulfillment(id);
    await load();
  }

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
          </div>
          {d && <p className="mt-1 text-xs text-ink-soft">{fmt(d.createdAt)}</p>}
        </div>
        {d && (
          <div className="flex items-center gap-2">
            <button onClick={() => setModal("return")} className="btn-outline h-9">
              <IcRedo className="h-4 w-4" /> {ar ? "إرجاع أو استبدال" : "Return or exchange"}
            </button>
          </div>
        )}
      </div>

      {err && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{orderErrorText(err, ar)}</div>
      )}
      {flash && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{flash}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Fulfillment */}
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCourier className="h-4 w-4 text-ink-soft" />
                {ar ? "التنفيذ" : "Fulfillment"}
              </div>
              <StatusPill label={ar ? fm.ar : fm.en} tone={fm.tone} hollow={fm.hollow} />
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
                              {ar
                                ? `${num(li.fulfilledQuantity, lang)} من ${num(li.quantity, lang)} مُنفّذ`
                                : `${li.fulfilledQuantity} of ${li.quantity} fulfilled`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-end text-sm">
                        <div className="text-ink-muted">
                          {egp(li.price, lang)} × {num(li.quantity, lang)}
                        </div>
                        <div className="font-semibold text-ink">{egp(li.price * li.quantity, lang)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-ink-soft">{ar ? "لا توجد أصناف." : "No line items."}</div>
            )}

            {d && remainingTotal > 0 && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                <button onClick={fulfillAll} className="btn-outline h-9">
                  {ar ? "تنفيذ الكل" : "Fulfill all"}
                </button>
                <button onClick={() => setModal("fulfill")} className="btn-primary h-9">
                  {ar ? "تنفيذ أصناف" : "Fulfill items"}
                </button>
              </div>
            )}

            {d && d.fulfillments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "سجل التنفيذ" : "Fulfillment history"}
                </div>
                <ul className="space-y-2">
                  {d.fulfillments.map((f) => (
                    <li key={f.id} className="rounded-lg bg-surface-page px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-ink">
                          {f.items.reduce((s, i) => s + i.quantity, 0)} {ar ? "قطعة" : "items"} · {fmtTime(f.createdAt)}
                        </span>
                        <button onClick={() => undo(f.id)} className="text-rose-500 hover:underline">
                          {ar ? "تراجع" : "Undo"}
                        </button>
                      </div>
                      {f.tracking && (
                        <div className="mt-0.5 text-ink-soft" dir="ltr">
                          {f.carrier ? `${f.carrier} · ` : ""}{f.tracking}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCash className="h-4 w-4 text-ink-soft" />
                {ar ? "الدفع" : "Payment"}
              </div>
              <StatusPill label={ar ? pm.ar : pm.en} tone={pm.tone} hollow={pm.hollow} />
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <SummaryRow label={ar ? "الإجمالي الفرعي" : "Subtotal"} value={egp(d?.subtotal ?? 0, lang)} />
              <SummaryRow label={ar ? "الشحن" : "Shipping"} value={egp(d?.shipping ?? 0, lang)} muted />
              <div className="my-1 border-t border-line" />
              <SummaryRow label={ar ? "الإجمالي" : "Total"} value={egp(d?.total ?? 0, lang)} bold />
              <SummaryRow label={ar ? "المدفوع" : "Paid"} value={egp(d?.amountPaid ?? 0, lang)} muted />
              <SummaryRow label={ar ? "المتبقي" : "Balance"} value={egp(d?.balance ?? 0, lang)} bold />
            </div>

            {d && d.payments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "سجل المدفوعات" : "Payment history"}
                </div>
                <ul className="space-y-1.5">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        {p.kind === "refund" ? (ar ? "استرجاع" : "Refund") : (ar ? "دفعة" : "Payment")} ·{" "}
                        {methodLabel(p.method, ar)} · {fmtTime(p.createdAt)}
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

            {d && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                {d.amountPaid > 0 && (
                  <button onClick={() => setModal("refund")} className="btn-outline h-9">
                    {ar ? "استرجاع" : "Refund"}
                  </button>
                )}
                {d.balance > 0 && (
                  <button onClick={() => setModal("collect")} className="btn-primary h-9">
                    <IcCash className="h-4 w-4" /> {ar ? "تحصيل الدفع" : "Collect payment"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Returns & exchanges opened on this order */}
          {returns.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                <IcRedo className="h-4 w-4 text-ink-soft" />
                {ar ? "المرتجعات والاستبدالات" : "Returns & exchanges"}
              </div>
              <ul className="divide-y divide-line">
                {returns.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink" dir="ltr">{r.reference}</span>
                        <span className="text-xs text-ink-muted">{kindLabel[r.kind][ar ? "ar" : "en"]}</span>
                        <StatusPill
                          label={statusLabel[r.status][ar ? "ar" : "en"]}
                          tone={r.status === "completed" ? "success" : r.status === "rejected" || r.status === "cancelled" ? "critical" : "warning"}
                        />
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
                            <span className={li.direction === "replacement" ? "text-emerald-700" : "text-rose-600"}>
                              {li.direction === "replacement" ? (ar ? "بديل" : "New") : (ar ? "مرتجع" : "Back")}
                            </span>{" "}
                            {li.productName}
                            {li.variantTitle ? ` · ${li.variantTitle}` : ""}
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
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-ink">{ar ? "العميل" : "Customer"}</div>
            <div className="text-sm font-medium text-ink">{d?.customerName || "—"}</div>
            <div className="mt-0.5 text-sm text-ink-muted" dir="ltr">{d?.phone || ""}</div>

            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {ar ? "عنوان الشحن" : "Shipping address"}
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {[d?.address, d?.city, d?.governorate].filter(Boolean).join("، ") || "—"}
              {(d?.address || d?.city || d?.governorate) ? `، ${ar ? "مصر" : "Egypt"}` : ""}
            </div>

            {(d?.preferredDeliveryDate || d?.preferredDeliverySlot) && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "موعد التوصيل المطلوب" : "Requested delivery"}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {[
                    d?.preferredDeliveryDate
                      ? new Date(d.preferredDeliveryDate).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })
                      : null,
                    slotLabel(d?.preferredDeliverySlot, ar ? "ar" : "en") || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </>
            )}

            {d?.note && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "ملاحظات الطلب" : "Order notes"}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{d.note}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "collect" && d && (
        <PaymentModal
          kind="payment"
          orderNumber={orderNumber}
          defaultAmount={d.balance}
          maxAmount={d.balance}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await load(); }}
        />
      )}
      {modal === "refund" && d && (
        <PaymentModal
          kind="refund"
          orderNumber={orderNumber}
          defaultAmount={d.amountPaid}
          maxAmount={d.amountPaid}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await load(); }}
        />
      )}
      {modal === "fulfill" && d && (
        <FulfillModal
          orderNumber={orderNumber}
          items={d.items}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await load(); }}
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
            setFlash(parts.join(" · "));
            await load();
          }}
        />
      )}
    </div>
  );
}

// ---- Return / exchange modal ------------------------------------------------
function ReturnModal({
  orderNumber,
  ar,
  lang,
  onClose,
  onDone,
}: {
  orderNumber: string;
  ar: boolean;
  lang: "ar" | "en";
  onClose: () => void;
  onDone: (summary: OrderReturnSummary) => void;
}) {
  const [kind, setKind] = useState<"return" | "exchange">("return");
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Exchange replacements, chosen from live stock.
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

  async function ensureStock() {
    if (stock) return;
    const res = await listInventory();
    if (res.ok) setStock(res.data);
  }

  const availableOf = (it: InventoryItem) =>
    it.levels.reduce((s, l) => s + Math.max(0, l.available), 0);

  const searchResults = useMemo(() => {
    if (!stock) return [];
    const q = search.trim().toLowerCase();
    return stock
      .filter((it) => availableOf(it) > 0 && (it.status ?? "active") === "active")
      .filter((it) =>
        !q ||
        it.productName.toLowerCase().includes(q) ||
        (it.sku ?? "").toLowerCase().includes(q) ||
        (it.variantTitle ?? "").toLowerCase().includes(q),
      )
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
          {/* Kind toggle */}
          <div className="inline-flex rounded-xl border border-line p-0.5">
            {(["return", "exchange"] as const).map((k) => (
              <button
                key={k}
                onClick={() => { setKind(k); if (k === "exchange") ensureStock(); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-brand-600 text-white" : "text-ink-muted"}`}
              >
                {k === "return" ? (ar ? "إرجاع" : "Return") : (ar ? "استبدال" : "Exchange")}
              </button>
            ))}
          </div>

          {/* Items to send back */}
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {ar ? "الأصناف المُرتجعة" : "Items coming back"}
            </div>
            {loading ? (
              <div className="text-sm text-ink-soft">…</div>
            ) : lines.length === 0 ? (
              <div className="rounded-lg bg-surface-page px-3 py-3 text-sm text-ink-soft">
                {ar ? "لا يوجد ما يُرتجع في هذا الطلب." : "Nothing left to return on this order."}
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.orderItemId} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm text-ink">{l.productName}</div>
                      <div className="text-xs text-ink-soft">
                        {egp(l.price, lang)} · {ar ? `متاح ${num(l.returnable, lang)}` : `${l.returnable} returnable`}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={l.returnable}
                      value={qty[l.orderItemId] ?? 0}
                      onChange={(e) =>
                        setQty((q) => ({ ...q, [l.orderItemId]: Math.max(0, Math.min(Number(e.target.value) || 0, l.returnable)) }))
                      }
                      className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Replacements (exchange only) */}
          {kind === "exchange" && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                {ar ? "البدائل" : "Replacements"}
              </div>
              {repl.length > 0 && (
                <div className="mb-2 space-y-2">
                  {repl.map((r) => (
                    <div key={r.item.id} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm text-ink">{r.item.productName}</div>
                        <div className="text-xs text-ink-soft">
                          {egp(r.item.price ?? 0, lang)} · {ar ? `متاح ${num(availableOf(r.item), lang)}` : `${availableOf(r.item)} in stock`}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={availableOf(r.item)}
                        value={r.qty}
                        onChange={(e) =>
                          setRepl((prev) => prev.map((x) => x.item.id === r.item.id ? { ...x, qty: Math.max(1, Math.min(Number(e.target.value) || 1, availableOf(r.item))) } : x))
                        }
                        className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                      />
                      <button onClick={() => setRepl((prev) => prev.filter((x) => x.item.id !== r.item.id))} className="text-rose-500">
                        <IcX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                value={search}
                onFocus={ensureStock}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar ? "ابحثي عن منتج بديل…" : "Search a replacement product…"}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
              />
              {search && (
                <div className="mt-1 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line p-1">
                  {!stock ? (
                    <div className="px-2 py-2 text-sm text-ink-soft">…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-ink-soft">{ar ? "لا نتائج" : "No matches"}</div>
                  ) : (
                    searchResults.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => addRepl(it)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-surface-page"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm text-ink">{it.productName}</div>
                          <div className="text-xs text-ink-soft">
                            {egp(it.price ?? 0, lang)} · {ar ? `متاح ${num(availableOf(it), lang)}` : `${availableOf(it)} in stock`}
                          </div>
                        </div>
                        <span className="text-xs text-brand-600">{ar ? "إضافة" : "Add"}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason + note */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "السبب" : "Reason"}</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "ملاحظة" : "Note"}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
            </label>
          </div>

          {/* Money preview */}
          <div className="space-y-1.5 rounded-xl bg-surface-page px-3 py-2.5 text-sm">
            <SummaryRow label={ar ? "قيمة المُرتجع" : "Returned value"} value={egp(returnedValue, lang)} muted />
            {kind === "exchange" && <SummaryRow label={ar ? "قيمة البديل" : "Replacement value"} value={egp(replacementValue, lang)} muted />}
            {refundPreview > 0 && <SummaryRow label={ar ? "استرجاع للعميل" : "Refund to customer"} value={egp(refundPreview, lang)} bold />}
            {extraPreview > 0 && <SummaryRow label={ar ? "مستحق على العميل" : "Customer owes"} value={egp(extraPreview, lang)} bold />}
          </div>

          {err && <p className="text-xs text-rose-600">{orderErrorText(err, ar)}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <span className="text-xs text-ink-soft">
            {ar ? "سيُعاد للمخزون فور التأكيد." : "Restocks on confirm."}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
            <button onClick={submit} disabled={busy || chosenCount <= 0} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">
              {busy ? "…" : kind === "return" ? (ar ? "تأكيد الإرجاع" : "Confirm return") : (ar ? "تأكيد الاستبدال" : "Confirm exchange")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
