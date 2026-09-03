"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp } from "@/lib/i18n";
import {
  formatCountdown,
  kindLabel,
  msLeftInWindow,
  RETURN_WINDOW_DAYS,
  settle,
  statusLabel,
  type RequestKind,
  type ReturnRequest,
} from "@/lib/returns";
import { listStoreProducts, type StoreProduct } from "../actions";
import {
  listMyRequests,
  listReturnableOrders,
  submitReturnRequest,
  type ReturnableOrder,
} from "./actions";

/**
 * One form for both jobs: a return picks only the goods going back, an exchange
 * also picks what comes instead and settles the difference. They share every
 * other concern — the 14-day clock, the order picker, the quantity rules — so
 * splitting them into two pages would mean maintaining the same screen twice.
 */
export default function RequestForm({
  kind,
  onBack,
  signInHref = "/store/login",
}: {
  kind: RequestKind;
  /** Rendered as a "back" link when the form is opened from the chooser. */
  onBack?: () => void;
  /** Where a signed-out shopper is sent, so they return here afterwards. */
  signInHref?: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const isExchange = kind === "exchange";

  const [orders, setOrders] = useState<ReturnableOrder[]>([]);
  const [mine, setMine] = useState<ReturnRequest[]>([]);
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [orderId, setOrderId] = useState<string>("");
  const [qty, setQty] = useState<Record<string, number>>({}); // orderItemId → qty back
  const [picked, setPicked] = useState<Record<string, number>>({}); // itemId → qty out
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Re-render once a second so the countdown actually counts.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const [res, requests] = await Promise.all([listReturnableOrders(), listMyRequests()]);
      if (!res.ok) {
        if (res.error === "not_signed_in") setSignedOut(true);
        else setErr(res.error);
      } else {
        setOrders(res.data);
        setOrderId((cur) => cur || res.data[0]?.orderId || "");
      }
      if (requests.ok) setMine(requests.data);
      setLoading(false);
    })();
  }, []);

  // The catalog is only needed to pick a replacement, so an ordinary return
  // never pays for loading it.
  useEffect(() => {
    if (!isExchange) return;
    (async () => {
      const res = await listStoreProducts();
      if (res.ok) setCatalog(res.data);
    })();
  }, [isExchange]);

  const order = orders.find((o) => o.orderId === orderId) ?? null;
  const msLeft = order ? msLeftInWindow(order.createdAt, new Date(now)) : 0;
  const expired = order ? msLeft <= 0 : false;

  const returnedValue = useMemo(() => {
    if (!order) return 0;
    return order.lines.reduce((s, l) => s + l.price * (qty[l.orderItemId] ?? 0), 0);
  }, [order, qty]);

  const variants = useMemo(() => {
    // Flatten to buyable variants: an exchange swaps a specific size, not a
    // vague "product".
    const out: { id: string; label: string; price: number; available: number; image: string | null }[] = [];
    for (const p of catalog) {
      for (const v of p.variants) {
        if (v.price == null || v.available <= 0) continue;
        out.push({
          id: v.id,
          label: v.variantTitle ? `${p.name} — ${v.variantTitle}` : p.name,
          price: v.price,
          available: v.available,
          image: p.image,
        });
      }
    }
    return out;
  }, [catalog]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle ? variants.filter((v) => v.label.toLowerCase().includes(needle)) : variants;
    return list.slice(0, 40);
  }, [variants, search]);

  const replacementValue = useMemo(
    () => variants.reduce((s, v) => s + v.price * (picked[v.id] ?? 0), 0),
    [variants, picked],
  );

  const money = isExchange
    ? settle(returnedValue, replacementValue)
    : { difference: -returnedValue, refundAmount: returnedValue, extraAmount: 0 };

  const anyReturned = Object.values(qty).some((q) => q > 0);
  const anyPicked = Object.values(picked).some((q) => q > 0);
  const canSubmit = Boolean(order) && !expired && anyReturned && (!isExchange || anyPicked) && !busy;

  async function submit() {
    if (!order) return;
    setErr(null);
    setBusy(true);
    const res = await submitReturnRequest({
      kind,
      orderId: order.orderId,
      returnLines: Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      replacementLines: isExchange
        ? Object.entries(picked)
            .filter(([, q]) => q > 0)
            .map(([itemId, quantity]) => ({ itemId, quantity }))
        : [],
      reason,
      note,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.error === "window_expired"
          ? ar
            ? "انتهت مهلة الـ ١٤ يوماً لهذا الطلب"
            : `The ${RETURN_WINDOW_DAYS}-day window for this order has closed`
          : res.error === "already_requested"
            ? ar
              ? "تم طلب استرجاع هذه القطعة بالفعل"
              : "That item is already part of another request"
            : ar
              ? "تعذّر إرسال الطلب"
              : "Could not submit the request",
      );
      return;
    }
    setDone(res.data.reference);
    // Reload so the used-up quantities and the new request both show.
    const [fresh, requests] = await Promise.all([listReturnableOrders(), listMyRequests()]);
    if (fresh.ok) setOrders(fresh.data);
    if (requests.ok) setMine(requests.data);
    setQty({});
    setPicked({});
    setReason("");
    setNote("");
  }

  const title = isExchange
    ? ar ? "طلب استبدال" : "Request an exchange"
    : ar ? "طلب استرجاع" : "Request a return";

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  }

  if (signedOut) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <span aria-hidden>{ar ? "\u2192" : "\u2190"}</span>
            {ar ? "\u0631\u062c\u0648\u0639" : "Back"}
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {ar
            ? "سجّلي الدخول برقم هاتفك لعرض طلباتك وبدء الاسترجاع أو الاستبدال."
            : "Sign in with your phone number to see your orders and start a request."}
        </p>
        <Link href={signInHref} target="_top" className="btn-primary mt-6 inline-flex px-6 py-3">
          {ar ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <span aria-hidden>{ar ? "\u2192" : "\u2190"}</span>
          {ar ? "\u0631\u062c\u0648\u0639" : "Back"}
        </button>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {ar
          ? `يمكنك طلب ${isExchange ? "الاستبدال" : "الاسترجاع"} خلال ${RETURN_WINDOW_DAYS} يوماً من تاريخ الطلب.`
          : `You can request ${isExchange ? "an exchange" : "a return"} within ${RETURN_WINDOW_DAYS} days of your order.`}
      </p>

      {done && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">
            {ar ? "تم استلام طلبك" : "Request received"} — <span dir="ltr">{done}</span>
          </div>
          <p className="mt-1">
            {ar
              ? "سنراجعه ونحدّث حالته هنا."
              : "We'll review it and update its status here."}
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">
            {ar
              ? `لا توجد طلبات مؤهلة. تنتهي المهلة بعد ${RETURN_WINDOW_DAYS} يوماً من تاريخ الشراء.`
              : `No eligible orders. The window closes ${RETURN_WINDOW_DAYS} days after purchase.`}
          </p>
          <Link href="/shop" className="btn-primary mt-5 inline-flex px-5 py-2.5">
            {ar ? "تسوّقي الآن" : "Continue shopping"}
          </Link>
        </div>
      ) : (
        <>
          {/* ---- Order picker + live countdown ---- */}
          <section className="mt-6 rounded-2xl border border-line p-4">
            <label className="text-sm font-semibold text-ink">{ar ? "اختاري الطلب" : "Choose the order"}</label>
            <select
              value={orderId}
              onChange={(e) => { setOrderId(e.target.value); setQty({}); }}
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-500"
            >
              {orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>
                  {o.orderNumber} · {new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")} · {egp(o.total, lang)}
                </option>
              ))}
            </select>

            {order && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  expired
                    ? "bg-rose-50 text-rose-700"
                    : msLeft < 2 * 24 * 60 * 60 * 1000
                      ? "bg-amber-50 text-amber-800"
                      : "bg-surface-page text-ink-muted"
                }`}
              >
                <span aria-hidden>⏳</span>
                <span className="font-medium" dir={ar ? "rtl" : "ltr"}>
                  {formatCountdown(msLeft, ar)}
                </span>
                <span className="text-xs opacity-75">
                  {ar ? "من مهلة" : "of the"} {RETURN_WINDOW_DAYS} {ar ? "يوماً" : "day window"}
                </span>
              </div>
            )}
          </section>

          {/* ---- What goes back ---- */}
          {order && (
            <section className="mt-4 rounded-2xl border border-line p-4">
              <h2 className="text-sm font-semibold text-ink">
                {ar ? "ما الذي تريدين إرجاعه؟" : "What are you sending back?"}
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {order.lines.map((l) => {
                  const chosen = qty[l.orderItemId] ?? 0;
                  const soldOut = l.returnable <= 0;
                  return (
                    <li key={l.orderItemId} className={`flex items-center gap-3 py-3 ${soldOut ? "opacity-50" : ""}`}>
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                        {l.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">{l.productName}</div>
                        {l.variantTitle && <div className="text-xs text-ink-soft">{l.variantTitle}</div>}
                        <div className="text-xs text-ink-soft">
                          {egp(l.price, lang)} ·{" "}
                          {soldOut
                            ? ar ? "مطلوب استرجاعه بالفعل" : "already requested"
                            : `${ar ? "متاح للإرجاع" : "up to"} ${l.returnable}`}
                        </div>
                      </div>
                      <div className="flex items-center rounded-lg border border-line">
                        <button
                          type="button"
                          onClick={() => setQty((q) => ({ ...q, [l.orderItemId]: Math.max(0, chosen - 1) }))}
                          disabled={soldOut || chosen <= 0}
                          className="px-2.5 py-1 text-ink-muted disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{chosen}</span>
                        <button
                          type="button"
                          onClick={() => setQty((q) => ({ ...q, [l.orderItemId]: Math.min(l.returnable, chosen + 1) }))}
                          disabled={soldOut || chosen >= l.returnable}
                          className="px-2.5 py-1 text-ink-muted disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ---- What comes instead (exchange only) ---- */}
          {isExchange && order && (
            <section className="mt-4 rounded-2xl border border-line p-4">
              <h2 className="text-sm font-semibold text-ink">
                {ar ? "ما الذي تريدينه بدلاً منه؟" : "What would you like instead?"}
              </h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar ? "ابحثي عن منتج…" : "Search products…"}
                className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand-500"
              />
              {catalog.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-soft">{ar ? "جارٍ تحميل المنتجات…" : "Loading products…"}</p>
              ) : (
                <ul className="mt-3 max-h-[360px] divide-y divide-line overflow-y-auto">
                  {shown.map((v) => {
                    const chosen = picked[v.id] ?? 0;
                    return (
                      <li key={v.id} className="flex items-center gap-3 py-2.5">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                          {v.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{v.label}</div>
                          <div className="text-xs text-ink-soft">
                            {egp(v.price, lang)} · {v.available} {ar ? "متاح" : "in stock"}
                          </div>
                        </div>
                        <div className="flex items-center rounded-lg border border-line">
                          <button
                            type="button"
                            onClick={() => setPicked((p) => ({ ...p, [v.id]: Math.max(0, chosen - 1) }))}
                            disabled={chosen <= 0}
                            className="px-2.5 py-1 text-ink-muted disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{chosen}</span>
                          <button
                            type="button"
                            onClick={() => setPicked((p) => ({ ...p, [v.id]: Math.min(v.available, chosen + 1) }))}
                            disabled={chosen >= v.available}
                            className="px-2.5 py-1 text-ink-muted disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {shown.length === 0 && (
                    <li className="py-6 text-center text-sm text-ink-soft">{ar ? "لا توجد نتائج" : "No matches"}</li>
                  )}
                </ul>
              )}
            </section>
          )}

          {/* ---- The difference ---- */}
          {order && (
            <section className="mt-4 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{ar ? "قيمة المرتجع" : "Value coming back"}</span>
                <span className="font-medium text-ink">{egp(returnedValue, lang)}</span>
              </div>
              {isExchange && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{ar ? "قيمة البديل" : "Value going out"}</span>
                  <span className="font-medium text-ink">{egp(replacementValue, lang)}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-base font-semibold text-ink">
                  {money.extraAmount > 0
                    ? ar ? "المبلغ المطلوب دفعه" : "You pay"
                    : ar ? "المبلغ المسترد لكِ" : "We refund you"}
                </span>
                <span
                  className={`text-xl font-bold ${money.extraAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {egp(money.extraAmount > 0 ? money.extraAmount : money.refundAmount, lang)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                {money.extraAmount > 0
                  ? ar ? "يُحصَّل عند التسليم." : "Collected on delivery."
                  : ar ? "يُرد بعد استلام القطع ومراجعتها." : "Refunded once we receive and check the items."}
              </p>
            </section>
          )}

          {/* ---- Why ---- */}
          {order && (
            <section className="mt-4 rounded-2xl border border-line p-4">
              <label className="text-sm font-semibold text-ink">{ar ? "السبب" : "Reason"}</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-500"
              >
                <option value="">{ar ? "اختاري سبباً" : "Choose a reason"}</option>
                {(ar
                  ? ["المقاس غير مناسب", "المنتج مختلف عن الوصف", "به عيب", "غيّرت رأيي", "سبب آخر"]
                  : ["Wrong size", "Not as described", "Damaged or faulty", "Changed my mind", "Other"]
                ).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={ar ? "تفاصيل إضافية (اختياري)" : "Anything else we should know? (optional)"}
                className="mt-3 w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-brand-500"
              />
            </section>
          )}

          {err && <p className="mt-4 text-sm font-medium text-rose-600">{err}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="btn-primary mt-5 h-12 w-full justify-center text-base disabled:opacity-50"
          >
            {busy
              ? ar ? "جارٍ الإرسال…" : "Submitting…"
              : expired
                ? ar ? "انتهت المهلة" : "Window closed"
                : ar ? "إرسال الطلب" : "Submit request"}
          </button>
        </>
      )}

      {/* ---- Their own history ---- */}
      {mine.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-ink">
            {ar ? "طلباتك السابقة" : "Your requests"}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-semibold text-ink" dir="ltr">{r.reference}</span>
                <span className="text-ink-muted">{kindLabel[r.kind][ar ? "ar" : "en"]}</span>
                <span className="text-xs text-ink-soft" dir="ltr">#{r.orderNumber}</span>
                <span className="ms-auto rounded-full bg-surface-page px-2.5 py-1 text-xs font-medium text-ink-muted">
                  {statusLabel[r.status][ar ? "ar" : "en"]}
                </span>
                <span className="font-medium text-ink">
                  {r.extraAmount > 0
                    ? `+${egp(r.extraAmount, lang)}`
                    : `−${egp(r.refundAmount, lang)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
