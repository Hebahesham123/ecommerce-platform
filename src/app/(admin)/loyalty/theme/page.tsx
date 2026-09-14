"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcAlert, IcRefresh } from "@/components/icons";
import { ColorPicker } from "@/components/pickers";
import {
  COLOUR_FIELDS,
  DEFAULT_LOYALTY_THEME,
  GROUP_LABELS,
  SCOPE_LABELS,
  SECTION_FIELDS,
  SECTION_SCOPES,
  sectionText,
  TAB_FALLBACK,
  TAB_KEYS,
  loyaltyVars,
  tabLabel,
  type LoyaltyTheme,
  type SectionScope,
} from "@/lib/loyalty/theme";
import { loadLoyaltyTheme, storeLoyaltyTheme } from "../theme-actions";

const input =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600";

export default function LoyaltyThemePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [saved, setSaved] = useState<LoyaltyTheme>(DEFAULT_LOYALTY_THEME);
  const [draft, setDraft] = useState<LoyaltyTheme>(DEFAULT_LOYALTY_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [openScope, setOpenScope] = useState<SectionScope | null>(null);

  /**
   * Open a section and put it where the merchant can see it.
   *
   * The preview's tabs are the obvious thing to press when you want to change
   * a section - more obvious than a card further down a long column - so they
   * press, and this brings the right card up to meet them.
   */
  const openSection = (scope: SectionScope) => {
    setOpenScope(scope);
    requestAnimationFrame(() => {
      document.getElementById("ls-scope-" + scope)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  async function load() {
    setLoading(true);
    const res = await loadLoyaltyTheme();
    if (res.ok) {
      setSaved(res.data);
      setDraft(res.data);
    } else {
      setMsg({ tone: "err", text: res.error });
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const res = await storeLoyaltyTheme(draft);
    setSaving(false);
    if (res.ok) {
      setSaved(draft);
      setMsg({ tone: "ok", text: ar ? "تم الحفظ" : "Saved" });
    } else {
      setMsg({ tone: "err", text: res.error });
    }
  }

  const setColour = (key: (typeof COLOUR_FIELDS)[number]["key"], v: string) =>
    setDraft((d) => ({ ...d, colours: { ...d.colours, [key]: v } }));
  const setWord = (key: keyof LoyaltyTheme["words"], v: string) =>
    setDraft((d) => ({ ...d, words: { ...d.words, [key]: v } }));
  const setSection = (scope: SectionScope, key: string, v: string) =>
    setDraft((d) => ({
      ...d,
      sections: { ...d.sections, [scope]: { ...(d.sections?.[scope] ?? {}), [key]: v } },
    }));

  const groups = [...new Set(COLOUR_FIELDS.map((f) => f.group))];

  return (
    <>
      <PageHeader
        title={ar ? "مظهر الجمعية" : "Society theme"}
        subtitle={
          ar
            ? "ألوان وكلمات صفحات برنامج الولاء كما يراها العميل"
            : "The colours and wording of the loyalty pages, as the customer sees them"
        }
        actions={
          <>
            <button className="btn-outline" onClick={load} disabled={saving}>
              <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
            </button>
            <button
              className="btn-outline"
              onClick={() => setDraft(DEFAULT_LOYALTY_THEME)}
              disabled={saving}
              title={ar ? "إرجاع كل شيء للألوان الأصلية" : "Put every colour back"}
            >
              {ar ? "الألوان الأصلية" : "Original look"}
            </button>
            <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
              {saving
                ? ar
                  ? "جارٍ الحفظ…"
                  : "Saving…"
                : dirty
                  ? ar
                    ? "حفظ"
                    : "Save"
                  : ar
                    ? "محفوظ"
                    : "Saved"}
            </button>
          </>
        }
      />

      {msg?.text === "migration_missing" ? (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">
              {ar ? "شغّلي ترحيل مظهر الجمعية لحفظ التغييرات" : "Run the Society theme migration to save changes"}
            </div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0029_loyalty_theme.sql</code>
            <div className="mt-1 text-[12px]">
              {ar
                ? "حتى ذلك الحين تعمل المعاينة بالكامل، لكن الحفظ لا يصل لقاعدة البيانات."
                : "Until then the preview works fully, but saving has nowhere to land."}
            </div>
          </div>
        </Card>
      ) : (
      msg && (
        <Card
          className={`mb-4 p-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.text}
        </Card>
      ))}

      {loading ? (
        <Card className="p-10 text-center text-sm text-ink-soft">
          {ar ? "جارٍ التحميل…" : "Loading…"}
        </Card>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* ------------------------------------------------ the controls -- */}
          <div className="min-w-0 flex-1 space-y-4">
            <Card className="p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "الكلمات" : "Wording"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Word
                  label={ar ? "سطر الهوية" : "Brand line"}
                  value={draft.words.brandLine}
                  onChange={(v) => setWord("brandLine", v)}
                />
                <Word
                  label={ar ? "الاسم" : "Title"}
                  value={draft.words.title}
                  onChange={(v) => setWord("title", v)}
                />
                <Word
                  label={ar ? "الوصف" : "Tagline"}
                  value={draft.words.tagline}
                  onChange={(v) => setWord("tagline", v)}
                  wide
                />
                <Word
                  label={ar ? "عنوان الرصيد" : "Balance label"}
                  value={draft.words.statusLabel}
                  onChange={(v) => setWord("statusLabel", v)}
                />
                <Word
                  label={ar ? "اسم النقطة" : "What a point is called"}
                  value={draft.words.pointsWord}
                  onChange={(v) => setWord("pointsWord", v)}
                />
                <Word
                  label={ar ? "الرمز" : "The mark"}
                  value={draft.words.glyph}
                  onChange={(v) => setWord("glyph", v)}
                  note={
                    ar
                      ? "حرف واحد يظهر أفضل — يُرسم بجانب كل رصيد."
                      : "One character reads best. It is drawn beside every balance."
                  }
                />
                <Word
                  label={ar ? "عنوان البطاقة المختصرة" : "Summary card kicker"}
                  value={draft.words.cardKicker}
                  onChange={(v) => setWord("cardKicker", v)}
                  note={
                    ar
                      ? "على البطاقة الصغيرة في صفحة الحساب."
                      : "On the small card in the account page."
                  }
                />
              </div>
            </Card>

            {groups.map((g) => (
              <Card key={g} className="p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? GROUP_LABELS[g].ar : GROUP_LABELS[g].en}
                </div>
                <div className="space-y-2">
                  {COLOUR_FIELDS.filter((f) => f.group === g).map((f) => (
                    <label key={f.key} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 text-xs text-ink-muted">
                        {ar ? f.ar : f.en}
                      </span>
                      <span className="min-w-0 flex-1">
                        <ColorPicker
                          value={draft.colours[f.key]}
                          onChange={(v) => setColour(f.key, v)}
                          fallback={DEFAULT_LOYALTY_THEME.colours[f.key]}
                          brand={[DEFAULT_LOYALTY_THEME.colours[f.key]]}
                          input={`${input} h-8 text-xs`}
                          ar={ar}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}

            <Card className="p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "أسماء التبويبات" : "Tab names"}
              </div>
              <p className="mb-3 text-[11px] text-ink-soft">
                {ar
                  ? "اتركي الخانة فارغة لتستخدم الصفحة كلمتها الأصلية."
                  : "Leave one empty and the page keeps its own word."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TAB_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-ink-muted">
                      {TAB_FALLBACK[key]}
                    </span>
                    <input
                      value={draft.tabLabels[key]}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          tabLabels: { ...d.tabLabels, [key]: e.target.value },
                        }))
                      }
                      placeholder={TAB_FALLBACK[key]}
                      className={`${input} h-8 text-xs`}
                    />
                  </label>
                ))}
              </div>
            </Card>

            <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "كلمات الأقسام" : "Section wording"}
            </div>
            <p className="-mt-2 text-[11px] text-ink-soft">
              {ar
                ? "كل عنوان وزر ونص فارغ داخل صفحات الجمعية. اتركي الخانة فارغة لتبقى الكلمة الأصلية."
                : "Every heading, button and empty-state line inside the Society. Leave one blank to keep the built-in word."}
            </p>

            {SECTION_SCOPES.map((scope) => {
              const fields = SECTION_FIELDS.filter((f) => f.scope === scope);
              if (!fields.length) return null;
              const changed = fields.filter((f) => draft.sections?.[scope]?.[f.key]).length;
              return (
                <Card key={scope} id={"ls-scope-" + scope} className="overflow-hidden p-0">
                  <button
                    onClick={() => (openScope === scope ? setOpenScope(null) : openSection(scope))}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start hover:bg-surface-hover"
                  >
                    <span className="text-sm font-medium text-ink">
                      {ar ? SCOPE_LABELS[scope].ar : SCOPE_LABELS[scope].en}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-ink-soft">
                      {changed > 0 && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                          {changed} {ar ? "مُعدّلة" : "changed"}
                        </span>
                      )}
                      {fields.length}
                      <span className="text-ink-muted">{openScope === scope ? "\u2212" : "+"}</span>
                    </span>
                  </button>
                  {openScope === scope && (
                    <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                      {fields.map((f) => (
                        <Word
                          key={f.key}
                          label={ar ? f.ar : f.en}
                          value={draft.sections?.[scope]?.[f.key] ?? ""}
                          onChange={(v) => setSection(scope, f.key, v)}
                          placeholder={f.fallback}
                          wide={f.fallback.length > 28}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* -------------------------------------------------- the preview -- */}
          <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[380px]">
            <Preview theme={draft} ar={ar} active={openScope} onPick={openSection} />
          </div>
        </div>
      )}
    </>
  );
}

function Word({
  label,
  value,
  onChange,
  note,
  wide,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  note?: string;
  wide?: boolean;
  /** The word the page uses when this is left empty. */
  placeholder?: string;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="mb-1 block text-xs text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={input}
      />
      {note && <span className="mt-1 block text-[11px] text-ink-soft">{note}</span>}
    </label>
  );
}

/**
 * The parts of the Society a colour actually lands on.
 *
 * Not the real page — that needs a signed-in shopper with a balance — but the
 * same pieces in the same order: the header, the status card, the dark summary
 * card and a reward row. Every colour in the list on the left paints something
 * in here, so nothing is adjusted blind.
 */
function Preview({
  theme,
  ar,
  active,
  onPick,
}: {
  theme: LoyaltyTheme;
  ar: boolean;
  active: SectionScope | null;
  onPick: (scope: SectionScope) => void;
}) {
  const w = theme.words;
  const shownScope: SectionScope = active && active !== "shared" ? active : "overview";
  const fields = SECTION_FIELDS.filter((f) => f.scope === shownScope);
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {ar ? "معاينة" : "Preview"}
      </div>
      <div
        className="space-y-4 p-4"
        style={{
          ...(loyaltyVars(theme) as React.CSSProperties),
          background: "var(--ls-page)",
        }}
      >
        <div className="text-center">
          <div className="text-xs font-semibold tracking-[0.35em] text-[var(--ls-ink-muted)]">
            {w.brandLine}
          </div>
          <div className="font-serif text-3xl tracking-wide text-[var(--ls-ink)]">{w.title}</div>
          <div className="mt-1 text-xs text-[var(--ls-ink-soft)]">{w.tagline}</div>
        </div>

        <div className="rounded-3xl bg-[var(--ls-card)] p-5 shadow-sm ring-1 ring-[var(--ls-line)]">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--ls-ink-soft)]">
            {w.statusLabel}
          </div>
          <div className="mt-1 font-serif text-2xl text-[var(--ls-ink)]">
            The Curated {w.glyph}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="text-4xl font-bold text-[var(--ls-ink)]">2,480</div>
            <div className="pb-1 text-sm text-[var(--ls-ink-muted)]">{w.pointsWord}</div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--ls-panel)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--ls-accent)] to-[var(--ls-accent-to)]"
              style={{ width: "62%" }}
            />
          </div>
          <div className="mt-2 text-xs text-[var(--ls-ink-soft)]">
            1,520 {w.pointsWord} until The Insider
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-5 text-[var(--ls-on-deep)]">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-[0.25em] text-[var(--ls-on-deep-soft)]">
              {w.cardKicker}
            </div>
            <div className="text-sm">{w.glyph}</div>
          </div>
          <div className="mt-1 font-serif text-xl">The Curated</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[var(--ls-gold)]" style={{ width: "62%" }} />
          </div>
          <div className="mt-3 text-xs font-semibold text-[var(--ls-gold)]">View Society →</div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => onPick(key)}
              title={ar ? "افتحي كلمات هذا القسم" : "Edit this section's wording"}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                key === shownScope
                  ? "bg-[var(--ls-accent)] text-white"
                  : "bg-[var(--ls-card)] text-[var(--ls-ink-muted)] ring-1 ring-[var(--ls-line)] hover:ring-2"
              }`}
            >
              {tabLabel(theme, key)}
            </button>
          ))}
        </div>

        {/* The chosen section's own words, in the colours they will wear. */}
        <div className="rounded-2xl bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]">
          {fields.map((f, i) => (
            <div
              key={f.key}
              className={
                i === 0
                  ? "font-serif text-lg text-[var(--ls-ink)]"
                  : "mt-1 text-xs text-[var(--ls-ink-muted)]"
              }
            >
              {sectionText(theme, shownScope, f.key)}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ls-panel)] text-lg">
            🎁
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[var(--ls-ink)]">
              Free delivery
            </span>
            <span className="block truncate text-xs text-[var(--ls-ink-muted)]">
              On your next order
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-[var(--ls-accent)] px-3 py-1.5 text-xs font-semibold text-white">
            400 {w.glyph}
          </span>
        </div>

        <div className="text-xs text-[var(--ls-success)]">+120 {w.pointsWord} earned</div>
      </div>
    </Card>
  );
}
