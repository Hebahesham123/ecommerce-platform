"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  collectionHandle,
  ruleTypeKey,
  type Collection,
  type CollectionRuleType,
} from "@/lib/collections";
import { type InventoryItem, totalAvailable } from "@/lib/inventory";
import { saveCollection } from "./actions";
import { Checkbox, SearchInput } from "@/components/dashboard-ui";
import { IcX, IcImage, IcSearch, IcTrash } from "@/components/icons";

/** A pickable product: the inventory items that share one product_name. */
export type PickerProduct = {
  productName: string;
  itemId: string;
  image: string | null;
  category: string | null;
  vendor: string | null;
  tags: string[];
  status: string;
  variants: number;
  available: number;
  price: number | null;
};

export function groupPickerProducts(items: InventoryItem[]): PickerProduct[] {
  const map = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const key = it.productName.trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const out: PickerProduct[] = [];
  for (const [productName, group] of map) {
    const prices = group.map((g) => g.price).filter((p): p is number => p != null);
    const withImg = group.find((g) => g.imageUrl) ?? group[0];
    out.push({
      productName,
      itemId: group[0].id,
      image: withImg.imageUrl,
      category: group[0].category,
      vendor: group[0].vendor,
      tags: [...new Set(group.flatMap((g) => g.tags))],
      status: group[0].status,
      variants: group.length,
      available: group.reduce((s, g) => s + totalAvailable(g), 0),
      price: prices.length ? Math.min(...prices) : null,
    });
  }
  return out.sort((a, b) => a.productName.localeCompare(b.productName));
}

const RULES: CollectionRuleType[] = ["manual", "category", "vendor", "tag"];

