"use client";

import { useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { couriers, type Courier } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import {
  KpiRow,
  StatTile,
  Toolbar,
  SearchInput,
  Select,
} from "@/components/dashboard-ui";
import { IcCourier, IcCash, IcAlert, IcOrders, IcLocation, IcX } from "@/components/icons";

type SortKey = "delivered" | "pending" | "active";

export default function CouriersPage() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");
  const [sort, setSort] = useState<SortKey>("delivered");

  const zones = useMemo(() => {
    const s = new Set<string>();
    for (const c of couriers) s.add(c.zone);
    return [...s].sort();
  }, []);

  const totalPending = couriers.reduce((s, c) => s + c.cashPending, 0);
  const totalCollected = couriers.reduce((s, c) => s + c.cashCollected, 0);
  const totalActive = couriers.reduce((s, c) => s + c.active, 0);
  const collectionRate =
    totalCollected + totalPending > 0
      ? Math.round((totalCollected / (totalCollected + totalPending)) * 100)
      : 100;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = couriers.filter((c) => {
      if (zone !== "all" && c.zone !== zone) return false;
      if (needle && !`${c.name} ${c.zone}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "pending":
          return b.cashPending - a.cashPending;
        case "active":
          return b.active - a.active;
        default:
          return b.delivered - a.delivered;
      }
    });
    return sorted;
  }, [q, zone, sort]);

  const filtersActive = q !== "" || zone !== "all";
  function clearFilters() {
    setQ("");
    setZone("all");
  }

  const sortLabels: Record<SortKey, string> = {
    delivered: lang === "ar" ? "الأكثر توصيلاً" : "Most delivered",
    pending: lang === "ar" ? "الأكثر نقدية معلّقة" : "Most pending cash",
    active: lang === "ar" ? "الأكثر نشاطاً" : "Most active",
  };

  const courierRate = (c: Courier) =>
    c.cashCollected + c.cashPending > 0
      ? Math.round((c.cashCollected / (c.cashCollected + c.cashPending)) * 100)
      : 100;

  return (
    <>
      <PageHeader
        title={t("nav_couriers")}
        subtitle={
          lang === "ar"
            ? "إدارة المندوبين وتسوية النقدية (الدفع عند الاستلام)"
            : "Courier management & COD reconciliation"
        }
      />

      {/* ---- KPI row ---- */}
      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile
            icon={IcCourier}
            label={lang === "ar" ? "إجمالي المندوبين" : "Total couriers"}
            value={num(couriers.length, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcOrders}
            label={t("active_deliveries")}
            value={num(totalActive, lang)}
            accent="sky"
          />
          <StatTile
            icon={IcCash}
            label={t("courier_cash")}
            value={egp(totalCollected, lang)}
            accent="emerald"
            sub={
              lang === "ar"
                ? `معدل التحصيل ${num(collectionRate, lang)}٪`
                : `${num(collectionRate, lang)}% collection rate`
            }
          />

          {/* Prominent pending-cash tile */}
          <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
            <span className="pointer-events-none absolute -end-5 -top-5 h-20 w-20 rounded-full bg-amber-200/40" />
            <div className="relative flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <IcAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-amber-700">
                  {t("courier_pending")}
                </div>
                <div className="mt-0.5 truncate text-xl font-bold tracking-tight text-amber-800">
                  {egp(totalPending, lang)}
                </div>
                <div className="mt-0.5 text-xs text-amber-700/80">
                  {lang === "ar" ? "يحتاج تسوية الآن" : "Needs reconciling now"}
                </div>
              </div>
            </div>
          </Card>
        </KpiRow>
      </div>

      {/* ---- Filters + grid ---- */}
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={
              lang === "ar" ? "ابحث بالاسم أو المنطقة…" : "Search by name or zone…"
            }
          />
          <Select value={zone} onChange={setZone}>
            <option value="all">{t("filter_all")}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {sortLabels[k]}
              </option>
            ))}
          </Select>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="btn-ghost h-9 gap-1 px-2.5 text-xs text-ink-muted"
            >
              <IcX className="h-3.5 w-3.5" />
              {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
            </button>
          )}

          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {lang === "ar" ? "مندوب" : "couriers"}
          </span>
        </Toolbar>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const rate = courierRate(c);
              const barColor =
                rate >= 90 ? "bg-emerald-400" : rate >= 70 ? "bg-amber-400" : "bg-rose-400";
              return (
                <div
                  key={c.id}
                  className="group rounded-2xl border border-line p-4 transition-shadow hover:shadow-pop"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">{c.name}</div>
                        <div className="flex items-center gap-1 text-xs text-ink-soft">
                          <IcLocation className="h-3.5 w-3.5" />
                          <span className="truncate">{c.zone}</span>
                        </div>
                      </div>
                    </div>
                    <span className="badge shrink-0 bg-sky-50 text-sky-700">
                      {num(c.active, lang)} {t("active_deliveries")}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-ink-soft">
                    {num(c.delivered, lang)} {lang === "ar" ? "طلب مُسلَّم" : "delivered"}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-emerald-50 p-2.5">
                      <div className="text-[11px] font-medium text-emerald-700">
                        {t("courier_cash")}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-emerald-800">
                        {egp(c.cashCollected, lang)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5">
                      <div className="text-[11px] font-medium text-amber-700">
                        {t("courier_pending")}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-amber-800">
                        {egp(c.cashPending, lang)}
                      </div>
                    </div>
                  </div>

                  {/* Collection rate meter */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-ink-soft">
                      <span>{lang === "ar" ? "معدل التحصيل" : "Collection rate"}</span>
                      <span className="font-medium text-ink-muted">
                        {num(rate, lang)}٪
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>

                  <button className="btn-outline mt-4 h-9 w-full gap-1.5 text-xs">
                    <IcCash className="h-3.5 w-3.5" /> {t("reconcile")}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <IcCourier className="h-6 w-6" />
            </span>
            <div>
              <div className="font-semibold text-ink">
                {lang === "ar" ? "لا يوجد مندوبون مطابقون" : "No matching couriers"}
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {lang === "ar"
                  ? "جرّب تعديل البحث أو المنطقة المختارة."
                  : "Try adjusting your search or selected zone."}
              </p>
            </div>
            {filtersActive && (
              <button className="btn-outline mt-1" onClick={clearFilters}>
                <IcX className="h-4 w-4" />
                {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
              </button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
