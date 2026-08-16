"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { useRouter } from "next/navigation";
import { useI18n, type DictKey } from "@/lib/i18n";
import {
  IcOverview,
  IcOrders,
  IcProducts,
  IcCollection,
  IcCustomers,
  IcDiscount,
  IcCourier,
  IcInventory,
  IcLocation,
  IcAccounting,
  IcFile,
  IcTheme,
  IcMeta,
  IcInbox,
  IcMarketing,
  IcSettings,
  IcPlus,
  IcGlobe,
  IcSearch,
} from "./icons";

// ---------------------------------------------------------------------------
// Context — lets any component (e.g. the topbar search box) open the palette.
// ---------------------------------------------------------------------------

type PaletteCtx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const Ctx = createContext<PaletteCtx | null>(null);

export function useCommandPalette() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Command model.
//
// A command's label can come from the shared dictionary (`titleKey`) so it is
// automatically bilingual, or be provided inline as an { ar, en } pair for
// palette-specific entries. `keywords` widen fuzzy matching (English + Arabic)
// without cluttering the visible label.
// ---------------------------------------------------------------------------

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Command = {
  id: string;
  icon: Icon;
  titleKey?: DictKey;
  title?: { ar: string; en: string };
  section: "nav" | "actions" | "prefs";
  keywords?: string;
  href?: string;
  run?: (ctx: { toggle: () => void }) => void;
};

const NAV: Command[] = [
  { id: "nav-dashboard", href: "/dashboard", titleKey: "nav_overview", icon: IcOverview, section: "nav", keywords: "home overview dashboard رئيسية" },
  { id: "nav-orders", href: "/orders", titleKey: "nav_orders", icon: IcOrders, section: "nav", keywords: "orders sales طلبات" },
  { id: "nav-products", href: "/products", titleKey: "nav_products", icon: IcProducts, section: "nav", keywords: "products catalog منتجات كتالوج" },
  { id: "nav-collections", href: "/collections", titleKey: "nav_collections", icon: IcCollection, section: "nav", keywords: "collections مجموعات" },
  { id: "nav-customers", href: "/customers", titleKey: "nav_customers", icon: IcCustomers, section: "nav", keywords: "customers people عملاء" },
  { id: "nav-discounts", href: "/discounts", titleKey: "nav_discounts", icon: IcDiscount, section: "nav", keywords: "discounts coupons codes خصومات كوبونات" },
  { id: "nav-couriers", href: "/couriers", titleKey: "nav_couriers", icon: IcCourier, section: "nav", keywords: "shipping couriers شحن مندوبين" },
  { id: "nav-inventory", href: "/inventory", titleKey: "nav_inventory", icon: IcInventory, section: "nav", keywords: "stock inventory مخزون" },
  { id: "nav-locations", href: "/inventory/locations", titleKey: "nav_locations", icon: IcLocation, section: "nav", keywords: "locations warehouse مواقع مخازن" },
  { id: "nav-accounting", href: "/accounting", titleKey: "nav_accounting", icon: IcAccounting, section: "nav", keywords: "accounting finance محاسبة" },
  { id: "nav-courier-system", href: "/courier-system", titleKey: "nav_courier_system", icon: IcCourier, section: "nav", keywords: "courier system delivery نظام الشحن" },
  { id: "nav-files", href: "/content/files", titleKey: "nav_files", icon: IcFile, section: "nav", keywords: "files media content ملفات محتوى" },
  { id: "nav-themes", href: "/online-store/themes", titleKey: "nav_themes", icon: IcTheme, section: "nav", keywords: "themes storefront design قوالب متجر" },
  { id: "nav-meta", href: "/channels/meta", titleKey: "nav_meta", icon: IcMeta, section: "nav", keywords: "meta facebook instagram pixel channels قنوات" },
  { id: "nav-inbox", href: "/inbox", titleKey: "nav_inbox", icon: IcInbox, section: "nav", keywords: "inbox chat messages whatsapp محادثات رسائل" },
  { id: "nav-marketing", href: "/marketing", titleKey: "nav_marketing", icon: IcMarketing, section: "nav", keywords: "marketing campaigns تسويق حملات" },
  { id: "nav-settings", href: "/settings", titleKey: "nav_settings", icon: IcSettings, section: "nav", keywords: "settings preferences إعدادات" },
];

