"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "../cart";
import {
  sendOtp, verifyOtp, placeOrder, getCustomer, type CustomerProfile,
} from "../actions";
import { computeDiscount, isBirthday } from "@/lib/offers";
import { normalizePhone } from "@/lib/phone";

/**
 * Where "home" is for a shopper in checkout: the published theme at /shop,
 * which is what they were browsing. (/store is the separate React storefront.)
 */
const STOREFRONT_HOME = "/shop";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية",
  "المنوفية", "الغربية", "كفر الشيخ", "البحيرة", "دمياط", "بورسعيد",
  "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "مطروح", "شمال سيناء", "جنوب سيناء",
  "الوادي الجديد", "البحر الأحمر",
];

type Step = "idle" | "channel" | "sending" | "code_sent" | "verified";
type Channel = "whatsapp" | "sms";

/** Checkout prices always carry 2 decimals (E£23,000.00), like Shopify's. */
function money(n: number, ar: boolean) {
  const v = new Intl.NumberFormat(ar ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return ar ? `${v} ج.م` : `E£${v}`;
}

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

/* ---------------------------------- icons --------------------------------- */

const IcBag = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
const IcChevron = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IcHelp = (p: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M8.2 7.9a1.85 1.85 0 1 1 2.3 1.9c-.4.13-.5.4-.5.8v.5" strokeLinecap="round" />
    <circle cx="10" cy="13.6" r=".75" fill="currentColor" stroke="none" />
  </svg>
);
const IcTag = (p: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" {...p}>
    <path d="M10.6 2.5H16a1.5 1.5 0 0 1 1.5 1.5v5.4a1.5 1.5 0 0 1-.44 1.06l-6 6a1.5 1.5 0 0 1-2.12 0l-5.4-5.4a1.5 1.5 0 0 1 0-2.12l6-6a1.5 1.5 0 0 1 1.06-.44Z" />
    <circle cx="13.4" cy="6.6" r="1.1" />
  </svg>
);
const IcCash = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
    <rect x="2.75" y="6.25" width="18.5" height="11.5" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5h.01M18 14.5h.01" strokeLinecap="round" />
  </svg>
);

/* --------------------------------- fields --------------------------------- */

function Field({
  label, value, onChange, type = "text", dir, inputMode, help = false, onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dir?: "ltr" | "rtl";
  inputMode?: "text" | "tel" | "numeric" | "email";
  help?: boolean;
  onBlur?: () => void;
}) {
  return (
    <div className="co-field">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder=" "
        dir={dir}
        inputMode={inputMode}
        className={help ? "pe-11" : undefined}
      />
      <label>{label}</label>
      {help && <span className="co-affix"><IcHelp className="h-5 w-5" /></span>}
    </div>
  );
}

