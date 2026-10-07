"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { IcCopy, IcPlus, IcWhatsApp, IcX } from "@/components/icons";
import {
  cancelCustomerOffer,
  createCustomerOffer,
  listCustomerOffers,
  type CustomerOffer,
} from "../offer-actions";

/**
 * Offers made for one customer.
 *
 * Each is a code only her phone can use, once, until it runs out. It can pop
 * up for her the next time she is browsing, be sent on WhatsApp, or both —
 * and this shows whether she saw it, took it and used it.
 */

const DURATIONS = [
  { hours: 6, en: "6 hours", ar: "٦ ساعات" },
  { hours: 24, en: "24 hours", ar: "٢٤ ساعة" },
  { hours: 48, en: "2 days", ar: "يومان" },
  { hours: 72, en: "3 days", ar: "٣ أيام" },
  { hours: 168, en: "7 days", ar: "٧ أيام" },
];

function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("20") ? digits : "2" + digits.replace(/^0/, "");
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function ExclusiveOffers({ phone, name }: { phone: string; name: string | null }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [offers, setOffers] = useState<CustomerOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [valueType, setValueType] = useState<"percentage" | "fixed_amount">("percentage");
  const [value, setValue] = useState(15);
  const [hours, setHours] = useState(48);
  const [minAmount, setMinAmount] = useState<string>("");
  const [message, setMessage] = useState("");
  const [popup, setPopup] = useState(true);
  const [popupSeconds, setPopupSeconds] = useState(8);

  useEffect(() => {
    listCustomerOffers(phone).then((r) => (r.ok ? setOffers(r.data) : setError(r.error)));
  }, [phone]);

  async function create() {
    setBusy(true);
    setError(null);
    const r = await createCustomerOffer({
      phone,
      valueType,
      value,
      hours,
      minAmount: minAmount ? Number(minAmount) : null,
      message,
      popup,
      popupSeconds,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOffers((o) => [r.data, ...(o ?? [])]);
    setOpen(false);
    setMessage("");
  }

  async function cancel(id: string) {
    const r = await cancelCustomerOffer(id);
    if (!r.ok) return setError(r.error);
    setOffers((o) => (o ?? []).map((x) => (x.id === id ? { ...x, cancelledAt: new Date().toISOString() } : x)));
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  function shareText(o: CustomerOffer) {
    const until = new Date(o.endsAt).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long" });
    const shop = typeof window !== "undefined" ? window.location.origin + "/store" : "";
    const hi = name ? (ar ? `أهلاً ${name}` : `Hi ${name}`) : ar ? "أهلاً" : "Hi";
    return ar
      ? `${hi}، هدية لكِ وحدك: ${o.label} بكود ${o.code} — صالح حتى ${until}. ${o.message ? o.message + " " : ""}${shop}`
      : `${hi}, a gift just for you: ${o.label} with code ${o.code}, valid until ${until}. ${o.message ? o.message + " " : ""}${shop}`;
  }

  function status(o: CustomerOffer): { label: string; tone: string; live: boolean } {
    if (o.used) return { label: ar ? "استُخدم" : "Used", tone: "bg-emerald-500/10 text-emerald-700", live: false };
    if (o.cancelledAt) return { label: ar ? "أُلغي" : "Cancelled", tone: "bg-slate-500/10 text-ink-soft", live: false };
    if (new Date(o.endsAt).getTime() < Date.now()) return { label: ar ? "انتهى" : "Expired", tone: "bg-slate-500/10 text-ink-soft", live: false };
    if (o.claimedAt) return { label: ar ? "أخذته" : "Taken", tone: "bg-sky-500/10 text-sky-700", live: true };
    if (o.shownAt) return { label: ar ? "رأته" : "Seen", tone: "bg-amber-500/10 text-amber-700", live: true };
    return { label: ar ? "بانتظارها" : "Waiting", tone: "bg-violet-500/10 text-violet-700", live: true };
  }

  const input = "inp h-9 w-full";

  return (
    <Card>
      <SectionHeader
        title={ar ? "عروض حصرية لها" : "Exclusive offers"}
        action={
          !open ? (
            <button className="btn-outline h-8 gap-1 px-2.5 text-xs" onClick={() => setOpen(true)}>
              <IcPlus className="h-3.5 w-3.5" /> {ar ? "عرض جديد" : "New offer"}
            </button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-5 pb-4">
        {error && (
          <p className="text-sm text-rose-600">
            {error === "migration_missing"
              ? ar
                ? "شغّلي ملف قاعدة البيانات 0054_offers_targeting.sql في Supabase."
                : "Run the database file 0054_offers_targeting.sql in Supabase."
              : error}
          </p>
        )}

        {open && (
          <div className="space-y-2.5 rounded-xl border border-line p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-muted">
                {ar ? "نوع الخصم" : "Discount"}
                <select className={input} value={valueType} onChange={(e) => setValueType(e.target.value as "percentage" | "fixed_amount")}>
                  <option value="percentage">{ar ? "نسبة %" : "Percent %"}</option>
                  <option value="fixed_amount">{ar ? "مبلغ ج.م" : "Amount EGP"}</option>
                </select>
              </label>
              <label className="text-xs text-ink-muted">
                {ar ? "القيمة" : "Value"}
                <input className={input} type="number" min={1} value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </label>
              <label className="text-xs text-ink-muted">
                {ar ? "صالح لمدة" : "Valid for"}
                <select className={input} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {DURATIONS.map((d) => (
                    <option key={d.hours} value={d.hours}>
                      {ar ? d.ar : d.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink-muted">
                {ar ? "أقل قيمة للطلب (اختياري)" : "Min. order (optional)"}
                <input className={input} type="number" min={0} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </label>
            </div>
            <label className="block text-xs text-ink-muted">
              {ar ? "رسالتك لها (اختياري)" : "Your message to her (optional)"}
              <textarea
                className="inp min-h-[64px] w-full py-2"
                value={message}
                maxLength={300}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={ar ? "مثلاً: لاحظنا إعجابك بهذه الحقيبة 🤍" : "e.g. We saw you loved this bag 🤍"}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={popup} onChange={(e) => setPopup(e.target.checked)} />
              {ar ? "اعرضيه لها كنافذة منبثقة عند زيارتها القادمة" : "Pop it up for her the next time she browses"}
            </label>
            {popup && (
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                {ar ? "بعد" : "After"}
                <input
                  className="inp h-8 w-16"
                  type="number"
                  min={3}
                  max={120}
                  value={popupSeconds}
                  onChange={(e) => setPopupSeconds(Number(e.target.value))}
                />
                {ar ? "ثانية على أي صفحة" : "seconds on any page"}
              </label>
            )}
            <div className="flex gap-2 pt-1">
              <button className="btn-primary h-9 flex-1" disabled={busy || !(value > 0)} onClick={create}>
                {busy ? (ar ? "جارٍ الإنشاء…" : "Creating…") : ar ? "إنشاء الكود" : "Create code"}
              </button>
              <button className="btn-ghost h-9 px-3" onClick={() => setOpen(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {offers === null ? (
          <p className="text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
        ) : offers.length === 0 ? (
          !open && (
            <p className="text-sm text-ink-soft">
              {ar
                ? "اصنعي لها كوداً لا يعمل إلا برقمها، وأرسليه أو اعرضيه لها أثناء التصفح."
                : "Make her a code that only works with her phone, then send it or pop it up while she browses."}
            </p>
          )
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => {
              const st = status(o);
              return (
                <li key={o.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold tracking-wider text-ink">{o.code}</span>
                    <Badge className={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {o.label} · {ar ? "حتى" : "until"}{" "}
                    {new Date(o.endsAt).toLocaleString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {o.popup ? (ar ? " · نافذة منبثقة" : " · popup") : ""}
                  </div>
                  {st.live && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button className="btn-outline h-7 gap-1 px-2 text-xs" onClick={() => copy(o.code)}>
                        <IcCopy className="h-3.5 w-3.5" /> {copied === o.code ? (ar ? "نُسخ" : "Copied") : ar ? "نسخ" : "Copy"}
                      </button>
                      <a
                        className="btn-outline h-7 gap-1 px-2 text-xs text-emerald-700"
                        href={whatsappLink(phone, shareText(o))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <IcWhatsApp className="h-3.5 w-3.5" /> {ar ? "إرسال واتساب" : "Send on WhatsApp"}
                      </a>
                      <button className="btn-ghost h-7 gap-1 px-2 text-xs text-rose-600" onClick={() => cancel(o.id)}>
                        <IcX className="h-3.5 w-3.5" /> {ar ? "إلغاء العرض" : "Withdraw"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
