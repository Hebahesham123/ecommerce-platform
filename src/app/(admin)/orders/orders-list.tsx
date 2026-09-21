"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  labels,
  type Order,
  type PayMethod,
} from "@/lib/data";
import { listStoreOrders } from "../../store/actions";
import {
  getOrderDetail,
  fulfillOrder,
  type OrderDetail,
} from "./actions";
import { paymentMeta, fulfillMeta, methodLabel } from "./order-ui";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { Card } from "@/components/ui";
import {
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
import { IcFile, IcX, IcCash, IcCourier } from "@/components/icons";
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
 *
 * A row opens the order's own page (/orders/1007). The payment and fulfillment
 * pills are their own click: they open a small popover — the items, the history,
 * and a button through to the full page — so a merchant can glance at "what's in
 * this" without leaving the list.
 */

type Tab = "all" | "unfulfilled" | "unpaid" | "open" | "attention";
type SortKey = "newest" | "oldest" | "total_high" | "total_low";

type OrderFlag = NonNullable<Order["flag"]>;
const flagPill: Record<OrderFlag, PillTone> = {
  fake_cod: "critical",
  return: "neutral",
  unpaid_delivered: "warning",
};

// Table row = an order plus the extra columns the Shopify-style list shows.
type Row = Order & { itemsCount: number; channel: Channel };

type Pop = { order: Row; kind: "payment" | "fulfillment"; x: number; y: number };

export function OrdersList({ lockChannel }: { lockChannel?: Channel } = {}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const basePath = lockChannel ? "/app/orders" : "/orders";
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<string>("all");
  const [fulfillment, setFulfillment] = useState<string>("all");
  const [method, setMethod] = useState<"all" | PayMethod>("all");
  const [channel, setChannel] = useState<"all" | Channel>(lockChannel ?? "all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<Pop | null>(null);
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

  // Orders that were actually placed, and nothing else.
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

  const openPill = (o: Row, kind: "payment" | "fulfillment", e: ReactMouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    // Clamp so a pill near the right edge doesn't push the card off-screen.
    const x = Math.min(r.left, window.innerWidth - 340);
    setPop({ order: o, kind, x: Math.max(8, x), y: r.bottom + 6 });
  };

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

  const columns: Column<(typeof pg.items)[number]>[] = [
    {
      key: "order",
      header: t("col_order"),
      rank: "title",
      cell: (o) => (
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-ink">#{o.id}</span>
          {o.flag && <IcFile className="h-3.5 w-3.5 text-ink-soft" />}
          <span className="font-normal text-ink-muted sm:hidden">· {o.customer}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: t("col_total"),
      rank: "primary",
      align: "end",
      cell: (o) => <span className="font-semibold text-ink">{egp(o.total, lang)}</span>,
    },
    {
      key: "payment",
      header: t("col_payment"),
      rank: "primary",
      cell: (o) => {
        const m = paymentMeta(String(o.payment));
        return (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => openPill(o, "payment", e)}
            className="inline-flex cursor-pointer rounded-full outline-none ring-brand-500/40 focus-visible:ring-2"
            title={ar ? "عرض تفاصيل الدفع" : "Payment details"}
          >
            <StatusPill label={ar ? m.ar : m.en} tone={m.tone} hollow={m.hollow} />
          </span>
        );
      },
    },
    {
      key: "date",
      header: t("col_date"),
      rank: "secondary",
      cell: (o) => <span className="text-ink-muted">{fmtDate(o.date)}</span>,
    },
    {
      key: "customer",
      header: t("col_customer"),
      rank: "secondary",
      cell: (o) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{o.customer}</span>
          <span className="block text-xs text-ink-soft" dir="ltr">
            {o.phone}
          </span>
        </span>
      ),
    },
    {
      key: "fulfillment",
      header: t("col_fulfillment"),
      rank: "secondary",
      cell: (o) => {
        const m = fulfillMeta(String(o.fulfillment));
        return (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => openPill(o, "fulfillment", e)}
            className="inline-flex cursor-pointer rounded-full outline-none ring-brand-500/40 focus-visible:ring-2"
            title={ar ? "عرض تفاصيل التنفيذ" : "Fulfillment details"}
          >
            <StatusPill label={ar ? m.ar : m.en} tone={m.tone} hollow={m.hollow} />
          </span>
        );
      },
    },
    {
      key: "items",
      header: ar ? "الأصناف" : "Items",
      rank: "secondary",
      align: "end",
      cell: (o) => (
        <span className="text-ink-muted">
          {num(o.itemsCount, lang)} <span className="text-ink-soft">{ar ? "صنف" : "items"}</span>
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "governorate",
      header: t("col_governorate"),
      rank: "secondary",
      cell: (o) => (
        <span className="flex items-center gap-2">
          <span className="text-ink-muted">{o.governorate}</span>
          {o.flag && <StatusPill label={flagLabel(o.flag)} tone={flagPill[o.flag]} />}
        </span>
      ),
      hideBelow: "lg",
    },
    ...(lockChannel
      ? []
      : [
          {
            key: "channel",
            header: t("col_channel"),
            rank: "secondary" as const,
            cell: (o: (typeof pg.items)[number]) => <ChannelBadge value={o.channel} />,
          },
        ]),
  ];

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
        actions={<button className="btn-outline h-10">{t("export")}</button>}
        primary={{ label: ar ? "إنشاء طلب" : "Create order" }}
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

        {/* Rows: a table on a desktop, cards a thumb can open on a phone */}
        <DataTable
          flush
          rows={pg.items}
          columns={columns}
          getKey={(o) => o.id}
          onRowClick={(o) => router.push(`${basePath}/${o.id}`)}
          selectable={(o) => <Checkbox checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} />}
          selectAll={<Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />}
          empty={
            <div className="py-10 text-center">
              <div className="font-semibold text-ink">{ar ? "لا توجد طلبات مطابقة" : "No matching orders"}</div>
              <p className="mt-1 text-sm text-ink-soft">
                {ar ? "جرّب تعديل الفلاتر." : "Try adjusting your filters."}
              </p>
            </div>
          }
        />

        <Pagination {...pg} />
      </Card>

      {pop && (
        <StatusPopover
          pop={pop}
          basePath={basePath}
          ar={ar}
          lang={lang}
          onClose={() => setPop(null)}
        />
      )}
    </>
  );
}

