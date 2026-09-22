"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n, egp } from "@/lib/i18n";
import { CartProvider, useCart } from "./cart";
import { IcX } from "@/components/icons";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import type { Lang } from "@/lib/i18n";
import { STOREFRONT_HOME } from "@/lib/storefront";


/**
 * The theme storefront keeps the shopper's chosen language in `sf_locale`, so
 * that cookie — not this app's localStorage — is the site-wide language. Login,
 * sign up and the account pages read it here so they open in the same language
 * the shopper was just browsing in, instead of this app's Arabic default.
 */
const LOCALE_COOKIE = "sf_locale";

function writeLocaleCookie(l: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The language itself is resolved on the server (root layout reads the
  // storefront's `sf_locale`), so there is nothing to adopt here.
  // Checkout is a standalone funnel (like Shopify's): no shop nav, no footer,
  // no cart drawer — it brings its own header and order summary.
  //
  // Requests renders bare for a different reason: it is embedded inside the
  // theme's own header and footer, so a second set of chrome here would show
  // the shopper two navigations stacked on top of each other.
  // These render without the React store chrome because they are shown embedded
  // inside the theme storefront (which brings its own header/footer): checkout,
  // requests, happy-customers, and now the account + its auth pages (served at
  // /shop/account). A second header inside the frame would stack two navs.
  const bare =
    // A live takes the whole screen — the video is the page, the way it is
    // on every app people already watch lives in. A header above it would
    // be a band of nothing during the one thing they came for.
    (pathname?.startsWith("/store/live") ||
      pathname?.startsWith("/store/checkout") ||
      pathname?.startsWith("/store/requests") ||
      pathname?.startsWith("/store/happy-customers") ||
      pathname?.startsWith("/store/account") ||
      pathname?.startsWith("/store/login") ||
      pathname?.startsWith("/store/signup")) ??
    false;

  // The storefront is always light (its surfaces aren't dark-themed), even when
  // the admin default is dark.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  if (bare) {
    return (
      <CartProvider>
        <AnalyticsBeacon />
        <div className="store-theme min-h-screen">{children}</div>
      </CartProvider>
    );
  }

  return (
    <CartProvider>
      {/* Counts this visit for Analytics → Website. */}
      <AnalyticsBeacon />
      <div className="store-theme min-h-screen bg-white text-ink">
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

/**
 * The /store header, dressed to match the theme storefront's home nav: a bronze
 * announcement strip, a centred serif BEAUTY BAR wordmark, a menu button, and
 * search / account / cart icons — so moving between /shop and /store doesn't
 * feel like two different sites.
 */
function StoreHeader() {
  const { lang, setLang } = useI18n();
  const ar = lang === "ar";
  const switchLang = () => {
    const next: Lang = ar ? "en" : "ar";
    writeLocaleCookie(next);
    setLang(next);
  };
  const { count, setOpen } = useCart();
  const [menu, setMenu] = useState(false);

  const links: [string, string, string][] = [
    ["/shop", "Home", "الرئيسية"],
    ["/store", "Shop all", "كل المنتجات"],
    ["/store/account", "My Account", "حسابي"],
    ["/store/society", "Society", "سوسايتي"],
  ];
  const icon = "flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-hover";

  return (
    <header className="sticky top-0 z-30 bg-white">
      {/* Announcement strip */}
      <div className="bg-[#7a4b27] px-3 py-2 text-center text-[11px] tracking-[0.16em] text-[#f1e0cb]">
        {ar ? "شحن مجاني للطلبات فوق ٢٠٠٠ ج · اجمعي التواقيع، افتحي الامتيازات" : "FREE SHIPPING OVER 2,000 EGP · COLLECT SIGNATURES. UNLOCK PRIVILEGES."}
      </div>

      <div className="relative border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Menu */}
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label={ar ? "القائمة" : "Menu"}
            aria-expanded={menu}
            className={icon}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {/* Wordmark */}
          <Link
            href={STOREFRONT_HOME}
            aria-label={ar ? "الصفحة الرئيسية" : "Home"}
            className="absolute left-1/2 -translate-x-1/2 font-serif text-xl tracking-[0.22em] text-ink"
          >
            BEAUTY <span className="italic text-[#a46c3c]">BAR</span>
          </Link>

          {/* Right icons */}
          <div className="flex items-center gap-1">
            <button onClick={switchLang} className="rounded-full px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-hover">
              {ar ? "EN" : "ع"}
            </button>
            <Link href="/shop/search" aria-label={ar ? "بحث" : "Search"} className={icon}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
              </svg>
            </Link>
            <Link href="/store/account" aria-label={ar ? "حسابي" : "Account"} className={icon}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
            </Link>
            <button onClick={() => setOpen(true)} aria-label={ar ? "السلة" : "Cart"} className={`relative ${icon}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" />
              </svg>
              {count > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2b1b10] px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Menu dropdown */}
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <nav className="absolute z-20 mt-1 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-lg ltr:left-3 rtl:right-3">
              {links.map(([href, en, arLbl]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface-hover"
                >
                  {ar ? arLbl : en}
                </Link>
              ))}
            </nav>
          </>
        )}
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
