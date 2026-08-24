"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { loginWithPhone } from "../auth-actions";

function LoginForm() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const params = useSearchParams();

  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setErr(ar ? "أدخلي رقم هاتف صحيح" : "Enter a valid phone number");
      return;
    }
    setBusy(true);
    const res = await loginWithPhone(phone);
    setBusy(false);

    if (res.ok) {
      router.push("/store/account");
      router.refresh();
      return;
    }
    // No account for this number (or it was never verified) → sign up, carrying
    // the number across so it isn't retyped.
    if (res.error === "not_registered") {
      router.push(`/store/signup?phone=${encodeURIComponent(phone)}`);
      return;
    }
    setErr(
      res.error === "invalid_phone"
        ? (ar ? "رقم هاتف غير صحيح" : "Invalid phone number")
        : (ar ? "تعذّر تسجيل الدخول" : "Could not sign in"),
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {ar ? "تسجيل الدخول" : "Log in"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {ar ? "أدخلي رقم هاتفك للدخول إلى حسابك." : "Enter your phone number to access your account."}
      </p>

      <div className="mt-6 space-y-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={ar ? "رقم الهاتف" : "Phone number"}
          className="h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
        />
        <button
          onClick={submit}
          disabled={busy}
          className="btn-primary h-12 w-full justify-center text-base disabled:opacity-60"
        >
          {busy ? (ar ? "جارٍ الدخول…" : "Logging in…") : (ar ? "دخول" : "Log in")}
        </button>
      </div>

      {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

      <p className="mt-6 text-center text-sm text-ink-muted">
        {ar ? "ليس لديك حساب؟" : "No account yet?"}{" "}
        <Link href="/store/signup" className="font-semibold text-brand-600 hover:underline">
          {ar ? "إنشاء حساب" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
