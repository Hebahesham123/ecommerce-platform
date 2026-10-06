"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { DEFAULT_SEO, type SeoSettings } from "@/lib/seo-types";
import { getSeoSettings, saveSeoSettings } from "./actions";

/**
 * SEO settings — the brand name, default description, social image, logo and
 * Twitter handle that the storefront bakes into every page's <head> (meta
 * description, canonical, Open Graph, Twitter cards, JSON-LD). Also surfaces the
 * sitemap and robots URLs search engines read.
 */
export function SeoSettingsForm() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [cfg, setCfg] = useState<SeoSettings>(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const res = await getSeoSettings();
      if (res.ok) setCfg(res.data);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await saveSeoSettings(cfg);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else setErr(res.error);
  }

  function copy(value: string, key: string) {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  const sitemapUrl = `${origin}/sitemap.xml`;
  const robotsUrl = `${origin}/robots.txt`;

  const field = (
    label: string,
    key: keyof SeoSettings,
    placeholder: string,
    hint?: string,
    ltr?: boolean,
  ) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        value={String(cfg[key] ?? "")}
        onChange={(e) => setCfg((c) => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder}
        type="text"
        dir={ltr ? "ltr" : undefined}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );

  const urlRow = (label: string, value: string, key: string) => (
    <div>
      <div className="mb-1 text-sm font-medium text-ink">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-page px-3 py-2 text-xs text-ink" dir="ltr">
          {value}
        </code>
        <button onClick={() => copy(value, key)} className="btn-outline h-9 shrink-0 px-3 text-sm">
          {copied === key ? (ar ? "تم النسخ" : "Copied") : ar ? "نسخ" : "Copy"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={ar ? "تحسين محركات البحث (SEO)" : "SEO"}
        subtitle={
          ar
            ? "البيانات الوصفية ومشاركة الروابط وبيانات محركات البحث لمتجرك"
            : "Meta tags, link previews and structured data for your storefront"
        }
      />

      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold text-ink">
            {ar ? "البيانات الوصفية" : "Metadata"}
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-ink-soft">…</div>
          ) : (
            <div className="space-y-3">
              {field(
                ar ? "اسم الموقع" : "Site name",
                "siteName",
                ar ? "بيوتي بار" : "BeautyBar",
                ar
                  ? "اسم العلامة التجارية المستخدم في العناوين وبطاقات المشاركة"
                  : "Brand name used in titles, og:site_name and structured data",
              )}
              {field(
                ar ? "لاحقة العنوان" : "Title suffix",
                "titleSuffix",
                ar ? "— بيوتي بار" : "— BeautyBar",
                ar
                  ? "نص يُضاف إلى نهاية عناوين الصفحات (اختياري)"
                  : "Appended to the end of page titles (optional)",
              )}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">
                  {ar ? "الوصف الافتراضي" : "Default description"}
                </span>
                <textarea
                  value={cfg.defaultDescription}
                  onChange={(e) => setCfg((c) => ({ ...c, defaultDescription: e.target.value }))}
                  placeholder={
                    ar
                      ? "وصف موجز لمتجرك يظهر في نتائج البحث…"
                      : "A short description of your store for search results…"
                  }
                  rows={3}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
                />
                <span className="mt-1 block text-xs text-ink-soft">
                  {ar
                    ? "يُستخدم عندما لا يكون للصفحة وصف خاص بها (~160 حرفًا)"
                    : "Used when a page has no description of its own (~160 chars)"}
                </span>
              </label>
              {field(
                ar ? "صورة المشاركة" : "Social image",
                "socialImage",
                "https://…/social.jpg",
                ar
                  ? "الصورة التي تظهر عند مشاركة رابط المتجر على وسائل التواصل"
                  : "Image shown when a store link is shared on social media",
                true,
              )}
              {field(
                ar ? "شعار المتجر" : "Logo",
                "logo",
                "https://…/logo.png",
                ar
                  ? "رابط الشعار المستخدم في البيانات المنظمة (Organization)"
                  : "Logo URL used in the Organization structured data",
                true,
              )}
              {field(
                ar ? "حساب تويتر / X" : "Twitter / X handle",
                "twitterHandle",
                "@beautybar",
                ar ? "يظهر في بطاقات تويتر (اختياري)" : "Shown in Twitter cards (optional)",
                true,
              )}

              <label className="flex items-center gap-2 pt-1 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={cfg.robotsIndex}
                  onChange={(e) => setCfg((c) => ({ ...c, robotsIndex: e.target.checked }))}
                />
                {ar
                  ? "السماح لمحركات البحث بفهرسة المتجر"
                  : "Allow search engines to index this store"}
              </label>

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
          <div className="mb-3 text-base font-semibold text-ink">
            {ar ? "روابط محركات البحث" : "Search engine URLs"}
          </div>
          <div className="space-y-3">
            {urlRow(ar ? "خريطة الموقع" : "Sitemap", sitemapUrl, "sitemap")}
            {urlRow("robots.txt", robotsUrl, "robots")}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            {ar
              ? "تُنشأ خريطة الموقع وملف robots تلقائيًا من منتجاتك ومجموعاتك. أرسلي رابط خريطة الموقع إلى Google Search Console."
              : "The sitemap and robots file are generated automatically from your products and collections. Submit the sitemap URL to Google Search Console."}
          </p>
        </Card>
      </div>
    </>
  );
}
