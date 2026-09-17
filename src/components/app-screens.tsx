"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScreenSettings } from "@/lib/app-theme";
import type { Card } from "@/components/app-home";

/**
 * The collection and product screens, drawn once.
 *
 * The same idea as app-home: the theme editor's phone and the preview app
 * render these very components, so what the merchant tunes beside the phone is
 * what a shopper gets. Both screens are dressed as Beauty Bar's website is -
 * a dark roast banner, cream cards, caramel prices set in a serif - and every
 * word, colour and optional part comes from App theme → Collection / Product.
 */

const API = "/api/storefront";
const SERIF = 'var(--font-display), "Cormorant Garamond", "Playfair Display", Georgia, serif';

async function get<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(API + path, { headers: { "x-store-channel": "app" }, cache: "no-store" });
    const j = await r.json();
    return j?.ok ? { ok: true, data: j.data as T } : { ok: false, error: String(j?.error ?? "failed") };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}

const money = (v: number | null | undefined, ar: boolean) =>
  v == null
    ? "—"
    : `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(v)} ${ar ? "ج.م" : "EGP"}`;

const off = (price: number | null | undefined, compareAt: number | null | undefined) =>
  price != null && compareAt != null && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;

/** The merchant's words when they wrote some, the app's otherwise. */
const say = (chosen: string | undefined, fallback: string) => (chosen && chosen.trim() ? chosen : fallback);

export type ScreenHandlers = {
  onBack?: () => void;
  onOpenProduct?: (id: string) => void;
  onOpenScreen?: (screen: string) => void;
  /** A variant and how many. Leave it out and nothing offers to add. */
  onAdd?: (variantId: string, quantity: number) => void;
  /** Add, then go straight to paying. */
  onBuyNow?: (variantId: string, quantity: number) => void;
  onToggleWishlist?: (card: Card) => void;
  wishlist?: readonly string[];
};

