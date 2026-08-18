"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EditableType } from "@/lib/theme-schema";
import { IcChevron, IcEdit } from "@/components/icons";

/** Everything a link can point at, read from the live catalog. */
export type LinkTargets = {
  collections: { handle: string; title: string; count: number }[];
  products: { handle: string; title: string }[];
};

/**
 * One control for "where does this point?".
 *
 * Shopify stores a bare handle for `collection`/`product` settings and a path
 * for `url` settings, so the encoding differs per setting type — the picker
 * hides that and always shows the same destination list.
 */

type Kind = "none" | "home" | "all" | "collection" | "product" | "cart" | "search" | "custom";

const KINDS: { kind: Kind; ar: string; en: string }[] = [
  { kind: "none", ar: "— بدون —", en: "— None —" },
  { kind: "home", ar: "الرئيسية", en: "Home" },
  { kind: "all", ar: "كل المنتجات", en: "All products" },
  { kind: "collection", ar: "تصنيف", en: "Collection" },
  { kind: "product", ar: "منتج", en: "Product" },
  { kind: "cart", ar: "السلة", en: "Cart" },
  { kind: "search", ar: "البحث", en: "Search" },
  { kind: "custom", ar: "رابط مخصص", en: "Custom URL" },
];

/** Decode a stored value back into (kind, handle/custom text). */
function decode(type: EditableType, value: unknown): { kind: Kind; target: string } {
  const v = String(value ?? "").trim();
  if (!v) return { kind: "none", target: "" };
  if (type === "collection") return { kind: "collection", target: v };
  if (type === "product") return { kind: "product", target: v };
  if (v === "/" ) return { kind: "home", target: "" };
  if (v === "/collections/all") return { kind: "all", target: "" };
  if (v === "/cart") return { kind: "cart", target: "" };
  if (v === "/search") return { kind: "search", target: "" };
  const col = v.match(/^\/collections\/([^/?#]+)$/);
  if (col) return { kind: "collection", target: decodeURIComponent(col[1]) };
  const prod = v.match(/^\/products\/([^/?#]+)$/);
  if (prod) return { kind: "product", target: decodeURIComponent(prod[1]) };
  return { kind: "custom", target: v };
}

/** Encode (kind, handle) into what this setting type expects. */
function encode(type: EditableType, kind: Kind, target: string): string {
  const handleOnly = type === "collection" || type === "product";
  switch (kind) {
    case "none":
      return "";
    case "home":
      return handleOnly ? "" : "/";
    case "all":
      return handleOnly ? "all" : "/collections/all";
    case "cart":
      return handleOnly ? "" : "/cart";
    case "search":
      return handleOnly ? "" : "/search";
    case "collection":
      return handleOnly ? target : target ? `/collections/${target}` : "";
    case "product":
      return handleOnly ? target : target ? `/products/${target}` : "";
    case "custom":
      return target;
  }
}

const selectCls =
  "h-9 rounded-xl border border-line bg-surface-page px-2.5 text-sm text-ink outline-none focus:border-brand-600 focus:bg-surface";

export type Option = { value: string; label: string };

/**
 * A select you can type into.
 *
 * The list is rendered in a portal with fixed positioning because these
 * pickers sit inside scrolling panels (the customizer sidebar, the menu
 * tree) — an absolutely positioned dropdown would be clipped by the
 * overflow container.
 */
export function SearchableSelect({
  value,
  options,
  placeholder,
  ar,
  onChange,
}: {
  value: string;
  options: Option[];
  placeholder: string;
  ar: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const height = Math.min(320, Math.max(180, below - 16));
    // Flip above the control when there isn't room underneath.
    const top = below < 220 && r.top > below ? Math.max(8, r.top - height - 6) : r.bottom + 6;
    setBox({ top, left: r.left, width: Math.max(220, r.width) });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onDocDown = (e: MouseEvent) => {
      if (
        !listRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("resize", reposition);
    // `true` catches scrolling of any ancestor panel, not just the window.
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setQ("");
          setActive(0);
          setOpen((o) => !o);
        }}
        className={`${selectCls} flex min-w-[150px] flex-1 items-center gap-1.5 text-start`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-ink-soft"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <IcChevron className="h-3 w-3 shrink-0 rotate-90 text-ink-soft" />
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={listRef}
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 9999 }}
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          >
            <div className="border-b border-line p-1.5">
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered[active]) pick(filtered[active].value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder={ar ? "ابحث…" : "Search…"}
                className="h-8 w-full rounded-lg border border-line bg-surface-page px-2.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-ink-soft">
                  {ar ? "لا توجد نتائج" : "No matches"}
                </p>
              ) : (
                filtered.map((o, i) => (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={`block w-full truncate rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${
                      o.value === value
                        ? "bg-brand-50 font-medium text-brand-700"
                        : i === active
                          ? "bg-surface-hover text-ink"
                          : "text-ink-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function LinkPicker({
  type,
  value,
  targets,
  ar,
  onChange,
}: {
  type: EditableType;
  value: unknown;
  targets: LinkTargets;
  ar: boolean;
  onChange: (next: string) => void;
}) {
  const { kind: derivedKind, target } = useMemo(() => decode(type, value), [type, value]);

  // "Collection", "Product" and "Custom URL" encode to an empty value until a
  // handle is chosen, which would decode straight back to "None". So the chosen
  // kind is held here until it resolves into a real destination.
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);
  const kind = pendingKind ?? derivedKind;
  useEffect(() => {
    if (derivedKind !== "none") setPendingKind(null);
  }, [derivedKind, value]);

  // A `collection` setting can only hold a collection, and likewise `product`.
  // ("All products" is just the `all` collection, so it's in the list below.)
  const kinds = useMemo(() => {
    if (type === "collection")
      return KINDS.filter((k) => k.kind === "none" || k.kind === "collection");
    if (type === "product") return KINDS.filter((k) => k.kind === "none" || k.kind === "product");
    return KINDS;
  }, [type]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        className={selectCls}
        value={kind}
        onChange={(e) => {
          const next = e.target.value as Kind;
          setPendingKind(next);
          onChange(encode(type, next, ""));
        }}
      >
        {kinds.map((k) => (
          <option key={k.kind} value={k.kind}>
            {ar ? k.ar : k.en}
          </option>
        ))}
      </select>

      {kind === "collection" &&
        (targets.collections.length === 0 ? (
          <EmptyHint
            text={ar ? "لا توجد تصنيفات بعد" : "No collections yet"}
            href="/collections"
            cta={ar ? "أنشئ تصنيفاً" : "Create one"}
          />
        ) : (
          <>
            <SearchableSelect
              value={target}
              placeholder={ar ? "اختر تصنيفاً…" : "Choose a collection…"}
              ar={ar}
              options={targets.collections.map((c) => ({
                value: c.handle,
                label: `${c.title} (${c.count})`,
              }))}
              onChange={(v) => onChange(encode(type, "collection", v))}
            />
            <EditCollectionLink handle={target} ar={ar} />
          </>
        ))}

      {kind === "product" &&
        (targets.products.length === 0 ? (
          <EmptyHint
            text={ar ? "لا توجد منتجات بعد" : "No products yet"}
            href="/products"
            cta={ar ? "أضف منتجات" : "Add products"}
          />
        ) : (
          <SearchableSelect
            value={target}
            placeholder={ar ? "اختر منتجاً…" : "Choose a product…"}
            ar={ar}
            options={targets.products.map((p) => ({ value: p.handle, label: p.title }))}
            onChange={(v) => onChange(encode(type, "product", v))}
          />
        ))}

      {kind === "custom" && (
        <input
          className={`${selectCls} min-w-[150px] flex-1 font-mono text-xs`}
          value={target}
          placeholder="/pages/about"
          onChange={(e) => onChange(encode(type, "custom", e.target.value))}
        />
      )}
    </div>
  );
}

/**
 * Jump straight to a referenced collection's editor.
 *
 * Opens in a new tab on purpose: this appears inside the theme customizer and
 * the navigation editor, where navigating away would throw out unsaved work.
 */
export function EditCollectionLink({ handle, ar }: { handle: string; ar: boolean }) {
  if (!handle) return null;
  return (
    <a
      href={`/collections?edit=${encodeURIComponent(handle)}`}
      target="_blank"
      rel="noreferrer"
      title={ar ? "تعديل هذا التصنيف" : "Edit this collection"}
      className="flex h-9 shrink-0 items-center rounded-lg px-2 text-ink-soft transition-colors hover:bg-surface-hover hover:text-brand-600"
    >
      <IcEdit className="h-3.5 w-3.5" />
    </a>
  );
}

/** Shown instead of an empty dropdown, so the blank isn't mistaken for a bug. */
function EmptyHint({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
      {text} ·{" "}
      <a className="font-medium text-brand-600 hover:underline" href={href}>
        {cta}
      </a>
    </span>
  );
}

/** Multi-select for `collection_list` / `product_list` settings. */
export function ListPicker({
  type,
  value,
  targets,
  ar,
  onChange,
}: {
  type: "collection_list" | "product_list";
  value: unknown;
  targets: LinkTargets;
  ar: boolean;
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected: string[] = Array.isArray(value) ? value.map(String) : [];
  const options =
    type === "collection_list"
      ? targets.collections.map((c) => ({ handle: c.handle, label: `${c.title} (${c.count})` }))
      : targets.products.map((p) => ({ handle: p.handle, label: p.title }));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  function toggle(handle: string) {
    onChange(
      selected.includes(handle)
        ? selected.filter((h) => h !== handle)
        : [...selected, handle],
    );
  }

  if (options.length === 0)
    return (
      <div className="rounded-xl border border-line bg-surface-page p-2 text-xs text-ink-soft">
        {ar ? "لا توجد عناصر" : "Nothing to choose yet"}
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-page">
      {/* Long catalogs are unusable without a filter. */}
      {options.length > 8 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "ابحث…" : "Search…"}
          className="h-8 w-full border-b border-line bg-surface px-2.5 text-sm outline-none focus:border-brand-600"
        />
      )}
      <div className="max-h-40 overflow-y-auto p-1.5">
        {shown.length === 0 ? (
          <p className="px-1 py-2 text-center text-xs text-ink-soft">
            {ar ? "لا توجد نتائج" : "No matches"}
          </p>
        ) : (
          shown.map((o) => (
            <label
              key={o.handle}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-line accent-brand-600"
                checked={selected.includes(o.handle)}
                onChange={() => toggle(o.handle)}
              />
              <span className="truncate text-ink">{o.label}</span>
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <div className="border-t border-line px-2 py-1 text-[11px] text-ink-soft">
          {selected.length} {ar ? "محدد" : "selected"}
        </div>
      )}
    </div>
  );
}