export function CollectionEditor({
  collection,
  catalog,
  onClose,
  onSaved,
}: {
  collection: Collection;
  catalog: PickerProduct[];
  onClose: () => void;
  onSaved: (c: Collection) => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const isNew = !collection.id;

  const [title, setTitle] = useState(collection.title);
  const [handle, setHandle] = useState(collection.handle);
  const [handleEdited, setHandleEdited] = useState(Boolean(collection.handle));
  const [description, setDescription] = useState(collection.description ?? "");
  const [imageUrl, setImageUrl] = useState(collection.imageUrl ?? "");
  const [isPublished, setIsPublished] = useState(collection.isPublished);
  const [ruleType, setRuleType] = useState<CollectionRuleType>(collection.ruleType);
  const [ruleValue, setRuleValue] = useState(collection.ruleValue ?? "");
  const [picked, setPicked] = useState<string[]>(
    collection.products.map((p) => p.productName),
  );
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the handle in step with the title until the user edits it by hand.
  useEffect(() => {
    if (!handleEdited) setHandle(collectionHandle(title));
  }, [title, handleEdited]);

  const byName = useMemo(
    () => new Map(catalog.map((p) => [p.productName, p])),
    [catalog],
  );

  // Values available for automatic rules, taken from the real catalog.
  const ruleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalog) {
      if (ruleType === "category" && p.category) set.add(p.category);
      if (ruleType === "vendor" && p.vendor) set.add(p.vendor);
      if (ruleType === "tag") for (const tag of p.tags) set.add(tag);
    }
    return [...set].sort();
  }, [catalog, ruleType]);

  /** What the collection will actually contain once saved. */
  const preview = useMemo(() => {
    if (ruleType === "manual")
      return picked.map((n) => byName.get(n)).filter((p): p is PickerProduct => Boolean(p));
    const v = ruleValue.trim().toLowerCase();
    if (!v) return [];
    return catalog.filter((p) => {
      if (ruleType === "category") return (p.category ?? "").toLowerCase() === v;
      if (ruleType === "vendor") return (p.vendor ?? "").toLowerCase() === v;
      return p.tags.some((tag) => tag.toLowerCase() === v);
    });
  }, [ruleType, ruleValue, picked, byName, catalog]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter((p) =>
      `${p.productName} ${p.category ?? ""} ${p.vendor ?? ""} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [catalog, q]);

  function toggle(productName: string) {
    setPicked((cur) =>
      cur.includes(productName)
        ? cur.filter((n) => n !== productName)
        : [...cur, productName],
    );
  }

  const allShownPicked = shown.length > 0 && shown.every((p) => picked.includes(p.productName));

  function toggleAllShown() {
    setPicked((cur) => {
      if (allShownPicked) {
        const drop = new Set(shown.map((p) => p.productName));
        return cur.filter((n) => !drop.has(n));
      }
      const add = shown.map((p) => p.productName).filter((n) => !cur.includes(n));
      return [...cur, ...add];
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const res = await saveCollection({
      id: collection.id || undefined,
      title,
      handle,
      description,
      imageUrl,
      isPublished,
      sortOrder: collection.sortOrder,
      ruleType,
      ruleValue: ruleType === "manual" ? null : ruleValue,
      products: picked.map((name) => ({
        productName: name,
        itemId: byName.get(name)?.itemId ?? null,
      })),
    });
    setSaving(false);
    if (res.ok) onSaved(res.data);
    else {
      const msgs: Record<string, string> = {
        title_required: ar ? "الاسم مطلوب" : "A title is required",
        rule_value_required: ar ? "اختر قيمة للقاعدة" : "Pick a value for the rule",
        migration_missing: ar
          ? "شغّل الترحيل 0010_collections.sql في Supabase أولاً"
          : "Run migration 0010_collections.sql in Supabase first",
        not_configured: t("supabase_missing"),
      };
      setError(msgs[res.error] ?? res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-ink/50 backdrop-blur-sm">
      <div className="ms-auto flex h-full w-full max-w-3xl flex-col bg-surface shadow-pop">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">
              {isNew ? t("coll_new") : title || t("coll_edit")}
            </h2>
            <p className="text-xs text-ink-soft">
              {ar ? "يظهر في القالب على" : "Appears in the theme at"}{" "}
              <code className="rounded bg-surface-page px-1.5 py-0.5 font-mono text-[11px]">
                /shop/collections/{handle || "…"}
              </code>
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Basics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("coll_title")}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={ar ? "مثال: عروض الصيف" : "e.g. Summer sale"}
                className={inputCls}
              />
            </Field>
            <Field label={t("coll_handle")}>
              <input
                value={handle}
                onChange={(e) => {
                  setHandleEdited(true);
                  setHandle(collectionHandle(e.target.value));
                }}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </div>

          <Field label={t("coll_description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputCls} h-auto py-2`}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Field label={t("coll_image")}>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-page text-ink-soft">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <IcImage className="h-4 w-4" />
                  )}
                </span>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
            </Field>
            <Field label={t("coll_visibility")}>
              <button
                onClick={() => setIsPublished((v) => !v)}
                className={`h-9 rounded-xl px-3 text-sm font-medium transition-colors ${
                  isPublished
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-ink-muted"
                }`}
              >
                {isPublished ? t("coll_published") : t("coll_hidden")}
              </button>
            </Field>
          </div>

          {/* Membership type */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-muted">{t("coll_type")}</div>
            <div className="flex flex-wrap gap-1.5">
              {RULES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRuleType(r)}
                  className={`badge px-3 py-1.5 text-sm transition-colors ${
                    ruleType === r
                      ? "bg-ink text-white"
                      : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  {t(ruleTypeKey[r])}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {ruleType === "manual"
                ? ar
                  ? "اختر المنتجات يدوياً من القائمة بالأسفل."
                  : "Pick products by hand from the list below."
                : ar
                  ? "تُحدَّث تلقائياً كلما طابق منتج القيمة المختارة."
                  : "Updates itself whenever a product matches the value below."}
            </p>
          </div>

          {ruleType !== "manual" && (
            <Field label={t("coll_rule_value")}>
              <input
                list="rule-options"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder={ar ? "اكتب أو اختر…" : "Type or choose…"}
                className={inputCls}
              />
              <datalist id="rule-options">
                {ruleOptions.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>
          )}

          {/* Product picker */}
          {ruleType === "manual" ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-page p-2.5">
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder={ar ? "ابحث في المنتجات…" : "Search products…"}
                />
                <button className="btn-ghost h-9 px-3 text-xs" onClick={toggleAllShown}>
                  {allShownPicked ? t("coll_deselect_all") : t("coll_select_all")}
                </button>
                <span className="badge bg-brand-50 text-brand-700">
                  {num(picked.length, lang)} {t("coll_selected")}
                </span>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {shown.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ink-soft">
                    <IcSearch className="h-5 w-5" />
                    {catalog.length === 0
                      ? t("coll_no_products")
                      : ar
                        ? "لا توجد نتائج"
                        : "No results"}
                  </div>
                ) : (
                  shown.map((p) => {
                    const on = picked.includes(p.productName);
                    return (
                      <button
                        key={p.productName}
                        onClick={() => toggle(p.productName)}
                        className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-start transition-colors last:border-b-0 ${
                          on ? "bg-brand-50/50" : "hover:bg-surface-hover"
                        }`}
                      >
                        <Checkbox checked={on} onChange={() => toggle(p.productName)} />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-page text-ink-soft">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <IcImage className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {p.productName}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {[p.category, p.vendor].filter(Boolean).join(" · ") || "—"}
                            {p.variants > 1 && ` · ${num(p.variants, lang)} ${t("coll_variants")}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block text-sm font-semibold text-ink">
                            {p.price != null ? egp(p.price, lang) : "—"}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {num(p.available, lang)} {t("coll_in_stock_short")}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface-page p-3">
              <div className="mb-2 text-xs font-medium text-ink-muted">
                {t("coll_preview")} · {num(preview.length, lang)}
              </div>
              {preview.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-soft">{t("coll_no_matches")}</p>
              ) : (
                <ul className="space-y-1">
                  {preview.slice(0, 12).map((p) => (
                    <li key={p.productName} className="truncate text-sm text-ink">
                      {p.productName}
                    </li>
                  ))}
                  {preview.length > 12 && (
                    <li className="text-xs text-ink-soft">
                      + {num(preview.length - 12, lang)}…
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Chosen products, in the order the theme will show them */}
          {ruleType === "manual" && picked.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-muted">
                {t("coll_order_hint")}
              </div>
              <ul className="space-y-1">
                {picked.map((name, i) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 rounded-lg bg-surface-page px-3 py-1.5 text-sm"
                  >
                    <span className="w-5 text-xs text-ink-soft">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{name}</span>
                    <button
                      className="text-ink-soft hover:text-ink"
                      onClick={() => setPicked((c) => move(c, i, i - 1))}
                      disabled={i === 0}
                      title={ar ? "لأعلى" : "Move up"}
                    >
                      ↑
                    </button>
                    <button
                      className="text-ink-soft hover:text-ink"
                      onClick={() => setPicked((c) => move(c, i, i + 1))}
                      disabled={i === picked.length - 1}
                      title={ar ? "لأسفل" : "Move down"}
                    >
                      ↓
                    </button>
                    <button
                      className="text-rose-500 hover:text-rose-700"
                      onClick={() => toggle(name)}
                    >
                      <IcTrash className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <span className="text-xs text-ink-soft">
            {num(preview.length, lang)} {t("coll_products_in")}
          </span>
          <button className="btn-ghost ms-auto" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="btn-primary disabled:opacity-60"
            onClick={onSave}
            disabled={saving || !title.trim()}
          >
            {saving ? t("processing") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600 focus:bg-surface";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
