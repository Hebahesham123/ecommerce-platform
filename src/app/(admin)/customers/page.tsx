"use client";

import { useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { orders, labels, type PayMethod } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar, Badge } from "@/components/ui";
import { KpiRow, StatTile, Toolbar, SearchInput, Select, SegBtn } from "@/components/dashboard-ui";
import { IcCustomers, IcCash, IcUp, IcLocation, IcWhatsApp, IcX } from "@/components/icons";

// ---- Derived customer model --------------------------------------------
type Customer = {
  key: string;
  name: string;
  phone: string;
  governorate: string;
  ordersCount: number;
  totalSpent: number;
  lastDate: string;
  method: PayMethod;
  isRepeat: boolean;
};

type Segment = "all" | "repeat" | "new" | "vip";
type SortKey = "top_spenders" | "most_orders" | "recent";

/** Group orders into unique customers (by name + phone + governorate) and
 *  roll up their order count, total spend, most recent order date and the
 *  payment method they use most often. */
function buildCustomers(): Customer[] {
  const map = new Map<
    string,
    { name: string; phone: string; governorate: string; orders: number; spent: number; lastDate: string; methods: Record<PayMethod, number> }
  >();
  for (const o of orders) {
    const key = `${o.customer}|${o.phone}|${o.governorate}`;
    const c = map.get(key) ?? {
      name: o.customer,
      phone: o.phone,
      governorate: o.governorate,
      orders: 0,
      spent: 0,
      lastDate: o.date,
      methods: { cod: 0, card: 0, wallet: 0 },
    };
    c.orders += 1;
    c.spent += o.total;
    if (o.date > c.lastDate) c.lastDate = o.date;
    c.methods[o.method] += 1;
    map.set(key, c);
  }
  return [...map.values()].map((c) => {
    const method = (Object.keys(c.methods) as PayMethod[]).sort(
      (a, b) => c.methods[b] - c.methods[a],
    )[0];
    return {
      key: `${c.name}|${c.phone}|${c.governorate}`,
      name: c.name,
      phone: c.phone,
      governorate: c.governorate,
      ordersCount: c.orders,
      totalSpent: c.spent,
      lastDate: c.lastDate,
      method,
      isRepeat: c.orders > 1,
    };
  });
}

const segmentTone: Record<"vip" | "repeat" | "new", string> = {
  vip: "bg-violet-50 text-violet-700",
  repeat: "bg-sky-50 text-sky-700",
  new: "bg-emerald-50 text-emerald-700",
};

