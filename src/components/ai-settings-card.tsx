"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { DEFAULT_AI, type AiConfig, type AiProvider } from "@/lib/ai-types";
import { getAiSettings, saveAiSettings, aiStatus } from "@/app/(admin)/ai/actions";

/**
 * AI settings — pick the provider (Anthropic / OpenAI) and optionally override
 * the model. API keys are NOT entered here: they are read from the server
 * environment, so the card only shows whether a key was detected for the chosen
 * provider and names the env var to set.
 */
export function AiSettingsCard() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [cfg, setCfg] = useState<AiConfig>(DEFAULT_AI);
  const [status, setStatus] = useState<{ enabled: boolean; provider: AiProvider } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setStatus(await aiStatus());
    } catch {
      /* leave the last known status */
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setCfg(await getAiSettings());
      } catch {
        /* keep defaults */
      }
      await refreshStatus();
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await saveAiSettings(cfg);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await refreshStatus();
    } else {
      setErr(res.error === "not_configured" ? (ar ? "لم يتم ربط قاعدة البيانات" : "Database not connected") : res.error);
    }
  }

  const envVar = cfg.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  // Detection reflects the saved provider; it re-checks after a save.
  const detected = status?.enabled ?? false;

  return (
    <Card className="p-5">
      <div className="mb-1 text-base font-semibold text-ink">
        {ar ? "الذكاء الاصطناعي" : "AI"}
      </div>
      <p className="mb-4 text-xs text-ink-soft">
        {ar
          ? "يشغّل البحث الذكي، وإنشاء محتوى السيو، والتوصيات. المفاتيح تُقرأ من بيئة الخادم ولا تُحفظ هنا."
          : "Powers smart search, SEO content generation and recommendations. Keys are read from the server environment and never stored here."}
      </p>

      {loading ? (
        <div className="py-6 text-center text-sm text-ink-soft">…</div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {ar ? "المزوّد" : "Provider"}
            </span>
            <select
              value={cfg.provider}
              onChange={(e) => setCfg((c) => ({ ...c, provider: e.target.value as AiProvider }))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {ar ? "النموذج (اختياري)" : "Model override (optional)"}
            </span>
            <input
              value={cfg.model}
              onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
              placeholder={ar ? "اتركه فارغاً للاختيار التلقائي" : "Leave blank for the default"}
              type="text"
              dir="ltr"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            <span className="mt-1 block text-xs text-ink-soft">
              {ar
                ? "يُستخدم نموذج افتراضي سريع ومناسب عند الترك فارغاً."
                : "A sensible fast/capable default is used when left blank."}
            </span>
          </label>

          <div className="rounded-lg bg-surface-page px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">
                {ar ? "حالة المفتاح" : "Key detected"}:
              </span>
              {detected ? (
                <span className="font-semibold text-emerald-600">
                  ✓ {ar ? `مفعّل لـ ${cfg.provider}` : `yes, for ${cfg.provider}`}
                </span>
              ) : (
                <span className="font-semibold text-rose-600">
                  ✗ {ar ? `غير موجود لـ ${cfg.provider}` : `not found for ${cfg.provider}`}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-ink-soft" dir="ltr">
              {ar ? "متغيّر البيئة" : "Env var"}: <code className="font-mono">{envVar}</code>
            </div>
            {!detected && (
              <p className="mt-1 text-xs text-ink-soft">
                {ar
                  ? "بدون مفتاح، يعود البحث والتوصيات إلى السلوك العادي وتظهر أزرار الإنشاء معطّلة."
                  : "Without a key, search and recommendations fall back to the existing behaviour and Generate buttons stay disabled."}
              </p>
            )}
          </div>

          {err && <p className="text-sm text-rose-600">{err}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary h-10 px-5 disabled:opacity-50">
              {saving ? "…" : ar ? "حفظ" : "Save"}
            </button>
            {saved && <span className="text-sm text-emerald-600">✓ {ar ? "تم الحفظ" : "Saved"}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
