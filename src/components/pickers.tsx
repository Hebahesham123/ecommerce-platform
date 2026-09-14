"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/app/(admin)/content/files/actions";

/**
 * The colour and image controls the theme editor uses.
 *
 * Kept together because they are the two places a merchant stops typing and
 * starts pointing: pick the colour off something, drop the picture in. Every
 * colour in the editor goes through one control, so the eyedropper and the
 * palette arrive everywhere at once instead of on whichever field was built
 * most recently.
 */

/**
 * Chrome and Edge can sample any pixel on the screen, including outside the
 * browser window. It is not in lib.dom yet and Safari and Firefox do not have
 * it, so it is declared here and the button only appears where it works —
 * an eyedropper that silently does nothing is worse than no eyedropper.
 */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
declare global {
  interface Window {
    EyeDropper?: EyeDropperCtor;
  }
}

/** A spread wide enough to build a brand from, ordered so it reads as a palette. */
export const SWATCHES: string[] = [
  "#000000", "#1f2937", "#475569", "#94a3b8", "#cbd5e1", "#f1f5f9", "#ffffff",
  "#4c1d95", "#7c3aed", "#a855f7", "#2563eb", "#0ea5e9", "#06b6d4", "#14b8a6",
  "#166534", "#16a34a", "#84cc16", "#eab308", "#f59e0b", "#ea580c", "#dc2626",
  "#9f1239", "#e11d48", "#db2777", "#9d6540", "#c1674a", "#f3ede5", "#fde68a",
];

/**
 * The published web theme's palette.
 *
 * The app and the site are the same shop, so the colours the storefront is
 * already built from are the ones a merchant reaches for first — offering them
 * here saves reading hexes out of a stylesheet.
 */