function SelectField({
  label, value, onChange, disabled, children,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="co-field">
      <select value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
        {children}
      </select>
      <label>{label}</label>
      <span className="co-affix"><IcChevron className="h-4 w-4" /></span>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="co-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/* ---------------------------------- page ---------------------------------- */

/** The signed-in shopper, resolved server-side from the session cookie. */
export type CheckoutIdentity = { phone: string; profile: CustomerProfile | null };

export default function CheckoutClient({
  initialItems,
  identity = null,
}: {
  initialItems: CartItem[];
  identity?: CheckoutIdentity | null;
}) {
  // Checkout always renders in English by default, regardless of the store's
  // Arabic-first language setting.
  const ar = false;
  const router = useRouter();
  const { items: cartItems, clear, seed, hydrated } = useCart();

  // A shopper arriving from the theme's "Buy it now" has their cart in the
  // sf_cart cookie, already resolved server-side into `initialItems`. Render
  // those until the local cart has hydrated, so the first paint is the real
  // order — never an empty one we have to correct a moment later.
  const items = cartItems.length > 0 ? cartItems : initialItems;
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Once hydration confirms the local cart really is empty, adopt the handed-off
  // lines so edits and order placement work against one source of truth.
  useEffect(() => {
    if (hydrated && cartItems.length === 0 && initialItems.length > 0) seed(initialItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Keep checkout static on mobile: no pinch-zoom, and no iOS auto-zoom when a
  // field is focused. Scoped to this page - restored on unmount.
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

  // A signed-in shopper's details are known before the first paint, so the form
  // opens filled in rather than empty.
  const known = identity?.profile ?? null;
  const knownName = (known?.name ?? "").trim().split(/\s+/).filter(Boolean);

  const [firstName, setFirstName] = useState(knownName[0] ?? "");
  const [lastName, setLastName] = useState(knownName.slice(1).join(" "));
  const [email, setEmail] = useState(known?.email ?? "");
  const [phone, setPhone] = useState(identity?.phone ?? "");
  const [gov, setGov] = useState(known?.governorate ?? "");
  const [city, setCity] = useState(known?.city ?? "");
  const [address, setAddress] = useState(known?.address ?? "");
  const [postal, setPostal] = useState("");
  const [saveInfo, setSaveInfo] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [billingSame, setBillingSame] = useState(true);

  // Signed in IS verified — the session was only issued to a shopper we had
  // already recognised, so asking for a code again would be asking twice.
  const [step, setStep] = useState<Step>(identity ? "verified" : "idle");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [code, setCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(known?.name ?? null);
  const [profileBirthday, setProfileBirthday] = useState<string | null>(known?.birthday ?? null);

  // The order summary is collapsed on mobile (Shopify's "Order summary ⌄" bar).
  const [summaryOpen, setSummaryOpen] = useState(false);

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
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

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

  /** True while the phone field still holds the number we're signed in as. */
  const isSessionPhone = (v: string) =>
    Boolean(identity) && normalizePhone(v) === normalizePhone(identity!.phone);

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
        res.reason === "unknown" ? (ar ? "كود غير صالح" : "Enter a valid discount code or gift card")
          : res.reason === "min_not_met" ? (ar ? `الحد الأدنى ${money(res.offer!.minSubtotal, ar)}` : `Minimum ${money(res.offer!.minSubtotal, ar)}`)
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

    // Signed in, verified in this session, or verified on this device before →
    // place the order; never ask the same person to prove the same number twice.
    if (step === "verified" || isSessionPhone(phone) || isLocallyVerified(phone)) {
      await placeOrderNow();
      return;
    }
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
    // The theme keeps its own cookie cart; without clearing it too, coming back
    // to checkout would re-seed the order that was just placed.
    if (initialItems.length > 0) {
      try { await fetch("/shop/cart/clear", { method: "POST" }); } catch {}
    }
    router.push(`/store/order/${res.data.orderNumber}`);
    return true;
  }

  /* ------------------------------ shared blocks ----------------------------- */

  const lineItems = (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.itemId} className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <div className="h-16 w-16 overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
              {i.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <span className="absolute -end-2 -top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#6b7177] px-1 text-[12px] font-semibold text-white">
              {i.quantity}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[14px] font-medium leading-5 text-[#1a1a1a]">{i.productName}</div>
            {i.variantTitle && <div className="mt-0.5 text-[13px] text-[#6b7177]">{i.variantTitle}</div>}
          </div>
          <div className="text-[14px] font-medium text-[#1a1a1a]">{money(i.price * i.quantity, ar)}</div>
        </li>
      ))}
    </ul>
  );

  const discountRow = (
    <div>
      <div className="flex gap-2">
        {appliedCoupon && discountResult.ok ? (
          <div className="flex flex-1 items-center justify-between rounded-[8px] border border-[#d9d9d9] bg-white px-3 py-2.5">
            <span className="flex items-center gap-2 text-[14px] font-medium text-[#1a1a1a]">
              <IcTag className="h-4 w-4 text-[#6b7177]" />
              {appliedCoupon}
            </span>
            <button
              type="button"
              onClick={() => { setAppliedCoupon(null); setCouponInput(""); }}
              className="co-link text-[13px]"
            >
              {ar ? "إزالة" : "Remove"}
            </button>
          </div>
        ) : (
          <>
            <div className="co-field flex-1">
              <input
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                placeholder=" "
                dir="ltr"
              />
              <label>{ar ? "كود الخصم أو بطاقة الهدايا" : "Discount code or gift card"}</label>
            </div>
            <button
              type="button"
              onClick={applyCoupon}
              disabled={!couponInput.trim()}
              className="h-[52px] shrink-0 rounded-[8px] border border-[#d9d9d9] bg-[#f0f0f0] px-6 text-[15px] font-medium text-[#6b7177] transition hover:bg-[#e8e8e8] disabled:opacity-60"
            >
              {ar ? "تطبيق" : "Apply"}
            </button>
          </>
        )}
      </div>
      {couponErr && <p className="mt-1.5 text-[13px] text-[#d72c0d]">{couponErr}</p>}
    </div>
  );

  const totals = (
    <div className="space-y-3 text-[14px]">
      <div className="flex items-center justify-between">
        <span className="text-[#1a1a1a]">{ar ? "الإجمالي الفرعي" : "Subtotal"}</span>
        <span className="font-medium text-[#1a1a1a]">{money(subtotal, ar)}</span>
      </div>
      {discount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[#1a1a1a]">{ar ? "الخصم" : "Discount"}</span>
          <span className="font-medium text-[#1a1a1a]">−{money(discount, ar)}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[#1a1a1a]">{ar ? "الشحن" : "Shipping"}</span>
        <span className="font-medium text-[#1a1a1a]">{ar ? "مجاني" : "FREE"}</span>
      </div>
      <div className="flex items-center justify-between border-t border-[#e5e5e5] pt-4">
        <span className="text-[17px] font-semibold text-[#1a1a1a]">{ar ? "الإجمالي" : "Total"}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-[#6b7177]">EGP</span>
          <span className="text-[21px] font-semibold text-[#1a1a1a]">{money(total, ar)}</span>
        </span>
      </div>
    </div>
  );

  /* ------------------------------- empty cart ------------------------------- */

  // With nothing handed over from the theme, the cart can only come from
  // localStorage — which isn't readable until the provider's effect runs. Hold
  // the checkout chrome rather than claiming the cart is empty.
  if (!hydrated && initialItems.length === 0) {
    return (
      <div className="co-root bb-checkout min-h-screen" dir="ltr">
        <CheckoutHeader ar={ar} />
        <div className="mx-auto w-full max-w-[600px] bg-white px-5 py-20 text-center">
          <div className="mx-auto h-3 w-40 animate-pulse rounded bg-[#ececec]" />
        </div>
      </div>
    );
  }

  if (items.length === 0 && !placing) {
    return (
      <div className="co-root bb-checkout min-h-screen" dir="ltr">
        <CheckoutHeader ar={ar} />
        <div className="mx-auto w-full max-w-[600px] bg-white px-5 py-20 text-center">
          <p className="text-[15px] text-[#6b7177]">{ar ? "سلتك فارغة" : "Your cart is empty"}</p>
          <Link
            href={STOREFRONT_HOME}
            className="mt-5 inline-flex h-[52px] items-center rounded-[8px] bg-[var(--co-accent)] px-7 text-[16px] font-semibold text-white hover:bg-[var(--co-accent-hover)]"
          >
            {ar ? "تسوّقي الآن" : "Continue shopping"}
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="co-root bb-checkout min-h-screen" dir="ltr">
      <CheckoutHeader ar={ar} />

      <div className="lg:grid lg:grid-cols-2">
        {/* ORDER SUMMARY — first in the DOM (so it sits under the header on
            mobile), second column on desktop. */}
        <aside className="lg:col-start-2 lg:row-start-1 lg:min-h-[calc(100vh-73px)] lg:border-s lg:border-[#e5e5e5] lg:bg-[var(--co-summary)]">
          {/* mobile: collapsible "Order summary" bar */}
          <div className="lg:hidden">
            <div className="mx-auto w-full max-w-[600px] border-y border-[#e5e5e5] bg-[var(--co-summary)]">
              <button
                type="button"
                onClick={() => setSummaryOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <span className="flex items-center gap-1.5 text-[15px] text-[var(--co-accent)]">
                  {ar ? "ملخص الطلب" : "Order summary"}
                  <IcChevron className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
                </span>
                <span className="text-[19px] font-semibold text-[#1a1a1a]">{money(total, ar)}</span>
              </button>
              {summaryOpen && (
                <div className="space-y-6 border-t border-[#e5e5e5] px-5 py-5">
                  {lineItems}
                  {discountRow}
                  {totals}
                </div>
              )}
            </div>
          </div>

          {/* desktop: the full summary column */}
          <div className="hidden lg:block">
            <div className="w-full max-w-[490px] space-y-6 px-10 py-10 lg:sticky lg:top-0">
              {lineItems}
              {discountRow}
              {totals}
            </div>
          </div>
        </aside>

        {/* MAIN — the form */}
        <div className="lg:col-start-1 lg:row-start-1 lg:bg-white">
          <div className="mx-auto w-full max-w-[600px] bg-white px-5 py-7 lg:ms-auto lg:me-0 lg:max-w-[560px] lg:px-10 lg:py-10">
            {/* Contact */}
            <section>
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-[19px] font-semibold text-[#1a1a1a]">{ar ? "معلومات التواصل" : "Contact"}</h2>
                {identity ? (
                  <Link href="/store/account" className="co-link text-[15px]">
                    {ar ? "حسابي" : "My account"}
                  </Link>
                ) : (
                  <Link href="/store/login" className="co-link text-[15px]">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
                )}
              </div>
              {identity && (
                <p className="mb-3 text-[14px] text-[#6b7177]">
                  {ar ? "مسجّلة الدخول باسم" : "Signed in as"}{" "}
                  <span className="font-medium text-[#1a1a1a]" dir="ltr">
                    {known?.name ? `${known.name} · ${identity.phone}` : identity.phone}
                  </span>
                </p>
              )}
              <Field label={ar ? "البريد الإلكتروني" : "Email"} value={email} onChange={setEmail} type="email" inputMode="email" dir="ltr" help />
              <div className="mt-4">
                <Check checked={emailOptIn} onChange={setEmailOptIn}>
                  {ar ? "أرسلوا لي الأخبار والعروض بالبريد" : "Email me with news and offers"}
                </Check>
              </div>
            </section>

            {/* Delivery */}
            <section className="mt-8">
              <h2 className="mb-4 text-[19px] font-semibold text-[#1a1a1a]">{ar ? "التوصيل" : "Delivery"}</h2>
              <div className="space-y-3">
                <SelectField label={ar ? "الدولة / المنطقة" : "Country/Region"} value="EG" disabled>
                  <option value="EG">{ar ? "مصر" : "Egypt"}</option>
                </SelectField>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={ar ? "الاسم الأول" : "First name"} value={firstName} onChange={setFirstName} />
                  <Field label={ar ? "اسم العائلة" : "Last name"} value={lastName} onChange={setLastName} />
                </div>
                <Field label={ar ? "العنوان" : "Address"} value={address} onChange={setAddress} />
                <Field label={ar ? "المدينة" : "City"} value={city} onChange={setCity} />
                <SelectField label={ar ? "المحافظة" : "Governorate"} value={gov} onChange={setGov}>
                  <option value="" />
                  {GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
                </SelectField>
                <Field label={ar ? "الرمز البريدي (اختياري)" : "Postal code (optional)"} value={postal} onChange={setPostal} dir="ltr" inputMode="numeric" />
                <Field
                  label={ar ? "الهاتف" : "Phone"}
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    // Typing a different number drops the verified state, but
                    // coming back to the signed-in one restores it.
                    if (isSessionPhone(v)) setStep("verified");
                    else if (step === "verified") { setStep("idle"); setWelcomeName(null); }
                  }}
                  onBlur={recognizePhone}
                  dir="ltr"
                  inputMode="tel"
                  help
                />
              </div>
              {welcomeName && step === "verified" && (
                <p className="mt-2.5 text-[14px] font-medium text-[#0f7c4a]">
                  👋 {ar ? `أهلاً بعودتك، ${welcomeName}!` : `Welcome back, ${welcomeName}!`}
                </p>
              )}
              <div className="mt-4 space-y-3">
                <Check checked={saveInfo} onChange={setSaveInfo}>
                  {ar ? "احفظوا معلوماتي للمرة القادمة" : "Save this information for next time"}
                </Check>
                <Check checked={smsOptIn} onChange={setSmsOptIn}>
                  {ar ? "أرسلوا لي الأخبار والعروض برسالة نصية" : "Text me with news and offers"}
                </Check>
              </div>
            </section>

            {/* Shipping method */}
            <section className="mt-8">
              <h2 className="mb-3 text-[17px] font-semibold text-[#1a1a1a]">{ar ? "طريقة الشحن" : "Shipping method"}</h2>
              <div className="flex items-center justify-between rounded-[8px] border border-[var(--co-accent)] bg-[var(--co-accent-soft)] px-4 py-[18px]">
                <span className="text-[15px] text-[#1a1a1a]">{ar ? "شحن مجاني" : "Free shipping"}</span>
                <span className="text-[15px] font-semibold text-[#1a1a1a]">{ar ? "مجاني" : "FREE"}</span>
              </div>
            </section>

            {/* Payment */}
            <section className="mt-8">
              <h2 className="text-[19px] font-semibold text-[#1a1a1a]">{ar ? "الدفع" : "Payment"}</h2>
              <p className="mb-4 mt-1 text-[14px] text-[#6b7177]">
                {ar ? "جميع المعاملات آمنة ومشفّرة." : "All transactions are secure and encrypted."}
              </p>
              <div className="co-list co-single">
                <div className="co-row co-on">
                  <input type="radio" className="co-radio" checked readOnly name="payment" />
                  <span className="flex-1 font-medium text-[#1a1a1a]">
                    {ar ? "الدفع عند الاستلام (COD)" : "Cash on Delivery (COD)"}
                  </span>
                  <IcCash className="h-6 w-6 text-[#6b7177]" />
                </div>
              </div>
            </section>

            {/* Billing address */}
            <section className="mt-8">
              <h2 className="mb-3 text-[17px] font-semibold text-[#1a1a1a]">{ar ? "عنوان الفوترة" : "Billing address"}</h2>
              <div className="co-list">
                {[
                  { id: true, label: ar ? "نفس عنوان الشحن" : "Same as shipping address" },
                  { id: false, label: ar ? "استخدام عنوان فوترة مختلف" : "Use a different billing address" },
                ].map((b) => (
                  <button
                    key={String(b.id)}
                    type="button"
                    onClick={() => setBillingSame(b.id)}
                    className={`co-row ${billingSame === b.id ? "co-on" : ""}`}
                  >
                    <input type="radio" className="co-radio" checked={billingSame === b.id} readOnly name="billing" />
                    <span className="text-[#1a1a1a]">{b.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {err && <p className="mt-4 text-[14px] font-medium text-[#d72c0d]">{err}</p>}

            {/* Discount + total row — mobile only; desktop keeps them in the
                summary column, exactly like Shopify. */}
            <div className="mt-7 lg:hidden">
              {appliedCoupon || discountOpen ? (
                discountRow
              ) : (
                <button
                  type="button"
                  onClick={() => setDiscountOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[14px] text-[#1a1a1a] hover:bg-[#fafafa]"
                >
                  <IcTag className="h-4 w-4 text-[#6b7177]" />
                  {ar ? "إضافة خصم" : "Add discount"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSummaryOpen((v) => !v)}
                className="mt-6 flex w-full items-center gap-4"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
                  {items[0]?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={items[0].imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 text-start">
                  <div className="text-[17px] font-semibold leading-tight text-[#1a1a1a]">{ar ? "الإجمالي" : "Total"}</div>
                  <div className="text-[13px] text-[#6b7177]">
                    {ar ? `${itemCount} منتج` : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <span className="text-[12px] text-[#6b7177]">EGP</span>
                  <span className="text-[20px] font-semibold text-[#1a1a1a]">{money(total, ar)}</span>
                  <IcChevron className={`h-4 w-4 text-[#6b7177] transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
            </div>

            <button
              onClick={startCheckout}
              disabled={placing}
              className="mt-6 h-[56px] w-full rounded-[8px] bg-[var(--co-accent)] text-[17px] font-semibold text-white transition hover:bg-[var(--co-accent-hover)] disabled:opacity-60"
            >
              {placing ? (ar ? "جارٍ إتمام الطلب…" : "Placing order…") : (ar ? "إتمام الطلب" : "Complete order")}
            </button>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e5e5e5] pt-5 text-[13px]">
              <Link href="/shop/policies/refund-policy" className="co-link">{ar ? "سياسة الاسترجاع" : "Refund policy"}</Link>
              <Link href="/shop/policies/shipping-policy" className="co-link">{ar ? "الشحن" : "Shipping"}</Link>
              <Link href="/shop/policies/privacy-policy" className="co-link">{ar ? "سياسة الخصوصية" : "Privacy policy"}</Link>
              <Link href="/shop/policies/terms-of-service" className="co-link">{ar ? "شروط الخدمة" : "Terms of service"}</Link>
              <Link href="/shop/pages/contact" className="co-link">{ar ? "تواصل معنا" : "Contact"}</Link>
            </div>
          </div>
        </div>
      </div>

      {/* OTP modal (opens on Complete order for unverified numbers) */}
      {(step === "channel" || step === "sending" || step === "code_sent") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeOtp} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-[10px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#1a1a1a]">{ar ? "تأكيد رقم الهاتف" : "Verify your phone"}</h3>
              <button onClick={closeOtp} className="text-lg text-[#6b7177] hover:text-[#1a1a1a]">✕</button>
            </div>
            {step === "code_sent" ? (
              <>
                <p className="mb-4 text-[14px] text-[#6b7177]">
                  {ar ? `أدخلي الكود المرسل عبر ${channel === "whatsapp" ? "واتساب" : "الرسائل"} إلى ${phone}` : `Enter the code sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"} to ${phone}`}
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submitCode(); }}
                  placeholder="000000"
                  className="h-[52px] w-full rounded-[8px] border border-[#d9d9d9] bg-white text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--co-accent)] focus:shadow-[0_0_0_1px_var(--co-accent)]"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                />
                <button
                  onClick={submitCode}
                  disabled={code.length < 4 || placing}
                  className="mt-4 h-[52px] w-full rounded-[8px] bg-[var(--co-accent)] text-[16px] font-semibold text-white hover:bg-[var(--co-accent-hover)] disabled:opacity-50"
                >
                  {placing ? (ar ? "جارٍ إتمام الطلب…" : "Placing order…") : (ar ? "تحقق وإتمام الطلب" : "Confirm & place order")}
                </button>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-[#6b7177]">
                  <span>{ar ? "لم يصلك الكود؟" : "Didn't get it?"}</span>
                  <button onClick={() => resend("whatsapp")} className="co-link">{ar ? "عبر واتساب" : "WhatsApp"}</button>
                  <span>·</span>
                  <button onClick={() => resend("sms")} className="co-link">{ar ? "عبر SMS" : "SMS"}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-[14px] text-[#6b7177]">
                  {ar ? `اختاري طريقة استلام كود التحقق على ${phone}` : `Choose how to receive the code on ${phone}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => chooseChannel("whatsapp")} disabled={step === "sending"} className="flex flex-col items-center gap-2 rounded-[8px] border border-[#d9d9d9] p-4 hover:border-[var(--co-accent)] disabled:opacity-50">
                    <span className="text-2xl">💬</span>
                    <span className="text-[14px] font-medium text-[#1a1a1a]">{ar ? "واتساب" : "WhatsApp"}</span>
                  </button>
                  <button onClick={() => chooseChannel("sms")} disabled={step === "sending"} className="flex flex-col items-center gap-2 rounded-[8px] border border-[#d9d9d9] p-4 hover:border-[var(--co-accent)] disabled:opacity-50">
                    <span className="text-2xl">✉️</span>
                    <span className="text-[14px] font-medium text-[#1a1a1a]">SMS</span>
                  </button>
                </div>
                {step === "sending" && <p className="mt-3 text-center text-[14px] text-[#6b7177]">{ar ? "جارٍ إرسال الكود…" : "Sending the code…"}</p>}
              </>
            )}
            {err && <p className="mt-3 text-center text-[14px] text-[#d72c0d]">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- header --------------------------------- */

function CheckoutHeader({ ar }: { ar: boolean }) {
  // Shoppers reach checkout from the published theme at /shop, so "home" is
  // there — not /store, which is the separate React storefront. The footer's
  // policy links already point at /shop, so the header was the odd one out.
  //
  // The cart drawer lives in the shop layout, which checkout deliberately
  // skips — so the bag goes to the cart page rather than opening a dead drawer.
  return (
    <header className="border-b border-[#e5e5e5] bg-white">
      <div className="mx-auto flex w-full max-w-[600px] items-center justify-between px-5 py-5 lg:max-w-[1120px] lg:px-10">
        <Link
          href={STOREFRONT_HOME}
          aria-label={ar ? "الصفحة الرئيسية" : "Home"}
          className="text-[22px] font-bold uppercase tracking-[0.01em] text-[#1a1a1a] transition hover:opacity-70"
        >
          {ar ? "بيوتي بار" : "Beauty Bar"}
        </Link>
        <Link
          href={`${STOREFRONT_HOME}/cart`}
          aria-label={ar ? "السلة" : "Cart"}
          className="text-[var(--co-accent)] transition hover:text-[var(--co-accent-hover)]"
        >
          <IcBag className="h-6 w-6" />
        </Link>
      </div>
    </header>
  );
}
