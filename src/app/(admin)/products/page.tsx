"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, egp, num } from "@/lib/i18n";
import { products as demoProducts } from "@/lib/data";
import { collectionHandle } from "@/lib/collections";
import {
  type InventoryItem,
  type Location,
  type ProductStatus,
  stockStatus,
  totalAvailable,
  emptyItem,
} from "@/lib/inventory";
import { listInventory, listLocations } from "../inventory/actions";
import { ProductEditor } from "../inventory/product-editor";
import { ProductImport } from "@/components/product-import";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import {
  KpiStrip,
  ViewTabs,
  StatusPill,
  Checkbox,
  Toolbar,
  SearchInput,
  Select,
  SegBtn,
  Pagination,
  usePagination,
  type PillTone,
} from "@/components/dashboard-ui";
import { IcPlus, IcInventory, IcImage, IcUpload } from "@/components/icons";

type StatusTab = "all" | ProductStatus;
type StockFilter = "all" | "in_stock" | "low_stock" | "out_stock";
type SortKey = "name_az" | "price_high" | "avail_high";
type View = "list" | "grid";

const statusPill: Record<ProductStatus, PillTone> = {
  active: "success",
  draft: "info",
  archived: "neutral",
};

// A product groups one or more variants (inventory items) sharing a name.
type Product = {
  key: string;
  name: string;
  image: string | null;
  category: string;
  vendor: string | null;
  status: ProductStatus;
  variants: number;
  available: number;
  priceMin: number | null;
  priceMax: number | null;
  items: InventoryItem[];
};

function groupProducts(items: InventoryItem[]): Product[] {
  const map = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const k = it.productName.trim() || it.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  const out: Product[] = [];
  for (const [key, group] of map) {
    const prices = group.map((g) => g.price).filter((p): p is number => p != null);
    const available = group.reduce((s, g) => s + totalAvailable(g), 0);
    const first = group.find((g) => g.imageUrl) ?? group[0];
    out.push({
      key,
      name: group[0].productName,
      image: first.imageUrl ?? null,
      category: group[0].category ?? "—",
      vendor: group[0].vendor ?? null,
      status: group[0].status ?? "active",
      variants: group.length,
      available,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      items: group,
    });
  }
  return out;
}

// Fallback to the demo catalog only when the DB has no products yet.
function demoAsProducts(): Product[] {
  return demoProducts.map((p) => ({
    key: p.id,
    name: p.name,
    image: null,
    category: p.category,
    vendor: null,
    status: "active" as ProductStatus,
    variants: p.variants,
    available: p.stock,
    priceMin: p.price,
    priceMax: p.price,
    items: [],
  }));
}

