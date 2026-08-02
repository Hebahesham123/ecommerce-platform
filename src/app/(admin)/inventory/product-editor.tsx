"use client";

import {
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import {
  type InventoryItem,
  type Location,
  type ProductStatus,
  profit,
  margin,
  levelAt,
} from "@/lib/inventory";
import { createItem, createItems, updateItem, setLevel } from "./actions";
import { IcX, IcPlus, IcImage, IcTrash, IcLocation } from "@/components/icons";

type TFn = ReturnType<typeof useI18n>["t"];
type ProductOption = { name: string; values: string[] };
type Override = { sku: string; price: string; qty: string };

const MAX_OPTIONS = 3;

/** Cartesian product: [[S,M],[Red,Blue]] → [[S,Red],[S,Blue],[M,Red],[M,Blue]]. */
function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((row) => list.map((v) => [...row, v])),
    [[]],
  );
}

function autoSku(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .join("-");
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${base || "SKU"}-${n}`;
}

// =============================================================================
export function ProductEditor({
  item,
  locations,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const isNew = !item.id;
  const [draft, setDraft] = useState<InventoryItem>(item);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const defaultLoc = useMemo(
    () => locations.find((l) => l.isDefault) ?? locations[0],
    [locations],
  );

  const validOptions = options.filter(
    (o) => o.name.trim() && o.values.length > 0,
  );
  const combos: string[][] = validOptions.length
    ? cartesian(validOptions.map((o) => o.values))
    : [];
  const multiVariant = isNew && combos.length > 1;

  function set<K extends keyof InventoryItem>(k: K, v: InventoryItem[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function ov(key: string): Override {
    return overrides[key] ?? { sku: "", price: "", qty: "" };
  }
  function setOv(key: string, patch: Partial<Override>) {
    setOverrides((o) => ({ ...o, [key]: { ...ov(key), ...patch } }));
  }

  // ---- Media -----------------------------------------------------------------
  function addImage(url: string) {
    const u = url.trim();
    if (!u) return;
    setDraft((d) => {
      if (d.images.includes(u)) return d;
      const images = [...d.images, u];
      return { ...d, images, imageUrl: images[0] };
    });
  }
  function removeImage(url: string) {
    setDraft((d) => {
      const images = d.images.filter((x) => x !== url);
      return { ...d, images, imageUrl: images[0] ?? "" };
    });
  }
  function makePrimary(url: string) {
    setDraft((d) => {
      const images = [url, ...d.images.filter((x) => x !== url)];
      return { ...d, images, imageUrl: images[0] };
    });
  }

  // ---- Levels (single-variant inventory) ------------------------------------
  function levelFor(locationId: string) {
    return (
      draft.levels.find((l) => l.locationId === locationId) ?? {
        locationId,
        onHand: 0,
        committed: 0,
        incoming: 0,
        available: 0,
      }
    );
  }
  function setLevelField(locationId: string, onHand: number) {
    setDraft((d) => {
      const existing = d.levels.find((l) => l.locationId === locationId);
      const next = existing
        ? d.levels.map((l) =>
            l.locationId === locationId
              ? { ...l, onHand, available: onHand - l.committed }
              : l,
          )
        : [
            ...d.levels,
            { locationId, onHand, committed: 0, incoming: 0, available: onHand },
          ];
      return { ...d, levels: next };
    });
  }

  // ---- Recommendations -------------------------------------------------------
  const recs = useMemo(
    () => buildRecs(draft, combos, ar),
    [draft, combos, ar],
  );

  // ---- Save ------------------------------------------------------------------
  async function save() {
    if (!draft.productName.trim()) {
      setErr("name_required");
      return;
    }
    setSaving(true);
    setErr(null);

    const withMedia: InventoryItem = {
      ...draft,
      imageUrl: draft.images[0] ?? draft.imageUrl ?? "",
    };

    if (isNew && multiVariant) {
      const items: InventoryItem[] = combos.map((combo, i) => {
        const key = combo.join(" / ");
        const o = ov(key);
        const qty = Math.max(0, Math.round(Number(o.qty) || 0));
        return {
          ...withMedia,
          variantTitle: key,
          sku: o.sku.trim() || (draft.sku?.trim() ? `${draft.sku.trim()}-${i + 1}` : null),
          price: o.price.trim() ? Number(o.price) : draft.price,
          levels:
            qty > 0 && defaultLoc
              ? [
                  {
                    locationId: defaultLoc.id,
                    onHand: qty,
                    committed: 0,
                    incoming: 0,
                    available: qty,
                  },
                ]
              : [],
        };
      });
      const res = await createItems(items);
      if (!res.ok) return fail(res.error);
    } else if (isNew) {
      const single =
        combos.length === 1
          ? { ...withMedia, variantTitle: combos[0].join(" / ") }
          : withMedia;
      const res = await createItem(single);
      if (!res.ok) return fail(res.error);
    } else {
      const res = await updateItem(draft.id, withMedia);
      if (!res.ok) return fail(res.error);
      for (const l of draft.levels) {
        const orig = item.levels.find((o) => o.locationId === l.locationId);
        if (!orig || orig.onHand !== l.onHand) {
          await setLevel(draft.id, l.locationId, { onHand: l.onHand });
        }
      }
    }
    setSaving(false);
    onSaved();
  }
  function fail(error: string) {
    setErr(error);
    setSaving(false);
  }

  const prof = profit(draft.price, draft.cost);
  const marg = margin(draft.price, draft.cost);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full justify-center p-3 sm:p-5">
        <div className="w-full max-w-5xl rounded-2xl bg-surface-page shadow-xl">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-line bg-white/95 px-5 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="btn-ghost h-9 w-9 p-0">
                <IcX className="h-4 w-4" />
              </button>
              <h2 className="text-base font-bold text-ink">
                {isNew ? t("new_product") : t("edit_product")}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ProductStatus)}
                className="h-9 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-600"
              >
                <option value="active">{t("st_active")}</option>
                <option value="draft">{t("st_draft")}</option>
                <option value="archived">{t("st_archived")}</option>
              </select>
              <button onClick={onClose} className="btn-outline h-9">
                {t("cancel")}
              </button>
              <button onClick={save} disabled={saving} className="btn-primary h-9">
                {saving ? t("saving") : t("save_product")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-3">
            {/* ---- Main column ---- */}
            <div className="space-y-4 lg:col-span-2">
              {/* Details */}
              <SectionCard title={t("sec_details")}>
                <Field label={t("fld_product_name")}>
                  <input
                    value={draft.productName}
                    onChange={(e) => set("productName", e.target.value)}
                    className="inp"
                  />
                </Field>
                <Field label={t("fld_description")}>
                  <textarea
                    value={draft.description ?? ""}
                    onChange={(e) => set("description", e.target.value)}
                    rows={4}
                    className="inp h-auto resize-y py-2"
                  />
                </Field>
              </SectionCard>

              {/* Media */}
              <SectionCard title={t("sec_media")} hint={t("media_hint")}>
                <MediaGallery
                  images={draft.images}
                  onAdd={addImage}
                  onRemove={removeImage}
                  onPrimary={makePrimary}
                  t={t}
                />
              </SectionCard>

              {/* Pricing */}
              <SectionCard title={t("sec_pricing")}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label={t("fld_price")}>
                    <input
                      type="number"
                      value={draft.price ?? ""}
                      onChange={(e) =>
                        set("price", e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="inp"
                    />
                  </Field>
                  <Field label={t("fld_compare_at")}>
                    <input
                      type="number"
                      value={draft.compareAtPrice ?? ""}
                      onChange={(e) =>
                        set(
                          "compareAtPrice",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                      className="inp"
                    />
                  </Field>
                  <Field label={t("fld_cost")}>
                    <input
                      type="number"
                      value={draft.cost ?? ""}
                      onChange={(e) =>
                        set("cost", e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="inp"
                    />
                  </Field>
                </div>
                {(prof != null || marg != null) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prof != null && (
                      <span className="rounded-xl bg-surface-page px-3 py-2 text-sm">
                        <span className="text-ink-soft">{t("profit_label")}: </span>
                        <span className="font-semibold text-ink">{egp(prof, lang)}</span>
                      </span>
                    )}
                    {marg != null && (
                      <span className="rounded-xl bg-surface-page px-3 py-2 text-sm">
                        <span className="text-ink-soft">{t("margin_label")}: </span>
                        <span
                          className={`font-semibold ${marg < 20 ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {num(marg, lang)}%
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Variants */}
              <SectionCard title={t("sec_variants2")}>
                {isNew ? (
                  <>
                    <OptionsBuilder
                      options={options}
                      setOptions={setOptions}
                      combos={combos}
                      t={t}
                      ar={ar}
                    />
                    {multiVariant && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm">
                          <thead>
                            <tr className="text-xs text-ink-soft">
                              <th className="px-2 py-2 text-start font-medium">
                                {t("variant_col")}
                              </th>
                              <th className="px-2 py-2 text-start font-medium">
                                {t("col_sku")}
                              </th>
                              <th className="px-2 py-2 text-end font-medium">
                                {t("fld_price")}
                              </th>
                              <th className="px-2 py-2 text-end font-medium">
                                {t("col_on_hand")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {combos.map((combo, i) => {
                              const key = combo.join(" / ");
                              const o = ov(key);
                              return (
                                <tr key={key} className="border-t border-line">
                                  <td className="px-2 py-2 font-medium text-ink">
                                    {key}
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      value={o.sku}
                                      onChange={(e) => setOv(key, { sku: e.target.value })}
                                      placeholder={
                                        draft.sku?.trim() ? `${draft.sku.trim()}-${i + 1}` : ""
                                      }
                                      className="inp h-8"
                                      dir="ltr"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      value={o.price}
                                      onChange={(e) => setOv(key, { price: e.target.value })}
                                      placeholder={draft.price != null ? String(draft.price) : ""}
                                      className="inp h-8 w-20 text-end"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={o.qty}
                                      onChange={(e) => setOv(key, { qty: e.target.value })}
                                      className="inp h-8 w-16 text-end"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {defaultLoc && (
                          <p className="mt-2 text-xs text-ink-soft">
                            {ar
                              ? `الكمية تُسجَّل في: ${defaultLoc.name}. عدّلها لباقي المواقع من جدول المخزون.`
                              : `Quantity is added at: ${defaultLoc.name}. Adjust other locations in the inventory grid.`}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Field label={t("fld_variant")}>
                    <input
                      value={draft.variantTitle ?? ""}
                      onChange={(e) => set("variantTitle", e.target.value)}
                      className="inp"
                    />
                  </Field>
                )}
              </SectionCard>

              {/* Inventory (single variant) */}
              {!multiVariant && (
                <SectionCard title={t("sec_inventory")}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t("fld_sku")}>
                      <div className="flex items-center gap-2">
                        <input
                          value={draft.sku ?? ""}
                          onChange={(e) => set("sku", e.target.value)}
                          className="inp"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => set("sku", autoSku(draft.productName))}
                          className="btn-outline h-10 shrink-0 px-3 text-xs"
                        >
                          {t("generate_sku")}
                        </button>
                      </div>
                    </Field>
                    <Field label={t("fld_barcode")}>
                      <input
                        value={draft.barcode ?? ""}
                        onChange={(e) => set("barcode", e.target.value)}
                        className="inp"
                        dir="ltr"
                      />
                    </Field>
                  </div>
                  <label className="mt-3 flex items-center gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={draft.tracked}
                      onChange={(e) => set("tracked", e.target.checked)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {t("fld_tracked")}
                  </label>

                  <div className="mt-4">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                      <IcLocation className="h-4 w-4 text-ink-soft" />
                      {t("quantities_by_location")}
                    </h4>
                    {locations.length === 0 ? (
                      <p className="text-sm text-ink-soft">{t("no_locations")}</p>
                    ) : (
                      <div className="space-y-2">
                        {locations.map((l) => {
                          const lv = levelFor(l.id);
                          return (
                            <div
                              key={l.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-ink">
                                  {l.name}
                                </div>
                                <div className="text-xs text-ink-soft">
                                  {t("col_available")}:{" "}
                                  {num(lv.onHand - lv.committed, lang)}
                                </div>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={lv.onHand}
                                onChange={(e) =>
                                  setLevelField(
                                    l.id,
                                    Math.max(0, Number(e.target.value) || 0),
                                  )
                                }
                                className="inp h-9 w-20 text-end font-semibold"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* ---- Side column ---- */}
            <div className="space-y-4">
              {/* Recommendations */}
              <SectionCard title={t("sec_recommendations")}>
                {recs.length === 0 ? (
                  <p className="text-sm text-emerald-600">
                    {ar ? "كل شيء يبدو رائعاً ✨" : "Everything looks great ✨"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recs.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            r.tone === "warn"
                              ? "bg-rose-500"
                              : r.tone === "good"
                                ? "bg-emerald-500"
                                : "bg-amber-400"
                          }`}
                        />
                        <span className="text-ink-muted">{r.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {/* Organization */}
              <SectionCard title={t("sec_organization")}>
                <div className="space-y-3">
                  <Field label={t("fld_category")}>
                    <input
                      value={draft.category ?? ""}
                      onChange={(e) => set("category", e.target.value)}
                      className="inp"
                    />
                  </Field>
                  <Field label={t("fld_product_type")}>
                    <input
                      value={draft.productType ?? ""}
                      onChange={(e) => set("productType", e.target.value)}
                      className="inp"
                    />
                  </Field>
                  <Field label={t("fld_vendor")}>
                    <input
                      value={draft.vendor ?? ""}
                      onChange={(e) => set("vendor", e.target.value)}
                      className="inp"
                    />
                  </Field>
                  <Field label={t("fld_tags")}>
                    <ChipInput
                      values={draft.tags}
                      onAdd={(v) =>
                        set("tags", draft.tags.includes(v) ? draft.tags : [...draft.tags, v])
                      }
                      onRemove={(v) => set("tags", draft.tags.filter((x) => x !== v))}
                      placeholder={t("fld_tags_ph")}
                    />
                  </Field>
                </div>
              </SectionCard>
            </div>
          </div>

          {err && (
            <p className="px-5 pb-4 text-sm text-rose-600">
              {err === "name_required"
                ? ar
                  ? "اسم المنتج مطلوب"
                  : "Product name is required"
                : err === "not_configured"
                  ? t("supabase_missing")
                  : err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Recommendations engine -------------------------------------------------
type Rec = { tone: "warn" | "good" | "tip"; text: string };
function buildRecs(draft: InventoryItem, combos: string[][], ar: boolean): Rec[] {
  const r: Rec[] = [];
  const m = margin(draft.price, draft.cost);
  if (draft.images.length === 0)
    r.push({ tone: "tip", text: ar ? "أضف صورة واحدة على الأقل." : "Add at least one image." });
  if (!draft.description?.trim())
    r.push({ tone: "tip", text: ar ? "أضف وصفاً لتحسين الظهور في البحث." : "Add a description to improve SEO." });
  if (draft.price == null)
    r.push({ tone: "warn", text: ar ? "حدّد سعر البيع." : "Set a selling price." });
  if (draft.cost == null)
    r.push({ tone: "tip", text: ar ? "أضف تكلفة القطعة لرؤية الربح." : "Add cost per item to see profit." });
  if (m != null && m < 20)
    r.push({ tone: "warn", text: ar ? `هامش ربح منخفض (${m}%).` : `Low margin (${m}%).` });
  if (m != null && m >= 20)
    r.push({ tone: "good", text: ar ? `هامش ربح جيد (${m}%).` : `Healthy margin (${m}%).` });
  if (draft.compareAtPrice == null && draft.price != null)
    r.push({ tone: "tip", text: ar ? 'أضف "السعر قبل الخصم" لإظهار شارة تخفيض.' : "Add a compare-at price to show a sale badge." });
  if (draft.compareAtPrice != null && draft.price != null && draft.compareAtPrice <= draft.price)
    r.push({ tone: "warn", text: ar ? "السعر قبل الخصم يجب أن يكون أعلى من السعر." : "Compare-at price should be higher than the price." });
  if (!draft.sku?.trim() && combos.length <= 1)
    r.push({ tone: "tip", text: ar ? "أضف SKU لتتبّع المخزون." : "Add a SKU to track inventory." });
  if (combos.length > 1)
    r.push({ tone: "tip", text: ar ? `سيتم إنشاء ${combos.length} تنويعة.` : `${combos.length} variants will be created.` });
  if (draft.tags.length === 0)
    r.push({ tone: "tip", text: ar ? "أضف وسوماً لتنظيم المنتجات." : "Add tags to organize products." });
  return r;
}

// ---- Small building blocks --------------------------------------------------
function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function MediaGallery({
  images,
  onAdd,
  onRemove,
  onPrimary,
  t,
}: {
  images: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  onPrimary: (url: string) => void;
  t: TFn;
}) {
  const [url, setUrl] = useState("");
  const commit = () => {
    if (url.trim()) {
      onAdd(url);
      setUrl("");
    }
  };
  return (
    <div>
      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-page"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute start-1 top-1 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t("media_primary")}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/40 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => onPrimary(img)}
                    className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-ink"
                  >
                    {t("media_primary")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img)}
                  className="ms-auto rounded-md bg-white/90 p-1 text-rose-600"
                  aria-label="remove image"
                >
                  <IcTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-page text-ink-soft">
          <IcImage className="h-5 w-5" />
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={t("media_add")}
          className="inp"
          dir="ltr"
        />
        <button type="button" onClick={commit} className="btn-outline h-10 shrink-0 px-3">
          <IcPlus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OptionsBuilder({
  options,
  setOptions,
  combos,
  t,
  ar,
}: {
  options: ProductOption[];
  setOptions: Dispatch<SetStateAction<ProductOption[]>>;
  combos: string[][];
  t: TFn;
  ar: boolean;
}) {
  const setName = (i: number, name: string) =>
    setOptions((o) => o.map((op, x) => (x === i ? { ...op, name } : op)));
  const addValue = (i: number, raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setOptions((o) =>
      o.map((op, x) =>
        x === i && !op.values.includes(v) ? { ...op, values: [...op.values, v] } : op,
      ),
    );
  };
  const removeValue = (i: number, v: string) =>
    setOptions((o) =>
      o.map((op, x) => (x === i ? { ...op, values: op.values.filter((y) => y !== v) } : op)),
    );

  return (
    <div className="space-y-2">
      {options.map((op, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center gap-2">
            <input
              value={op.name}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={t("fld_option_name_ph")}
              className="inp h-9"
            />
            <button
              type="button"
              onClick={() => setOptions((o) => o.filter((_, x) => x !== i))}
              className="btn-ghost h-9 w-9 shrink-0 p-0 text-rose-600 hover:bg-rose-50"
              aria-label="remove option"
            >
              <IcX className="h-4 w-4" />
            </button>
          </div>
          <ChipInput
            values={op.values}
            onAdd={(v) => addValue(i, v)}
            onRemove={(v) => removeValue(i, v)}
            placeholder={t("fld_value_ph")}
          />
        </div>
      ))}
      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => setOptions((o) => [...o, { name: "", values: [] }])}
          className="btn-outline h-9 w-full justify-center text-sm"
        >
          <IcPlus className="h-4 w-4" /> {t("add_option")}
        </button>
      )}
      {combos.length > 1 && (
        <p className="text-xs font-medium text-ink-soft">
          {ar ? `${combos.length} تنويعة` : `${combos.length} variants`}
        </p>
      )}
    </div>
  );
}

function ChipInput({
  values,
  onAdd,
  onRemove,
  placeholder,
}: {
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const [v, setV] = useState("");
  const commit = () => {
    if (v.trim()) {
      onAdd(v.trim());
      setV("");
    }
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((val) => (
            <span key={val} className="badge gap-1 bg-brand-50 text-brand-700">
              {val}
              <button
                type="button"
                onClick={() => onRemove(val)}
                className="text-brand-700/60 hover:text-brand-700"
                aria-label="remove"
              >
                <IcX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="inp h-9"
      />
    </div>
  );
}
