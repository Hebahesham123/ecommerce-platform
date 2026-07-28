"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import { useCart } from "../cart";
import { isPhoneVerified, sendOtp, verifyOtp, placeOrder } from "../actions";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "كفر الشيخ", "البحيرة", "دمياط", "بورسعيد",
  "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء",
  "الوادي الجديد", "البحر الأحمر",
];

type Step = "idle" | "sending" | "code_sent" | "verified";

export default function CheckoutPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [gov, setGov] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shipping = 0;
  const total = subtotal + shipping;
  const phoneOk = phone.replace(/[^\d]/g, "").length >= 10;

  async function verifyPhone() {
    setErr(null);
    if (!phoneOk) { setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number"); return; }
    // Skip OTP if this number was already verified before.
    if (await isPhoneVerified(phone)) {
      setStep("verified");
      return;
    }
    setStep("sending");
    const res = await sendOtp(phone);
    if (!res.ok) { setStep("idle"); setErr(ar ? "تعذّر إرسال الكود" : "Couldn't send code"); return; }
    setDevCode(res.data.devCode);
    setStep("code_sent");
  }

  async function submitCode() {
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
  }

  async function submitOrder() {
    setErr(null);
    if (!name.trim()) { setErr(ar ? "أدخلي الاسم" : "Enter your name"); return; }
    if (step !== "verified") { setErr(ar ? "يجب تأكيد رقم الهاتف" : "Verify your phone first"); return; }
    if (!gov || !address.trim()) { setErr(ar ? "أكملي عنوان الشحن" : "Complete the shipping address"); return; }
    if (items.length === 0) { setErr(ar ? "السلة فارغة" : "Cart is empty"); return; }

    setPlacing(true);
    const res = await placeOrder({
      customerName: name,
      phone,
      governorate: gov,
      city,
      address,
      note,
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
      setErr(res.error === "not_verified" ? (ar ? "يجب تأكيد الهاتف" : "Phone not verified") : (ar ? "تعذّر إتمام الطلب" : "Could not place order"));
      return;
    }
    clear();
    router.push(`/store/order/${res.data.orderNumber}`);
  }

  if (items.length === 0 && !placing) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{ar ? "سلتك فارغة" : "Your cart is empty"}</p>
        <Link href="/store" className="btn-primary mt-4 inline-flex">{ar ? "تسوّقي الآن" : "Shop now"}</Link>
      </div>
    );
  }

  const inp = "h-11 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-brand-600 focus:bg-white";

  return (
    <>
      <h1 className="mb-5 text-xl font-bold text-ink">{ar ? "إتمام الطلب" : "Checkout"}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-5 lg:col-span-3">
          {/* Contact + verification */}
          <section className="rounded-2xl border border-line p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "معلومات التواصل" : "Contact"}</h2>
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
                {step === "verified" ? (
                  <span className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                    ✓ {ar ? "مؤكد" : "Verified"}
                  </span>
                ) : (
                  <button onClick={verifyPhone} disabled={!phoneOk || step === "sending"} className="btn-outline h-11 shrink-0 px-4 text-sm disabled:opacity-50">
                    {step === "sending" ? (ar ? "جارٍ…" : "…") : (ar ? "تأكيد" : "Verify")}
                  </button>
                )}
              </div>

              {step === "code_sent" && (
                <div className="rounded-xl bg-surface-page p-3">
                  <div className="mb-2 text-xs text-ink-muted">
                    {ar ? "أدخلي الكود المرسل إلى هاتفك" : "Enter the code sent to your phone"}
                    {devCode && (
                      <span className="ms-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-800">
                        {ar ? "كود الاختبار" : "test code"}: {devCode}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" className={inp} dir="ltr" inputMode="numeric" maxLength={6} />
                    <button onClick={submitCode} className="btn-primary h-11 shrink-0 px-4 text-sm">{ar ? "تحقق" : "Confirm"}</button>
                  </div>
                </div>
              )}
              <p className="text-xs text-ink-soft">
                {ar ? "لن نطلب التأكيد مرة أخرى للأرقام التي سبق التحقق منها." : "We won't ask again for numbers you've already verified."}
              </p>
            </div>
          </section>

          {/* Shipping */}
          <section className="rounded-2xl border border-line p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "عنوان الشحن" : "Shipping address"}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={gov} onChange={(e) => setGov(e.target.value)} className={inp}>
                <option value="">{ar ? "المحافظة" : "Governorate"}</option>
                {GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={ar ? "المدينة / المنطقة" : "City / area"} className={inp} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ar ? "العنوان بالتفصيل" : "Street address"} className={`${inp} sm:col-span-2`} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظات للتوصيل (اختياري)" : "Delivery note (optional)"} className={`${inp} sm:col-span-2`} />
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-line p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "طريقة الدفع" : "Payment"}</h2>
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
          <div className="sticky top-20 rounded-2xl border border-line p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "ملخص الطلب" : "Order summary"}</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto">
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
            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><span>{egp(subtotal, lang)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">{ar ? "الشحن" : "Shipping"}</span><span className="text-emerald-600">{ar ? "مجاني" : "Free"}</span></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>{ar ? "الإجمالي" : "Total"}</span><span>{egp(total, lang)}</span></div>
            </div>

            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

            <button onClick={submitOrder} disabled={placing} className="btn-primary mt-4 w-full justify-center py-3 text-base disabled:opacity-60">
              {placing ? (ar ? "جارٍ تأكيد الطلب…" : "Placing order…") : (ar ? "تأكيد الطلب · الدفع عند الاستلام" : "Place order · COD")}
            </button>
            <p className="mt-2 text-center text-xs text-ink-soft">{ar ? "بتأكيد الطلب أنت توافقين على الشراء بالدفع عند الاستلام." : "By placing the order you agree to pay on delivery."}</p>
          </div>
        </div>
      </div>
    </>
  );
}
