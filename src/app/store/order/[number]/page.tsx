"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { getOrderByNumber, setCustomerBirthday } from "../../actions";

type OrderRow = Record<string, unknown>;

export default function OrderConfirmationPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [bday, setBday] = useState("");
  const [bdaySaved, setBdaySaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getOrderByNumber(number);
      if (res.ok) setOrder(res.data);
      setLoading(false);
    })();
  }, [number]);

  const items = (order?.store_order_items as OrderRow[]) ?? [];
  const subtotal = Number(order?.subtotal ?? 0);
  const total = Number(order?.total ?? 0);
  const discount = Math.max(0, subtotal - total);
  const name = String(order?.customer_name ?? "");
  const phone = String(order?.phone ?? "");

  // Estimated delivery window: 2–4 days after the order was placed.
  const delivery = useMemo(() => {
    const created = order?.created_at ? new Date(String(order.created_at)) : new Date();
    const fmt = (d: Date) => d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
    const d1 = new Date(created); d1.setDate(created.getDate() + 2);
    const d2 = new Date(created); d2.setDate(created.getDate() + 4);
    return `${fmt(d1)} – ${fmt(d2)}`;
  }, [order, ar]);

  const stages = ar
    ? ["تم الطلب", "قيد التأكيد", "خرج للتوصيل", "تم التسليم"]
    : ["Placed", "Confirming", "Out for delivery", "Delivered"];
  const lifecycle = String(order?.lifecycle ?? "placed");
  const stageIdx = lifecycle === "completed" ? 3 : lifecycle === "shipped" ? 2 : lifecycle === "confirmed" ? 1 : 0;

  async function saveBirthday() {
    if (!bday) return;
    const res = await setCustomerBirthday(phone, bday);
    if (res.ok) setBdaySaved(true);
  }

  if (loading) return <div className="py-20 text-center text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;

  return (
    <div className="mx-auto max-w-2xl py-6">
      {/* Success hero */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-emerald-50 to-white p-8 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center gap-6 text-xl">
          {["🎉", "✨", "🎊", "💝", "✨", "🎉"].map((e, i) => (
            <span key={i} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>{e}</span>
          ))}
        </div>
        <div className="animate-pop-in mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl text-white shadow-pop">✓</div>
        <h1 className="mt-4 text-2xl font-bold text-ink">
          {ar ? `شكراً لك${name ? `، ${name}` : ""}! 🎉` : `Thank you${name ? `, ${name}` : ""}! 🎉`}
        </h1>
        <p className="mt-1 text-ink-muted">
          {ar ? "تم استلام طلبك بنجاح" : "Your order is confirmed"} · <span className="font-mono font-semibold text-ink">#{number}</span>
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700">
          🚚 {ar ? "الوصول المتوقع" : "Arrives"}: {delivery}
        </div>
      </div>

      {/* Status stepper */}
      <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex items-center">
          {stages.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i <= stageIdx ? "bg-emerald-500 text-white" : "bg-surface-page text-ink-soft"}`}>
                  {i < stageIdx ? "✓" : i + 1}
                </div>
                <span className={`mt-1 max-w-[68px] text-center text-[11px] ${i <= stageIdx ? "font-medium text-ink" : "text-ink-soft"}`}>{s}</span>
              </div>
              {i < stages.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${i < stageIdx ? "bg-emerald-500" : "bg-line"}`} />}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          {ar
            ? "سنتواصل معك عبر واتساب لتأكيد الطلب قبل الشحن. الدفع نقداً عند الاستلام."
            : "We'll message you on WhatsApp to confirm before shipping. Pay cash on delivery."}
        </p>
      </div>

      {/* Order details */}
      {order && (
        <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "تفاصيل الطلب" : "Order details"}</h2>
          <div className="space-y-3">
            {items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                  {i.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={String(i.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-ink">{String(i.product_name)}</div>
                  <div className="text-xs text-ink-soft">
                    {i.variant_title ? `${i.variant_title} · ` : ""}{num(Number(i.quantity), lang)} ×
                  </div>
                </div>
                <div className="text-sm font-semibold">{egp(Number(i.price) * Number(i.quantity), lang)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><span>{egp(subtotal, lang)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>{ar ? "الخصم" : "Discount"}</span><span>−{egp(discount, lang)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الشحن" : "Shipping"}</span><span className="font-medium text-emerald-600">{ar ? "مجاني" : "Free"}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{ar ? "الإجمالي" : "Total"}</span><span>{egp(total, lang)}</span></div>
            <div className="flex justify-between pt-1 text-xs text-ink-soft"><span>{ar ? "طريقة الدفع" : "Payment"}</span><span>💵 {ar ? "الدفع عند الاستلام" : "Cash on delivery"}</span></div>
          </div>
          <div className="mt-3 rounded-xl bg-surface-page p-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">{name}</span> · <span dir="ltr">{phone}</span>
            <div className="text-xs text-ink-soft">
              {[order.address, order.city, order.governorate].filter(Boolean).join("، ")}
            </div>
          </div>
        </div>
      )}

      {/* Birthday capture */}
      {!bdaySaved ? (
        <div className="mt-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50 p-5">
          <div className="mb-2 text-sm font-semibold text-fuchsia-700">🎂 {ar ? "أضيفي تاريخ ميلادك واحصلي على هدية كل عام" : "Add your birthday for a yearly gift"}</div>
          <div className="flex gap-2">
            <input type="date" value={bday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBday(e.target.value)} dir="ltr" className="h-11 flex-1 rounded-xl border border-fuchsia-200 bg-white px-3 text-sm outline-none focus:border-fuchsia-400" />
            <button onClick={saveBirthday} disabled={!bday} className="h-11 shrink-0 rounded-xl bg-fuchsia-600 px-4 text-sm font-semibold text-white transition hover:bg-fuchsia-700 disabled:opacity-50">{ar ? "حفظ" : "Save"}</button>
          </div>
        </div>
      ) : (
        <div className="animate-pop-in mt-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 text-center text-sm font-semibold text-fuchsia-700">🎉 {ar ? "تم الحفظ! سنفاجئك بهدية في عيد ميلادك." : "Saved! We'll surprise you on your birthday."}</div>
      )}

      {/* Account + trust */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { i: "⚡", t: ar ? "بياناتك محفوظة" : "Details saved", s: ar ? "الطلب القادم أسرع" : "Faster next time" },
          { i: "↩️", t: ar ? "إرجاع سهل" : "Easy returns", s: ar ? "خلال ١٤ يوم" : "Within 14 days" },
          { i: "🔒", t: ar ? "تسوّق آمن" : "Secure", s: ar ? "بياناتك محمية" : "Protected" },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-line bg-white p-4 text-center shadow-card">
            <div className="text-xl">{c.i}</div>
            <div className="mt-1 text-sm font-semibold text-ink">{c.t}</div>
            <div className="text-xs text-ink-soft">{c.s}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center gap-2">
        <Link href="/store" className="btn-primary inline-flex px-6 py-3 text-base shadow-pop">{ar ? "متابعة التسوّق" : "Continue shopping"}</Link>
        <span className="text-xs text-ink-soft">{ar ? "احتفظي برقم الطلب للمتابعة" : "Keep your order number for tracking"}</span>
      </div>
    </div>
  );
}
