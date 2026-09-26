"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui";
import {
  IcChevron,
  IcCode,
  IcDesktop,
  IcMobile,
  IcPlus,
  IcTrash,
  IcUp,
  IcDown,
  IcAlert,
  IcUndo,
  IcRedo,
} from "@/components/icons";
import { AppHome, type HomeData } from "@/components/app-home";
import { CollectionPage, ProductPage, type ScreenHandlers } from "@/components/app-screens";
import { AppStrip } from "@/components/app-strip";
import { AppPageView } from "@/components/app-page";
import { AppSplash } from "@/components/app-splash";
import { AppLive } from "@/components/app-live";
import { AppHeader } from "@/components/app-header";
import { ColorPicker, ImageUpload, LinkPicker } from "@/components/pickers";
import {
  BLOCK_META,
  ITEM_FIELDS,
  ITEM_SHAPE,
  itemId,
  itemsOf,
  liveSessionsOf, liveSessionsFromLives,
  newBlock,
  normalizeTheme,
  type AppTheme,
  type Block,
  type BlockType,
  type Item,
  type StripItem,
} from "@/lib/app-theme";
import { componentName } from "@/lib/app-theme-codegen";
import {
  SCREEN_KEYS,
  type TabKey,
  SCREEN_LABELS,
  TAB_DEFAULTS,
  type ScreenKey,
  type ScreenSettings,
  type Tab as ThemeTab,
} from "@/lib/app-theme";
import { ScreenPanel, TabsPanel } from "./screen-panels";
import { historyReducer, type Update } from "./history";
import {
  AccountTab,
  Cart,
  CART_KEY,
  readCart,
  readWishlist,
  Saved,
  WISHLIST_KEY,
  type CartLine,
  type Wish,
} from "@/app/app-preview/preview";
import { Orders, SignIn } from "@/app/app-preview/screens";
import { Sheet } from "@/app/app-preview/ui";
import { getPhone, getToken, setToken } from "@/app/app-preview/api";
import { loadThemeEditor, saveTheme, type ThemeEditorData } from "./actions";

/**
 * The app's theme editor.
 *
 * Built to the same shape as the website's customizer — a 380px rail of
 * collapsible sections beside a live preview, a device switch, Reset, and an
 * explicit Save — because the merchant already knows that shape and should not
 * have to learn a second one for the same job.
 *
 * The difference is what sits behind it. A website theme arrives as a folder
 * of Liquid, so its customizer *overrides* code that already exists and every
 * section row links to the file you would fix. An app has no such folder: the
 * screens do not exist until somebody writes them. So here, arranging a
 * section is what writes them — the code link opens what this editor just
 * generated rather than something you have to maintain.
 *
 * The phone is the app's own home-screen renderer, not a mock-up of it, so
 * what you arrange is what ships.
 */

const input =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

