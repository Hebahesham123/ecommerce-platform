"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { DEFAULT_TRACKING, type Tracking } from "@/lib/tracking-types";
import { getTracking, saveTracking } from "./tracking-actions";

/**
 * Google Analytics 4 + Search Console settings — the measurement id and tag the
 * storefront bakes into every page's <head>, the API secret that lets the
 * server report purchases, and the Search Console ownership token. The twin of
 * the Meta Pixel settings, read/saved to `store_settings.data.tracking`.
 */
export function TrackingSettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [cfg, setCfg] = useState<Tracking>(DEFAULT_TRACKING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getTracking();
      if (res.ok) setCfg(res.data);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await saveTracking(cfg);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else setErr(res.error);
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600";

  return (
    <Card className="mb-4 p-5">
      <div className="mb-1 text-base font-semibold text-ink">
        {ar ? "Google Analytics وSearch Console" : "Google Analytics & Search Console"}
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">
        {ar
          ? "ألصقي معرّف القياس من GA4 ليبدأ التتبّع على المتجر، ومفتاح API لتسجيل عمليات الشراء من الخادم، ورمز التحقّق من Search Console لإثبات ملكية الموقع."
          : "Paste your GA4 Measurement ID to start tracking the storefront, the API secret so purchases are counted server-side, and your Search Console token to verify ownership."}
      </p>

      {loading ? (
        <div className="py-6 text-center text-sm text-ink-soft">…</div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {ar ? "معرّف القياس (GA4)" : "GA4 Measurement ID"}
            </span>
            <input
              value={cfg.ga4Id}
              onChange={(e) => setCfg((c) => ({ ...c, ga4Id: e.target.value }))}
              placeholder="G-XXXXXXX"
              dir="ltr"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-soft">
              {ar
                ? "يبدأ بـ G- ويوجد في GA4 ضمن الإدارة ← تدفّقات البيانات"
                : "Starts with G-, found in GA4 under Admin → Data streams"}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {ar ? "مفتاح API لـ GA4" : "GA4 API secret"}
            </span>
            <input
              type="password"
              value={cfg.ga4ApiSecret}
              onChange={(e) => setCfg((c) => ({ ...c, ga4ApiSecret: e.target.value }))}
              placeholder="••••••••"
              dir="ltr"
              autoComplete="off"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-soft">
              {ar
                ? "مطلوب لإرسال حدث الشراء من الخادم (Measurement Protocol)"
                : "Needed for server-side purchase events (Measurement Protocol)"}
            </span>
          </label>

          <label className="flex items-center gap-2 pt-1 text-sm text-ink">
            <input
              type="checkbox"
              checked={cfg.ga4Enabled}
              onChange={(e) => setCfg((c) => ({ ...c, ga4Enabled: e.target.checked }))}
            />
            {ar
              ? "تفعيل تتبّع Google Analytics على المتجر"
              : "Enable Google Analytics on the storefront"}
          </label>

          <label className="block pt-1">
            <span className="mb-1 block text-sm font-medium text-ink">
              {ar ? "رمز التحقّق من Search Console" : "Search Console verification token"}
            </span>
            <input
              value={cfg.gscVerification}
              onChange={(e) => setCfg((c) => ({ ...c, gscVerification: e.target.value }))}
              placeholder="google-site-verification token"
              dir="ltr"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-soft">
              {ar
                ? "قيمة content من طريقة التحقّق عبر وسم HTML"
                : "The content value from the HTML tag verification method"}
            </span>
          </label>

          {err && <p className="text-sm text-rose-600">{err}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary h-10 px-5 disabled:opacity-50"
            >
              {saving ? "…" : ar ? "حفظ" : "Save"}
            </button>
            {saved && (
              <span className="text-sm text-emerald-600">✓ {ar ? "تم الحفظ" : "Saved"}</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
