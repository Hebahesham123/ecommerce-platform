"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcCopy, IcAlert } from "@/components/icons";

/**
 * What someone needs to point an app at this store.
 *
 * It lives in the dashboard rather than only in the repo because the person
 * who owns the store is usually not the person writing the app, and "send me
 * the API docs" should not be a conversation. The base URL is read from the
 * browser, so it is always the address of the store you are actually looking
 * at — a copied localhost URL in a production runbook is a classic way to lose
 * an afternoon.
 */

const ROUTES: { method: string; path: string; ar: string; en: string; auth: boolean }[] = [
  { method: "POST", path: "/auth/request-code", ar: "إرسال كود التحقق", en: "Send a verification code", auth: false },
  { method: "POST", path: "/auth/verify", ar: "التحقق من الكود وإصدار توكن", en: "Check the code, return a token", auth: false },
  { method: "POST", path: "/auth/login", ar: "دخول رقم معروف وإصدار توكن", en: "Sign in a known number, return a token", auth: false },
  { method: "GET", path: "/me", ar: "بيانات العميل وطلباته", en: "Profile and order history", auth: true },
  { method: "GET", path: "/products", ar: "المنتجات — يقبل q و category", en: "Catalogue — takes q and category", auth: false },
  { method: "GET", path: "/products/{id}", ar: "منتج واحد بكل مقاساته", en: "One product with its variants", auth: false },
  { method: "GET", path: "/collections", ar: "الأقسام وعدد منتجاتها", en: "Categories with product counts", auth: false },
  { method: "POST", path: "/cart/price", ar: "تسعير السلة من المخزون الحالي", en: "Re-price a cart against live stock", auth: false },
  { method: "POST", path: "/discount", ar: "معاينة كوبون", en: "Preview a coupon", auth: true },
  { method: "POST", path: "/orders", ar: "إنشاء طلب دفع عند الاستلام", en: "Place a COD order", auth: true },
  { method: "GET", path: "/orders", ar: "طلبات العميل نفسه", en: "The shopper's own orders", auth: true },
  { method: "GET", path: "/orders/{number}", ar: "طلب واحد بتفاصيله", en: "One order, with its lines", auth: true },
  { method: "GET", path: "/returns/eligible", ar: "ما يمكن إرجاعه خلال المهلة", en: "What is still inside the return window", auth: true },
  { method: "POST", path: "/returns", ar: "فتح استرجاع أو استبدال", en: "Open a return or exchange", auth: true },
  { method: "GET", path: "/returns", ar: "طلبات الاسترجاع الخاصة به", en: "The shopper's own requests", auth: true },
  { method: "POST", path: "/requests", ar: "استفسار عام (multipart)", en: "A general enquiry (multipart)", auth: true },
];

function Copyable({ label, value }: { label: string; value: string }) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-page px-3 py-2.5 font-mono text-sm text-ink" dir="ltr">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-outline h-10 shrink-0 px-3 text-xs"
        >
          <IcCopy className="h-3.5 w-3.5" />
          {copied ? (lang === "ar" ? "تم" : "Copied") : lang === "ar" ? "نسخ" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-ink-muted">{children}</div>
      </div>
    </li>
  );
}

