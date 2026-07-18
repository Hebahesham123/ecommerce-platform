"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp, num } from "@/lib/i18n";
import { products } from "@/lib/data";
import {
  type InventoryItem,
  type Location,
  type ProductStatus,
  stockStatus,
  totalAvailable,
  levelAt,
} from "@/lib/inventory";
import { listInventory, listLocations } from "../inventory/actions";
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
  type PillTone,
} from "@/components/dashboard-ui";
import { IcPlus, IcInventory, IcImage, IcLocation } from "@/components/icons";

type StatusTab = "all" | ProductStatus;
type StockFilter = "all" | "in_stock" | "low_stock" | "out_stock";
type SortKey = "name_az" | "price_high" | "avail_high";
type View = "list" | "grid";

const statusPill: Record<ProductStatus, PillTone> = {
  active: "success",
  draft: "info",
  archived: "neutral",
};

export default function ProductsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [tab, setTab] = useState<StatusTab>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [sort, setSort] = useState<SortKey>("name_az");
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [inv, locs] = await Promise.all([listInventory(), listLocations()]);
      if (inv.ok) setItems(inv.data);
      if (locs.ok) setLocations(locs.data);
    })();
  }, []);

  const bySku = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    for (const i of items) if (i.sku) m.set(i.sku.toLowerCase(), i);
    return m;
  }, [items]);

  const rows = useMemo(() => {
    return products.map((p) => {
      const item = bySku.get(p.sku.toLowerCase()) ?? null;
      const available = item ? totalAvailable(item) : p.stock;
      const status: ProductStatus = item?.status ?? "active";
      const stocked = item
        ? locations
            .map((l) => ({ l, lv: levelAt(item, l.id) }))
            .filter(({ lv }) => lv.onHand > 0 || lv.committed > 0)
        : [];
      return { p, item, available, status, st: stockStatus(available), stocked };
    });
  }, [bySku, locations]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) if (p.category?.trim()) s.add(p.category.trim());
    return [...s].sort();
  }, []);

  const kpi = useMemo(() => {
    let inStock = 0, low = 0, out = 0;
    for (const r of rows) {
      if (r.st === "out_stock") out += 1;
      else if (r.st === "low_stock") low += 1;
      else inStock += 1;
    }
    const sellThrough = rows.length ? Math.round((inStock / rows.length) * 100) : 0;
    return { total: rows.length, inStock, low, out, sellThrough };
  }, [rows]);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "active", label: t("st_active") },
    { key: "draft", label: t("st_draft") },
    { key: "archived", label: t("st_archived") },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const visible = rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (category !== "all" && r.p.category !== category) return false;
      if (stock !== "all" && r.st !== stock) return false;
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
          return a.p.name.localeCompare(b.p.name, ar ? "ar" : "en");
      }
    });
    return sorted;
  }, [rows, tab, q, category, stock, sort, ar]);

  const filtersActive = q !== "" || category !== "all" || stock !== "all";
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.p.id));
  const someSelected = filtered.some((r) => selected.has(r.p.id));

  const invTone = (st: string) =>
    st === "out_stock" ? "text-rose-600" : st === "low_stock" ? "text-amber-600" : "text-ink-muted";
  const invLabel = (available: number) =>
    `${num(available, lang)} ${ar ? "بالمخزون" : "in stock"}`;

  return (
    <>
      <PageHeader
        title={t("nav_products")}
        subtitle={ar ? "الكتالوج، التنويعات، والمخزون" : "Catalog, variants & inventory"}
        actions={
          <>
            <Link href="/inventory" className="btn-outline">
              <IcInventory className="h-4 w-4" /> {t("manage_inventory")}
            </Link>
            <button className="btn-primary" onClick={() => router.push("/inventory?new=1")}>
              <IcPlus className="h-4 w-4" /> {t("add_product")}
            </button>
          </>
        }
      />

      <div className="mb-4">
        <KpiStrip
          period={<span>{ar ? "٣٠ يوم" : "30 days"}</span>}
          segments={[
            { label: t("kpi_products"), value: num(kpi.total, lang), tone: "brand" },
            { label: ar ? "معدل التصريف" : "Sell-through rate", value: `${kpi.sellThrough}%`, delta: 4, tone: "emerald" },
            {
              label: t("in_stock"), value: num(kpi.inStock, lang), tone: "emerald",
              active: stock === "in_stock",
              onClick: () => setStock(stock === "in_stock" ? "all" : "in_stock"),
            },
            {
              label: t("low_stock"), value: num(kpi.low, lang), tone: "slate",
              active: stock === "low_stock",
              onClick: () => setStock(stock === "low_stock" ? "all" : "low_stock"),
            },
            {
              label: t("out_stock"), value: num(kpi.out, lang), tone: "rose",
              active: stock === "out_stock",
              onClick: () => setStock(stock === "out_stock" ? "all" : "out_stock"),
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {/* Tabs + view toggle */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ViewTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as StatusTab)} />
          <div className="ms-auto flex gap-1">
            <SegBtn active={view === "list"} onClick={() => setView("list")}>
              {ar ? "قائمة" : "List"}
            </SegBtn>
            <SegBtn active={view === "grid"} onClick={() => setView("grid")}>
              {ar ? "شبكة" : "Grid"}
            </SegBtn>
          </div>
        </div>

        {/* Toolbar */}
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder={t("search")} />
          {categories.length > 0 && (
            <Select value={category} onChange={setCategory}>
              <option value="all">{t("all_categories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
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
            <option value="name_az">{t("sort_label")}: {t("sort_name_az")}</option>
            <option value="price_high">{t("sort_price_high")}</option>
            <option value="avail_high">{t("sort_avail_high")}</option>
          </Select>
          {filtersActive && (
            <button
              onClick={() => { setQ(""); setCategory("all"); setStock("all"); }}
              className="btn-ghost h-9 px-2.5 text-xs text-ink-muted"
            >
              {t("clear_filters")}
            </button>
          )}
          <span className="ms-auto text-xs text-ink-soft">
            {num(filtered.length, lang)} {t("results_word")}
          </span>
        </Toolbar>

        {/* List view */}
        {view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="w-10 ps-5 pe-2 py-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.p.id)))
                      }
                    />
                  </th>
                  <th className="px-3 py-3 text-start font-medium">{t("col_product")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("nav_inventory")}</th>
                  <th className="px-3 py-3 text-start font-medium">{t("fld_category")}</th>
                  <th className="px-5 py-3 text-end font-medium">{t("col_price")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ p, item, available, status, st }) => {
                  const sel = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push("/inventory")}
                      className={`cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-page ${
                        sel ? "bg-brand-50/40" : ""
                      }`}
                    >
                      <td className="ps-5 pe-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={sel}
                          onChange={() =>
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page">
                            {item?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <IcImage className="h-4 w-4 text-ink-soft" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{p.name}</div>
                            <div className="text-xs text-ink-soft" dir="ltr">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill label={t(`st_${status}`)} tone={statusPill[status]} />
                      </td>
                      <td className={`px-3 py-3 ${invTone(st)}`}>{invLabel(available)}</td>
                      <td className="px-3 py-3">
                        <Badge className="bg-slate-100 text-ink-muted">{p.category}</Badge>
                      </td>
                      <td className="px-5 py-3 text-end font-semibold text-ink">{egp(p.price, lang)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-ink-soft">
                {ar ? "لا توجد منتجات مطابقة" : "No matching products"}
              </div>
            )}
          </div>
        ) : (
          // Grid view
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ p, item, available, status, st, stocked }) => (
              <div
                key={p.id}
                onClick={() => router.push("/inventory")}
                className="cursor-pointer overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-pop"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-slate-50">
                  {item?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl">👗</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-ink">{p.name}</h3>
                      <p className="text-xs text-ink-soft" dir="ltr">{p.sku}</p>
                    </div>
                    <StatusPill label={t(`st_${status}`)} tone={statusPill[status]} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-ink">{egp(p.price, lang)}</span>
                    <span className={`text-sm font-medium ${invTone(st)}`}>{invLabel(available)}</span>
                  </div>
                  {stocked.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-line pt-3">
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
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-ink-soft">
                {ar ? "لا توجد منتجات مطابقة" : "No matching products"}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
