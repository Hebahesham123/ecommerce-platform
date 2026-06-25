"use client";

import { useI18n, egp, num } from "@/lib/i18n";
import { products } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { IcPlus } from "@/components/icons";

export default function ProductsPage() {
  const { t, lang } = useI18n();

  const stockBadge = (stock: number) => {
    if (stock === 0)
      return <span className="badge bg-rose-50 text-rose-700">{t("out_stock")}</span>;
    if (stock <= 10)
      return (
        <span className="badge bg-amber-50 text-amber-700">
          {t("low_stock")} · {num(stock, lang)}
        </span>
      );
    return (
      <span className="badge bg-emerald-50 text-emerald-700">
        {t("in_stock")} · {num(stock, lang)}
      </span>
    );
  };

  return (
    <>
      <PageHeader
        title={t("nav_products")}
        subtitle={lang === "ar" ? "الكتالوج، المقاسات والألوان، والمخزون" : "Catalog, variants & inventory"}
        actions={
          <button className="btn-primary">
            <IcPlus className="h-4 w-4" /> {t("add_product")}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
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
                {stockBadge(p.stock)}
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-xs text-ink-muted">
                <span>{num(p.variants, lang)} {lang === "ar" ? "تنويعة" : "variants"}</span>
                <span>·</span>
                <span>{num(p.sold, lang)} {lang === "ar" ? "مبيع" : "sold"}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
