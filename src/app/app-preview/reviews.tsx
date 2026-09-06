"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Btn, Empty, Field, Note, Spinner } from "./ui";

/**
 * The Reviews and Happy Customers screens.
 *
 * Both are pages the website has always had and the app could not see, which
 * is why they turned up in the menu as dead "external" links. Happy Customers
 * is the same list narrowed to the reviews the merchant featured — publishing
 * says a review may be shown, featuring says it earns a place there.
 */

type Review = {
  id: string;
  name: string;
  productRating: number | null;
  shippingRating: number | null;
  supportRating: number | null;
  comment: string | null;
  featured: boolean;
  createdAt: string;
};

function Stars({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span className="text-xs tracking-tight text-amber-500" aria-label={`${value} / 5`}>
      {"★".repeat(value)}
      <span className="text-slate-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function Reviews({ ar, featuredOnly }: { ar: boolean; featuredOnly: boolean }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(() => {
    setReviews(null);
    setError(null);
    api
      .get<{ reviews: Review[]; averageProductRating: number | null }>(
        `/reviews${featuredOnly ? "?featured=1" : ""}`,
      )
      .then((r) => {
        if (!r.ok) return setError(r.error);
        setReviews(r.data.reviews);
        setAverage(r.data.averageProductRating);
      });
  }, [featuredOnly]);
  useEffect(load, [load]);

  if (writing) return <WriteReview ar={ar} onDone={() => { setWriting(false); load(); }} />;
  if (error)
    return (
      <div className="space-y-3">
        <Note tone="bad">
          <code className="font-mono text-[11px]">{error}</code>
        </Note>
        <Btn variant="outline" full onClick={load}>
          {ar ? "إعادة المحاولة" : "Try again"}
        </Btn>
      </div>
    );
  if (!reviews) return <Spinner />;

  return (
    <div className="space-y-3">
      {average != null && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
          <span className="text-lg font-bold text-amber-700">{average}</span>
          <Stars value={Math.round(average)} />
          <span className="ms-auto text-xs text-amber-800">
            {reviews.length} {ar ? "تقييم" : "reviews"}
          </span>
        </div>
      )}

      {!featuredOnly && (
        <Btn variant="outline" full onClick={() => setWriting(true)}>
          {ar ? "اكتبي تقييمك" : "Write a review"}
        </Btn>
      )}

      {reviews.length === 0 ? (
        <Empty>
          {featuredOnly
            ? ar
              ? "لم يتم اختيار تقييمات بعد"
              : "No reviews have been featured yet"
            : ar
              ? "لا توجد تقييمات منشورة"
              : "No published reviews yet"}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                {r.featured && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    ★
                  </span>
                )}
                <span className="ms-auto">
                  <Stars value={r.productRating} />
                </span>
              </div>
              {r.comment && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{r.comment}</p>
              )}
              <div className="mt-1.5 text-[10px] text-slate-400">{r.createdAt.slice(0, 10)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WriteReview({ ar, onDone }: { ar: boolean; onDone: () => void }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await api.post<{ pending: boolean }>("/reviews", {
      name,
      comment,
      productRating: stars,
    });
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "bad", text: res.error });
    setMsg({
      tone: "good",
      text: ar
        ? "شكراً — تقييمك في انتظار المراجعة."
        : "Thank you — your review is waiting to be approved.",
    });
    setTimeout(onDone, 1400);
  }

  return (
    <div className="space-y-3">
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <Field label={ar ? "الاسم" : "Name"} value={name} onChange={setName} />
      <div>
        <span className="text-xs font-medium text-slate-600">{ar ? "التقييم" : "Rating"}</span>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              aria-label={`${n}`}
              className={`text-2xl leading-none ${n <= stars ? "text-amber-500" : "text-slate-300"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">{ar ? "رأيك" : "Your review"}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-violet-500"
        />
      </label>
      <Btn full onClick={send} disabled={busy || (!comment && !name)}>
        {busy ? "…" : ar ? "إرسال" : "Send"}
      </Btn>
      <p className="text-[11px] leading-relaxed text-slate-500">
        {ar
          ? "التقييمات تظهر بعد مراجعتها من لوحة التحكم."
          : "Reviews appear once someone approves them in the dashboard."}
      </p>
    </div>
  );
}
