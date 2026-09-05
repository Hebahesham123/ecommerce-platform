"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { IcMeta, IcAlert, IcCopy, IcLink, IcUpload, IcSend } from "@/components/icons";
import {
  getConnection,
  saveDirectSetup,
  updateSelection,
  disconnect,
  syncCatalog,
  sendTestEvent,
  listEvents,
  type MetaConnectionView,
  type MetaEventLog,
} from "./actions";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-surface focus:ring-2 focus:ring-brand-100";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded accent-brand-600" />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

function StatusRow({ on, label, hint }: { on: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${on ? "bg-emerald-500" : "bg-slate-300"}`}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </div>
  );
}

export default function MetaPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [conn, setConn] = useState<MetaConnectionView | null>(null);
  const [events, setEvents] = useState<MetaEventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eventType, setEventType] = useState("PageView");
  const [testCode, setTestCode] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  async function reload() {
    const [c, e] = await Promise.all([getConnection(), listEvents()]);
    if (c.ok) {
      setConn(c.data);
      setTestCode(c.data.testEventCode ?? "");
      setPixelId(c.data.pixelId ?? "");
    }
    if (e.ok) setEvents(e.data);
    setLoading(false);
  }

  useEffect(() => {
    // Read OAuth callback result from the URL, then clean it.
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected") === "1") setBanner({ kind: "ok", msg: t("meta_connected") });
    const err = q.get("error");
    if (err) setBanner({ kind: "err", msg: err === "app_not_configured" ? t("meta_app_missing") : err });
    if (q.get("connected") || err) window.history.replaceState({}, "", "/channels/meta");
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(patch: Parameters<typeof updateSelection>[0]) {
    const res = await updateSelection(patch);
    if (res.ok) reload();
  }

  /** Save both credentials at once — that pair is the whole integration. */
  async function onSaveSetup(clearToken = false) {
    setSavingSetup(true);
    const res = await saveDirectSetup({
      pixelId,
      capiToken: clearToken ? null : capiToken,
      testEventCode: testCode,
    });
    setSavingSetup(false);
    if (!res.ok) {
      setBanner({
        kind: "err",
        msg:
          res.error === "invalid_pixel_id"
            ? ar
              ? "معرّف البيكسل أرقام فقط — انسخيه من Events Manager."
              : "The Pixel ID should be digits only — copy it from Events Manager."
            : res.error === "migration_missing"
              ? ar
                ? "شغّلي supabase/migrations/0021_meta_direct_setup.sql"
                : "Run supabase/migrations/0021_meta_direct_setup.sql"
              : res.error,
      });
      return;
    }
    setCapiToken("");
    setBanner({
      kind: "ok",
      msg: res.data.capiOn
        ? ar
          ? "تم تفعيل البيكسل وواجهة التحويلات."
          : "Pixel and Conversions API are both on."
        : res.data.pixelOn
          ? ar
            ? "تم تفعيل البيكسل. أضيفي التوكن لتفعيل أحداث الخادم."
            : "Pixel is on. Add a token to switch on server events."
          : ar
            ? "تم الحفظ."
            : "Saved.",
    });
    reload();
  }

  async function onSync() {
    setSyncing(true);
    const res = await syncCatalog();
    setSyncing(false);
    if (res.ok) {
      setBanner({ kind: "ok", msg: `${res.data.count} ${t("products_synced")}` });
      reload();
    } else {
      setBanner({ kind: "err", msg: res.error });
    }
  }

  async function onSend() {
    setSending(true);
    const res = await sendTestEvent(eventType);
    setSending(false);
    if (res.ok) {
      setBanner({ kind: "ok", msg: `${res.data.eventsReceived} ${t("events_received")} · ${res.data.traceId}` });
      reload();
    } else {
      setBanner({ kind: "err", msg: res.error });
    }
  }

  const pixelSnippet = conn?.pixelId
    ? `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${conn.pixelId}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->`
    : "";

  if (loading) {
    return (
      <>
        <PageHeader title={t("nav_meta")} subtitle={t("meta_subtitle")} />
        <Card className="p-12 text-center text-sm text-ink-soft">{t("loading")}</Card>
      </>
    );
  }

  const c = conn!;
  const eventsManagerUrl = c.pixelId
    ? `https://business.facebook.com/events_manager2/list/dataset/${c.pixelId}`
    : "https://business.facebook.com/events_manager2/";

  return (
    <>
      <PageHeader
        title={t("nav_meta")}
        subtitle={t("meta_subtitle")}
        actions={
          <Badge className={c.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted"}>
            <IcMeta className="h-3.5 w-3.5" /> {c.connected ? t("meta_connected") : t("meta_not_connected")}
          </Badge>
        }
      />

      {banner && (
        <Card className={`mb-4 p-3 text-sm ${banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {banner.msg}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Setup — two values, pasted */}
        <Section title={ar ? "الإعداد" : "Setup"}>
          <p className="text-sm text-ink-muted">
            {ar
              ? "انسخي القيمتين من Events Manager والصقيهما هنا. لا حاجة لتسجيل الدخول بفيسبوك."
              : "Copy both values out of Events Manager and paste them here. No Facebook login needed."}
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">{t("pixel_id_label")}</label>
            <input
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1234567890123456"
              className={inputCls}
              dir="ltr"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-ink-soft">
              {ar
                ? "Events Manager ← مصادر البيانات ← البيكسل. أرقام فقط. هذا وحده يشغّل التتبّع في المتجر."
                : "Events Manager → Data sources → your pixel. Digits only. This alone switches on storefront tracking."}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              {ar ? "توكن واجهة التحويلات" : "Conversions API token"}
            </label>
            <input
              type="password"
              value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              placeholder={
                c.capiTokenSet
                  ? ar
                    ? "محفوظ — اتركيه فارغاً للإبقاء عليه"
                    : "Saved — leave blank to keep it"
                  : "EAAG…"
              }
              className={inputCls}
              dir="ltr"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-ink-soft">
              {ar
                ? "Events Manager ← الإعدادات ← إنشاء توكن وصول. يُحفظ على الخادم ولا يظهر مرة أخرى."
                : "Events Manager → Settings → Generate access token. Stored server-side and never shown again."}
            </p>
            {c.capiTokenSet && (
              <button
                onClick={() => onSaveSetup(true)}
                className="mt-1.5 text-xs font-medium text-rose-600 hover:underline"
              >
                {ar ? "حذف التوكن" : "Remove stored token"}
              </button>
            )}
          </div>

          <button
            onClick={() => onSaveSetup(false)}
            disabled={savingSetup}
            className="btn-primary disabled:opacity-60"
          >
            <IcMeta className="h-4 w-4" />
            {savingSetup ? t("loading") : ar ? "حفظ وتفعيل" : "Save & connect"}
          </button>

          <div className="space-y-2 border-t border-line pt-3">
            <StatusRow
              on={Boolean(c.pixelId) && c.pixelEnabled}
              label={ar ? "بيكسل المتصفح" : "Browser pixel"}
              hint={ar ? "يتتبّع التصفّح والسلة" : "Tracks browsing and add-to-cart"}
            />
            <StatusRow
              on={c.capiEnabled}
              label={ar ? "واجهة التحويلات (خادم)" : "Conversions API (server)"}
              hint={ar ? "يرسل عمليات الشراء من الخادم" : "Sends purchases from the server"}
            />
          </div>
        </Section>

        {/* Pixel */}
        <Section title={t("sec_pixel")}>
          <Toggle checked={c.pixelEnabled} onChange={(v) => save({ pixelEnabled: v })} label={t("pixel_enable")} />
          <p className="text-xs text-ink-soft">{t("pixel_inject_hint")}</p>
          {pixelSnippet && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">{t("pixel_snippet")}</label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixelSnippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="btn-outline h-7 gap-1.5 px-2 text-xs"
                >
                  <IcCopy className="h-3.5 w-3.5" /> {copied ? t("copied") : t("copy_snippet")}
                </button>
              </div>
              <p className="mb-1.5 text-xs text-ink-soft">
                {ar
                  ? "للاطّلاع فقط — المتجر يحقنه تلقائياً."
                  : "For reference only — your storefront injects this automatically."}
              </p>
              <pre className="max-h-40 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white/90" dir="ltr">
                <code>{pixelSnippet}</code>
              </pre>
            </div>
          )}
        </Section>

        {/* Catalog */}
        <Section title={t("sec_catalog")}>
          <p className="text-sm text-ink-muted">
            {ar
              ? "مزامنة الكتالوج وحدها تحتاج تسجيل دخول بفيسبوك — البيكسل وواجهة التحويلات لا تحتاجانه."
              : "Catalog sync is the one piece that still needs a Facebook login — the pixel and Conversions API don't."}
          </p>
          {!c.configured && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <IcAlert className="h-4 w-4 shrink-0" />
              {t("meta_app_missing")}
            </div>
          )}
          {c.configured && !c.connected && (
            <a href="/api/meta/connect" className="btn-outline w-fit">
              <IcMeta className="h-4 w-4" /> {t("meta_connect")}
            </a>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">{t("catalog_select")}</label>
            <select
              value={c.catalogId ?? ""}
              onChange={(e) => save({ catalogId: e.target.value })}
              className={inputCls}
              disabled={!c.connected}
            >
              <option value="">—</option>
              {(c.available.catalogs ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.id})</option>
              ))}
              {c.catalogId && !(c.available.catalogs ?? []).some((cat) => cat.id === c.catalogId) && (
                <option value={c.catalogId}>{c.catalogName ?? c.catalogId}</option>
              )}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSync}
              disabled={!c.connected || !c.catalogId || syncing}
              className="btn-primary disabled:opacity-60"
            >
              <IcUpload className="h-4 w-4" /> {syncing ? t("syncing") : t("sync_catalog")}
            </button>
            {c.lastSyncAt && (
              <span className="text-xs text-ink-soft">
                {t("last_sync")}: {new Date(c.lastSyncAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ·{" "}
                {c.lastSyncCount} {t("products_synced")}
              </span>
            )}
          </div>
        </Section>

        {/* Events */}
        <Section
          title={t("sec_events")}
          action={
            <a href={eventsManagerUrl} target="_blank" rel="noreferrer" className="btn-outline h-7 gap-1.5 px-2 text-xs">
              <IcLink className="h-3.5 w-3.5" /> {t("open_events_manager")}
            </a>
          }
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">{t("test_event_code")}</label>
            <input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              onBlur={() => save({ testEventCode: testCode })}
              placeholder="TEST12345"
              className={inputCls}
              dir="ltr"
            />
            <p className="mt-1 text-xs text-ink-soft">{t("test_event_code_hint")}</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-ink">{t("event_type")}</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
                <option value="PageView">{t("ev_pageview")}</option>
                <option value="ViewContent">{t("ev_viewcontent")}</option>
                <option value="AddToCart">{t("ev_addtocart")}</option>
                <option value="Purchase">{t("ev_purchase")}</option>
              </select>
            </div>
            <button onClick={onSend} disabled={!c.connected || !c.pixelId || sending} className="btn-primary disabled:opacity-60">
              <IcSend className="h-4 w-4" /> {sending ? t("loading") : t("send_test_event")}
            </button>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-ink">{t("recent_events")}</div>
            {events.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("no_events_yet")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-ink">{ev.eventName}</span>
                    <span className="flex items-center gap-2">
                      <Badge className={ev.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>
                        {ev.status === "sent" ? t("status_sent") : t("status_error")}
                      </Badge>
                      <span className="text-[11px] text-ink-soft" dir="ltr">
                        {new Date(ev.createdAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
