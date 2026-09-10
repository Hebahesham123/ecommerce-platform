"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  api,
  clearLog,
  getPhone,
  getToken,
  setToken,
  useApiLog,
  type Account,
  type PricedCart,
} from "./api";
import { Btn, Empty, Field, money, Note, Sheet, Spinner } from "./ui";
import { Enquiry, Orders, Returns, SignIn } from "./screens";
import { Shop } from "./shop";
import { AppNudge } from "@/components/app-nudge";
import { AppStrip } from "@/components/app-strip";
import { AppHeader } from "@/components/app-header";
import { AppLive } from "@/components/app-live";
import { liveSessionsOf } from "@/lib/app-theme";
import type { NudgeCampaign } from "@/lib/nudge";
import {
  DEFAULT_SCREENS,
  DEFAULT_SETTINGS,
  DEFAULT_TABS,
  TAB_DEFAULTS,
  type AppTheme,
  type ScreenSettings,
} from "@/lib/app-theme";

/**
 * A stand-in app, so the store can be shopped from an app before an app
 * exists.
 *
 * It is a real client of the Storefront API and nothing else: no server
 * actions, no shared storefront code, every request over HTTP with
 * `x-store-channel: app`. So an order placed here is an app order in every way
 * the store can tell — it appears in the App section, it reserves the same
 * stock, and it reports to the app's Meta dataset. Which is the point: the
 * whole flow can be proved end to end now, and the eventual app inherits a
 * path that is already known to work rather than one that was only ever
 * described in a document.
 *
 * The call log beside the phone is not a debugging extra. A test client that
 * fails quietly is worse than no test client, so every request and its status
 * is on screen.
 */

type Tab = "shop" | "live" | "cart" | "orders" | "account";
export type CartLine = { itemId: string; quantity: number };

/**
 * One basket, wherever the shop is being tried from.
 *
 * The theme editor's phone and this app are two windows onto the same store,
 * so a basket filled in one and empty in the other would be a lie about what
 * the shopper has. They share this key.
 */
export const CART_KEY = "app_preview_cart";

/**
 * Who this device is, for popup frequency and reporting.
 *
 * The web storefront counts a visitor the same way, so a shopper who has
 * already seen today's campaign on the site is not a fresh face here.
 */
const VISITOR_KEY = "app_preview_visitor";

function visitorId(): string {
  try {
    const found = localStorage.getItem(VISITOR_KEY);
    if (found) return found;
    const made = "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return "v-anon";
  }
}

