"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { products } from "@/lib/data";
import {
  type InventoryItem,
  type Location,
  stockStatus,
  stockStatusKey,
  stockStatusTone,
  totalAvailable,
  levelAt,
} from "@/lib/inventory";
import { listInventory, listLocations } from "../inventory/actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { IcPlus, IcLocation, IcInventory } from "@/components/icons";

export default function ProductsPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

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
            <button className="btn-primary">
              <IcPlus className="h-4 w-4" /> {t("add_product")}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const item = bySku.get(p.sku.toLowerCase());
          const available = item ? totalAvailable(item) : p.stock;
          // Locations that actually hold this product (available > 0).
          const stocked = item
            ? locations
                .map((l) => ({ l, lv: levelAt(item, l.id) }))
                .filter(({ lv }) => lv.onHand > 0 || lv.committed > 0)
            : [];
          return (
            <Card key={p.id} className="overflow-hidden transition-shadow hover:shadow-pop">
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-50 to-slate-50">
                <span className="text-5xl">👗</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink">{p.name}</h3>
                    <p className="text-xs text-ink-soft" dir="ltr">{p.sku}</p>
                  </div>
                  <span className="badge bg-slate-100 text-ink-muted">{p.category}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-ink">{egp(p.price, lang)}</span>
                  {stockBadge(available)}
                </div>

                {/* Per-location inventory */}
                {stocked.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-line pt-3">
                    {stocked.map(({ l, lv }) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between text-xs"
                      >
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

                <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-xs text-ink-muted">
                  <span>{num(p.variants, lang)} {lang === "ar" ? "تنويعة" : "variants"}</span>
                  <span>·</span>
                  <span>{num(p.sold, lang)} {lang === "ar" ? "مبيع" : "sold"}</span>
                  <Link
                    href="/inventory"
                    className="ms-auto text-brand-700 hover:underline"
                  >
                    {t("manage_inventory")}
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
