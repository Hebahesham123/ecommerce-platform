"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp, num } from "@/lib/i18n";
import { useCart } from "../cart";
import {
  sendOtp,
  verifyOtp,
  placeOrder,
  getCustomer,
  getStoreStats,
  type CustomerProfile,
} from "../actions";
import { computeDiscount, isBirthday } from "@/lib/offers";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "كفر الشيخ", "البحيرة", "دمياط", "بورسعيد",
  "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء",
  "الوادي الجديد", "البحر الأحمر",
];

const LOW_STOCK = 5;

type Step = "idle" | "channel" | "sending" | "code_sent" | "verified";
type Channel = "whatsapp" | "sms";

export default function CheckoutPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [code, setCode] = useState("");
  const [gov, setGov] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [birthday, setBirthday] = useState("");
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [showCoupon, setShowCoupon] = useState(false);

  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [profileBirthday, setProfileBirthday] = useState<string | null>(null);
  const [stats, setStats] = useState<{ orders: number; customers: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getStoreStats();
      if (res.ok) setStats(res.data);
    })();
  }, []);

  const shipping = 0;
  const phoneOk = phone.replace(/[^\d]/g, "").length >= 10;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const bdayToday = useMemo(() => isBirthday(birthday || profileBirthday, new Date()), [birthday, profileBirthday]);

  const discountResult = useMemo(
    () => computeDiscount(appliedCoupon, subtotal, { birthday: bdayToday }),
    [appliedCoupon, subtotal, bdayToday],
  );
  const discount = discountResult.ok ? discountResult.discount : 0;
  const total = Math.max(0, subtotal - discount + shipping);

  // On a birthday, auto-apply the gift coupon (unless another is set).
  useEffect(() => {
    if (bdayToday && !appliedCoupon) setAppliedCoupon("BIRTHDAY");
  }, [bdayToday, appliedCoupon]);

  function applyProfile(p: CustomerProfile) {
    setName((v) => v || p.name || "");
    setEmail((v) => v || p.email || "");
    setGov((v) => v || p.governorate || "");
    setCity((v) => v || p.city || "");
    setAddress((v) => v || p.address || "");
    setBirthday((v) => v || p.birthday || "");
    setWelcomeName(p.name);
    setProfileBirthday(p.birthday);
  }

  // Recognize a returning verified customer and autofill their saved details.
  async function recognizePhone() {
    if (!phoneOk || step !== "idle") return;
    const res = await getCustomer(phone);
    if (res.ok && res.data.verified) {
      setStep("verified");
      if (res.data.profile) applyProfile(res.data.profile);
    }
  }

  function applyCoupon(codeArg?: string) {
    const c = (codeArg ?? couponInput).trim();
    const res = computeDiscount(c, subtotal, { birthday: bdayToday });
    if (!res.ok) {
      setAppliedCoupon(null);
      setCouponErr(
        res.reason === "unknown" ? (ar ? "كود غير صالح" : "Invalid code")
          : res.reason === "birthday_only" ? (ar ? "كود عيد الميلاد صالح في يوم ميلادك فقط" : "Birthday code works only on your birthday")
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

  async function startCheckout() {
    setErr(null);
    if (!name.trim()) { setErr(ar ? "أدخلي الاسم" : "Enter your name"); return; }
    if (!phoneOk) { setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number"); return; }
    if (!emailOk) { setErr(ar ? "أدخلي بريد إلكتروني صحيح لاستلام رابط الدفع" : "Enter a valid email to receive your payment link"); return; }
    if (!gov || !address.trim()) { setErr(ar ? "أكملي عنوان الشحن" : "Complete the shipping address"); return; }
    if (items.length === 0) { setErr(ar ? "السلة فارغة" : "Cart is empty"); return; }

    // Returning verified customer → place directly, else open the OTP modal.
    if (step === "verified") { await placeOrderNow(); return; }
    const res = await getCustomer(phone);
    if (res.ok && res.data.verified) {
      setStep("verified");
      await placeOrderNow();
      return;
    }
    setCode("");
    setStep("channel");
  }

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

  async function resend(ch: Channel) {
    setCode("");
    await chooseChannel(ch);
  }

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

  async function placeOrderNow(): Promise<boolean> {
    setErr(null);
    setPlacing(true);
    const res = await placeOrder({
      customerName: name,
      phone,
      email: email.trim() || null,
      governorate: gov,
      city,
      address,
      note,
      couponCode: appliedCoupon,
      birthday: birthday || null,
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
  const maxBirthday = new Date().toISOString().slice(0, 10);
  const social = stats && stats.orders >= 10 ? stats.orders : 0;

  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-ink">{ar ? "إتمام الطلب" : "Checkout"}</h1>

      {/* Returning customer welcome */}
      {welcomeName && step === "verified" && (
        <div className="animate-fade-up mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          👋 {ar ? `أهلاً بعودتك، ${welcomeName}! بياناتك جاهزة.` : `Welcome back, ${welcomeName}! Your details are ready.`}
        </div>
      )}

      {/* Birthday celebration */}
      {bdayToday && (
        <div className="animate-pop-in mb-3 flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700">
          <span className="animate-pulse-ring flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500 text-xs text-white">🎂</span>
          {ar ? "عيد ميلاد سعيد! أضفنا لك هدية ٢٠٪ خصم على طلبك." : "Happy birthday! We added a 20% gift to your order."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-4 lg:col-span-3">
          {/* Your details */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "40ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><span>👤</span>{ar ? "بياناتك" : "Your details"}</h2>
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "الاسم بالكامل" : "Full name"} className={inp} />
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ar ? "البريد الإلكتروني" : "Email address"}
                  className={inp}
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                />
                <p className="mt-1 text-xs text-ink-soft">✉️ {ar ? "لإرسال رابط إتمام الدفع إليك" : "So we can email you the payment link"}</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (step === "verified") { setStep("idle"); setWelcomeName(null); } }}
                  onBlur={recognizePhone}
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
              <div>
                <input
                  type="date"
                  value={birthday}
                  max={maxBirthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={`${inp} text-ink-muted`}
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-ink-soft">🎂 {ar ? "تاريخ ميلادك (اختياري) — لنحتفل معك بهدية كل عام" : "Your birthday (optional) — for a yearly gift"}</p>
              </div>
            </div>
          </section>

          {/* Shipping */}
          <section className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5" style={{ animationDelay: "100ms" }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><span>📍</span>{ar ? "عنوان التوصيل" : "Delivery address"}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={gov} onChange={(e) => setGov(e.target.value)} className={inp}>
                <option value="">{ar ? "المحافظة" : "Governorate"}</option>
                {GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={ar ? "المدينة / المنطقة" : "City / area"} className={inp} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ar ? "العنوان بالتفصيل" : "Street address"} className={`${inp} sm:col-span-2`} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظات للتوصيل (اختياري)" : "Delivery note (optional)"} className={`${inp} sm:col-span-2`} />
            </div>
            <p className="mt-2 text-xs text-ink-soft">💵 {ar ? "الدفع عند الاستلام — لا حاجة لأي دفع الآن." : "Cash on delivery — nothing to pay now."}</p>
          </section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5 lg:sticky lg:top-20" style={{ animationDelay: "80ms" }}>
            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "ملخص الطلب" : "Order summary"}</h2>
            <div className="max-h-56 space-y-3 overflow-y-auto">
              {items.map((i) => {
                const low = i.maxAvailable > 0 && i.maxAvailable <= LOW_STOCK;
                return (
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
                      {low && <div className="text-xs font-medium text-amber-600">⏳ {ar ? `باقي ${num(i.maxAvailable, lang)} فقط` : `Only ${num(i.maxAvailable, lang)} left`}</div>}
                    </div>
                    <div className="text-sm font-semibold">{egp(i.price * i.quantity, lang)}</div>
                  </div>
                );
              })}
            </div>

            {/* Coupon (collapsible) */}
            <div className="mt-4 border-t border-line pt-3">
              {appliedCoupon && discountResult.ok ? (
                <div className="animate-pop-in flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="text-sm font-semibold text-emerald-700">🎟️ {appliedCoupon}</span>
                  <button onClick={removeCoupon} className="text-xs font-medium text-emerald-700 hover:underline">{ar ? "إزالة" : "Remove"}</button>
                </div>
              ) : showCoupon ? (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                    placeholder={ar ? "كود الخصم" : "Coupon code"}
                    className={inp}
                    dir="ltr"
                    autoFocus
                  />
                  <button onClick={() => applyCoupon()} className="btn-outline h-11 shrink-0 px-4 text-sm">{ar ? "تطبيق" : "Apply"}</button>
                </div>
              ) : (
                <button onClick={() => setShowCoupon(true)} className="text-sm font-medium text-brand-600 hover:underline">🎟️ {ar ? "لديك كود خصم؟" : "Have a coupon?"}</button>
              )}
              {couponErr && <p className="mt-1.5 text-xs text-rose-600">{couponErr}</p>}
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
            </div>

            {social > 0 && (
              <p className="mt-3 text-center text-xs font-medium text-ink-muted">✅ {ar ? `انضمي لأكثر من ${num(social, lang)} طلب` : `Join ${num(social, lang)}+ orders placed`}</p>
            )}

            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

            <button onClick={startCheckout} disabled={placing} className="btn-primary mt-4 w-full justify-center py-3.5 text-base font-bold shadow-pop transition hover:-translate-y-0.5 disabled:opacity-60 max-lg:hidden">
              {placing ? (ar ? "جارٍ تأكيد الطلب…" : "Placing order…") : (ar ? "تأكيد الطلب · الدفع عند الاستلام" : "Place order · Cash on delivery")}
            </button>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
              <span>🔒 {ar ? "دفع آمن" : "Secure"}</span>
              <span>·</span>
              <span>💵 {ar ? "الدفع عند الاستلام" : "Pay on delivery"}</span>
              <span>·</span>
              <span>↩️ {ar ? "إرجاع خلال ١٤ يوم" : "14-day returns"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer so the sticky mobile bar never covers the last content */}
      <div className="h-24 lg:hidden" aria-hidden />

      {/* Sticky mobile checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        {err && <p className="mb-2 text-center text-xs text-rose-600">{err}</p>}
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <div className="text-[11px] leading-none text-ink-soft">{ar ? "الإجمالي" : "Total"}</div>
            <div className="mt-0.5 text-base font-bold text-ink">{egp(total, lang)}</div>
            {discount > 0 && <div className="text-[10px] font-medium text-emerald-600">{ar ? `وفّرتِ ${egp(discount, lang)}` : `Saved ${egp(discount, lang)}`}</div>}
          </div>
          <button onClick={startCheckout} disabled={placing} className="btn-primary flex-1 justify-center py-3.5 text-base font-bold shadow-pop disabled:opacity-60">
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
