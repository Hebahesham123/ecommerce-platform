"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import { useCart } from "../cart";
import { isPhoneVerified, sendOtp, verifyOtp, placeOrder } from "../actions";
import { OFFERS, DELIVERY_SLOTS, computeDiscount } from "@/lib/offers";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "كفر الشيخ", "البحيرة", "دمياط", "بورسعيد",
  "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء",
  "الوادي الجديد", "البحر الأحمر",
];

type Step = "idle" | "channel" | "sending" | "code_sent" | "verified";
type Channel = "whatsapp" | "sms";
type Speed = "standard" | "scheduled";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CheckoutPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [code, setCode] = useState("");
  const [gov, setGov] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Offers
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);

  // Delivery scheduling
  const [speed, setSpeed] = useState<Speed>("standard");
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [deliverySlot, setDeliverySlot] = useState<string | null>(null);
  const [days, setDays] = useState<Date[]>([]);

  // Gift
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Build the next 5 delivery days on the client (avoids SSR hydration drift).
  useEffect(() => {
    const base = new Date();
    const out: Date[] = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push(d);
    }
    setDays(out);
  }, []);

  const shipping = 0;
  const discountResult = useMemo(() => computeDiscount(appliedCoupon, subtotal), [appliedCoupon, subtotal]);
  const discount = discountResult.ok ? discountResult.discount : 0;
  const total = Math.max(0, subtotal - discount + shipping);
  const phoneOk = phone.replace(/[^\d]/g, "").length >= 10;

  function chooseSpeed(s: Speed) {
    setSpeed(s);
    if (s === "scheduled") {
      if (!deliveryDate && days[0]) setDeliveryDate(ymd(days[0]));
      if (!deliverySlot) setDeliverySlot(DELIVERY_SLOTS[0].id);
    }
  }

  function applyCoupon(codeArg?: string) {
    const c = (codeArg ?? couponInput).trim();
    const res = computeDiscount(c, subtotal);
    if (!res.ok) {
      setAppliedCoupon(null);
      setCouponErr(
        res.reason === "unknown" ? (ar ? "كود غير صالح" : "Invalid code")
          : res.reason === "min_not_met"
            ? (ar ? `الحد الأدنى ${egp(res.offer!.minSubtotal, lang)}` : `Minimum ${egp(res.offer!.minSubtotal, lang)}`)
            : (ar ? "أدخلي كود الخصم" : "Enter a code"),
      );
      return;
    }
    setAppliedCoupon(res.offer!.code);
    setCouponInput(res.offer!.code);
    setCouponErr(null);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponErr(null);
  }

  // "Place order" entry point: validate, then either place directly (already
  // verified) or auto-open the OTP modal on the channel-choice step.
  async function startCheckout() {
    setErr(null);
    if (!name.trim()) { setErr(ar ? "أدخلي الاسم" : "Enter your name"); return; }
    if (!phoneOk) { setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number"); return; }
    if (!gov || !address.trim()) { setErr(ar ? "أكملي عنوان الشحن" : "Complete the shipping address"); return; }
    if (speed === "scheduled" && (!deliveryDate || !deliverySlot)) {
      setErr(ar ? "اختاري موعد التوصيل" : "Pick a delivery date & time"); return;
    }
    if (items.length === 0) { setErr(ar ? "السلة فارغة" : "Cart is empty"); return; }

    // Already verified this session or a returning customer → skip OTP, place now.
    if (step === "verified" || (await isPhoneVerified(phone))) {
      setStep("verified");
      await placeOrderNow();
      return;
    }
    // Otherwise open the OTP modal so the customer picks WhatsApp or SMS.
    setCode("");
    setStep("channel");
  }

  // Customer picked a channel → trigger the n8n webhook to send the code.
  async function chooseChannel(ch: Channel) {
    setErr(null);
    setChannel(ch);
    setStep("sending");
    const res = await sendOtp(phone, ch);
    if (!res.ok || !res.data.sent) {
      setStep("channel");
      setErr(ar ? "تعذّر إرسال الكود، حاولي مرة أخرى" : "Couldn't send the code, please try again");
      return;
    }
    setStep("code_sent");
  }

  // Resend the code (retry), optionally via a different channel.
  async function resend(ch: Channel) {
    setCode("");
    await chooseChannel(ch);
  }

  // Confirm the code; on success the order is placed automatically.
  async function submitCode() {
    if (placing) return;
    setErr(null);
    const res = await verifyOtp(phone, code, name);
    if (!res.ok) {
      setErr(
        res.error === "wrong_code" ? (ar ? "الكود غير صحيح" : "Wrong code")
          : res.error === "expired" ? (ar ? "انتهت صلاحية الكود" : "Code expired")
          : (ar ? "تعذّر التحقق" : "Verification failed"),
      );
      return;
    }
    setStep("verified");
    await placeOrderNow();
  }

  function closeOtp() {
    if (step === "channel" || step === "sending" || step === "code_sent") {
      setStep("idle");
      setErr(null);
    }
  }

  // Actual order placement. Returns false (and shows an error) on failure.
  async function placeOrderNow(): Promise<boolean> {
    setErr(null);
    setPlacing(true);
    const res = await placeOrder({
      customerName: name,
      phone,
      governorate: gov,
      city,
      address,
      note,
      couponCode: appliedCoupon,
      deliverySpeed: speed,
      deliveryDate: speed === "scheduled" ? deliveryDate : null,
      deliverySlot: speed === "scheduled" ? deliverySlot : null,
      giftWrap,
      giftMessage: giftWrap ? giftMessage : null,
      items: items.map((i) => ({
        itemId: i.itemId,
        productName: i.productName,
        variantTitle: i.variantTitle,
        sku: i.sku,
        imageUrl: i.imageUrl,
        price: i.price,
        quantity: i.quantity,
      })),
    });
    if (!res.ok) {
      setPlacing(false);
      setErr(
        res.error === "not_verified" ? (ar ? "يجب تأكيد الهاتف" : "Phone not verified")
          : res.error === "out_of_stock" ? (ar ? "نفدت كمية أحد المنتجات — يُرجى تحديث السلة" : "An item just sold out — please update your cart")
          : (ar ? "تعذّر إتمام الطلب" : "Could not place order"),
      );
      return false;
    }
    clear();
    router.push(`/store/order/${res.data.orderNumber}`);
    return true;
  }

  if (items.length === 0 && !placing) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{ar ? "سلتك فارغة" : "Your cart is empty"}</p>
        <Link href="/store" className="btn-primary mt-4 inline-flex">{ar ? "تسوّقي الآن" : "Shop now"}</Link>
      </div>
    );
  }

  const inp = "h-11 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100";

  const trust = ar
    ? [{ i: "🔒", t: "دفع آمن" }, { i: "🚚", t: "شحن مجاني" }, { i: "↩️", t: "إرجاع خلال ١٤ يوم" }, { i: "✅", t: "منتجات أصلية" }]
    : [{ i: "🔒", t: "Secure checkout" }, { i: "🚚", t: "Free shipping" }, { i: "↩️", t: "14-day returns" }, { i: "✅", t: "Authentic products" }];

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{ar ? "إتمام الطلب" : "Checkout"}</h1>
        <span className="badge animate-pop-in bg-emerald-50 text-emerald-700">🔒 {ar ? "دفع مؤمّن ٪١٠٠" : "100% secure"}</span>
      </div>

      {/* Trust strip */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {trust.map((b, idx) => (
          <div
            key={b.t}
            className="animate-fade-up flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-card"
            style={{ animationDelay: `${idx * 70}ms` }}
          >
            <span className="text-lg">{b.i}</span>
            <span className="text-xs font-semibold text-ink">{b.t}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-5 lg:col-span-3">
          {/* Contact + verification */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "60ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><span>👤</span>{ar ? "معلومات التواصل" : "Contact"}</h2>
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "الاسم بالكامل" : "Full name"} className={inp} />
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (step === "verified") setStep("idle"); }}
                  onBlur={async () => {
                    // Returning customer: skip OTP if this number is already verified.
                    if (phoneOk && step === "idle" && (await isPhoneVerified(phone))) setStep("verified");
                  }}
                  placeholder={ar ? "رقم الموبايل" : "Mobile number"}
                  className={inp}
                  dir="ltr"
                  inputMode="tel"
                />
                {step === "verified" && (
                  <span className="animate-pop-in flex items-center gap-1 rounded-xl bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                    ✓ {ar ? "مؤكد" : "Verified"}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft">
                {ar
                  ? "عند تأكيد الطلب سنرسل كود تحقق عبر واتساب أو SMS. لن نطلب التأكيد مرة أخرى للأرقام التي سبق التحقق منها."
                  : "When you place the order we'll send a verification code via WhatsApp or SMS. We won't ask again for numbers you've already verified."}
              </p>
            </div>
          </section>

          {/* Shipping + delivery scheduling */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "120ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><span>📍</span>{ar ? "عنوان الشحن" : "Shipping address"}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={gov} onChange={(e) => setGov(e.target.value)} className={inp}>
                <option value="">{ar ? "المحافظة" : "Governorate"}</option>
                {GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={ar ? "المدينة / المنطقة" : "City / area"} className={inp} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ar ? "العنوان بالتفصيل" : "Street address"} className={`${inp} sm:col-span-2`} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظات للتوصيل (اختياري)" : "Delivery note (optional)"} className={`${inp} sm:col-span-2`} />
            </div>

            {/* Delivery speed */}
            <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold text-ink"><span>🕒</span>{ar ? "موعد التوصيل" : "Delivery time"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => chooseSpeed("standard")}
                className={`rounded-xl border-2 p-3 text-start transition ${speed === "standard" ? "border-brand-500 bg-brand-50/40" : "border-line hover:border-brand-200"}`}
              >
                <div className="text-sm font-semibold text-ink">🚚 {ar ? "توصيل قياسي" : "Standard"}</div>
                <div className="text-xs text-ink-soft">{ar ? "خلال ٢–٤ أيام · مجاني" : "2–4 days · free"}</div>
              </button>
              <button
                type="button"
                onClick={() => chooseSpeed("scheduled")}
                className={`rounded-xl border-2 p-3 text-start transition ${speed === "scheduled" ? "border-brand-500 bg-brand-50/40" : "border-line hover:border-brand-200"}`}
              >
                <div className="text-sm font-semibold text-ink">📅 {ar ? "جدولة التوصيل" : "Schedule"}</div>
                <div className="text-xs text-ink-soft">{ar ? "اختاري اليوم والوقت" : "Pick day & time"}</div>
              </button>
            </div>

            {speed === "scheduled" && (
              <div className="animate-slide-down mt-4 space-y-3 overflow-hidden">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">{ar ? "اليوم" : "Day"}</div>
                  <div className="flex flex-wrap gap-2">
                    {days.map((d) => {
                      const v = ymd(d);
                      const active = deliveryDate === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDeliveryDate(v)}
                          className={`rounded-xl border-2 px-3 py-2 text-center text-xs transition ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink hover:border-brand-200"}`}
                        >
                          <div className="font-semibold">{d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "short" })}</div>
                          <div className="text-ink-soft">{d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" })}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">{ar ? "الوقت" : "Time"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DELIVERY_SLOTS.map((s) => {
                      const active = deliverySlot === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setDeliverySlot(s.id)}
                          className={`rounded-xl border-2 px-2 py-2 text-center text-xs font-medium transition ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink hover:border-brand-200"}`}
                        >
                          {ar ? s.ar : s.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Gift options */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "180ms" }}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="h-5 w-5 accent-brand-600" />
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-lg">🎁</span>
              <span>
                <span className="block text-sm font-semibold text-ink">{ar ? "أضيفي تغليف هدية" : "Add gift wrapping"}</span>
                <span className="block text-xs text-ink-soft">{ar ? "تغليف أنيق مجاني + بطاقة إهداء" : "Free elegant wrap + a greeting card"}</span>
              </span>
            </label>
            {giftWrap && (
              <textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder={ar ? "رسالة الإهداء (اختياري)" : "Gift message (optional)"}
                rows={2}
                maxLength={140}
                className="animate-slide-down mt-3 w-full rounded-xl border border-line bg-surface-page px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            )}
          </section>

          {/* Payment */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "240ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><span>💳</span>{ar ? "طريقة الدفع" : "Payment"}</h2>
            <div className="flex items-center gap-3 rounded-xl border-2 border-brand-500 bg-brand-50/40 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg">💵</span>
              <div>
                <div className="text-sm font-semibold text-ink">{ar ? "الدفع عند الاستلام (COD)" : "Cash on delivery (COD)"}</div>
                <div className="text-xs text-ink-soft">{ar ? "ادفعي نقداً عند وصول الطلب" : "Pay in cash when your order arrives"}</div>
              </div>
              <span className="ms-auto text-brand-600">●</span>
            </div>
          </section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5 lg:sticky lg:top-20" style={{ animationDelay: "100ms" }}>
            {/* Free shipping banner */}
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <span className="animate-pulse-ring flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">🚚</span>
                {ar ? "مبروك! الشحن مجاني على طلبك 🎉" : "Free shipping unlocked on your order 🎉"}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full w-full animate-shimmer rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 bg-[length:200%_100%]" />
              </div>
            </div>

            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "ملخص الطلب" : "Order summary"}</h2>
            <div className="max-h-56 space-y-3 overflow-y-auto">
              {items.map((i) => (
                <div key={i.itemId} className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                    {i.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-bold text-white">{i.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{i.productName}</div>
                    {i.variantTitle && <div className="text-xs text-ink-soft">{i.variantTitle}</div>}
                  </div>
                  <div className="text-sm font-semibold">{egp(i.price * i.quantity, lang)}</div>
                </div>
              ))}
            </div>

            {/* Offers */}
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span>🎟️</span>{ar ? "عروض وكوبونات" : "Offers & coupons"}</div>
              {appliedCoupon && discountResult.ok ? (
                <div className="animate-pop-in flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="text-sm font-semibold text-emerald-700">✓ {appliedCoupon}</span>
                  <button onClick={removeCoupon} className="text-xs font-medium text-emerald-700 hover:underline">{ar ? "إزالة" : "Remove"}</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                    placeholder={ar ? "أدخلي كود الخصم" : "Enter coupon code"}
                    className={inp}
                    dir="ltr"
                  />
                  <button onClick={() => applyCoupon()} className="btn-outline h-11 shrink-0 px-4 text-sm">{ar ? "تطبيق" : "Apply"}</button>
                </div>
              )}
              {couponErr && <p className="mt-1.5 text-xs text-rose-600">{couponErr}</p>}
              {!appliedCoupon && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {OFFERS.map((o) => (
                    <button
                      key={o.code}
                      onClick={() => applyCoupon(o.code)}
                      className="rounded-full border border-dashed border-brand-300 bg-brand-50/50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                    >
                      {o.code} · {ar ? o.labelAr : o.labelEn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><span>{egp(subtotal, lang)}</span></div>
              {discount > 0 && (
                <div className="animate-pop-in flex justify-between text-emerald-600">
                  <span>{ar ? "الخصم" : "Discount"} {appliedCoupon && <span className="text-xs">({appliedCoupon})</span>}</span>
                  <span>−{egp(discount, lang)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الشحن" : "Shipping"}</span><span className="font-medium text-emerald-600">{ar ? "مجاني" : "Free"}</span></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{ar ? "الإجمالي" : "Total"}</span><span>{egp(total, lang)}</span></div>
              {discount > 0 && (
                <div className="text-end text-xs font-medium text-emerald-600">{ar ? `وفّرتِ ${egp(discount, lang)}` : `You saved ${egp(discount, lang)}`}</div>
              )}
            </div>

            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

            <button onClick={startCheckout} disabled={placing} className="btn-primary mt-4 w-full justify-center py-3 text-base shadow-pop transition hover:-translate-y-0.5 disabled:opacity-60 max-lg:hidden">
              {placing ? (ar ? "جارٍ تأكيد الطلب…" : "Placing order…") : (ar ? "تأكيد الطلب · الدفع عند الاستلام" : "Place order · COD")}
            </button>

            {/* Security row */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
              <span>🔒 {ar ? "بياناتك مشفّرة" : "Encrypted"}</span>
              <span>·</span>
              <span>🛡️ {ar ? "حماية المشتري" : "Buyer protection"}</span>
              <span>·</span>
              <span>↩️ {ar ? "إرجاع سهل" : "Easy returns"}</span>
            </div>
            <p className="mt-2 text-center text-xs text-ink-soft">{ar ? "بتأكيد الطلب أنت توافقين على الشراء بالدفع عند الاستلام." : "By placing the order you agree to pay on delivery."}</p>
          </div>
        </div>
      </div>

      {/* Spacer so the sticky mobile bar never covers the last content */}
      <div className="h-24 lg:hidden" aria-hidden />

      {/* Sticky mobile checkout bar — total + place order always reachable */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        {err && <p className="mb-2 text-center text-xs text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <div className="text-[11px] leading-none text-ink-soft">{ar ? "الإجمالي" : "Total"}</div>
            <div className="mt-0.5 text-base font-bold text-ink">{egp(total, lang)}</div>
            {discount > 0 && <div className="text-[10px] font-medium text-emerald-600">{ar ? `وفّرتِ ${egp(discount, lang)}` : `Saved ${egp(discount, lang)}`}</div>}
          </div>
          <button onClick={startCheckout} disabled={placing} className="btn-primary flex-1 justify-center py-3 text-base shadow-pop disabled:opacity-60">
            {placing ? (ar ? "جارٍ…" : "Placing…") : (ar ? "تأكيد الطلب · الدفع عند الاستلام" : "Place order · COD")}
          </button>
        </div>
      </div>

      {/* OTP verification modal — auto-opens on checkout when the phone isn't verified */}
      {(step === "channel" || step === "sending" || step === "code_sent") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeOtp}
          role="dialog"
          aria-modal="true"
        >
          <div className="animate-pop-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink"><span>🔐</span>{ar ? "تأكيد رقم الهاتف" : "Verify your phone"}</h3>
              <button onClick={closeOtp} aria-label={ar ? "إغلاق" : "Close"} className="text-lg text-ink-soft hover:text-ink">✕</button>
            </div>

            {step === "code_sent" ? (
              <>
                <p className="mb-3 text-sm text-ink-muted">
                  {ar
                    ? `أدخلي الكود المكوّن من 6 أرقام المرسل عبر ${channel === "whatsapp" ? "واتساب" : "الرسائل القصيرة"} إلى ${phone}`
                    : `Enter the 6-digit code sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"} to ${phone}`}
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submitCode(); }}
                  placeholder="000000"
                  className={`${inp} text-center text-lg tracking-[0.4em]`}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                />
                <button
                  onClick={submitCode}
                  disabled={code.length < 4 || placing}
                  className="btn-primary mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-50"
                >
                  {placing ? (ar ? "جارٍ تأكيد الطلب…" : "Placing order…") : (ar ? "تحقق وتأكيد الطلب" : "Confirm & place order")}
                </button>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <span>{ar ? "لم يصلك الكود؟" : "Didn't get the code?"}</span>
                  <button onClick={() => resend("whatsapp")} className="font-semibold text-emerald-700 hover:underline">{ar ? "إعادة عبر واتساب" : "Resend on WhatsApp"}</button>
                  <span className="text-ink-soft/50">·</span>
                  <button onClick={() => resend("sms")} className="font-semibold text-brand-600 hover:underline">{ar ? "عبر SMS" : "via SMS"}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-muted">
                  {ar ? `اختاري طريقة استلام كود التحقق على ${phone}` : `Choose how to receive the code on ${phone}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => chooseChannel("whatsapp")}
                    disabled={step === "sending"}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-line p-4 transition hover:border-emerald-500 hover:bg-emerald-50/40 disabled:opacity-50"
                  >
                    <span className="text-2xl">💬</span>
                    <span className="text-sm font-semibold text-ink">{ar ? "واتساب" : "WhatsApp"}</span>
                  </button>
                  <button
                    onClick={() => chooseChannel("sms")}
                    disabled={step === "sending"}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-line p-4 transition hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-50"
                  >
                    <span className="text-2xl">✉️</span>
                    <span className="text-sm font-semibold text-ink">{ar ? "رسالة SMS" : "SMS"}</span>
                  </button>
                </div>
                {step === "sending" && (
                  <p className="mt-3 text-center text-sm text-ink-muted">{ar ? "جارٍ إرسال الكود…" : "Sending the code…"}</p>
                )}
              </>
            )}

            {err && <p className="mt-3 text-center text-sm text-rose-600">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