export function ThemeEditor() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [data, setData] = useState<ThemeEditorData | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [past, dispatch] = useReducer(historyReducer, {
    past: [],
    present: null,
    future: [],
    tag: "",
    at: 0,
  });
  const draft = past.present;
  const canUndo = past.past.length > 0;
  const canRedo = past.future.length > 0;

  /**
   * Every edit in the editor goes through here.
   *
   * The tag says which field is being edited, so a run of keystrokes in one
   * box collapses into one undo step. Leave it off and the change is always
   * its own step, which is what adding, deleting and reordering want.
   */
  const setDraft = useCallback(
    (update: Update, tag = "") => dispatch({ kind: "set", update, tag, at: Date.now() }),
    [],
  );
  const undo = useCallback(() => dispatch({ kind: "undo" }), []);
  const redo = useCallback(() => dispatch({ kind: "redo" }), []);
  const [savedJson, setSavedJson] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  /**
   * Where the phone has been.
   *
   * A stack rather than a single screen, because home → collection → product
   * is a path, and Back from a product should return to the collection it came
   * from rather than all the way out. Arranging links you cannot follow is
   * arranging blind, and following one link only to hit a dead end is barely
   * better.
   */
  // Which screen the editor is on. Home is blocks; the rest are settings.
  const [page, setPage] = useState<ScreenKey | "home" | "live">("home");
  const [stripIndex, setStripIndex] = useState(0);
  // What the link pickers should offer beside the shop's own pages.
  const pagePicks = (draft?.settings.pages ?? []).map((p) => ({
    key: p.handle,
    // The handle rides along: two pages can share a headline, and the handle
    // is what the merchant typed and will recognise.
    ar: [p.line2, p.handle].filter(Boolean).join(" · "),
    en: [p.line2, p.handle].filter(Boolean).join(" · "),
  }));

  /** The merchant's own pages, edited in place. */
  const patchPage = (i: number, patch: Record<string, unknown>) =>
    setDraft(
      (d) =>
        d
          ? {
              ...d,
              settings: {
                ...d.settings,
                pages: (d.settings.pages ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)),
              },
            }
          : d,
      `page:${i}:${Object.keys(patch).join(",")}`,
    );
  const patchTile = (i: number, j: number, patch: Record<string, unknown>) =>
    setDraft(
      (d) =>
        d
          ? {
              ...d,
              settings: {
                ...d.settings,
                pages: (d.settings.pages ?? []).map((p, pi) =>
                  pi === i
                    ? { ...p, items: p.items.map((t, ti) => (ti === j ? { ...t, ...patch } : t)) }
                    : p,
                ),
              },
            }
          : d,
      `tile:${i}:${j}`,
    );
  // Bumping this plays the opening picture again in the phone.
  const [splashPlay, setSplashPlay] = useState(0);
  const [stack, setStack] = useState<Screen[]>([]);
  const screen = stack[stack.length - 1] ?? null;
  const push = useCallback((next: Screen) => setStack((s) => [...s, next]), []);
  // Which handles are pages, for the callback below: it is declared before
  // the draft is, and a ref is the honest way to read the current one.
  const pageHandles = useRef<string[]>([]);
  pageHandles.current = (draft?.settings.pages ?? []).map((p) => p.handle);

  // A link can point at a whole screen rather than at something in the shop.
  // The phone shows it the same way pressing that tab would.
  const showScreen = useCallback(
    (screen: string) => {
      setStack([]);
      if (screen === "orders") return setStack([{ kind: "orders" }]);
      if (screen === "cart" || screen === "account" || screen === "live") {
        return setPage(screen);
      }
      if (screen === "collections") return setStack([{ kind: "collections" }]);
      // One of the merchant's own pages: this phone draws those, because
      // they are the merchant's to design and they have to be checked here.
      if (pageHandles.current.includes(screen)) {
        return setStack([{ kind: "page", handle: screen }]);
      }
      // Reviews, Happy customers and Requests are real pages in the app, but
      // this phone only draws the screens the editor designs. Say where the
      // link goes rather than quietly showing home instead.
      const pages: Record<string, string> = { reviews: ar ? "آراء العملاء" : "Reviews", "happy-customers": ar ? "عملاء سعداء" : "Happy customers", requests: ar ? "الطلبات والمرتجعات" : "Requests & returns" };
      if (pages[screen]) {
        setMsg({
          tone: "ok",
          text: ar
            ? `هذا الرابط يفتح صفحة «${pages[screen]}» داخل التطبيق.`
            : `This link opens the ${pages[screen]} page in the app.`,
        });
        return setPage("home");
      }
      setPage("home");
    },
    [ar],
  );
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /**
   * The editor's phone is a real shopper, not a picture of one.
   *
   * The basket and the signed-in number are the same ones the full test app
   * uses, so a product added here is in the basket there — and an order placed
   * from either is an app order the store cannot tell apart.
   */
  const [cart, setCart] = useState<CartLine[]>([]);
  const [shopper, setShopper] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [wishlist, setWishlist] = useState<Wish[]>([]);

  useEffect(() => {
    setCart(readCart());
    setWishlist(readWishlist());
    setShopper(getToken() ? getPhone() : null);
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* private browsing */
    }
  }, [cart, cartReady]);

  useEffect(() => {
    if (!cartReady) return;
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    } catch {
      /* private browsing */
    }
  }, [wishlist, cartReady]);

  /** Press the heart: on the list if it was not, off it if it was. */
  const toggleWish = useCallback(
    (card: { id: string; name: string; priceMin: number | null; image: string | null }) => {
      setWishlist((w) =>
        w.some((x) => x.id === card.id)
          ? w.filter((x) => x.id !== card.id)
          : [
              ...w,
              { id: card.id, name: card.name, price: card.priceMin ?? undefined, image: card.image ?? undefined },
            ],
      );
    },
    [],
  );

  const addToCart = useCallback((itemId: string) => {
    setCart((c) => {
      const found = c.find((l) => l.itemId === itemId);
      return found
        ? c.map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...c, { itemId, quantity: 1 }];
    });
    setPage("cart");
  }, []);

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);

  // Adding from a product or a collection stays on that screen, the way the
  // app does; buying now goes to the basket.
  const addQuietly = useCallback((itemId: string, quantity: number) => {
    setCart((c) => {
      const found = c.find((l) => l.itemId === itemId);
      return found
        ? c.map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...c, { itemId, quantity }];
    });
  }, []);

  // The search box on the phone is a search box, not a picture of one — a
  // merchant deciding whether to keep it needs to see what it turns up.
  const [query, setQuery] = useState("");

  // Which tab the page being edited belongs to, so the bar in the preview
  // agrees with what is on screen above it. Collection and product are reached
  // from the shop tab, so that is the one lit.
  const activeTab: TabKey =
    screen?.kind === "orders"
      ? "orders"
      : page === "cart"
        ? "cart"
        : page === "account"
          ? "account"
          : "shop";

  // Landing on the Collection or Product tab with nothing tapped yet shows the
  // first real one, so the settings have something to act on immediately.
  useEffect(() => {
    if (page === "home" || stack.length) return;
    if (page === "collection" && data?.collections[0]) {
      const c = data.collections[0];
      setStack([{ kind: "collection", handle: c.handle, title: c.title }]);
    }
    if (page === "product") {
      // New arrivals are only fetched when a block asks for them, so a theme
      // without that section has none. Any product in any row will do — the
      // point is to have something real to edit against.
      const anyProduct =
        home?.newArrivals[0] ?? Object.values(home?.rows ?? {}).flat()[0];
      if (anyProduct) setStack([{ kind: "product", id: anyProduct.id }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, data, home]);

  useEffect(() => {
    loadThemeEditor().then((r) => {
      if (!r.ok) return setMsg({ tone: "err", text: r.error });
      setData(r.data);
      dispatch({ kind: "load", theme: r.data.theme });
      setSavedJson(JSON.stringify(r.data.theme));
    });
    // The preview draws from the endpoint the app itself calls, so the data is
    // real even while the theme is a draft.
    fetch("/api/storefront/home", { headers: { "x-store-channel": "app" }, cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setHome(
          j?.ok
            ? {
                collections: j.data.collections ?? [],
                rows: j.data.rows ?? {},
                newArrivals: j.data.newArrivals ?? [],
                reviews: j.data.reviews ?? [],
                lives: j.data.lives ?? [],
              }
            : { collections: [], rows: {}, newArrivals: [], reviews: [] },
        ),
      )
      .catch(() => setHome({ collections: [], rows: {}, newArrivals: [], reviews: [] }));
  }, []);

  const dirty = useMemo(
    () => Boolean(draft) && JSON.stringify(draft) !== savedJson,
    [draft, savedJson],
  );

  /**
   * ⌘Z and ⌘⇧Z, everywhere on the page including inside a text box.
   *
   * The boxes are controlled by React, so the browser's own undo has nothing
   * to walk back — letting it through would look broken. This answers instead.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const missingHandles = useMemo(() => {
    if (!draft || !data) return [];
    const have = new Set(data.collections.map((c) => c.handle));
    return referencedHandles(draft).filter((h) => !have.has(h));
  }, [draft, data]);

  // Hovering a block in the phone opens and scrolls to its row, the way
  // hovering a section in the storefront preview does on the website.
  useEffect(() => {
    if (!hovered) return;
    const el = railRef.current?.querySelector(`[data-block-key="${CSS.escape(hovered)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hovered]);

  // Editing a section while the phone is showing a collection would hide the
  // very thing being changed, so any edit brings the phone home.
  const home_ = useCallback(() => setStack([]), []);

  const patchTabs = useCallback(
    (tabs: ThemeTab[]) => setDraft((d) => (d ? { ...d, tabs } : d), "tabs"),
    [setDraft],
  );

  const patchScreen = useCallback(
    <K extends ScreenKey>(key: K, patch: Partial<ScreenSettings[K]>) => {
      setDraft(
        (d) => (d ? { ...d, screens: { ...d.screens, [key]: { ...d.screens[key], ...patch } } } : d),
        `screen:${key}:${Object.keys(patch).join(",")}`,
      );
    },
    [setDraft],
  );

  const patchSettings = useCallback(
    (patch: Partial<AppTheme["settings"]>) => {
      home_();
      setDraft(
        (d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d),
        `settings:${Object.keys(patch).join(",")}`,
      );
    },
    [home_, setDraft],
  );

  const patchBlock = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      home_();
      setDraft(
        (d) =>
          d
            ? {
                ...d,
                blocks: d.blocks.map((b) =>
                  b.id === id ? { ...b, settings: { ...b.settings, ...patch } } : b,
                ),
              }
            : d,
        `block:${id}:${Object.keys(patch).join(",")}`,
      );
    },
    [home_, setDraft],
  );

  function move(id: string, by: 1 | -1) {
    setDraft((d) => {
      if (!d) return d;
      const i = d.blocks.findIndex((b) => b.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  }

  /**
   * The section being carried, and the gap it is hovering over.
   *
   * Held as ids rather than positions because the list under the pointer is
   * the same list being reordered - an index captured on lift is wrong the
   * moment anything moves.
   */
  const [carrying, setCarrying] = useState<string | null>(null);
  const [landing, setLanding] = useState<{ id: string; below: boolean } | null>(null);

  /** Let go: put the carried section where the pointer says. */
  function dropCarried() {
    if (!carrying || !landing) return setCarrying(null);
    setDraft((d) => {
      if (!d) return d;
      const from = d.blocks.findIndex((b) => b.id === carrying);
      const onto = d.blocks.findIndex((b) => b.id === landing.id);
      if (from < 0 || onto < 0 || from === onto) return d;
      const blocks = [...d.blocks];
      const [moved] = blocks.splice(from, 1);
      // The target's index shifts down by one once the carried card is out of
      // the list above it, which is exactly what "below" already means there.
      const at = onto + (landing.below ? 1 : 0) - (from < onto ? 1 : 0);
      blocks.splice(Math.max(0, Math.min(blocks.length, at)), 0, moved);
      return { ...d, blocks };
    });
    setCarrying(null);
    setLanding(null);
  }

  /**
   * Put a section at a given place in the order.
   *
   * Not a swap: taking it out and putting it back where it was asked for is
   * what a merchant means by "third". Swapping with whatever happens to be
   * third would move that one to where this came from, which is a different
   * thing and only looks the same when the two are neighbours.
   */
  function moveTo(id: string, to: number) {
    setDraft((d) => {
      if (!d) return d;
      const from = d.blocks.findIndex((b) => b.id === id);
      const at = Math.max(0, Math.min(d.blocks.length - 1, to));
      if (from < 0 || from === at) return d;
      const blocks = [...d.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(at, 0, moved);
      return { ...d, blocks };
    });
  }

  function add(type: BlockType, preset?: Record<string, unknown>) {
    const made = newBlock(type);
    const block = preset ? { ...made, settings: { ...made.settings, ...preset } } : made;
    setDraft((d) => (d ? { ...d, blocks: [...d.blocks, block] } : d));
    setOpen((s) => ({ ...s, [block.id]: true }));
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    const res = await saveTheme(normalizeTheme(draft));
    setSaving(false);
    if (!res.ok) {
      setMsg({
        tone: "err",
        text:
          res.error === "migration_missing"
            ? ar
              ? "شغّلي supabase/migrations/0023_app_theme.sql"
              : "Run supabase/migrations/0023_app_theme.sql"
            : res.error,
      });
      return;
    }
    setSavedJson(JSON.stringify(draft));
  }

  function onReset() {
    if (!data) return;
    const question = ar
      ? "إرجاع المظهر إلى آخر نسخة محفوظة؟"
      : "Put the theme back to the last saved version?";
    if (!window.confirm(question)) return;
    setDraft(JSON.parse(savedJson) as AppTheme);
    setMsg(null);
  }

  if (!draft || !data) {
    return (
      <Card className="p-12 text-center text-sm text-ink-soft">
        {msg?.text ?? (ar ? "جارٍ التحميل…" : "Loading…")}
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* ------------------------------- header --------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app" className="btn-ghost h-9 px-2">
          <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">
            {ar ? "مظهر التطبيق" : "App theme"}
          </div>
          <div className="truncate text-xs text-ink-soft">
            {ar
              ? "رتّبي شاشة التطبيق — كل قسم تعدّلينه يُكتب له الكود"
              : "Arrange the app's screen. Editing a section writes the code for it"}
          </div>
        </div>

        <div className="ms-auto flex items-center gap-1 rounded-xl bg-surface-page p-1">
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                device === d ? "bg-white text-ink shadow-card" : "text-ink-muted"
              }`}
            >
              {d === "desktop" ? (
                <IcDesktop className="h-4 w-4" />
              ) : (
                <IcMobile className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>

        <Link href="/app/theme/code" className="btn-outline h-9 gap-1.5 px-3 text-xs">
          <IcCode className="h-3.5 w-3.5" />
          {ar ? "الكود" : "Code"}
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title={ar ? "تراجع (⌘Z)" : "Undo (⌘Z)"}
            aria-label={ar ? "تراجع" : "Undo"}
            className="btn-ghost h-9 w-9 p-0 disabled:opacity-30"
          >
            <IcUndo className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title={ar ? "إعادة (⌘⇧Z)" : "Redo (⌘⇧Z)"}
            aria-label={ar ? "إعادة" : "Redo"}
            className="btn-ghost h-9 w-9 p-0 disabled:opacity-30"
          >
            <IcRedo className="h-4 w-4" />
          </button>
        </div>
        <button onClick={onReset} disabled={!dirty} className="btn-ghost h-9 px-3 text-xs disabled:opacity-40">
          {ar ? "إرجاع للمحفوظ" : "Reset"}
        </button>
        <button onClick={onSave} disabled={saving || !dirty} className="btn-primary disabled:opacity-60">
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : dirty ? (ar ? "حفظ" : "Save") : ar ? "محفوظ" : "Saved"}
        </button>
      </div>

      {msg && (
        <Card
          className={`p-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.tone === "err" && <IcAlert className="me-1.5 inline h-4 w-4" />}
          {msg.text}
        </Card>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        {/* ------------------------------ rail ---------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div ref={railRef} className="flex-1 overflow-y-auto p-3">
            {missingHandles.length > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <span className="font-semibold">
                  {missingHandles.length}{" "}
                  {ar
                    ? "قسماً مذكوراً في المظهر غير موجود في هذا المتجر"
                    : missingHandles.length === 1
                      ? "collection this theme points at isn't in this store"
                      : "collections this theme points at aren't in this store"}
                </span>
                <p className="mt-1">
                  {ar
                    ? "المظهر مأخوذ من ثيم شوبيفاي، وهذه الأقسام لم تُنشأ هنا. الأقسام التي تشير إليها ستظهر فارغة حتى توجّهيها لقسم موجود — وهي معلّمة بالأصفر."
                    : "This came from your Shopify theme, and these collections were never recreated here. Sections pointing at them will be empty until you repoint them — they're marked in amber."}
                </p>
              </div>
            )}
            <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "إعدادات عامة" : "Theme settings"}
            </div>
            <Group
              id="__settings"
              title={ar ? "الهوية" : "Brand"}
              subtitle="theme.ts"
              open={open["__settings"] ?? true}
              onToggle={() => setOpen((s) => ({ ...s, __settings: !(s["__settings"] ?? true) }))}
              codeHref="/app/theme/code?file=theme.ts"
            >
              <Field label={ar ? "اسم المتجر" : "Store name"} type="text">
                <input
                  value={draft.settings.storeName}
                  onChange={(e) => patchSettings({ storeName: e.target.value })}
                  className={input}
                />
              </Field>
              <Field label={ar ? "اللون الأساسي" : "Accent colour"} type="color">
                <ColorPicker
                  value={draft.settings.accent}
                  onChange={(v) => patchSettings({ accent: v })}
                  fallback="#7c3aed"
                  brand={[draft.settings.accent, draft.settings.background]}
                  input={input}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "لون الخلفية" : "Background colour"} type="color">
                <ColorPicker
                  value={draft.settings.background}
                  onChange={(v) => patchSettings({ background: v })}
                  fallback="#f8fafc"
                  brand={[draft.settings.accent, draft.settings.background]}
                  input={input}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "خط العناوين" : "Title face"} type="select">
                <select
                  value={draft.settings.titleFont}
                  onChange={(e) => patchSettings({ titleFont: e.target.value })}
                  className={input}
                >
                  <option value="system">{ar ? "الخط العادي" : "System"}</option>
                  <option value="serif">{ar ? "خط الموقع (Playfair)" : "The website's face (Playfair)"}</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {ar
                    ? "نفس خط عناوين الموقع — يجعل التطبيق يبدو بنفس مستواه."
                    : "The same face the website sets its headings in."}
                </p>
              </Field>

              <SpaceRow
                label={ar ? "المسافة بين الأقسام" : "Space between sections"}
                value={draft.settings.sectionGap}
                onChange={(v) => patchSettings({ sectionGap: v })}
                min={0}
                max={40}
              />
              <SpaceRow
                label={ar ? "المسافة بين العناصر" : "Space between items"}
                value={draft.settings.itemGap}
                onChange={(v) => patchSettings({ itemGap: v })}
                min={0}
                max={24}
                note={
                  ar
                    ? "يصغّر كل المسافات داخل الأقسام معاً، فتبقى الشرائط أضيق من البطاقات."
                    : "Tightens every gap inside a section together, so chips stay tighter than cards."
                }
              />
              <SpaceRow
                label={ar ? "كلمات اسم المنتج" : "Words of the product name"}
                value={draft.settings.cardNameWords}
                onChange={(v) => patchSettings({ cardNameWords: v })}
                min={1}
                max={8}
                unit={ar ? " كلمة" : " words"}
                note={
                  ar
                    ? "اسم المنتج يأخذ سطراً واحداً على البطاقة، وما زاد يصبح ثلاث نقاط."
                    : "A name gets one line on the card; whatever is past this becomes an ellipsis."
                }
              />
              <Field label={ar ? "خلفية صور المنتجات" : "Behind product photos"} type="color">
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.settings.cardPhotoBg}
                    onChange={(e) => patchSettings({ cardPhotoBg: e.target.value })}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1"
                  />
                  <input
                    value={draft.settings.cardPhotoBg}
                    onChange={(e) => patchSettings({ cardPhotoBg: e.target.value })}
                    className={input}
                    dir="ltr"
                  />
                </span>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {ar
                    ? "كل صور المنتجات تجلس على هذا اللون، فلا تبدو صورة على أبيض وأخرى على رمادي."
                    : "Every product photo sits on this one colour, so one shot on white and the next on grey stop fighting each other."}
                </p>
              </Field>
              <Field label={ar ? "الشعار" : "Logo"} type="image_picker">
                <span className="flex items-center gap-2">
                  {draft.settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.settings.logoUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg border border-line object-contain"
                    />
                  ) : null}
                  <ImageUpload onUploaded={(url) => patchSettings({ logoUrl: url })} ar={ar} />
                  <input
                    value={draft.settings.logoUrl ?? ""}
                    onChange={(e) => patchSettings({ logoUrl: e.target.value || null })}
                    placeholder="https://…"
                    className={input}
                    dir="ltr"
                  />
                </span>
              </Field>
              <Field label={ar ? "صورة الافتتاح" : "Opening picture"} type="checkbox">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={draft.settings.splashEnabled}
                    onChange={(e) => patchSettings({ splashEnabled: e.target.checked })}
                  />
                  {ar ? "يفتح التطبيق على صورة" : "Open the app on a picture"}
                </label>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {ar
                    ? "تظهر لثوانٍ ثم تنصرف وحدها — واللمس في أي مكان يتخطّاها."
                    : "It holds for a few seconds, then leaves by itself; a tap anywhere sends it early."}
                </p>
              </Field>
              {draft.settings.splashEnabled && (
                <>
                  <Field label={ar ? "الصورة" : "Picture"} type="image_picker">
                    <span className="flex items-center gap-2">
                      {draft.settings.splashImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.settings.splashImageUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
                        />
                      ) : null}
                      <ImageUpload onUploaded={(url) => patchSettings({ splashImageUrl: url })} ar={ar} />
                      <input
                        value={draft.settings.splashImageUrl}
                        onChange={(e) => patchSettings({ splashImageUrl: e.target.value })}
                        placeholder="https://…"
                        className={input}
                        dir="ltr"
                      />
                    </span>
                  </Field>
                  <Field label={ar ? "كم تبقى (ثوانٍ)" : "How long it holds (seconds)"} type="range">
                    <input
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.5}
                      value={draft.settings.splashSeconds}
                      onChange={(e) => patchSettings({ splashSeconds: Number(e.target.value) })}
                      className={input}
                    />
                  </Field>
                  <Field label={ar ? "طريقة الخروج" : "How it leaves"} type="select">
                    <select
                      value={draft.settings.splashExit}
                      onChange={(e) => patchSettings({ splashExit: e.target.value })}
                      className={input}
                    >
                      <option value="curtain">{ar ? "ستارة تنفتح" : "Curtain parts"}</option>
                      <option value="fade">{ar ? "تلاشٍ" : "Fade"}</option>
                      <option value="zoom">{ar ? "تكبير وتلاشٍ" : "Zoom and fade"}</option>
                      <option value="up">{ar ? "تنزلق لأعلى" : "Slide up"}</option>
                    </select>
                  </Field>
                  <Field label={ar ? "ملء الشاشة" : "Picture fit"} type="select">
                    <select
                      value={draft.settings.splashFit}
                      onChange={(e) => patchSettings({ splashFit: e.target.value })}
                      className={input}
                    >
                      <option value="cover">{ar ? "تملأ الشاشة" : "Fill the screen"}</option>
                      <option value="contain">{ar ? "الصورة كاملة" : "Show the whole picture"}</option>
                    </select>
                  </Field>
                  <Field label={ar ? "كم مرة تظهر" : "How often"} type="select">
                    <select
                      value={draft.settings.splashShow}
                      onChange={(e) => patchSettings({ splashShow: e.target.value })}
                      className={input}
                    >
                      <option value="session">{ar ? "مرة كل زيارة" : "Once a visit"}</option>
                      <option value="day">{ar ? "مرة كل يوم" : "Once a day"}</option>
                      <option value="open">{ar ? "كل مرة يُفتح فيها" : "Every time the app opens"}</option>
                    </select>
                  </Field>
                  <Field label={ar ? "لون الخلفية خلفها" : "Colour behind it"} type="color">
                    <ColorPicker
                      value={draft.settings.splashBg}
                      onChange={(v) => patchSettings({ splashBg: v })}
                      fallback="#2b1b10"
                      brand={[draft.settings.accent, draft.settings.background]}
                      input={input}
                      ar={ar}
                    />
                  </Field>
                  <Field label={ar ? "زر التخطّي" : "Skip button"} type="text">
                    <input
                      value={draft.settings.splashSkipLabel}
                      onChange={(e) => patchSettings({ splashSkipLabel: e.target.value })}
                      placeholder={ar ? "تخطّي" : "Skip"}
                      className={input}
                    />
                  </Field>
                  <Field label={ar ? "اللمس يفتح" : "A tap opens"} type="link">
                    <LinkPicker
                      pages={pagePicks}
                      value={{
                        handle: draft.settings.splashHandle,
                        url: draft.settings.splashUrl,
                        productId: draft.settings.splashProductId,
                        screen: draft.settings.splashScreen,
                      }}
                      onChange={(next) =>
                        patchSettings({
                          splashHandle: next.handle ?? "",
                          splashUrl: next.url ?? "",
                          splashProductId: next.productId ?? "",
                          splashScreen: next.screen ?? "",
                        })
                      }
                      collections={data.collections}
                      input={input}
                      ar={ar}
                    />
                  </Field>
                  <Field label={ar ? "معاينة" : "Preview"} type="button">
                    <button
                      onClick={() => setSplashPlay((n) => n + 1)}
                      className="btn-outline w-full justify-center"
                    >
                      {ar ? "شغّلي الصورة الآن" : "Play it in the phone"}
                    </button>
                  </Field>
                </>
              )}
              <Field label={ar ? "الاسم في الهيدر" : "Wordmark"} type="text">
                <span className="flex items-center gap-2">
                  <input
                    value={draft.settings.logoText}
                    onChange={(e) => patchSettings({ logoText: e.target.value })}
                    placeholder="BEAUTY"
                    className={input}
                    dir="ltr"
                  />
                  <input
                    value={draft.settings.logoAccentText}
                    onChange={(e) => patchSettings({ logoAccentText: e.target.value })}
                    placeholder="BAR"
                    className={`${input} font-bold`}
                    style={{ color: draft.settings.accent }}
                    dir="ltr"
                  />
                </span>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {ar
                    ? "الجزء الثاني يأخذ لون الهوية. الشعار المرفوع يحل محلهما."
                    : "The second half takes the brand colour. An uploaded logo replaces both."}
                </p>
              </Field>
              <Field label={ar ? "نص خانة البحث" : "Search placeholder"} type="text">
                <input
                  value={draft.settings.searchPlaceholder}
                  onChange={(e) => patchSettings({ searchPlaceholder: e.target.value })}
                  placeholder="Sahel sandals"
                  className={input}
                />
              </Field>
              <Field label={ar ? "أيقونة المفضّلة" : "Saved icon"} type="checkbox">
                <Toggle
                  on={draft.settings.showWishlist}
                  onChange={(v) => patchSettings({ showWishlist: v })}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "أيقونة السلة" : "Bag icon"} type="checkbox">
                <Toggle
                  on={draft.settings.showBag}
                  onChange={(v) => patchSettings({ showBag: v })}
                  ar={ar}
                />
              </Field>
              <ColorRow
                label={ar ? "خلفية الهيدر" : "Header background"}
                value={draft.settings.headerBg}
                fallback="#ffffff"
                onChange={(v) => patchSettings({ headerBg: v })}
                input={input}
                ar={ar}
              />
              <ColorRow
                label={ar ? "لون نص الهيدر" : "Header text"}
                value={draft.settings.headerInk}
                fallback="#191614"
                onChange={(v) => patchSettings({ headerInk: v })}
                input={input}
                ar={ar}
              />
              <Field label={ar ? "قائمة التنقّل" : "Navigation menu"} type="link_list">
                <select
                  value={draft.settings.menuHandle}
                  onChange={(e) => patchSettings({ menuHandle: e.target.value })}
                  className={input}
                >
                  {data.menus.length === 0 && <option value="main-menu">main-menu</option>}
                  {data.menus.map((m) => (
                    <option key={m.handle} value={m.handle}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={ar ? "شريط البحث" : "Search bar"} type="checkbox">
                <Toggle
                  on={draft.settings.showSearch}
                  onChange={(v) => patchSettings({ showSearch: v })}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "شريط إعلان" : "Announcement bar"} type="checkbox">
                <Toggle
                  on={draft.settings.announcementEnabled}
                  onChange={(v) => patchSettings({ announcementEnabled: v })}
                  ar={ar}
                />
              </Field>
              {draft.settings.announcementEnabled && (
                <Field label={ar ? "نص الإعلان" : "Announcement text"} type="text">
                  <input
                    value={draft.settings.announcement}
                    onChange={(e) => patchSettings({ announcement: e.target.value })}
                    placeholder={ar ? "شحن مجاني فوق ١٠٠٠ ج.م" : "Free delivery over 1,000 EGP"}
                    className={input}
                  />
                </Field>
              )}

              <Field label={ar ? "شريط الاختصارات" : "Shortcut strip"} type="checkbox">
                <Toggle
                  on={draft.settings.stripEnabled}
                  onChange={(v) => patchSettings({ stripEnabled: v })}
                  ar={ar}
                />
              </Field>
              {draft.settings.stripEnabled && (
                <div className="mt-1 rounded-xl border border-line bg-surface-page p-2">
                  <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {ar ? "الاختصارات" : "Shortcuts"}
                  </div>
                  <div className="space-y-2">
                    {draft.settings.strip.map((item, i) => (
                      <div key={item.id} className="rounded-lg border border-line bg-surface p-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={item.label}
                            onChange={(e) =>
                              patchSettings({
                                strip: draft.settings.strip.map((x, j) =>
                                  j === i ? { ...x, label: e.target.value } : x,
                                ),
                              })
                            }
                            placeholder={ar ? "الاسم" : "Label"}
                            className={`${input} h-8 text-xs`}
                          />
                          <button
                            onClick={() =>
                              patchSettings({ strip: draft.settings.strip.filter((_, j) => j !== i) })
                            }
                            title={ar ? "حذف" : "Remove"}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-hover"
                          >
                            <IcTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1.5">
                          <LinkPicker
                            pages={pagePicks}
                            value={item}
                            onChange={(link) =>
                              patchSettings({
                                strip: draft.settings.strip.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        handle: link.handle ?? "",
                                        url: link.url ?? "",
                                        productId: link.productId ?? "",
                                        screen: link.screen ?? "",
                                      }
                                    : x,
                                ),
                              })
                            }
                            collections={data.collections}
                            input={`${input} h-8 text-xs`}
                            ar={ar}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      patchSettings({
                        strip: [
                          ...draft.settings.strip,
                          { id: itemId(), label: "", handle: "", url: "", productId: "", screen: "" } as StripItem,
                        ],
                      })
                    }
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line py-1.5 text-[11px] text-ink-muted hover:border-brand-500"
                  >
                    <IcPlus className="h-3 w-3" />
                    {ar ? "اختصار" : "Shortcut"}
                  </button>
                </div>
              )}
            </Group>

            <Group
              id="__pages"
              title={ar ? "الصفحات" : "Pages"}
              subtitle={ar ? "صفحاتك الخاصة" : "your own pages"}
              open={open["__pages"] ?? true}
              onToggle={() => setOpen((s) => ({ ...s, __pages: !(s["__pages"] ?? true) }))}
            >
              <p className="mb-2 text-[11px] leading-relaxed text-ink-soft">
                {ar
                  ? "صفحة مثل «For Her»: عنوان وصور تفتح كل منها قسمًا. اربطيها من الاختصارات أو القائمة."
                  : "A page like For Her: a headline and pictures that each open a collection. Point a shortcut or a menu item at it."}
              </p>

              {(draft.settings.pages ?? []).map((page, i) => (
                <div key={page.id} className="mb-3 rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={page.handle}
                      onChange={(e) => patchPage(i, { handle: e.target.value })}
                      placeholder="for-her"
                      className={input}
                      dir="ltr"
                    />
                    <button
                      onClick={() => patchSettings({ pages: (draft.settings.pages ?? []).filter((_, j) => j !== i) })}
                      className="shrink-0 rounded-lg border border-line p-2 text-ink-soft hover:text-rose-600"
                      aria-label={ar ? "حذف" : "Remove"}
                    >
                      <IcTrash className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={page.kicker} onChange={(e) => patchPage(i, { kicker: e.target.value })} placeholder="SUMMER PICKS" className={input} />
                    <input value={page.line1} onChange={(e) => patchPage(i, { line1: e.target.value })} placeholder="shop" className={input} />
                    <input value={page.line2} onChange={(e) => patchPage(i, { line2: e.target.value })} placeholder="WOMEN COLLECTION" className={input} />
                  </div>
                  <select
                    value={page.layout}
                    onChange={(e) => patchPage(i, { layout: e.target.value })}
                    className={`${input} mt-2`}
                  >
                    <option value="circles">{ar ? "دوائر (مثل الموقع)" : "Circles, like the website"}</option>
                    <option value="tiles">{ar ? "بطاقات بالصورة كاملة" : "Tiles, the whole picture"}</option>
                  </select>

                  <div className="mt-2 space-y-2">
                    {page.items.map((tile, j) => (
                      <div key={tile.id} className="rounded-lg border border-line p-2">
                        <div className="flex items-center gap-2">
                          {tile.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tile.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                          ) : null}
                          <input
                            value={tile.label}
                            onChange={(e) => patchTile(i, j, { label: e.target.value })}
                            placeholder={ar ? "الكلمة" : "Word"}
                            className={input}
                          />
                          <ImageUpload compact onUploaded={(url) => patchTile(i, j, { imageUrl: url })} ar={ar} />
                          <button
                            onClick={() =>
                              patchPage(i, { items: page.items.filter((_, k) => k !== j) })
                            }
                            className="shrink-0 rounded-lg border border-line p-1.5 text-ink-soft hover:text-rose-600"
                            aria-label={ar ? "حذف" : "Remove"}
                          >
                            <IcTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2">
                          <LinkPicker
                            value={{ handle: tile.handle, url: tile.url, productId: tile.productId, screen: tile.screen }}
                            onChange={(next) =>
                              patchTile(i, j, {
                                handle: next.handle ?? "",
                                url: next.url ?? "",
                                productId: next.productId ?? "",
                                screen: next.screen ?? "",
                              })
                            }
                            collections={data.collections}
                            pages={pagePicks}
                            input={input}
                            ar={ar}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        patchPage(i, {
                          items: [
                            ...page.items,
                            { id: itemId(), imageUrl: "", label: "", handle: "", url: "", productId: "", screen: "" },
                          ],
                        })
                      }
                      className="btn-outline w-full justify-center text-xs"
                    >
                      <IcPlus className="h-3.5 w-3.5" /> {ar ? "إضافة صورة" : "Add a way in"}
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() =>
                  patchSettings({
                    pages: [
                      ...(draft.settings.pages ?? []),
                      {
                        id: itemId(),
                        handle: "",
                        kicker: "",
                        line1: "shop",
                        line2: "",
                        layout: "circles",
                        items: [],
                      },
                    ],
                  })
                }
                className="btn-outline w-full justify-center text-xs"
              >
                <IcPlus className="h-3.5 w-3.5" /> {ar ? "صفحة جديدة" : "New page"}
              </button>
            </Group>

            <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "شريط التبويبات" : "Tab bar"}
            </div>
            <Group
              id="__tabs"
              title={ar ? "أزرار أسفل الشاشة" : "The bar along the bottom"}
              subtitle="TabBar.tsx"
              open={open["__tabs"] ?? false}
              onToggle={() => setOpen((s) => ({ ...s, __tabs: !s["__tabs"] }))}
              codeHref="/app/theme/code?file=components/TabBar.tsx"
            >
              <TabsPanel tabs={draft.tabs} ar={ar} onChange={patchTabs} />
            </Group>

            {page !== "home" && page !== "live" && (
              <>
                <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {SCREEN_LABELS[page][ar ? "ar" : "en"]}
                </div>
                <Group
                  id={`__screen-${page}`}
                  title={SCREEN_LABELS[page][ar ? "ar" : "en"]}
                  subtitle={`${screenFile(page)}.tsx`}
                  open
                  onToggle={() => {}}
                  codeHref={`/app/theme/code?file=components/${screenFile(page)}.tsx`}
                >
                  <ScreenPanel
                    screen={page}
                    screens={draft.screens}
                    ar={ar}
                    onChange={patchScreen}
                  />
                </Group>
              </>
            )}

            {page === "home" && (
            <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "الشاشة الرئيسية" : "Home screen"}
            </div>
            )}

            {page === "home" && draft.blocks.map((block, i) => (
              <BlockGroup
                key={block.id}
                block={block}
                ar={ar}
                pages={pagePicks}
                open={open[block.id] ?? false}
                highlighted={hovered === block.id}
                first={i === 0}
                last={i === draft.blocks.length - 1}
                index={i}
                count={draft.blocks.length}
                order={draft.blocks.map((b, n) => ({
                  id: b.id,
                  label:
                    [b.settings?.title, b.settings?.heading, b.settings?.kicker]
                      .map((v) => (typeof v === "string" ? v.trim() : ""))
                      .find(Boolean) || (ar ? BLOCK_META[b.type].ar : BLOCK_META[b.type].en),
                  at: n,
                }))}
                collections={data.collections}
                accent={draft.settings.accent}
                input={input}
                onToggle={() => setOpen((s) => ({ ...s, [block.id]: !s[block.id] }))}
                onHover={setHovered}
                onPatch={(patch) => patchBlock(block.id, patch)}
                onMove={(by) => move(block.id, by)}
                onMoveTo={(to) => moveTo(block.id, to)}
                drag={{
                  lifted: carrying === block.id,
                  landing:
                    carrying && carrying !== block.id && landing?.id === block.id
                      ? landing.below
                        ? ("below" as const)
                        : ("above" as const)
                      : null,
                  onLift: () => setCarrying(block.id),
                  onOver: (below: boolean) => setLanding({ id: block.id, below }),
                  onDrop: dropCarried,
                  onEnd: () => {
                    setCarrying(null);
                    setLanding(null);
                  },
                }}
                onRemove={() =>
                  setDraft((d) => (d ? { ...d, blocks: d.blocks.filter((b) => b.id !== block.id) } : d))
                }
              />
            ))}

            {page === "home" && draft.blocks.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-ink-soft">
                {ar ? "لا توجد أقسام بعد." : "No sections yet."}
              </p>
            )}

            {page === "home" && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "إضافة قسم" : "Add a section"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* A circle row already dressed the way noon draws its
                    category rows, so it does not have to be built by hand. */}
                <button
                  onClick={() =>
                    add("circle_row", {
                      title: ar ? "تسوّقي لها" : "Shop Her",
                      seeAllLabel: ar ? "تسوّقي الآن" : "Shop Now",
                      shape: "rounded",
                      radius: 22,
                      size: 104,
                      titleSize: 20,
                      labelSize: 13,
                      labelBold: true,
                      labelColor: "#1f2937",
                      linkColor: "#3866df",
                      bg: "#f3f3f3",
                      showNote: false,
                    })
                  }
                  title={
                    ar
                      ? "صف أقسام بصور مربعة مستديرة وعنوان كبير ورابط، مثل نون"
                      : "A row of rounded category tiles under a big heading and a link, the way noon does it"
                  }
                  className="btn-outline h-8 gap-1 border-brand-300 px-2.5 text-xs text-brand-700"
                >
                  <IcPlus className="h-3 w-3" />
                  {ar ? "صف أقسام (نون)" : "Category row (noon)"}
                </button>
                {(Object.keys(BLOCK_META) as BlockType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => add(type)}
                    title={ar ? BLOCK_META[type].hintAr : BLOCK_META[type].hintEn}
                    className="btn-outline h-8 gap-1 px-2.5 text-xs"
                  >
                    <IcPlus className="h-3 w-3" />
                    {ar ? BLOCK_META[type].ar : BLOCK_META[type].en}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>
        </Card>

        {/* ---------------------------- preview --------------------------- */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
            {(["home", ...SCREEN_KEYS] as (ScreenKey | "home")[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setPage(key);
                  setStack([]);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  page === key
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {SCREEN_LABELS[key][ar ? "ar" : "en"]}
              </button>
            ))}
            <Link
              href="/app-preview"
              className="ms-auto text-[11px] font-medium text-brand-600 hover:underline"
            >
              {ar ? "فتح التطبيق كاملاً" : "Open the full app"}
            </Link>
          </div>

          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-surface-page p-4">
            <div
              className={`${
                device === "mobile" ? "w-[390px]" : "w-full max-w-[900px]"
              } app-surface relative flex min-h-[620px] max-w-full flex-col self-start overflow-hidden rounded-[1.75rem] border-8 border-slate-900 shadow-card`}
              style={
                {
                  background: draft.settings.background,
                  "--app-page": draft.settings.background,
                } as React.CSSProperties
              }
            >
              {/* The editor plays it on demand: once a shopper has seen it,
                  it would not come back until tomorrow, and a merchant needs
                  to watch it as many times as it takes to get it right. */}
              <AppSplash settings={draft.settings} ar={ar} replay={splashPlay} rehearsal />

              <div className="flex items-center justify-between bg-slate-900 px-4 pb-2 pt-1.5 text-[11px] font-medium text-white">
                <span className="flex items-center gap-1.5">
                  {draft.settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.settings.logoUrl} alt="" className="h-4 w-auto" />
                  ) : null}
                  {draft.settings.storeName}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: `${draft.settings.accent}66` }}
                >
                  {ar ? "معاينة" : "preview"}
                </span>
              </div>

              {draft.settings.announcementEnabled && draft.settings.announcement && (
                <div
                  className="px-3 py-1.5 text-center text-[11px] font-medium text-white"
                  style={{ background: draft.settings.accent }}
                >
                  {draft.settings.announcement}
                </div>
              )}

              <AppHeader
                settings={draft.settings}
                accent={draft.settings.accent}
                ar={ar}
                query={query}
                onQuery={(v) => {
                  setQuery(v);
                  if (v) setPage("home");
                }}
                cartCount={cartCount}
                onBag={() => setPage("cart")}
                wishlistCount={wishlist.length}
                onWishlist={() => setSavedOpen(true)}
              />

              {draft.settings.stripEnabled && (
                <AppStrip
                  items={draft.settings.strip}
                  accent={draft.settings.accent}
                  activeIndex={stripIndex}
                  onOpen={(item) => {
                    if (item.url) {
                      window.open(item.url, "_blank", "noopener,noreferrer");
                      return;
                    }
                    if (!item.handle) return;
                    const found = data.collections.find((c) => c.handle === item.handle);
                    setStripIndex(draft.settings.strip.indexOf(item));
                    setPage("home");
                    setStack([
                      { kind: "collection", handle: item.handle, title: found?.title ?? item.handle },
                    ]);
                  }}
                />
              )}

              <div className="flex flex-1 flex-col">
              {page === "live" ? (
                <AppLive
                  sessions={liveSessionsFromLives(home?.lives ?? [])}
                  ar={ar}
                  accent={draft.settings.accent}
                  onOpen={(s) => {
                    if (s.url) return window.open(s.url, "_blank", "noopener,noreferrer");
                    if (s.productId) return push({ kind: "product", id: s.productId });
                    if (s.screen) return showScreen(s.screen);
                    if (s.handle) push({ kind: "collection", handle: s.handle, title: s.name });
                  }}
                />
              ) : page === "cart" || page === "checkout" ? (
                <Cart
                  ar={ar}
                  cart={cart}
                  setCart={setCart}
                  signedIn={Boolean(shopper)}
                  phone={shopper}
                  screens={draft.screens}
                  accent={draft.settings.accent}
                  startAtCheckout={page === "checkout"}
                  onNeedSignIn={() => setSignInOpen(true)}
                  onPlaced={() => {
                    setCart([]);
                    setPage("account");
                  }}
                />
              ) : page === "account" ? (
                <AccountTab
                  ar={ar}
                  signedIn={Boolean(shopper)}
                  phone={shopper}
                  screens={draft.screens}
                  accent={draft.settings.accent}
                  onSignIn={() => setSignInOpen(true)}
                  onSignOut={() => {
                    setToken(null);
                    setShopper(null);
                  }}
                  // Returns and questions have screens of their own in the full
                  // app; a row that did nothing here would be worse than a row
                  // that says where it goes.
                  onReturns={() => window.open("/app-preview", "_blank")}
                  onEnquiry={() => window.open("/app-preview", "_blank")}
                />
              ) : page !== "home" && !screen ? (
                <p className="bg-[var(--app-page,#f8fafc)] px-6 py-16 text-center text-sm leading-relaxed text-slate-400">
                  {page === "collection"
                    ? ar
                      ? "لا يوجد قسم لعرضه. افتحي أي قسم من الشاشة الرئيسية."
                      : "Nothing to stand in for a collection. Open one from the home screen."
                    : ar
                      ? "لا يوجد منتج لعرضه. افتحي أي منتج من الشاشة الرئيسية."
                      : "Nothing to stand in for a product. Open one from the home screen."}
                </p>
              ) : screen ? (
                screen.kind === "orders" ? (
                  <div className="bg-[var(--app-page,#f8fafc)] p-4">
                    <Orders ar={ar} signedIn={Boolean(shopper)} />
                  </div>
                ) : screen.kind === "collections" ? (
                  <div className="bg-[var(--app-page,#f8fafc)] px-4 pb-4">
                    <AppPageView
                      page={{
                        id: "all-collections",
                        handle: "collections",
                        kicker: "",
                        line1: "",
                        line2: ar ? "كل الأقسام" : "All collections",
                        layout: "circles",
                        items: data.collections.map((c) => ({
                          id: c.handle,
                          imageUrl: c.image ?? "",
                          label: c.title,
                          handle: c.handle,
                          url: "",
                          productId: "",
                          screen: "",
                        })),
                      }}
                      settings={draft.settings}
                      ar={ar}
                      onBack={pop}
                      onOpen={(tile) =>
                        push({ kind: "collection", handle: tile.handle, title: tile.label })
                      }
                    />
                  </div>
                ) : screen.kind === "page" ? (
                  <div className="bg-[var(--app-page,#f8fafc)] px-4 pb-4">
                    <AppPageView
                      page={
                        (draft.settings.pages ?? []).find((p) => p.handle === screen.handle) ?? {
                          id: "",
                          handle: screen.handle,
                          kicker: "",
                          line1: "",
                          line2: screen.handle,
                          layout: "circles",
                          items: [],
                        }
                      }
                      settings={draft.settings}
                      ar={ar}
                      onBack={pop}
                      onOpen={(tile) => {
                        if (tile.productId) return push({ kind: "product", id: tile.productId });
                        if (tile.screen) return showScreen(tile.screen);
                        if (tile.handle) {
                          const found = data.collections.find((c) => c.handle === tile.handle);
                          push({ kind: "collection", handle: tile.handle, title: found?.title ?? tile.label });
                        }
                      }}
                    />
                  </div>
                ) : screen.kind === "collection" ? (
                  <CollectionPage
                    key={screen.handle}
                    handle={screen.handle}
                    title={screen.title}
                    settings={draft.screens.collection}
                    ar={ar}
                    handlers={{
                      onBack: pop,
                      onOpenProduct: (id) => push({ kind: "product", id }),
                      onAdd: addQuietly,
                      onToggleWishlist: toggleWish,
                      wishlist: wishlist.map((w) => w.id),
                    } satisfies ScreenHandlers}
                  />
                ) : (
                  <ProductPage
                    key={screen.id}
                    id={screen.id}
                    settings={draft.screens.product}
                    ar={ar}
                    crumb={stack.find((x) => x.kind === "collection")?.title}
                    handlers={{
                      onBack: pop,
                      onOpenProduct: (id) => push({ kind: "product", id }),
                      onOpenScreen: () => {},
                      onAdd: addQuietly,
                      onBuyNow: (itemId, quantity) => {
                        addQuietly(itemId, quantity);
                        setPage("cart");
                      },
                      onToggleWishlist: toggleWish,
                      wishlist: wishlist.map((w) => w.id),
                    } satisfies ScreenHandlers}
                  />
                )
              ) : (
              <div className={`bg-[var(--app-page,#f8fafc)] px-4 pb-4 ${query.trim() ? "pt-4" : ""}`}>
                {query.trim() ? (
                  <SearchResults
                    ar={ar}
                    accent={draft.settings.accent}
                    query={query.trim()}
                    onOpenProduct={(id) => push({ kind: "product", id })}
                  />
                ) : home ? (
                  // Each block is its own AppHome here, so the space between
                  // them is this list's, not the renderer's - and the slider
                  // has to move it or it appears to do nothing in the editor.
                  <div
                    className="flex flex-col"
                    style={{ gap: `${draft.settings.sectionGap}px` }}
                  >
                    {draft.blocks.map((block) => (
                      <div
                        key={block.id}
                        onMouseEnter={() => {
                          setHovered(block.id);
                          setOpen((s) => (s[block.id] ? s : { ...s, [block.id]: true }));
                        }}
                        onMouseLeave={() => setHovered(null)}
                        className={`rounded-2xl transition-shadow ${
                          hovered === block.id ? "shadow-[0_0_0_2px_rgb(139,92,246)]" : ""
                        }`}
                      >
                        <AppHome
                          theme={{ ...draft, blocks: [block] }}
                          data={home}
                          ar={ar}
                          handlers={{
                            onOpenCollection: (handle, title) =>
                              push({ kind: "collection", handle, title }),
                            onOpenProduct: (id) => push({ kind: "product", id }),
                            onOpenScreen: showScreen,
                            // The heart and the add button work here as they do
                            // in the test app, on the same saved list and basket,
                            // so a merchant pressing either sees something happen
                            // rather than wondering if it is broken.
                            onAddToCart: (variantId) => addToCart(variantId),
                            onToggleWishlist: toggleWish,
                            wishlist: wishlist.map((w) => w.id),
                          }}
                          showPlaceholders
                        />
                      </div>
                    ))}
                    {draft.blocks.length === 0 && (
                      <p className="py-16 text-center text-sm text-slate-400">
                        {ar ? "الشاشة فارغة" : "The screen is empty"}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-400">
                    {ar ? "جارٍ بناء المعاينة…" : "Building the preview…"}
                  </p>
                )}
              </div>
              )}
              </div>

              {/* The bar the merchant just arranged, on every screen. */}
              <nav className="flex border-t border-slate-200 bg-white">
                {draft.tabs
                  .filter((t) => t.visible)
                  .map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setStack([]);
                        if (t.key === "orders") {
                          setPage("home");
                          setStack([{ kind: "orders" }]);
                        } else {
                          setPage(t.key === "shop" ? "home" : t.key);
                        }
                      }}
                      className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
                      style={{ color: t.key === activeTab ? draft.settings.accent : "#94a3b8" }}
                    >
                      <span className="relative text-base leading-none">
                        {TAB_DEFAULTS[t.key].icon}
                        {t.key === "cart" && cartCount > 0 && (
                          <span
                            className="absolute -end-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                            style={{ background: draft.settings.accent }}
                          >
                            {cartCount}
                          </span>
                        )}
                      </span>
                      {t.label || TAB_DEFAULTS[t.key][ar ? "ar" : "en"]}
                    </button>
                  ))}
              </nav>

              <Sheet
                open={signInOpen}
                onClose={() => setSignInOpen(false)}
                title={ar ? "تسجيل الدخول" : "Sign in"}
              >
                <SignIn
                  ar={ar}
                  onDone={(who) => {
                    setShopper(who);
                    setSignInOpen(false);
                  }}
                />
              </Sheet>
              <Sheet
                open={savedOpen}
                onClose={() => setSavedOpen(false)}
                title={ar ? "المفضّلة" : "Saved"}
              >
                <Saved
                  ar={ar}
                  accent={draft.settings.accent}
                  items={wishlist}
                  onOpen={(id) => {
                    setSavedOpen(false);
                    push({ kind: "product", id });
                  }}
                  onRemove={(id) => setWishlist((w) => w.filter((x) => x.id !== id))}
                />
              </Sheet>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces --
function Group({
  id,
  title,
  subtitle,
  open,
  onToggle,
  codeHref,
  highlighted,
  blockKey,
  onHover,
  actions,
  drag,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  codeHref?: string;
  highlighted?: boolean;
  blockKey?: string;
  onHover?: (key: string | null) => void;
  actions?: React.ReactNode;
  /**
   * Everything needed to pick this card up and put it somewhere else.
   *
   * Only the home sections are orderable, so a group that leaves this out is
   * simply not draggable rather than draggable and inert - a handle that does
   * nothing is worse than no handle.
   */
  drag?: {
    /** True while this one is the card being carried. */
    lifted: boolean;
    /** "above" or "below" when the carried card would land here. */
    landing: "above" | "below" | null;
    onLift: () => void;
    onDrop: () => void;
    onOver: (below: boolean) => void;
    onEnd: () => void;
  };
  children: React.ReactNode;
}) {
  return (
    <div
      data-block-key={blockKey}
      onMouseEnter={() => blockKey && onHover?.(blockKey)}
      onMouseLeave={() => onHover?.(null)}
      onDragOver={
        drag
          ? (e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              drag.onOver(e.clientY > r.top + r.height / 2);
            }
          : undefined
      }
      onDrop={
        drag
          ? (e) => {
              e.preventDefault();
              drag.onDrop();
            }
          : undefined
      }
      className={`mb-1.5 rounded-xl border transition-colors ${
        drag?.lifted ? "opacity-40 " : ""
      }${drag?.landing === "above" ? "border-t-2 border-t-violet-500 " : ""}${
        drag?.landing === "below" ? "border-b-2 border-b-violet-500 " : ""
      }${highlighted ? "border-violet-400 bg-violet-50/40 ring-1 ring-violet-300" : "border-line"}`}
    >
      <div className="flex items-center gap-1 px-3 py-2">
        {drag && (
          // The grip. Only this is draggable, so a stray drag inside a field
          // never picks the whole section up.
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              drag.onLift();
            }}
            onDragEnd={drag.onEnd}
            title="Drag to reorder"
            className="-ms-1 shrink-0 cursor-grab px-1 py-1 text-ink-soft hover:text-ink active:cursor-grabbing"
          >
            <IcGrip className="h-3.5 w-3.5" />
          </span>
        )}
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-start">
          <IcChevron
            className={`h-3 w-3 shrink-0 text-ink-soft transition-transform ${
              open ? "rotate-90" : ""
            } rtl:-scale-x-100`}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            {/* The controls beside it cost the name some width, so the whole
                of it is a hover away. */}
            <span title={title} className="truncate text-sm font-medium text-ink">
              {title}
            </span>
            {subtitle && (
              <span className="truncate font-mono text-[10px] text-ink-soft">{subtitle}</span>
            )}
          </span>
        </button>
        {actions}
        {codeHref && (
          <Link
            href={codeHref}
            className="shrink-0 rounded-lg px-1.5 py-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
            title="Code"
          >
            <IcCode className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {open && <div className="border-t border-line px-3 pb-2">{children}</div>}
      <span className="hidden">{id}</span>
    </div>
  );
}

/** Six dots: the one mark every list that can be reordered wears. */
function IcGrip(p: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
      <circle cx="6" cy="3.5" r="1.4" />
      <circle cx="10" cy="3.5" r="1.4" />
      <circle cx="6" cy="8" r="1.4" />
      <circle cx="10" cy="8" r="1.4" />
      <circle cx="6" cy="12.5" r="1.4" />
      <circle cx="10" cy="12.5" r="1.4" />
    </svg>
  );
}