export default function CustomersPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const customers = useMemo(buildCustomers, []);

  // VIP = customers spending well above the average — a moving, data-driven bar
  // rather than a hardcoded number, so it stays meaningful as data changes.
  const vipThreshold = useMemo(() => {
    if (customers.length === 0) return Infinity;
    const avg = customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length;
    return avg * 1.5;
  }, [customers]);

  const isVip = (c: Customer) => c.totalSpent >= vipThreshold;

  const governorates = useMemo(
    () => [...new Set(customers.map((c) => c.governorate))].sort((a, b) => a.localeCompare(b, ar ? "ar" : "en")),
    [customers, ar],
  );

  const topGovernorate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of customers) counts.set(c.governorate, (counts.get(c.governorate) ?? 0) + 1);
    let best = "";
    let bestCount = 0;
    for (const [g, n] of counts) {
      if (n > bestCount) {
        best = g;
        bestCount = n;
      }
    }
    return { name: best, count: bestCount };
  }, [customers]);

  const [q, setQ] = useState("");
  const [gov, setGov] = useState("all");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortKey>("top_spenders");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = customers.filter((c) => {
      if (gov !== "all" && c.governorate !== gov) return false;
      if (segment === "repeat" && !c.isRepeat) return false;
      if (segment === "new" && c.isRepeat) return false;
      if (segment === "vip" && !isVip(c)) return false;
      if (needle) {
        const hay = `${c.name} ${c.phone}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "most_orders":
          return b.ordersCount - a.ordersCount || b.totalSpent - a.totalSpent;
        case "recent":
          return b.lastDate.localeCompare(a.lastDate) || b.totalSpent - a.totalSpent;
        default:
          return b.totalSpent - a.totalSpent;
      }
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, q, gov, segment, sort, vipThreshold]);

  const repeatCount = customers.filter((c) => c.isRepeat).length;
  const repeatShare = customers.length ? Math.round((repeatCount / customers.length) * 100) : 0;
  const avgSpend = customers.length
    ? Math.round(customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length)
    : 0;

  const filtersActive = q !== "" || gov !== "all" || segment !== "all";
  function clearFilters() {
    setQ("");
    setGov("all");
    setSegment("all");
  }

  const sortLabels: Record<SortKey, string> = {
    top_spenders: ar ? "الأعلى إنفاقاً" : "Top spenders",
    most_orders: ar ? "الأكثر طلبات" : "Most orders",
    recent: ar ? "الأحدث نشاطاً" : "Most recent",
  };

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US", {
      day: "numeric",
      month: "short",
    });
  }

  function whatsappHref(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return `https://wa.me/2${digits.replace(/^0/, "")}`;
  }

  return (
    <>
      <PageHeader
        title={t("nav_customers")}
        subtitle={ar ? "ملفات العملاء وسجل الشراء" : "Customer profiles & purchase history"}
      />

      {/* ---- KPI tiles ---- */}
      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile
            icon={IcCustomers}
            label={ar ? "إجمالي العملاء" : "Total customers"}
            value={num(customers.length, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcUp}
            label={ar ? "عملاء متكررون" : "Repeat customers"}
            value={`${num(repeatShare, lang)}%`}
            sub={`${num(repeatCount, lang)} ${ar ? "عميل" : "customers"}`}
            accent="sky"
            active={segment === "repeat"}
            onClick={() => setSegment(segment === "repeat" ? "all" : "repeat")}
          />
          <StatTile
            icon={IcCash}
            label={ar ? "متوسط إنفاق العميل" : "Avg. spend per customer"}
            value={egp(avgSpend, lang)}
            accent="emerald"
          />
          <StatTile
            icon={IcLocation}
            label={ar ? "أكثر محافظة" : "Top governorate"}
            value={topGovernorate.name || t("no_value")}
            sub={
              topGovernorate.count
                ? `${num(topGovernorate.count, lang)} ${ar ? "عميل" : "customers"}`
                : undefined
            }
            accent="amber"
          />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        {/* ---- Filter toolbar ---- */}
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={ar ? "ابحث بالاسم أو رقم الهاتف…" : "Search by name or phone…"}
          />

          <Select value={gov} onChange={setGov}>
            <option value="all">{t("col_governorate")}: {t("filter_all")}</option>
            {governorates.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>

          <div className="flex flex-wrap gap-1.5">
            <SegBtn active={segment === "all"} onClick={() => setSegment("all")}>
              {t("filter_all")}
            </SegBtn>
            <SegBtn active={segment === "repeat"} onClick={() => setSegment("repeat")}>
              {ar ? "متكرر" : "Repeat"}
            </SegBtn>
            <SegBtn active={segment === "new"} onClick={() => setSegment("new")}>
              {ar ? "جديد" : "New"}
            </SegBtn>
            <SegBtn active={segment === "vip"} onClick={() => setSegment("vip")}>
              VIP
            </SegBtn>
          </div>

          <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {t("sort_label")}: {sortLabels[k]}
              </option>
            ))}
          </Select>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
            >
              <IcX className="h-3.5 w-3.5" /> {t("clear_filters")}
            </button>
          )}

          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        {/* ---- Table ---- */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_customer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_governorate")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("nav_orders")}</th>
                <th className="px-3 py-3 text-start font-medium">
                  {ar ? "إجمالي الإنفاق" : "Total spent"}
                </th>
                <th className="px-3 py-3 text-start font-medium">
                  {ar ? "آخر طلب" : "Last order"}
                </th>
                <th className="px-3 py-3 text-start font-medium">
                  {ar ? "الشريحة" : "Segment"}
                </th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const vip = isVip(c);
                return (
                  <tr
                    key={c.key}
                    className="group border-b border-line transition-colors last:border-0 hover:bg-surface-page"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{c.name}</div>
                          <div className="text-xs text-ink-soft" dir="ltr">
                            {c.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{c.governorate}</td>
                    <td className="px-3 py-3.5 text-ink">{num(c.ordersCount, lang)}</td>
                    <td className="px-3 py-3.5 font-medium text-ink">{egp(c.totalSpent, lang)}</td>
                    <td className="px-3 py-3.5 text-ink-muted" dir="ltr">
                      {formatDate(c.lastDate)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {vip && <Badge className={segmentTone.vip}>VIP</Badge>}
                        {c.isRepeat ? (
                          <Badge className={segmentTone.repeat}>
                            {ar ? "متكرر" : "Repeat"}
                          </Badge>
                        ) : (
                          <Badge className={segmentTone.new}>{ar ? "جديد" : "New"}</Badge>
                        )}
                        <span className="text-xs text-ink-soft">
                          {t(labels.methodKey[c.method])}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <a
                        href={whatsappHref(c.phone)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn-ghost inline-flex h-8 w-8 items-center justify-center p-0 text-emerald-600 opacity-0 hover:bg-emerald-50 group-hover:opacity-100"
                        aria-label="WhatsApp"
                      >
                        <IcWhatsApp className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcCustomers className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {ar ? "لا يوجد عملاء مطابقون" : "No matching customers"}
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {ar
                    ? "جرّب تعديل البحث أو الفلاتر."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
              {filtersActive && (
                <button className="btn-outline mt-1" onClick={clearFilters}>
                  <IcX className="h-4 w-4" /> {t("clear_filters")}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