// ------------------------------------------------------------------ icons --
function IcHeart({ on, className = "h-4 w-4" }: { on?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20s-7-4.35-9.33-8.2C.9 8.9 2.5 5 6.2 5c2.1 0 3.4 1.2 5.8 3.6C14.4 6.2 15.7 5 17.8 5c3.7 0 5.3 3.9 3.53 6.8C19 15.65 12 20 12 20z" strokeLinejoin="round" />
    </svg>
  );
}
function IcBack({ ar }: { ar: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${ar ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
function IcPlus() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IcFilter() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}
function IcGrid({ single }: { single?: boolean }) {
  return single ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}
function Star({ className = "h-3 w-3", color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden>
      <path d="M12 2l2.9 6.26 6.85.72-5.1 4.6 1.44 6.72L12 16.9l-6.09 3.4 1.44-6.72-5.1-4.6 6.85-.72z" />
    </svg>
  );
}

// ============================================================= COLLECTION ==
type Facets = { vendors: { name: string; count: number }[]; priceMin: number; priceMax: number };
type CollectionReply = {
  collection: { handle: string; title: string; description: string | null; image: string | null; productCount: number };
  products: Card[];
  total: number;
  facets?: Facets;
};

type Filters = { brands: string[]; min: number; max: number; inStock: boolean; onSale: boolean };
const NO_FILTERS: Filters = { brands: [], min: 0, max: 0, inStock: false, onSale: false };

/**
 * A collection link can carry a narrowing: "all?minPrice=3000&maxPrice=4999"
 * is the whole shop between those prices. That is how a price tier opens a
 * real page without a collection having to be kept for every budget.
 */
export function splitCollectionLink(link: string): { handle: string; filters: Filters } {
  const [handle, query = ""] = link.split("?");
  const q = new URLSearchParams(query);
  return {
    handle,
    filters: {
      brands: (q.get("vendor") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
      min: Number(q.get("minPrice")) || 0,
      max: Number(q.get("maxPrice")) || 0,
      inStock: q.get("inStock") === "1",
      onSale: q.get("onSale") === "1",
    },
  };
}

const SORTS = [
  { key: "manual", ar: "مميّز", en: "Featured" },
  { key: "newest", ar: "الأحدث", en: "Newest" },
  { key: "price-ascending", ar: "السعر: الأقل", en: "Price: low to high" },
  { key: "price-descending", ar: "السعر: الأعلى", en: "Price: high to low" },
  { key: "title-ascending", ar: "أبجدياً", en: "A–Z" },
];

/**
 * One collection.
 *
 * A dark banner names it, a row of brand chips narrows it in a tap, and a bar
 * that stays on screen holds the count, the grid switch, filters and sorting.
 * Filtering and sorting are asked of the shop, so they cover the whole
 * collection, and the grid keeps loading as the shopper scrolls.
 */
export function CollectionPage({
  handle: link,
  title,
  settings: c,
  ar,
  handlers = {},
}: {
  handle: string;
  title?: string;
  settings: ScreenSettings["collection"];
  ar: boolean;
  handlers?: ScreenHandlers;
}) {
  const { handle, filters: preset } = useMemo(() => splitCollectionLink(link), [link]);
  const [sort, setSort] = useState(c.sortDefault || "manual");
  const [filters, setFilters] = useState<Filters>(preset);
  const [draft, setDraft] = useState<Filters>(preset);
  const [panel, setPanel] = useState(false);
  const [single, setSingle] = useState(false);
  const [reply, setReply] = useState<CollectionReply | null>(null);
  const [products, setProducts] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const pageSize = Math.min(Math.max(c.pageSize || 24, 6), 60);

  const query = useCallback(
    (offset: number, f: Filters) => {
      const p = new URLSearchParams({ sort, offset: String(offset), limit: String(pageSize) });
      if (f.brands.length) p.set("vendor", f.brands.join(","));
      if (f.min > 0) p.set("minPrice", String(f.min));
      if (f.max > 0) p.set("maxPrice", String(f.max));
      if (f.inStock) p.set("inStock", "1");
      if (f.onSale) p.set("onSale", "1");
      return `/collections/${encodeURIComponent(handle)}?${p}`;
    },
    [handle, sort, pageSize],
  );

  useEffect(() => {
    let live = true;
    setError(null);
    setProducts([]);
    setReply(null);
    get<CollectionReply>(query(0, filters)).then((r) => {
      if (!live) return;
      if (!r.ok) return setError(r.error);
      setReply(r.data);
      setProducts(r.data.products);
    });
    return () => {
      live = false;
    };
  }, [query, filters]);

  // Keep going as the bottom of the grid comes into view.
  const more = useCallback(() => {
    if (!reply || loadingMore || products.length >= reply.total) return;
    setLoadingMore(true);
    get<CollectionReply>(query(products.length, filters)).then((r) => {
      if (r.ok) setProducts((p) => [...p, ...r.data.products.filter((x) => !p.some((y) => y.id === x.id))]);
      setLoadingMore(false);
    });
  }, [reply, loadingMore, products.length, query, filters]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more]);

  const facets = reply?.facets;
  const brandsLine = (facets?.vendors ?? []).slice(0, 5).map((v) => v.name).join(" · ");
  const heading = reply?.collection.title || (title && title !== link ? title : "") || handle;
  // A page opened on a price range says which range it is.
  const range =
    preset.min > 0 && preset.max > 0
      ? `${money(preset.min, ar)} – ${money(preset.max, ar)}`
      : preset.max > 0
        ? `${ar ? "حتى" : "Under"} ${money(preset.max, ar)}`
        : preset.min > 0
          ? `${money(preset.min, ar)}+`
          : "";
  const subtitle = range
    ? [range, reply ? `${reply.total} ${ar ? "قطعة" : "pieces"}` : ""].filter(Boolean).join(" · ")
    : c.heroSubtitle ||
      [reply ? `${reply.collection.productCount || reply.total}+ ${ar ? "قطعة" : "pieces"}` : "", brandsLine]
        .filter(Boolean)
        .join(" · ");
  const active =
    filters.brands.length + (filters.min > 0 || filters.max > 0 ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.onSale ? 1 : 0);
  const columns = single ? 1 : c.columns === 3 ? 3 : 2;
  const ink = c.inkColor || "#211a15";
  const line = c.lineColor || "#eadfd2";
  const accent = c.priceColor || "#b0603e";

  const pickBrand = (name: string | null) =>
    setFilters((f) => ({ ...f, brands: name == null ? [] : f.brands.includes(name) ? f.brands.filter((b) => b !== name) : [name] }));

  return (
    <div style={{ background: c.pageBg || "#f8f5f0", color: ink }}>
      {c.showHero && (
        <div
          className="relative px-5 pb-6 pt-5"
          style={{ background: `linear-gradient(135deg, ${c.heroFrom || "#1c1410"}, ${c.heroTo || "#3d2619"})` }}
        >
          {handlers.onBack && (
            <button
              onClick={handlers.onBack}
              aria-label={ar ? "رجوع" : "Back"}
              className="mb-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <IcBack ar={ar} />
            </button>
          )}
          {c.heroKicker && (
            <div dir="auto" className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: c.heroAccent || "#d08159" }}>
              {c.heroKicker}
            </div>
          )}
          <h1 dir="auto" className="mt-2 text-[32px] font-medium italic uppercase leading-none text-white" style={{ fontFamily: SERIF }}>
            {heading}
          </h1>
          {subtitle && (
            <p dir="auto" className="mt-2.5 text-[12px] leading-relaxed text-white/70">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {c.showBrandChips && (facets?.vendors.length ?? 0) > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 pt-3">
          {[{ name: "", count: reply?.collection.productCount ?? 0 }, ...(facets?.vendors ?? []).slice(0, 14)].map((v) => {
            const on = v.name ? filters.brands.length === 1 && filters.brands[0] === v.name : filters.brands.length === 0;
            return (
              <button
                key={v.name || "__all"}
                onClick={() => pickBrand(v.name || null)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition"
                style={on ? { background: ink, borderColor: ink, color: "#fff" } : { borderColor: line, background: "#fff", color: ink }}
              >
                {v.name || (ar ? "الكل" : "All")}
              </button>
            );
          })}
        </div>
      )}

      {/* The bar that stays: count, grid switch, filters and sort. */}
      <div className="sticky top-0 z-10 border-b px-4 py-2.5 backdrop-blur" style={{ background: `${c.pageBg || "#f8f5f0"}ee`, borderColor: line }}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">
            {reply ? `${reply.total} ${ar ? "منتج" : "products"}` : "…"}
          </span>
          {c.showLayoutToggle && (
            <button
              onClick={() => setSingle((v) => !v)}
              aria-label={single ? (ar ? "شبكة" : "Grid") : ar ? "صورة كبيرة" : "Large"}
              className="grid h-8 w-8 place-items-center rounded-full border bg-white"
              style={{ borderColor: line, color: ink }}
            >
              <IcGrid single={!single} />
            </button>
          )}
          {c.showFilters && (
            <button
              onClick={() => {
                setDraft(filters);
                setPanel((v) => !v);
              }}
              className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold"
              style={{ borderColor: accent, color: ink, background: panel ? `${accent}14` : "#fff" }}
            >
              <IcFilter />
              {ar ? "تصفية" : "Filters"}
              {active > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: accent }}>
                  {active}
                </span>
              )}
            </button>
          )}
          {c.showSort && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-8 max-w-[132px] rounded-full border bg-white px-2.5 text-[12px] outline-none"
              style={{ borderColor: line, color: ink }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {ar ? s.ar : s.en}
                </option>
              ))}
            </select>
          )}
        </div>

        {panel && (
          <div className="mt-3 space-y-3 rounded-2xl border bg-white p-3" style={{ borderColor: line }}>
            {(facets?.vendors.length ?? 0) > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{ar ? "الماركة" : "Brand"}</div>
                <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {facets!.vendors.map((v) => {
                    const on = draft.brands.includes(v.name);
                    return (
                      <button
                        key={v.name}
                        onClick={() =>
                          setDraft((d) => ({ ...d, brands: on ? d.brands.filter((b) => b !== v.name) : [...d.brands, v.name] }))
                        }
                        className="rounded-full border px-2.5 py-1 text-[11px]"
                        style={on ? { background: ink, color: "#fff", borderColor: ink } : { borderColor: line, color: ink }}
                      >
                        {v.name} <span className="opacity-60">{v.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{ar ? "السعر" : "Price"}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: ar ? "أقل من 5,000" : "Under 5,000", min: 0, max: 5000 },
                  { label: "5,000 – 10,000", min: 5000, max: 10000 },
                  { label: ar ? "أكثر من 10,000" : "Over 10,000", min: 10000, max: 0 },
                ].map((r) => {
                  const on = draft.min === r.min && draft.max === r.max;
                  return (
                    <button
                      key={r.label}
                      onClick={() => setDraft((d) => (on ? { ...d, min: 0, max: 0 } : { ...d, min: r.min, max: r.max }))}
                      className="rounded-full border px-2.5 py-1 text-[11px]"
                      style={on ? { background: ink, color: "#fff", borderColor: ink } : { borderColor: line, color: ink }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <input
                  type="number"
                  min={0}
                  value={draft.min || ""}
                  placeholder={String(facets?.priceMin ?? 0)}
                  onChange={(e) => setDraft((d) => ({ ...d, min: Number(e.target.value) || 0 }))}
                  className="h-8 w-full rounded-lg border bg-white px-2 text-[12px] text-slate-900 outline-none"
                  style={{ borderColor: line }}
                />
                –
                <input
                  type="number"
                  min={0}
                  value={draft.max || ""}
                  placeholder={String(facets?.priceMax ?? 0)}
                  onChange={(e) => setDraft((d) => ({ ...d, max: Number(e.target.value) || 0 }))}
                  className="h-8 w-full rounded-lg border bg-white px-2 text-[12px] text-slate-900 outline-none"
                  style={{ borderColor: line }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["inStock", ar ? "المتوفّر فقط" : "In stock only"],
                  ["onSale", ar ? "عليه خصم" : "On sale"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                  className="rounded-full border px-2.5 py-1 text-[11px]"
                  style={draft[key] ? { background: ink, color: "#fff", borderColor: ink } : { borderColor: line, color: ink }}
                >
                  {draft[key] ? "✓ " : ""}
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setDraft(NO_FILTERS);
                  setFilters(NO_FILTERS);
                  setPanel(false);
                }}
                className="h-9 flex-1 rounded-full border text-[12px] font-semibold"
                style={{ borderColor: line, color: ink }}
              >
                {ar ? "مسح" : "Clear"}
              </button>
              <button
                onClick={() => {
                  setFilters(draft);
                  setPanel(false);
                }}
                className="h-9 flex-[2] rounded-full text-[12px] font-bold uppercase tracking-[0.12em] text-white"
                style={{ background: ink }}
              >
                {ar ? "عرض النتائج" : "Show results"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-6 pt-3">
        {error ? (
          <p className="py-14 text-center text-[12px] text-rose-600">{error}</p>
        ) : !reply ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-md" style={{ background: c.cardBg || "#f3ece4" }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[18px] italic" style={{ fontFamily: SERIF }}>
              {ar ? "لا شيء يطابق اختيارك" : "Nothing matches that — yet"}
            </p>
            {active > 0 && (
              <button
                onClick={() => setFilters(NO_FILTERS)}
                className="mt-3 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white"
                style={{ background: ink }}
              >
                {ar ? "مسح التصفية" : "Clear filters"}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {products.map((p) => (
              <CollectionCard key={p.id} card={p} c={c} ar={ar} large={single} handlers={handlers} />
            ))}
          </div>
        )}
        <div ref={sentinel} className="h-px" />
        {reply && products.length < reply.total && (
          <button
            onClick={more}
            disabled={loadingMore}
            className="mx-auto mt-4 block rounded-full border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ borderColor: line, color: ink }}
          >
            {loadingMore ? "…" : `${ar ? "المزيد" : "Load more"} · ${products.length}/${reply.total}`}
          </button>
        )}
      </div>
    </div>
  );
}

/** A tile as the website draws one: white picture, cream panel, serif name, caramel price. */
function CollectionCard({
  card,
  c,
  ar,
  large,
  handlers,
}: {
  card: Card;
  c: ScreenSettings["collection"];
  ar: boolean;
  large?: boolean;
  handlers: ScreenHandlers;
}) {
  const [added, setAdded] = useState(false);
  const discount = off(card.priceMin, card.compareAt);
  const wished = handlers.wishlist?.includes(card.id) ?? false;
  const ink = c.inkColor || "#211a15";
  const accent = c.priceColor || "#b0603e";
  const line = c.lineColor || "#eadfd2";
  const lines = Math.min(Math.max(c.nameLines || 2, 1), 3);

  return (
    <div className="relative flex flex-col overflow-hidden border bg-white" style={{ borderColor: line }}>
      <button onClick={() => handlers.onOpenProduct?.(card.id)} className={`relative block w-full bg-white ${large ? "aspect-[4/5]" : "aspect-square"}`}>
        {card.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
        )}
        {c.showBadge && discount > 0 && (
          <span className="absolute start-2 top-2 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white" style={{ background: accent }}>
            −{discount}%
          </span>
        )}
      </button>
      {c.showWishlist && handlers.onToggleWishlist && (
        <button
          onClick={() => handlers.onToggleWishlist?.(card)}
          aria-label={ar ? "المفضّلة" : "Save"}
          className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full border bg-white/90"
          style={{ borderColor: line, color: accent }}
        >
          <IcHeart on={wished} className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2" style={{ background: c.cardBg || "#f3ece4" }}>
        {c.showVendor && card.vendor && (
          <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>
            {card.vendor}
          </span>
        )}
        {c.showRating && c.ratingText && (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold" style={{ color: ink }}>
            <Star color="#c9a227" />
            {c.ratingText}
          </span>
        )}
        <button
          onClick={() => handlers.onOpenProduct?.(card.id)}
          dir="auto"
          className={`mt-1 text-start leading-snug ${large ? "text-[16px]" : "text-[13px]"}`}
          style={{ fontFamily: SERIF, color: ink, display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {card.name}
        </button>
        <div className="mt-auto flex items-end justify-between gap-1 pt-2">
          <div className="min-w-0">
            <div className={`font-semibold leading-tight ${large ? "text-[19px]" : "text-[14px]"}`} style={{ fontFamily: SERIF, color: accent }}>
              {money(card.priceMin, ar)}
            </div>
            {discount > 0 && <div className="text-[10px] text-slate-400 line-through">{money(card.compareAt, ar)}</div>}
          </div>
          {c.showQuickAdd && handlers.onAdd && (
            <button
              onClick={() => {
                if (card.variantId) {
                  handlers.onAdd?.(card.variantId, 1);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1400);
                } else handlers.onOpenProduct?.(card.id);
              }}
              aria-label={ar ? "أضيفي" : "Add"}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition"
              style={added ? { background: "#4a7858", borderColor: "#4a7858", color: "#fff" } : { borderColor: `${accent}55`, color: accent }}
            >
              {added ? "✓" : <IcPlus />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================ PRODUCT ==
type Variant = { id: string; variantTitle: string | null; price: number | null; compareAt: number | null; available: number };
type Product = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  category: string | null;
  vendor: string | null;
  priceMin: number | null;
  compareAt: number | null;
  available: number;
  variants: Variant[];
};

/** A steady number for a product, so its viewer count does not jump on every visit. */
function seeded(id: string, min: number, max: number) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + (h % (hi - lo + 1));
}

/** "Description" text with the HTML taken out and its lists kept as lines. */
function plain(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * One product.
 *
 * The picture fills the top and swipes, with the discount and a heart on it.
 * A card rises over it with the brand, the name in serif, a rating chip and a
 * large price that says how much is saved. Below: instalments, sizes, the
 * quantity, a live "people viewing" line, a low-stock bar, three promises,
 * the description and delivery in folds, a dark reviews card and a rail of
 * pieces from the same brand. Adding and buying sit in a bar at the bottom
 * that never scrolls away.
 */
export function ProductPage({
  id,
  settings: p,
  ar,
  handlers = {},
  crumb,
}: {
  id: string;
  settings: ScreenSettings["product"];
  ar: boolean;
  handlers?: ScreenHandlers;
  /** Where the shopper came from, for the breadcrumb. */
  crumb?: string;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [openFold, setOpenFold] = useState<"description" | "shipping" | null>("description");
  const [more, setMore] = useState(false);
  const [related, setRelated] = useState<Card[]>([]);
  const [added, setAdded] = useState(false);
  const [viewers, setViewers] = useState(0);
  const strip = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    setProduct(null);
    setError(null);
    setRelated([]);
    setQty(1);
    setSlide(0);
    get<Product>(`/products/${encodeURIComponent(id)}`).then((r) => {
      if (!live) return;
      if (!r.ok) return setError(r.error);
      setProduct(r.data);
      const first = r.data.variants.find((v) => v.available > 0) ?? r.data.variants[0];
      setChosen(first?.id ?? null);
      if (r.data.vendor) {
        get<{ products: Card[] }>(`/products?limit=12&q=${encodeURIComponent(r.data.vendor)}`).then((rr) => {
          if (live && rr.ok) setRelated(rr.data.products.filter((x) => x.id !== r.data.id && x.handle !== r.data.handle).slice(0, 10));
        });
      }
    });
    return () => {
      live = false;
    };
  }, [id]);

  // A few people come and go while the shopper looks.
  useEffect(() => {
    if (!p.showViewers) return;
    const base = seeded(id, p.viewersMin || 12, p.viewersMax || 40);
    setViewers(base);
    const t = setInterval(() => setViewers(base + Math.round(Math.random() * 4) - 2), 5000);
    return () => clearInterval(t);
  }, [id, p.showViewers, p.viewersMin, p.viewersMax]);

  const images = useMemo(
    () => (product ? (product.images.length ? product.images : product.image ? [product.image] : []) : []),
    [product],
  );

  const accent = p.accentColor || "#9d6540";
  const ink = p.inkColor || "#211a15";
  const muted = p.mutedColor || "#74685e";
  const dark = p.darkColor || "#211a15";
  const line = "rgba(69,46,31,.13)";

  if (error) return <p className="px-6 py-16 text-center text-[12px] text-rose-600">{error}</p>;
  if (!product) {
    return (
      <div style={{ background: p.pageBg || "#f8f5f0" }}>
        <div className="aspect-square animate-pulse bg-white" />
        <div className="space-y-2 p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-black/10" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-black/10" />
          <div className="h-8 w-40 animate-pulse rounded bg-black/10" />
        </div>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === chosen) ?? product.variants[0];
  const price = variant?.price ?? product.priceMin;
  const compareAt = variant?.compareAt ?? product.compareAt;
  const discount = off(price, compareAt);
  const left = variant ? variant.available : product.available;
  const soldOut = !variant || left <= 0 || price == null;
  const months = Math.max(1, p.instalmentMonths || 6);
  const providers = p.instalmentProviders.split(/[·,|]/).map((x) => x.trim()).filter(Boolean);
  const card: Card = { id: product.id, handle: product.handle, name: product.name, image: product.image, priceMin: product.priceMin, compareAt: product.compareAt, vendor: product.vendor };
  const wished = handlers.wishlist?.includes(product.id) ?? false;
  const description = product.description ? plain(product.description) : "";
  const stars = Math.max(0, Math.min(5, Math.round(Number(p.ratingValue) || 0)));

  const goTo = (i: number) => {
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth * (ar ? -1 : 1), behavior: "smooth" });
    setSlide(i);
  };

  return (
    <div className="relative" style={{ background: p.pageBg || "#f8f5f0", color: ink }}>
      {/* ---------------- gallery ---------------- */}
      <div className="relative bg-white">
        <div
          ref={strip}
          dir="ltr"
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== slide) setSlide(i);
          }}
        >
          {(images.length ? images : [""]).map((src, i) => (
            <div key={src + i} className="aspect-square w-full shrink-0 snap-center">
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-contain p-3" loading={i ? "lazy" : "eager"} />
              )}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex items-center gap-2">
            {handlers.onBack && (
              <button onClick={handlers.onBack} aria-label={ar ? "رجوع" : "Back"} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow" style={{ color: ink }}>
                <IcBack ar={ar} />
              </button>
            )}
            {p.showBadge && discount > 0 && (
              <span className="rounded-md px-2 py-1 text-[11px] font-bold text-white" style={{ background: "#c0644a" }}>
                −{discount}%
              </span>
            )}
          </div>
          {p.showWishlist && handlers.onToggleWishlist && (
            <button
              onClick={() => handlers.onToggleWishlist?.(card)}
              aria-label={ar ? "المفضّلة" : "Save"}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow"
              style={{ color: "#c0644a" }}
            >
              <IcHeart on={wished} />
            </button>
          )}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === slide ? 16 : 6, background: i === slide ? accent : "#0002" }} />
            ))}
          </div>
        )}
      </div>
      {p.showThumbs && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto bg-white px-3 pb-3 pt-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => goTo(i)}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-50"
              style={{ borderColor: i === slide ? accent : "transparent" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ---------------- the card over it ---------------- */}
      <div className="relative -mt-2 rounded-t-[22px] border-t bg-white px-4 pb-5 pt-4 shadow-[0_-8px_24px_rgba(33,26,21,0.06)]" style={{ borderColor: line }}>
        {p.showBreadcrumb && (
          <div dir="auto" className="truncate text-[11px] text-slate-500">
            {ar ? "الرئيسية" : "Home"} / {crumb || product.category || (ar ? "المتجر" : "Shop")} / {product.name}
          </div>
        )}
        {product.vendor && (
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: muted }}>
            {product.vendor}
          </div>
        )}
        <h1 dir="auto" className="mt-1 text-[24px] leading-[1.15]" style={{ fontFamily: SERIF, color: ink }}>
          {product.name}
        </h1>

        {p.showRating && p.ratingValue && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: muted }}>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-white" style={{ background: `linear-gradient(90deg, #5b3a24, ${accent})` }}>
              <span className="text-[14px] leading-none" style={{ fontFamily: SERIF }}>
                {p.ratingValue}
              </span>
              <span className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-2.5 w-2.5" color={i < stars ? "#f5d27a" : "#ffffff55"} />
                ))}
              </span>
            </span>
            {p.reviewCount && (
              <span>
                {p.reviewCount} {p.reviewsWord}
              </span>
            )}
            {p.verifiedLabel && <span>· {p.verifiedLabel}</span>}
            {handlers.onOpenScreen && (
              <button onClick={() => handlers.onOpenScreen?.("happy-customers")} className="ms-auto underline underline-offset-2" style={{ color: accent }}>
                {ar ? "الكل" : "See all"}
              </button>
            )}
          </div>
        )}

        <div className="mt-3 border-t pt-3" style={{ borderColor: line }}>
          <div className="text-[34px] font-semibold leading-none" style={{ fontFamily: SERIF, color: accent }}>
            {money(price, ar)}
          </div>
          {discount > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-slate-400 line-through">{money(compareAt, ar)}</span>
              {p.showSave && compareAt != null && price != null && (
                <span className="rounded-full bg-[#e8f1ea] px-2.5 py-0.5 text-[11px] font-semibold text-[#3f6f4f]">
                  {say(p.saveLabel, ar ? "وفّري" : "Save")} {money(compareAt - price, ar)}
                </span>
              )}
            </div>
          )}
        </div>

        {p.showInstalments && price != null && price > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: muted }}>
              {say(p.instalmentsTitle, ar ? "التقسيط" : "Installments")}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5" style={{ background: "#f4ebe1", borderColor: "#e6d6c4" }}>
              <span className="text-[16px]">💳</span>
              <span dir="auto" className="min-w-0 flex-1 text-[12px] leading-snug" style={{ color: muted }}>
                {ar ? "ادفعي " : "Pay "}
                <b style={{ color: ink }}>{money(Math.round(price / months), ar)}</b>
                {ar ? " شهرياً لمدة " : " per month for "}
                <b style={{ color: ink }}>
                  {months} {ar ? "شهور" : "months"}
                </b>
              </span>
              <span className="flex shrink-0 gap-1">
                {providers.map((name, i) => (
                  <span
                    key={name}
                    className="rounded-md px-1.5 py-1 text-[9.5px] font-bold"
                    style={i === providers.length - 1 ? { background: "#c83a2c", color: "#fff" } : { background: dark, color: "#d9a36f" }}
                  >
                    {name}
                  </span>
                ))}
              </span>
            </div>
          </div>
        )}

        {p.showVariants && product.variants.length > 1 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>
                {ar ? "اختاري" : "Choose"}
              </span>
              <span style={{ color: ink }}>{variant?.variantTitle}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.variants.map((v) => {
                const on = v.id === variant?.id;
                const out = v.available <= 0;
                return (
                  <button
                    key={v.id}
                    disabled={out}
                    onClick={() => {
                      setChosen(v.id);
                      setQty(1);
                    }}
                    className={`min-w-[44px] rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${out ? "line-through opacity-40" : ""}`}
                    style={on ? { background: ink, borderColor: ink, color: "#fff" } : { borderColor: "#e0d4c4", color: ink, background: "#fff" }}
                  >
                    {v.variantTitle ?? (ar ? "مقاس واحد" : "One size")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {p.showQuantity && !soldOut && (
          <div className="mt-4 flex items-center gap-3 text-[12px]" style={{ color: muted }}>
            {ar ? "الكمية" : "Qty"}
            <span className="inline-flex items-center rounded-full border bg-white" style={{ borderColor: "#e0d4c4" }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 text-[16px]" style={{ color: ink }}>
                −
              </button>
              <span className="w-6 text-center text-[14px] font-semibold" style={{ color: ink }}>
                {qty}
              </span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, left), q + 1))} className="h-9 w-9 text-[16px]" style={{ color: ink }}>
                +
              </button>
            </span>
          </div>
        )}

        {p.showViewers && viewers > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-medium" style={{ background: "#f8e9e3", borderColor: "#eed2c6", color: "#b0402c" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span dir="auto" className="flex-1">
              {say(p.viewersText, ar ? "{n} يشاهدن هذا الآن" : "{n} people are viewing this right now").replace("{n}", String(viewers))}
            </span>
            <span aria-hidden>👁</span>
          </div>
        )}

        {p.showStock && !soldOut && left <= (p.lowStockAt || 5) && (
          <div className="mt-2.5">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-medium" style={{ background: "#fbf6ef", borderColor: "#e8dccb", color: ink }}>
              ⏱
              <span dir="auto">
                {say(p.lowStockText, ar ? "باقي {n} فقط — اطلبي الآن" : "Only {n} left in stock — order soon!").replace("{n}", String(left))}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e5dbcd]">
              <div className="h-full rounded-full bg-[#c0644a]" style={{ width: `${Math.max(8, Math.min(100, (left / Math.max(1, (p.lowStockAt || 5) * 2)) * 100))}%` }} />
            </div>
          </div>
        )}

        {p.showPerks && [p.perk1, p.perk2, p.perk3].some(Boolean) && (
          <div className="mt-4 grid gap-1.5">
            {[
              ["🚚", p.perk1],
              ["↩️", p.perk2],
              ["✦", p.perk3],
            ]
              .filter(([, t]) => t)
              .map(([icon, text]) => (
                <div key={text} className="flex items-center gap-2.5 text-[12px]" style={{ color: ink }}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px]" style={{ background: "#f4ebe1", color: accent }}>
                    {icon}
                  </span>
                  <span dir="auto">{text}</span>
                </div>
              ))}
          </div>
        )}

        {/* folds */}
        {p.showDescription && description && (
          <Fold
            title={say(p.descriptionTitle, ar ? "الوصف" : "Description")}
            open={openFold === "description"}
            onToggle={() => setOpenFold((f) => (f === "description" ? null : "description"))}
            line={line}
          >
            <p dir="auto" className={`whitespace-pre-line text-[13px] leading-relaxed ${more ? "" : "line-clamp-4"}`} style={{ color: muted }}>
              {description}
            </p>
            {description.length > 220 && (
              <button onClick={() => setMore((m) => !m)} className="mt-1.5 text-[12px] underline underline-offset-2" style={{ color: accent }}>
                {more ? (ar ? "أقل" : "Show less") : ar ? "اقرئي المزيد" : "Read more"}
              </button>
            )}
          </Fold>
        )}
        {p.shippingText && (
          <Fold
            title={say(p.shippingTitle, ar ? "التوصيل والاسترجاع" : "Delivery & returns")}
            open={openFold === "shipping"}
            onToggle={() => setOpenFold((f) => (f === "shipping" ? null : "shipping"))}
            line={line}
          >
            <p dir="auto" className="text-[13px] leading-relaxed" style={{ color: muted }}>
              {p.shippingText}
            </p>
          </Fold>
        )}
      </div>

      {p.showReviewsCard && p.ratingValue && (
        <div className="mx-3 mt-3 rounded-[20px] px-4 py-5 text-center" style={{ background: dark }}>
          {p.reviewsKicker && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#c98b5e" }}>
              {p.reviewsKicker}
            </div>
          )}
          <div className="mt-1.5 text-[24px] text-white" style={{ fontFamily: SERIF }}>
            {p.reviewsHeading}{" "}
            {p.reviewsItalic && <em className="italic" style={{ color: "#e6c9a8" }}>{p.reviewsItalic}</em>}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-[44px] leading-none text-white" style={{ fontFamily: SERIF }}>
              {p.ratingValue}
            </span>
            <span className="text-start">
              <span className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5" color={i < stars ? "#d9a441" : "#ffffff33"} />
                ))}
              </span>
              {p.reviewCount && (
                <span className="mt-1 block text-[12px] text-white/60">
                  {p.reviewCount} {p.reviewsWord}
                </span>
              )}
            </span>
          </div>
          {p.reviewsButton && handlers.onOpenScreen && (
            <button
              onClick={() => handlers.onOpenScreen?.("happy-customers")}
              className="mt-4 rounded-full border border-white/25 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
            >
              {p.reviewsButton} →
            </button>
          )}
        </div>
      )}

      {p.showRelated && related.length > 0 && (
        <div className="px-3 pb-4 pt-5">
          {p.relatedKicker && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
              {p.relatedKicker}
            </div>
          )}
          {p.relatedTitle && (
            <div dir="auto" className="text-[22px]" style={{ fontFamily: SERIF, color: ink }}>
              {p.relatedTitle}
            </div>
          )}
          <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1">
            {related.map((r) => {
              const d = off(r.priceMin, r.compareAt);
              return (
                <button key={r.id} onClick={() => handlers.onOpenProduct?.(r.id)} className="w-[132px] shrink-0 overflow-hidden rounded-xl border bg-white text-start" style={{ borderColor: "#eadfd2" }}>
                  <span className="relative block aspect-square bg-white">
                    {r.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
                    )}
                    {d > 0 && (
                      <span className="absolute start-1.5 top-1.5 px-1 py-px text-[9px] font-bold text-white" style={{ background: "#c0644a" }}>
                        −{d}%
                      </span>
                    )}
                  </span>
                  <span className="block px-2 pb-2 pt-1.5" style={{ background: "#f3ece4" }}>
                    <span className="block truncate text-[12px]" style={{ fontFamily: SERIF, color: ink }}>
                      {r.name}
                    </span>
                    <span className="block text-[13px] font-semibold" style={{ fontFamily: SERIF, color: accent }}>
                      {money(r.priceMin, ar)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-4" />

      {/* ---------------- the bar that stays ---------------- */}
      {handlers.onAdd && (
        <div className="sticky bottom-0 z-10 flex gap-2 border-t bg-white/95 px-3 py-2.5 backdrop-blur" style={{ borderColor: line }}>
          <button
            disabled={soldOut}
            onClick={() => {
              if (!variant) return;
              handlers.onAdd?.(variant.id, qty);
              setAdded(true);
              setTimeout(() => setAdded(false), 1600);
            }}
            className="h-12 flex-1 rounded-xl text-[12px] font-bold uppercase tracking-[0.16em] text-white transition disabled:opacity-45"
            style={{ background: added ? "#4a7858" : accent }}
          >
            {soldOut
              ? say(p.soldOutLabel, ar ? "نفد" : "Sold out")
              : added
                ? ar ? "أُضيفت ✓" : "Added ✓"
                : say(p.addLabel, ar ? "أضيفي للسلة" : "Add to cart")}
          </button>
          {p.showBuyNow && !soldOut && handlers.onBuyNow && (
            <button
              onClick={() => variant && handlers.onBuyNow?.(variant.id, qty)}
              className="h-12 flex-1 rounded-xl px-2 text-[11.5px] font-bold leading-tight text-white"
              style={{ background: dark }}
            >
              {say(p.buyNowLabel, ar ? "اشتري الآن" : "Buy now")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Fold({
  title,
  open,
  onToggle,
  line,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  line: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 border-t" style={{ borderColor: line }}>
      <button onClick={onToggle} className="flex w-full items-center justify-between py-3 text-[14px] font-semibold">
        {title}
        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}