export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function Preview() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [tab, setTab] = useState<Tab>("shop");
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<"signin" | "returns" | "enquiry" | null>(null);
  const log = useApiLog();
  const [showLog, setShowLog] = useState(false);
  // The theme arrives with /home, which the Shop tab fetches. Until it does,
  // the shell wears the defaults rather than flashing a different brand.
  const [theme, setTheme] = useState<AppTheme | null>(null);
  const brand = theme?.settings ?? DEFAULT_SETTINGS;
  const accent = brand.accent;
  const screens: ScreenSettings = theme?.screens ?? DEFAULT_SCREENS;

  // localStorage is only there after hydration, so the first paint has to be
  // the signed-out, empty-cart state or React complains about the mismatch.
  useEffect(() => {
    setPhone(getToken() ? getPhone() : null);
    setCart(readCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* private browsing */
    }
  }, [cart, ready]);

  // Only the live-now offer greets the shopper by name, and it reads fine
  // without one, so this is best effort — the shop never waits on it.
  const [shopperName, setShopperName] = useState<string | null>(null);
  useEffect(() => {
    if (!phone) return setShopperName(null);
    api.get<Account>("/me").then((r) => setShopperName(r.ok ? r.data.name : null));
  }, [phone]);

  // The smart popup the merchant built in Marketing - Smart popups. The app
  // draws the same campaign the site does rather than owning a second one.
  const [nudge, setNudge] = useState<NudgeCampaign | null>(null);
  useEffect(() => {
    api.get<{ campaign: NudgeCampaign | null }>("/nudge").then((r) => {
      if (r.ok) setNudge(r.data.campaign);
    });
  }, []);

  // The header owns the search term, because the header does not scroll away.
  const [query, setQuery] = useState("");

  const signedIn = Boolean(phone);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  const add = useCallback((itemId: string) => {
    setCart((c) => {
      const found = c.find((l) => l.itemId === itemId);
      return found
        ? c.map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...c, { itemId, quantity: 1 }];
    });
  }, []);

  // The bar the merchant arranged: their order, their wording, and only the
  // tabs they kept. An empty label means the app's own word, in this language.
  const tabs = (theme?.tabs ?? DEFAULT_TABS)
    .filter((t) => t.visible)
    .map((t) => ({
      key: t.key as Tab,
      label: t.label || TAB_DEFAULTS[t.key][ar ? "ar" : "en"],
      icon: TAB_DEFAULTS[t.key].icon,
    }));

  // A tab that has been hidden must not stay selected underneath it.
  const activeTab = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? "shop");

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ------------------------------- the phone ------------------------- */}
      <div className="mx-auto w-full max-w-[400px] shrink-0">
        <div
          className="relative flex h-[760px] flex-col overflow-hidden rounded-[2rem] border-8 border-slate-900 shadow-2xl"
          style={
            { background: brand.background, "--app-page": brand.background } as React.CSSProperties
          }
        >
          {/* status bar — the store's own name and mark, from the theme */}
          <div className="flex items-center justify-between bg-slate-900 px-4 pb-2 pt-1.5 text-[11px] font-medium text-white">
            <span className="flex items-center gap-1.5">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="h-4 w-auto" />
              ) : null}
              {brand.storeName}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] text-white"
              style={{ background: `${accent}66` }}
            >
              {ar ? "معاينة التطبيق" : "app preview"}
            </span>
          </div>

          <AppHeader
            settings={brand}
            accent={accent}
            ar={ar}
            query={query}
            onQuery={(v) => {
              setQuery(v);
              if (v) setTab("shop");
            }}
            cartCount={count}
            onBag={() => setTab("cart")}
          />

          {brand.stripEnabled && (
            <AppStrip
              items={brand.strip}
              accent={accent}
              onOpen={(item) => {
                if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
              }}
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "shop" && (
              <Shop
                ar={ar}
                onAdd={add}
                onTheme={setTheme}
                shopperName={shopperName}
                query={query}
                onQuery={setQuery}
                onLeave={(what) => (what === "cart" ? setTab("cart") : setSheet("enquiry"))}
              />
            )}
            {activeTab === "live" && (
              <AppLive
                sessions={theme ? liveSessionsOf(theme) : []}
                ar={ar}
                accent={accent}
                onOpen={(s) => {
                  if (s.url) window.open(s.url, "_blank", "noopener,noreferrer");
                }}
              />
            )}
            {activeTab === "cart" && (
              <Cart
                ar={ar}
                cart={cart}
                setCart={setCart}
                signedIn={signedIn}
                phone={phone}
                screens={screens}
                accent={accent}
                onNeedSignIn={() => setSheet("signin")}
                onPlaced={() => {
                  setCart([]);
                  setTab("orders");
                }}
              />
            )}
            {activeTab === "orders" && (
              <div className="p-4">
                <Orders ar={ar} signedIn={signedIn} />
              </div>
            )}
            {activeTab === "account" && (
              <AccountTab
                ar={ar}
                signedIn={signedIn}
                phone={phone}
                screens={screens}
                accent={accent}
                onSignIn={() => setSheet("signin")}
                onSignOut={() => {
                  setToken(null);
                  setPhone(null);
                }}
                onReturns={() => setSheet("returns")}
                onEnquiry={() => setSheet("enquiry")}
              />
            )}
          </div>

          {/* tab bar */}
          <nav className="flex border-t border-slate-200 bg-white">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition"
                style={{ color: activeTab === tb.key ? accent : "#94a3b8" }}
              >
                <span className="text-lg leading-none">{tb.icon}</span>
                {tb.label}
                {tb.key === "cart" && count > 0 && (
                  <span
                    className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: accent }}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <AppNudge
            campaign={nudge}
            ar={ar}
            onEvent={(type, extra) => {
              // Analytics riding along on someone's shopping: it must never
              // interrupt them, so nothing here is awaited or surfaced.
              api.post("/nudge", {
                campaignId: nudge?.id ?? null,
                visitorId: visitorId(),
                type,
                trigger: "dwell",
                path: "/app",
                code: extra?.code ?? null,
              });
            }}
          />

          <Sheet
            open={sheet === "signin"}
            onClose={() => setSheet(null)}
            title={ar ? "تسجيل الدخول" : "Sign in"}
          >
            <SignIn
              ar={ar}
              onDone={(p) => {
                setPhone(p);
                setSheet(null);
              }}
            />
          </Sheet>
          <Sheet
            open={sheet === "returns"}
            onClose={() => setSheet(null)}
            title={ar ? "الاسترجاع والاستبدال" : "Returns & exchanges"}
          >
            <Returns ar={ar} signedIn={signedIn} />
          </Sheet>
          <Sheet
            open={sheet === "enquiry"}
            onClose={() => setSheet(null)}
            title={ar ? "استفسار" : "Ask a question"}
          >
            <Enquiry ar={ar} />
          </Sheet>
        </div>
      </div>

      {/* ------------------------------- the log --------------------------- */}
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setShowLog((v) => !v)}
          className="mb-2 text-xs font-semibold text-ink-muted lg:pointer-events-none"
        >
          {ar ? "طلبات الواجهة" : "API calls"}{" "}
          <span className="lg:hidden">{showLog ? "▲" : "▼"}</span>
        </button>
        <div className={`${showLog ? "block" : "hidden"} lg:block`}>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs text-ink-soft">
                {ar
                  ? "كل نداء يمرّ عبر ‎/api/storefront‎ فقط"
                  : "Every call goes through /api/storefront and nothing else"}
              </span>
              <button
                onClick={clearLog}
                className="text-xs font-medium text-ink-muted hover:text-ink"
              >
                {ar ? "مسح" : "Clear"}
              </button>
            </div>
            {log.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-soft">
                {ar ? "لا شيء بعد — جرّبي التطبيق" : "Nothing yet — use the phone"}
              </p>
            ) : (
              <ul className="max-h-[660px] divide-y divide-line overflow-y-auto">
                {log.map((e) => (
                  <li key={e.id} className="flex items-center gap-2.5 px-4 py-2 text-xs" dir="ltr">
                    <span
                      className={`w-11 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold ${
                        e.method === "GET"
                          ? "bg-sky-500/10 text-sky-600"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {e.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-ink">{e.path}</span>
                    {e.error && (
                      <span className="truncate font-mono text-[11px] text-rose-600">{e.error}</span>
                    )}
                    <span className="w-12 shrink-0 text-end text-ink-soft">{e.ms}ms</span>
                    <span
                      className={`w-8 shrink-0 text-end font-mono font-semibold ${
                        e.status >= 200 && e.status < 300 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {e.status || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- cart --
export function Cart({
  ar,
  cart,
  setCart,
  signedIn,
  phone,
  screens,
  accent,
  startAtCheckout = false,
  onNeedSignIn,
  onPlaced,
}: {
  ar: boolean;
  cart: CartLine[];
  setCart: (f: (c: CartLine[]) => CartLine[]) => void;
  signedIn: boolean;
  phone: string | null;
  screens: ScreenSettings;
  accent: string;
  /** The editor opens straight onto the checkout when that page is selected. */
  startAtCheckout?: boolean;
  onNeedSignIn: () => void;
  onPlaced: () => void;
}) {
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState<{ amount: number; label: string } | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(startAtCheckout);
  const [form, setForm] = useState({
    name: "",
    governorate: "",
    city: "",
    address: "",
    note: "",
  });
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const key = useMemo(() => JSON.stringify(cart), [cart]);

  // Re-priced on every change, from the database. That is the contract the app
  // has to live with, so the preview lives with it too — including the case
  // where a line comes back smaller than it went in.
  useEffect(() => {
    if (!cart.length) return setPriced({ lines: [], subtotal: 0, itemCount: 0, removed: [] });
    api.post<PricedCart>("/cart/price", { lines: cart }).then((r) => {
      if (!r.ok) return;
      setPriced(r.data);
      // Fold the server's corrections back into the basket, so the next call
      // sends what the store actually agreed to.
      if (r.data.removed.length || r.data.lines.some((l) => l.adjusted)) {
        setCart(() => r.data.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function applyCoupon() {
    setCouponErr(null);
    setDiscount(null);
    const res = await api.post<{ ok: boolean; amount?: number; label?: string; reason?: string }>(
      "/discount",
      { code: coupon, lines: cart },
    );
    if (!res.ok) return setCouponErr(res.error);
    if (!res.data.ok) return setCouponErr(res.data.reason ?? "not_eligible");
    setDiscount({ amount: res.data.amount ?? 0, label: res.data.label ?? coupon });
  }

  async function place() {
    setBusy(true);
    setMsg(null);
    const res = await api.post<{ orderNumber: string }>("/orders", {
      lines: cart,
      customerName: form.name,
      phone: phone ?? "",
      governorate: form.governorate,
      city: form.city,
      address: form.address,
      note: form.note,
      couponCode: discount ? coupon : null,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({
        tone: "bad",
        text:
          res.error === "cart_changed"
            ? ar
              ? "تغيّر المخزون — افتحي السلة من جديد"
              : "Stock moved. Reopen the cart and try again."
            : res.error,
      });
      return;
    }
    setMsg({ tone: "good", text: `${ar ? "تم الطلب" : "Order placed"} — ${res.data.orderNumber}` });
    setCheckout(false);
    onPlaced();
  }

  if (!priced) return <Spinner />;

  const total = Math.max(0, priced.subtotal - (discount?.amount ?? 0));

  return (
    <div className="space-y-3 p-4">
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      {priced.removed.length > 0 && (
        <Note tone="warn">
          {ar
            ? "أصناف لم تعد متاحة أُزيلت من السلة."
            : "Items that are no longer for sale were dropped from the basket."}
        </Note>
      )}

      {priced.lines.length === 0 ? (
        <Empty>{screens.cart.emptyText || (ar ? "السلة فارغة" : "The basket is empty")}</Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {priced.lines.map((l) => (
              <li
                key={l.itemId}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {l.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs leading-snug text-slate-800">
                    {l.productName}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {money(l.price, ar)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StepBtn
                    label="−"
                    onClick={() =>
                      setCart((c) =>
                        c
                          .map((x) =>
                            x.itemId === l.itemId ? { ...x, quantity: x.quantity - 1 } : x,
                          )
                          .filter((x) => x.quantity > 0),
                      )
                    }
                  />
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">
                    {l.quantity}
                  </span>
                  <StepBtn
                    label="+"
                    disabled={l.quantity >= l.maxAvailable}
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.itemId === l.itemId ? { ...x, quantity: x.quantity + 1 } : x,
                        ),
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>

          {screens.cart.showCoupon && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder={screens.cart.couponLabel || (ar ? "كود الخصم" : "Discount code")}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-violet-500"
              />
              <Btn variant="outline" onClick={applyCoupon} disabled={!coupon || !signedIn}>
                {ar ? "تطبيق" : "Apply"}
              </Btn>
            </div>
            {!signedIn && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                {ar ? "الخصم يحتاج تسجيل دخول" : "Coupons need you signed in"}
              </p>
            )}
            {couponErr && (
              <p className="mt-1.5 font-mono text-[11px] text-rose-600">{couponErr}</p>
            )}
            {discount && (
              <p className="mt-1.5 text-[11px] font-medium text-emerald-700">
                {discount.label} · −{money(discount.amount, ar)}
              </p>
            )}
          </div>
          )}

          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {screens.cart.totalLabel || (ar ? "الإجمالي" : "Total")}
              </span>
              <span className="text-lg font-bold">{money(total, ar)}</span>
            </div>
            <div className="mt-3">
              {signedIn ? (
                <Btn full onClick={() => setCheckout(true)}>
                  {screens.cart.checkoutLabel || (ar ? "إتمام الطلب" : "Checkout")}
                </Btn>
              ) : (
                <Btn full onClick={onNeedSignIn}>
                  {ar ? "سجّلي الدخول للمتابعة" : "Sign in to continue"}
                </Btn>
              )}
            </div>
          </div>
        </>
      )}

      <Sheet
        open={checkout}
        onClose={() => setCheckout(false)}
        title={screens.checkout.title || (ar ? "الدفع عند الاستلام" : "Cash on delivery")}
      >
        <div className="space-y-3">
          {screens.checkout.note && (
            <p className="text-xs leading-relaxed text-slate-500">{screens.checkout.note}</p>
          )}
          <Field label={ar ? "الاسم" : "Name"} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field
            label={ar ? "رقم الموبايل" : "Phone"}
            value={phone ?? ""}
            onChange={() => {}}
            disabled
            hint={
              ar
                ? "الطلب يُسجَّل على رقم الحساب — لا يمكن تغييره."
                : "The order is filed against the signed-in number, and the server refuses anything else."
            }
          />
          <Field
            label={ar ? "المحافظة" : "Governorate"}
            value={form.governorate}
            onChange={(v) => setForm({ ...form, governorate: v })}
          />
          <Field label={ar ? "المدينة" : "City"} value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field
            label={ar ? "العنوان" : "Address"}
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
          />
          {screens.checkout.askNote && (
            <Field
              label={ar ? "ملاحظات" : "Order note"}
              value={form.note ?? ""}
              onChange={(v) => setForm({ ...form, note: v })}
            />
          )}
          <Btn full onClick={place} disabled={busy || !form.name || !form.address}>
            {busy
              ? "…"
              : `${screens.checkout.placeLabel || (ar ? "تأكيد الطلب" : "Place the order")} · ${money(total, ar)}`}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

function StepBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-sm text-slate-600 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------- account --
export function AccountTab({
  ar,
  signedIn,
  phone,
  screens,
  accent,
  onSignIn,
  onSignOut,
  onReturns,
  onEnquiry,
}: {
  ar: boolean;
  signedIn: boolean;
  phone: string | null;
  screens: ScreenSettings;
  accent: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onReturns: () => void;
  onEnquiry: () => void;
}) {
  const [me, setMe] = useState<Account | null>(null);

  useEffect(() => {
    if (!signedIn) return setMe(null);
    api.get<Account>("/me").then((r) => setMe(r.ok ? r.data : null));
  }, [signedIn]);

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {signedIn ? (
          <>
            <div className="text-sm font-bold text-slate-900">
              {me?.name || (ar ? "عميلة" : "Customer")}
            </div>
            <div className="mt-0.5 font-mono text-xs text-slate-500" dir="ltr">
              {phone}
            </div>
            {me?.address && <p className="mt-2 text-xs text-slate-600">{me.address}</p>}
            <button
              onClick={onSignOut}
              className="mt-3 text-xs font-semibold text-rose-600 hover:underline"
            >
              {ar ? "تسجيل الخروج" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {screens.account.signedOutText ||
                (ar ? "سجّلي الدخول برقم الموبايل" : "Sign in with your phone number")}
            </p>
            <div className="mt-3">
              <Btn full onClick={onSignIn}>
                {ar ? "تسجيل الدخول" : "Sign in"}
              </Btn>
            </div>
          </>
        )}
      </div>

      {screens.account.showReturns && (
        <Row
          label={
            screens.account.returnsLabel || (ar ? "الاسترجاع والاستبدال" : "Returns & exchanges")
          }
          onClick={onReturns}
        />
      )}
      {screens.account.showRequests && (
        <Row
          label={screens.account.requestsLabel || (ar ? "اسألينا" : "Ask us a question")}
          onClick={onEnquiry}
        />
      )}

      <p className="px-1 pt-2 text-[11px] leading-relaxed text-slate-400">
        {ar
          ? "هذه معاينة للتطبيق. كل ما يحدث هنا حقيقي: الطلبات تُسجَّل، والمخزون ينقص، وتظهر في قسم التطبيق بلوحة التحكم."
          : "This is a preview app. Everything here is real: orders are recorded, stock comes off the shelf, and it all shows up under App in the dashboard."}
      </p>
    </div>
  );
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-800 transition hover:border-violet-300"
    >
      {label}
      <span className="text-slate-300">›</span>
    </button>
  );
}
