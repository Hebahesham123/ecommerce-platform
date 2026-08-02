"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  type InventoryItem,
  type Location,
  type ProductStatus,
  stockStatus,
  stockStatusKey,
  stockStatusTone,
  statusKey,
  statusTone,
  totalAvailable,
  totalOnHand,
  levelAt,
  emptyItem,
} from "@/lib/inventory";
import { listInventory, listLocations, setLevel, deleteItem } from "./actions";
import { ProductEditor } from "./product-editor";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { StatTile, SegBtn, Select, SearchInput } from "@/components/dashboard-ui";
import {
  IcPlus,
  IcInventory,
  IcAlert,
  IcLocation,
  IcTrash,
  IcImage,
  IcCash,
  IcX,
} from "@/components/icons";

type StockFilter = "all" | "in_stock" | "low_stock" | "out_stock";
type StatusFilter = "all" | ProductStatus;
type SortKey =
  | "name_az"
  | "avail_high"
  | "avail_low"
  | "price_high"
  | "price_low"
  | "updated";

export default function InventoryPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<InventoryItem | null>(null);

  // Filters
  const [loc, setLoc] = useState<string>("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name_az");

  async function load() {
    setLoading(true);
    const [inv, locs] = await Promise.all([listInventory(), listLocations()]);
    if (inv.ok) {
      setItems(inv.data);
      setError(null);
    } else {
      setError(inv.error);
    }
    if (locs.ok) setLocations(locs.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "1") {
        setDrawer(emptyItem());
        window.history.replaceState(null, "", "/inventory");
      }
    }
  }, []);

  const singleLoc = loc !== "all";

  // Stock respecting the selected location.
  const availOf = (it: InventoryItem) =>
    singleLoc ? levelAt(it, loc).available : totalAvailable(it);
  const onHandOf = (it: InventoryItem) =>
    singleLoc ? levelAt(it, loc).onHand : totalOnHand(it);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.category?.trim()) s.add(i.category.trim());
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (category !== "all" && (i.category ?? "") !== category) return false;
      if (stock !== "all" && stockStatus(availOf(i)) !== stock) return false;
      if (needle) {
        const hay =
          `${i.productName} ${i.variantTitle ?? ""} ${i.sku ?? ""} ${i.barcode ?? ""} ${i.category ?? ""} ${i.vendor ?? ""} ${i.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "avail_high":
          return availOf(b) - availOf(a);
        case "avail_low":
          return availOf(a) - availOf(b);
        case "price_high":
          return (b.price ?? 0) - (a.price ?? 0);
        case "price_low":
          return (a.price ?? 0) - (b.price ?? 0);
        case "updated":
          return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        default:
          return a.productName.localeCompare(b.productName, lang === "ar" ? "ar" : "en");
      }
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, status, stock, category, sort, loc, lang]);

  // KPIs over the current filtered view (respecting the location).
  const kpi = useMemo(() => {
    let units = 0,
      value = 0,
      low = 0,
      out = 0;
    for (const i of filtered) {
      const oh = onHandOf(i);
      const av = availOf(i);
      units += oh;
      value += oh * (i.price ?? 0);
      if (av <= 0) out += 1;
      else if (stockStatus(av) === "low_stock") low += 1;
    }
    return { products: filtered.length, units, value, low, out };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, loc]);

  const maxAvail = useMemo(
    () => Math.max(1, ...filtered.map((i) => availOf(i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, loc],
  );

  const filtersActive =
    q !== "" || status !== "all" || stock !== "all" || category !== "all";

  function clearFilters() {
    setQ("");
    setStatus("all");
    setStock("all");
    setCategory("all");
  }

  function patchLevel(itemId: string, locationId: string, onHand: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const ex = it.levels.find((l) => l.locationId === locationId);
        const base = ex ?? { locationId, onHand: 0, committed: 0, incoming: 0, available: 0 };
        const merged = { ...base, onHand, available: onHand - base.committed };
        const levels = ex
          ? it.levels.map((l) => (l.locationId === locationId ? merged : l))
          : [...it.levels, merged];
        return { ...it, levels };
      }),
    );
  }

  async function onDelete(item: InventoryItem) {
    if (!window.confirm(t("delete_item_confirm"))) return;
    const res = await deleteItem(item.id);
    if (res.ok) setItems((r) => r.filter((i) => i.id !== item.id));
  }

  const sortLabels: Record<SortKey, string> = {
    name_az: t("sort_name_az"),
    avail_high: t("sort_avail_high"),
    avail_low: t("sort_avail_low"),
    price_high: t("sort_price_high"),
    price_low: t("sort_price_low"),
    updated: t("sort_updated"),
  };

  return (
    <>
      <PageHeader
        title={t("nav_inventory")}
        subtitle={t("inventory_subtitle")}
        actions={
          <>
            <Link href="/inventory/locations" className="btn-outline">
              <IcLocation className="h-4 w-4" /> {t("nav_locations")}
            </Link>
            <button className="btn-primary" onClick={() => setDrawer(emptyItem())}>
              <IcPlus className="h-4 w-4" /> {t("add_item")}
            </button>
          </>
        }
      />

      {error === "not_configured" && (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">
            {t("supabase_missing")}
          </span>
        </Card>
      )}

      {/* ---- KPI tiles ---- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          icon={IcInventory}
          label={t("kpi_products")}
          value={num(kpi.products, lang)}
          accent="brand"
        />
        <StatTile
          icon={IcInventory}
          label={t("kpi_units")}
          value={num(kpi.units, lang)}
          accent="sky"
        />
        <StatTile
          icon={IcCash}
          label={t("kpi_value")}
          value={egp(kpi.value, lang)}
          accent="emerald"
        />
        <StatTile
          icon={IcAlert}
          label={t("kpi_low_stock")}
          value={num(kpi.low, lang)}
          accent="amber"
          active={stock === "low_stock"}
          onClick={() => setStock(stock === "low_stock" ? "all" : "low_stock")}
        />
        <StatTile
          icon={IcAlert}
          label={t("kpi_out_stock")}
          value={num(kpi.out, lang)}
          accent="rose"
          active={stock === "out_stock"}
          onClick={() => setStock(stock === "out_stock" ? "all" : "out_stock")}
        />
      </div>

      <Card className="overflow-hidden">
        {/* ---- Filter toolbar ---- */}
        <div className="space-y-3 border-b border-line p-3">
          {/* Location segmented control */}
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <SegBtn active={loc === "all"} onClick={() => setLoc("all")}>
                {t("all_locations")}
              </SegBtn>
              {locations.map((l) => (
                <SegBtn key={l.id} active={loc === l.id} onClick={() => setLoc(l.id)}>
                  <IcLocation className="h-3.5 w-3.5" />
                  {l.name}
                </SegBtn>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder={t("search")} />

            {/* Status */}
            <Select value={status} onChange={(v) => setStatus(v as StatusFilter)}>
              <option value="all">{t("all_statuses")}</option>
              <option value="active">{t("st_active")}</option>
              <option value="draft">{t("st_draft")}</option>
              <option value="archived">{t("st_archived")}</option>
            </Select>

            {/* Stock */}
            <Select value={stock} onChange={(v) => setStock(v as StockFilter)}>
              <option value="all">{t("filter_stock")}: {t("filter_all")}</option>
              <option value="in_stock">{t("in_stock")}</option>
              <option value="low_stock">{t("low_stock")}</option>
              <option value="out_stock">{t("out_stock")}</option>
            </Select>

            {/* Category */}
            {categories.length > 0 && (
              <Select value={category} onChange={(v) => setCategory(v)}>
                <option value="all">{t("all_categories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}

            {/* Sort */}
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
          </div>
        </div>

        {/* ---- Table ---- */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_product")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_sku")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_price")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_available")}</th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const available = availOf(item);
                const st = stockStatus(available);
                const barPct = Math.min(100, Math.round((Math.max(0, available) / maxAvail) * 100));
                const barColor =
                  st === "out_stock"
                    ? "bg-rose-400"
                    : st === "low_stock"
                      ? "bg-amber-400"
                      : "bg-emerald-400";
                return (
                  <tr
                    key={item.id}
                    className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-page"
                    onClick={() => setDrawer(item)}
                  >
                    {/* Product */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <IcImage className="h-4 w-4 text-ink-soft" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">
                            {item.productName}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                            {item.variantTitle && <span>{item.variantTitle}</span>}
                            {item.vendor && <span>· {item.vendor}</span>}
                            {item.tags.slice(0, 2).map((tg) => (
                              <span
                                key={tg}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-muted"
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-3 py-3 text-ink-muted" dir="ltr">
                      {item.sku || "—"}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <Badge className={statusTone[item.status]}>
                        {t(statusKey[item.status])}
                      </Badge>
                    </td>

                    {/* Price */}
                    <td className="px-3 py-3 text-end">
                      {item.price != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          {item.compareAtPrice != null &&
                            item.compareAtPrice > item.price && (
                              <span className="text-xs text-ink-soft line-through">
                                {egp(item.compareAtPrice, lang)}
                              </span>
                            )}
                          <span className="font-semibold text-ink">
                            {egp(item.price, lang)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>

                    {/* Available: number + status + meter, editable in a single location */}
                    <td className="px-3 py-3" onClick={(e) => singleLoc && e.stopPropagation()}>
                      <div className="flex items-center gap-2.5">
                        {singleLoc ? (
                          <EditableQty
                            value={levelAt(item, loc).onHand}
                            onSave={async (v) => {
                              patchLevel(item.id, loc, v);
                              await setLevel(item.id, loc, { onHand: v });
                            }}
                          />
                        ) : (
                          <span className="w-9 text-end font-semibold text-ink">
                            {num(available, lang)}
                          </span>
                        )}
                        <div className="hidden flex-1 sm:block">
                          <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                        <Badge className={stockStatusTone[st]}>
                          {t(stockStatusKey[st])}
                        </Badge>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDelete(item)}
                        className="btn-ghost h-8 w-8 p-0 text-rose-600 opacity-0 hover:bg-rose-50 group-hover:opacity-100"
                        aria-label="delete"
                      >
                        <IcTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="py-12 text-center text-sm text-ink-soft">{t("loading")}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcInventory className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {filtersActive ? t("no_inventory") : t("no_inventory")}
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {filtersActive ? t("clear_filters") : t("no_inventory_hint")}
                </p>
              </div>
              {filtersActive ? (
                <button className="btn-outline mt-1" onClick={clearFilters}>
                  <IcX className="h-4 w-4" /> {t("clear_filters")}
                </button>
              ) : (
                <button className="btn-primary mt-1" onClick={() => setDrawer(emptyItem())}>
                  <IcPlus className="h-4 w-4" /> {t("add_item")}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {drawer && (
        <ProductEditor
          item={drawer}
          locations={locations}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
    </>
  );
}

// ---- Inline editable quantity ----------------------------------------------
function EditableQty({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setV(String(value));
  }, [value]);

  async function commit() {
    const n = Math.max(0, Math.round(Number(v) || 0));
    if (n === value) {
      setV(String(value));
      return;
    }
    setSaving(true);
    await onSave(n);
    setSaving(false);
  }

  return (
    <input
      type="number"
      min={0}
      value={v}
      disabled={saving}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-9 w-16 rounded-lg border border-line bg-white px-2 text-end text-sm font-semibold text-ink outline-none focus:border-brand-600 disabled:opacity-50"
    />
  );
}
