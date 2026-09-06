"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Collection,
  type Home,
  type LinkTarget,
  type Menu,
  type MenuItem,
  type Product,
  type ProductCard,
} from "./api";
import { Btn, Empty, money, Note, Sheet, Spinner } from "./ui";
import { Reviews } from "./reviews";
import { AppHome } from "@/components/app-home";

/**
 * The shopping half of the preview.
 *
 * It is built entirely out of the merchant's own merchandising: the
 * collections they curated, in the order they set, under the names they chose,
 * and the menus they built in Navigation. Nothing here invents a category or
 * hardcodes a row — if the app's front page is wrong, the fix is in the
 * dashboard, which is the point.
 */

type View =
  | { kind: "home" }
  | { kind: "collection"; handle: string; title: string }
  | { kind: "search"; q: string };

const SORTS = [
  { key: "manual", ar: "المختارة", en: "Featured" },
  { key: "newest", ar: "الأحدث", en: "Newest" },
  { key: "price-ascending", ar: "الأقل سعراً", en: "Price ↑" },
  { key: "price-descending", ar: "الأعلى سعراً", en: "Price ↓" },
];

export function Shop({
  ar,
  onAdd,
  onLeave,
  onTheme,
}: {
  ar: boolean;
  onAdd: (itemId: string) => void;
  /** Targets that belong to another tab or another sheet the shell owns. */
  onLeave: (what: "cart" | "requests") => void;
  /** The shell wears the brand too, and /home is where it arrives. */
  onTheme?: (settings: Home["theme"]["settings"]) => void;
}) {
  const [home, setHome] = useState<Home | null>(null);
  const [homeErr, setHomeErr] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [q, setQ] = useState("");
  // Listings hand back cards, so opening one fetches the product it stands
  // for — which is exactly when the shopper wants to know what is left in
  // their size, and exactly when it is worth the round trip.
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [page, setPage] = useState<"reviews" | "happy-customers" | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);

  const loadHome = useCallback(() => {
    setHomeErr(null);
    api.get<Home>("/home").then((r) => {
      if (!r.ok) return setHomeErr(r.error);
      setHome(r.data);
      onTheme?.(r.data.theme.settings);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadHome, [loadHome]);

  // Searching is a view of its own, debounced so a five-letter word is one
  // request rather than five.
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(() => {
      setView(term ? { kind: "search", q: term } : { kind: "home" });
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  /**
   * Every menu item goes somewhere.
   *
   * The first version quietly ignored the targets it had no screen for, so
   * three items in the merchant's own menu — Reviews, Requests, Happy
   * Customers — did nothing when tapped and said "external" while doing it.
   * A link that does nothing is worse than one that admits it cannot help,
   * so the fallback below now says so out loud.
   */
  function go(target: LinkTarget) {
    setMenu(null);
    switch (target.type) {
      case "collection": {
        const found = home?.collections.find((c) => c.handle === target.handle);
        setView({
          kind: "collection",
          handle: target.handle,
          title: found?.title ?? target.handle,
        });
        return;
      }
      case "home":
        setQ("");
        setView({ kind: "home" });
        return;
      case "search":
        setQ("");
        setView({ kind: "home" });
        return;
      case "cart":
        onLeave("cart");
        return;
      case "product":
        // /products/{id} takes a handle as happily as a variant id.
        setOpen(target.handle);
        return;
      case "page":
        if (target.handle === "requests") return onLeave("requests");
        if (target.handle === "reviews" || target.handle === "happy-customers") {
          return setPage(target.handle);
        }
        setUnsupported(target.handle);
        return;
      case "url":
        window.open(target.url, "_blank", "noopener");
        return;
    }
  }

  const mainMenu =
    home?.menus.find((m) => m.handle === home.theme.settings.menuHandle) ??
    home?.menus[0] ??
    null;

  return (
    <div>
      {home?.theme.settings.announcementEnabled && home.theme.settings.announcement && (
        <div
          className="px-3 py-1.5 text-center text-[11px] font-medium text-white"
          style={{ background: home.theme.settings.accent }}
        >
          {home.theme.settings.announcement}
        </div>
      )}
      <div className="p-4">
      <div className="flex items-center gap-2">
        {mainMenu && (
          <button
            onClick={() => setMenu(mainMenu)}
            aria-label={ar ? "القائمة" : "Menu"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600"
          >
            ☰
          </button>
        )}
        {home?.theme.settings.showSearch !== false && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحثي…" : "Search…"}
            className="h-10 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm outline-none focus:border-violet-500"
          />
        )}
      </div>

      {homeErr ? (
        <Failed ar={ar} error={homeErr} onRetry={loadHome} />
      ) : !home ? (
        <Spinner />
      ) : view.kind === "home" ? (
        <HomeView ar={ar} home={home} onOpenCollection={(c) => go({ type: "collection", handle: c.handle })} onOpen={(p) => setOpen(p.id)} />
      ) : (
        <ListView
          ar={ar}
          view={view}
          onBack={() => {
            setQ("");
            setView({ kind: "home" });
          }}
          onOpen={(p) => setOpen(p.id)}
        />
      )}

      <Sheet open={Boolean(menu)} onClose={() => setMenu(null)} title={menu?.title ?? ""}>
        <MenuTree items={menu?.items ?? []} onPick={go} ar={ar} />
      </Sheet>

      <Sheet
        open={Boolean(page)}
        onClose={() => setPage(null)}
        title={
          page === "happy-customers"
            ? ar ? "عملاء سعداء" : "Happy customers"
            : ar ? "التقييمات" : "Reviews"
        }
      >
        <Reviews ar={ar} featuredOnly={page === "happy-customers"} />
      </Sheet>

      <Sheet
        open={Boolean(unsupported)}
        onClose={() => setUnsupported(null)}
        title={unsupported ?? ""}
      >
        <Note tone="warn">
          {ar
            ? "هذه صفحة على الموقع لا يوجد لها شاشة في التطبيق بعد."
            : "This is a page on the website that the app has no screen for yet. It is in your menu, so either the app needs one or the item belongs only on the website."}
        </Note>
      </Sheet>

      <ProductSheet ar={ar} productId={open} onClose={() => setOpen(null)} onAdd={onAdd} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- home --
/**
 * The front page, drawn from the theme.
 *
 * Nothing here decides what the home screen contains — the merchant does, in
 * the theme editor, and this renders exactly what they arranged with the same
 * component their live preview used. Unfinished blocks are skipped: a grey box
 * saying "banner with no image" belongs in the editor, not in front of a
 * shopper.
 */
function HomeView({
  ar,
  home,
  onOpenCollection,
  onOpen,
}: {
  ar: boolean;
  home: Home;
  onOpenCollection: (c: Collection) => void;
  onOpen: (p: ProductCard) => void;
}) {
  return (
    <div className="mt-3">
      <AppHome
        theme={home.theme}
        ar={ar}
        data={{
          collections: home.collections,
          rows: home.rows,
          newArrivals: home.newArrivals,
          reviews: home.reviews,
        }}
        handlers={{
          onOpenCollection: (handle, title) =>
            onOpenCollection({
              handle,
              title,
              description: null,
              image: null,
              productCount: 0,
            }),
          onOpenProduct: (id) => onOpen({ id } as ProductCard),
        }}
      />
    </div>
  );
}

// ------------------------------------------------------- collection/search --
function ListView({
  ar,
  view,
  onBack,
  onOpen,
}: {
  ar: boolean;
  view: Extract<View, { kind: "collection" | "search" }>;
  onBack: () => void;
  onOpen: (p: ProductCard) => void;
}) {
  const [products, setProducts] = useState<ProductCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("manual");

  const key = view.kind === "collection" ? view.handle : view.q;
  const load = useCallback(() => {
    setProducts(null);
    setError(null);
    const path =
      view.kind === "collection"
        ? `/collections/${encodeURIComponent(view.handle)}?limit=40&sort=${sort}`
        : `/products?limit=40&q=${encodeURIComponent(view.q)}`;
    api.get<{ products: ProductCard[]; total?: number; count?: number }>(path).then((r) => {
      // A call that failed is not a collection with nothing in it. Showing
      // "Nothing found" for a network error tells the merchant their shop is
      // empty when what actually happened is that nobody answered.
      if (!r.ok) return setError(r.error);
      setProducts(r.data.products);
      setTotal(r.data.total ?? r.data.count ?? r.data.products.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sort, view.kind]);
  useEffect(load, [load]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm font-semibold text-violet-700">
          ‹ {ar ? "رجوع" : "Back"}
        </button>
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
          {view.kind === "collection" ? view.title : `"${view.q}"`}
        </h3>
        <span className="shrink-0 text-[11px] text-slate-500">{total}</span>
      </div>

      {view.kind === "collection" && (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                sort === s.key
                  ? "bg-violet-600 text-white"
                  : "border border-slate-300 bg-white text-slate-600"
              }`}
            >
              {ar ? s.ar : s.en}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <Failed ar={ar} error={error} onRetry={load} />
      ) : !products ? (
        <Spinner />
      ) : products.length === 0 ? (
        <Empty>{ar ? "لا توجد نتائج" : "Nothing found"}</Empty>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-start transition hover:border-violet-300"
            >
              <Thumb src={p.image} className="aspect-square" />
              <div className="p-2">
                <div className="line-clamp-2 text-xs leading-snug text-slate-800">{p.name}</div>
                <Price ar={ar} p={p} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ menu ---
function MenuTree({
  items,
  onPick,
  ar,
  depth = 0,
}: {
  items: MenuItem[];
  onPick: (t: LinkTarget) => void;
  ar: boolean;
  depth?: number;
}) {
  if (!items.length) return <Empty>{ar ? "القائمة فارغة" : "This menu is empty"}</Empty>;
  return (
    <ul className={depth ? "ms-4 border-s border-slate-200 ps-3" : "space-y-1"}>
      {items.map((item, i) => (
        <li key={`${item.title}-${i}`}>
          <button
            onClick={() => onPick(item.target)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm text-slate-800 hover:bg-slate-50"
          >
            <span className="min-w-0 truncate">{item.title}</span>
            {item.target.type === "url" && (
              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                {ar ? "رابط خارجي" : "external link"}
              </span>
            )}
          </button>
          {item.children.length > 0 && (
            <MenuTree items={item.children} onPick={onPick} ar={ar} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------- product ---
function ProductSheet({
  ar,
  productId,
  onClose,
  onAdd,
}: {
  ar: boolean;
  productId: string | null;
  onClose: () => void;
  onAdd: (itemId: string) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setProduct(null);
    setError(null);
    if (!productId) return;
    api.get<Product>(`/products/${encodeURIComponent(productId)}`).then((r) => {
      if (r.ok) setProduct(r.data);
      else setError(r.error);
    });
  }, [productId]);
  useEffect(load, [load]);

  return (
    <Sheet open={Boolean(productId)} onClose={onClose} title={product?.name ?? "…"}>
      {error ? (
        <Failed ar={ar} error={error} onRetry={load} />
      ) : !product ? (
        <Spinner />
      ) : (
      <div className="space-y-3">
        {product?.image && <Thumb src={product.image} className="h-44 w-full" />}
        {product?.description && (
          <p className="line-clamp-4 text-xs leading-relaxed text-slate-600">
            {product.description.replace(/<[^>]*>/g, " ").trim()}
          </p>
        )}
        <ul className="space-y-2">
          {(product?.variants ?? []).map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
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
                  onClose();
                }}
                disabled={v.available <= 0 || v.price == null}
              >
                {ar ? "أضيفي" : "Add"}
              </Btn>
            </li>
          ))}
        </ul>
      </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- pieces ---

/**
 * What went wrong, in the words the API used, with a way to try again.
 *
 * The error code is shown rather than hidden behind "something went wrong":
 * this screen exists to test an API, and the person reading it is the person
 * who can act on `not_found` or `Failed to fetch`.
 */
function Failed({
  ar,
  error,
  onRetry,
}: {
  ar: boolean;
  error: string;
  onRetry: () => void;
}) {
  const offline = /failed to fetch|networkerror|load failed/i.test(error);
  return (
    <div className="mt-4 space-y-3">
      <Note tone="bad">
        <div className="font-semibold">
          {ar ? "لم نستطع تحميل هذه الشاشة" : "Couldn't load this screen"}
        </div>
        <code className="mt-1 block font-mono text-[11px]" dir="ltr">
          {error}
        </code>
        {offline && (
          <p className="mt-1.5">
            {ar
              ? "الخادم لم يردّ. لو كنتِ تشغّلين الموقع محلياً، أعيدي تشغيل npm run dev — المسارات الجديدة لا تُسجَّل أحياناً دون ذلك."
              : "The server didn't answer at all. If you're running locally, restart npm run dev — Next doesn't always pick up a newly added route folder."}
          </p>
        )}
      </Note>
      <Btn variant="outline" full onClick={onRetry}>
        {ar ? "إعادة المحاولة" : "Try again"}
      </Btn>
    </div>
  );
}
function Thumb({ src, className = "" }: { src: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-slate-100 ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function Price({ ar, p }: { ar: boolean; p: ProductCard }) {
  return (
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="text-sm font-bold text-slate-900">
        {p.priceMin != null ? money(p.priceMin, ar) : "—"}
      </span>
      {p.compareAt != null && p.priceMin != null && p.compareAt > p.priceMin && (
        <span className="text-[10px] text-slate-400 line-through">{money(p.compareAt, ar)}</span>
      )}
    </div>
  );
}
