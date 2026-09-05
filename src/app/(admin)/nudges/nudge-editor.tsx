"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ALL_PAGES,
  PAGE_LABELS,
  POSITION_LABELS,
  STYLE_LABELS,
  TRIGGER_LABELS,
  campaignProblems,
  type NudgeCampaign,
  type NudgePage,
  type NudgeStyle,
  type NudgePosition,
  type WheelSegment,
} from "@/lib/nudge";
import type { OfferableCode } from "./actions";
import { Card } from "@/components/ui";
import { IcAlert, IcPlus, IcTrash } from "@/components/icons";

/* ------------------------------- small parts ------------------------------ */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 ${inputCls}`}
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  min = 1,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-50" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          min={min}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
          className={`${inputCls} w-28`}
        />
        {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        {desc && <span className="mt-0.5 block text-xs text-ink-soft">{desc}</span>}
      </span>
    </label>
  );
}

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-1"
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} dir="ltr" />
      </div>
    </label>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-xl border p-3 text-start transition-colors ${
            value === o.value
              ? "border-brand-600 bg-brand-50"
              : "border-line hover:bg-surface-hover"
          }`}
        >
          <span
            className={`block text-sm font-semibold ${value === o.value ? "text-brand-700" : "text-ink"}`}
          >
            {o.label}
          </span>
          {o.desc && <span className="mt-0.5 block text-xs text-ink-soft">{o.desc}</span>}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- preview -------------------------------- */

/**
 * What the shopper will see. Deliberately a separate rendering from the
 * injected script: this one only has to look right, so it stays readable
 * rather than trying to share code with something that must survive an
 * arbitrary theme's CSS.
 */
