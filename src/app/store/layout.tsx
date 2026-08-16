"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useI18n, egp } from "@/lib/i18n";
import { CartProvider, useCart } from "./cart";
import { IcX } from "@/components/icons";

export default function StoreLayout({ children }: { children: ReactNode }) {
  // The storefront is always light (its surfaces aren't dark-themed), even when
  // the admin default is dark.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-ink">
        <StoreHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t border-line py-8 text-center text-sm text-ink-soft">
          BeautyBar · بيوتي بار — © 2026
        </footer>
        <CartDrawer />
      </div>
    </CartProvider>
  );
}

function StoreHeader() {
  const { lang, toggle } = useI18n();
  const ar = lang === "ar";
  const { count, setOpen } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/store" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-bold text-white">
            B
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">BeautyBar</span>
        </Link>
        <nav className="ms-4 hidden gap-4 text-sm text-ink-muted sm:flex">
          <Link href="/store" className="hover:text-ink">{ar ? "كل المنتجات" : "All products"}</Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={toggle} className="rounded-lg px-2.5 py-1.5 text-sm text-ink-muted hover:bg-surface-hover">
            {ar ? "EN" : "ع"}
          </button>
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
          >
            {ar ? "السلة" : "Cart"}
            {count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function CartDrawer() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { items, subtotal, setQty, remove, open, setOpen } = useCart();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={() => setOpen(false)} />
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">{ar ? "سلة التسوق" : "Your cart"}</h2>
          <button onClick={() => setOpen(false)} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-soft">
            <span className="text-4xl">🛍️</span>
            <p>{ar ? "سلتك فارغة" : "Your cart is empty"}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((i) => (
                <div key={i.itemId} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                    {i.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{i.productName}</div>
                    {i.variantTitle && <div className="text-xs text-ink-soft">{i.variantTitle}</div>}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-line">
                        <button onClick={() => setQty(i.itemId, i.quantity - 1)} className="px-2 py-0.5 text-ink-muted">−</button>
                        <span className="w-7 text-center text-sm">{i.quantity}</span>
                        <button onClick={() => setQty(i.itemId, i.quantity + 1)} disabled={i.quantity >= i.maxAvailable} className="px-2 py-0.5 text-ink-muted disabled:opacity-30">+</button>
                      </div>
                      <button onClick={() => remove(i.itemId)} className="text-xs text-rose-600">{ar ? "حذف" : "Remove"}</button>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{egp(i.price * i.quantity, lang)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-ink-muted">{ar ? "الإجمالي الفرعي" : "Subtotal"}</span>
                <span className="text-lg font-bold">{egp(subtotal, lang)}</span>
              </div>
              <Link
                href="/store/checkout"
                onClick={() => setOpen(false)}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                {ar ? "إتمام الطلب" : "Checkout"}
              </Link>
              <button onClick={() => setOpen(false)} className="mt-2 w-full py-2 text-sm text-ink-muted">
                {ar ? "متابعة التسوق" : "Continue shopping"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