export function ConnectPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const base = `${origin}/api/storefront`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={ar ? "ربط التطبيق" : "Connect an app"}
        subtitle={
          ar
            ? "كل ما يحتاجه المطوّر ليجعل التطبيق يبيع من نفس المخزون"
            : "Everything a developer needs to make an app sell from this same stock"
        }
      />

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink">{ar ? "الأساسيات" : "The basics"}</h2>
        <div className="mt-4 space-y-4">
          <Copyable label={ar ? "عنوان الواجهة" : "API base URL"} value={base || "…"} />
          <Copyable label={ar ? "ترويسة القناة" : "Channel header"} value="x-store-channel: app" />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          {ar
            ? "ترويسة القناة هي ما يجعل الطلب يظهر هنا كطلب تطبيق، وما يحدّد مجموعة بيانات ميتا التي يُرسل إليها. هي للتصنيف فقط — لا تمنح أي صلاحية."
            : "The channel header is what makes an order show up here as an app order, and which Meta dataset its purchase reports to. It is a label, not a permission — nothing is granted on the strength of it."}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold text-ink">
          {ar ? "كيف يسجّل العميل دخوله" : "How a shopper signs in"}
        </h2>
        <ol className="mt-4 space-y-4">
          <Step n={1} title={ar ? "اطلبي الكود" : "Ask for a code"}>
            <code className="font-mono text-xs" dir="ltr">POST /auth/request-code</code>{" "}
            {ar ? "بالرقم. يصل الكود على واتساب أو رسالة نصية." : "with the phone. The code arrives on WhatsApp or SMS."}
          </Step>
          <Step n={2} title={ar ? "تحقّقي واحصلي على التوكن" : "Verify, and get a token"}>
            <code className="font-mono text-xs" dir="ltr">POST /auth/verify</code>{" "}
            {ar
              ? "بالرقم والكود. الرد يحتوي على توكن صالح ٣٠ يوماً."
              : "with the phone and the code. The reply carries a token good for 30 days."}
          </Step>
          <Step n={3} title={ar ? "أرسليه مع كل طلب" : "Send it with every request"}>
            <code className="font-mono text-xs" dir="ltr">Authorization: Bearer &lt;token&gt;</code>.{" "}
            {ar
              ? "التوكن يثبت رقماً واحداً — وهو نفس ما تثبته جلسة الموقع."
              : "The token proves one phone number, which is exactly what the website's session cookie proves."}
          </Step>
        </ol>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
          <IcAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {ar
              ? "‏/auth/login يدخل أي رقم يعرفه المتجر بدون كود — هذه سياسة الموقع نفسها. إذا أردتِ أن يكون التطبيق أكثر تشدّداً، استخدمي مسار الكود فقط."
              : "Note that /auth/login signs in any number the store already knows, with no code — the same passwordless rule the website uses. If you want the app to be stricter than the website, use the code path only and don't ship the login call."}
          </span>
        </div>
      </Card>

      <Card className="mt-4 p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{ar ? "المسارات" : "Routes"}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            {ar
              ? "كل الردود بالشكل { ok, data } أو { ok, error }."
              : "Every reply is { ok, data } or { ok, error }."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {ROUTES.map((r) => (
                <tr key={r.method + r.path} className="border-b border-line last:border-0">
                  <td className="w-16 py-2.5 ps-5 align-top">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                        r.method === "GET"
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {r.method}
                    </span>
                  </td>
                  <td className="py-2.5 pe-3 align-top">
                    <code className="font-mono text-xs text-ink" dir="ltr">
                      {r.path}
                    </code>
                  </td>
                  <td className="py-2.5 pe-3 align-top text-ink-muted">{ar ? r.ar : r.en}</td>
                  <td className="w-24 py-2.5 pe-5 align-top text-end">
                    {r.auth && (
                      <span className="text-[11px] font-medium text-ink-soft">
                        {ar ? "يحتاج توكن" : "token"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold text-ink">
          {ar ? "أشياء يسهل الوقوع فيها" : "Things that catch people out"}
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-muted">
          <li>
            <span className="font-medium text-ink">
              {ar ? "السلة تُرسل بالمعرّفات والكميات فقط." : "Carts travel as ids and quantities only."}
            </span>{" "}
            {ar
              ? "الأسعار تُقرأ من قاعدة البيانات في كل مرة، فسلة قديمة على الهاتف لا يمكنها الشراء بسعر الأسبوع الماضي."
              : "Prices are read from the database every time, so a cart that sat on a phone for a week cannot check out at last week's price. Any price you send is ignored."}
          </li>
          <li>
            <span className="font-medium text-ink">
              {ar ? "رقم الطلب يجب أن يكون رقم صاحب التوكن." : "An order's phone must be the token's phone."}
            </span>{" "}
            {ar ? "غير ذلك يُرفض بـ 403." : "Anything else is refused with 403 phone_not_yours."}
          </li>
          <li>
            <span className="font-medium text-ink">
              {ar ? "409 تعني أعِد القراءة وحاول ثانية." : "409 means re-read and try again."}
            </span>{" "}
            {ar
              ? "‏cart_changed أو out_of_stock — المخزون تغيّر بين العرض والدفع."
              : "cart_changed or out_of_stock — stock moved between showing the cart and taking the money. Re-price and show the customer what changed."}
          </li>
          <li>
            <span className="font-medium text-ink">
              {ar ? "المخزون مشترك." : "There is one inventory."}
            </span>{" "}
            {ar
              ? "التطبيق والموقع يمرّان بنفس المعاملة التي تحجز القطعة، فلا يمكن بيع نفس القطعة مرتين."
              : "The app and the website go through the same transaction that reserves the unit, so the same piece can never be sold twice."}
          </li>
        </ul>
      </Card>
    </div>
  );
}