export const WEB_THEME: string[] = [
  "#c1674a", "#9c4c29", "#a4522c", "#c8902a", "#e2c898",
  "#f3ede5", "#eeddd5", "#faf7f3", "#2d1e24", "#191614",
];

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorPicker({
  value,
  onChange,
  fallback,
  allowEmpty = false,
  brand = [],
  input,
  ar,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Drawn in the swatch when the value is empty, i.e. what "inherit" looks like. */
  fallback: string;
  /** Empty means "follow the brand", and a reset appears to get back to it. */
  allowEmpty?: boolean;
  /** The store's own colours, offered before the general palette. */
  brand?: string[];
  input: string;
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasDropper, setHasDropper] = useState(false);
  useEffect(() => {
    setHasDropper(typeof window !== "undefined" && typeof window.EyeDropper === "function");
  }, []);

  const hex = HEX.test(value) ? value : fallback;
  const own = brand.filter((c) => HEX.test(c));

  const pick = async () => {
    const Ctor = window.EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      onChange(sRGBHex);
    } catch {
      /* Escape closes the eyedropper; that is a choice, not a failure. */
    }
  };

  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      title={c}
      onClick={() => {
        onChange(c);
        setOpen(false);
      }}
      className={`h-6 w-6 rounded-md border transition hover:scale-110 ${
        c.toLowerCase() === value.toLowerCase() ? "border-brand-500 ring-2 ring-brand-500/40" : "border-line"
      }`}
      style={{ background: c }}
    />
  );

  return (
    <div>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface-page p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? (ar ? "لون الهوية" : "Brand colour") : "#000000"}
          className={`${input} font-mono`}
          dir="ltr"
        />
        {hasDropper && (
          <button
            type="button"
            onClick={pick}
            title={ar ? "التقطي لوناً من أي مكان على الشاشة" : "Pick a colour from anywhere on screen"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink-muted transition hover:border-brand-500 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 22 1-4 9-9" />
              <path d="M13 8 8 13" />
              <path d="m15.5 2.5 6 6-4 4-6-6z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={ar ? "لوحة الألوان" : "Colour palette"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
            open ? "border-brand-500 text-ink" : "border-line text-ink-muted hover:border-brand-500 hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="1.5" />
            <circle cx="17.5" cy="10.5" r="1.5" />
            <circle cx="8.5" cy="7.5" r="1.5" />
            <circle cx="6.5" cy="12.5" r="1.5" />
            <path d="M12 2a10 10 0 1 0 0 20c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H16a6 6 0 0 0 6-6c0-4.4-4.5-8-10-8Z" />
          </svg>
        </button>
        {allowEmpty && value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-ink-muted transition hover:bg-surface-hover"
          >
            {ar ? "افتراضي" : "Reset"}
          </button>
        ) : null}
      </span>

      {open && (
        <div className="mt-2 rounded-xl border border-line bg-surface-page p-2">
          {own.length > 0 && (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                {ar ? "ألوان متجرك" : "Your store"}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">{own.map(swatch)}</div>
            </>
          )}
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {ar ? "ألوان الموقع" : "Web theme"}
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">{WEB_THEME.map(swatch)}</div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {ar ? "لوحة الألوان" : "Palette"}
          </div>
          <div className="grid grid-cols-7 gap-1.5">{SWATCHES.map(swatch)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Put a picture in without leaving for a file library first.
 *
 * The URL field stays beside it: a merchant who already has the image hosted
 * should not have to download and re-upload it to use it here.
 */
export function ImageUpload({
  onUploaded,
  ar,
  compact = false,
}: {
  onUploaded: (url: string) => void;
  ar: boolean;
  /** The tighter button used inside a section's item list. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <label
      title={ar ? "ارفعي صورة من جهازك" : "Upload from your device"}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-lg border transition ${
        compact ? "h-8 w-8" : "h-9 w-9"
      } ${err ? "border-rose-400 text-rose-500" : "border-line text-ink-muted hover:border-brand-500 hover:text-ink"} ${
        busy ? "opacity-60" : ""
      }`}
    >
      {busy ? (
        <span className="text-[11px]">…</span>
      ) : (
        <svg viewBox="0 0 24 24" className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          setErr(null);
          setBusy(true);
          const fd = new FormData();
          fd.append("file", file);
          const res = await uploadFile(fd);
          setBusy(false);
          if (res.ok) onUploaded(res.data.url);
          else setErr(res.error === "not_configured" ? "storage" : "failed");
        }}
      />
    </label>
  );
}

/**
 * Where a tap goes — the whole shop, not just its collections.
 *
 * Shaped like the one in Shopify's theme editor, because that is the control
 * the merchant already knows: a single field showing what is linked, with a
 * cross to clear it, and a menu of everything in the shop behind it. Choose
 * "Collections" and the field becomes a list of collections to search; choose
 * "Products" and it searches products.
 *
 * Every link in the theme is the same four fields, and exactly one of them is
 * set at a time, so choosing a kind clears the others. That is what keeps the
 * rule the app follows ("web address, then product, then screen, then
 * collection") from ever being ambiguous.
 */
export type LinkValue = {
  handle?: string;
  url?: string;
  productId?: string;
  screen?: string;
};

type Collection = { handle: string; title: string; count: number; image: string | null };

/**
 * Screens of the app a link can point at.
 *
 * The first six are the app's own screens. The last three are this shop's
 * pages — Reviews, Happy customers and Requests — which the app draws as
 * screens rather than fetching as documents, so they belong in the same list.
 * There are no blogs or policies to offer: this shop keeps none.
 */
const SCREENS = [
  { key: "home", ar: "الرئيسية", en: "Home" },
  { key: "search", ar: "البحث", en: "Search" },
  { key: "cart", ar: "السلة", en: "Cart" },
  { key: "orders", ar: "الطلبات", en: "Orders" },
  { key: "account", ar: "الحساب", en: "Account" },
  { key: "live", ar: "البث", en: "Live" },
];

const PAGES = [
  { key: "reviews", ar: "آراء العملاء", en: "Reviews" },
  { key: "happy-customers", ar: "عملاء سعداء", en: "Happy customers" },
  { key: "requests", ar: "الطلبات والمرتجعات", en: "Requests & returns" },
];

/** Every screen key the picker can store, pages included. */
export const LINK_SCREEN_KEYS = [...SCREENS, ...PAGES].map((s) => s.key);

type Kind = "none" | "collection" | "product" | "page" | "screen" | "url";

function kindOf(v: LinkValue): Kind {
  if (v.url) return "url";
  if (v.productId) return "product";
  if (v.screen) return PAGES.some((p) => p.key === v.screen) ? "page" : "screen";
  if (v.handle) return "collection";
  return "none";
}

// ---------------------------------------------------------------- the icons --
// Small, flat and monochrome, so a row of them reads as one set rather than as
// six drawings.
const ICON = "h-3.5 w-3.5 shrink-0";

function IcTag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={ICON}>
      <path d="M3 3h6.2L17 10.8 10.8 17 3 9.2V3Z" strokeLinejoin="round" />
      <circle cx="6.6" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IcBox() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={ICON}>
      <path d="M10 2.6 17 6v8l-7 3.4L3 14V6l7-3.4Z" strokeLinejoin="round" />
      <path d="M3 6l7 3.4L17 6M10 9.4V17.4" />
    </svg>
  );
}

function IcPage() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={ICON}>
      <path d="M11.5 2.5H5.5v15h9V5.5l-3-3Z" strokeLinejoin="round" />
      <path d="M11.5 2.5v3h3" strokeLinejoin="round" />
    </svg>
  );
}

function IcScreen() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={ICON}>
      <rect x="6" y="2.5" width="8" height="15" rx="1.8" />
      <path d="M8.8 15.2h2.4" />
    </svg>
  );
}

function IcLink() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className={ICON}>
      <path d="M8.4 11.6a3 3 0 0 1 0-4.2l2.1-2.1a3 3 0 1 1 4.2 4.2l-1 1" strokeLinecap="round" />
      <path d="M11.6 8.4a3 3 0 0 1 0 4.2l-2.1 2.1a3 3 0 1 1-4.2-4.2l1-1" strokeLinecap="round" />
    </svg>
  );
}