const ACTIONS: Command[] = [
  { id: "act-new-product", href: "/products", titleKey: "cmd_new_product", icon: IcPlus, section: "actions", keywords: "add create product جديد منتج إضافة" },
  { id: "act-new-discount", href: "/discounts/new", titleKey: "cmd_new_discount", icon: IcDiscount, section: "actions", keywords: "add create discount coupon جديد خصم كوبون" },
];

const SECTION_KEY: Record<Command["section"], DictKey> = {
  nav: "cmd_group_nav",
  actions: "cmd_group_actions",
  prefs: "cmd_group_prefs",
};

// ---------------------------------------------------------------------------
// Provider — owns open state, the global ⌘K / Ctrl+K shortcut, and renders
// the modal. Mount once, high in the admin tree.
// ---------------------------------------------------------------------------

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && <Palette />}
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
// The modal.
// ---------------------------------------------------------------------------

function Palette() {
  const { setOpen, toggle } = useCommandPalette();
  const { t, lang, toggle: toggleLang } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const prefs: Command[] = useMemo(
    () => [
      {
        id: "pref-lang",
        titleKey: "cmd_toggle_lang",
        icon: IcGlobe,
        section: "prefs",
        keywords: "language arabic english لغة عربية انجليزية",
        run: ({ toggle }) => {
          toggleLang();
          toggle();
        },
      },
    ],
    [toggleLang],
  );

  const all = useMemo(() => [...ACTIONS, ...NAV, ...prefs], [prefs]);

  const label = useCallback(
    (c: Command) => (c.titleKey ? t(c.titleKey) : c.title ? c.title[lang] : ""),
    [t, lang],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => {
      const hay = `${label(c)} ${c.keywords ?? ""}`.toLowerCase();
      // subsequence fuzzy match so "npr" matches "new product"
      let i = 0;
      for (const ch of q) {
        i = hay.indexOf(ch, i);
        if (i === -1) return hay.includes(q); // fall back to plain contains
        i += 1;
      }
      return true;
    });
  }, [query, all, label]);

  // Reset highlight to the top whenever the result set changes.
  useEffect(() => setActive(0), [query]);

  // Focus the input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const select = useCallback(
    (c: Command | undefined) => {
      if (!c) return;
      if (c.run) {
        c.run({ toggle });
        return;
      }
      if (c.href) {
        setOpen(false);
        router.push(c.href);
      }
    },
    [router, setOpen, toggle],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[active]);
    }
  };

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Group the flat results back into sections, preserving order.
  const grouped = useMemo(() => {
    const order: Command["section"][] = ["actions", "nav", "prefs"];
    const map = new Map<Command["section"], { cmd: Command; idx: number }[]>();
    results.forEach((cmd, idx) => {
      const arr = map.get(cmd.section) ?? [];
      arr.push({ cmd, idx });
      map.set(cmd.section, arr);
    });
    return order.filter((s) => map.has(s)).map((s) => ({ section: s, rows: map.get(s)! }));
  }, [results]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-x-0 top-[12vh] mx-auto w-[92%] max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IcSearch className="h-5 w-5 shrink-0 text-ink-soft" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("cmd_placeholder")}
            className="h-14 w-full border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-page px-1.5 py-0.5 text-[11px] font-medium text-ink-soft sm:block">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-ink-soft">{t("cmd_empty")}</div>
          ) : (
            grouped.map(({ section, rows }) => (
              <div key={section} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t(SECTION_KEY[section])}
                </div>
                {rows.map(({ cmd, idx }) => {
                  const Icon = cmd.icon;
                  const isActive = idx === active;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      onClick={() => select(cmd)}
                      onMouseMove={() => setActive(idx)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-surface-hover"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-ink-soft"}`}
                      />
                      <span className="flex-1 truncate font-medium">{label(cmd)}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-soft">
          <Hint keys="↑↓" text={t("cmd_hint_nav")} />
          <Hint keys="↵" text={t("cmd_hint_select")} />
          <Hint keys="Esc" text={t("cmd_hint_close")} />
        </div>
      </div>
    </div>
  );
}

function Hint({ keys, text }: { keys: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-md border border-line bg-surface-page px-1.5 py-0.5 font-medium text-ink-muted">
        {keys}
      </kbd>
      {text}
    </span>
  );
}