// ---- Status popover (list "peek", with a way through to the full page) -------
function StatusPopover({
  pop,
  basePath,
  ar,
  lang,
  onClose,
}: {
  pop: Pop;
  basePath: string;
  ar: boolean;
  lang: "ar" | "en";
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [d, setD] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const o = pop.order;

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getOrderDetail(o.id);
      if (!alive) return;
      if (res.ok) setD(res.data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [o.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmtTime = (s: string) =>
    new Date(s).toLocaleString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const pm = paymentMeta(d?.paymentStatus ?? String(o.payment));
  const fm = fulfillMeta(d?.fulfillmentStatus ?? String(o.fulfillment));

  return (
    <>
      {/* Outside-click catcher */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-[320px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        style={{ left: pop.x, top: Math.min(pop.y, window.innerHeight - 340) }}
        dir={ar ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            {pop.kind === "payment" ? <IcCash className="h-4 w-4 text-ink-soft" /> : <IcCourier className="h-4 w-4 text-ink-soft" />}
            #{o.id}
          </div>
          <StatusPill
            label={pop.kind === "payment" ? (ar ? pm.ar : pm.en) : ar ? fm.ar : fm.en}
            tone={pop.kind === "payment" ? pm.tone : fm.tone}
            hollow={pop.kind === "payment" ? pm.hollow : fm.hollow}
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto px-4 py-3 text-sm">
          {loading ? (
            <div className="py-4 text-center text-ink-soft">{t("loading")}</div>
          ) : !d ? (
            <div className="py-4 text-center text-ink-soft">{ar ? "تعذّر التحميل" : "Couldn't load"}</div>
          ) : pop.kind === "payment" ? (
            <>
              <div className="space-y-1.5">
                <PopRow label={ar ? "الإجمالي" : "Total"} value={egp(d.total, lang)} bold />
                <PopRow label={ar ? "المدفوع" : "Paid"} value={egp(d.amountPaid, lang)} />
                <PopRow label={ar ? "المتبقي" : "Balance"} value={egp(d.balance, lang)} bold />
              </div>
              {d.payments.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {ar ? "سجل المدفوعات" : "Payment history"}
                  </div>
                  <ul className="space-y-1">
                    {d.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">
                          {p.kind === "refund" ? (ar ? "استرجاع" : "Refund") : (ar ? "دفعة" : "Payment")} · {methodLabel(p.method, ar)} · {fmtTime(p.createdAt)}
                        </span>
                        <span className={p.kind === "refund" ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
                          {p.kind === "refund" ? "−" : "+"}{egp(p.amount, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                {d.items.map((li) => {
                  const remaining = li.quantity - li.fulfilledQuantity;
                  return (
                    <div key={li.id} className="flex items-center gap-2">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                        {li.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={li.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-xs font-medium text-ink">{li.productName}</div>
                        <div className="text-[11px]">
                          {remaining === 0 ? (
                            <span className="text-emerald-600">{ar ? "تم التنفيذ" : "Fulfilled"} ✓</span>
                          ) : (
                            <span className="text-amber-600">
                              {ar
                                ? `${num(li.fulfilledQuantity, lang)} من ${num(li.quantity, lang)}`
                                : `${li.fulfilledQuantity} of ${li.quantity}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-ink-muted">× {num(li.quantity, lang)}</span>
                    </div>
                  );
                })}
              </div>
              {d.fulfillments.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {ar ? "سجل التنفيذ" : "Fulfillment history"}
                  </div>
                  <ul className="space-y-1">
                    {d.fulfillments.map((f) => (
                      <li key={f.id} className="text-xs text-ink-muted">
                        {f.items.reduce((s, i) => s + i.quantity, 0)} {ar ? "قطعة" : "items"} · {fmtTime(f.createdAt)}
                        {f.tracking ? <span className="text-ink-soft" dir="ltr"> · {f.tracking}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-line p-2">
          <button
            onClick={() => router.push(`${basePath}/${o.id}`)}
            className="btn-primary h-9 w-full justify-center text-sm"
          >
            {ar ? "عرض تفاصيل الطلب" : "View order details"}
          </button>
        </div>
      </div>
    </>
  );
}

function PopRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={bold ? "font-semibold text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}
