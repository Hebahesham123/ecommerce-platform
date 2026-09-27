"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { StatusPill } from "@/components/dashboard-ui";
import { EMPTY_PAYMOB, type PaymobConfig } from "@/lib/paymob";
import { getPaymentIntegration, savePaymentIntegration } from "./actions";

/**
 * Payment integration — the Paymob keys, entered once and read by both the
 * storefront checkout and the order screen's "Collect payment → Credit card".
 */
export function PaymentsSettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [cfg, setCfg] = useState<PaymobConfig>(EMPTY_PAYMOB);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [webhook, setWebhook] = useState("");

  useEffect(() => {
    setWebhook(`${window.location.origin}/api/paymob/webhook`);
    (async () => {
      const res = await getPaymentIntegration();
      if (res.ok) { setCfg(res.data.config); setReady(res.data.ready); }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await savePaymentIntegration(cfg);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setReady(!!(cfg.enabled && cfg.secretKey && cfg.publicKey && cfg.integrationId));
      setTimeout(() => setSaved(false), 2000);
    } else setErr(res.error);
  }

  const field = (label: string, key: keyof PaymobConfig, placeholder: string, hint?: string, secret?: boolean) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        value={String(cfg[key] ?? "")}
        onChange={(e) => setCfg((c) => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder}
        type={secret ? "password" : "text"}
        dir="ltr"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );

  return (
    <>
      <PageHeader
        title={ar ? "تكامل الدفع" : "Payment integration"}
        subtitle={ar ? "اقبلي مدفوعات البطاقات عبر باي موب" : "Accept card payments online through Paymob"}
      />

      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink">Paymob</span>
              <StatusPill
                label={ready ? (ar ? "جاهز" : "Connected") : (ar ? "غير مكتمل" : "Not set up")}
                tone={ready ? "success" : "warning"}
                hollow={!ready}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))} />
              {ar ? "مُفعّل" : "Enabled"}
            </label>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-ink-soft">…</div>
          ) : (
            <div className="space-y-3">
              {field(ar ? "المفتاح السري (Secret Key)" : "Secret Key", "secretKey", "egy_sk_live_…", ar ? "من لوحة باي موب ← الإعدادات ← API keys" : "Paymob dashboard → Settings → API keys", true)}
              {field(ar ? "المفتاح العام (Public Key)" : "Public Key", "publicKey", "egy_pk_live_…")}
              {field(ar ? "معرّف تكامل البطاقة" : "Card integration ID", "integrationId", "1234567", ar ? "معرّف تكامل البطاقة الأونلاين (رقم)" : "The online-card integration id (a number)")}
              {field(ar ? "مفتاح HMAC" : "HMAC secret", "hmacSecret", "…", ar ? "للتحقق من صحة إشعارات الدفع" : "Verifies the payment webhook is genuine", true)}

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

        <Card className="p-5">
          <div className="mb-2 text-sm font-semibold text-ink">{ar ? "رابط الإشعار (Webhook)" : "Webhook URL"}</div>
          <p className="mb-2 text-sm text-ink-muted">
            {ar
              ? "أضيفي هذا الرابط في باي موب ← الإعدادات ← Callbacks كـ Transaction processed callback (وأيضاً Response callback)."
              : "Add this in Paymob → Settings → Payment integrations → Callbacks as the Transaction processed callback (and Response callback)."}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-page px-3 py-2 text-xs text-ink" dir="ltr">{webhook}</code>
            <button onClick={() => navigator.clipboard?.writeText(webhook)} className="btn-outline h-9 px-3 text-sm">{ar ? "نسخ" : "Copy"}</button>
          </div>
        </Card>

        <p className="px-1 text-xs text-ink-soft">
          {ar
            ? "بعد الحفظ: افتحي أي طلب ← تحصيل الدفع ← بطاقة ائتمان لإنشاء رابط دفع باي موب. يتم تسجيل الدفعة تلقائياً عند نجاحها عبر الـ webhook."
            : "After saving: open any order → Collect payment → Credit card to generate a Paymob checkout link. The payment records itself on the order when it clears, via the webhook."}
        </p>
      </div>
    </>
  );
}
