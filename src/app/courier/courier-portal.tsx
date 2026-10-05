"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcCourier, IcLocation, IcCash, IcX, IcPlus, IcTrash } from "@/components/icons";
import { SHIPMENT_STATUS, REPORT_OPTIONS, COLLECTION_METHODS, COLLECTED_STATUSES, collectionMethodLabel, type Shipment, type Courier, type ReportStatus, type ShipmentStatus } from "@/lib/courier";
import { courierLogin, courierLogout, getMyAssignments, submitMyReport, uploadCourierProof } from "./actions";

/**
 * The courier's own portal (mobile-first). They sign in with phone + PIN, see
 * their assigned orders, and report each one's outcome + cash collected. The
 * report lands as pending — the shop confirms it before it touches the books.
 * Standalone: no admin chrome, its own tiny language toggle.
 */
const egp = (v: number, ar: boolean) => `${ar ? "ج.م" : "EGP"} ${v.toLocaleString("en-EG", { minimumFractionDigits: 0 })}`;

export function CourierPortal() {
  const [ar, setAr] = useState(true);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Shipment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMyAssignments();
    if (res.ok) { setCourier(res.data.courier); setShipments(res.data.shipments); }
    else { setCourier(null); setShipments([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const t = (en: string, arr: string) => (ar ? arr : en);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-400" dir={ar ? "rtl" : "ltr"}>…</div>;
  }

  if (!courier) {
    return <LoginScreen ar={ar} setAr={setAr} onLoggedIn={load} />;
  }

  const active = shipments.filter((s) => s.status === "assigned" || s.status === "out_for_delivery");
  const done = shipments.filter((s) => s.status !== "assigned" && s.status !== "out_for_delivery");

  return (
    <div className="min-h-screen bg-slate-50" dir={ar ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15"><IcCourier className="h-5 w-5" /></span>
            <div>
              <div className="text-sm font-bold leading-tight">{courier.name}</div>
              <div className="text-[11px] text-white/70">{courier.zone || t("Courier", "مندوب")}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setAr((v) => !v)} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{ar ? "EN" : "ع"}</button>
            <button onClick={async () => { await courierLogout(); load(); }} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">{t("Sign out", "خروج")}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-2xl font-bold text-slate-900">{active.length}</div>
            <div className="text-xs text-slate-500">{t("To deliver", "للتوصيل")}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-2xl font-bold text-emerald-600">{done.length}</div>
            <div className="text-xs text-slate-500">{t("Completed", "منجزة")}</div>
          </div>
        </div>

        <Section title={t("Active deliveries", "التوصيلات النشطة")} count={active.length}>
          {active.length === 0 ? (
            <Empty text={t("Nothing to deliver right now.", "لا يوجد توصيلات حالياً.")} />
          ) : (
            active.map((s) => <ShipmentCard key={s.id} s={s} ar={ar} onReport={() => setReport(s)} />)
          )}
        </Section>

        {done.length > 0 && (
          <Section title={t("History", "السجل")} count={done.length}>
            {done.map((s) => <ShipmentCard key={s.id} s={s} ar={ar} />)}
          </Section>
        )}
      </main>

      {report && (
        <ReportModal
          ar={ar}
          shipment={report}
          onClose={() => setReport(null)}
          onDone={async () => { setReport(null); await load(); }}
        />
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-black/5">{text}</div>;
}

function ShipmentCard({ s, ar, onReport }: { s: Shipment; ar: boolean; onReport?: () => void }) {
  const st = SHIPMENT_STATUS[s.status];
  const addr = [s.address, s.city, s.governorate].filter(Boolean).join("، ");
  const toneClass = {
    neutral: "bg-slate-100 text-slate-600", info: "bg-sky-100 text-sky-700", success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700", critical: "bg-rose-100 text-rose-700",
  }[st.tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">#{s.orderNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{ar ? st.ar : st.en}</span>
          </div>
          <div className="mt-0.5 text-sm text-slate-700">{s.customerName || "—"}</div>
        </div>
        <div className="text-end">
          <div className="text-sm font-bold text-slate-900">{egp(s.orderTotal ?? 0, ar)}</div>
          <div className="text-[11px] text-slate-400">{ar ? "الأجر" : "Fee"} {egp(s.fee, ar)}</div>
        </div>
      </div>

      {addr && (
        <a href={`https://www.google.com/maps/search/${encodeURIComponent(addr + ", Egypt")}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <IcLocation className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span dir="auto">{addr}</span>
        </a>
      )}
      {s.phone && <a href={`tel:${s.phone}`} className="mt-1 inline-block text-xs font-medium text-brand-600" dir="ltr">{s.phone}</a>}

      {s.items && s.items.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center gap-2 overflow-x-auto">
            {s.items.slice(0, 5).map((it, i) => (
              <div key={i} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px] text-slate-400">—</span>
                )}
                <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">{it.quantity}</span>
              </div>
            ))}
            {s.items.length > 5 && <span className="shrink-0 text-xs text-slate-400">+{s.items.length - 5}</span>}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">{ar ? "المطلوب تحصيله" : "To collect"}</span>
            <span className="font-bold text-slate-900">{egp(s.collectAmount ?? s.orderTotal ?? 0, ar)}</span>
          </div>
        </div>
      )}

      {s.reportedStatus ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {ar ? "تم الإرسال — بانتظار تأكيد المتجر" : "Submitted — waiting for the shop to confirm"}
        </div>
      ) : onReport ? (
        <button onClick={onReport} className="mt-3 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">
          {ar ? "تحديث الحالة" : "Update status"}
        </button>
      ) : null}
    </div>
  );
}

function LoginScreen({ ar, setAr, onLoggedIn }: { ar: boolean; setAr: (v: boolean) => void; onLoggedIn: () => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!phone.trim() || !pin.trim()) return;
    setBusy(true); setErr(null);
    const res = await courierLogin(phone, pin);
    setBusy(false);
    if (res.ok) onLoggedIn();
    else setErr(ar ? "هاتف أو رقم سري غير صحيح." : "Wrong phone or PIN.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-700 to-brand-900 p-4" dir={ar ? "rtl" : "ltr"}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-white/15"><IcCourier className="h-7 w-7" /></span>
          <h1 className="text-xl font-bold">{ar ? "بوابة المندوبين" : "Courier portal"}</h1>
          <p className="mt-1 text-sm text-white/70">{ar ? "سجّلي الدخول لرؤية طلباتك" : "Sign in to see your deliveries"}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-xl">
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{ar ? "رقم الهاتف" : "Phone"}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" className={fieldClass} placeholder="01xxxxxxxxx" />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{ar ? "الرقم السري" : "PIN"}</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" dir="ltr" className={fieldClass} />
          </label>
          {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50">{busy ? "…" : ar ? "دخول" : "Sign in"}</button>
          <button onClick={() => setAr(!ar)} className="mt-3 w-full text-center text-xs text-slate-400">{ar ? "English" : "العربية"}</button>
        </div>
      </div>
    </div>
  );
}

type Part = { amount: string; method: string };

function ReportModal({ ar, shipment, onClose, onDone }: { ar: boolean; shipment: Shipment; onClose: () => void; onDone: () => void }) {
  const target = shipment.collectAmount ?? shipment.orderTotal ?? 0;
  const [status, setStatus] = useState<ReportStatus>("delivered");
  const [parts, setParts] = useState<Part[]>([{ amount: target ? String(target) : "", method: "cash" }]);
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const collected = COLLECTED_STATUSES.includes(status as ShipmentStatus);
  const partsSum = parts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const items = shipment.items ?? [];
  const adminPlan = (shipment.payments ?? []).filter((p) => p.actor === "admin" && p.kind === "payment");
  const deposit = shipment.depositPlanned ?? 0;

  function setPart(i: number, patch: Partial<Part>) {
    setParts((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, { amount: "", method: "cash" }]);
  }
  function removePart(i: number) {
    setParts((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagInput("");
  }

  async function onPickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setErr(null);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const res = await uploadCourierProof(dataUrl, file.name);
        if (res.ok) setImages((prev) => [...prev, res.data.url]);
        else setErr(ar ? "تعذّر رفع إحدى الصور." : "Couldn't upload a photo.");
      } catch {
        setErr(ar ? "تعذّر رفع إحدى الصور." : "Couldn't upload a photo.");
      }
    }
    setUploading(false);
  }

  async function submit() {
    setBusy(true); setErr(null);
    const payments = parts
      .map((p) => ({ amount: Number(p.amount) || 0, method: p.method }))
      .filter((p) => p.amount > 0);
    const res = await submitMyReport(shipment.id, {
      status,
      cashCollected: collected ? payments.reduce((sum, p) => sum + p.amount, 0) : 0,
      method: payments[0]?.method ?? "cash",
      payments: collected ? payments : undefined,
      note,
      proofUrl: images[0] ?? null,
      images,
      tags,
    });
    setBusy(false);
    if (res.ok) onDone(); else setErr(ar ? "تعذّر الإرسال." : "Couldn't submit.");
  }

  return (
    <Modal
      title={ar ? `تحديث الطلب #${shipment.orderNumber}` : `Update order #${shipment.orderNumber}`}
      subtitle={shipment.customerName ?? undefined}
      icon={IcCash}
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "إرسال" : "Submit"}</button>
        </>
      }
    >
      <div className="space-y-3">
        {/* The real order: what the courier is delivering + collecting. */}
        {items.length > 0 && (
          <div className="rounded-xl border border-line bg-surface-page/50">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-muted">{ar ? "الأصناف المُسلَّمة" : "Items to deliver"}</div>
            <div className="divide-y divide-line">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{it.productName}</div>
                    {it.variantTitle && <div className="text-[11px] text-ink-soft">{it.variantTitle}</div>}
                  </div>
                  <div className="text-end text-xs">
                    <div className="text-ink-muted">{egp(it.price, ar)} × {it.quantity}</div>
                    <div className="font-semibold text-ink">{egp(it.price * it.quantity, ar)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-line px-3 py-2 text-xs">
              {(shipment.discountAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>{ar ? "خصم" : "Discount"}{shipment.discountCode ? ` · ${shipment.discountCode}` : ""}</span>
                  <span>-{egp(shipment.discountAmount ?? 0, ar)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{ar ? "المطلوب تحصيله" : "To collect"}</span>
                <span>{egp(target, ar)}</span>
              </div>
            </div>
          </div>
        )}

        {/* The shop's deposit + planned split, so the courier knows the plan. */}
        {(deposit > 0 || adminPlan.length > 0) && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {deposit > 0 && <div className="flex items-center justify-between"><span>{ar ? "وديعة" : "Deposit"}</span><span className="font-semibold">{egp(deposit, ar)}</span></div>}
            {adminPlan.length > 0 && (
              <div className="mt-1">
                <div className="mb-0.5 font-semibold">{ar ? "خطة التحصيل من المتجر" : "Shop's collection plan"}</div>
                {adminPlan.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{collectionMethodLabel(p.method, ar)}</span>
                    <span>{egp(p.amount, ar)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label={ar ? "الحالة" : "Outcome"}>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setStatus(o.value)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${status === o.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-muted"}`}>
                {ar ? o.ar : o.en}
              </button>
            ))}
          </div>
        </Field>
        {collected && (
          <Field label={ar ? "المبلغ المُحصَّل (يمكن تقسيمه)" : "Amount collected (can be split)"}>
            <div className="space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.amount}
                    onChange={(e) => setPart(i, { amount: e.target.value.replace(/[^\d.]/g, "") })}
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="0"
                    className={`${fieldClass} flex-1`}
                  />
                  <select value={p.method} onChange={(e) => setPart(i, { method: e.target.value })} className={`${fieldClass} w-28`}>
                    {COLLECTION_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removePart(i)}
                    disabled={parts.length <= 1}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-ink-soft disabled:opacity-30"
                    aria-label={ar ? "إزالة" : "Remove"}
                  >
                    <IcTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPart} className="flex items-center gap-1 text-xs font-medium text-brand-600">
                <IcPlus className="h-3.5 w-3.5" /> {ar ? "إضافة طريقة دفع" : "Add a payment method"}
              </button>
              <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${Math.abs(partsSum - target) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                <span>{ar ? "الإجمالي" : "Total"}: <span className="font-bold">{egp(partsSum, ar)}</span></span>
                <span>{ar ? "المطلوب" : "Target"}: {egp(target, ar)}</span>
              </div>
            </div>
          </Field>
        )}

        {/* Proof of delivery photos (one or more) */}
        <Field label={ar ? "صور إثبات التسليم" : "Proof of delivery"}>
          <div className="flex flex-wrap items-center gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white shadow"
                  aria-label={ar ? "إزالة" : "Remove"}
                >
                  <IcX className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className={`flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-center text-[11px] ${uploading ? "opacity-60" : "text-ink-muted hover:bg-surface-page"}`}>
              <span className="text-lg leading-none">📷</span>
              {uploading ? (ar ? "رفع…" : "…") : (ar ? "إضافة" : "Add")}
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onPickPhotos(e.target.files)} disabled={uploading} />
            </label>
          </div>
        </Field>

        {/* Tags */}
        <Field label={ar ? "الوسوم" : "Tags"}>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tg) => (
                <span key={tg} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  {tg}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== tg))} aria-label={ar ? "إزالة" : "Remove"}>
                    <IcX className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            onBlur={() => addTag(tagInput)}
            placeholder={ar ? "اكتب وسماً ثم Enter" : "Type a tag, press Enter"}
            className={fieldClass}
          />
        </Field>
        <Field label={ar ? "ملاحظة (اختياري)" : "Note (optional)"}><input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{ar ? "سيراجع المتجر تقريرك قبل اعتماده." : "The shop reviews your report before it's finalised."}</p>
      </div>
    </Modal>
  );
}
