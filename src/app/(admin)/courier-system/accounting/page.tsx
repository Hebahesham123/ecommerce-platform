"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { Modal } from "@/components/modal";
import { IcCash, IcCourier, IcChevron, IcRefresh, IcAlert, IcAccounting } from "@/components/icons";
import { collectionMethodLabel, SHIPMENT_STATUS, COD_METHODS, type ShipmentStatus } from "@/lib/courier";
import {
  courierAccounting,
  courierAccountingList,
  ordersByMethod,
  type AccountingBucket,
  type CourierAccounting,
  type CourierAccountingListItem,
  type OrderLine,
  type OrdersSummaryKey,
} from "../actions";

// ---- Date-range helpers -----------------------------------------------------
type Preset = "all" | "today" | "yesterday" | "last7" | "last30" | "custom";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = ymd(y);
    return { from: d, to: d };
  }
  if (p === "last7") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: ymd(d), to: today };
  }
  if (p === "last30") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { from: ymd(d), to: today };
  }
  return { from: "", to: "" };
}

// ---- Card tone palette (theme-aware tints) ----------------------------------
const TONE: Record<string, string> = {
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  brand: "bg-brand-100 text-brand-600",
};

const SUMMARY_CARDS: { key: OrdersSummaryKey; ar: string; en: string; tone: keyof typeof TONE }[] = [
  { key: "total", ar: "الإجمالي", en: "Total", tone: "brand" },
  { key: "assigned", ar: "تم التعيين", en: "Assigned", tone: "slate" },
  { key: "delivered", ar: "تم التسليم", en: "Delivered", tone: "emerald" },
  { key: "canceled", ar: "ملغي", en: "Canceled", tone: "rose" },
  { key: "partial", ar: "تسليم جزئي", en: "Partial", tone: "amber" },
  { key: "postponed", ar: "مؤجل", en: "Postponed", tone: "amber" },
  { key: "part_pickup", ar: "استلام جزئي", en: "Part Pickup", tone: "sky" },
  { key: "hand_to_hand", ar: "يد بيد", en: "Hand-to-Hand", tone: "violet" },
];

