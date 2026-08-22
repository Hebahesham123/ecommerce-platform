"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import { useCart } from "../cart";
import {
  sendOtp, verifyOtp, placeOrder, getCustomer, type CustomerProfile,
} from "../actions";
import { computeDiscount, isBirthday } from "@/lib/offers";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "كفر الشيخ", "البحيرة", "دمياط", "بورسعيد",
  "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء",
  "الوادي الجديد", "البحر الأحمر",
];

type Step = "idle" | "channel" | "sending" | "code_sent" | "verified";
type Channel = "whatsapp" | "sms";

// Remember verified numbers on this device so we never ask for the code again.
const digitsOf = (p: string) => p.replace(/\D/g, "");
function loadVerified(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem("bb_verified_phones") || "[]")); } catch { return new Set(); }
}
function rememberVerified(p: string) {
  try { const s = loadVerified(); s.add(digitsOf(p)); localStorage.setItem("bb_verified_phones", JSON.stringify([...s])); } catch {}
}
function isLocallyVerified(p: string) {
  try { return digitsOf(p).length >= 10 && loadVerified().has(digitsOf(p)); } catch { return false; }
}

export default function CheckoutPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  // Keep checkout static on mobile: no pinch-zoom, and no iOS auto-zoom when a
  // field is focused. Scoped to this page — restored on unmount.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const prev = meta?.getAttribute("content") ?? null;
    const created = !meta;
    const el = meta ?? document.createElement("meta");
    el.setAttribute("name", "viewport");
    el.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
    );
    if (created) document.head.appendChild(el);
    // iOS ignores user-scalable on focus unless the field is >= 16px.
    const style = document.createElement("style");
    style.textContent =
      "@media (max-width:640px){.bb-checkout input,.bb-checkout select,.bb-checkout textarea{font-size:16px!important}}";
    document.head.appendChild(style);
    return () => {
      style.remove();
      if (created) el.remove();
      else if (prev != null) el.setAttribute("content", prev);
    };
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gov, setGov] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [postal, setPostal] = useState("");
  const [saveInfo, setSaveInfo] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [billingSame, setBillingSame] = useState(true);

  const [step, setStep] = useState<Step>("idle");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [code, setCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [profileBirthday, setProfileBirthday] = useState<string | null>(null);

  const shipping = 0;
  const phoneOk = phone.replace(/[^\d]/g, "").length >= 10;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const bdayToday = useMemo(() => isBirthday(profileBirthday, new Date()), [profileBirthday]);

  const discountResult = useMemo(
    () => computeDiscount(appliedCoupon, subtotal, { birthday: bdayToday }),
    [appliedCoupon, subtotal, bdayToday],
  );
  const discount = discountResult.ok ? discountResult.discount : 0;
  const total = Math.max(0, subtotal - discount + shipping);

  function applyProfile(p: CustomerProfile) {
    if (p.name) {
      const parts = p.name.trim().split(/\s+/);
      setFirstName((v) => v || parts[0] || "");
      setLastName((v) => v || parts.slice(1).join(" ") || "");
    }
    setEmail((v) => v || p.email || "");
    setGov((v) => v || p.governorate || "");
    setCity((v) => v || p.city || "");
    setAddress((v) => v || p.address || "");
    setWelcomeName(p.name);
    setProfileBirthday(p.birthday);
  }

  async function recognizePhone() {
    if (!phoneOk || step !== "idle") return;
    // Already verified on this device → mark verified immediately, no code.
    if (isLocallyVerified(phone)) setStep("verified");
    const res = await getCustomer(phone);
    if (res.ok && res.data.verified) {
      setStep("verified");
      rememberVerified(phone);
      if (res.data.profile) applyProfile(res.data.profile);
    }
  }

  function applyCoupon() {
    const c = couponInput.trim();
    const res = computeDiscount(c, subtotal, { birthday: bdayToday });
    if (!res.ok) {
      setAppliedCoupon(null);
      setCouponErr(
        res.reason === "unknown" ? (ar ? "كود غير صالح" : "Invalid code")
          : res.reason === "min_not_met" ? (ar ? `الحد الأدنى ${egp(res.offer!.minSubtotal, lang)}` : `Minimum ${egp(res.offer!.minSubtotal, lang)}`)
          : (ar ? "أدخلي كود الخصم" : "Enter a code"),
      );
      return;
    }
    setAppliedCoupon(res.offer!.code);
    setCouponInput(res.offer!.code);
    setCouponErr(null);
  }

  async function startCheckout() {
    setErr(null);
    if (!emailOk) { setErr(ar ? "أدخلي بريداً إلكترونياً صحيحاً" : "Enter a valid email"); return; }
    if (!firstName.trim() || !lastName.trim()) { setErr(ar ? "أدخلي الاسم الأول واسم العائلة" : "Enter first and last name"); return; }
    if (!address.trim() || !city.trim() || !gov) { setErr(ar ? "أكملي عنوان التوصيل" : "Complete the delivery address"); return; }
    if (!phoneOk) { setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number"); return; }
    if (items.length === 0) { setErr(ar ? "السلة فارغة" : "Cart is empty"); return; }

    // Verified (this session or ever on this device) → place, never ask again.
    if (step === "verified" || isLocallyVerified(phone)) { await placeOrderNow(); return; }
    const res = await getCustomer(phone);
    if (res.ok && res.data.verified) { setStep("verified"); rememberVerified(phone); await placeOrderNow(); return; }
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
  async function resend(ch: Channel) { setCode(""); await chooseChannel(ch); }

  async function submitCode() {
    if (placing) return;
    setErr(null);
    const res = await verifyOtp(phone, code, `${firstName} ${lastName}`.trim());
    if (!res.ok) {
      setErr(res.error === "wrong_code" ? (ar ? "الكود غير صحيح" : "Wrong code") : res.error === "expired" ? (ar ? "انتهت صلاحية الكود" : "Code expired") : (ar ? "تعذّر التحقق" : "Verification failed"));
      return;
    }
    setStep("verified");
    rememberVerified(phone);
    await placeOrderNow();
  }
  function closeOtp() {
    if (step === "channel" || step === "sending" || step === "code_sent") { setStep("idle"); setErr(null); }
  }

  async function placeOrderNow(): Promise<boolean> {
    setErr(null);
    setPlacing(true);
    const res = await placeOrder({
      customerName: `${firstName} ${lastName}`.trim() || firstName,
      phone,
      email: email.trim() || null,
      governorate: gov,
      city,
      address,
      note: postal.trim() ? `${ar ? "الرمز البريدي" : "Postal"}: ${postal.trim()}` : "",
      couponCode: appliedCoupon,
      birthday: profileBirthday || null,
      items: items.map((i) => ({
        itemId: i.itemId, productName: i.productName, variantTitle: i.variantTitle,
        sku: i.sku, imageUrl: i.imageUrl, price: i.price, quantity: i.quantity,
      })),
    });
    if (!res.ok) {
      setPlacing(false);
      // Server says this number isn't verified (e.g. a fresh device/DB) — fall
      // back to the one-time code flow instead of a dead-end error.
      if (res.error === "not_verified") { setStep("channel"); setCode(""); return false; }
      setErr(res.error === "out_of_stock" ? (ar ? "نفدت كمية أحد المنتجات — يُرجى تحديث السلة" : "An item just sold out — please update your cart") : (ar ? "تعذّر إتمام الطلب" : "Could not place order"));
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
        <Link href="/store" className="mt-4 inline-flex rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">{ar ? "تسوّقي الآن" : "Shop now"}</Link>
      </div>
    );
  }

  // Field styles matching the reference (floating-ish label look via placeholder).
  const field = "h-14 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500";
  const check = "h-5 w-5 rounded border-slate-300 accent-rose-600";

  return (
    <div className="bb-checkout -mx-4 -my-6">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT — form */}
        <div className="order-2 px-4 py-8 lg:order-1 lg:ms-auto lg:w-full lg:max-w-[560px] lg:px-8">
          {/* Contact */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{ar ? "معلومات التواصل" : "Contact"}</h2>
              <Link href="/store" className="text-sm font-medium text-rose-600 underline">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={ar ? "البريد الإلكتروني" : "Email"} className={field} dir="ltr" />
            <label className="mt-3 flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} className={check} />
              {ar ? "أرسلوا لي الأخبار والعروض بالبريد" : "Email me with news and offers"}
            </label>
          </section>

          {/* Delivery */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{ar ? "التوصيل" : "Delivery"}</h2>
            <div className="space-y-3">
              <div className="relative">
                <select value="EG" disabled className={`${field} appearance-none pt-5 text-slate-900`}>
                  <option value="EG">{ar ? "مصر" : "Egypt"}</option>
                </select>
                <span className="pointer-events-none absolute start-3.5 top-2 text-[11px] text-slate-500">{ar ? "الدولة / المنطقة" : "Country / Region"}</span>
                <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={ar ? "الاسم الأول" : "First name"} className={field} />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={ar ? "اسم العائلة" : "Last name"} className={field} />
              </div>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ar ? "العنوان" : "Address"} className={field} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={ar ? "المدينة" : "City"} className={field} />
                <div className="relative">
                  <select value={gov} onChange={(e) => setGov(e.target.value)} className={`${field} appearance-none pt-5`}>
                    <option value=""></option>
                    {GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                  <span className="pointer-events-none absolute start-3.5 top-2 text-[11px] text-slate-500">{ar ? "المحافظة" : "Governorate"}</span>
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
                </div>
                <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder={ar ? "الرمز البريدي (اختياري)" : "Postal code (optional)"} className={field} dir="ltr" />
              </div>
              <input value={phone} onChange={(e) => { setPhone(e.target.value); if (step === "verified") { setStep("idle"); setWelcomeName(null); } }} onBlur={recognizePhone} placeholder={ar ? "الهاتف" : "Phone"} className={field} dir="ltr" inputMode="tel" />
            </div>
            {welcomeName && step === "verified" && (
              <p className="mt-2 text-sm font-medium text-emerald-600">👋 {ar ? `أهلاً بعودتك، ${welcomeName}!` : `Welcome back, ${welcomeName}!`}</p>
            )}
            <label className="mt-3 flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} className={check} />
              {ar ? "احفظوا معلوماتي للمرة القادمة" : "Save this information for next time"}
            </label>
            <label className="mt-2 flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} className={check} />
              {ar ? "أرسلوا لي الأخبار والعروض برسالة نصية" : "Text me with news and offers"}
            </label>
          </section>

          {/* Shipping method */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{ar ? "طريقة الشحن" : "Shipping method"}</h2>
            <div className="flex items-center justify-between rounded-lg border-2 border-rose-600 bg-rose-50/50 px-4 py-4">
              <span className="flex items-center gap-3 text-[15px] text-slate-900">
                <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-rose-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /></span>
                {ar ? "شحن مجاني" : "Free shipping"}
              </span>
              <span className="text-[15px] font-semibold uppercase text-slate-900">{ar ? "مجاني" : "FREE"}</span>
            </div>
          </section>

          {/* Payment */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">{ar ? "الدفع" : "Payment"}</h2>
            <p className="mb-3 text-sm text-slate-500">{ar ? "جميع المعاملات آمنة ومشفّرة." : "All transactions are secure and encrypted."}</p>
            <div className="flex items-center gap-3 rounded-lg border-2 border-rose-600 bg-rose-50/50 px-4 py-4">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-rose-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /></span>
              <span className="flex-1 text-[15px] font-medium text-slate-900">{ar ? "الدفع عند الاستلام (COD)" : "Cash on Delivery (COD)"}</span>
              <span className="text-lg">💵</span>
            </div>
          </section>

          {/* Billing address */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{ar ? "عنوان الفوترة" : "Billing address"}</h2>
            <div className="space-y-2.5">
              {[{ id: true, label: ar ? "نفس عنوان الشحن" : "Same as shipping address" }, { id: false, label: ar ? "استخدام عنوان فوترة مختلف" : "Use a different billing address" }].map((b) => {
                const sel = billingSame === b.id;
                return (
                  <button key={String(b.id)} type="button" onClick={() => setBillingSame(b.id)} className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-4 text-start transition ${sel ? "border-rose-600 bg-rose-50/50" : "border-slate-300 hover:border-slate-400"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${sel ? "border-rose-600" : "border-slate-300"}`}>{sel && <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />}</span>
                    <span className="text-[15px] text-slate-900">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {err && <p className="mt-4 text-sm font-medium text-rose-600">{err}</p>}

          <button onClick={startCheckout} disabled={placing} className="mt-6 w-full rounded-lg bg-rose-600 py-4 text-base font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
            {placing ? (ar ? "جارٍ إتمام الطلب…" : "Placing order…") : (ar ? "إتمام الطلب" : "Complete order")}
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">🔒 {ar ? "دفع آمن ومشفّر" : "Secure and encrypted"}</p>
        </div>

        {/* RIGHT — order summary */}
        <div className="order-1 border-b border-slate-200 bg-slate-50 px-4 py-8 lg:order-2 lg:border-b-0 lg:border-s lg:px-8">
          <div className="lg:sticky lg:top-8 lg:max-w-[420px]">
            <div className="space-y-4">
              {items.map((i) => (
                <div key={i.itemId} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {i.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-slate-500 px-1 text-xs font-semibold text-white">{i.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-slate-900">{i.productName}</div>
                    {i.variantTitle && <div className="text-xs text-slate-500">{i.variantTitle}</div>}
                  </div>
                  <div className="text-sm font-medium text-slate-900">{egp(i.price * i.quantity, lang)}</div>
                </div>
              ))}
            </div>

            {/* Discount */}
            <div className="mt-5 flex gap-2">
              {appliedCoupon && discountResult.ok ? (
                <div className="flex flex-1 items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-emerald-700">🎟️ {appliedCoupon}</span>
                  <button onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} className="text-xs font-medium text-emerald-700 hover:underline">{ar ? "إزالة" : "Remove"}</button>
                </div>
              ) : (
                <>
                  <input value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }} placeholder={ar ? "كود الخصم أو بطاقة الهدايا" : "Discount code or gift card"} className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-rose-500" dir="ltr" />
                  <button onClick={applyCoupon} disabled={!couponInput.trim()} className="h-11 shrink-0 rounded-lg bg-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-300 disabled:opacity-60">{ar ? "تطبيق" : "Apply"}</button>
                </>
              )}
            </div>
            {couponErr && <p className="mt-1.5 text-xs text-rose-600">{couponErr}</p>}

            {/* Totals */}
            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between text-slate-600"><span>{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><span className="text-slate-900">{egp(subtotal, lang)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>{ar ? "الخصم" : "Discount"} ({appliedCoupon})</span><span>−{egp(discount, lang)}</span></div>
              )}
              <div className="flex justify-between text-slate-600"><span>{ar ? "الشحن" : "Shipping"}</span><span className="font-medium uppercase text-slate-900">{ar ? "مجاني" : "FREE"}</span></div>
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
                <span>{ar ? "الإجمالي" : "Total"}</span>
                <span><span className="me-1 text-xs font-normal text-slate-500">EGP</span>{egp(total, lang)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTP modal (opens on Complete order for unverified numbers) */}
      {(step === "channel" || step === "sending" || step === "code_sent") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeOtp} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><span>🔐</span>{ar ? "تأكيد رقم الهاتف" : "Verify your phone"}</h3>
              <button onClick={closeOtp} className="text-lg text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {step === "code_sent" ? (
              <>
                <p className="mb-3 text-sm text-slate-500">{ar ? `أدخلي الكود المرسل عبر ${channel === "whatsapp" ? "واتساب" : "الرسائل"} إلى ${phone}` : `Enter the code sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"} to ${phone}`}</p>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submitCode(); }} placeholder="000000" className="h-12 w-full rounded-lg border border-slate-300 bg-white text-center text-lg tracking-[0.4em] outline-none focus:border-rose-500" dir="ltr" inputMode="numeric" maxLength={6} autoFocus />
                <button onClick={submitCode} disabled={code.length < 4 || placing} className="mt-3 w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{placing ? (ar ? "جارٍ إتمام الطلب…" : "Placing order…") : (ar ? "تحقق وإتمام الطلب" : "Confirm & place order")}</button>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{ar ? "لم يصلك الكود؟" : "Didn't get it?"}</span>
                  <button onClick={() => resend("whatsapp")} className="font-semibold text-emerald-700 hover:underline">{ar ? "عبر واتساب" : "WhatsApp"}</button>
                  <span>·</span>
                  <button onClick={() => resend("sms")} className="font-semibold text-rose-600 hover:underline">{ar ? "عبر SMS" : "SMS"}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">{ar ? `اختاري طريقة استلام كود التحقق على ${phone}` : `Choose how to receive the code on ${phone}`}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => chooseChannel("whatsapp")} disabled={step === "sending"} className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 p-4 hover:border-emerald-500 disabled:opacity-50"><span className="text-2xl">💬</span><span className="text-sm font-semibold text-slate-900">{ar ? "واتساب" : "WhatsApp"}</span></button>
                  <button onClick={() => chooseChannel("sms")} disabled={step === "sending"} className="flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 p-4 hover:border-rose-500 disabled:opacity-50"><span className="text-2xl">✉️</span><span className="text-sm font-semibold text-slate-900">SMS</span></button>
                </div>
                {step === "sending" && <p className="mt-3 text-center text-sm text-slate-500">{ar ? "جارٍ إرسال الكود…" : "Sending the code…"}</p>}
              </>
            )}
            {err && <p className="mt-3 text-center text-sm text-rose-600">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