function Preview({ c }: { c: NudgeCampaign }) {
  const wheel = c.style === "wheel" && c.wheelSegments.length > 1;
  const slice = wheel ? 360 / c.wheelSegments.length : 0;
  const gradient = wheel
    ? `conic-gradient(${c.wheelSegments
        .map(
          (_, i) =>
            `${i % 2 ? "rgba(255,255,255,.92)" : c.accentColor} ${i * slice}deg ${(i + 1) * slice}deg`,
        )
        .join(",")})`
    : undefined;

  return (
    <div className="flex min-h-[380px] items-center justify-center rounded-2xl bg-slate-900/90 p-6">
      <div
        className="w-full max-w-[340px] rounded-[18px] p-6 text-center shadow-2xl"
        style={{ background: c.backgroundColor, color: c.textColor }}
      >
        {c.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.imageUrl}
            alt=""
            className="mb-3.5 h-28 w-full rounded-xl object-cover"
          />
        )}
        <h2 className="text-[20px] font-extrabold leading-tight">{c.headline || "—"}</h2>
        {c.body && <p className="mt-2 text-[14px] leading-relaxed opacity-75">{c.body}</p>}

        {wheel && (
          <div className="relative mx-auto mt-4 h-[180px] w-[180px]">
            <div
              className="h-full w-full rounded-full"
              style={{ background: gradient, border: `6px solid ${c.accentColor}` }}
            />
            <div
              className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: `16px solid ${c.accentColor}`,
              }}
            />
          </div>
        )}

        {c.style === "capture" && (
          <>
            {c.captureLabel && (
              <p className="mt-3 text-[13.5px] opacity-70">{c.captureLabel}</p>
            )}
            <div className="mt-3 rounded-xl border border-current/25 px-3.5 py-3 text-start text-sm opacity-45">
              you@email.com
            </div>
          </>
        )}

        {c.style === "card" && (
          <div
            className="mt-4 rounded-xl border-[1.5px] border-dashed px-3.5 py-3 text-[19px] font-extrabold tracking-[0.08em]"
            style={{ borderColor: c.accentColor }}
          >
            {c.discountCode || "NO CODE"}
          </div>
        )}

        <div
          className="mt-3.5 rounded-xl px-4 py-3 text-[15px] font-bold text-white"
          style={{ background: c.accentColor }}
        >
          {c.buttonLabel || "—"}
        </div>
        {c.dismissLabel && (
          <div className="mt-2 py-1.5 text-[13.5px] opacity-60">{c.dismissLabel}</div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- editor --------------------------------- */

export function NudgeEditor({
  initial,
  codes,
  onSave,
  saving,
}: {
  initial: NudgeCampaign;
  codes: OfferableCode[];
  onSave: (c: NudgeCampaign) => void;
  saving: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [c, setC] = useState<NudgeCampaign>(initial);
  const set = <K extends keyof NudgeCampaign>(k: K, v: NudgeCampaign[K]) =>
    setC((prev) => ({ ...prev, [k]: v }));

  const problems = useMemo(() => campaignProblems(c), [c]);

  const togglePage = (p: NudgePage) =>
    set(
      "pages",
      c.pages.includes(p) ? c.pages.filter((x) => x !== p) : [...c.pages, p],
    );

  const setSegment = (i: number, patch: Partial<WheelSegment>) =>
    set(
      "wheelSegments",
      c.wheelSegments.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  const problemText: Record<string, string> = {
    no_triggers: ar
      ? "لم تختاري أي إشارة — لن يظهر الإعلان أبداً."
      : "No signal is switched on, so this can never fire.",
    no_pages: ar
      ? "لم تختاري أي صفحة."
      : "No page is selected, so there is nowhere for it to appear.",
    no_code: ar
      ? "لم تختاري كود خصم."
      : "No discount code chosen — the popup would offer nothing.",
    wheel_needs_segments: ar
      ? "العجلة تحتاج قسمين على الأقل."
      : "A wheel needs at least two segments.",
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {problems.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <IcAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              {problems.map((p) => (
                <div key={p}>{problemText[p] ?? p}</div>
              ))}
            </div>
          </div>
        )}

        <Section
          title={ar ? "التشغيل" : "Live"}
          hint={
            ar
              ? "لن يظهر شيء للعملاء حتى تفعّليه."
              : "Nothing appears to shoppers until this is on."
          }
        >
          <Toggle
            checked={c.enabled}
            onChange={(v) => set("enabled", v)}
            title={ar ? "الإعلان مُفعّل" : "Campaign is live"}
            desc={
              ar
                ? "يظهر للعملاء على المتجر."
                : "Shown to shoppers on the storefront."
            }
          />
          <Text label={ar ? "الاسم" : "Name"} value={c.name} onChange={(v) => set("name", v)} />
        </Section>

        <Section
          title={ar ? "متى يظهر" : "When it fires"}
          hint={
            ar
              ? "اختاري ما تعتبرينه تردداً من العميل."
              : "Choose what counts as a shopper hesitating."
          }
        >
          <div className="space-y-4">
            <div>
              <Toggle
                checked={c.dwellEnabled}
                onChange={(v) => set("dwellEnabled", v)}
                title={TRIGGER_LABELS.dwell[lang]}
                desc={
                  ar
                    ? "يحسب الوقت الذي تكون فيه الصفحة أمامه فقط."
                    : "Counts only time the page is actually in front of them."
                }
              />
              {c.dwellEnabled && (
                <div className="mt-2 ps-7">
                  <Num
                    label={ar ? "بعد" : "After"}
                    value={c.dwellSeconds}
                    onChange={(v) => set("dwellSeconds", v)}
                    min={5}
                    suffix={ar ? "ثانية" : "seconds"}
                  />
                </div>
              )}
            </div>

            <Toggle
              checked={c.exitEnabled}
              onChange={(v) => set("exitEnabled", v)}
              title={TRIGGER_LABELS.exit[lang]}
              desc={
                ar
                  ? "المؤشر يخرج من أعلى الصفحة، أو سحب سريع لأعلى على الموبايل."
                  : "Cursor leaving through the top, or a hard flick upward on a phone."
              }
            />

            <div>
              <Toggle
                checked={c.idleEnabled}
                onChange={(v) => set("idleEnabled", v)}
                title={TRIGGER_LABELS.idle[lang]}
                desc={
                  ar
                    ? "لا تمرير ولا نقر ولا حركة."
                    : "No scroll, tap or mouse movement at all."
                }
              />
              {c.idleEnabled && (
                <div className="mt-2 ps-7">
                  <Num
                    label={ar ? "بعد" : "After"}
                    value={c.idleSeconds}
                    onChange={(v) => set("idleSeconds", v)}
                    min={5}
                    suffix={ar ? "ثانية" : "seconds"}
                  />
                </div>
              )}
            </div>

            <div>
              <Toggle
                checked={c.cartEnabled}
                onChange={(v) => set("cartEnabled", v)}
                title={TRIGGER_LABELS.cart[lang]}
                desc={
                  ar
                    ? "لديه منتجات في السلة ولم يذهب للدفع."
                    : "Items sitting in the cart while they keep browsing."
                }
              />
              {c.cartEnabled && (
                <div className="mt-2 ps-7">
                  <Num
                    label={ar ? "بعد" : "After"}
                    value={c.cartSeconds}
                    onChange={(v) => set("cartSeconds", v)}
                    min={5}
                    suffix={ar ? "ثانية" : "seconds"}
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title={ar ? "أين يظهر" : "Where it appears"}>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_PAGES.map((p) => (
              <Toggle
                key={p}
                checked={c.pages.includes(p)}
                onChange={() => togglePage(p)}
                title={PAGE_LABELS[p][lang]}
              />
            ))}
          </div>
          <p className="text-xs text-ink-soft">
            {ar
              ? "لا يظهر أبداً في صفحة الدفع أو الحساب."
              : "Never appears on checkout or account pages."}
          </p>
        </Section>

        <Section
          title={ar ? "كم مرة" : "How often"}
          hint={
            ar
              ? "بدون حد، يصبح الإعلان نفسه سبب المغادرة."
              : "Without a ceiling the popup becomes the reason people leave."
          }
        >
          <div className="flex flex-wrap gap-4">
            <Num
              label={ar ? "مرات في الزيارة" : "Per visit"}
              value={c.maxPerSession}
              onChange={(v) => set("maxPerSession", v)}
              suffix={ar ? "مرة" : "times"}
            />
            <Num
              label={ar ? "فترة الانتظار" : "Then wait"}
              value={c.cooldownHours}
              onChange={(v) => set("cooldownHours", v)}
              min={0}
              suffix={ar ? "ساعة" : "hours"}
            />
          </div>
          <Toggle
            checked={c.skipIfCartEmpty}
            onChange={(v) => set("skipIfCartEmpty", v)}
            title={ar ? "فقط لمن لديه منتجات في السلة" : "Only for shoppers with something in the cart"}
            desc={
              ar
                ? "يوفّر الخصم لمن اقترب فعلاً من الشراء."
                : "Saves the discount for people who were already close to buying."
            }
          />
        </Section>

        <Section title={ar ? "الشكل" : "How it looks"}>
          <Choice<NudgeStyle>
            value={c.style}
            onChange={(v) => set("style", v)}
            options={[
              { value: "card", label: STYLE_LABELS.card[lang] },
              { value: "wheel", label: STYLE_LABELS.wheel[lang] },
              { value: "capture", label: STYLE_LABELS.capture[lang] },
            ]}
          />
          <Choice<NudgePosition>
            value={c.position}
            onChange={(v) => set("position", v)}
            options={(["center", "bottom-right", "bottom-left", "bottom-bar"] as NudgePosition[]).map(
              (p) => ({ value: p, label: POSITION_LABELS[p][lang] }),
            )}
          />
          <Text label={ar ? "العنوان" : "Headline"} value={c.headline} onChange={(v) => set("headline", v)} />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "النص" : "Body"}
            </span>
            <textarea
              value={c.body}
              onChange={(e) => set("body", e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-line bg-surface-page p-3 text-sm text-ink outline-none focus:border-brand-600"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label={ar ? "زر الإجراء" : "Button"} value={c.buttonLabel} onChange={(v) => set("buttonLabel", v)} />
            <Text label={ar ? "زر الرفض" : "Dismiss"} value={c.dismissLabel} onChange={(v) => set("dismissLabel", v)} />
          </div>
          {c.style === "capture" && (
            <Text
              label={ar ? "نص طلب البيانات" : "Capture prompt"}
              value={c.captureLabel}
              onChange={(v) => set("captureLabel", v)}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Color label={ar ? "اللون الأساسي" : "Accent"} value={c.accentColor} onChange={(v) => set("accentColor", v)} />
            <Color label={ar ? "الخلفية" : "Background"} value={c.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
            <Color label={ar ? "لون النص" : "Text"} value={c.textColor} onChange={(v) => set("textColor", v)} />
          </div>
          <Text
            label={ar ? "رابط صورة (اختياري)" : "Image URL (optional)"}
            value={c.imageUrl ?? ""}
            onChange={(v) => set("imageUrl", v || null)}
            placeholder="https://…"
          />
        </Section>

        <Section
          title={ar ? "ماذا يقدّم" : "What it gives away"}
          hint={
            ar
              ? "الأكواد من صفحة الخصومات — لا يمكن عرض كود لا يعمل عند الدفع."
              : "Codes come from your Discounts page, so the popup can never offer one checkout would reject."
          }
        >
          {c.style === "wheel" ? (
            <div className="space-y-2">
              {c.wheelSegments.map((s, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[140px] flex-1">
                    <span className="text-xs text-ink-soft">{ar ? "النص" : "Label"}</span>
                    <input
                      value={s.label}
                      onChange={(e) => setSegment(i, { label: e.target.value })}
                      className={`mt-1 ${inputCls}`}
                    />
                  </label>
                  <label className="min-w-[140px] flex-1">
                    <span className="text-xs text-ink-soft">{ar ? "الكود" : "Code"}</span>
                    <select
                      value={s.code}
                      onChange={(e) => setSegment(i, { code: e.target.value })}
                      className={`mt-1 ${inputCls}`}
                    >
                      <option value="">{ar ? "بدون كود" : "No code"}</option>
                      {codes.map((k) => (
                        <option key={k.code} value={k.code}>
                          {k.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24">
                    <span className="text-xs text-ink-soft">{ar ? "الحظ" : "Weight"}</span>
                    <input
                      type="number"
                      min={0}
                      value={s.weight}
                      onChange={(e) => setSegment(i, { weight: Math.max(0, Number(e.target.value) || 0) })}
                      className={`mt-1 ${inputCls}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      set("wheelSegments", c.wheelSegments.filter((_, j) => j !== i))
                    }
                    className="mb-0.5 rounded-lg p-2 text-rose-600 hover:bg-surface-hover"
                    aria-label="Remove"
                  >
                    <IcTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set("wheelSegments", [
                    ...c.wheelSegments,
                    { label: ar ? "جائزة" : "Prize", code: "", weight: 1 },
                  ])
                }
                className="btn-outline h-9 gap-1.5 px-3 text-sm"
              >
                <IcPlus className="h-4 w-4" />
                {ar ? "إضافة قسم" : "Add segment"}
              </button>
              <p className="text-xs text-ink-soft">
                {ar
                  ? "الحظ نسبي: قسم بوزن ٣ يظهر ٣ أضعاف قسم بوزن ١."
                  : "Weight is relative: a segment at 3 lands three times as often as one at 1."}
              </p>
            </div>
          ) : (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "كود الخصم" : "Discount code"}
              </span>
              <select
                value={c.discountCode ?? ""}
                onChange={(e) => set("discountCode", e.target.value || null)}
                className={`mt-1.5 ${inputCls}`}
              >
                <option value="">{ar ? "اختاري كوداً" : "Choose a code"}</option>
                {codes.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.code} — {k.title}
                  </option>
                ))}
              </select>
              {codes.length === 0 && (
                <span className="mt-1.5 block text-xs text-amber-700">
                  {ar
                    ? "لا توجد أكواد فعّالة. أنشئي كوداً من صفحة الخصومات أولاً."
                    : "No active codes yet — create one on the Discounts page first."}
                </span>
              )}
            </label>
          )}
        </Section>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSave(c)}
            disabled={saving}
            className="btn-primary h-11 px-6 text-sm disabled:opacity-60"
          >
            {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "حفظ" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {ar ? "معاينة" : "Preview"}
        </div>
        <Preview c={c} />
      </div>
    </div>
  );
}
