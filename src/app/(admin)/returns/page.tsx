"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  formatCountdown,
  kindLabel,
  msLeftInWindow,
  nextStatuses,
  statusLabel,
  type RequestKind,
  type RequestStatus,
  type ReturnRequest,
} from "@/lib/returns";
import { listReturnRequests, setRequestNote, setRequestStatus } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  KpiRow,
  StatTile,
  StatusPill,
  Toolbar,
  SearchInput,
  Select,
  ViewTabs,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import { IcRefresh, IcCash, IcAlert, IcX, IcImage, IcInventory } from "@/components/icons";

const statusTone: Record<RequestStatus, PillTone> = {
  pending: "warning",
  approved: "info",
  rejected: "critical",
  completed: "success",
  cancelled: "neutral",
};

type KindTab = "all" | RequestKind;

export default function ReturnsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<KindTab>("all");
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ReturnRequest | null>(null);

  // Ticks the countdown column so "2d 4h left" stays true while the page is up.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function load() {
    const res = await listReturnRequests();
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
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.kind !== tab) return false;
      if (status !== "all" && r.status !== status) return false;
      if (needle) {
        const hay = `${r.reference} ${r.orderNumber} ${r.customerName ?? ""} ${r.phone}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, tab, status, q]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${tab}|${status}|${q}` });

  const kpi = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const exchanges = rows.filter((r) => r.kind === "exchange").length;
    const refunds = rows
      .filter((r) => r.status !== "rejected" && r.status !== "cancelled")
      .reduce((s, r) => s + r.refundAmount, 0);
    const extra = rows
      .filter((r) => r.status !== "rejected" && r.status !== "cancelled")
      .reduce((s, r) => s + r.extraAmount, 0);
    return { total: rows.length, pending, exchanges, refunds, extra };
  }, [rows]);

  async function changeStatus(r: ReturnRequest, next: RequestStatus) {
    if (next === "completed") {
      const msg = ar
        ? "إتمام الطلب سيحدّث المخزون: تعود القطع المرتجعة للمخزون وتُخصم قطع الاستبدال. لا يمكن التراجع. هل تريد المتابعة؟"
        : "Completing this updates inventory: returned items go back into stock and replacements come out. This cannot be undone. Continue?";
      if (!window.confirm(msg)) return;
    }
    const res = await setRequestStatus(r.id, next);
    if (!res.ok) {
      window.alert(
        res.error === "insufficient_stock"
          ? ar
            ? "لا يوجد مخزون كافٍ لقطع الاستبدال — لم يتم تغيير أي شيء."
            : "Not enough stock for the replacement items — nothing was changed."
          : res.error === "migration_missing"
            ? ar
              ? "شغّلي ترحيل قاعدة البيانات 0016_returns_exchanges.sql أولاً."
              : "Run the 0016_returns_exchanges.sql migration first."
            : res.error,
      );
      return;
    }
    setRows((cur) => cur.map((x) => (x.id === r.id ? res.data : x)));
    setOpen((cur) => (cur && cur.id === r.id ? res.data : cur));
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title={ar ? "الاسترجاع والاستبدال" : "Returns & exchanges"}
        subtitle={
          ar
            ? "طلبات العملاء خلال ١٤ يوماً من الشراء — المخزون يتحدّث عند الإتمام فقط"
            : "Customer requests within 14 days of purchase — stock moves only on completion"
        }
        actions={
          <button className="btn-outline" onClick={load}>
            <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
          </button>
        }
      />

      {error === "migration_missing" && (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">
              {ar ? "شغّلي ترحيل قاعدة البيانات الخاص بالاسترجاع" : "Run the returns database migration"}
            </div>
            <code className="mt-1 block font-mono text-xs">
              supabase/migrations/0016_returns_exchanges.sql
            </code>
          </div>
        </Card>
      )}
      {error && error !== "migration_missing" && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      )}

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile
            icon={IcRefresh}
            label={ar ? "إجمالي الطلبات" : "Total requests"}
            value={num(kpi.total, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcAlert}
            label={ar ? "قيد المراجعة" : "Awaiting review"}
            value={num(kpi.pending, lang)}
            accent="amber"
            active={status === "pending"}
            onClick={() => setStatus(status === "pending" ? "all" : "pending")}
          />
          <StatTile
            icon={IcInventory}
            label={ar ? "طلبات استبدال" : "Exchanges"}
            value={num(kpi.exchanges, lang)}
            accent="sky"
            active={tab === "exchange"}
            onClick={() => setTab(tab === "exchange" ? "all" : "exchange")}
          />
          <StatTile
            icon={IcCash}
            label={ar ? "مبالغ مستردة / محصّلة" : "To refund / collect"}
            value={egp(kpi.refunds, lang)}
            sub={`${ar ? "تحصيل" : "collect"} ${egp(kpi.extra, lang)}`}
            accent="emerald"
          />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs
            tabs={[
              { key: "all", label: t("filter_all") },
              { key: "return", label: kindLabel.return[ar ? "ar" : "en"] },
              { key: "exchange", label: kindLabel.exchange[ar ? "ar" : "en"] },
            ]}
            active={tab}
            onChange={(k) => setTab(k as KindTab)}
          />
        </div>

        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={ar ? "ابحثي برقم الطلب أو العميل…" : "Search reference, order or customer…"}
          />
          <Select value={status} onChange={(v) => setStatus(v as "all" | RequestStatus)}>
            <option value="all">{t("col_status")}: {t("filter_all")}</option>
            {(Object.keys(statusLabel) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabel[s][ar ? "ar" : "en"]}</option>
            ))}
          </Select>
          {(q || status !== "all" || tab !== "all") && (
            <button
              onClick={() => { setQ(""); setStatus("all"); setTab("all"); }}
              className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
            >
              <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
            </button>
          )}
          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{ar ? "الطلب" : "Request"}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "النوع" : "Type"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_date")}</th>
                <th className="px-3 py-3 text-start font-medium">{ar ? "المهلة" : "Window"}</th>
                <th className="px-3 py-3 text-end font-medium">{ar ? "الفرق" : "Difference"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-5 py-3 text-end font-medium" />
              </tr>
            </thead>
            <tbody>
              {pg.items.map((r) => {
                const left = msLeftInWindow(r.orderCreatedAt, new Date(now));
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpen(r)}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-page"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-ink" dir="ltr">{r.reference}</div>
                      <div className="text-xs text-ink-soft" dir="ltr">#{r.orderNumber}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`badge ${
                          r.kind === "exchange"
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {kindLabel[r.kind][ar ? "ar" : "en"]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="font-medium text-ink">{r.customerName || "—"}</div>
                      <div className="text-xs text-ink-soft" dir="ltr">{r.phone}</div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{fmtDate(r.createdAt)}</td>
                    <td className={`px-3 py-3.5 text-xs ${left <= 0 ? "text-rose-600" : "text-ink-muted"}`}>
                      {formatCountdown(left, ar)}
                    </td>
                    <td className="px-3 py-3.5 text-end font-semibold">
                      {r.extraAmount > 0 ? (
                        <span className="text-emerald-600">+{egp(r.extraAmount, lang)}</span>
                      ) : (
                        <span className="text-rose-600">−{egp(r.refundAmount, lang)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill
                        label={statusLabel[r.status][ar ? "ar" : "en"]}
                        tone={statusTone[r.status]}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-end" onClick={(e) => e.stopPropagation()}>
                      {nextStatuses(r.status).length > 0 ? (
                        <Select
                          value=""
                          onChange={(v) => v && changeStatus(r, v as RequestStatus)}
                        >
                          <option value="">{ar ? "تغيير الحالة" : "Change status"}</option>
                          {nextStatuses(r.status).map((s) => (
                            <option key={s} value={s}>{statusLabel[s][ar ? "ar" : "en"]}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-ink-soft">
                          {ar ? "تم تحديث المخزون" : "Stock updated"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && <div className="py-14 text-center text-sm text-ink-soft">{t("loading")}</div>}
          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcRefresh className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {ar ? "لا توجد طلبات استرجاع أو استبدال" : "No returns or exchanges yet"}
                </div>
                <p className="mt-1 max-w-sm text-sm text-ink-soft">
                  {ar
                    ? "تظهر هنا طلبات العملاء من صفحتي الاسترجاع والاستبدال في المتجر."
                    : "Requests customers open from the storefront's return and exchange pages land here."}
                </p>
              </div>
            </div>
          )}
        </div>

        {!loading && <Pagination {...pg} />}
      </Card>

      {open && (
        <RequestDrawer
          request={open}
          ar={ar}
          lang={lang}
          onClose={() => setOpen(null)}
          onStatus={(s) => changeStatus(open, s)}
          onSaved={(r) => {
            setRows((cur) => cur.map((x) => (x.id === r.id ? r : x)));
            setOpen(r);
          }}
        />
      )}
    </>
  );
}

/* -------------------------------- drawer --------------------------------- */

function RequestDrawer({
  request,
  ar,
  lang,
  onClose,
  onStatus,
  onSaved,
}: {
  request: ReturnRequest;
  ar: boolean;
  lang: "ar" | "en";
  onClose: () => void;
  onStatus: (s: RequestStatus) => void;
  onSaved: (r: ReturnRequest) => void;
}) {
  const [note, setNote] = useState(request.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const returning = request.lines.filter((l) => l.direction === "return");
  const replacing = request.lines.filter((l) => l.direction === "replacement");

  async function saveNote() {
    setSaving(true);
    await setRequestNote(request.id, note);
    setSaving(false);
    onSaved({ ...request, adminNote: note.trim() || null });
  }

  const Lines = ({ title, lines }: { title: string; lines: typeof returning }) =>
    lines.length === 0 ? null : (
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IcImage className="h-4 w-4 text-ink-soft" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{l.productName}</div>
                <div className="text-xs text-ink-soft">
                  {l.variantTitle ? `${l.variantTitle} · ` : ""}
                  {l.sku ? `${l.sku} · ` : ""}× {l.quantity}
                  {!l.itemId && (
                    <span className="ms-1 text-amber-600">
                      {ar ? "(غير مرتبط بالمخزون)" : "(not linked to stock)"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-ink">{egp(l.price * l.quantity, lang)}</div>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink" dir="ltr">{request.reference}</h2>
              <StatusPill
                label={statusLabel[request.status][ar ? "ar" : "en"]}
                tone={statusTone[request.status]}
              />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              {kindLabel[request.kind][ar ? "ar" : "en"]} · <span dir="ltr">#{request.orderNumber}</span>
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-soft">{ar ? "العميل" : "Customer"}</dt>
              <dd className="font-medium text-ink">{request.customerName || "—"}</dd>
              <dd className="text-xs text-ink-soft" dir="ltr">{request.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{ar ? "المهلة تنتهي" : "Window closes"}</dt>
              <dd className="font-medium text-ink" dir="ltr">
                {new Date(request.windowExpiresAt).toLocaleString(ar ? "ar-EG" : "en-GB")}
              </dd>
            </div>
            {request.reason && (
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">{ar ? "السبب" : "Reason"}</dt>
                <dd className="text-ink">{request.reason}</dd>
              </div>
            )}
            {request.note && (
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">{ar ? "ملاحظة العميل" : "Customer note"}</dt>
                <dd className="text-ink">{request.note}</dd>
              </div>
            )}
          </dl>

          <Lines title={ar ? "قطع مرتجعة (تعود للمخزون)" : "Coming back (into stock)"} lines={returning} />
          <Lines title={ar ? "قطع بديلة (تُخصم من المخزون)" : "Going out (out of stock)"} lines={replacing} />

          <section className="mt-5 rounded-xl border border-line p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">{ar ? "قيمة المرتجع" : "Returned value"}</span>
              <span className="font-medium text-ink">{egp(request.returnedValue, lang)}</span>
            </div>
            {request.kind === "exchange" && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-ink-muted">{ar ? "قيمة البديل" : "Replacement value"}</span>
                <span className="font-medium text-ink">{egp(request.replacementValue, lang)}</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold text-ink">
                {request.extraAmount > 0
                  ? ar ? "يدفع العميل" : "Customer pays"
                  : ar ? "يُرد للعميل" : "Refund to customer"}
              </span>
              <span
                className={`text-lg font-bold ${request.extraAmount > 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {egp(request.extraAmount > 0 ? request.extraAmount : request.refundAmount, lang)}
              </span>
            </div>
          </section>

          <section className="mt-5">
            <label className="text-sm font-semibold text-ink">{ar ? "ملاحظة داخلية" : "Internal note"}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-line bg-surface-page p-3 text-sm outline-none focus:border-brand-600"
            />
            <button onClick={saveNote} disabled={saving} className="btn-outline mt-2 h-9 px-3 text-xs">
              {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ الملاحظة" : "Save note")}
            </button>
          </section>
        </div>

        <div className="mt-auto border-t border-line px-5 py-4">
          {request.inventoryAppliedAt ? (
            <p className="text-center text-sm text-emerald-700">
              ✓ {ar ? "تم تحديث المخزون في" : "Inventory updated"}{" "}
              <span dir="ltr">
                {new Date(request.inventoryAppliedAt).toLocaleString(ar ? "ar-EG" : "en-GB")}
              </span>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {nextStatuses(request.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatus(s)}
                    className={s === "completed" ? "btn-primary h-10 px-4 text-sm" : "btn-outline h-10 px-4 text-sm"}
                  >
                    {statusLabel[s][ar ? "ar" : "en"]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {ar
                  ? "المخزون يتغيّر فقط عند اختيار «مكتمل»."
                  : "Inventory changes only when you mark this Completed."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
