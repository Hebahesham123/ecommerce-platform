"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { say, type Copy } from "@/lib/page-copy";
import { loginWithPhone } from "../auth-actions";

function LoginForm({ copy }: { copy: Copy }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const params = useSearchParams();

  const [phone, setPhone] = useState(params.get("phone") ?? "");

  /**
   * Where to land after signing in. Shoppers reach this page from the Requests
   * screen as often as from the header, and sending them to their account
   * instead of back to the return they were starting loses the thread.
   *
   * Only a plain same-origin path is honoured — never a scheme or a
   * protocol-relative "//evil.com" — so this can't become an open redirect.
   */
  const rawNext = params.get("next") ?? "";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
      ? rawNext
      : null;
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
      router.push(next ?? "/store/account");
      router.refresh();
      return;
    }
    // No account for this number (or it was never verified) → sign up, carrying
    // the number across so it isn't retyped.
    if (res.error === "not_registered") {
      router.push(
        `/store/signup?phone=${encodeURIComponent(phone)}` +
          (next ? `&next=${encodeURIComponent(next)}` : ""),
      );
      return;
    }
    setErr(
      res.error === "invalid_phone"
        ? (ar ? "رقم هاتف غير صحيح" : "Invalid phone number")
        : (ar ? "تعذّر تسجيل الدخول" : "Could not sign in"),
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(43,27,16,0.04)] sm:p-8">
      <h1 className="store-display text-[28px] font-bold leading-tight text-ink">
        {say(copy, "heading", ar) || (ar ? "تسجيل الدخول" : "Log in")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {say(copy, "subtitle", ar) ||
          (ar ? "أدخلي رقم هاتفك للدخول إلى حسابك." : "Enter your phone number to access your account.")}
      </p>

      <div className="mt-6 space-y-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={say(copy, "phonePlaceholder", ar) || (ar ? "رقم الهاتف" : "Phone number")}
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
          {busy
            ? ar
              ? "جارٍ الدخول…"
              : "Logging in…"
            : say(copy, "submit", ar) || (ar ? "دخول" : "Log in")}
        </button>
      </div>

      {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
        {say(copy, "signupPrompt", ar) || (ar ? "ليس لديك حساب؟" : "No account yet?")}{" "}
        <Link href="/store/signup" className="font-semibold text-brand-600 hover:underline">
          {say(copy, "signupLink", ar) || (ar ? "إنشاء حساب" : "Sign up")}
        </Link>
      </p>
      </div>
    </div>
  );
}

export function LoginPage({ copy }: { copy: Copy }) {
  return (
    <Suspense fallback={null}>
      <LoginForm copy={copy} />
    </Suspense>
  );
}
