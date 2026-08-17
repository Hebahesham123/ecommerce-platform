"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { getOrderByNumber, setOrderExperience } from "../../actions";
import { DELIVERY_SLOTS } from "@/lib/offers";

type OrderRow = Record<string, unknown>;
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function OrderConfirmationPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<Date[]>([]);
  const [dDate, setDDate] = useState<string | null>(null);
  const [dSlot, setDSlot] = useState<string | null>(null);
  const [dSaved, setDSaved] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [rSaved, setRSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getOrderByNumber(number);
      if (res.ok) setOrder(res.data);
      setLoading(false);
    })();
  }, [number]);

  useEffect(() => {
    const base = new Date();
    const out: Date[] = [];
    for (let i = 1; i <= 5; i++) { const d = new Date(base); d.setDate(base.getDate() + i); out.push(d); }
    setDays(out);
  }, []);

  const items = (order?.store_order_items as OrderRow[]) ?? [];
  const subtotal = Number(order?.subtotal ?? 0);
  const total = Number(order?.total ?? 0);
  const discount = Math.max(0, subtotal - total);
  const fullName = String(order?.customer_name ?? "");
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : (ar ? "عزيزتي" : "there");
  const phone = String(order?.phone ?? "");

  const delivery = useMemo(() => {
    const created = order?.created_at ? new Date(String(order.created_at)) : new Date();
    const fmt = (d: Date) => d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
    const d1 = new Date(created); d1.setDate(created.getDate() + 2);
    const d2 = new Date(created); d2.setDate(created.getDate() + 4);
    return `${fmt(d1)} – ${fmt(d2)}`;
  }, [order, ar]);

  async function saveDelivery() {
    if (!dDate || !dSlot) return;
    const res = await setOrderExperience(number, { deliveryDate: dDate, deliverySlot: dSlot });
    if (res.ok) setDSaved(true);
  }
  async function saveRating(r: number) {
    setRating(r);
    const res = await setOrderExperience(number, { rating: r });
    if (res.ok) setRSaved(true);
  }

  if (loading) return <div className="py-20 text-center text-slate-400">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;

  return (
    <div className="mx-auto max-w-2xl py-6">
      {/* VIP hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 to-pink-600 px-8 py-12 text-center text-white shadow-[0_24px_60px_-24px_rgba(225,29,72,0.65)]">
        {/* soft decorative glows (no emoji clutter) */}
        <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
            <span className="text-amber-200">✦</span>{ar ? "عميلة مميّزة" : "VIP member"}
          </span>
          <div className="relative mx-auto mt-7 h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-white/25 blur-md" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {ar ? `شكراً لكِ، ${displayName}` : `Thank you, ${displayName}`}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/85">
            {ar ? "أنتِ من أعزّ عميلاتنا، وطلبك يحظى بأولوية خاصة — جهّزناه بعناية فائقة." : "You're one of our most valued customers. Your order gets priority care — prepared just for you."}
          </p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <span className="text-white/70">{ar ? "رقم الطلب" : "Order"}</span>
            <span className="font-mono font-semibold tracking-wide">#{number}</span>
          </div>
        </div>
      </div>

      {/* Preferred delivery date & time */}
      <div className="mt-4 rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">🚚 {ar ? "متى تحبّي نوصّل طلبك؟" : "When would you like it delivered?"}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{ar ? "اختاري اليوم والوقت الأنسب لكِ — والباقي علينا." : "Pick the day & time that suits you best — we'll handle the rest."}</p>
        {!dSaved ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {days.map((d) => {
                const v = ymd(d);
                const active = dDate === v;
                return (
                  <button key={v} onClick={() => setDDate(v)} className={`rounded-xl border-2 px-3 py-2 text-center text-xs transition ${active ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-700 hover:border-rose-200"}`}>
                    <div className="font-semibold">{d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "short" })}</div>
                    <div className="text-slate-400">{d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" })}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DELIVERY_SLOTS.map((s) => {
                const active = dSlot === s.id;
                return (
                  <button key={s.id} onClick={() => setDSlot(s.id)} className={`rounded-xl border-2 px-2 py-2 text-center text-xs font-medium transition ${active ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-700 hover:border-rose-200"}`}>
                    {ar ? s.ar : s.en}
                  </button>
                );
              })}
            </div>
            <button onClick={saveDelivery} disabled={!dDate || !dSlot} className="mt-4 w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
              {ar ? "تأكيد موعد التوصيل" : "Confirm delivery time"}
            </button>
          </>
        ) : (
          <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
            ✓ {ar ? "تم! سنوصّل طلبك في الموعد الذي اخترتيه 💚" : "Done! We'll deliver at the time you chose 💚"}
          </div>
        )}
      </div>

      {/* Star rating */}
      <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-5 text-center shadow-sm">
        <h2 className="text-base font-bold text-slate-900">⭐ {ar ? "كيف كانت تجربتك معنا؟" : "How was your experience?"}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{ar ? "رأيك يهمّنا جداً — قيّمي متجرنا" : "Your opinion means the world to us — rate our store"}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => {
            const on = (hover || rating) >= i;
            return (
              <button
                key={i}
                onClick={() => saveRating(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${i} stars`}
                className={`text-4xl transition-transform hover:scale-110 ${on ? "text-amber-400" : "text-slate-300"}`}
              >
                ★
              </button>
            );
          })}
        </div>
        {rSaved && (
          <p className="mt-3 text-sm font-semibold text-rose-600">
            {rating >= 4 ? (ar ? "شكراً لك من القلب! 💖 سعداء بإسعادك." : "Thank you so much! 💖 We're thrilled you loved it.") : (ar ? "شكراً لتقييمك — سنعمل على أن نكون أفضل لكِ. 💗" : "Thanks for the feedback — we'll do even better for you. 💗")}
          </p>
        )}
      </div>

      {/* Order details */}
      {order && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{ar ? "تفاصيل الطلب" : "Order details"}</h2>
            <span className="text-xs text-slate-500">🚚 {ar ? "الوصول المتوقع" : "Arrives"} {delivery}</span>
          </div>
          <div className="space-y-3">
            {items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {i.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={String(i.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-slate-900">{String(i.product_name)}</div>
                  <div className="text-xs text-slate-500">{i.variant_title ? `${i.variant_title} · ` : ""}{num(Number(i.quantity), lang)} ×</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">{egp(Number(i.price) * Number(i.quantity), lang)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><span>{egp(subtotal, lang)}</span></div>
            {discount > 0 && <div className="flex justify-between text-emerald-600"><span>{ar ? "الخصم" : "Discount"}</span><span>−{egp(discount, lang)}</span></div>}
            <div className="flex justify-between text-slate-600"><span>{ar ? "الشحن" : "Shipping"}</span><span className="font-medium uppercase text-emerald-600">{ar ? "مجاني" : "Free"}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>{ar ? "الإجمالي" : "Total"}</span><span>{egp(total, lang)}</span></div>
            <div className="flex justify-between pt-1 text-xs text-slate-400"><span>{ar ? "الدفع" : "Payment"}</span><span>💵 {ar ? "عند الاستلام" : "Cash on delivery"}</span></div>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{fullName}</span> · <span dir="ltr">{phone}</span>
            <div className="text-xs text-slate-400">{[order.address, order.city, order.governorate].filter(Boolean).join("، ")}</div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col items-center gap-2">
        <Link href="/store" className="inline-flex rounded-xl bg-rose-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-rose-700">{ar ? "متابعة التسوّق" : "Continue shopping"}</Link>
        <span className="text-xs text-slate-400">{ar ? "احتفظي برقم الطلب للمتابعة" : "Keep your order number for tracking"}</span>
      </div>
    </div>
  );
}
