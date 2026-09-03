"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { RETURN_WINDOW_DAYS } from "@/lib/returns";
import RequestForm from "../returns/request-form";
import GeneralRequestForm from "./general-request-form";

type Mode = "choose" | "return" | "exchange" | "other";

/**
 * One door for everything a shopper might want after buying: send something
 * back, swap it for something else, or just ask a question.
 *
 * Returns and exchanges reuse RequestForm untouched — it already owns the
 * 14-day clock, the per-line quantities and the price difference — so this
 * screen only has to decide which of the three the shopper wants.
 */
export default function RequestHub() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("choose");

  /**
   * Where "here" is once the shopper leaves to sign in.
   *
   * The page is embedded in the theme, so the address worth coming back to is
   * the theme's own /requests URL, which the handler passes in. Anything that
   * isn't a plain same-origin path is ignored, so this can't become an open
   * redirect.
   */
  const home = useMemo(() => {
    const raw = params.get("home") ?? "";
    const safe = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\");
    return safe ? raw : "/shop/requests";
  }, [params]);

  const signInHref = `/store/login?next=${encodeURIComponent(home)}`;
  const back = () => setMode("choose");

  if (mode === "return")
    return <RequestForm kind="return" onBack={back} signInHref={signInHref} />;
  if (mode === "exchange")
    return <RequestForm kind="exchange" onBack={back} signInHref={signInHref} />;
  if (mode === "other") return <GeneralRequestForm onBack={back} />;

  const options: {
    id: Mode;
    icon: string;
    title: string;
    body: string;
    note: string;
  }[] = [
    {
      id: "return",
      icon: "↩︎",
      title: ar ? "استرجاع" : "Return something",
      body: ar
        ? "أرجعي قطعة أو أكثر من طلبك واستردي قيمتها."
        : "Send one or more items back from an order and get the money back.",
      note: ar
        ? `خلال ${RETURN_WINDOW_DAYS} يوماً من تاريخ الطلب`
        : `Within ${RETURN_WINDOW_DAYS} days of your order`,
    },
    {
      id: "exchange",
      icon: "⇄",
      title: ar ? "استبدال" : "Exchange something",
      body: ar
        ? "أرجعي قطعة واختاري غيرها — وسنوضّح الفرق في السعر قبل التأكيد."
        : "Send an item back and pick another — we'll show the price difference before you confirm.",
      note: ar
        ? `خلال ${RETURN_WINDOW_DAYS} يوماً من تاريخ الطلب`
        : `Within ${RETURN_WINDOW_DAYS} days of your order`,
    },
    {
      id: "other",
      icon: "💬",
      title: ar ? "شيء آخر" : "Something else",
      body: ar
        ? "سؤال، شكوى، تعديل عنوان، أو أي شيء آخر تريدين إخبارنا به."
        : "A question, a complaint, an address change, or anything else you want to tell us.",
      note: ar ? "نرد في أقرب وقت" : "We'll get back to you as soon as possible",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {ar ? "كيف يمكننا مساعدتك؟" : "How can we help?"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {ar ? "اختاري ما تريدين فعله." : "Choose what you'd like to do."}
      </p>

      <ul className="mt-6 space-y-3">
        {options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setMode(o.id)}
              className="flex w-full items-start gap-4 rounded-2xl border border-line bg-white p-5 text-start transition-shadow hover:shadow-pop"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700"
              >
                {o.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{o.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{o.body}</span>
                <span className="mt-1.5 block text-xs text-ink-soft">{o.note}</span>
              </span>
              <span aria-hidden className="mt-1 text-ink-soft">
                {ar ? "‹" : "›"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
