"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { slotLabel } from "@/lib/offers";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  labels,
  salesSeries,
  type Order,
  type PayMethod,
} from "@/lib/data";
import { listStoreOrders } from "../../store/actions";
import {
  getOrderDetail,
  collectPayment,
  refundPayment,
  fulfillOrder,
  undoFulfillment,
  type OrderDetail,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import {
  KpiStrip,
  StatusPill,
  ViewTabs,
  Checkbox,
  Toolbar,
  SearchInput,
  Select,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import { IcFile, IcX, IcChevron, IcCash, IcCourier } from "@/components/icons";
import { ChannelBadge } from "@/components/channel-badge";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/channel";

/**
 * The orders list, mounted twice.
 *
 * Once at /orders showing everything, and once at /app/orders with the channel
 * pinned. Deliberately one component rather than two pages: a forked copy of a
 * list this size stops matching the original within a month, and the merchant
 * ends up with two screens that disagree about the same orders.
 *
 * When `lockChannel` is set the channel stops being a filter and becomes the
 * page's subject — the picker goes away, and clearing the filters cannot
 * escape it.
 */

type Tab = "all" | "unfulfilled" | "unpaid" | "open" | "attention";
type SortKey = "newest" | "oldest" | "total_high" | "total_low";

// Status → pill, covering the real Shopify-style vocabulary the order money /
// fulfillment functions now write (plus the legacy courier values, just in case
// an old row still carries one).
type StatusMeta = { tone: PillTone; hollow: boolean; ar: string; en: string };

function paymentMeta(status: string): StatusMeta {
  switch (status) {
    case "paid": return { tone: "success", hollow: false, ar: "مدفوع", en: "Paid" };
    case "partially_paid": return { tone: "warning", hollow: false, ar: "مدفوع جزئياً", en: "Partially paid" };
    case "partially_refunded": return { tone: "neutral", hollow: false, ar: "مسترجع جزئياً", en: "Partially refunded" };
    case "refunded": return { tone: "neutral", hollow: false, ar: "مسترجع", en: "Refunded" };
    case "authorized": return { tone: "info", hollow: false, ar: "محجوز", en: "Authorized" };
    default: return { tone: "warning", hollow: true, ar: "غير مدفوع", en: "Unpaid" };
  }
}
function fulfillMeta(status: string): StatusMeta {
  switch (status) {
    case "fulfilled": return { tone: "success", hollow: false, ar: "مُنفّذ", en: "Fulfilled" };
    case "partial": return { tone: "warning", hollow: false, ar: "مُنفّذ جزئياً", en: "Partially fulfilled" };
    case "delivered": return { tone: "success", hollow: false, ar: "تم التسليم", en: "Delivered" };
    case "returned": return { tone: "critical", hollow: false, ar: "مرتجع", en: "Returned" };
    default: return { tone: "neutral", hollow: true, ar: "غير مُنفّذ", en: "Unfulfilled" };
  }
}

type OrderFlag = NonNullable<Order["flag"]>;
const flagPill: Record<OrderFlag, PillTone> = {
  fake_cod: "critical",
  return: "neutral",
  unpaid_delivered: "warning",
};

// Table row = an order plus the extra columns the Shopify-style list shows.
type Row = Order & { itemsCount: number; channel: Channel };

export function OrdersList({ lockChannel }: { lockChannel?: Channel } = {}) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<string>("all");
  const [fulfillment, setFulfillment] = useState<string>("all");
  const [method, setMethod] = useState<"all" | PayMethod>("all");
  const [channel, setChannel] = useState<"all" | Channel>(lockChannel ?? "all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Order | null>(null);
  const [placed, setPlaced] = useState<Row[]>([]);

  const reload = useCallback(async () => {
    const res = await listStoreOrders();
    if (res.ok) {
      setPlaced(
        res.data.map((o): Row => ({
          id: o.id,
          customer: o.customer,
          phone: o.phone,
          governorate: o.governorate,
          total: o.total,
          method: o.method,
          lifecycle: o.lifecycle,
          payment: o.payment,
          fulfillment: o.fulfillment,
          date: o.date,
          itemsCount: o.itemsCount,
          channel: o.channel,
        })),
      );
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Orders that were actually placed, and nothing else. This list used to end
  // with ten invented ones from the days before the store was live; they made
  // the counts, the revenue and the customer list read as fiction.
  const orders = placed;

  const ar = lang === "ar";
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
    });

  const flagLabel = (f: OrderFlag) =>
    f === "fake_cod"
      ? ar
        ? "اشتباه وهمي"
        : "Suspected fake"
      : f === "unpaid_delivered"
        ? ar
          ? "سُلّم بدون تحصيل"
          : "Unpaid, delivered"
        : ar
          ? "مرتجع"
          : "Return";

  // ---- KPIs + sparklines ----
  const kpi = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const cod = orders.filter((o) => o.method === "cod").length;
    const unfulfilled = orders.filter((o) => o.fulfillment === "unfulfilled").length;
    const delivered = orders.filter((o) => o.fulfillment === "delivered").length;
    return {
      count: orders.length,
      revenue,
      codShare: orders.length ? Math.round((cod / orders.length) * 100) : 0,
      unfulfilled,
      delivered,
    };
  }, [orders]);
  const ordersSpark = salesSeries.map((s) => s.orders);
  const salesSpark = salesSeries.map((s) => s.sales);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "unfulfilled", label: t("f_unfulfilled") },
    { key: "unpaid", label: t("p_pending") },
    { key: "open", label: ar ? "مفتوحة" : "Open" },
    { key: "attention", label: t("needs_attention") },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (tab === "unfulfilled" && o.fulfillment !== "unfulfilled") return false;
      if (tab === "unpaid" && o.payment !== "pending") return false;
      if (tab === "open" && (o.lifecycle === "completed" || o.lifecycle === "cancelled"))
        return false;
      if (tab === "attention" && !o.flag) return false;
      if (payment !== "all" && o.payment !== payment) return false;
      if (fulfillment !== "all" && o.fulfillment !== fulfillment) return false;
      if (method !== "all" && o.method !== method) return false;
      if (channel !== "all" && o.channel !== channel) return false;
      if (needle) {
        const hay = `${o.id} ${o.customer} ${o.phone} ${o.governorate}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.date.localeCompare(b.date);
        case "total_high":
          return b.total - a.total;
        case "total_low":
          return a.total - b.total;
        default:
          return b.date.localeCompare(a.date) || Number(b.id) - Number(a.id);
      }
    });
    return sorted;
  }, [orders, tab, q, payment, fulfillment, method, channel, sort]);

  const pg = usePagination(filtered, {
    perPage: 20,
    resetKey: `${tab}|${q}|${payment}|${fulfillment}|${method}|${channel}|${sort}`,
  });

  const filtersActive =
    q !== "" ||
    payment !== "all" ||
    fulfillment !== "all" ||
    method !== "all" ||
    (!lockChannel && channel !== "all");
  // Bulk selection acts on the visible page, the way every list app behaves.
  const allSelected = pg.items.length > 0 && pg.items.every((o) => selected.has(o.id));
  const someSelected = pg.items.some((o) => selected.has(o.id));

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(pg.items.map((o) => o.id));
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <>
      <PageHeader
        title={
          lockChannel
            ? `${t("nav_orders")} — ${CHANNEL_LABELS[lockChannel][ar ? "ar" : "en"]}`
            : t("nav_orders")
        }
        subtitle={
          lockChannel === "app"
            ? ar
              ? "الطلبات القادمة من التطبيق فقط"
              : "Orders placed in the app only"
            : ar
              ? "إدارة ومتابعة الطلبات"
              : "Manage & track orders"
        }
        actions={
          <>
            <button className="btn-outline">{t("export")}</button>
            <button className="btn-primary">{ar ? "إنشاء طلب" : "Create order"}</button>
          </>
        }
      />

      <Card className="overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
        </div>

        {/* Toolbar or bulk bar */}
        {someSelected ? (
          <div className="flex items-center gap-3 border-b border-line bg-brand-50/50 px-3 py-2.5">
            <span className="text-sm font-medium text-ink">
              {num([...selected].length, lang)} {ar ? "محدد" : "selected"}
            </span>
            <button
              onClick={async () => {
                const ids = [...selected];
                for (const id of ids) await fulfillOrder(id);
                setSelected(new Set());
                await reload();
              }}
              className="btn-outline h-8 px-3 text-xs"
            >
              {ar ? "تعليم كمنفّذ" : "Mark fulfilled"}
            </button>
            <button className="btn-outline h-8 px-3 text-xs">{t("export")}</button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost ms-auto h-8 px-2 text-xs">
              <IcX className="h-3.5 w-3.5" /> {ar ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>
        ) : (
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder={t("search")} />
            <Select value={payment} onChange={(v) => setPayment(v)}>
              <option value="all">{t("col_payment")}</option>
              {["pending", "partially_paid", "paid", "partially_refunded", "refunded"].map((p) => {
                const m = paymentMeta(p);
                return <option key={p} value={p}>{ar ? m.ar : m.en}</option>;
              })}
            </Select>
            <Select value={fulfillment} onChange={(v) => setFulfillment(v)}>
              <option value="all">{t("col_fulfillment")}</option>
              {["unfulfilled", "partial", "fulfilled"].map((f) => {
                const m = fulfillMeta(f);
                return <option key={f} value={f}>{ar ? m.ar : m.en}</option>;
              })}
            </Select>
            <Select value={method} onChange={(v) => setMethod(v as "all" | PayMethod)}>
              <option value="all">{ar ? "طريقة الدفع" : "Method"}</option>
              {(["cod", "card", "wallet"] as PayMethod[]).map((m) => (
                <option key={m} value={m}>{t(labels.methodKey[m])}</option>
              ))}
            </Select>
            {!lockChannel && (
              <Select value={channel} onChange={(v) => setChannel(v as "all" | Channel)}>
                <option value="all">{t("col_channel")}</option>
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>{CHANNEL_LABELS[ch][ar ? "ar" : "en"]}</option>
                ))}
              </Select>
            )}
            <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
              <option value="newest">{t("sort_label")}: {ar ? "الأحدث" : "Newest"}</option>
              <option value="oldest">{ar ? "الأقدم" : "Oldest"}</option>
              <option value="total_high">{ar ? "الأعلى قيمة" : "Total high → low"}</option>
              <option value="total_low">{ar ? "الأقل قيمة" : "Total low → high"}</option>
            </Select>
            {filtersActive && (
              <button
                onClick={() => {
                  setPayment("all");
                  setFulfillment("all");
                  setMethod("all");
                  setChannel(lockChannel ?? "all");
                  setQ("");
                }}
                className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
              >
                <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
              </button>
            )}
            <span className="ms-auto text-xs text-ink-soft">
              {num(filtered.length, lang)} {t("results_word")}
            </span>
          </Toolbar>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="w-10 ps-5 pe-2 py-3">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th className="px-3 py-3 text-start font-medium">{t("col_order")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_date")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_total")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_payment")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_fulfillment")}</th>
                <th className="px-3 py-3 text-end font-medium">{ar ? "الأصناف" : "Items"}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                {!lockChannel && (
                  <th className="px-5 py-3 text-start font-medium">{t("col_channel")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {pg.items.map((o) => {
                const sel = selected.has(o.id);
                return (
                  <tr
                    key={o.id}
                    onClick={() => setDetail(o)}
                    className={`cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-page ${
                      sel ? "bg-brand-50/40" : ""
                    }`}
                  >
                    <td className="ps-5 pe-2 py-3.5">
                      <Checkbox checked={sel} onChange={() => toggleOne(o.id)} />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">#{o.id}</span>
                        {o.flag && <IcFile className="h-3.5 w-3.5 text-ink-soft" />}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{fmtDate(o.date)}</td>
                    <td className="px-3 py-3.5">
                      <div className="font-medium text-ink">{o.customer}</div>
                      <div className="text-xs text-ink-soft" dir="ltr">{o.phone}</div>
                    </td>
                    <td className="px-3 py-3.5 text-end font-semibold text-ink">
                      {egp(o.total, lang)}
                    </td>
                    <td className="px-3 py-3.5">
                      {(() => {
                        const m = paymentMeta(String(o.payment));
                        return <StatusPill label={ar ? m.ar : m.en} tone={m.tone} hollow={m.hollow} />;
                      })()}
                    </td>
                    <td className="px-3 py-3.5">
                      {(() => {
                        const m = fulfillMeta(String(o.fulfillment));
                        return <StatusPill label={ar ? m.ar : m.en} tone={m.tone} hollow={m.hollow} />;
                      })()}
                    </td>
                    <td className="px-3 py-3.5 text-end text-ink-muted">
                      {num(o.itemsCount, lang)} <span className="text-ink-soft">{ar ? "صنف" : "items"}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-muted">{o.governorate}</span>
                        {o.flag && <StatusPill label={flagLabel(o.flag)} tone={flagPill[o.flag]} />}
                      </div>
                    </td>
                    {!lockChannel && (
                      <td className="px-5 py-3.5">
                        <ChannelBadge value={o.channel} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="font-semibold text-ink">{ar ? "لا توجد طلبات مطابقة" : "No matching orders"}</div>
              <p className="mt-1 text-sm text-ink-soft">
                {ar ? "جرّب تعديل الفلاتر." : "Try adjusting your filters."}
              </p>
            </div>
          )}
        </div>

        <Pagination {...pg} />
      </Card>

      {detail && (
        <OrderDetailDrawer
          order={detail}
          onClose={() => setDetail(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}

// ---- Order detail drawer (Shopify-style) ------------------------------------
const PAY_METHODS: { value: string; ar: string; en: string }[] = [
  { value: "cash", ar: "نقدي", en: "Cash" },
  { value: "cod", ar: "عند الاستلام", en: "Cash on delivery" },
  { value: "card", ar: "بطاقة", en: "Card" },
  { value: "instapay", ar: "إنستاباي", en: "InstaPay" },
  { value: "wallet", ar: "محفظة", en: "Wallet" },
  { value: "bank_transfer", ar: "تحويل بنكي", en: "Bank transfer" },
  { value: "other", ar: "أخرى", en: "Other" },
];
function methodLabel(v: string, ar: boolean): string {
  const m = PAY_METHODS.find((x) => x.value === v);
  return m ? (ar ? m.ar : m.en) : v;
}
function orderErrorText(code: string, ar: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    migration_missing: { ar: "شغّلي ترحيل قاعدة البيانات 0028.", en: "Run database migration 0028." },
    refund_exceeds_paid: { ar: "المبلغ أكبر من المدفوع.", en: "Refund exceeds what was paid." },
    invalid_amount: { ar: "أدخلي مبلغاً صحيحاً.", en: "Enter a valid amount." },
    nothing_to_fulfill: { ar: "لا يوجد ما يُنفَّذ.", en: "Nothing left to fulfill." },
    order_not_found: { ar: "الطلب غير موجود.", en: "Order not found." },
  };
  const e = map[code];
  return e ? (ar ? e.ar : e.en) : ar ? "حدث خطأ." : "Something went wrong.";
}

function OrderDetailDrawer({
  order: o,
  onClose,
  onChanged,
}: {
  order: Order;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [d, setD] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "collect" | "refund" | "fulfill">(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getOrderDetail(o.id);
    if (res.ok) {
      setD(res.data);
      setErr(null);
    } else setErr(res.error);
    setLoading(false);
  }, [o.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function afterChange() {
    await load();
    onChanged();
  }

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString(ar ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtTime = (s: string) =>
    new Date(s).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const payStatus = d?.paymentStatus ?? String(o.payment);
  const fulStatus = d?.fulfillmentStatus ?? String(o.fulfillment);
  const pm = paymentMeta(payStatus);
  const fm = fulfillMeta(fulStatus);
  const remainingTotal = d ? d.items.reduce((s, li) => s + (li.quantity - li.fulfilledQuantity), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">#{o.id}</h2>
              <StatusPill label={ar ? pm.ar : pm.en} tone={pm.tone} hollow={pm.hollow} />
              <StatusPill label={ar ? fm.ar : fm.en} tone={fm.tone} hollow={fm.hollow} />
            </div>
            <p className="mt-1 text-xs text-ink-soft">{fmt(o.date)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 shrink-0 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {err && (
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{orderErrorText(err, ar)}</div>
          )}

          {/* Fulfillment card */}
          <div className="rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCourier className="h-4 w-4 text-ink-soft" />
                {ar ? "التنفيذ" : "Fulfillment"}
              </div>
              <StatusPill label={ar ? fm.ar : fm.en} tone={fm.tone} hollow={fm.hollow} />
            </div>
            {loading ? (
              <div className="px-4 py-4 text-sm text-ink-soft">{t("loading")}</div>
            ) : d && d.items.length ? (
              <div className="divide-y divide-line">
                {d.items.map((li) => {
                  const remaining = li.quantity - li.fulfilledQuantity;
                  return (
                    <div key={li.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                        {li.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={li.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-medium text-ink">{li.productName}</div>
                        <div className="text-xs text-ink-soft">
                          {li.variantTitle ? `${li.variantTitle} · ` : ""}
                          {li.sku ? <span dir="ltr">{li.sku}</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {remaining === 0 ? (
                            <span className="text-emerald-600">{ar ? "تم التنفيذ" : "Fulfilled"} ✓</span>
                          ) : (
                            <span className="text-amber-600">
                              {ar
                                ? `${num(li.fulfilledQuantity, lang)} من ${num(li.quantity, lang)} مُنفّذ`
                                : `${li.fulfilledQuantity} of ${li.quantity} fulfilled`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-end text-sm">
                        <div className="text-ink-muted">
                          {egp(li.price, lang)} × {num(li.quantity, lang)}
                        </div>
                        <div className="font-semibold text-ink">{egp(li.price * li.quantity, lang)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-ink-soft">{ar ? "لا توجد أصناف." : "No line items."}</div>
            )}

            {d && remainingTotal > 0 && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                <button onClick={() => fulfillAll()} className="btn-outline h-9">
                  {ar ? "تنفيذ الكل" : "Fulfill all"}
                </button>
                <button onClick={() => setModal("fulfill")} className="btn-primary h-9">
                  {ar ? "تنفيذ أصناف" : "Fulfill items"}
                </button>
              </div>
            )}

            {/* Fulfillment history */}
            {d && d.fulfillments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "سجل التنفيذ" : "Fulfillment history"}
                </div>
                <ul className="space-y-2">
                  {d.fulfillments.map((f) => (
                    <li key={f.id} className="rounded-lg bg-surface-page px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-ink">
                          {f.items.reduce((s, i) => s + i.quantity, 0)} {ar ? "قطعة" : "items"} · {fmtTime(f.createdAt)}
                        </span>
                        <button onClick={() => undo(f.id)} className="text-rose-500 hover:underline">
                          {ar ? "تراجع" : "Undo"}
                        </button>
                      </div>
                      {f.tracking && (
                        <div className="mt-0.5 text-ink-soft" dir="ltr">
                          {f.carrier ? `${f.carrier} · ` : ""}{f.tracking}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Payment card */}
          <div className="rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IcCash className="h-4 w-4 text-ink-soft" />
                {ar ? "الدفع" : "Payment"}
              </div>
              <StatusPill label={ar ? pm.ar : pm.en} tone={pm.tone} hollow={pm.hollow} />
            </div>
            <div className="space-y-2 px-4 py-3 text-sm">
              <Row label={ar ? "الإجمالي الفرعي" : "Subtotal"} value={egp(d?.subtotal ?? o.total, lang)} />
              <Row label={ar ? "الشحن" : "Shipping"} value={egp(d?.shipping ?? 0, lang)} muted />
              <div className="my-1 border-t border-line" />
              <Row label={ar ? "الإجمالي" : "Total"} value={egp(d?.total ?? o.total, lang)} bold />
              <Row label={ar ? "المدفوع" : "Paid"} value={egp(d?.amountPaid ?? 0, lang)} muted />
              <Row label={ar ? "المتبقي" : "Balance"} value={egp(d?.balance ?? o.total, lang)} bold />
            </div>

            {/* Payment timeline */}
            {d && d.payments.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "سجل المدفوعات" : "Payment history"}
                </div>
                <ul className="space-y-1.5">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        {p.kind === "refund" ? (ar ? "استرجاع" : "Refund") : (ar ? "دفعة" : "Payment")} ·{" "}
                        {methodLabel(p.method, ar)} · {fmtTime(p.createdAt)}
                        {p.reference ? <span className="text-ink-soft" dir="ltr"> · {p.reference}</span> : null}
                      </span>
                      <span className={p.kind === "refund" ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
                        {p.kind === "refund" ? "−" : "+"}{egp(p.amount, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                {d.amountPaid > 0 && (
                  <button onClick={() => setModal("refund")} className="btn-outline h-9">
                    {ar ? "استرجاع" : "Refund"}
                  </button>
                )}
                {d.balance > 0 && (
                  <button onClick={() => setModal("collect")} className="btn-primary h-9">
                    <IcCash className="h-4 w-4" /> {ar ? "تحصيل الدفع" : "Collect payment"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="rounded-2xl border border-line px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-ink">{ar ? "العميل" : "Customer"}</div>
            <div className="text-sm font-medium text-ink">{d?.customerName || o.customer}</div>
            <div className="mt-0.5 text-sm text-ink-muted" dir="ltr">{d?.phone || o.phone}</div>
            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {ar ? "عنوان الشحن" : "Shipping address"}
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {[d?.address, d?.city, d?.governorate ?? o.governorate].filter(Boolean).join("، ")}، {ar ? "مصر" : "Egypt"}
            </div>

            {/* When the shopper asked for it. Picked after checkout, on the
                thank-you page, so it is missing on most orders — and worth
                showing loudly on the ones that have it, since it is a promise
                the shop made about a specific morning. */}
            {(d?.preferredDeliveryDate || d?.preferredDeliverySlot) && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "موعد التوصيل المطلوب" : "Requested delivery"}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {[
                    d.preferredDeliveryDate
                      ? new Date(d.preferredDeliveryDate).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })
                      : null,
                    slotLabel(d.preferredDeliverySlot, ar ? "ar" : "en") || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </>
            )}

            {/* The merchant note carries the same choice plus anything else the
                order was placed with (gift wrap, coupon), which is why it sits
                with the customer rather than off in its own panel. */}
            {d?.note && (
              <>
                <div className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {ar ? "ملاحظات الطلب" : "Order notes"}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{d.note}</div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button onClick={onClose} className="btn-outline">{ar ? "إغلاق" : "Close"}</button>
        </div>
      </div>

      {modal === "collect" && d && (
        <PaymentModal
          kind="payment"
          orderNumber={o.id}
          defaultAmount={d.balance}
          maxAmount={d.balance}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await afterChange();
          }}
        />
      )}
      {modal === "refund" && d && (
        <PaymentModal
          kind="refund"
          orderNumber={o.id}
          defaultAmount={d.amountPaid}
          maxAmount={d.amountPaid}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await afterChange();
          }}
        />
      )}
      {modal === "fulfill" && d && (
        <FulfillModal
          orderNumber={o.id}
          items={d.items}
          ar={ar}
          lang={lang}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await afterChange();
          }}
        />
      )}
    </div>
  );

  async function fulfillAll() {
    const res = await fulfillOrder(o.id);
    if (!res.ok) setErr(res.error);
    await afterChange();
  }
  async function undo(fulfillmentId: string) {
    await undoFulfillment(fulfillmentId);
    await afterChange();
  }
}

// ---- Collect payment / refund modal -----------------------------------------
function PaymentModal({
  kind,
  orderNumber,
  defaultAmount,
  maxAmount,
  ar,
  lang,
  onClose,
  onDone,
}: {
  kind: "payment" | "refund";
  orderNumber: string;
  defaultAmount: number;
  maxAmount: number;
  ar: boolean;
  lang: "ar" | "en";
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr(ar ? "أدخلي مبلغاً صحيحاً." : "Enter a valid amount.");
      return;
    }
    setBusy(true);
    const res =
      kind === "payment"
        ? await collectPayment(orderNumber, { amount: amt, method, reference, note })
        : await refundPayment(orderNumber, { amount: amt, method, note });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(orderErrorText(res.error, ar));
  }

  const title =
    kind === "payment" ? (ar ? "تحصيل الدفع" : "Collect payment") : ar ? "استرجاع مبلغ" : "Refund";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-base font-semibold text-ink">{title}</div>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">
            {ar ? "المبلغ" : "Amount"}{" "}
            <span className="text-ink-soft">({ar ? "بحد أقصى" : "max"} {egp(maxAmount, lang)})</span>
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            inputMode="decimal"
          />
        </label>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "طريقة الدفع" : "Payment method"}</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {PAY_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>
            ))}
          </select>
        </label>
        {kind === "payment" && (
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "مرجع (اختياري)" : "Reference (optional)"}</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={ar ? "رقم الإيصال / المعاملة" : "Receipt / transaction no."}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </label>
        )}
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </label>
        {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">
            {busy ? "…" : title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Fulfill items modal ----------------------------------------------------
function FulfillModal({
  orderNumber,
  items,
  ar,
  lang,
  onClose,
  onDone,
}: {
  orderNumber: string;
  items: { id: string; productName: string; quantity: number; fulfilledQuantity: number }[];
  ar: boolean;
  lang: "ar" | "en";
  onClose: () => void;
  onDone: () => void;
}) {
  const outstanding = items.filter((li) => li.quantity - li.fulfilledQuantity > 0);
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(outstanding.map((li) => [li.id, li.quantity - li.fulfilledQuantity])),
  );
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const chosen = outstanding
      .map((li) => ({ orderItemId: li.id, quantity: Math.max(0, Math.min(qty[li.id] ?? 0, li.quantity - li.fulfilledQuantity)) }))
      .filter((x) => x.quantity > 0);
    if (chosen.length === 0) {
      setErr(ar ? "اختاري كمية واحدة على الأقل." : "Choose at least one item.");
      return;
    }
    setBusy(true);
    const res = await fulfillOrder(orderNumber, { items: chosen, tracking, carrier });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(orderErrorText(res.error, ar));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-base font-semibold text-ink">{ar ? "تنفيذ الأصناف" : "Fulfill items"}</div>
        <div className="mb-3 space-y-2">
          {outstanding.map((li) => {
            const max = li.quantity - li.fulfilledQuantity;
            return (
              <div key={li.id} className="flex items-center gap-3 rounded-lg bg-surface-page px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm text-ink">{li.productName}</div>
                  <div className="text-xs text-ink-soft">{ar ? `متبقٍ ${num(max, lang)}` : `${max} remaining`}</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={qty[li.id] ?? 0}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [li.id]: Math.max(0, Math.min(Number(e.target.value) || 0, max)) }))
                  }
                  className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "شركة الشحن" : "Carrier"}</span>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "رقم التتبّع" : "Tracking no."}</span>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </label>
        </div>
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">
            {busy ? "…" : ar ? "تنفيذ" : "Fulfill"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-ink-soft" : "text-ink-muted"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : muted ? "text-ink-soft" : "text-ink"}>{value}</span>
    </div>
  );
}

