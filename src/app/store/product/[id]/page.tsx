"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp, num } from "@/lib/i18n";
import { getStoreProduct, type StoreProduct, type StoreVariant } from "../../actions";
import { useCart } from "../../cart";
import { IcChevron } from "@/components/icons";
import { track } from "@/lib/shopper-client";

/**
 * A path inside this shop, and nothing else.
 *
 * `back` arrives in the address bar, where anyone can write anything. Left
 * unchecked it is an open redirect with a friendly name: a link that looks
 * like this shop and lands somewhere that is not.
 */
const SAFE_BACK = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/;

/** How far the page follows a pull from the top before letting go goes back. */
const PULL_BACK = 70;

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { add } = useCart();
  const router = useRouter();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState<StoreVariant | null>(null);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  // Only a path inside this shop: a `back` that could be any address at
  // all is an open redirect with a friendly name.
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => {
    try {
      const wanted = new URLSearchParams(window.location.search).get("back") ?? "";
      setBack(SAFE_BACK.test(wanted) ? wanted : null);
    } catch {
      setBack(null);
    }
  }, []);

  /**
   * Opened from a reel, the page is a sheet over the video: pulled down from
   * its top it goes back to the reel. Sideways is the gallery, upwards is
   * reading on, and anywhere below the top a pull is just scrolling.
   */
  const [pull, setPull] = useState(0);
  useEffect(() => {
    if (!back) return;
    // The browser's own pull-to-refresh would answer the same gesture.
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    let start: { x: number; y: number; top: boolean } | null = null;
    let travel = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, top: window.scrollY <= 0 };
      travel = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start?.top) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      travel = dy > 0 && dy > Math.abs(dx) ? dy : 0;
      setPull(Math.min(travel * 0.5, PULL_BACK * 1.4));
    };
    const onEnd = () => {
      const went = Boolean(start?.top) && travel * 0.5 >= PULL_BACK;
      start = null;
      travel = 0;
      setPull(0);
      if (went) router.push(back);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      root.style.overscrollBehaviorY = before;
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [back, router]);

  // A swipe across the photo turns to the next one, as it does in the app.
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getStoreProduct(id);
      if (res.ok) {
        setProduct(res.data);
        track("product_view", {
          productId: id,
          productName: res.data.name,
          imageUrl: res.data.image,
          value: res.data.priceMin,
        });
        setVariant(res.data.variants.find((v) => v.available > 0) ?? res.data.variants[0]);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="py-20 text-center text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  if (!product) return <div className="py-20 text-center text-ink-soft">{ar ? "المنتج غير موجود" : "Product not found"}</div>;

  const gallery = product.images.length ? product.images : product.image ? [product.image] : [];
  const price = variant?.price ?? product.priceMin;
  const compareAt = variant?.compareAt ?? null;
  const onSale = compareAt != null && price != null && compareAt > price;
  const soldOut = (variant?.available ?? 0) <= 0;

  /** Add the selected variant to the cart. Returns false if there's nothing to add. */
  function addToCart(): boolean {
    if (!variant || soldOut) return false;
    add({
      itemId: variant.id,
      productName: product!.name,
      variantTitle: variant.variantTitle,
      sku: variant.sku,
      imageUrl: product!.image,
      price: variant.price ?? 0,
      maxAvailable: variant.available,
    }, qty);
    return true;
  }


  return (
    <div
      style={{
        transform: pull ? `translateY(${pull}px)` : undefined,
        transition: pull ? "none" : "transform 0.2s ease-out",
      }}
    >
      {back && pull > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 top-3 z-10 text-center text-xs font-semibold text-ink-muted"
          style={{ opacity: Math.min(1, Math.max(0, (pull - PULL_BACK * 0.3) / (PULL_BACK * 0.7))) }}
        >
          {ar ? "↓  اتركي للرجوع إلى الريل" : "↓  Release to go back to the reel"}
        </div>
      )}
      {/* Where she came from, when she came from somewhere she was in the
          middle of. A reel is not a list you pass through. */}
      {back && (
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
          {ar ? "رجوع" : "Back"}
        </Link>
      )}

      <div className="mb-4 text-sm text-ink-soft">
        <Link href="/store" className="hover:text-ink">{ar ? "المتجر" : "Store"}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-muted">{product.category}</span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div
            className="flex aspect-square touch-pan-y items-center justify-center overflow-hidden rounded-3xl border border-line bg-surface-page"
            onTouchStart={(e) => {
              swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              const from = swipe.current;
              swipe.current = null;
              if (!from || gallery.length < 2) return;
              const dx = e.changedTouches[0].clientX - from.x;
              const dy = e.changedTouches[0].clientY - from.y;
              if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
              // Next is to the left in English and to the right in Arabic.
              const step = (dx < 0 ? 1 : -1) * (ar ? -1 : 1);
              setActive((i) => (i + step + gallery.length) % gallery.length);
            }}
          >
            {gallery[active] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gallery[active]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-6xl">🛍️</span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.map((g, i) => (
                <button
                  key={g}
                  onClick={() => setActive(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${i === active ? "border-brand-500 ring-1 ring-brand-500" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.vendor && <div className="text-sm font-medium text-brand-700">{product.vendor}</div>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{product.name}</h1>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-ink">{price != null ? egp(price, lang) : "—"}</span>
            {onSale && <span className="text-lg text-ink-soft line-through">{egp(compareAt!, lang)}</span>}
            {onSale && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                {ar ? "خصم" : "Sale"}
              </span>
            )}
          </div>

          {/* Variants */}
          {product.variants.length > 1 && (
            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-ink">{ar ? "اختاري التنويعة" : "Select option"}</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const disabled = v.available <= 0;
                  const selected = variant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      onClick={() => { setVariant(v); setQty(1); }}
                      className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                        selected ? "border-brand-600 bg-brand-50 text-brand-700"
                          : disabled ? "border-line text-ink-soft line-through opacity-50"
                          : "border-line hover:border-ink"
                      }`}
                    >
                      {v.variantTitle || (ar ? "افتراضي" : "Default")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + the Shopify product form: "Add to cart" over "Buy it now". */}
          <div className="mt-5">
            <div className="mb-3 text-sm font-medium text-ink">{ar ? "الكمية" : "Quantity"}</div>
            <div className="inline-flex items-center rounded-xl border border-line">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-2.5 text-ink-muted">−</button>
              <span className="w-10 text-center font-medium">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(variant?.available ?? 1, q + 1))} disabled={qty >= (variant?.available ?? 0)} className="px-4 py-2.5 text-ink-muted disabled:opacity-30">+</button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <button
              disabled={soldOut || !variant}
              onClick={() => addToCart()}
              className="w-full rounded-xl border border-ink bg-white py-3.5 text-base font-semibold text-ink transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {soldOut ? (ar ? "نفد المخزون" : "Sold out") : (ar ? "أضيفي إلى السلة" : "Add to cart")}
            </button>
            {!soldOut && (
              <button
                disabled={!variant}
                onClick={() => { if (addToCart()) router.push("/store/checkout"); }}
                className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {ar ? "اشتري الآن" : "Buy it now"}
              </button>
            )}
          </div>

          <div className="mt-3 text-sm text-ink-soft">
            {soldOut
              ? (ar ? "غير متوفر حالياً" : "Currently unavailable")
              : `${num(variant?.available ?? 0, lang)} ${ar ? "قطعة متاحة" : "in stock"}`}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-page px-3 py-2.5 text-sm text-ink-muted">
            🚚 {ar ? "الدفع عند الاستلام متاح · شحن لكل المحافظات" : "Cash on delivery · Nationwide shipping"}
          </div>

          {/* Description */}
          {product.description && (
            <details className="mt-5 border-t border-line pt-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
                {ar ? "الوصف" : "Description"}
                <IcChevron className="h-4 w-4 rotate-90 text-ink-soft" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{product.description}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