export default function CourierAccountingPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [list, setList] = useState<{ grand: CourierAccounting; couriers: CourierAccountingListItem[] } | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<CourierAccounting | null>(null);
  const [includeHoldFees, setIncludeHoldFees] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drill, setDrill] = useState<{ method: string; title: string } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await courierAccountingList({ from, to });
    setList(res.ok ? res.data : null);
    setLoading(false);
  }, [from, to]);
  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(async () => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    const res = await courierAccounting({ courierId: selected.id, from, to, includeHoldFees });
    if (res.ok) setDetail(res.data);
    setDetailLoading(false);
  }, [selected, from, to, includeHoldFees]);
  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  const presets: { key: Preset; ar: string; en: string }[] = [
    { key: "all", ar: "الكل", en: "All" },
    { key: "today", ar: "اليوم", en: "Today" },
    { key: "yesterday", ar: "أمس", en: "Yesterday" },
    { key: "last7", ar: "آخر 7 أيام", en: "Last 7 days" },
    { key: "last30", ar: "آخر 30 يوم", en: "Last 30 days" },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={ar ? "محاسبة المندوبين" : "Courier accounting"}
        subtitle={ar ? "لوحة محاسبة تفصيلية لكل مندوب — التحصيل، رسوم الحجز، والمُسلَّم للمحاسبة" : "Detailed per-courier accounting — collection, hold fees & what's handed to accounting"}
      />

      {/* Date-range control */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  preset === p.key ? "bg-brand text-white shadow-sm" : "bg-surface-page text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {ar ? p.ar : p.en}
              </button>
            ))}
          </div>
          <div className="mx-1 hidden h-8 w-px bg-line sm:block" />
          <label className="text-xs text-ink-soft">
            <span className="mb-1 block font-medium">{ar ? "من" : "From"}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("custom");
              }}
              dir="ltr"
              className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand-600"
            />
          </label>
          <label className="text-xs text-ink-soft">
            <span className="mb-1 block font-medium">{ar ? "إلى" : "To"}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("custom");
              }}
              dir="ltr"
              className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand-600"
            />
          </label>
          <button
            onClick={() => {
              loadList();
              loadDetail();
            }}
            className="btn-outline ms-auto h-10 gap-1.5"
          >
            <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
          </button>
        </div>
      </Card>

      {!selected ? (
        <CouriersList
          ar={ar}
          lang={lang}
          loading={loading}
          data={list}
          onPick={(id, name) => setSelected({ id, name })}
        />
      ) : (
        <>
          <button
            onClick={() => {
              setSelected(null);
              setDetail(null);
            }}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            <IcChevron className={`h-4 w-4 ${ar ? "rotate-0" : "rotate-180"}`} />
            {ar ? "العودة إلى المندوبين" : "Back to couriers"}
          </button>
          <DetailedDashboard
            ar={ar}
            lang={lang}
            loading={detailLoading}
            title={selected.name}
            data={detail}
            includeHoldFees={includeHoldFees}
            onToggleHoldFees={setIncludeHoldFees}
            onDrill={(method, title) => setDrill({ method, title })}
          />
        </>
      )}

      {drill && selected && (
        <DrillModal
          ar={ar}
          lang={lang}
          courierId={selected.id}
          method={drill.method}
          title={drill.title}
          from={from}
          to={to}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Couriers List (entry screen)
// =============================================================================
function CouriersList({
  ar,
  lang,
  loading,
  data,
  onPick,
}: {
  ar: boolean;
  lang: "ar" | "en";
  loading: boolean;
  data: { grand: CourierAccounting; couriers: CourierAccountingListItem[] } | null;
  onPick: (id: string, name: string) => void;
}) {
  if (loading) return <div className="py-16 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  if (!data) return <Card className="py-14 text-center text-sm text-ink-soft">{ar ? "تعذّر تحميل البيانات. تأكد من تطبيق ترحيل 0050." : "Couldn't load data. Make sure migration 0050 is applied."}</Card>;

  const grand = data.grand;
  return (
    <div className="space-y-4">
      {/* Grand total */}
      <button
        onClick={() => onPick("all", ar ? "الإجمالي الكلي — كل المندوبين" : "Grand total — all couriers")}
        className="card w-full overflow-hidden p-0 text-start transition-shadow hover:shadow-pop"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-br from-brand-500/10 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
              <IcAccounting className="h-6 w-6" />
            </span>
            <div>
              <div className="text-base font-bold text-ink">{ar ? "الإجمالي الكلي — كل المندوبين" : "Grand Total — all couriers combined"}</div>
              <div className="text-xs text-ink-soft">{ar ? "اضغط لعرض التفاصيل" : "Click to view details"}</div>
            </div>
          </div>
          <IcChevron className={`h-5 w-5 text-ink-soft ${ar ? "rotate-180" : ""}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <MiniStat label={ar ? "الطلبات" : "Orders"} value={num(grand.ordersSummary.total.count, lang)} tone="slate" />
          <MiniStat label={ar ? "تم التسليم" : "Delivered"} value={num(grand.ordersSummary.delivered.count, lang)} tone="emerald" />
          <MiniStat label={ar ? "المُحصّل فعليًا" : "Collected"} value={egp(grand.totalActuallyCollected.amount, lang)} tone="emerald" />
          <MiniStat label={ar ? "المُسلَّم للمحاسبة" : "To accounting"} value={egp(grand.totalHandedToAccounting, lang)} tone="brand" />
        </div>
      </button>

      {/* Per-courier cards */}
      <div>
        <div className="mb-2 px-1 text-sm font-semibold text-ink">{ar ? "المندوبون" : "Couriers"}</div>
        {data.couriers.length === 0 ? (
          <Card className="py-14 text-center text-sm text-ink-soft">{ar ? "لا يوجد مندوبون." : "No couriers."}</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.couriers.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick(c.id, c.name)}
                className="card p-4 text-start transition-shadow hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
                      {c.name.trim().charAt(0) || "?"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{c.name}</div>
                      <div className="text-xs text-ink-soft">{ar ? "اضغط لعرض التفاصيل" : "Click to view details"}</div>
                    </div>
                  </div>
                  <IcChevron className={`h-4 w-4 shrink-0 text-ink-soft ${ar ? "rotate-180" : ""}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div>
                    <div className="text-[11px] text-ink-soft">{ar ? "مُسلَّم" : "Delivered"}</div>
                    <div className="text-sm font-bold text-ink">{num(c.delivered, lang)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-soft">{ar ? "المُحصّل" : "Collected"}</div>
                    <div className="truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">{egp(c.collected, lang)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-soft">{ar ? "للمحاسبة" : "To acct."}</div>
                    <div className="truncate text-sm font-bold text-brand-600">{egp(c.handedToAccounting, lang)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
  return (
    <div className={`rounded-xl p-3 ${TONE[tone]}`}>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
      <div className="mt-0.5 truncate text-base font-bold">{value}</div>
    </div>
  );
}

// =============================================================================
// Detailed Accounting Dashboard
// =============================================================================
function DetailedDashboard({
  ar,
  lang,
  loading,
  title,
  data,
  includeHoldFees,
  onToggleHoldFees,
  onDrill,
}: {
  ar: boolean;
  lang: "ar" | "en";
  loading: boolean;
  title: string;
  data: CourierAccounting | null;
  includeHoldFees: boolean;
  onToggleHoldFees: (v: boolean) => void;
  onDrill: (method: string, title: string) => void;
}) {
  if (loading && !data) return <div className="py-16 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  if (!data) return null;

  const bd = new Map(data.paymentBreakdown.map((p) => [p.method, p] as const));
  const get = (m: string) => bd.get(m) ?? { method: m, amount: 0, count: 0 };
  const codCount = data.paymentBreakdown.filter((p) => COD_METHODS.includes(p.method)).reduce((s, p) => s + p.count, 0);
  const optional = (["wallet", "valu", "installments"] as const).filter((m) => {
    const p = get(m);
    return p.count > 0 || Math.abs(p.amount) > 0.001;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <IcCourier className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>

      {/* Orders Summary */}
      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-ink">{ar ? "ملخص الطلبات" : "Orders Summary"}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SUMMARY_CARDS.map((c) => (
            <SummaryCard key={c.key} label={ar ? c.ar : c.en} tone={c.tone} bucket={data.ordersSummary[c.key]} ar={ar} lang={lang} />
          ))}
        </div>
      </section>

      {/* Collected & Not Delivered */}
      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-ink">{ar ? "ملخص المُحصّل وغير المُسلَّم" : "Collected & Not Delivered"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{ar ? "إجمالي المُسلَّم فعليًا" : "Total actually delivered"}</span>
              <span className={`badge ${TONE.emerald}`}>{num(data.totalActuallyCollected.count, lang)} {ar ? "طلب" : "orders"}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{egp(data.totalActuallyCollected.amount, lang)}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{ar ? "إجمالي غير المُسلَّم" : "Total not delivered"}</span>
              <span className={`badge ${TONE.rose}`}>{num(data.totalNotDelivered.count, lang)} {ar ? "طلب" : "orders"}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{egp(data.totalNotDelivered.originalValue, lang)}</div>
          </div>
        </div>
      </section>

      {/* Courier Fee */}
      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-ink">{ar ? "أجر المندوب" : "Courier Fee"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE.amber}`}>
              <IcCash className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs text-ink-soft">{ar ? "إجمالي الأجور في الفترة" : "Total fees for the range"}</div>
              <div className="text-xl font-bold text-ink">{egp(data.courierFee, lang)}</div>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE.sky}`}>
              <IcCash className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs text-ink-soft">{ar ? "الودائع" : "Deposits"}</div>
              <div className="text-xl font-bold text-ink">{egp(data.deposits, lang)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Breakdown */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-semibold text-ink">{ar ? "تفصيل طرق الدفع" : "Payment Breakdown"}</h3>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface-page px-2.5 py-1.5 text-xs font-medium text-ink-muted">
            <input type="checkbox" checked={includeHoldFees} onChange={(e) => onToggleHoldFees(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand-600" />
            {ar ? "تضمين رسوم الحجز" : "Include hold fees"}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <PaymentCard title={ar ? "ماكينة فيزا" : "Visa Machine"} p={get("visa_machine")} tone="slate" lang={lang} ar={ar} onClick={() => onDrill("visa_machine", ar ? "طلبات ماكينة فيزا" : "Visa Machine orders")} />
          <PaymentCard title={ar ? "إنستاباي" : "Instapay"} p={get("instapay")} tone="sky" lang={lang} ar={ar} onClick={() => onDrill("instapay", ar ? "طلبات إنستاباي" : "Instapay orders")} />
          <PaymentCard title={ar ? "كاش" : "Cash"} p={get("cash")} tone="emerald" lang={lang} ar={ar} onClick={() => onDrill("cash", ar ? "طلبات كاش" : "Cash orders")} />
          <PaymentCard title={ar ? "إجمالي COD" : "Total COD"} p={{ method: "cod", amount: data.totalCod, count: codCount }} tone="amber" lang={lang} ar={ar} onClick={() => onDrill("cod", ar ? "إجمالي الدفع عند الاستلام" : "Total cash on delivery")} />
          <PaymentCard title="Paymob" p={get("paymob")} tone="brand" lang={lang} ar={ar} onClick={() => onDrill("paymob", ar ? "طلبات Paymob" : "Paymob orders")} />
          {optional.map((m) => (
            <PaymentCard
              key={m}
              title={collectionMethodLabel(m, ar)}
              p={get(m)}
              tone="violet"
              lang={lang}
              ar={ar}
              onClick={() => onDrill(m, `${collectionMethodLabel(m, ar)}`)}
            />
          ))}
        </div>
      </section>

      {/* Hold Fees */}
      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-ink">{ar ? "رسوم الحجز" : "Hold Fees"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE.rose}`}>
                <IcAlert className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink">{ar ? "نشطة" : "Active"}</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-soft">{ar ? "العدد" : "Count"}</div>
                <div className="text-xl font-bold text-ink">{num(data.holdFees.activeCount, lang)}</div>
              </div>
              <div className="text-end">
                <div className="text-xs text-ink-soft">{ar ? "المبلغ" : "Amount"}</div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{egp(data.holdFees.activeAmount, lang)}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-ink-soft">
              {ar ? "آخر إضافة" : "Last added"}: {fmtDate(data.holdFees.lastAddedAt, ar)}
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE.slate}`}>
                <IcRefresh className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink">{ar ? "مُزالة" : "Removed"}</span>
            </div>
            <div className="mt-3">
              <div className="text-xs text-ink-soft">{ar ? "العدد" : "Count"}</div>
              <div className="text-xl font-bold text-ink">{num(data.holdFees.removedCount, lang)}</div>
            </div>
            <div className="mt-2 text-[11px] text-ink-soft">
              {ar ? "آخر إزالة" : "Last removed"}: {fmtDate(data.holdFees.lastRemovedAt, ar)}
            </div>
          </div>
        </div>
      </section>

      {/* Total Handed to Accounting */}
      <section>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-brand-500/10 to-transparent px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <IcAccounting className="h-6 w-6" />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">{ar ? "الإجمالي المُسلَّم للمحاسبة" : "Total Handed to Accounting"}</div>
                <div className="text-xs text-ink-soft">{ar ? "المُحصّل فعليًا − رسوم الحجز النشطة" : "Actually collected − active hold fees"}</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-brand-600">{egp(data.totalHandedToAccounting, lang)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, tone, bucket, ar, lang }: { label: string; tone: keyof typeof TONE; bucket: AccountingBucket; ar: boolean; lang: "ar" | "en" }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink-soft">{label}</span>
        <span className={`badge ${TONE[tone]}`}>{num(bucket.count, lang)}</span>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-soft">{ar ? "القيمة الأصلية" : "Original value"}</span>
          <span className="font-semibold text-ink">{egp(bucket.originalValue, lang)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-soft">{ar ? "المُحصّل" : "Collected"}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{egp(bucket.collected, lang)}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentCard({
  title,
  p,
  tone,
  lang,
  ar,
  onClick,
}: {
  title: string;
  p: { method: string; amount: number; count: number };
  tone: keyof typeof TONE;
  lang: "ar" | "en";
  ar: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card p-4 text-start transition-shadow hover:shadow-pop">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink">{title}</span>
        <span className={`badge ${TONE[tone]}`}>{num(p.count, lang)}</span>
      </div>
      <div className="mt-2 text-lg font-bold text-ink">{egp(p.amount, lang)}</div>
      <div className="mt-0.5 text-[11px] text-brand-600">{ar ? "عرض الطلبات" : "View orders"}</div>
    </button>
  );
}

function fmtDate(iso: string | null, ar: boolean): string {
  if (!iso) return ar ? "—" : "—";
  return new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

// =============================================================================
// Drill-in modal: the orders behind a payment card
// =============================================================================
function DrillModal({
  ar,
  lang,
  courierId,
  method,
  title,
  from,
  to,
  onClose,
}: {
  ar: boolean;
  lang: "ar" | "en";
  courierId: string;
  method: string;
  title: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<OrderLine[] | null>(null);

  useEffect(() => {
    let alive = true;
    ordersByMethod({ courierId, method, from, to }).then((res) => {
      if (alive) setRows(res.ok ? res.data : []);
    });
    return () => {
      alive = false;
    };
  }, [courierId, method, from, to]);

  const total = useMemo(() => (rows ?? []).reduce((s, r) => s + r.collected, 0), [rows]);

  return (
    <Modal
      title={title}
      subtitle={rows ? `${num(rows.length, lang)} ${ar ? "طلب" : "orders"} · ${egp(total, lang)}` : undefined}
      icon={IcCash}
      size="xl"
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={<button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إغلاق" : "Close"}</button>}
    >
      {rows === null ? (
        <div className="py-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-soft">{ar ? "لا توجد طلبات." : "No orders."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-2 py-2 text-start font-medium">{ar ? "الطلب" : "Order"}</th>
                <th className="px-2 py-2 text-start font-medium">{ar ? "العميل" : "Customer"}</th>
                <th className="px-2 py-2 text-start font-medium">{ar ? "الحالة" : "Status"}</th>
                <th className="px-2 py-2 text-end font-medium">{ar ? "الإجمالي" : "Total"}</th>
                <th className="px-2 py-2 text-end font-medium">{ar ? "المُحصّل" : "Collected"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = SHIPMENT_STATUS[r.status as ShipmentStatus] ?? SHIPMENT_STATUS.assigned;
                return (
                  <tr key={`${r.orderNumber}-${i}`} className="border-b border-line/60 last:border-0">
                    <td className="px-2 py-2.5 font-semibold text-ink" dir="ltr">#{r.orderNumber}</td>
                    <td className="px-2 py-2.5">
                      <div className="text-ink">{r.customer || "—"}</div>
                      {r.phone && <div className="text-[11px] text-ink-soft" dir="ltr">{r.phone}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-ink-muted">{ar ? st.ar : st.en}</td>
                    <td className="px-2 py-2.5 text-end text-ink">{egp(r.orderTotal, lang)}</td>
                    <td className="px-2 py-2.5 text-end font-semibold text-emerald-600 dark:text-emerald-400">{egp(r.collected, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
