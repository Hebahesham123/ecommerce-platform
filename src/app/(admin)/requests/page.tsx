"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import Link from "next/link";
import {
  deleteRequest,
  listRequests,
  returnsSummary,
  setRequestAdminNote,
  setRequestStatus,
  type RequestStatus,
  type ReturnsSummary,
  type StoreRequest,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import { ChannelBadge } from "@/components/channel-badge";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/channel";
import {
  KpiRow,
  StatTile,
  StatusPill,
  Toolbar,
  SearchInput,
  ViewTabs,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import {
  IcClipboard,
  IcAlert,
  IcEye,
  IcTrash,
  IcX,
  IcImage,
  IcVideo,
  IcMail,
  IcWhatsApp,
  IcOrders,
  IcRefresh,
} from "@/components/icons";

/**
 * Customer requests that aren't returns or exchanges.
 *
 * This page used to embed the customer-facing form itself, which meant the
 * dashboard showed staff the thing shoppers fill in rather than what they had
 * written — and the form wrote into a different Supabase project entirely, so
 * there was nothing to show. Submissions now land in store_requests (0018) and
 * are read here.
 */

const STATUSES: RequestStatus[] = ["new", "open", "resolved", "closed"];

const statusTone: Record<RequestStatus, PillTone> = {
  new: "attention",
  open: "info",
  resolved: "success",
  closed: "neutral",
};

const statusText: Record<RequestStatus, { ar: string; en: string }> = {
  new: { ar: "جديد", en: "New" },
  open: { ar: "قيد المعالجة", en: "In progress" },
  resolved: { ar: "تم الحل", en: "Resolved" },
  closed: { ar: "مغلق", en: "Closed" },
};

type Tab = "all" | RequestStatus;

export default function RequestsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [rows, setRows] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [open, setOpen] = useState<StoreRequest | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [returns, setReturns] = useState<ReturnsSummary | null>(null);

  async function load() {
    setLoading(true);
    const res = await listRequests();
    if (res.ok) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    returnsSummary().then((r) => {
      if (r.ok) setReturns(r.data);
    });
  }, []);

  // Keep the open drawer pointing at the freshly loaded copy of its row.
  useEffect(() => {
    if (!open) return;
    const fresh = rows.find((r) => r.id === open.id);
    if (fresh) setOpen(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<RequestStatus, number> = { new: 0, open: 0, resolved: 0, closed: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (channel !== "all" && r.channel !== channel) return false;
      if (!needle) return true;
      return [r.reference, r.name, r.email, r.phone, r.orderNumber, r.subject, r.message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, tab, channel, q]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${tab}|${channel}|${q}` });

  async function changeStatus(r: StoreRequest, status: RequestStatus) {
    setBusy(true);
    const res = await setRequestStatus(r.id, status);
    setBusy(false);
    if (res.ok) setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  async function saveNote(r: StoreRequest) {
    setBusy(true);
    const res = await setRequestAdminNote(r.id, note);
    setBusy(false);
    if (res.ok)
      setRows((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, adminNote: note.trim() || null } : x)),
      );
  }

  async function remove(r: StoreRequest) {
    setBusy(true);
    const res = await deleteRequest(r.id);
    setBusy(false);
    if (res.ok) {
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      setOpen(null);
    }
  }

  const date = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  if (error === "migration_missing") {
    return (
      <>
        <PageHeader title={t("nav_requests")} subtitle={ar ? "طلبات العملاء" : "Customer requests"} />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IcAlert className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">
              {ar ? "لم يتم تطبيق ترحيل قاعدة البيانات" : "Database migration not applied"}
            </div>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              {ar
                ? "شغّلي supabase/migrations/0018_store_requests.sql ثم حدّثي الصفحة."
                : "Run supabase/migrations/0018_store_requests.sql, then refresh this page."}
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("nav_requests")}
        subtitle={ar ? "طلبات واستفسارات العملاء" : "Customer requests & enquiries"}
        actions={
          <button onClick={load} className="btn-outline h-9 px-3 text-sm">
            {ar ? "تحديث" : "Refresh"}
          </button>
        }
      />

      {returns && returns.total > 0 && (
        <Link
          href="/returns"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-pop"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IcRefresh className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              {ar
                ? "الاسترجاع والاستبدال في صفحة منفصلة"
                : "Returns and exchanges are on their own page"}
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              {ar
                ? `${num(returns.total, lang)} طلب — ${num(returns.waiting, lang)} بانتظار المراجعة. هذه الصفحة للاستفسارات العامة فقط.`
                : `${returns.total} request${returns.total === 1 ? "" : "s"}, ${returns.waiting} waiting on you. This page is for general enquiries only.`}
            </span>
          </span>
          {returns.waiting > 0 && (
            <span className="badge shrink-0 bg-amber-50 text-amber-700">
              {num(returns.waiting, lang)}
            </span>
          )}
          <span aria-hidden className="text-ink-soft">
            {ar ? "\u2039" : "\u203a"}
          </span>
        </Link>
      )}

      <KpiRow cols={4}>
        <StatTile
          icon={IcClipboard}
          label={ar ? "الإجمالي" : "Total"}
          value={num(rows.length, lang)}
          accent="brand"
          active={tab === "all"}
          onClick={() => setTab("all")}
        />
        <StatTile
          icon={IcAlert}
          label={statusText.new[lang]}
          value={num(counts.new, lang)}
          accent="amber"
          active={tab === "new"}
          onClick={() => setTab("new")}
        />
        <StatTile
          icon={IcEye}
          label={statusText.open[lang]}
          value={num(counts.open, lang)}
          accent="sky"
          active={tab === "open"}
          onClick={() => setTab("open")}
        />
        <StatTile
          icon={IcOrders}
          label={statusText.resolved[lang]}
          value={num(counts.resolved, lang)}
          accent="emerald"
          active={tab === "resolved"}
          onClick={() => setTab("resolved")}
        />
      </KpiRow>

      <div className="mt-5">
        <Toolbar>
          <ViewTabs
            tabs={[
              { key: "all", label: ar ? "الكل" : "All" },
              ...STATUSES.map((s) => ({ key: s, label: statusText[s][lang] })),
            ]}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
          />
          <div className="ms-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5">
              {(["all", ...CHANNELS] as ("all" | Channel)[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    channel === ch ? "bg-surface-page text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {ch === "all"
                    ? ar ? "الكل" : "All"
                    : CHANNEL_LABELS[ch][ar ? "ar" : "en"]}
                </button>
              ))}
            </div>
            <div className="w-full max-w-xs">
              <SearchInput
                value={q}
                onChange={setQ}
                placeholder={ar ? "ابحثي بالاسم أو الرقم…" : "Search name, phone, order…"}
              />
            </div>
          </div>
        </Toolbar>
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        {loading ? (
          <div className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : pg.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-soft">
            {ar ? "لا توجد طلبات" : "No requests yet"}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {pg.items.map((r) => (
              <li
                key={r.id}
                className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-surface-hover"
                onClick={() => {
                  setOpen(r);
                  setNote(r.adminNote ?? "");
                }}
              >
                <Avatar name={r.name || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{r.name || "—"}</span>
                    <span className="text-xs text-ink-soft" dir="ltr">
                      {r.reference}
                    </span>
                    <StatusPill label={statusText[r.status][lang]} tone={statusTone[r.status]} />
                    <ChannelBadge value={r.channel} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                    <span>{date(r.createdAt)}</span>
                    {r.phone && (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <IcWhatsApp className="h-3.5 w-3.5" /> {r.phone}
                      </span>
                    )}
                    {r.email && (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <IcMail className="h-3.5 w-3.5" /> {r.email}
                      </span>
                    )}
                    {r.orderNumber && (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <IcOrders className="h-3.5 w-3.5" /> {r.orderNumber}
                      </span>
                    )}
                    {r.attachments.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <IcImage className="h-3.5 w-3.5" /> {num(r.attachments.length, lang)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!loading && pg.items.length > 0 && (
        <div className="mt-3">
          <Pagination {...pg} />
        </div>
      )}

      {error && error !== "migration_missing" && (
        <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
      )}

      {/* ---- Detail drawer ---- */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setOpen(null)} />
          <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <div className="text-base font-bold text-ink">{open.name || "—"}</div>
                <div className="text-xs text-ink-soft" dir="ltr">
                  {open.reference} · {date(open.createdAt)}
                </div>
              </div>
              <button onClick={() => setOpen(null)} className="btn-ghost h-8 w-8 p-0">
                <IcX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={busy || open.status === s}
                    onClick={() => changeStatus(open, s)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-100 ${
                      open.status === s
                        ? "bg-brand text-white"
                        : "border border-line text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    {statusText[s][lang]}
                  </button>
                ))}
              </div>

              {open.subject && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {ar ? "الموضوع" : "Subject"}
                  </div>
                  <p className="mt-1 text-sm text-ink">{open.subject}</p>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "الرسالة" : "Message"}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {open.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label={ar ? "الهاتف" : "Phone"} value={open.phone} />
                <Detail label={ar ? "البريد" : "Email"} value={open.email} />
                <Detail label={ar ? "رقم الطلب" : "Order"} value={open.orderNumber} />
                <Detail
                  label={ar ? "مسجّل الدخول" : "Signed in as"}
                  value={open.sessionPhone}
                />
              </div>

              {open.attachments.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {ar ? "المرفقات" : "Attachments"}
                  </div>
                  <ul className="mt-2 grid grid-cols-3 gap-2">
                    {open.attachments.map((a, i) => (
                      <li key={`${a.url}-${i}`}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl border border-line bg-surface-page"
                        >
                          {a.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.name} className="h-24 w-full object-cover" />
                          ) : (
                            <span className="flex h-24 w-full items-center justify-center text-ink-soft">
                              <IcVideo className="h-6 w-6" />
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "ملاحظة داخلية" : "Internal note"}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={ar ? "لا يراها العميل" : "Never shown to the customer"}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-page p-3 text-sm text-ink outline-none focus:border-brand-600"
                />
                <button
                  onClick={() => saveNote(open)}
                  disabled={busy}
                  className="btn-outline mt-2 h-9 px-3 text-sm disabled:opacity-60"
                >
                  {ar ? "حفظ الملاحظة" : "Save note"}
                </button>
              </div>

              <button
                onClick={() => remove(open)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 disabled:opacity-60"
              >
                <IcTrash className="h-4 w-4" />
                {ar ? "حذف الطلب" : "Delete request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 truncate text-ink" dir="ltr">
        {value || "—"}
      </div>
    </div>
  );
}
