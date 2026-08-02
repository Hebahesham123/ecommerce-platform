"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { listStoreProducts, type StoreProduct } from "./actions";
import { IcSearch } from "@/components/icons";

export default function StorePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    (async () => {
      const res = await listStoreProducts();
      if (res.ok) setProducts(res.data);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) if (p.category) s.add(p.category);
    return [...s].sort();
  }, [products]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (needle && !`${p.name} ${p.vendor ?? ""} ${p.category ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, q, cat]);

  return (
    <>
      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-slate-50 p-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {ar ? "بيوتي بار — أحدث صيحات الأناقة" : "BeautyBar — luxury, delivered"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {ar ? "تسوّقي الآن · الدفع عند الاستلام · شحن لكل المحافظات" : "Shop now · Cash on delivery · Nationwide shipping"}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحثي عن منتج…" : "Search products…"}
            className="h-11 w-full rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCat("all")} className={pill(cat === "all")}>{ar ? "الكل" : "All"}</button>
          {categories.slice(0, 8).map((c) => (
            <button key={c} onClick={() => setCat(c)} className={pill(cat === c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : shown.length === 0 ? (
        <div className="py-20 text-center text-ink-soft">{ar ? "لا توجد منتجات" : "No products"}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const onSale = p.priceMin != null && p.variants.some((v) => v.compareAt && v.price && v.compareAt > v.price);
            const soldOut = p.available <= 0;
            return (
              <Link
                key={p.id}
                href={`/store/product/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-pop"
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-slate-50">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <span className="text-4xl">🛍️</span>
                  )}
                  {onSale && !soldOut && (
                    <span className="absolute start-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {ar ? "خصم" : "Sale"}
                    </span>
                  )}
                  {soldOut && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
                      {ar ? "نفد المخزون" : "Sold out"}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  {p.vendor && <div className="text-xs text-ink-soft">{p.vendor}</div>}
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink">{p.name}</h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-bold text-ink">{p.priceMin != null ? egp(p.priceMin, lang) : "—"}</span>
                    {onSale && (
                      <span className="text-xs text-ink-soft line-through">
                        {egp(Math.max(...p.variants.map((v) => v.compareAt ?? 0)), lang)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="mt-6 text-center text-xs text-ink-soft">
          {num(shown.length, lang)} {ar ? "منتج" : "products"}
        </p>
      )}
    </>
  );
}

function pill(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm transition-colors ${
    active ? "bg-ink text-white" : "bg-surface-page text-ink-muted hover:bg-surface-hover"
  }`;
}
