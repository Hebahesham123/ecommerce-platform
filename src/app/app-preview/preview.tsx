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
  type Collection,
  type PricedCart,
  type Product,
} from "./api";
import { Btn, Empty, Field, money, Note, Sheet, Spinner } from "./ui";
import { Enquiry, Orders, Returns, SignIn } from "./screens";

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

type Tab = "shop" | "cart" | "orders" | "account";
type CartLine = { itemId: string; quantity: number };
const CART_KEY = "app_preview_cart";

function readCart(): CartLine[] {
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

  const tabs: { key: Tab; ar: string; en: string; icon: string }[] = [
    { key: "shop", ar: "المتجر", en: "Shop", icon: "◳" },
    { key: "cart", ar: "السلة", en: "Cart", icon: "◔" },
    { key: "orders", ar: "طلباتي", en: "Orders", icon: "◨" },
    { key: "account", ar: "حسابي", en: "Account", icon: "◍" },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ------------------------------- the phone ------------------------- */}
      <div className="mx-auto w-full max-w-[400px] shrink-0">
        <div className="relative flex h-[760px] flex-col overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-50 shadow-2xl">
          {/* status bar */}
          <div className="flex items-center justify-between bg-slate-900 px-4 pb-2 pt-1.5 text-[11px] font-medium text-white">
            <span>{ar ? "بيوتي بار" : "BeautyBar"}</span>
            <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] text-violet-100">
              {ar ? "معاينة التطبيق" : "app preview"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "shop" && <Shop ar={ar} onAdd={add} />}
            {tab === "cart" && (
              <Cart
                ar={ar}
                cart={cart}
                setCart={setCart}
                signedIn={signedIn}
                phone={phone}
                onNeedSignIn={() => setSheet("signin")}
                onPlaced={() => {
                  setCart([]);
                  setTab("orders");
                }}
              />
            )}
            {tab === "orders" && (
              <div className="p-4">
                <Orders ar={ar} signedIn={signedIn} />
              </div>
            )}
            {tab === "account" && (
              <AccountTab
                ar={ar}
                signedIn={signedIn}
                phone={phone}
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
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  tab === tb.key ? "text-violet-700" : "text-slate-400"
                }`}
              >
                <span className="text-lg leading-none">{tb.icon}</span>
                {ar ? tb.ar : tb.en}
                {tb.key === "cart" && count > 0 && (
                  <span className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>

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

// ------------------------------------------------------------------- shop --
function Shop({ ar, onAdd }: { ar: boolean; onAdd: (itemId: string) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<Product | null>(null);

  useEffect(() => {
    api.get<{ collections: Collection[] }>("/collections").then((r) => {
      if (r.ok) setCollections(r.data.collections.slice(0, 12));
    });
  }, []);

  useEffect(() => {
    setProducts(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    // toString() rather than params.size — Safari only grew `size` in 17, and
    // this is meant to be opened on a phone.
    const query = params.toString();
    const t = setTimeout(() => {
      api
        .get<{ products: Product[] }>(`/products${query ? `?${query}` : ""}`)
        .then((r) => setProducts(r.ok ? r.data.products.slice(0, 40) : []));
    }, 300);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div className="p-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={ar ? "ابحثي…" : "Search…"}
        className="h-10 w-full rounded-full border border-slate-300 bg-white px-4 text-sm outline-none focus:border-violet-500"
      />

      {collections.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip on={!category} onClick={() => setCategory("")} label={ar ? "الكل" : "All"} />
          {collections.map((c) => (
            <Chip
              key={c.handle}
              on={category === c.handle}
              onClick={() => setCategory(category === c.handle ? "" : c.handle)}
              label={c.name.split(">").pop()!.trim()}
            />
          ))}
        </div>
      )}

      {!products ? (
        <Spinner />
      ) : products.length === 0 ? (
        <Empty>{ar ? "لا توجد نتائج" : "Nothing found"}</Empty>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-start transition hover:border-violet-300"
            >
              <div className="aspect-square bg-slate-100">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <div className="line-clamp-2 text-xs leading-snug text-slate-800">{p.name}</div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {p.priceMin != null ? money(p.priceMin, ar) : "—"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        <div className="space-y-3">
          {open?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.image} alt="" className="h-44 w-full rounded-2xl object-cover" />
          )}
          <ul className="space-y-2">
            {(open?.variants ?? []).map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-900">
                    {v.variantTitle ?? (ar ? "الأساسي" : "Default")}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400" dir="ltr">
                    {v.id}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.price != null ? money(v.price, ar) : "—"} · {ar ? "متاح" : "in stock"}{" "}
                    {v.available}
                  </div>
                </div>
                <Btn
                  onClick={() => {
                    onAdd(v.id);
                    setOpen(null);
                  }}
                  disabled={v.available <= 0 || v.price == null}
                >
                  {ar ? "أضيفي" : "Add"}
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
        on ? "bg-violet-600 text-white" : "border border-slate-300 bg-white text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

// ------------------------------------------------------------------- cart --
function Cart({
  ar,
  cart,
  setCart,
  signedIn,
  phone,
  onNeedSignIn,
  onPlaced,
}: {
  ar: boolean;
  cart: CartLine[];
  setCart: (f: (c: CartLine[]) => CartLine[]) => void;
  signedIn: boolean;
  phone: string | null;
  onNeedSignIn: () => void;
  onPlaced: () => void;
}) {
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState<{ amount: number; label: string } | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [form, setForm] = useState({ name: "", governorate: "", city: "", address: "" });
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
        <Empty>{ar ? "السلة فارغة" : "The basket is empty"}</Empty>
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

          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder={ar ? "كود الخصم" : "Discount code"}
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

          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{ar ? "الإجمالي" : "Total"}</span>
              <span className="text-lg font-bold">{money(total, ar)}</span>
            </div>
            <div className="mt-3">
              {signedIn ? (
                <Btn full onClick={() => setCheckout(true)}>
                  {ar ? "إتمام الطلب" : "Checkout"}
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
        title={ar ? "الدفع عند الاستلام" : "Cash on delivery"}
      >
        <div className="space-y-3">
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
          <Btn full onClick={place} disabled={busy || !form.name || !form.address}>
            {busy ? "…" : `${ar ? "تأكيد" : "Place the order"} · ${money(total, ar)}`}
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
function AccountTab({
  ar,
  signedIn,
  phone,
  onSignIn,
  onSignOut,
  onReturns,
  onEnquiry,
}: {
  ar: boolean;
  signedIn: boolean;
  phone: string | null;
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
              {ar ? "سجّلي الدخول برقم الموبايل" : "Sign in with your phone number"}
            </p>
            <div className="mt-3">
              <Btn full onClick={onSignIn}>
                {ar ? "تسجيل الدخول" : "Sign in"}
              </Btn>
            </div>
          </>
        )}
      </div>

      <Row label={ar ? "الاسترجاع والاستبدال" : "Returns & exchanges"} onClick={onReturns} />
      <Row label={ar ? "اسألينا" : "Ask us a question"} onClick={onEnquiry} />

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
