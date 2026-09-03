"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { submitGeneralRequest } from "./actions";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * The "something else" form: everything that isn't a return or an exchange.
 *
 * It posts through a server action rather than a browser Supabase client, so
 * no key travels with the page — which is the whole reason the previous static
 * widget's submissions never reached the dashboard.
 */
export default function GeneralRequestForm({ onBack }: { onBack?: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    name.trim().length > 0 && message.trim().length > 0 && emailOk && !busy;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked: File[] = [];
    for (const f of Array.from(list)) {
      if (!/^(image|video)\//.test(f.type)) continue;
      // Rejected here as well as on the server, so the shopper is told why
      // instead of watching a large upload silently vanish.
      if (f.size > MAX_FILE_BYTES) {
        setErr(ar ? "الملف أكبر من ٢٥ ميجابايت" : "That file is larger than 25MB");
        continue;
      }
      picked.push(f);
    }
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    const form = new FormData();
    form.set("name", name);
    form.set("email", email);
    form.set("phone", phone);
    form.set("orderNumber", orderNumber);
    form.set("message", message);
    for (const f of files) form.append("attachments", f);

    const res = await submitGeneralRequest(form);
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.error === "migration_missing"
          ? ar
            ? "لم يتم تفعيل هذه الخاصية بعد."
            : "This feature isn't set up yet."
          : ar
            ? "تعذّر إرسال الطلب، حاولي مرة أخرى."
            : "Could not send your request, please try again.",
      );
      return;
    }
    setDone(res.data.reference);
    setName("");
    setEmail("");
    setPhone("");
    setOrderNumber("");
    setMessage("");
    setFiles([]);
  }

  const backLink = onBack && (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <span aria-hidden>{ar ? "→" : "←"}</span>
      {ar ? "رجوع" : "Back"}
    </button>
  );

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        {backLink}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="text-base font-semibold text-emerald-800">
            {ar ? "تم استلام طلبك" : "Request received"} — <span dir="ltr">{done}</span>
          </div>
          <p className="mt-1.5 text-sm text-emerald-800">
            {ar ? "سنتواصل معك في أقرب وقت." : "We'll get back to you as soon as possible."}
          </p>
        </div>
      </div>
    );
  }

  const field =
    "h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-xl py-8">
      {backLink}
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {ar ? "أرسلي طلباً" : "Submit a request"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {ar ? "سنرد عليك في أقرب وقت ممكن." : "We'll get back to you as soon as possible."}
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-ink">
            {ar ? "الاسم" : "Full name"} <span className="text-rose-500">*</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ar ? "اكتبي اسمك" : "Enter your full name"}
            className={`mt-1.5 ${field}`}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink">{ar ? "البريد الإلكتروني" : "Email"}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            dir="ltr"
            inputMode="email"
            className={`mt-1.5 ${field}`}
          />
          {!emailOk && (
            <span className="mt-1 block text-xs font-medium text-rose-600">
              {ar ? "بريد إلكتروني غير صحيح" : "That email doesn't look right"}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink">{ar ? "رقم الهاتف" : "Phone number"}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={ar ? "رقم هاتفك" : "Your phone number"}
            dir="ltr"
            inputMode="tel"
            className={`mt-1.5 ${field}`}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink">
            {ar ? "تفاصيل الطلب" : "Request details"} <span className="text-rose-500">*</span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder={ar ? "اشرحي طلبك بالتفصيل…" : "Please describe your request in detail…"}
            className="mt-1.5 w-full rounded-xl border border-line bg-white p-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink">
            {ar ? "رقم الطلب (اختياري)" : "Order number (optional)"}
          </span>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="BB12345678"
            dir="ltr"
            className={`mt-1.5 ${field}`}
          />
        </label>

        <div>
          <span className="text-sm font-semibold text-ink">
            {ar ? "صور أو فيديو (اختياري)" : "Photos or video (optional)"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="mt-1.5 block w-full text-sm text-ink-muted file:me-3 file:rounded-lg file:border-0 file:bg-surface-page file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-surface-page px-3 py-2 text-xs text-ink-muted"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="ms-3 shrink-0 font-medium text-rose-600"
                  >
                    {ar ? "حذف" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="text-sm font-medium text-rose-600">{err}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary h-12 w-full justify-center text-base disabled:opacity-60"
        >
          {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال الطلب" : "Submit request"}
        </button>
      </div>
    </div>
  );
}
