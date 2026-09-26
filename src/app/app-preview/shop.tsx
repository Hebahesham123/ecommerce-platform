"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { AppHome, type HomeData } from "@/components/app-home";
import { AppPageView } from "@/components/app-page";
import { CollectionPage, ProductPage, type ScreenHandlers } from "@/components/app-screens";

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
  /** Every department the shop has, built from the catalogue itself. */
  | { kind: "collections" }
  | { kind: "collection"; handle: string; title: string }
  | { kind: "page"; handle: string }
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
  wishlist,
  onToggleWish,
  onLeave,
  onTheme,
  shopperName,
  recommended,
  query,
  onQuery,
  openCollection,
  openProduct,
  openPage,
  openMenu,
  onScreen,
}: {
  ar: boolean;
  onAdd: (itemId: string) => void;
  /** The saved list and its toggle, owned by the shell so every tab agrees. */
  wishlist?: readonly { id: string }[];
  onToggleWish?: (card: { id: string; name: string; priceMin: number | null; image: string | null }) => void;
  /** The header asking for the menu, carried with the moment it was asked for. */
  openMenu?: { at: number } | null;
  /** Targets that belong to another tab or another sheet the shell owns. */
  onLeave: (what: "cart" | "requests") => void;
  /** The shell wears the brand too, and /home is where it arrives. */
  onTheme?: (theme: Home["theme"]) => void;
  /** Only the live-now offer uses it, and it reads fine without one. */
  shopperName?: string | null;
  /** What goes with this shopper's past orders; null hides the section. */
  recommended?: HomeData["recommended"];
  /**
   * When the app header draws the search field, it owns the term too and the
   * one in here stands down — two boxes searching the same shop is one box
   * too many.
   */
  query?: string;
  onQuery?: (v: string) => void;
  /**
   * A collection the shell wants opened — the shortcut strip taps this.
   *
   * It carries the moment it was asked for rather than only a handle, so
   * tapping the same chip twice reopens it instead of looking broken.
   */
  openCollection?: { handle: string; at: number } | null;
  /** A product the shell wants opened, carried the same way. */
  openProduct?: { id: string; at: number } | null;
  /** One of this shop's pages - reviews, happy customers, requests. */
  openPage?: { handle: string; at: number } | null;
  /**
   * A link that points at a whole screen rather than at something in the
   * shop. Only the shell knows which tab that is, so it decides.
   */
  onScreen?: (screen: string) => void;
}) {
  const [home, setHome] = useState<Home | null>(null);
  const [homeErr, setHomeErr] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [ownQ, setOwnQ] = useState("");
  const q = query ?? ownQ;
  const setQ: (v: string) => void = onQuery ?? setOwnQ;
  // Listings hand back cards, so opening one fetches the product it stands
  // for — which is exactly when the shopper wants to know what is left in
  // their size, and exactly when it is worth the round trip.
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  // How far into the menu the shopper has walked: one item per screen down.
  const [trail, setTrail] = useState<MenuItem[]>([]);
  const [page, setPage] = useState<"reviews" | "happy-customers" | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);

  const loadHome = useCallback(() => {
    setHomeErr(null);
    api.get<Home>("/home").then((r) => {
      if (!r.ok) return setHomeErr(r.error);
      setHome(r.data);
      onTheme?.(r.data.theme);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadHome, [loadHome]);

  // A chip in the header strip asking for a collection. The title is looked up
  // here because this is where the catalogue already is; an unknown handle
  // still opens, headed by the handle itself, rather than doing nothing.
  const lastOpened = useRef(0);
  useEffect(() => {
    const req = openCollection;
    if (!req?.handle || req.at === lastOpened.current) return;
    lastOpened.current = req.at;
    const found = home?.collections.find((c) => c.handle === req.handle);
    setView({ kind: "collection", handle: req.handle, title: found?.title ?? req.handle });
  }, [openCollection, home]);

  // The header's menu button, which lives outside this component.
  const lastMenu = useRef(0);
  useEffect(() => {
    const req = openMenu;
    if (!req || req.at === lastMenu.current) return;
    lastMenu.current = req.at;
    if (mainMenu) {
      setTrail([]);
      setMenu(mainMenu);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMenu]);

  const lastProduct = useRef(0);
  useEffect(() => {
    const req = openProduct;
    if (!req?.id || req.at === lastProduct.current) return;
    lastProduct.current = req.at;
    setOpen(req.id);
  }, [openProduct]);

  // Pages go through the same door menu items use, so a link to Reviews and
  // a menu item pointing at Reviews land in exactly the same place.
  const lastPage = useRef(0);
  useEffect(() => {
    const req = openPage;
    if (!req?.handle || req.at === lastPage.current) return;
    lastPage.current = req.at;
    if (req.handle === "collections") return setView({ kind: "collections" });
    if (req.handle === "requests") return onLeave("requests");
    if (req.handle === "reviews" || req.handle === "happy-customers") return setPage(req.handle);
    // One of the merchant's own pages — For Her, For Him — which are screens
    // rather than sheets: they are somewhere you go, not something that
    // covers where you are.
    const own = home?.theme.settings.pages?.find((p) => p.handle === req.handle);
    if (own) setView({ kind: "page", handle: own.handle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPage]);

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

  // What the collection and product screens may do: open things, add to the
  // bag (as many as the shopper chose), buy now, and keep the wishlist.
  const screenHandlers: ScreenHandlers = {
    onOpenProduct: (id) => setOpen(id),
    onOpenScreen: (screen) => onScreen?.(screen),
    onAdd: (itemId, quantity) => {
      for (let i = 0; i < quantity; i++) onAdd(itemId);
    },
    onBuyNow: (itemId, quantity) => {
      for (let i = 0; i < quantity; i++) onAdd(itemId);
      setOpen(null);
      onLeave("cart");
    },
    onToggleWishlist: onToggleWish,
    wishlist: wishlist?.map((w) => w.id),
  };

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
      {/* The menu and search live in the header, as they do on the website, so
          the home screen starts flush under the shortcuts. Only the padding
          down the sides is the page's to give. */}
      <div
        className={`${open ? "hidden " : ""}${view.kind === "home" ? "px-4 pb-4" : "p-4"}`}
      >
      {homeErr ? (
        <Failed ar={ar} error={homeErr} onRetry={loadHome} />
      ) : !home ? (
        <Spinner />
      ) : view.kind === "home" ? (
        <HomeView
          ar={ar}
          home={home}
          onOpenCollection={(c) => go({ type: "collection", handle: c.handle })}
          onOpen={(p) => setOpen(p.id)}
          onScreen={onScreen}
          shopperName={shopperName}
          recommended={recommended}
          onAdd={onAdd}
          wishlist={wishlist}
          onToggleWish={onToggleWish}
        />
      ) : view.kind === "collections" ? (
        <AppPageView
          page={{
            id: "all-collections",
            handle: "collections",
            kicker: "",
            line1: "",
            line2: ar ? "كل الأقسام" : "All collections",
            layout: "circles",
            // The catalogue is the list; keeping a second one by hand would
            // only ever be out of date.
            items: home.collections.map((c) => ({
              id: c.handle,
              imageUrl: c.image ?? "",
              label: c.title,
              handle: c.handle,
              url: "",
              productId: "",
              screen: "",
            })),
          }}
          settings={home.theme.settings}
          ar={ar}
          onBack={() => setView({ kind: "home" })}
          onOpen={(tile) => go({ type: "collection", handle: tile.handle })}
        />
      ) : view.kind === "page" ? (
        (() => {
          const page = home.theme.settings.pages?.find((p) => p.handle === view.handle);
          if (!page) return <Failed ar={ar} error="page_not_found" onRetry={loadHome} />;
          return (
            <AppPageView
              page={page}
              settings={home.theme.settings}
              ar={ar}
              onBack={() => setView({ kind: "home" })}
              onOpen={(tile) => {
                if (tile.url) return window.open(tile.url, "_blank", "noopener,noreferrer");
                if (tile.productId) return setOpen(tile.productId);
                if (tile.screen) return onScreen?.(tile.screen);
                if (tile.handle) go({ type: "collection", handle: tile.handle });
              }}
            />
          );
        })()
      ) : view.kind === "collection" ? (
        <div className="-mx-4 -mb-4 -mt-4">
          <CollectionPage
            key={view.handle}
            handle={view.handle}
            title={view.title}
            settings={home.theme.screens.collection}
            ar={ar}
            handlers={{
              ...screenHandlers,
              onBack: () => {
                setQ("");
                setView({ kind: "home" });
              },
            }}
          />
        </div>
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
      </div>

      <Sheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={trail.length ? trail[trail.length - 1].title : (menu?.title ?? "")}
      >
        <MenuPanel
          items={trail.length ? trail[trail.length - 1].children : (menu?.items ?? [])}
          parent={trail.length ? trail[trail.length - 1] : null}
          under={trail.length > 1 ? trail[trail.length - 2].title : (menu?.title ?? "")}
          ar={ar}
          onPick={go}
          onInto={(item) => setTrail((t) => [...t, item])}
          onBack={() => setTrail((t) => t.slice(0, -1))}
        />
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

      {/* A product takes the place of the shop's content rather than covering
          the phone. The header and the tab bar are the app's own chrome, and a
          shopper wants the search, the wishlist and the bag from here as much
          as from anywhere else. */}
      {open && home && (
        <div className="bg-white">
          <ProductPage
            key={open}
            id={open}
            settings={home.theme.screens.product}
            ar={ar}
            crumb={view.kind === "collection" ? view.title : undefined}
            handlers={{ ...screenHandlers, onBack: () => setOpen(null) }}
            extras={
              <AppHome
                theme={home.theme}
                data={home}
                ar={ar}
                where="product"
                handlers={{
                  onOpenCollection: (handle) => go({ type: "collection", handle }),
                  onOpenProduct: (id) => setOpen(id),
                  onOpenScreen: (screen) =>
                    screen === "cart" || screen === "requests" ? onLeave(screen) : undefined,
                }}
              />
            }
          />
        </div>
      )}
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
  onScreen,
  shopperName,
  recommended,
  onAdd,
  wishlist,
  onToggleWish,
}: {
  ar: boolean;
  home: Home;
  recommended?: HomeData["recommended"];
  onOpenCollection: (c: Collection) => void;
  onOpen: (p: ProductCard) => void;
  onScreen?: (screen: string) => void;
  shopperName?: string | null;
  onAdd?: (itemId: string) => void;
  wishlist?: readonly { id: string }[];
  onToggleWish?: (card: { id: string; name: string; priceMin: number | null; image: string | null }) => void;
}) {
  return (
    <div>
      <AppHome
        theme={home.theme}
        ar={ar}
        data={{
          collections: home.collections,
          rows: home.rows,
          newArrivals: home.newArrivals,
          reviews: home.reviews,
          lives: home.lives,
          shopperName,
          // Never undefined here: undefined is the editor's "draw a sample".
          recommended: recommended ?? null,
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
          onOpenScreen: (screen) => onScreen?.(screen),
          onAddToCart: onAdd ? (variantId) => onAdd(variantId) : undefined,
          onToggleWishlist: onToggleWish,
          wishlist: wishlist?.map((w) => w.id),
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
/**
 * The menu, one level at a time.
 *
 * Opened whole, this tree is a wall: Bags alone brings eleven children and
 * three grandchildren, so Footwear — the second section of six — began four
 * screens down. The drawer now shows the sections and nothing else, and the
 * plus beside one opens its contents as a screen of their own, the way the
 * website's does.
 *
 * The wording is still a link in its own right. Someone who wants Bags rather
 * than a choice of bags taps the name; the plus is a separate target for
 * going deeper, which also keeps the two apart under a thumb.
 */
function MenuPanel({
  items,
  parent,
  under,
  ar,
  onPick,
  onInto,
  onBack,
}: {
  items: MenuItem[];
  /** The item whose children these are, or null at the top of the menu. */
  parent: MenuItem | null;
  /** What the screen behind this one is called, for the way back. */
  under: string;
  ar: boolean;
  onPick: (t: LinkTarget) => void;
  onInto: (item: MenuItem) => void;
  onBack: () => void;
}) {
  if (!items.length) return <Empty>{ar ? "القائمة فارغة" : "This menu is empty"}</Empty>;
  return (
    <div>
      {parent && (
        <button
          onClick={onBack}
          className="mb-2 flex w-full items-center gap-1.5 text-start text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="min-w-0 truncate">{under}</span>
        </button>
      )}

      {/* The hairlines run to the drawer's edges, as the website's do. */}
      <ul className="-mx-4 divide-y divide-slate-200 border-y border-slate-200 px-4">
        {/* The section you walked into is a destination too, and losing it
            would mean no way to see everything in it. */}
        {parent && parent.target.type !== "home" && (
          <li>
            <button
              onClick={() => onPick(parent.target)}
              className="w-full truncate py-3.5 text-start text-[13px] font-semibold text-slate-900"
            >
              {ar ? `كل ${parent.title}` : `All ${parent.title}`}
            </button>
          </li>
        )}
        {items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="flex items-center gap-2">
            <button
              onClick={() => onPick(item.target)}
              className="flex min-w-0 flex-1 items-center gap-2 py-3.5 text-start text-[13px] text-slate-800"
            >
              <span className="min-w-0 truncate">{item.title}</span>
              {item.target.type === "url" && (
                <span className="shrink-0 text-[10px] font-medium text-slate-400">
                  {ar ? "رابط خارجي" : "external link"}
                </span>
              )}
            </button>
            {item.children.length > 0 && (
              <button
                onClick={() => onInto(item)}
                aria-label={ar ? `افتحي ${item.title}` : `Open ${item.title}`}
                className="my-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
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