function Field({
  label,
  type,
  children,
}: {
  label: string;
  type: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="badge bg-slate-100 text-[10px] text-ink-soft">{type}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A colour that may be left empty.
 *
 * Empty means "follow the brand", which is the right default for a section
 * that should keep up with the accent — so this cannot be a bare
 * <input type="color">, which always holds a value. The swatch edits, the text
 * field shows what is actually stored, and Reset puts it back to the brand.
 */
function ColorRow({
  label,
  value,
  fallback,
  onChange,
  input,
  ar,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
  input: string;
  ar: boolean;
}) {
  return (
    <Field label={label} type="color">
      <ColorPicker
        value={value}
        onChange={onChange}
        fallback={fallback}
        allowEmpty
        brand={[fallback]}
        input={input}
        ar={ar}
      />
    </Field>
  );
}

function Toggle({
  on,
  onChange,
  ar,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  ar: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
        on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded border ${
          on ? "border-emerald-600 bg-emerald-600" : "border-line bg-surface"
        }`}
      />
      {on ? (ar ? "مُفعّل" : "On") : ar ? "متوقّف" : "Off"}
    </button>
  );
}

function BlockGroup({
  block,
  ar,
  open,
  highlighted,
  first,
  last,
  index,
  count,
  order,
  collections,
  pages,
  accent,
  input,
  onToggle,
  onHover,
  onPatch,
  onMove,
  onMoveTo,
  onRemove,
  drag,
}: {
  block: Block;
  ar: boolean;
  open: boolean;
  highlighted: boolean;
  first: boolean;
  last: boolean;
  /** Where this section sits, and how many there are. */
  index: number;
  count: number;
  /** Every section in order, so the list can say what it would sit between. */
  order: { id: string; label: string; at: number }[];
  collections: { handle: string; title: string; count: number; image: string | null }[];
  /** The merchant's own pages, so any link here can point at one. */
  pages: { key: string; ar: string; en: string }[];
  /** Shown as the fallback wherever a colour is left empty. */
  accent: string;
  input: string;
  onToggle: () => void;
  onHover: (key: string | null) => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onMove: (by: 1 | -1) => void;
  onMoveTo: (to: number) => void;
  onRemove: () => void;
  /** Handed straight to Group; see the note there. */
  drag: {
    lifted: boolean;
    landing: "above" | "below" | null;
    onLift: () => void;
    onDrop: () => void;
    onOver: (below: boolean) => void;
    onEnd: () => void;
  };
}) {
  const meta = BLOCK_META[block.type];
  const s = block.settings ?? {};
  /** What the merchant called this section, if anything. */
  const ownName = [s.title, s.heading, s.kicker]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find(Boolean);
  const text = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  const num = (k: string, d: number) => (Number(s[k]) > 0 ? Number(s[k]) : d);
  const num0 = (k: string, d: number) => {
    const raw = s[k];
    if (raw === undefined || raw === null || raw === "") return d;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const bool = (k: string, d: boolean) => (typeof s[k] === "boolean" ? (s[k] as boolean) : d);
  const chosen = collections.find((c) => c.handle === text("handle"));

  /**
   * Links in this section pointing at a collection that is not there any more.
   *
   * The picker shows an unknown handle as nothing chosen, so a renamed or
   * deleted collection reads as "no link" while the app still ships the dead
   * one. Saying so here is the difference between a tap that quietly does
   * nothing and a line a merchant can act on.
   */
  const deadLinks = (() => {
    const handles: string[] = [];
    for (const key of ["handle", "seeAllHandle", "replaysHandle", "offerHandle"]) {
      const v = s[key];
      if (typeof v === "string" && v) handles.push(v);
    }
    for (const item of itemsOf(block)) {
      if (typeof item.handle === "string" && item.handle) handles.push(item.handle);
    }
    return [...new Set(handles)].filter((h) => !collections.some((c) => c.handle === h));
  })();

  return (
    <Group
      id={block.id}
      blockKey={block.id}
      highlighted={highlighted}
      onHover={onHover}
      title={ownName || (ar ? meta.ar : meta.en)}
      subtitle={
        ownName
          ? `${ar ? meta.ar : meta.en} · ${componentName(block.type)}.tsx`
          : `${componentName(block.type)}.tsx`
      }
      open={open}
      onToggle={onToggle}
      drag={drag}
      codeHref={`/app/theme/code?file=components/${componentName(block.type)}.tsx`}
      actions={
        <>
          {/* Where it sits. Two arrows are fine for one step and miserable for
              nine, so the place itself is a list: pick it and the section goes
              there. The label says which section it will land on, because "5"
              means nothing next to a screen a merchant is reading by name. */}
          <select
            value={index}
            onChange={(e) => onMoveTo(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            title={ar ? "انقلي القسم إلى مكان" : "Move this section to a place"}
            aria-label={ar ? "ترتيب القسم" : "Section position"}
            className="h-7 w-[4.4rem] shrink-0 rounded-lg border border-line bg-surface px-1 text-[11px] font-medium text-ink-muted"
          >
            {order.map((o) => (
              <option key={o.id} value={o.at}>
                {o.at === index
                  ? (ar ? "مكان " : "No. ") + (o.at + 1)
                  : o.at + 1 + " · " + o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onMove(-1)}
            disabled={first}
            className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
            aria-label={ar ? "لأعلى" : "Move up"}
          >
            <IcUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={last}
            className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
            aria-label={ar ? "لأسفل" : "Move down"}
          >
            <IcDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="btn-ghost h-7 w-7 shrink-0 p-0 text-rose-600"
            aria-label={ar ? "حذف" : "Remove"}
          >
            <IcTrash className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      <p className="pt-2 text-[11px] leading-relaxed text-ink-soft">
        {ar ? meta.hintAr : meta.hintEn}
      </p>

      {deadLinks.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
          <IcAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-[11px] leading-relaxed text-amber-900">
            {ar
              ? "روابط لا تؤدي إلى شيء — هذه الأقسام غير موجودة: "
              : "These links go nowhere — no such collection: "}
            <span className="font-mono">{deadLinks.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Every section gets these two: a line above it, and a colour under it.
          They are what stop a long page reading as one flat list. */}
      <Field label={ar ? "سطر علوي" : "Kicker"} type="text">
        <input
          value={text("kicker")}
          onChange={(e) => onPatch({ kicker: e.target.value })}
          placeholder={ar ? "مثلاً: مختارات الصيف" : "e.g. SUMMER PICKS"}
          className={input}
        />
      </Field>
      <Field label={ar ? "خلفية القسم" : "Section band"} type="select">
        <select
          value={text("band")}
          onChange={(e) => onPatch({ band: e.target.value })}
          className={input}
        >
          <option value="">{ar ? "بلا" : "None"}</option>
          <option value="tint">{ar ? "لمسة من لون الهوية" : "Brand tint"}</option>
          <option value="paper">{ar ? "أبيض" : "White"}</option>
          <option value="divider">{ar ? "خط فاصل أعلى" : "Hairline above"}</option>
        </select>
      </Field>

      {block.type === "banner" && (
        <>
          <Field label={ar ? "الصورة" : "Image"} type="image_picker">
            <input
              value={text("imageUrl")}
              onChange={(e) => onPatch({ imageUrl: e.target.value })}
              placeholder="https://…"
              className={input}
              dir="ltr"
            />
          </Field>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input
              value={text("heading")}
              onChange={(e) => onPatch({ heading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "سطر فرعي" : "Subheading"} type="text">
            <input
              value={text("subheading")}
              onChange={(e) => onPatch({ subheading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{
                handle: text("handle"),
                url: text("url"),
                productId: text("productId"),
                screen: text("screen"),
              }}
              onChange={(next) =>
                onPatch({
                  handle: next.handle ?? "",
                  url: next.url ?? "",
                  productId: next.productId ?? "",
                  screen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
        </>
      )}

      {(block.type === "collection_row" || block.type === "collection_grid") && (
        <>
          <Field label={ar ? "القسم" : "Collection"} type="collection">
            <LinkPicker
              pages={pages}
              value={{ handle: text("handle") }}
              onChange={(next) => onPatch({ handle: next.handle ?? "" })}
              collections={collections}
              input={input}
              ar={ar}
              kinds={["collection"]}
            />
          </Field>
          {text("handle") && (
            <Field label={ar ? "عنوان بديل" : "Title override"} type="text">
              <input
                value={text("title")}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder={chosen?.title ?? ""}
                className={input}
              />
            </Field>
          )}
          <Field label={ar ? "عدد المنتجات" : "How many products"} type="range">
            <input
              type="number"
              min={2}
              max={12}
              value={num("limit", block.type === "collection_row" ? 8 : 6)}
              onChange={(e) => onPatch({ limit: Number(e.target.value) })}
              className={input}
            />
          </Field>
        </>
      )}

      {(block.type === "new_arrivals" ||
        block.type === "reviews" ||
        block.type === "categories") && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input
              value={text("title")}
              onChange={(e) => onPatch({ title: e.target.value })}
              className={input}
            />
          </Field>
          {block.type !== "categories" && (
            <Field label={ar ? "العدد" : "How many"} type="range">
              <input
                type="number"
                min={2}
                max={20}
                value={num("limit", block.type === "reviews" ? 6 : 12)}
                onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                className={input}
              />
            </Field>
          )}
        </>
      )}

      {block.type === "promo_bar" && (
        <>
          <Field label={ar ? "العرض" : "Offer"} type="text">
            <input
              value={text("lead")}
              onChange={(e) => onPatch({ lead: e.target.value })}
              placeholder={ar ? "خصم ١٠٪ على أول طلب" : "Extra 10% off"}
              className={input}
            />
          </Field>
          <Field label={ar ? "تفاصيل" : "Detail"} type="text">
            <input
              value={text("rest")}
              onChange={(e) => onPatch({ rest: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "كود الخصم" : "Discount code"} type="text">
            <input
              value={text("code")}
              onChange={(e) => onPatch({ code: e.target.value.toUpperCase() })}
              className={`${input} font-mono`}
              dir="ltr"
            />
          </Field>
        </>
      )}

      {block.type === "style_profile" && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الشرح" : "Subtitle"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "عنوان البطاقة" : "Card title"} type="text">
            <input
              value={text("cardTitle")}
              onChange={(e) => onPatch({ cardTitle: e.target.value })}
              placeholder={ar ? "ملف {name}" : "{name}'s profile"}
              className={input}
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "‏{name} يُستبدل باسم العميلة، ويُحذف بدون تسجيل دخول."
                : "{name} becomes the shopper's first name, and drops out when nobody is signed in."}
            </p>
          </Field>
          <Field label={ar ? "تحت العنوان" : "Card subtitle"} type="text">
            <input value={text("cardSubtitle")} onChange={(e) => onPatch({ cardSubtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "السطر الأخير" : "Foot note"} type="text">
            <input value={text("footNote")} onChange={(e) => onPatch({ footNote: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الشكل" : "Look"} type="select">
            <select
              value={text("style") || "society"}
              onChange={(e) => onPatch({ style: e.target.value })}
              className={input}
            >
              <option value="society">{ar ? "بطاقة النادي (داكنة وذهبية)" : "Society card (deep and gold)"}</option>
              <option value="plain">{ar ? "بطاقة بيضاء بسيطة" : "Plain white card"}</option>
            </select>
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "بطاقة النادي تأخذ ألوان برنامج الولاء نفسها."
                : "The Society card wears the loyalty club's own colours."}
            </p>
          </Field>
          {(text("style") || "society") === "society" ? (
            <>
              <Field label={ar ? "السطر العلوي" : "Small line above"} type="text">
                <input value={text("kicker")} onChange={(e) => onPatch({ kicker: e.target.value })} placeholder="Your society" className={input} />
              </Field>
              <Field label={ar ? "الرمز" : "Glyph"} type="text">
                <input value={text("glyph")} onChange={(e) => onPatch({ glyph: e.target.value })} placeholder="✦" className={input} />
              </Field>
              <ColorRow label={ar ? "الداكن من" : "Deep from"} value={text("deepFrom")} fallback="#2b2119" onChange={(v) => onPatch({ deepFrom: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "الداكن إلى" : "Deep to"} value={text("deepTo")} fallback="#43301f" onChange={(v) => onPatch({ deepTo: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "الذهبي" : "Gold"} value={text("gold")} fallback="#e0b877" onChange={(v) => onPatch({ gold: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "النص على الداكن" : "Text on the deep"} value={text("onDeep")} fallback="#f0e6d8" onChange={(v) => onPatch({ onDeep: v })} input={input} ar={ar} />
              <Field label={ar ? "البطاقة تفتح" : "The card opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("handle"),
                    url: text("url"),
                    productId: text("productId"),
                    screen: text("screen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      handle: next.handle ?? "",
                      url: next.url ?? "",
                      productId: next.productId ?? "",
                      screen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
            </>
          ) : (
            <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#ffffff" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
          )}
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
        </>
      )}

      {block.type === "review_summary" && (
        <>
          <Field label={ar ? "السطر العلوي الصغير" : "Small line above"} type="text">
            <input value={text("eyebrow")} onChange={(e) => onPatch({ eyebrow: e.target.value })} placeholder="Customer reviews" className={input} />
          </Field>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input value={text("heading")} onChange={(e) => onPatch({ heading: e.target.value })} placeholder="What They're" className={input} />
          </Field>
          <Field label={ar ? "الجزء المائل من العنوان" : "Italic part of the heading"} type="text">
            <input value={text("headingItalic")} onChange={(e) => onPatch({ headingItalic: e.target.value })} placeholder="Saying" className={input} />
          </Field>
          <Field label={ar ? "متوسط التقييم" : "Average score"} type="text">
            <input value={text("average")} onChange={(e) => onPatch({ average: e.target.value })} placeholder="4.9" className={input} />
          </Field>
          <Field label={ar ? "عدد المراجعات" : "Number of reviews"} type="text">
            <input value={text("reviewCount")} onChange={(e) => onPatch({ reviewCount: e.target.value })} placeholder="1,627" className={input} />
          </Field>
          <Field label={ar ? "كلمة «مراجعات»" : "The word after the number"} type="text">
            <input value={text("reviewsWord")} onChange={(e) => onPatch({ reviewsWord: e.target.value })} placeholder="reviews" className={input} />
          </Field>
          <Field label={ar ? "سطر الثقة" : "Trust line"} type="text">
            <input value={text("trustNote")} onChange={(e) => onPatch({ trustNote: e.target.value })} placeholder="Verified buyers" className={input} />
          </Field>
          <div className="grid grid-cols-5 gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <Field key={n} label={(ar ? "٪ " : "% ") + n + "★"} type="range">
                <input type="number" min={0} max={100} value={num("pct" + n, 0)} onChange={(e) => onPatch({ ["pct" + n]: Number(e.target.value) })} className={input} />
              </Field>
            ))}
          </div>
          <Field label={ar ? "نص الزر" : "Button text"} type="text">
            <input value={text("buttonLabel")} onChange={(e) => onPatch({ buttonLabel: e.target.value })} placeholder="Read all reviews" className={input} />
          </Field>
          <Field label={ar ? "البطاقة والزر يفتحان" : "Card and button open"} type="link">
            <LinkPicker
              pages={pages}
              value={{ handle: text("handle"), url: text("url"), productId: text("productId"), screen: text("screen") }}
              onChange={(next) => onPatch({ handle: next.handle ?? "", url: next.url ?? "", productId: next.productId ?? "", screen: next.screen ?? "" })}
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
          <Field label={ar ? "حركة الأشرطة عند الظهور" : "Bars grow into place"} type="checkbox">
            <input type="checkbox" checked={block.settings?.animate !== false} onChange={(e) => onPatch({ animate: e.target.checked })} />
          </Field>
          <Field label={ar ? "حجم رقم التقييم" : "Score size"} type="range">
            <input type="number" min={28} max={90} value={num("avgSize", 58)} onChange={(e) => onPatch({ avgSize: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "استدارة البطاقة" : "Card corners"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 18)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          <ColorRow label={ar ? "خلفية القسم" : "Section background"} value={text("bg")} fallback="#f6f0e8" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "البطاقة — اللون الأول" : "Card colour (top)"} value={text("panelFrom")} fallback="#fdf9f3" onChange={(v) => onPatch({ panelFrom: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "البطاقة — اللون الثاني" : "Card colour (bottom)"} value={text("panelTo")} fallback="#f3e9db" onChange={(v) => onPatch({ panelTo: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون النجوم" : "Star colour"} value={text("starColor")} fallback="#c9a227" onChange={(v) => onPatch({ starColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون خلفية الشريط" : "Bar track colour"} value={text("barTrack")} fallback="#e5dbcd" onChange={(v) => onPatch({ barTrack: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "الشريط — اللون الأول" : "Bar colour (start)"} value={text("barFrom")} fallback="#c9a227" onChange={(v) => onPatch({ barFrom: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "الشريط — اللون الثاني" : "Bar colour (end)"} value={text("barTo")} fallback="#9d6540" onChange={(v) => onPatch({ barTo: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الزر والسطر العلوي" : "Button & small line colour"} value={text("brownColor")} fallback="#684329" onChange={(v) => onPatch({ brownColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الجزء المائل وسطر الثقة" : "Italic & trust line colour"} value={text("accentColor")} fallback="#9d6540" onChange={(v) => onPatch({ accentColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون العنوان والأرقام" : "Heading & figures colour"} value={text("inkColor")} fallback="#211a15" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون النص الخفيف" : "Soft text colour"} value={text("mutedColor")} fallback="#74685e" onChange={(v) => onPatch({ mutedColor: v })} input={input} ar={ar} />
        </>
      )}

      {block.type === "brand_timeline" && (
        <>
          <Field label={ar ? "السطر العلوي الصغير" : "Small line above"} type="text">
            <input value={text("eyebrow")} onChange={(e) => onPatch({ eyebrow: e.target.value })} placeholder="Shop by brand" className={input} />
          </Field>
          <Field label={ar ? "العنوان (اختياري)" : "Heading (optional)"} type="text">
            <input value={text("heading")} onChange={(e) => onPatch({ heading: e.target.value })} placeholder="Timeless Icons. Endless Style." className={input} />
          </Field>
          <Field label={ar ? "سطر تعريفي (اختياري)" : "Intro line (optional)"} type="text">
            <input value={text("intro")} onChange={(e) => onPatch({ intro: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "نص الرابط على البطاقة" : "Link text on the card"} type="text">
            <input value={text("linkLabel")} onChange={(e) => onPatch({ linkLabel: e.target.value })} placeholder="Shop Now" className={input} />
          </Field>
          <Field label={ar ? "التبديل التلقائي كل (ثوانٍ، ٠ = يدوي)" : "Slide every (seconds, 0 = manual)"} type="range">
            <input type="number" min={0} max={15} value={num("autoplay", 3)} onChange={(e) => onPatch({ autoplay: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "ارتفاع البطاقة" : "Card height"} type="range">
            <input type="number" min={100} max={320} value={num("cardHeight", 150)} onChange={(e) => onPatch({ cardHeight: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "استدارة البطاقة" : "Card corners"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 20)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "تعتيم الصورة خلف النص (٪)" : "Shade behind the text (%)"} type="range">
            <input type="number" min={0} max={100} value={num("overlay", 72)} onChange={(e) => onPatch({ overlay: Number(e.target.value) })} className={input} />
          </Field>
          <ColorRow label={ar ? "خلفية القسم" : "Section background"} value={text("bg")} fallback="#f6f0e8" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الدائرة المختارة والشريط" : "Selected circle & bar colour"} value={text("accentColor")} fallback="#9d6540" onChange={(v) => onPatch({ accentColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الشعارات والسطر العلوي" : "Logos & small line colour"} value={text("brownColor")} fallback="#684329" onChange={(v) => onPatch({ brownColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الأسماء" : "Names colour"} value={text("inkColor")} fallback="#211a15" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الخط والحدود" : "Line & border colour"} value={text("lineColor")} fallback="#e0d4c4" onChange={(v) => onPatch({ lineColor: v })} input={input} ar={ar} />
        </>
      )}

      {block.type === "complete_look" && (
        <>
          <p className="rounded-lg bg-surface-page px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
            {ar
              ? "يظهر فقط للعميلات المسجّلات ولهن طلبات سابقة، ويختفي تماماً للزوار. نقترح من الأقسام في قواعد التوافق بالأسفل، دون تكرار ما اشترته العميلة أو ما نفد. إن لم تنطبق أي قاعدة نعرض «العنوان البديل». اكتبي {product} ليظهر اسم آخر قطعة اشترتها."
              : "Only signed-in shoppers with past orders see this; guests never do. Suggestions come from the pairing rules below, never repeating what they bought or anything sold out. When no rule fits their purchases, the fallback title is used. Write {product} to show the last piece they bought."}
          </p>
          <Field label={ar ? "العنوان عند التوافق" : "Title when a rule matches"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Complete your look" className={input} />
          </Field>
          <Field label={ar ? "السطر تحته" : "Line under it"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} placeholder="To go with your {product}" className={input} />
          </Field>
          <Field label={ar ? "العنوان البديل" : "Fallback title"} type="text">
            <input value={text("fallbackTitle")} onChange={(e) => onPatch({ fallbackTitle: e.target.value })} placeholder="Recommended for you" className={input} />
          </Field>
          <Field label={ar ? "السطر البديل" : "Fallback line"} type="text">
            <input value={text("fallbackSubtitle")} onChange={(e) => onPatch({ fallbackSubtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "عدد المنتجات" : "Products shown"} type="range">
            <input type="number" min={2} max={16} value={num("limit", 8)} onChange={(e) => onPatch({ limit: Number(e.target.value) })} className={input} />
          </Field>
        </>
      )}

      {block.type === "promo_card" && (
        <>
          <Field label={ar ? "الشكل" : "Look"} type="select">
            <select value={text("style") || "card"} onChange={(e) => onPatch({ style: e.target.value })} className={input}>
              <option value="card">{ar ? "بطاقة بلون واحد" : "Solid colour card"}</option>
              <option value="banner">{ar ? "بانر الصندوق الغامض" : "Mystery box banner"}</option>
            </select>
          </Field>
          {text("style") === "banner" && (
            <Field label={ar ? "الوسم الصغير" : "Tag"} type="text">
              <input value={text("kicker")} onChange={(e) => onPatch({ kicker: e.target.value })} placeholder="Surprise drop" className={input} />
            </Field>
          )}
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "النص" : "Body"} type="richtext">
            <textarea value={text("body")} onChange={(e) => onPatch({ body: e.target.value })} rows={3} className={`${input} h-auto py-2`} />
          </Field>
          {text("style") === "banner" && (
            <>
              <Field label={ar ? "السعر" : "Price"} type="text">
                <input value={text("price")} onChange={(e) => onPatch({ price: e.target.value })} placeholder="You pay EGP 999" className={input} />
              </Field>
              <Field label={ar ? "القيمة الحقيقية" : "Worth"} type="text">
                <input value={text("worth")} onChange={(e) => onPatch({ worth: e.target.value })} placeholder="Worth up to EGP 2,500" className={input} />
              </Field>
              <Field label={ar ? "ملاحظة الكمية" : "Stock note"} type="text">
                <input value={text("stockNote")} onChange={(e) => onPatch({ stockNote: e.target.value })} placeholder="Only 40 boxes this week" className={input} />
              </Field>
            </>
          )}
          <Field label={ar ? "نص الزر" : "Button text"} type="text">
            <input value={text("buttonLabel")} onChange={(e) => onPatch({ buttonLabel: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{
                handle: text("handle"),
                url: text("url"),
                productId: text("productId"),
                screen: text("screen"),
              }}
              onChange={(next) =>
                onPatch({
                  handle: next.handle ?? "",
                  url: next.url ?? "",
                  productId: next.productId ?? "",
                  screen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
          <Field
            label={
              text("style") === "banner"
                ? ar ? "صورة بدل الصندوق المرسوم" : "Picture instead of the drawn box"
                : ar ? "صورة أعلى البطاقة" : "Picture on top"
            }
            type="image_picker"
          >
            <span className="flex items-center gap-2">
              <ImageUpload onUploaded={(url) => onPatch({ imageUrl: url })} ar={ar} />
              <input value={text("imageUrl")} onChange={(e) => onPatch({ imageUrl: e.target.value })} placeholder="https://…" className={input} dir="ltr" />
            </span>
          </Field>
          <ColorRow
            label={text("style") === "banner" ? (ar ? "لون الخلفية الأول" : "Background (start)") : ar ? "لون البطاقة" : "Card colour"}
            value={text("bg")}
            fallback={text("style") === "banner" ? "#2a1433" : accent}
            onChange={(v) => onPatch({ bg: v })}
            input={input}
            ar={ar}
          />
          {text("style") === "banner" && (
            <>
              <ColorRow label={ar ? "لون الخلفية الثاني" : "Background (end)"} value={text("bg2")} fallback="#8a3b5c" onChange={(v) => onPatch({ bg2: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "لون التوهج والصندوق" : "Glow & box colour"} value={text("glow")} fallback="#f6c453" onChange={(v) => onPatch({ glow: v })} input={input} ar={ar} />
            </>
          )}
          <ColorRow label={ar ? "لون النص" : "Text colour"} value={text("textColor")} fallback="#ffffff" onChange={(v) => onPatch({ textColor: v })} input={input} ar={ar} />
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 16)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          {text("style") === "banner" && (
            <Field label={ar ? "ارتفاع البانر" : "Banner height"} type="range">
              <input type="number" min={140} max={320} value={num("height", 196) || 196} onChange={(e) => onPatch({ height: Number(e.target.value) })} className={input} />
            </Field>
          )}
        </>
      )}

      {block.type === "reviews" && (
        <>
          <Field label={ar ? "سطر التقييم" : "Rating line"} type="text">
            <input
              value={text("ratingLabel")}
              onChange={(e) => onPatch({ ratingLabel: e.target.value })}
              placeholder={ar ? "٤٫٩ من ١٦٢٧ مشترية" : "4.9 from 1,627 buyers"}
              className={input}
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar ? "يحل محل العنوان أعلاه عند كتابته." : "Replaces the title above when set."}
            </p>
          </Field>
          <Field label={ar ? "الشرح" : "Subtitle"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "نص «الكل»" : "See-all text"} type="text">
            <input value={text("seeAllLabel")} onChange={(e) => onPatch({ seeAllLabel: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{
                handle: text("seeAllHandle"),
                url: text("seeAllUrl"),
                productId: text("seeAllProductId"),
                screen: text("seeAllScreen"),
              }}
              onChange={(next) =>
                onPatch({
                  seeAllHandle: next.handle ?? "",
                  seeAllUrl: next.url ?? "",
                  seeAllProductId: next.productId ?? "",
                  seeAllScreen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
        </>
      )}

      {(block.type === "product_reasons" ||
        block.type === "circle_row" ||
        block.type === "pick_colour" ||
        block.type === "price_drop") && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الشرح" : "Subtitle"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>

          {(block.type === "product_reasons" || block.type === "circle_row") && (
            <>
              <Field label={ar ? "نص «الكل»" : "See-all text"} type="text">
                <input
                  value={text("seeAllLabel")}
                  onChange={(e) => onPatch({ seeAllLabel: e.target.value })}
                  placeholder={ar ? "اتركيه فارغاً بلا زر" : "Leave empty for no link"}
                  className={input}
                />
              </Field>
              <Field label={ar ? "يفتح" : "Opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("seeAllHandle"),
                    url: text("seeAllUrl"),
                    productId: text("seeAllProductId"),
                    screen: text("seeAllScreen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      seeAllHandle: next.handle ?? "",
                      seeAllUrl: next.url ?? "",
                      seeAllProductId: next.productId ?? "",
                      seeAllScreen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
            </>
          )}

          {block.type === "product_reasons" && (
            <>
              <Field label={ar ? "أول بطاقة أكبر" : "First card leads"} type="checkbox">
                <Toggle on={bool("featureFirst", false)} onChange={(v) => onPatch({ featureFirst: v })} ar={ar} />
              </Field>
              <Field label={ar ? "نص الزر" : "Button text"} type="text">
                <input
                  value={text("buttonLabel")}
                  onChange={(e) => onPatch({ buttonLabel: e.target.value })}
                  placeholder={ar ? "اتركيه فارغاً بلا زر" : "Leave empty for no button"}
                  className={input}
                />
              </Field>
              <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
                <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
              </Field>
            </>
          )}

          {block.type === "circle_row" && (
            <>
              <Field label={ar ? "شكل الصورة" : "Picture shape"} type="select">
                <select
                  value={text("shape") || "circle"}
                  onChange={(e) => onPatch({ shape: e.target.value })}
                  className={input}
                >
                  <option value="circle">{ar ? "دائرة" : "Circle"}</option>
                  <option value="rounded">{ar ? "مربع بحواف مستديرة" : "Rounded tile"}</option>
                  <option value="square">{ar ? "مربع" : "Square"}</option>
                </select>
              </Field>
              {text("shape") === "rounded" && (
                <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
                  <input type="number" min={2} max={60} value={num("radius", 22)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
                </Field>
              )}
              <Field label={ar ? "مقاس الصورة" : "Picture size"} type="range">
                <input type="number" min={32} max={160} value={num("size", 64)} onChange={(e) => onPatch({ size: Number(e.target.value) })} className={input} />
              </Field>
              <Field label={ar ? "مقاس العنوان" : "Heading size"} type="range">
                <input type="number" min={12} max={32} value={num("titleSize", 16)} onChange={(e) => onPatch({ titleSize: Number(e.target.value) })} className={input} />
              </Field>
              <Field label={ar ? "مقاس الاسم" : "Label size"} type="range">
                <input type="number" min={8} max={20} value={num("labelSize", 10)} onChange={(e) => onPatch({ labelSize: Number(e.target.value) })} className={input} />
              </Field>
              <Field label={ar ? "اسم عريض" : "Bold label"} type="checkbox">
                <Toggle on={bool("labelBold", false)} onChange={(v) => onPatch({ labelBold: v })} ar={ar} />
              </Field>
              <ColorRow label={ar ? "لون الاسم" : "Label colour"} value={text("labelColor")} fallback="#64748b" onChange={(v) => onPatch({ labelColor: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "لون رابط «الكل»" : "See-all link colour"} value={text("linkColor")} fallback={accent} onChange={(v) => onPatch({ linkColor: v })} input={input} ar={ar} />
              <ColorRow label={ar ? "خلفية القسم" : "Section background"} value={text("bg")} fallback="#f3f3f3" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
              <Field label={ar ? "إظهار الاسم" : "Show label"} type="checkbox">
                <Toggle on={bool("showLabel", true)} onChange={(v) => onPatch({ showLabel: v })} ar={ar} />
              </Field>
              <Field label={ar ? "إظهار السطر تحته" : "Show the line under it"} type="checkbox">
                <Toggle on={bool("showNote", true)} onChange={(v) => onPatch({ showNote: v })} ar={ar} />
              </Field>
            </>
          )}

          {block.type === "pick_colour" && (
            <>
              <Field label={ar ? "الشكل" : "Look"} type="select">
                <select value={text("style") || "swatches"} onChange={(e) => onPatch({ style: e.target.value })} className={input}>
                  <option value="swatches">{ar ? "دوائر ألوان" : "Colour circles"}</option>
                  <option value="palette">{ar ? "لوحة الألوان (مثل الموقع)" : "Shop by palette (as on the website)"}</option>
                </select>
              </Field>
              {text("style") !== "palette" ? (
                <Field label={ar ? "مقاس الدائرة" : "Circle size"} type="range">
                  <input type="number" min={24} max={80} value={num("size", 44)} onChange={(e) => onPatch({ size: Number(e.target.value) })} className={input} />
                </Field>
              ) : (
                <>
                  <Field label={ar ? "السطر العلوي الصغير" : "Small line above"} type="text">
                    <input value={text("eyebrow")} onChange={(e) => onPatch({ eyebrow: e.target.value })} placeholder="Curated Aesthetics" className={input} />
                  </Field>
                  <Field label={ar ? "نص الرابط في كل بطاقة" : "Link text on each card"} type="text">
                    <input value={text("linkLabel")} onChange={(e) => onPatch({ linkLabel: e.target.value })} placeholder="Shop now" className={input} />
                  </Field>
                  <Field label={ar ? "سطر الزر السفلي" : "Bottom pill line"} type="text">
                    <input value={text("pillText")} onChange={(e) => onPatch({ pillText: e.target.value })} placeholder="Not sure where to start?" className={input} />
                  </Field>
                  <Field label={ar ? "نص الزر السفلي" : "Bottom pill button"} type="text">
                    <input value={text("pillCta")} onChange={(e) => onPatch({ pillCta: e.target.value })} placeholder="Explore all collections" className={input} />
                  </Field>
                  <Field label={ar ? "الزر السفلي يفتح" : "Bottom pill opens"} type="link">
                    <LinkPicker
                      pages={pages}
                      value={{
                        handle: text("pillHandle"),
                        url: text("pillUrl"),
                        productId: text("pillProductId"),
                        screen: text("pillScreen"),
                      }}
                      onChange={(next) =>
                        onPatch({
                          pillHandle: next.handle ?? "",
                          pillUrl: next.url ?? "",
                          pillProductId: next.productId ?? "",
                          pillScreen: next.screen ?? "",
                        })
                      }
                      collections={collections}
                      input={input}
                      ar={ar}
                    />
                  </Field>
                  <Field label={ar ? "حجم العنوان" : "Heading size"} type="range">
                    <input type="number" min={16} max={44} value={num("titleSize", 28)} onChange={(e) => onPatch({ titleSize: Number(e.target.value) })} className={input} />
                  </Field>
                  <Field label={ar ? "ارتفاع الصورة" : "Picture height"} type="range">
                    <input type="number" min={60} max={220} value={num("imageHeight", 104)} onChange={(e) => onPatch({ imageHeight: Number(e.target.value) })} className={input} />
                  </Field>
                  <Field label={ar ? "عرض البطاقة (٠ = كلها في صف)" : "Card width (0 = all in one row)"} type="range">
                    <input type="number" min={0} max={200} value={num("cardWidth", 0)} onChange={(e) => onPatch({ cardWidth: Number(e.target.value) })} className={input} />
                  </Field>
                  <Field label={ar ? "مقاس دائرة اللون" : "Swatch size"} type="range">
                    <input type="number" min={12} max={40} value={num("swatchSize", 22)} onChange={(e) => onPatch({ swatchSize: Number(e.target.value) })} className={input} />
                  </Field>
                  <Field label={ar ? "استدارة البطاقة" : "Card corners"} type="range">
                    <input type="number" min={0} max={28} value={num("radius", 12)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
                  </Field>
                  <ColorRow label={ar ? "خلفية القسم" : "Section background"} value={text("bg")} fallback="#f6f0e8" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#fffdfa" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "لون النص" : "Text colour"} value={text("inkColor")} fallback="#211a15" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "لون النص الخفيف" : "Soft text colour"} value={text("mutedColor")} fallback="#74685e" onChange={(v) => onPatch({ mutedColor: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "لون التمييز" : "Accent colour"} value={text("accentColor")} fallback="#9d6540" onChange={(v) => onPatch({ accentColor: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "لون الحدود" : "Border colour"} value={text("lineColor")} fallback="#e0d4c4" onChange={(v) => onPatch({ lineColor: v })} input={input} ar={ar} />
                  <ColorRow label={ar ? "خلفية الزر السفلي" : "Pill background"} value={text("pillBg")} fallback="#f1e7d9" onChange={(v) => onPatch({ pillBg: v })} input={input} ar={ar} />
                </>
              )}
            </>
          )}

          {block.type === "price_drop" && (
            <>
              <Field label={ar ? "نص الزر" : "Button text"} type="text">
                <input value={text("buttonLabel")} onChange={(e) => onPatch({ buttonLabel: e.target.value })} className={input} />
              </Field>
              <Field label={ar ? "يفتح" : "Opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("handle"),
                    url: text("url"),
                    productId: text("productId"),
                    screen: text("screen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      handle: next.handle ?? "",
                      url: next.url ?? "",
                      productId: next.productId ?? "",
                      screen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
              <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#ffffff" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
              <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
                <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
              </Field>
            </>
          )}
        </>
      )}

      {block.type === "showcase" && (
        <>
          <Field label={ar ? "الصورة" : "Picture"} type="image_picker">
            <span className="flex items-center gap-2">
              {text("imageUrl") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={text("imageUrl")} alt="" className="h-9 w-12 shrink-0 rounded-lg border border-line object-cover" />
              ) : null}
              <ImageUpload onUploaded={(url) => onPatch({ imageUrl: url })} ar={ar} />
              <input
                value={text("imageUrl")}
                onChange={(e) => onPatch({ imageUrl: e.target.value })}
                placeholder="https://…"
                className={input}
                dir="ltr"
              />
            </span>
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar ? "اتركيها فارغة لتأخذ صورة القسم المرتبط." : "Leave empty to borrow the linked collection's picture."}
            </p>
          </Field>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input value={text("heading")} onChange={(e) => onPatch({ heading: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "سطر تحته" : "Subheading"} type="text">
            <input value={text("subheading")} onChange={(e) => onPatch({ subheading: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "نص الزر" : "Button text"} type="text">
            <input
              value={text("buttonLabel")}
              onChange={(e) => onPatch({ buttonLabel: e.target.value })}
              placeholder={ar ? "اتركيه فارغاً بلا زر" : "Leave empty for no button"}
              className={input}
            />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{
                handle: text("handle"),
                url: text("url"),
                productId: text("productId"),
                screen: text("screen"),
              }}
              onChange={(next) =>
                onPatch({
                  handle: next.handle ?? "",
                  url: next.url ?? "",
                  productId: next.productId ?? "",
                  screen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
          <Field label={ar ? "الارتفاع" : "Height"} type="range">
            <input type="number" min={180} max={640} value={num("height", 360)} onChange={(e) => onPatch({ height: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "تعتيم الصورة ٪" : "Darken the picture (%)"} type="range">
            <input
              type="number"
              min={0}
              max={90}
              value={Number.isFinite(Number(s.overlay)) ? Number(s.overlay) : 45}
              onChange={(e) => onPatch({ overlay: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "مكان الكلام" : "Where the words sit"} type="select">
            <select value={text("align") || "bottom"} onChange={(e) => onPatch({ align: e.target.value })} className={input}>
              <option value="bottom">{ar ? "أسفل" : "Bottom"}</option>
              <option value="center">{ar ? "المنتصف" : "Centre"}</option>
            </select>
          </Field>
          <ColorRow label={ar ? "لون الكلام" : "Text colour"} value={text("textColor")} fallback="#ffffff" onChange={(v) => onPatch({ textColor: v })} input={input} ar={ar} />
        </>
      )}

      {block.type === "shipping_goal" && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الشرح" : "Subtitle"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "بداية الشريط" : "Start label"} type="text">
            <input value={text("startLabel")} onChange={(e) => onPatch({ startLabel: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "نهاية الشريط" : "End label"} type="text">
            <input value={text("endLabel")} onChange={(e) => onPatch({ endLabel: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "نسبة الامتلاء ٪" : "How full (%)"} type="range">
            <input
              type="number"
              min={0}
              max={100}
              value={Number.isFinite(Number(s.percent)) ? Number(s.percent) : 100}
              onChange={(e) => onPatch({ percent: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <ColorRow label={ar ? "لون الشريط" : "Bar colour"} value={text("barColor")} fallback={accent} onChange={(v) => onPatch({ barColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#ffffff" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
        </>
      )}

      {(block.type === "payment_plans" || block.type === "price_slider" || block.type === "offer_cards") && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الشرح" : "Subtitle"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>

          {block.type === "payment_plans" && (
            <>
              <Field label={ar ? "نص «الكل»" : "See-all text"} type="text">
                <input value={text("seeAllLabel")} onChange={(e) => onPatch({ seeAllLabel: e.target.value })} className={input} />
              </Field>
              <Field label={ar ? "يفتح" : "Opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("seeAllHandle"),
                    url: text("seeAllUrl"),
                    productId: text("seeAllProductId"),
                    screen: text("seeAllScreen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      seeAllHandle: next.handle ?? "",
                      seeAllUrl: next.url ?? "",
                      seeAllProductId: next.productId ?? "",
                      seeAllScreen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
            </>
          )}

          {block.type === "price_slider" && (
            <>
              <Field label={ar ? "كلمة السعر" : "Price label"} type="text">
                <input value={text("priceLabel")} onChange={(e) => onPatch({ priceLabel: e.target.value })} className={input} />
              </Field>
              <Field label={ar ? "العملة" : "Currency"} type="text">
                <input value={text("currency")} onChange={(e) => onPatch({ currency: e.target.value })} placeholder="EGP" className={input} />
              </Field>
              <Field label={ar ? "أقل سعر" : "Lowest price"} type="range">
                <input type="number" min={1} value={num("minPrice", 2999)} onChange={(e) => onPatch({ minPrice: Number(e.target.value) })} className={input} />
              </Field>
              <Field label={ar ? "أعلى سعر" : "Highest price"} type="range">
                <input type="number" min={2} value={num("maxPrice", 16000)} onChange={(e) => onPatch({ maxPrice: Number(e.target.value) })} className={input} />
              </Field>
              <Field label={ar ? "السعر عند الفتح" : "Opens at"} type="range">
                <input type="number" min={1} value={num("startPrice", 7750)} onChange={(e) => onPatch({ startPrice: Number(e.target.value) })} className={input} />
              </Field>
              <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#ffffff" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
            </>
          )}

          {block.type === "offer_cards" && (
            <Field label={ar ? "نص الزر" : "Button text"} type="text">
              <input value={text("claimLabel")} onChange={(e) => onPatch({ claimLabel: e.target.value })} className={input} />
            </Field>
          )}

          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
        </>
      )}

      {(block.type === "live_now" || block.type === "coming_up_live") && (
        // The items below are no longer what the app shows: these two rows
        // read the shop's real lives, so a row can never advertise a live
        // nobody can watch or stay silent about one that is running.
        <p className="mb-3 rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
          {ar
            ? "يعرض هذا القسم البثوث الحقيقية من صفحة «البث المباشر» — بالصورة التي تختارينها عند إنشاء البث. لا حاجة لكتابتها هنا."
            : "This section shows your real lives from the Lives page, with the cover you choose when creating each one. Nothing needs typing here."}
        </p>
      )}
      {(block.type === "coming_up_live" ||
        block.type === "countdown_deals" ||
        block.type === "info_rows") && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input
              value={text("title")}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder={ar ? "اتركيه فارغاً بلا عنوان" : "Leave empty for no heading"}
              className={input}
            />
          </Field>

          {block.type === "coming_up_live" && (
            <>
            <Field label={ar ? "نص الزر" : "Button text"} type="text">
              <input
                value={text("remindLabel")}
                onChange={(e) => onPatch({ remindLabel: e.target.value })}
                placeholder={ar ? "ذكّريني" : "Remind me"}
                className={input}
              />
            </Field>
            <Field label={ar ? "نص الزر بعد الضغط" : "Button text once set"} type="text">
              <input
                value={text("remindedLabel")}
                onChange={(e) => onPatch({ remindedLabel: e.target.value })}
                placeholder={ar ? "تم التذكير" : "Reminder set"}
                className={input}
              />
            </Field>
            </>
          )}

          {block.type === "countdown_deals" && (
            <>
              <Field label={ar ? "العدّاد" : "Countdown"} type="checkbox">
                <Toggle on={bool("showTimer", true)} onChange={(v) => onPatch({ showTimer: v })} ar={ar} />
              </Field>
              {bool("showTimer", true) && (
                <Field label={ar ? "ينتهي بعد (دقائق)" : "Ends in (minutes)"} type="range">
                  <input
                    type="number"
                    min={1}
                    max={2880}
                    value={num("endsInMinutes", 135)}
                    onChange={(e) => onPatch({ endsInMinutes: Number(e.target.value) })}
                    className={input}
                  />
                </Field>
              )}
              <Field label={ar ? "شريط المباع" : "Claimed bar"} type="checkbox">
                <Toggle on={bool("showClaimed", true)} onChange={(v) => onPatch({ showClaimed: v })} ar={ar} />
              </Field>
              <ColorRow
                label={ar ? "لون الشارة" : "Badge colour"}
                value={text("badgeBg")}
                fallback={accent}
                onChange={(v) => onPatch({ badgeBg: v })}
                input={input}
                ar={ar}
              />
              <Field label={ar ? "أول بطاقة أكبر" : "First card leads"} type="checkbox">
                <Toggle on={bool("featureFirst", false)} onChange={(v) => onPatch({ featureFirst: v })} ar={ar} />
              </Field>
            </>
          )}

          {(block.type === "coming_up_live" || block.type === "info_rows") && (
            <ColorRow
              label={ar ? "خلفية البطاقة" : "Card background"}
              value={text("cardBg")}
              fallback="#ffffff"
              onChange={(v) => onPatch({ cardBg: v })}
              input={input}
              ar={ar}
            />
          )}

          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input
              type="number"
              min={0}
              max={32}
              value={num("radius", block.type === "coming_up_live" ? 16 : 14)}
              onChange={(e) => onPatch({ radius: Number(e.target.value) })}
              className={input}
            />
          </Field>
        </>
      )}

      {block.type === "live_now" && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input
              value={text("title")}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder={ar ? "اتركيه فارغاً بلا عنوان" : "Leave empty for no heading"}
              className={input}
            />
          </Field>
          <Field label={ar ? "كلمة المسجّل" : "Replay label"} type="text">
            <input value={text("replayBadge")} onChange={(e) => onPatch({ replayBadge: e.target.value })} placeholder={ar ? "مسجّل" : "Replay"} className={input} />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "الدوائر التي تحمل رابط فيديو تظهر دائمًا؛ ومن يبثّ الآن يتقدّمها."
                : "Circles with a video link are always there; whoever is on air now goes in front of them."}
            </p>
          </Field>
          <Field label={ar ? "كلمة الشارة" : "Live badge word"} type="text">
            <input
              value={text("liveLabel")}
              onChange={(e) => onPatch({ liveLabel: e.target.value })}
              placeholder="LIVE"
              className={input}
            />
          </Field>

          <Field label={ar ? "زر المسجّلة" : "Replays circle"} type="checkbox">
            <Toggle on={bool("showReplays", true)} onChange={(v) => onPatch({ showReplays: v })} ar={ar} />
          </Field>
          {bool("showReplays", true) && (
            <>
              <Field label={ar ? "اسم الزر" : "Replays label"} type="text">
                <input
                  value={text("replaysLabel")}
                  onChange={(e) => onPatch({ replaysLabel: e.target.value })}
                  placeholder={ar ? "المسجّلة" : "Replays"}
                  className={input}
                />
              </Field>
              <Field label={ar ? "يفتح" : "Opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("replaysHandle"),
                    url: text("replaysUrl"),
                    productId: text("replaysProductId"),
                    screen: text("replaysScreen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      replaysHandle: next.handle ?? "",
                      replaysUrl: next.url ?? "",
                      replaysProductId: next.productId ?? "",
                      replaysScreen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
            </>
          )}

          <Field label={ar ? "العرض الخاص" : "Private offer"} type="checkbox">
            <Toggle on={bool("offerEnabled", true)} onChange={(v) => onPatch({ offerEnabled: v })} ar={ar} />
          </Field>
          {bool("offerEnabled", true) && (
            <>
              <Field label={ar ? "سطر العرض" : "Offer line"} type="text">
                <input
                  value={text("offerTitle")}
                  onChange={(e) => onPatch({ offerTitle: e.target.value })}
                  placeholder={ar ? "{name}، عرضك الخاص متاح الآن" : "{name}, your private offer is live"}
                  className={input}
                />
                <p className="mt-1 text-[11px] text-ink-soft">
                  {ar
                    ? "‏{name} يُستبدل باسم العميلة. بدون تسجيل دخول يُحذف الاسم ويبدأ السطر بعده."
                    : "{name} becomes the shopper's first name. Signed out, the token is dropped and the line starts after it."}
                </p>
              </Field>
              <Field label={ar ? "التفاصيل" : "Detail"} type="text">
                <input
                  value={text("offerText")}
                  onChange={(e) => onPatch({ offerText: e.target.value })}
                  placeholder={ar ? "خصم ٤٠٠ ج.م على أي طلب فوق ٥٠٠٠" : "EGP 400 off anything over 5,000"}
                  className={input}
                />
              </Field>
              <Field label={ar ? "مدة العدّاد (دقائق)" : "Countdown (minutes)"} type="range">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={num("offerMinutes", 10)}
                  onChange={(e) => onPatch({ offerMinutes: Number(e.target.value) })}
                  className={input}
                />
              </Field>
              <Field label={ar ? "يفتح" : "Opens"} type="link">
                <LinkPicker
                  pages={pages}
                  value={{
                    handle: text("offerHandle"),
                    url: text("offerUrl"),
                    productId: text("offerProductId"),
                    screen: text("offerScreen"),
                  }}
                  onChange={(next) =>
                    onPatch({
                      offerHandle: next.handle ?? "",
                      offerUrl: next.url ?? "",
                      offerProductId: next.productId ?? "",
                      offerScreen: next.screen ?? "",
                    })
                  }
                  collections={collections}
                  input={input}
                  ar={ar}
                />
              </Field>
            </>
          )}

          <div className="mt-3 border-t border-line pt-3 text-[11px] font-semibold text-ink-muted">
            {ar ? "الشكل والمقاس" : "Shape and size"}
          </div>
          <Field label={ar ? "شكل الصورة" : "Photo shape"} type="select">
            <select
              value={text("avatarShape") || "circle"}
              onChange={(e) => onPatch({ avatarShape: e.target.value })}
              className={input}
            >
              <option value="circle">{ar ? "دائرة" : "Circle"}</option>
              <option value="rounded">{ar ? "مربع بحواف" : "Rounded square"}</option>
              <option value="square">{ar ? "مربع" : "Square"}</option>
            </select>
          </Field>
          <Field label={ar ? "مقاس الصورة" : "Photo size"} type="range">
            <input
              type="number"
              min={32}
              max={120}
              value={num("avatarSize", 56)}
              onChange={(e) => onPatch({ avatarSize: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "سُمك الإطار" : "Ring width"} type="range">
            <input
              type="number"
              min={0}
              max={8}
              value={Number.isFinite(Number(s.ringWidth)) ? Number(s.ringWidth) : 2}
              onChange={(e) => onPatch({ ringWidth: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "حجم الاسم" : "Name size"} type="range">
            <input
              type="number"
              min={8}
              max={20}
              value={num("nameSize", 10)}
              onChange={(e) => onPatch({ nameSize: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "حجم عدد المشاهدين" : "Viewers size"} type="range">
            <input
              type="number"
              min={7}
              max={18}
              value={num("viewersSize", 9)}
              onChange={(e) => onPatch({ viewersSize: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "المسافة فوق البانر" : "Space above the banner"} type="range">
            <input
              type="number"
              min={0}
              max={48}
              value={num0("offerGap", 12)}
              onChange={(e) => onPatch({ offerGap: Number(e.target.value) })}
              className={input}
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "المسافة بين صف الدوائر والبانر."
                : "The gap between the row of circles and the banner."}
            </p>
          </Field>
          <Field label={ar ? "ارتفاع البانر" : "Banner height"} type="range">
            <input
              type="number"
              min={0}
              max={160}
              value={num0("offerHeight", 0)}
              onChange={(e) => onPatch({ offerHeight: Number(e.target.value) })}
              className={input}
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "صفر يعني أن ارتفاعه يتبع نصّه."
                : "Zero means it is as tall as its wording makes it."}
            </p>
          </Field>
          <Field label={ar ? "استدارة البانر" : "Banner corners"} type="range">
            <input
              type="number"
              min={0}
              max={32}
              value={num("bannerRadius", 16)}
              onChange={(e) => onPatch({ bannerRadius: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "حجم سطر العرض" : "Offer line size"} type="range">
            <input
              type="number"
              min={10}
              max={22}
              value={num("offerTitleSize", 13)}
              onChange={(e) => onPatch({ offerTitleSize: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label={ar ? "حجم التفاصيل" : "Detail size"} type="range">
            <input
              type="number"
              min={8}
              max={18}
              value={num("offerTextSize", 11)}
              onChange={(e) => onPatch({ offerTextSize: Number(e.target.value) })}
              className={input}
            />
          </Field>

          <div className="mt-3 border-t border-line pt-3 text-[11px] font-semibold text-ink-muted">
            {ar ? "الألوان" : "Colours"}
          </div>
          <ColorRow label={ar ? "الإطار" : "Photo ring"} value={text("ringColor")} fallback={accent} onChange={(v) => onPatch({ ringColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "خلفية الشارة" : "Badge background"} value={text("badgeBg")} fallback="#e11d48" onChange={(v) => onPatch({ badgeBg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون كلمة الشارة" : "Badge text"} value={text("badgeTextColor")} fallback="#ffffff" onChange={(v) => onPatch({ badgeTextColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "خلفية البانر" : "Banner background"} value={text("offerBg")} fallback={accent} onChange={(v) => onPatch({ offerBg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "نص البانر" : "Banner text"} value={text("offerTextColor")} fallback="#ffffff" onChange={(v) => onPatch({ offerTextColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "خلفية العدّاد" : "Timer background"} value={text("timerBg")} fallback="#ffffff" onChange={(v) => onPatch({ timerBg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "نص العدّاد" : "Timer text"} value={text("timerTextColor")} fallback="#ffffff" onChange={(v) => onPatch({ timerTextColor: v })} input={input} ar={ar} />
        </>
      )}

      {block.type === "sale_seal" && (
        <>
          <Field label={ar ? "الترتيب" : "Layout"} type="select">
            <select value={text("layout") || "split"} onChange={(e) => onPatch({ layout: e.target.value })} className={input}>
              <option value="split">{ar ? "الصورة بجانب اللوح" : "Picture beside the panel"}</option>
              <option value="stacked">{ar ? "الصورة تحت اللوح" : "Picture under the panel"}</option>
            </select>
          </Field>
          <Field label={ar ? "النص حول الختم" : "Words around the seal"} type="text">
            <input value={text("ringText")} onChange={(e) => onPatch({ ringText: e.target.value })} placeholder="Shop now · Summer sale · Luxury for less" className={input} />
          </Field>
          <Field label={ar ? "الرقم" : "The number"} type="text">
            <span className="flex items-center gap-2">
              <input value={text("bigText")} onChange={(e) => onPatch({ bigText: e.target.value })} placeholder="70%" className={input} />
              <input value={text("smallText")} onChange={(e) => onPatch({ smallText: e.target.value })} placeholder="off" className={input} />
            </span>
          </Field>
          <Field label={ar ? "السطر تحته" : "Line underneath"} type="text">
            <input value={text("tagline")} onChange={(e) => onPatch({ tagline: e.target.value })} placeholder="Luxury you love, now for less." className={input} />
          </Field>
          <Field label={ar ? "الزر" : "Button"} type="text">
            <input value={text("buttonLabel")} onChange={(e) => onPatch({ buttonLabel: e.target.value })} placeholder="Shop now" className={input} />
          </Field>
          <Field label={ar ? "الصورة" : "Picture"} type="image_picker">
            <span className="flex items-center gap-2">
              {text("imageUrl") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={text("imageUrl")} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover" />
              ) : null}
              <ImageUpload onUploaded={(url) => onPatch({ imageUrl: url })} ar={ar} />
              <input value={text("imageUrl")} onChange={(e) => onPatch({ imageUrl: e.target.value })} placeholder="https://…" className={input} dir="ltr" />
            </span>
          </Field>
          <Field label={ar ? "موضع الصورة" : "Picture position"} type="text">
            <input value={text("focal")} onChange={(e) => onPatch({ focal: e.target.value })} placeholder="50% 50%" className={input} dir="ltr" />
          </Field>
          <Field label={ar ? "الشارة على الصورة" : "Chip on the picture"} type="text">
            <input value={text("badge")} onChange={(e) => onPatch({ badge: e.target.value })} placeholder="-46%" className={input} />
          </Field>
          <ColorRow label={ar ? "خلفية الشارة" : "Chip background"} value={text("badgeBg")} fallback="#2b1b10" onChange={(v) => onPatch({ badgeBg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "اللوح من" : "Panel from"} value={text("bg")} fallback="#7a4b27" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "اللوح إلى" : "Panel to"} value={text("bg2")} fallback="#9d6540" onChange={(v) => onPatch({ bg2: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون النص" : "Text"} value={text("inkColor")} fallback="#ffffff" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الختم" : "Seal"} value={text("ringColor")} fallback="#ffffff" onChange={(v) => onPatch({ ringColor: v })} input={input} ar={ar} />
          <Field label={ar ? "الارتفاع" : "Height"} type="range">
            <input type="number" min={160} max={360} value={num("height", 230)} onChange={(e) => onPatch({ height: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 18)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{ handle: text("handle"), url: text("url"), productId: text("productId"), screen: text("screen") }}
              onChange={(next) =>
                onPatch({
                  handle: next.handle ?? "",
                  url: next.url ?? "",
                  productId: next.productId ?? "",
                  screen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
        </>
      )}

      {block.type === "free_shipping" && (
        <>
          <Field label={ar ? "الشكل" : "Look"} type="select">
            <select value={text("style") || "photo"} onChange={(e) => onPatch({ style: e.target.value })} className={input}>
              <option value="ticket">{ar ? "تذكرة توصيل" : "A delivery ticket"}</option>
              <option value="bold">{ar ? "سعر مشطوب (الأوضح)" : "Priced at nothing (boldest)"}</option>
              <option value="rule">{ar ? "سطر بين خطين (الأصغر)" : "A rule, not a banner (smallest)"}</option>
              <option value="photo">{ar ? "فوق صورة" : "Over a photograph"}</option>
              <option value="ribbon">{ar ? "شريط متحرك عبر الشاشة" : "Ribbon of type across the screen"}</option>
              <option value="editorial">{ar ? "سطر هادئ بلا زخرفة" : "Quiet editorial line"}</option>
              <option value="banner">{ar ? "ظرف بريد جوي" : "Air-mail envelope"}</option>
              <option value="strip">{ar ? "صف واحد صغير" : "One quiet row"}</option>
            </select>
          </Field>
          <Field label={ar ? "السطر العلوي" : "Small line above"} type="text">
            <input value={text("kicker")} onChange={(e) => onPatch({ kicker: e.target.value })} placeholder="Delivered on us" className={input} />
          </Field>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Free shipping" className={input} />
          </Field>
          <Field label={ar ? "السطر تحته" : "Line underneath"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} placeholder="on every order over EGP 2,000" className={input} />
          </Field>
          <Field label={ar ? "الزر" : "Button"} type="text">
            <input value={text("buttonLabel")} onChange={(e) => onPatch({ buttonLabel: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "السطر الأخير" : "Small print"} type="text">
            <input value={text("note")} onChange={(e) => onPatch({ note: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "الصورة" : "Picture"} type="image_picker">
            <span className="flex items-center gap-2">
              {text("imageUrl") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={text("imageUrl")} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover" />
              ) : null}
              <ImageUpload onUploaded={(url) => onPatch({ imageUrl: url })} ar={ar} />
              <input value={text("imageUrl")} onChange={(e) => onPatch({ imageUrl: e.target.value })} placeholder="https://…" className={input} dir="ltr" />
            </span>
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar ? "تُستخدم مع شكل «فوق صورة»." : "Used by the \"Over a photograph\" look."}
            </p>
          </Field>
          <Field label={ar ? "موضع الصورة" : "Picture position"} type="text">
            <input value={text("focal")} onChange={(e) => onPatch({ focal: e.target.value })} placeholder="50% 45%" className={input} dir="ltr" />
          </Field>
          <Field label={ar ? "الكلمة الكبيرة" : "The big word"} type="text">
            <span className="flex items-center gap-2">
              <input value={text("bigWord")} onChange={(e) => onPatch({ bigWord: e.target.value })} placeholder="FREE" className={input} />
              <input value={text("smallWord")} onChange={(e) => onPatch({ smallWord: e.target.value })} placeholder="Delivery" className={input} />
            </span>
          </Field>
          <Field label={ar ? "السعر المشطوب" : "The price crossed out"} type="text">
            <span className="flex items-center gap-2">
              <input value={text("wasLabel")} onChange={(e) => onPatch({ wasLabel: e.target.value })} placeholder="was" className={input} />
              <input value={text("wasPrice")} onChange={(e) => onPatch({ wasPrice: e.target.value })} placeholder="EGP 60" className={input} />
            </span>
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar ? "اتركيه فارغًا ليختفي." : "Leave it empty and it goes."}
            </p>
          </Field>
          <Field label={ar ? "الطابع" : "The stamp"} type="text">
            <span className="flex items-center gap-2">
              <input value={text("stampTop")} onChange={(e) => onPatch({ stampTop: e.target.value })} placeholder="EGP" className={input} />
              <input value={text("stampBig")} onChange={(e) => onPatch({ stampBig: e.target.value })} placeholder="2,000" className={input} />
              <input value={text("stampBottom")} onChange={(e) => onPatch({ stampBottom: e.target.value })} placeholder="and over" className={input} />
            </span>
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar ? "اتركيها فارغة ليختفي الطابع." : "Leave them empty and the stamp goes."}
            </p>
          </Field>
          <ColorRow label={ar ? "الورق" : "Paper"} value={text("bg")} fallback="#fffaf3" onChange={(v) => onPatch({ bg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "الشريط الداكن" : "Dark stripe"} value={text("bg2")} fallback="#2b1b10" onChange={(v) => onPatch({ bg2: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون النص" : "Text"} value={text("inkColor")} fallback="#2b1b10" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "شريط البريد والطابع" : "Airmail stripe and stamp"} value={text("dashColor")} fallback="#9d6540" onChange={(v) => onPatch({ dashColor: v })} input={input} ar={ar} />
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 18)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "يفتح" : "Opens"} type="link">
            <LinkPicker
              pages={pages}
              value={{ handle: text("handle"), url: text("url"), productId: text("productId"), screen: text("screen") }}
              onChange={(next) =>
                onPatch({
                  handle: next.handle ?? "",
                  url: next.url ?? "",
                  productId: next.productId ?? "",
                  screen: next.screen ?? "",
                })
              }
              collections={collections}
              input={input}
              ar={ar}
            />
          </Field>
        </>
      )}

      {block.type === "moments" && (
        <>
          <Field label={ar ? "العنوان" : "Title"} type="text">
            <input value={text("title")} onChange={(e) => onPatch({ title: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "السطر تحته" : "Line underneath"} type="text">
            <input value={text("subtitle")} onChange={(e) => onPatch({ subtitle: e.target.value })} className={input} />
          </Field>
          <Field label={ar ? "كم بطاقة في الصف" : "How many fit across"} type="range">
            <input type="number" min={0} max={6} value={num0("perRow", 5)} onChange={(e) => onPatch({ perRow: Number(e.target.value) })} className={input} />
            <p className="mt-1 text-[11px] text-ink-soft">
              {ar
                ? "تتقاسم البطاقات عرض الشاشة فتظهر كلها بلا تمرير. صفر يعيدها صفاً يُمرَّر بالعرض المحدد تحت."
                : "The cards divide the screen between them, so the whole edit shows without scrolling. Zero goes back to a scrolling row at the width below."}
            </p>
          </Field>
          <Field label={ar ? "عرض البطاقة" : "Card width"} type="range">
            <input type="number" min={110} max={260} value={num("cardWidth", 150)} onChange={(e) => onPatch({ cardWidth: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "ارتفاع البطاقة" : "Card height"} type="range">
            <input type="number" min={140} max={360} value={num("cardHeight", 210)} onChange={(e) => onPatch({ cardHeight: Number(e.target.value) })} className={input} />
          </Field>
          <Field label={ar ? "استدارة الحواف" : "Corner radius"} type="range">
            <input type="number" min={0} max={32} value={num("radius", 14)} onChange={(e) => onPatch({ radius: Number(e.target.value) })} className={input} />
          </Field>
          <ColorRow label={ar ? "لون الكلمة" : "Word colour"} value={text("labelColor")} fallback="#ffffff" onChange={(v) => onPatch({ labelColor: v })} input={input} ar={ar} />
        </>
      )}

      {block.type === "tiers" && (
        <>
          <ColorRow label={ar ? "خلفية البطاقة" : "Card background"} value={text("cardBg")} fallback="#fffaf3" onChange={(v) => onPatch({ cardBg: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الحد" : "Border"} value={text("lineColor")} fallback="#e7d8c4" onChange={(v) => onPatch({ lineColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون السعر" : "Price"} value={text("inkColor")} fallback="#2b1b10" onChange={(v) => onPatch({ inkColor: v })} input={input} ar={ar} />
          <ColorRow label={ar ? "لون الوصف" : "Label"} value={text("mutedColor")} fallback="#8a6e57" onChange={(v) => onPatch({ mutedColor: v })} input={input} ar={ar} />
        </>
      )}

      {(block.type === "hero" ||
        block.type === "cards" ||
        block.type === "tiers" ||
        block.type === "split" ||
        block.type === "collection_tabs" ||
        block.type === "trust_badges") && (
        <>
          {block.type !== "hero" && block.type !== "trust_badges" && (
            <Field label={ar ? "العنوان" : "Title"} type="text">
              <input
                value={text("title")}
                onChange={(e) => onPatch({ title: e.target.value })}
                className={input}
              />
            </Field>
          )}
          {block.type === "collection_tabs" && (
            <Field label={ar ? "عدد المنتجات" : "How many products"} type="range">
              <input
                type="number"
                min={2}
                max={12}
                value={num("limit", 8)}
                onChange={(e) => onPatch({ limit: Number(e.target.value) })}
                className={input}
              />
            </Field>
          )}
          {block.type === "collection_tabs" && (
            <>
              <Field label={ar ? "محاذاة العنوان" : "Header alignment"} type="select">
                <select
                  value={text("align") || "left"}
                  onChange={(e) => onPatch({ align: e.target.value })}
                  className={input}
                >
                  <option value="left">{ar ? "يسار" : "Left"}</option>
                  <option value="center">{ar ? "وسط" : "Centre"}</option>
                  <option value="right">{ar ? "يمين" : "Right"}</option>
                </select>
              </Field>
              <Field label={ar ? "التبويبات بعرض الشاشة" : "Stretch pills to full width"} type="checkbox">
                <Toggle
                  on={bool("stretchTabs", false)}
                  onChange={(v) => onPatch({ stretchTabs: v })}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "إظهار الرابط" : "Show the link"} type="checkbox">
                <Toggle
                  on={bool("showLink", true)}
                  onChange={(v) => onPatch({ showLink: v })}
                  ar={ar}
                />
              </Field>
              <Field label={ar ? "شكل الصورة" : "Image shape"} type="select">
                <select
                  value={text("imageShape") || "square"}
                  onChange={(e) => onPatch({ imageShape: e.target.value })}
                  className={input}
                >
                  <option value="square">{ar ? "مربعة" : "Square"}</option>
                  <option value="wide">{ar ? "عريضة" : "Wide"}</option>
                  <option value="tall">{ar ? "طويلة" : "Tall"}</option>
                </select>
              </Field>
              <Field label={ar ? "ملء الصورة" : "Image fit"} type="select">
                <select
                  value={text("imageFit") || "cover"}
                  onChange={(e) => onPatch({ imageFit: e.target.value })}
                  className={input}
                >
                  <option value="cover">{ar ? "تملأ الإطار" : "Fill the frame"}</option>
                  <option value="contain">{ar ? "تظهر كاملة" : "Fit inside"}</option>
                </select>
              </Field>
              <Field label={ar ? "ظهور تدريجي للبطاقات" : "Fade cards in"} type="checkbox">
                <Toggle
                  on={bool("fade", false)}
                  onChange={(v) => onPatch({ fade: v })}
                  ar={ar}
                />
              </Field>
            </>
          )}
        </>
      )}

      {ITEM_FIELDS[block.type] && (
        <ItemList
          block={block}
          ar={ar}
          collections={collections}
          pages={pages}
          accent={accent}
          input={input}
          onPatch={onPatch}
        />
      )}

      {block.type === "text" && (
        <>
          <Field label={ar ? "العنوان" : "Heading"} type="text">
            <input
              value={text("heading")}
              onChange={(e) => onPatch({ heading: e.target.value })}
              className={input}
            />
          </Field>
          <Field label={ar ? "النص" : "Body"} type="richtext">
            <textarea
              value={text("body")}
              onChange={(e) => onPatch({ body: e.target.value })}
              rows={3}
              className={`${input} h-auto py-2`}
            />
          </Field>
        </>
      )}
    </Group>
  );
}

/**
 * The repeatable part of a section: slides, tabs, tiers, cards, badges.
 *
 * A theme section has blocks inside it and so does this, for the same reason —
 * a hero with three slides is one thing the merchant arranges, not three
 * things that happen to sit together. Each row collapses so a section with ten
 * categories does not bury the section after it.
 */
function ItemList({
  block,
  ar,
  collections,
  pages,
  accent,
  input,
  onPatch,
}: {
  accent: string;
  block: Block;
  ar: boolean;
  collections: { handle: string; title: string; count: number; image: string | null }[];
  /** The merchant's own pages, so any link here can point at one. */
  pages: { key: string; ar: string; en: string }[];
  input: string;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const fields = ITEM_FIELDS[block.type] ?? [];
  const shape = ITEM_SHAPE[block.type];
  const items = itemsOf(block);

  const write = (next: Item[]) => onPatch({ items: next });
  const patchItem = (id: string, patch: Record<string, unknown>) =>
    write(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const moveItem = (id: string, by: 1 | -1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  const labelOf = (item: Item) => {
    // Words first: a colour's hex code names a row far worse than its label.
    const ordered = [...fields.filter((f) => f.kind === "text"), ...fields.filter((f) => f.kind !== "text")];
    for (const f of ordered) {
      if (f.kind === "image" || f.kind === "color") continue;
      const v = item[f.key];
      if (typeof v === "string" && v) {
        return f.kind === "collection" || f.kind === "link"
          ? collections.find((c) => c.handle === v)?.title ?? v
          : v;
      }
    }
    return ar ? "بدون عنوان" : "Untitled";
  };

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface-page p-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {shape ? (ar ? shape.ar : shape.en) : ""} · {items.length}
        </span>
        {shape && (
          <button
            onClick={() => {
              const created = shape.blank();
              write([...items, created]);
              setOpenItem(created.id);
            }}
            className="btn-ghost h-6 gap-1 px-1.5 text-[11px]"
          >
            <IcPlus className="h-3 w-3" />
            {ar ? "إضافة" : "Add"}
          </button>
        )}
      </div>

      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => {
          const isOpen = openItem === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-line bg-surface">
              <div className="flex items-center gap-0.5 px-2 py-1.5">
                <button
                  onClick={() => setOpenItem(isOpen ? null : item.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                >
                  <IcChevron
                    className={`h-2.5 w-2.5 shrink-0 text-ink-soft transition-transform ${
                      isOpen ? "rotate-90" : ""
                    } rtl:-scale-x-100`}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{labelOf(item)}</span>
                </button>
                <button
                  onClick={() => moveItem(item.id, -1)}
                  disabled={i === 0}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 disabled:opacity-30"
                  aria-label={ar ? "لأعلى" : "Move up"}
                >
                  <IcUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveItem(item.id, 1)}
                  disabled={i === items.length - 1}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 disabled:opacity-30"
                  aria-label={ar ? "لأسفل" : "Move down"}
                >
                  <IcDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => write(items.filter((x) => x.id !== item.id))}
                  className="btn-ghost h-6 w-6 shrink-0 p-0 text-rose-600"
                  aria-label={ar ? "حذف" : "Remove"}
                >
                  <IcTrash className="h-3 w-3" />
                </button>
              </div>

              {isOpen && (
                <div className="space-y-2 border-t border-line px-2 pb-2 pt-1.5">
                  {fields.map((f) => {
                    const value = typeof item[f.key] === "string" ? (item[f.key] as string) : "";
                    const linked = collections.find(
                      (c) => c.handle === (typeof item.handle === "string" ? item.handle : ""),
                    );
                    // What this field will show if left empty, because the
                    // collection supplies it. Saying so beats a blank box that
                    // looks like nothing happened.
                    const inherited =
                      f.kind === "image"
                        ? linked?.image ?? ""
                        : f.key === "title" || f.key === "label"
                          ? linked?.title ?? ""
                          : "";
                    // A <label> forwards any click inside it to the first button
                    // it holds. For a picker that button is the clear cross or
                    // the menu's first entry, so pressing the field cleared the
                    // link, or opened the menu and shut it again at once. Only
                    // plain text boxes keep the label, where the forwarding is
                    // what puts the cursor in the box.
                    const Wrap =
                      f.kind === "link" || f.kind === "collection" || f.kind === "color" ? "div" : "label";
                    return (
                      <Wrap key={f.key} className="block">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {ar ? f.ar : f.en}
                        </span>
                        {f.kind === "color" ? (
                          <ColorPicker
                            value={value}
                            onChange={(v) => patchItem(item.id, { [f.key]: v })}
                            fallback={accent}
                            allowEmpty
                            brand={[accent]}
                            input={`${input} h-8 text-xs`}
                            ar={ar}
                          />
                        ) : f.kind === "link" ? (
                          <LinkPicker
                            pages={pages}
                            value={{
                              handle: typeof item.handle === "string" ? item.handle : "",
                              url: typeof item.url === "string" ? item.url : "",
                              productId: typeof item.productId === "string" ? item.productId : "",
                              screen: typeof item.screen === "string" ? item.screen : "",
                            }}
                            onChange={(next) => patchItem(item.id, next)}
                            collections={collections}
                            input={`${input} mt-0.5 h-8 text-xs`}
                            ar={ar}
                          />
                        ) : f.kind === "collection" ? (
                          <LinkPicker
                            pages={pages}
                            value={{ handle: typeof value === "string" ? value : "" }}
                            onChange={(next) =>
                              patchItem(item.id, { [f.key]: next.handle ?? "" })
                            }
                            collections={collections}
                            input={`${input} mt-0.5 h-8 text-xs`}
                            ar={ar}
                            kinds={["collection"]}
                          />
                        ) : (
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {f.kind === "image" && (value || inherited) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={value || inherited}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded object-cover"
                              />
                            )}
                            {f.kind === "image" && (
                              <ImageUpload
                                onUploaded={(url) => patchItem(item.id, { [f.key]: url })}
                                ar={ar}
                                compact
                              />
                            )}
                            <input
                              value={value}
                              onChange={(e) => patchItem(item.id, { [f.key]: e.target.value })}
                              placeholder={
                                inherited
                                  ? ar
                                    ? "من القسم"
                                    : "from the collection"
                                  : f.kind === "image"
                                    ? "https://…"
                                    : ""
                              }
                              dir={f.kind === "image" ? "ltr" : undefined}
                              className={`${input} h-8 text-xs`}
                            />
                          </span>
                        )}
                        {inherited && !value && (
                          <span className="mt-0.5 block text-[10px] text-ink-soft">
                            {ar
                              ? "يأخذها من القسم المرتبط تلقائياً"
                              : "Taken from the linked collection"}
                          </span>
                        )}
                      </Wrap>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && (
        <p className="py-3 text-center text-[11px] text-ink-soft">
          {ar ? "لا عناصر بعد" : "Nothing here yet"}
        </p>
      )}
    </div>
  );
}

function screenFile(key: ScreenKey): string {
  return {
    collection: "CollectionScreen",
    product: "ProductScreen",
    cart: "CartScreen",
    checkout: "CheckoutScreen",
    account: "AccountScreen",
  }[key];
}

type Screen =
  | { kind: "collection"; handle: string; title: string }
  /** Every department the shop has. */
  | { kind: "collections" }
  | { kind: "product"; id: string }
  /** One of the merchant's own pages — For Her, For Him. */
  | { kind: "page"; handle: string }
  // Orders has no settings to design, so it has no pill — but the tab is real
  // and pressing it should show real orders, not nothing.
  | { kind: "orders" };

/**
 * A number of pixels, dragged.
 *
 * The phone beside it redraws as the slider moves, which is the only way to
 * judge spacing - a number on its own means nothing until you see it.
 */
function SpaceRow({
  label,
  value,
  onChange,
  min,
  max,
  note,
  unit = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  note?: string;
  /** Most of these are pixels. A count of words is not. */
  unit?: string;
}) {
  return (
    <Field label={label} type="range">
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[rgb(139,92,246)]"
        />
        <span className="w-14 shrink-0 text-end text-[11px] tabular-nums text-ink-muted">
          {value}
          {unit}
        </span>
      </span>
      {note && <p className="mt-1 text-[11px] text-ink-soft">{note}</p>}
    </Field>
  );
}

/** The bar every screen below home wears. */
function ScreenBar({
  title,
  trailing,
  accent,
  ar,
  onBack,
}: {
  title: string;
  trailing?: React.ReactNode;
  accent: string;
  ar: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <button onClick={onBack} className="shrink-0 text-sm font-semibold" style={{ color: accent }}>
        ‹ {ar ? "رجوع" : "Back"}
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{title}</span>
      {trailing}
    </div>
  );
}

function money(v: number | null, ar: boolean) {
  return v == null
    ? "—"
    : `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(v)} ${
        ar ? "ج.م" : "EGP"
      }`;
}

/** A refusal the merchant can act on, rather than a spinner that never ends. */
function ScreenError({ error, ar }: { error: string; ar: boolean }) {
  return (
    <div className="m-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
      <code className="font-mono">{error}</code>
      <p className="mt-1">
        {error === "not_found"
          ? ar
            ? "غير موجود في هذا المتجر — غيّري الوجهة من المحرّر."
            : "That isn't in this store. Repoint the section in the panel beside you."
          : ar
            ? "تعذّر التحميل."
            : "Couldn't load it."}
      </p>
    </div>
  );
}

/**
 * What the phone's own search finds.
 *
 * The same endpoint the app calls, over the merchant's real catalogue, so a
 * search that comes back empty here comes back empty there — which is worth
 * knowing before the app ships with a search box on its front page.
 */
function SearchResults({
  ar,
  accent,
  query,
  onOpenProduct,
}: {
  ar: boolean;
  accent: string;
  query: string;
  onOpenProduct: (id: string) => void;
}) {
  const [rows, setRows] = useState<
    { id: string; name: string; image: string | null; priceMin: number | null }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Typing is not a request. A pause is.
  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    const timer = setTimeout(() => {
      fetch(`/api/storefront/products?limit=40&q=${encodeURIComponent(query)}`, {
        headers: { "x-store-channel": "app" },
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((j) => {
          if (!live) return;
          if (!j?.ok) return setError(j?.error ?? "failed");
          setRows(j.data.products);
        })
        .catch((e) => live && setError(String((e as Error).message)));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (error) return <ScreenError error={error} ar={ar} />;
  if (!rows) return <p className="py-12 text-center text-sm text-slate-400">…</p>;
  if (!rows.length)
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        {ar ? `لا نتائج لـ "${query}"` : `Nothing matches "${query}"`}
      </p>
    );

  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpenProduct(p.id)}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-start"
        >
          <div className="aspect-square bg-slate-100">
            {p.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="p-2">
            <p className="line-clamp-2 text-[11px] leading-tight text-slate-800">{p.name}</p>
            <p className="mt-1 text-sm font-bold" style={{ color: accent }}>
              {money(p.priceMin, ar)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Every collection handle a theme points at, from sections and their items. */
function referencedHandles(theme: AppTheme): string[] {
  const out = new Set<string>();
  for (const block of theme.blocks) {
    const handle = block.settings?.handle;
    if (typeof handle === "string" && handle) out.add(handle);
    for (const item of itemsOf(block)) {
      if (typeof item.handle === "string" && item.handle) out.add(item.handle);
    }
  }
  return [...out];
}
