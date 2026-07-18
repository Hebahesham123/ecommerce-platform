"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp, num, type DictKey, type Lang } from "@/lib/i18n";
import { products, type Product } from "@/lib/data";
import {
  type InventoryItem,
  type Location,
  type Level,
  stockStatus,
  stockStatusKey,
  stockStatusTone,
  totalAvailable,
  levelAt,
  type StockStatus,
} from "@/lib/inventory";
import { listInventory, listLocations } from "../inventory/actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import {
  KpiRow,
  StatTile,
  Toolbar,
  SearchInput,
  Select,
  SegBtn,
} from "@/components/dashboard-ui";
import {
  IcPlus,
  IcLocation,
  IcInventory,
  IcProducts,
  IcAlert,
  IcImage,
} from "@/components/icons";

type StockFilter = "all" | StockStatus;
type SortKey = "name_az" | "price_high" | "avail_high";
type View = "grid" | "list";

export default function ProductsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<SortKey>("name_az");

  useEffect(() => {
    // Pull live inventory so each product shows its per-location stock.
    // Falls back silently to the demo stock number when Supabase isn't set up.
    (async () => {
      const [inv, locs] = await Promise.all([listInventory(), listLocations()]);
      if (inv.ok) setItems(inv.data);
      if (locs.ok) setLocations(locs.data);
    })();
  }, []);

  // Match catalog products to inventory items by SKU.
  const bySku = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    for (const i of items) if (i.sku) m.set(i.sku.toLowerCase(), i);
    return m;
  }, [items]);

  // Enrich every catalog product with its live stock (or the demo fallback).
  const rows = useMemo(() => {
    return products.map((p) => {
      const item = bySku.get(p.sku.toLowerCase()) ?? null;
      const available = item ? totalAvailable(item) : p.stock;
      const status = stockStatus(available);
      const stocked = item
        ? locations
            .map((l) => ({ l, lv: levelAt(item, l.id) }))
            .filter(({ lv }) => lv.onHand > 0 || lv.committed > 0)
        : [];
      return { p, item, available, status, stocked };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bySku, locations]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) if (p.category?.trim()) s.add(p.category.trim());
    return [...s].sort();
  }, []);

  // KPIs reflect the whole catalog — a stable overview that doesn't jump
  // around as the toolbar filters below are adjusted.
  const kpi = useMemo(() => {
    let inStock = 0,
      low = 0,
      out = 0;
    for (const r of rows) {
      if (r.status === "out_stock") out += 1;
      else if (r.status === "low_stock") low += 1;
      else inStock += 1;
    }
    return { total: rows.length, inStock, low, out };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const visible = rows.filter((r) => {
      if (category !== "all" && r.p.category !== category) return false;
      if (stock !== "all" && r.status !== stock) return false;
      if (needle) {
        const hay = `${r.p.name} ${r.p.sku} ${r.p.category}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...visible];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price_high":
          return b.p.price - a.p.price;
        case "avail_high":
          return b.available - a.available;
        default:
          return a.p.name.localeCompare(b.p.name, lang === "ar" ? "ar" : "en");
      }
    });
    return sorted;
  }, [rows, q, category, stock, sort, lang]);

  const filtersActive = q !== "" || category !== "all" || stock !== "all";

  function clearFilters() {
    setQ("");
    setCategory("all");
    setStock("all");
  }

  const sortLabels: Record<SortKey, string> = {
    name_az: t("sort_name_az"),
    price_high: t("sort_price_high"),
    avail_high: t("sort_avail_high"),
  };

  const stockBadge = (available: number) => {
    const status = stockStatus(available);
    return (
      <Badge className={stockStatusTone[status]}>
        {t(stockStatusKey[status])}
        {available > 0 && ` · ${num(available, lang)}`}
      </Badge>
    );
  };

  return (
    <>
      <PageHeader
        title={t("nav_products")}
        subtitle={
          lang === "ar" ? "الكتالوج، المقاسات والألوان، والمخزون" : "Catalog, variants & inventory"
        }
        actions={
          <>
            <Link href="/inventory" className="btn-outline">
              <IcInventory className="h-4 w-4" /> {t("manage_inventory")}
            </Link>
            <button
              className="btn-primary"
              onClick={() => router.push("/inventory?new=1")}
            >
              <IcPlus className="h-4 w-4" /> {t("add_product")}
            </button>
          </>
        }
      />

      {/* ---- KPI row ---- */}
      <div className="mb-4">
        <KpiRow>
          <StatTile
            icon={IcProducts}
            label={t("kpi_products")}
            value={num(kpi.total, lang)}
            accent="brand"
          />
          <StatTile
            icon={IcInventory}
            label={t("in_stock")}
            value={num(kpi.inStock, lang)}
            accent="emerald"
            active={stock === "in_stock"}
            onClick={() => setStock(stock === "in_stock" ? "all" : "in_stock")}
          />
          <StatTile
            icon={IcAlert}
            label={t("low_stock")}
            value={num(kpi.low, lang)}
            accent="amber"
            active={stock === "low_stock"}
            onClick={() => setStock(stock === "low_stock" ? "all" : "low_stock")}
          />
          <StatTile
            icon={IcAlert}
            label={t("out_stock")}
            value={num(kpi.out, lang)}
            accent="rose"
            active={stock === "out_stock"}
            onClick={() => setStock(stock === "out_stock" ? "all" : "out_stock")}
          />
        </KpiRow>
      </div>

      {/* ---- Filter toolbar ---- */}
      <Card className="mb-4 overflow-hidden">
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={t("search")}
          />

          {categories.length > 0 && (
            <Select value={category} onChange={setCategory}>
              <option value="all">{t("all_categories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}

          <Select value={stock} onChange={(v) => setStock(v as StockFilter)}>
            <option value="all">{t("filter_stock")}: {t("filter_all")}</option>
            <option value="in_stock">{t("in_stock")}</option>
            <option value="low_stock">{t("low_stock")}</option>
            <option value="out_stock">{t("out_stock")}</option>
          </Select>

          <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {t("sort_label")}: {sortLabels[k]}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1.5">
            <SegBtn active={view === "grid"} onClick={() => setView("grid")}>
              {lang === "ar" ? "شبكة" : "Grid"}
            </SegBtn>
            <SegBtn active={view === "list"} onClick={() => setView("list")}>
              {lang === "ar" ? "قائمة" : "List"}
            </SegBtn>
          </div>

          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>
      </Card>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IcProducts className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">
              {lang === "ar" ? "لا توجد منتجات مطابقة" : "No matching products"}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{t("clear_filters")}</p>
          </div>
          <button className="btn-outline mt-1" onClick={clearFilters}>
            {t("clear_filters")}
          </button>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ p, item, available, stocked }) => (
            <ProductCard
              key={p.id}
              p={p}
              item={item}
              available={available}
              stocked={stocked}
              onClick={() => router.push("/inventory")}
              stockBadge={stockBadge}
              t={t}
              lang={lang}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-5 py-3 text-start font-medium">{t("col_product")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("fld_category")}</th>
                  <th className="px-3 py-3 text-end font-medium">{t("col_price")}</th>
                  <th className="px-5 py-3 text-start font-medium">{t("col_available")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ p, item, available }) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-page"
                    onClick={() => router.push("/inventory")}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                          {item?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <IcImage className="h-4 w-4 text-ink-soft" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{p.name}</div>
                          <div className="text-xs text-ink-soft" dir="ltr">
                            {p.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="badge bg-slate-100 text-ink-muted">{p.category}</span>
                    </td>
                    <td className="px-3 py-3 text-end font-semibold text-ink">
                      {egp(p.price, lang)}
                    </td>
                    <td className="px-5 py-3">{stockBadge(available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// ---- Grid card ---------------------------------------------------------------
function ProductCard({
  p,
  item,
  available,
  stocked,
  onClick,
  stockBadge,
  t,
  lang,
}: {
  p: Product;
  item: InventoryItem | null;
  available: number;
  stocked: { l: Location; lv: Level }[];
  onClick: () => void;
  stockBadge: (available: number) => ReactNode;
  t: (k: DictKey) => string;
  lang: Lang;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-pop"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-slate-50">
        {item?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-5xl">👗</span>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">{p.name}</h3>
            <p className="text-xs text-ink-soft" dir="ltr">{p.sku}</p>
          </div>
          <span className="badge bg-slate-100 text-ink-muted">{p.category}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-lg font-bold text-ink">{egp(p.price, lang)}</span>
          {stockBadge(available)}
        </div>

        {/* Per-location inventory */}
        {stocked.length > 0 && (
          <div className="mt-2.5 space-y-1 border-t border-line pt-2.5">
            {stocked.map(({ l, lv }) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <IcLocation className="h-3.5 w-3.5 text-ink-soft" />
                  {l.name}
                </span>
                <span className="font-medium text-ink">
                  {num(lv.available, lang)} {t("units")}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-4 border-t border-line pt-2.5 text-xs text-ink-muted">
          <span>{num(p.variants, lang)} {lang === "ar" ? "تنويعة" : "variants"}</span>
          <span>·</span>
          <span>{num(p.sold, lang)} {lang === "ar" ? "مبيع" : "sold"}</span>
          <Link href="/inventory" className="ms-auto text-brand-700 hover:underline">
            {t("manage_inventory")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
