"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { IcMeta, IcAlert, IcCopy, IcLink, IcUpload, IcSend } from "@/components/icons";
import {
  getConnection,
  updateSelection,
  disconnect,
  syncCatalog,
  sendTestEvent,
  listEvents,
  type MetaConnectionView,
  type MetaEventLog,
} from "./actions";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100";

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

export default function MetaPage() {
  const { t, lang } = useI18n();
  const [conn, setConn] = useState<MetaConnectionView | null>(null);
  const [events, setEvents] = useState<MetaEventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eventType, setEventType] = useState("PageView");
  const [testCode, setTestCode] = useState("");

  async function reload() {
    const [c, e] = await Promise.all([getConnection(), listEvents()]);
    if (c.ok) {
      setConn(c.data);
      setTestCode(c.data.testEventCode ?? "");
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

      {!c.configured && (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("meta_app_missing")}</span>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Connection */}
        <Section title={t("sec_connection")}>
          {c.connected ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-ink-soft">{t("meta_account")}</dt>
                  <dd className="font-medium text-ink">{c.userName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">{t("meta_business")}</dt>
                  <dd className="font-medium text-ink">{c.businessName ?? "—"}</dd>
                </div>
                {c.tokenExpiresAt && (
                  <div className="col-span-2">
                    <dt className="text-ink-soft">{t("token_expires")}</dt>
                    <dd className="font-medium text-ink" dir="ltr">
                      {new Date(c.tokenExpiresAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex gap-2">
                <a href="/api/meta/connect" className="btn-outline">{t("meta_reconnect")}</a>
                <button
                  className="btn-ghost text-rose-600 hover:bg-rose-50"
                  onClick={async () => {
                    await disconnect();
                    reload();
                  }}
                >
                  {t("meta_disconnect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{t("meta_connect_hint")}</p>
              <a
                href={c.configured ? "/api/meta/connect" : undefined}
                aria-disabled={!c.configured}
                className={`btn-primary ${!c.configured ? "pointer-events-none opacity-50" : ""}`}
              >
                <IcMeta className="h-4 w-4" /> {t("meta_connect")}
              </a>
            </>
          )}
        </Section>

        {/* Pixel */}
        <Section title={t("sec_pixel")}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">{t("pixel_select")}</label>
            <select
              value={c.pixelId ?? ""}
              onChange={(e) => save({ pixelId: e.target.value })}
              className={inputCls}
              disabled={!c.connected}
            >
              <option value="">—</option>
              {(c.available.pixels ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
              {c.pixelId && !(c.available.pixels ?? []).some((p) => p.id === c.pixelId) && (
                <option value={c.pixelId}>{c.pixelName ?? c.pixelId}</option>
              )}
            </select>
          </div>
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
              <pre className="max-h-40 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white/90" dir="ltr">
                <code>{pixelSnippet}</code>
              </pre>
            </div>
          )}
        </Section>

        {/* Catalog */}
        <Section title={t("sec_catalog")}>
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
