"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { IcMeta, IcAlert, IcSend, IcLink, IcUpload } from "@/components/icons";
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

/**
 * Connecting Meta is two values pasted from Events Manager. The page is shaped
 * to say exactly that: one card you fill in, one that tells you it worked, and
 * everything else — the pause switch, catalog sync, disconnecting — folded away
 * behind Advanced, because none of it is part of getting set up.
 */

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-page px-3.5 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="mt-2 block">{children}</span>
      <span className="mt-1.5 block text-xs leading-relaxed text-ink-soft">{hint}</span>
    </label>
  );
}

function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={on ? "font-medium text-ink" : "text-ink-soft"}>{label}</span>
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

  const [pixelId, setPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [testCode, setTestCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [eventType, setEventType] = useState("PageView");

  async function reload() {
    const [c, e] = await Promise.all([getConnection(), listEvents()]);
    if (c.ok) {
      setConn(c.data);
      setPixelId(c.data.pixelId ?? "");
      setTestCode(c.data.testEventCode ?? "");
    }
    if (e.ok) setEvents(e.data);
    setLoading(false);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected") === "1") setBanner({ kind: "ok", msg: t("meta_connected") });
    const err = q.get("error");
    if (err) setBanner({ kind: "err", msg: err === "app_not_configured" ? t("meta_app_missing") : err });
    if (q.get("connected") || err) window.history.replaceState({}, "", "/channels/meta");
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(clearToken = false) {
    setSaving(true);
    const res = await saveDirectSetup({
      pixelId,
      capiToken: clearToken ? null : capiToken,
      testEventCode: testCode,
    });
    setSaving(false);
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
        ? ar ? "تم التفعيل بالكامل." : "Both are on."
        : res.data.pixelOn
          ? ar ? "البيكسل يعمل. أضيفي التوكن لتتبّع المبيعات." : "Pixel is on. Add a token to track sales."
          : ar ? "تم الحفظ." : "Saved.",
    });
    reload();
  }

  async function onSend() {
    setSending(true);
    const res = await sendTestEvent(eventType);
    setSending(false);
    setBanner(
      res.ok
        ? { kind: "ok", msg: `${res.data.eventsReceived} ${t("events_received")}` }
        : {
            kind: "err",
            msg:
              res.error === "no_capi_token"
                ? ar ? "أضيفي توكن واجهة التحويلات أولاً." : "Add a Conversions API token first."
                : res.error === "no_pixel"
                  ? ar ? "أضيفي معرّف البيكسل أولاً." : "Add a Pixel ID first."
                  : res.error,
          },
    );
    reload();
  }

  async function onSync() {
    setSyncing(true);
    const res = await syncCatalog();
    setSyncing(false);
    setBanner(
      res.ok
        ? { kind: "ok", msg: `${res.data.count} ${t("products_synced")}` }
        : { kind: "err", msg: res.error },
    );
    reload();
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t("nav_meta")} subtitle={t("meta_subtitle")} />
        <Card className="p-12 text-center text-sm text-ink-soft">{t("loading")}</Card>
      </>
    );
  }

  const c = conn!;
  const live = Boolean(c.pixelId) && c.pixelEnabled;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("nav_meta")}
        subtitle={ar ? "تتبّع الزيارات والمبيعات في إعلاناتك" : "Track visits and sales in your ads"}
        actions={
          <Badge className={live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted"}>
            <IcMeta className="h-3.5 w-3.5" />
            {live ? t("meta_connected") : t("meta_not_connected")}
          </Badge>
        }
      />

      {banner && (
        <Card
          className={`mb-4 p-3.5 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {banner.msg}
        </Card>
      )}

      {/* ---- The whole setup ---- */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-ink">{ar ? "الربط" : "Connect"}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {ar
            ? "انسخي القيمتين من Events Manager والصقيهما هنا."
            : "Copy these two values out of Events Manager and paste them here."}
        </p>

        <div className="mt-5 space-y-5">
          <Field
            label={ar ? "معرّف البيكسل" : "Pixel ID"}
            hint={
              ar
                ? "Events Manager ← مصادر البيانات. أرقام فقط."
                : "Events Manager → Data sources. Digits only."
            }
          >
            <input
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1234567890123456"
              className={inputCls}
              dir="ltr"
              inputMode="numeric"
            />
          </Field>

          <Field
            label={ar ? "توكن واجهة التحويلات" : "Conversions API token"}
            hint={
              ar
                ? "Events Manager ← الإعدادات ← إنشاء توكن. اختياري، لكنه يتيح تتبّع المبيعات."
                : "Events Manager → Settings → Generate access token. Optional, but it's what tracks sales."
            }
          >
            <input
              type="password"
              value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              placeholder={
                c.capiTokenSet
                  ? ar ? "محفوظ — اتركيه فارغاً" : "Saved — leave blank to keep it"
                  : "EAAG…"
              }
              className={inputCls}
              dir="ltr"
              autoComplete="off"
            />
          </Field>

          <button
            onClick={() => onSave(false)}
            disabled={saving}
            className="btn-primary h-11 w-full justify-center text-sm disabled:opacity-60"
          >
            {saving ? t("loading") : ar ? "حفظ" : "Save"}
          </button>

          <div className="space-y-2 border-t border-line pt-4">
            <Status on={live} label={ar ? "تتبّع الزيارات" : "Visits are tracked"} />
            <Status on={c.capiEnabled} label={ar ? "تتبّع المبيعات" : "Sales are tracked"} />
          </div>
        </div>
      </Card>

      {/* ---- Proof it works ---- */}
      {c.pixelId && (
        <Card className="mt-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              {ar ? "تجربة" : "Send a test"}
            </h2>
            <a
              href={`https://business.facebook.com/events_manager2/list/dataset/${c.pixelId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
            >
              <IcLink className="h-3.5 w-3.5" /> {t("open_events_manager")}
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className={`${inputCls} w-auto min-w-[150px] flex-1`}
            >
              <option value="PageView">{t("ev_pageview")}</option>
              <option value="ViewContent">{t("ev_viewcontent")}</option>
              <option value="AddToCart">{t("ev_addtocart")}</option>
              <option value="Purchase">{t("ev_purchase")}</option>
            </select>
            <button
              onClick={onSend}
              disabled={sending}
              className="btn-primary h-11 shrink-0 px-4 text-sm disabled:opacity-60"
            >
              <IcSend className="h-4 w-4" /> {sending ? t("loading") : t("send_test_event")}
            </button>
          </div>

          {events.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {events.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-ink">{ev.eventName}</span>
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-medium ${
                        ev.status === "sent" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {ev.status === "sent" ? t("status_sent") : t("status_error")}
                    </span>
                    <span className="text-xs text-ink-soft" dir="ltr">
                      {new Date(ev.createdAt).toLocaleTimeString(ar ? "ar-EG" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ---- Everything that isn't setup ---- */}
      <details className="mt-4 rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
          {ar ? "إعدادات متقدمة" : "Advanced"}
        </summary>

        <div className="space-y-6 border-t border-line p-5">
          <div>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={c.pixelEnabled}
                onChange={(e) => updateSelection({ pixelEnabled: e.target.checked }).then(reload)}
                className="h-4 w-4 rounded accent-brand-600"
              />
              <span className="text-sm text-ink">
                {ar ? "تتبّع الزيارات مُفعّل" : "Track visits on the storefront"}
              </span>
            </label>
            <p className="mt-1.5 ps-7 text-xs text-ink-soft">
              {ar
                ? "أوقفيه مؤقتاً دون حذف المعرّف."
                : "Pause tracking without deleting your Pixel ID."}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-ink">{t("test_event_code")}</label>
            <input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              onBlur={() => onSave(false)}
              placeholder="TEST12345"
              className={`mt-2 ${inputCls}`}
              dir="ltr"
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              {ar
                ? "يُستخدم فقط مع زر التجربة أعلاه — المبيعات الحقيقية لا تُرسل به أبداً."
                : "Used only by the test button above. Real sales are never sent with it, so leaving a code here can't hide your conversions."}
            </p>
          </div>

          <div>
            <div className="text-sm font-medium text-ink">{t("sec_catalog")}</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {ar
                ? "مزامنة الكتالوج وحدها تحتاج تسجيل دخول بفيسبوك."
                : "Catalog sync is the one piece that still needs a Facebook login."}
            </p>
            {!c.configured ? (
              <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <IcAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t("meta_app_missing")}
              </div>
            ) : !c.connected ? (
              <a href="/api/meta/connect" className="btn-outline mt-2.5 h-9 w-fit px-3 text-sm">
                <IcMeta className="h-4 w-4" /> {t("meta_connect")}
              </a>
            ) : (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <select
                  value={c.catalogId ?? ""}
                  onChange={(e) => updateSelection({ catalogId: e.target.value }).then(reload)}
                  className={`${inputCls} w-auto min-w-[180px] flex-1`}
                >
                  <option value="">—</option>
                  {(c.available.catalogs ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onSync}
                  disabled={!c.catalogId || syncing}
                  className="btn-outline h-11 shrink-0 px-3 text-sm disabled:opacity-60"
                >
                  <IcUpload className="h-4 w-4" /> {syncing ? t("syncing") : t("sync_catalog")}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <button
              onClick={async () => {
                await disconnect();
                setCapiToken("");
                setBanner({
                  kind: "ok",
                  msg: ar ? "تم إلغاء الربط." : "Disconnected.",
                });
                reload();
              }}
              className="text-sm font-medium text-rose-600 hover:underline"
            >
              {ar ? "إلغاء الربط وحذف البيانات" : "Disconnect and remove stored values"}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