export default function ProductsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<StatusTab>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [sort, setSort] = useState<SortKey>("name_az");
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [importing, setImporting] = useState(false);

  async function load() {
    const [inv, locs] = await Promise.all([listInventory(), listLocations()]);
    if (inv.ok) setItems(inv.data);
    if (locs.ok) setLocations(locs.data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // Open the full product editor for a product (its representative variant).
  function openProduct(p: Product) {
    if (p.items[0]) setEditItem(p.items[0]);
    else router.push("/inventory");
  }

  const allProducts = useMemo(
    () => (items.length ? groupProducts(items) : demoAsProducts()),
    [items],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of allProducts) if (p.category?.trim() && p.category !== "—") s.add(p.category.trim());
    return [...s].sort();
  }, [allProducts]);

  const withStatus = (p: Product) => stockStatus(p.available);

  const kpi = useMemo(() => {
    let inStock = 0, low = 0, out = 0;
    for (const p of allProducts) {
      const st = withStatus(p);
      if (st === "out_stock") out += 1;
      else if (st === "low_stock") low += 1;
      else inStock += 1;
    }
    const sellThrough = allProducts.length ? Math.round((inStock / allProducts.length) * 100) : 0;
    return { total: allProducts.length, inStock, low, out, sellThrough };
  }, [allProducts]);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "active", label: t("st_active") },
    { key: "draft", label: t("st_draft") },
    { key: "archived", label: t("st_archived") },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const visible = allProducts.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (category !== "all" && p.category !== category) return false;
      if (stock !== "all" && withStatus(p) !== stock) return false;
      if (needle) {
        const hay = `${p.name} ${p.category} ${p.vendor ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...visible];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price_high":
          return (b.priceMax ?? 0) - (a.priceMax ?? 0);
        case "avail_high":
          return b.available - a.available;
        default:
          return a.name.localeCompare(b.name, ar ? "ar" : "en");
      }
    });
    return sorted;
  }, [allProducts, tab, q, category, stock, sort, ar]);

  // Only the current page is rendered, so a large catalog stays fast to paint.
  const pg = usePagination(filtered, {
    perPage: 20,
    resetKey: `${tab}|${q}|${category}|${stock}|${sort}|${view}`,
  });

  const filtersActive = q !== "" || category !== "all" || stock !== "all";
  // Bulk selection acts on the visible page, the way every list app behaves.
  const allSelected = pg.items.length > 0 && pg.items.every((p) => selected.has(p.key));
  const someSelected = pg.items.some((p) => selected.has(p.key));

  const invTone = (st: string) =>
    st === "out_stock" ? "text-rose-600" : st === "low_stock" ? "text-amber-600" : "text-ink-muted";
  const priceLabel = (p: Product) =>
    p.priceMin == null
      ? "—"
      : p.priceMin === p.priceMax
        ? egp(p.priceMin, lang)
        : `${egp(p.priceMin, lang)} – ${egp(p.priceMax!, lang)}`;
  const invLabel = (p: Product) =>
    `${num(p.available, lang)} ${ar ? "بالمخزون" : "in stock"}${p.variants > 1 ? ` · ${num(p.variants, lang)} ${ar ? "تنويعة" : "variants"}` : ""}`;

  return (
    <>
      <PageHeader
        title={t("nav_products")}
        subtitle={ar ? "الكتالوج، التنويعات، والمخزون" : "Catalog, variants & inventory"}
        actions={
          <>
            <button className="btn-outline" onClick={() => setImporting(true)}>
              <IcUpload className="h-4 w-4" /> {ar ? "استيراد" : "Import"}
            </button>
            <button className="btn-outline" onClick={() => router.push("/inventory")}>
              <IcInventory className="h-4 w-4" /> {t("manage_inventory")}
            </button>
            <button className="btn-primary" onClick={() => setEditItem(emptyItem())}>
              <IcPlus className="h-4 w-4" /> {t("add_product")}
            </button>
          </>
        }
      />

      <div className="mb-4">
        <KpiStrip
          period={<span>{ar ? "الكتالوج" : "Catalog"}</span>}
          segments={[
            { label: t("kpi_products"), value: num(kpi.total, lang), tone: "brand" },
            { label: ar ? "معدل التصريف" : "Sell-through rate", value: `${kpi.sellThrough}%`, delta: 4, tone: "emerald" },
            { label: t("in_stock"), value: num(kpi.inStock, lang), tone: "emerald", active: stock === "in_stock", onClick: () => setStock(stock === "in_stock" ? "all" : "in_stock") },
            { label: t("low_stock"), value: num(kpi.low, lang), tone: "slate", active: stock === "low_stock", onClick: () => setStock(stock === "low_stock" ? "all" : "low_stock") },
            { label: t("out_stock"), value: num(kpi.out, lang), tone: "rose", active: stock === "out_stock", onClick: () => setStock(stock === "out_stock" ? "all" : "out_stock") },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as StatusTab)} />
          <div className="ms-auto flex gap-1">
            <SegBtn active={view === "list"} onClick={() => setView("list")}>{ar ? "قائمة" : "List"}</SegBtn>
            <SegBtn active={view === "grid"} onClick={() => setView("grid")}>{ar ? "شبكة" : "Grid"}</SegBtn>
          </div>
        </div>

        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder={t("search")} />
          {categories.length > 0 && (
            <Select value={category} onChange={setCategory}>
              <option value="all">{t("all_categories")}</option>
              {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
            </Select>
          )}
          <Select value={stock} onChange={(v) => setStock(v as StockFilter)}>
            <option value="all">{t("filter_stock")}: {t("filter_all")}</option>
            <option value="in_stock">{t("in_stock")}</option>
            <option value="low_stock">{t("low_stock")}</option>
            <option value="out_stock">{t("out_stock")}</option>
          </Select>
          <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
            <option value="name_az">{t("sort_label")}: {t("sort_name_az")}</option>
            <option value="price_high">{t("sort_price_high")}</option>
            <option value="avail_high">{t("sort_avail_high")}</option>
          </Select>
          {filtersActive && (
            <button onClick={() => { setQ(""); setCategory("all"); setStock("all"); }} className="btn-ghost h-9 px-2.5 text-xs text-ink-muted">
              {t("clear_filters")}
            </button>
          )}
          <span className="ms-auto text-xs text-ink-soft">{num(filtered.length, lang)} {t("results_word")}</span>
        </Toolbar>

        {view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="w-10 ps-5 pe-2 py-3">
                    <Checkbox checked={allSelected} indeterminate={someSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(pg.items.map((p) => p.key)))} />
                  </th>
                  <th className="px-3 py-3 text-start font-medium">{t("col_product")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("nav_inventory")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("fld_category")}</th>
                  <th className="px-5 py-3 text-end font-medium">{t("col_price")}</th>
                </tr>
              </thead>
              <tbody>
                {pg.items.map((p) => {
                  const sel = selected.has(p.key);
                  return (
                    <tr key={p.key} onClick={() => openProduct(p)}
                      className={`cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-page ${sel ? "bg-brand-50/40" : ""}`}>
                      <td className="ps-5 pe-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={sel} onChange={() =>
                          setSelected((prev) => { const n = new Set(prev); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; })} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image} alt="" className="h-full w-full object-cover" />
                            ) : (<IcImage className="h-4 w-4 text-ink-soft" />)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{p.name}</div>
                            {p.vendor && <div className="truncate text-xs text-ink-soft">{p.vendor}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><StatusPill label={t(`st_${p.status}`)} tone={statusPill[p.status]} /></td>
                      <td className={`px-3 py-3 ${invTone(withStatus(p))}`}>{invLabel(p)}</td>
                      <td className="px-3 py-3">
                        {p.category && p.category !== "—" ? (
                          // Categories drive collections, so open the matching one.
                          <a
                            href={`/collections?edit=${encodeURIComponent(collectionHandle(p.category))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="badge bg-slate-100 text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                            title={lang === "ar" ? "تعديل التصنيف" : "Edit this collection"}
                          >
                            {p.category}
                          </a>
                        ) : (
                          <Badge className="bg-slate-100 text-ink-muted">{p.category}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-end font-semibold text-ink">{priceLabel(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-ink-soft">{ar ? "لا توجد منتجات مطابقة" : "No matching products"}</div>
            )}
            {loading && <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pg.items.map((p) => (
              <div key={p.key} onClick={() => openProduct(p)}
                className="cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-pop">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-slate-50">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : (<span className="text-4xl">🛍️</span>)}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink">{p.name}</h3>
                    <StatusPill label={t(`st_${p.status}`)} tone={statusPill[p.status]} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-ink">{priceLabel(p)}</span>
                    <span className={`text-xs font-medium ${invTone(withStatus(p))}`}>{num(p.available, lang)} {ar ? "متوفر" : "avail"}</span>
                  </div>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-ink-soft">{ar ? "لا توجد منتجات مطابقة" : "No matching products"}</div>
            )}
          </div>
        )}

        {!loading && <Pagination {...pg} />}
      </Card>

      {editItem && (
        <ProductEditor
          item={editItem}
          locations={locations}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            load();
          }}
        />
      )}

      {importing && (
        <ProductImport
          locations={locations}
          onClose={() => setImporting(false)}
          onImported={load}
        />
      )}
    </>
  );
}
