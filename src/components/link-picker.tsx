"use client";

import { useEffect, useMemo, useState } from "react";
import type { EditableType } from "@/lib/theme-schema";

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
  "h-9 rounded-xl border border-line bg-surface-page px-2.5 text-sm text-ink outline-none focus:border-brand-600 focus:bg-white";

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
          <select
            className={`${selectCls} min-w-[150px] flex-1`}
            value={target}
            onChange={(e) => onChange(encode(type, "collection", e.target.value))}
          >
            <option value="">{ar ? "اختر تصنيفاً…" : "Choose a collection…"}</option>
            {targets.collections.map((c) => (
              <option key={c.handle} value={c.handle}>
                {c.title} ({c.count})
              </option>
            ))}
          </select>
        ))}

      {kind === "product" &&
        (targets.products.length === 0 ? (
          <EmptyHint
            text={ar ? "لا توجد منتجات بعد" : "No products yet"}
            href="/products"
            cta={ar ? "أضف منتجات" : "Add products"}
          />
        ) : (
          <select
            className={`${selectCls} min-w-[150px] flex-1`}
            value={target}
            onChange={(e) => onChange(encode(type, "product", e.target.value))}
          >
            <option value="">{ar ? "اختر منتجاً…" : "Choose a product…"}</option>
            {targets.products.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.title}
              </option>
            ))}
          </select>
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
  const selected: string[] = Array.isArray(value) ? value.map(String) : [];
  const options =
    type === "collection_list"
      ? targets.collections.map((c) => ({ handle: c.handle, label: `${c.title} (${c.count})` }))
      : targets.products.map((p) => ({ handle: p.handle, label: p.title }));

  function toggle(handle: string) {
    onChange(
      selected.includes(handle)
        ? selected.filter((h) => h !== handle)
        : [...selected, handle],
    );
  }

  return (
    <div className="max-h-32 overflow-y-auto rounded-xl border border-line bg-surface-page p-1.5">
      {options.length === 0 ? (
        <p className="p-1 text-xs text-ink-soft">
          {ar ? "لا توجد عناصر" : "Nothing to choose yet"}
        </p>
      ) : (
        options.map((o) => (
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
  );
}
