"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { startSignup, completeSignup } from "../auth-actions";

type Step = "details" | "code";
type Channel = "whatsapp" | "sms";

function SignupForm() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const params = useSearchParams();

  const [name, setName] = useState("");
  // Arriving from login with an unrecognised number: carry it over so it isn't
  // typed twice.
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("details");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);

  const phoneOk = phone.replace(/\D/g, "").length >= 10;

  async function send(ch: Channel) {
    setErr(null);
    setExisting(false);
    if (!name.trim()) { setErr(ar ? "أدخلي اسمك" : "Enter your name"); return; }
    if (!phoneOk) { setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number"); return; }

    setBusy(true);
    setChannel(ch);
    const res = await startSignup(phone, ch);
    setBusy(false);

    if (!res.ok) {
      if (res.error === "already_registered") {
        // The number is already verified — signing up again would wait on a
        // code that never gets sent, so point them at login instead.
        setExisting(true);
        return;
      }
      setErr(
        res.error === "invalid_phone"
          ? (ar ? "رقم هاتف غير صحيح" : "Invalid phone number")
          : (ar ? "تعذّر إرسال الكود، حاولي مرة أخرى" : "Couldn't send the code, please try again"),
      );
      return;
    }
    if (!res.data.sent) {
      setErr(ar ? "تعذّر إرسال الكود، حاولي مرة أخرى" : "Couldn't send the code, please try again");
      return;
    }
    setCode("");
    setStep("code");
  }

  async function submit() {
    setErr(null);
    if (code.trim().length < 4) return;
    setBusy(true);
    const res = await completeSignup(name, phone, code);
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.error === "wrong_code" ? (ar ? "الكود غير صحيح" : "Wrong code")
          : res.error === "expired" ? (ar ? "انتهت صلاحية الكود" : "Code expired")
          : res.error === "no_code" ? (ar ? "لم يُرسل كود بعد" : "No code was sent yet")
          : (ar ? "تعذّر إنشاء الحساب" : "Could not create the account"),
      );
      return;
    }
    router.push("/store/account");
    router.refresh();
  }

  const field =
    "h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {ar ? "إنشاء حساب" : "Create an account"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {step === "details"
          ? (ar ? "سنرسل لك كود تحقق لتأكيد رقمك." : "We'll send you a code to confirm your number.")
          : (ar ? `أدخلي الكود المرسل عبر ${channel === "whatsapp" ? "واتساب" : "الرسائل"} إلى ${phone}` : `Enter the code sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"} to ${phone}`)}
      </p>

      {step === "details" ? (
        <div className="mt-6 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ar ? "الاسم" : "Name"}
            className={field}
            autoComplete="name"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send("whatsapp"); }}
            placeholder={ar ? "رقم الهاتف" : "Phone number"}
            className={field}
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
          />

          {existing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              {ar ? "هذا الرقم لديه حساب بالفعل." : "This number already has an account."}{" "}
              <Link href={`/store/login?phone=${encodeURIComponent(phone)}`} className="font-semibold underline">
                {ar ? "تسجيل الدخول" : "Log in instead"}
              </Link>
            </div>
          )}

          <button
            onClick={() => send("whatsapp")}
            disabled={busy}
            className="btn-primary h-12 w-full justify-center text-base disabled:opacity-60"
          >
            {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الكود" : "Send code")}
          </button>
          <button
            onClick={() => send("sms")}
            disabled={busy}
            className="w-full py-2 text-sm text-ink-muted hover:text-ink disabled:opacity-60"
          >
            {ar ? "أرسليه عبر SMS بدلاً من ذلك" : "Send via SMS instead"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submit(); }}
            placeholder="000000"
            className="h-12 w-full rounded-xl border border-line bg-white text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-brand-500"
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />
          <button
            onClick={submit}
            disabled={busy || code.length < 4}
            className="btn-primary h-12 w-full justify-center text-base disabled:opacity-60"
          >
            {busy ? (ar ? "جارٍ التأكيد…" : "Verifying…") : (ar ? "تأكيد وإنشاء الحساب" : "Verify & create account")}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-muted">
            <span>{ar ? "لم يصلك الكود؟" : "Didn't get it?"}</span>
            <button onClick={() => send("whatsapp")} disabled={busy} className="font-semibold text-emerald-700 hover:underline">
              {ar ? "عبر واتساب" : "WhatsApp"}
            </button>
            <span>·</span>
            <button onClick={() => send("sms")} disabled={busy} className="font-semibold text-brand-600 hover:underline">
              {ar ? "عبر SMS" : "SMS"}
            </button>
          </div>
          <button
            onClick={() => { setStep("details"); setErr(null); }}
            className="w-full py-1 text-sm text-ink-muted hover:text-ink"
          >
            {ar ? "تغيير الرقم" : "Change number"}
          </button>
        </div>
      )}

      {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

      <p className="mt-6 text-center text-sm text-ink-muted">
        {ar ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
        <Link href="/store/login" className="font-semibold text-brand-600 hover:underline">
          {ar ? "تسجيل الدخول" : "Log in"}
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