function IcX() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3 w-3">
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function IcBack({ ar }: { ar: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`${ICON} ${ar ? "rotate-180" : ""}`}
    >
      <path d="M12 4.5 6.5 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const KIND_ICON: Record<Exclude<Kind, "none">, () => React.JSX.Element> = {
  collection: IcTag,
  product: IcBox,
  page: IcPage,
  screen: IcScreen,
  url: IcLink,
};

export function LinkPicker({
  value,
  onChange,
  collections,
  input,
  ar,
}: {
  value: LinkValue;
  onChange: (next: LinkValue) => void;
  collections: Collection[];
  input: string;
  ar: boolean;
}) {
  // Which panel is showing: the menu of kinds, or one kind's list. null is the
  // closed state, where only the field is on screen.
  const [open, setOpen] = useState<"menu" | Kind | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; image: string | null }[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  const kind = kindOf(value);

  // A stored product is only an id; ask what it is called so the merchant sees
  // a name rather than a string of characters they cannot check.
  useEffect(() => {
    if (!value.productId) return setChosen("");
    let alive = true;
    fetch("/api/storefront/products/" + encodeURIComponent(value.productId))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok) setChosen(String(j.data?.name ?? j.data?.title ?? ""));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value.productId]);

  // Clicking anywhere else puts the menu away, the way every other menu on the
  // page behaves. Without it a merchant with two links open sees two lists.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Only one of the four is ever set.
  const only = (next: LinkValue) => onChange({ handle: "", url: "", productId: "", screen: "", ...next });

  const search = async (term: string) => {
    setQ(term);
    if (term.trim().length < 2) return setHits([]);
    setBusy(true);
    try {
      const r = await fetch("/api/storefront/products?limit=8&q=" + encodeURIComponent(term.trim()));
      const j = await r.json();
      setHits(
        j?.ok
          ? (j.data.products ?? []).map((p: Record<string, unknown>) => ({
              id: String(p.id),
              name: String(p.name ?? ""),
              image: (p.image as string) ?? null,
            }))
          : [],
      );
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  };

  /** What the closed field reads, so the merchant can check it at a glance. */
  const label = (): string => {
    if (value.url) return value.url;
    if (value.productId) return chosen || (ar ? "منتج" : "Product");
    if (value.screen) {
      const found = [...SCREENS, ...PAGES].find((s) => s.key === value.screen);
      return found ? (ar ? found.ar : found.en) : value.screen;
    }
    if (value.handle) {
      const found = collections.find((c) => c.handle === value.handle);
      return found ? found.title : value.handle;
    }
    return ar ? "لا يفتح شيئاً" : "Opens nothing";
  };

  const Icon = kind === "none" ? null : KIND_ICON[kind];

  const menu = [
    { kind: "collection" as const, icon: IcTag, ar: "الأقسام", en: "Collections" },
    { kind: "product" as const, icon: IcBox, ar: "المنتجات", en: "Products" },
    { kind: "page" as const, icon: IcPage, ar: "الصفحات", en: "Pages" },
    { kind: "screen" as const, icon: IcScreen, ar: "شاشات التطبيق", en: "App screens" },
    { kind: "url" as const, icon: IcLink, ar: "رابط", en: "Web address" },
  ];

  const row =
    "flex w-full items-center gap-2 px-2.5 py-1.5 text-start text-[12px] text-ink hover:bg-surface-hover";

  return (
    <div ref={box} className="relative">
      {/* The field. Shows what is linked; the cross clears it. */}
      <div
        className={`${input} flex cursor-pointer items-center gap-2 ${
          open ? "ring-2 ring-[rgb(139,92,246)]" : ""
        }`}
        onClick={() => setOpen(open ? null : "menu")}
      >
        <span className={kind === "none" ? "text-ink-soft" : "text-ink-muted"}>
          {Icon ? <Icon /> : <IcLink />}
        </span>
        <span
          className={`flex-1 truncate ${kind === "none" ? "text-ink-soft" : ""}`}
          dir={value.url ? "ltr" : undefined}
        >
          {label()}
        </span>
        {kind !== "none" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              only({});
              setOpen(null);
            }}
            title={ar ? "إزالة" : "Clear"}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface-hover hover:text-ink"
          >
            <IcX />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          {open === "menu" && (
            <>
              <button
                type="button"
                onClick={() => {
                  only({});
                  setOpen(null);
                }}
                className={`${row} text-ink-soft`}
              >
                <span className="w-3.5" />
                {ar ? "لا يفتح شيئاً" : "Opens nothing"}
              </button>
              {menu.map((m) => (
                <button
                  key={m.kind}
                  type="button"
                  onClick={() => {
                    setQ("");
                    setHits([]);
                    setOpen(m.kind);
                  }}
                  className={row}
                >
                  <span className="text-ink-muted">
                    <m.icon />
                  </span>
                  {ar ? m.ar : m.en}
                </button>
              ))}
            </>
          )}

          {open !== "menu" && (
            <>
              <button
                type="button"
                onClick={() => setOpen("menu")}
                className={`${row} border-b border-line font-medium text-ink-muted`}
              >
                <IcBack ar={ar} />
                {ar
                  ? menu.find((m) => m.kind === open)?.ar
                  : menu.find((m) => m.kind === open)?.en}
              </button>

              {open === "collection" && (
                <CollectionList
                  collections={collections}
                  q={q}
                  onQ={setQ}
                  ar={ar}
                  onPick={(handle) => {
                    only({ handle });
                    setOpen(null);
                  }}
                />
              )}

              {open === "product" && (
                <div className="p-1.5">
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => search(e.target.value)}
                    placeholder={ar ? "ابحثي عن منتج…" : "Search products…"}
                    className={`${input} h-8 text-xs`}
                  />
                  {busy && (
                    <div className="px-1 py-1.5 text-[11px] text-ink-soft">
                      {ar ? "جارٍ البحث…" : "Searching…"}
                    </div>
                  )}
                  {!busy && q.trim().length >= 2 && !hits.length && (
                    <div className="px-1 py-1.5 text-[11px] text-ink-soft">
                      {ar ? "لا يوجد منتج بهذا الاسم" : "No product by that name"}
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          only({ productId: h.id });
                          setChosen(h.name);
                          setHits([]);
                          setQ("");
                          setOpen(null);
                        }}
                        className={row}
                      >
                        {h.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.image} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="h-6 w-6 shrink-0 rounded bg-surface-page" />
                        )}
                        <span className="truncate">{h.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(open === "page" || open === "screen") && (
                <div className="max-h-56 overflow-y-auto">
                  {(open === "page" ? PAGES : SCREENS).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        only({ screen: s.key });
                        setOpen(null);
                      }}
                      className={row}
                    >
                      <span className="text-ink-muted">
                        {open === "page" ? <IcPage /> : <IcScreen />}
                      </span>
                      {ar ? s.ar : s.en}
                    </button>
                  ))}
                </div>
              )}

              {open === "url" && (
                <div className="p-1.5">
                  <input
                    autoFocus
                    defaultValue={value.url ?? ""}
                    onChange={(e) => only({ url: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && setOpen(null)}
                    placeholder="https://…"
                    className={`${input} h-8 text-xs`}
                    dir="ltr"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The collection list, with a search box once there are enough to need one. */
function CollectionList({
  collections,
  q,
  onQ,
  ar,
  onPick,
}: {
  collections: Collection[];
  q: string;
  onQ: (v: string) => void;
  ar: boolean;
  onPick: (handle: string) => void;
}) {
  const term = q.trim().toLowerCase();
  const shown = term
    ? collections.filter((c) => c.title.toLowerCase().includes(term) || c.handle.includes(term))
    : collections;

  return (
    <>
      {collections.length > 8 && (
        <div className="p-1.5 pb-0">
          <input
            autoFocus
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={ar ? "ابحثي عن قسم…" : "Search collections…"}
            className="h-8 w-full rounded-lg border border-line bg-surface-page px-2 text-xs outline-none focus:border-[rgb(139,92,246)]"
          />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto p-1.5">
        {shown.map((c) => (
          <button
            key={c.handle}
            type="button"
            onClick={() => onPick(c.handle)}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start text-[12px] text-ink hover:bg-surface-hover"
          >
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
            ) : (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-surface-page text-ink-soft">
                <IcTag />
              </span>
            )}
            <span className="flex-1 truncate">{c.title}</span>
            <span className="shrink-0 text-[10px] text-ink-soft">{c.count}</span>
          </button>
        ))}
        {!shown.length && (
          <div className="px-1.5 py-1.5 text-[11px] text-ink-soft">
            {ar ? "لا يوجد قسم بهذا الاسم" : "No collection by that name"}
          </div>
        )}
      </div>
    </>
  );
}
