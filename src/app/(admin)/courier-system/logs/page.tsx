"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { StatusPill, Toolbar, SearchInput, Select, Pagination, usePagination } from "@/components/dashboard-ui";
import { IcClipboard } from "@/components/icons";
import { LOG_ACTION, logActionLabel, type CourierLog } from "@/lib/courier-ops";
import { listLogs } from "../actions";

const ACTION_KEYS = Object.keys(LOG_ACTION);

export default function LogsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<CourierLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listLogs();
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      const ts = new Date(r.createdAt).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      if (!q) return true;
      return (
        (r.actor ?? "").toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.orderNumber ?? "").toLowerCase().includes(q) ||
        (r.detail ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, action, from, to]);

  const pg = usePagination(filtered, { perPage: 25, resetKey: `${search}|${action}|${from}|${to}` });

  const dateCls = "h-9 rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600 focus:bg-surface";

  return (
    <>
      <PageHeader
        title={ar ? "سجل العمليات" : "Activity log"}
        subtitle={ar ? "سجل تدقيق لكل تعديلات نظام الشحن" : "Audit trail of every Courier System edit"}
      />

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={ar ? "ابحث بالمستخدم، الطلب، التفاصيل…" : "Search actor, order, detail…"} />
          <Select value={action} onChange={setAction}>
            <option value="all">{ar ? "كل العمليات" : "All actions"}</option>
            {ACTION_KEYS.map((a) => <option key={a} value={a}>{logActionLabel(a, ar)}</option>)}
          </Select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateCls} aria-label={ar ? "من" : "From"} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateCls} aria-label={ar ? "إلى" : "To"} />
          <span className="ms-auto text-sm text-ink-soft">{num(filtered.length, lang)} {ar ? "عملية" : "entries"}</span>
        </Toolbar>

        {loading ? (
          <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcClipboard className="h-6 w-6" /></span>
            <div className="font-semibold text-ink">{ar ? "لا عمليات مطابقة" : "No matching activity"}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "المستخدم" : "Actor"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "العملية" : "Action"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الطلب" : "Order #"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "التفاصيل" : "Detail"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pg.items.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-page/60">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted" dir="ltr">{new Date(l.createdAt).toLocaleString(ar ? "ar-EG" : "en-US", { year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-medium text-ink">{l.actor ?? "—"}</td>
                    <td className="px-4 py-3"><StatusPill label={logActionLabel(l.action, ar)} tone={LOG_ACTION[l.action]?.tone ?? "neutral"} /></td>
                    <td className="px-4 py-3 text-ink-muted" dir="ltr">{l.orderNumber ? `#${l.orderNumber}` : "—"}</td>
                    <td className="px-4 py-3"><span className="block max-w-[26rem] truncate text-ink-muted">{l.detail || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...pg} />
      </Card>
    </>
  );
}
