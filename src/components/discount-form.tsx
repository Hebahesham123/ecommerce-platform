"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import {
  type Discount,
  type DiscountType,
  type DiscountMethod,
  type AppliesTo,
  type MinRequirement,
  type Eligibility,
  DISCOUNT_TYPES,
  typeKey,
  statusKey,
  statusTone,
  randomCode,
  deriveStatus,
  type RefItem,
} from "@/lib/discounts";
import { Card, Badge } from "@/components/ui";
import { summaryLine } from "@/components/discount-summary";
import { createDiscount, updateDiscount } from "@/app/(admin)/discounts/actions";
import { IcPlus, IcDiscount } from "@/components/icons";

// ---------- small primitives ----------
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface-page p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? "bg-white text-ink shadow-card" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="radio"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 accent-brand-600"
        />
        <span className="text-sm text-ink">{label}</span>
      </label>
      {checked && children && <div className="mt-2 ms-6 ps-0">{children}</div>}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-brand-600"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

/** Comma-separated tag input -> RefItem[] (label-based; swap for a product picker later). */
function TagInput({
  items,
  onChange,
  placeholder,
}: {
  items: RefItem[];
  onChange: (v: RefItem[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  function add() {
    const label = text.trim();
    if (!label) return;
    onChange([...items, { id: crypto.randomUUID(), label }]);
    setText("");
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" onClick={add} className="btn-outline shrink-0">
          <IcPlus className="h-4 w-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span key={it.id} className="badge bg-slate-100 text-ink-muted">
              {it.label}
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                className="ms-1 text-ink-soft hover:text-rose-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- date helpers ----------
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function localToIso(val: string): string {
  return new Date(val).toISOString();
}

// ---------- main form ----------
export function DiscountForm({
  initial,
  mode,
}: {
  initial: Discount;
  mode: "create" | "edit";
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [d, setD] = useState<Discount>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof Discount>(k: K, v: Discount[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const isAmount =
    d.discountType === "amount_off_products" || d.discountType === "amount_off_order";
  const isProducts = d.discountType === "amount_off_products";
  const isBxgy = d.discountType === "buy_x_get_y";
  const isShipping = d.discountType === "free_shipping";

  async function save() {
    setErr(null);
    if (d.method === "code" && !(d.code || "").trim() && !d.title.trim()) {
      setErr(lang === "ar" ? "أدخل كود الخصم" : "Enter a discount code");
      return;
    }
    setSaving(true);
    const payload: Discount = {
      ...d,
      title: d.method === "code" ? (d.code || d.title).trim() : d.title.trim(),
    };
    const res =
      mode === "create"
        ? await createDiscount(payload)
        : await updateDiscount(d.id, payload);
    setSaving(false);
    if (res.ok) {
      router.push("/discounts");
      router.refresh();
    } else {
      setErr(res.error === "not_configured" ? t("supabase_missing") : res.error);
    }
  }

  const previewStatus = deriveStatus(d.startsAt, d.endsAt, d.status);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ---- Main column ---- */}
      <div className="space-y-4 lg:col-span-2">
        {/* Method + identity */}
        <Section title={t("sec_method")}>
          <Segmented<DiscountMethod>
            value={d.method}
            onChange={(v) => set("method", v)}
            options={[
              { value: "code", label: t("dm_code") },
              { value: "automatic", label: t("dm_automatic") },
            ]}
          />
          {d.method === "code" ? (
            <Field label={t("fld_code")} hint={t("code_hint")}>
              <div className="flex gap-2">
                <input
                  value={d.code ?? ""}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  placeholder="SUMMER25"
                  className={inputCls}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => set("code", randomCode())}
                  className="btn-outline shrink-0"
                >
                  {t("fld_generate")}
                </button>
              </div>
            </Field>
          ) : (
            <Field label={t("fld_title_auto")} hint={t("title_hint")}>
              <input
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={lang === "ar" ? "خصم الصيف التلقائي" : "Summer auto discount"}
                className={inputCls}
              />
            </Field>
          )}
        </Section>

        {/* Type selector */}
        <Section title={t("sec_type")}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DISCOUNT_TYPES.map((dt: DiscountType) => {
              const active = d.discountType === dt;
              const descKey = (
                {
                  amount_off_products: "dt_amount_products_desc",
                  amount_off_order: "dt_amount_order_desc",
                  buy_x_get_y: "dt_bxgy_desc",
                  free_shipping: "dt_free_shipping_desc",
                } as const
              )[dt];
              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => set("discountType", dt)}
                  className={`rounded-xl border p-3 text-start transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-50"
                      : "border-line hover:bg-surface-hover"
                  }`}
                >
                  <div className="text-sm font-semibold text-ink">{t(typeKey[dt])}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{t(descKey)}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Value (amount types) */}
        {isAmount && (
          <Section title={t("sec_value")}>
            <Segmented
              value={d.valueType ?? "percentage"}
              onChange={(v) => set("valueType", v)}
              options={[
                { value: "percentage", label: t("percentage") },
                { value: "fixed_amount", label: t("fixed_amount") },
              ]}
            />
            <Field label={t("value_label")}>
              <div className="relative max-w-xs">
                <input
                  type="number"
                  min={0}
                  value={d.value ?? ""}
                  onChange={(e) =>
                    set("value", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={inputCls}
                  dir="ltr"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                  {d.valueType === "percentage" ? "%" : "EGP"}
                </span>
              </div>
            </Field>
          </Section>
        )}

        {/* Applies to (products) */}
        {isProducts && (
          <Section title={t("sec_applies_to")}>
            <div className="space-y-3">
              {(
                [
                  ["all", "applies_all_products"],
                  ["collections", "applies_collections"],
                  ["products", "applies_products"],
                ] as const
              ).map(([val, key]) => (
                <RadioRow
                  key={val}
                  checked={d.appliesTo === val}
                  onChange={() => set("appliesTo", val as AppliesTo)}
                  label={t(key)}
                >
                  {val !== "all" && (
                    <TagInput
                      items={d.appliesToIds}
                      onChange={(v) => set("appliesToIds", v)}
                      placeholder={
                        lang === "ar" ? "اكتب اسماً ثم Enter" : "Type a name, then Enter"
                      }
                    />
                  )}
                </RadioRow>
              ))}
            </div>
          </Section>
        )}

        {/* Buy X Get Y */}
        {isBxgy && (
          <>
            <Section title={t("sec_bxgy_buys")}>
              <Segmented<MinRequirement>
                value={d.buyType ?? "minimum_quantity"}
                onChange={(v) => set("buyType", v)}
                options={[
                  { value: "minimum_quantity", label: t("bxgy_min_qty") },
                  { value: "minimum_amount", label: t("bxgy_min_amount") },
                ]}
              />
              <Field>
                <input
                  type="number"
                  min={0}
                  value={d.buyValue ?? ""}
                  onChange={(e) =>
                    set("buyValue", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={`${inputCls} max-w-xs`}
                  dir="ltr"
                />
              </Field>
              <TagInput
                items={d.buyItemIds}
                onChange={(v) => set("buyItemIds", v)}
                placeholder={lang === "ar" ? "منتجات/مجموعات الشراء" : "Items customer buys"}
              />
            </Section>
            <Section title={t("sec_bxgy_gets")}>
              <Field label={t("bxgy_gets_qty")}>
                <input
                  type="number"
                  min={0}
                  value={d.getQuantity ?? ""}
                  onChange={(e) =>
                    set("getQuantity", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={`${inputCls} max-w-xs`}
                  dir="ltr"
                />
              </Field>
              <TagInput
                items={d.getItemIds}
                onChange={(v) => set("getItemIds", v)}
                placeholder={lang === "ar" ? "منتجات/مجموعات الهدية" : "Items customer gets"}
              />
              <Check
                checked={d.getIsFree}
                onChange={(v) => set("getIsFree", v)}
                label={t("bxgy_free")}
              />
              {!d.getIsFree && (
                <div className="flex items-center gap-2">
                  <Segmented
                    value={d.getValueType ?? "percentage"}
                    onChange={(v) => set("getValueType", v)}
                    options={[
                      { value: "percentage", label: t("percentage") },
                      { value: "fixed_amount", label: t("fixed_amount") },
                    ]}
                  />
                  <input
                    type="number"
                    min={0}
                    value={d.getValue ?? ""}
                    onChange={(e) =>
                      set("getValue", e.target.value === "" ? null : Number(e.target.value))
                    }
                    className={`${inputCls} max-w-[8rem]`}
                    dir="ltr"
                  />
                </div>
              )}
            </Section>
          </>
        )}

        {/* Free shipping */}
        {isShipping && (
          <Section title={t("sec_countries")}>
            <RadioRow
              checked={d.shipCountries.length === 0}
              onChange={() => set("shipCountries", [])}
              label={t("countries_all")}
            />
            <RadioRow
              checked={d.shipCountries.length > 0}
              onChange={() => set("shipCountries", [{ id: "EG", label: "Egypt" }])}
              label={lang === "ar" ? "دول محددة" : "Selected countries"}
            >
              <TagInput
                items={d.shipCountries}
                onChange={(v) => set("shipCountries", v)}
                placeholder={lang === "ar" ? "أضف دولة" : "Add a country"}
              />
            </RadioRow>
            <Check
              checked={d.shipExcludeOverAmount !== null}
              onChange={(v) => set("shipExcludeOverAmount", v ? 0 : null)}
              label={t("ship_exclude")}
            />
            {d.shipExcludeOverAmount !== null && (
              <input
                type="number"
                min={0}
                value={d.shipExcludeOverAmount}
                onChange={(e) => set("shipExcludeOverAmount", Number(e.target.value))}
                className={`${inputCls} max-w-xs`}
                dir="ltr"
              />
            )}
          </Section>
        )}

        {/* Minimum requirements (not for bxgy) */}
        {!isBxgy && (
          <Section title={t("sec_min_req")}>
            <RadioRow
              checked={d.minRequirement === "none"}
              onChange={() => set("minRequirement", "none")}
              label={t("min_none")}
            />
            <RadioRow
              checked={d.minRequirement === "minimum_amount"}
              onChange={() => set("minRequirement", "minimum_amount" as MinRequirement)}
              label={t("min_amount")}
            >
              <input
                type="number"
                min={0}
                value={d.minAmount ?? ""}
                onChange={(e) =>
                  set("minAmount", e.target.value === "" ? null : Number(e.target.value))
                }
                className={`${inputCls} max-w-xs`}
                dir="ltr"
              />
            </RadioRow>
            <RadioRow
              checked={d.minRequirement === "minimum_quantity"}
              onChange={() => set("minRequirement", "minimum_quantity" as MinRequirement)}
              label={t("min_quantity")}
            >
              <input
                type="number"
                min={0}
                value={d.minQuantity ?? ""}
                onChange={(e) =>
                  set("minQuantity", e.target.value === "" ? null : Number(e.target.value))
                }
                className={`${inputCls} max-w-xs`}
                dir="ltr"
              />
            </RadioRow>
          </Section>
        )}

        {/* Eligibility */}
        <Section title={t("sec_eligibility")}>
          {(
            [
              ["all", "elig_all"],
              ["segments", "elig_segments"],
              ["customers", "elig_customers"],
            ] as const
          ).map(([val, key]) => (
            <RadioRow
              key={val}
              checked={d.eligibility === val}
              onChange={() => set("eligibility", val as Eligibility)}
              label={t(key)}
            >
              {val !== "all" && (
                <TagInput
                  items={d.eligibilityIds}
                  onChange={(v) => set("eligibilityIds", v)}
                  placeholder={lang === "ar" ? "أضف عميلاً/شريحة" : "Add customer/segment"}
                />
              )}
            </RadioRow>
          ))}
        </Section>

        {/* Max uses */}
        <Section title={t("sec_max_uses")}>
          <Check
            checked={d.usageLimitTotal !== null}
            onChange={(v) => set("usageLimitTotal", v ? 1 : null)}
            label={t("limit_total")}
          />
          {d.usageLimitTotal !== null && (
            <input
              type="number"
              min={1}
              value={d.usageLimitTotal}
              onChange={(e) => set("usageLimitTotal", Number(e.target.value))}
              className={`${inputCls} max-w-xs`}
              dir="ltr"
            />
          )}
          {d.method === "code" && (
            <Check
              checked={d.usageLimitOncePerCustomer}
              onChange={(v) => set("usageLimitOncePerCustomer", v)}
              label={t("limit_once")}
            />
          )}
        </Section>

        {/* Combinations */}
        <Section title={t("sec_combinations")}>
          <p className="text-xs text-ink-soft">{t("combine_hint")}</p>
          <Check
            checked={d.combineProduct}
            onChange={(v) => set("combineProduct", v)}
            label={t("combine_product")}
          />
          <Check
            checked={d.combineOrder}
            onChange={(v) => set("combineOrder", v)}
            label={t("combine_order")}
          />
          <Check
            checked={d.combineShipping}
            onChange={(v) => set("combineShipping", v)}
            label={t("combine_shipping")}
          />
        </Section>

        {/* Active dates */}
        <Section title={t("sec_dates")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("start_date")}>
              <input
                type="datetime-local"
                value={isoToLocal(d.startsAt)}
                onChange={(e) =>
                  set("startsAt", e.target.value ? localToIso(e.target.value) : d.startsAt)
                }
                className={inputCls}
                dir="ltr"
              />
            </Field>
            <Field label={t("end_date")}>
              <input
                type="datetime-local"
                value={isoToLocal(d.endsAt)}
                onChange={(e) =>
                  set("endsAt", e.target.value ? localToIso(e.target.value) : null)
                }
                className={inputCls}
                dir="ltr"
              />
            </Field>
          </div>
        </Section>
      </div>

      {/* ---- Summary sidebar ---- */}
      <div className="lg:col-span-1">
        <div className="sticky top-20 space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("summary")}</h3>
              <Badge className={statusTone[previewStatus]}>{t(statusKey[previewStatus])}</Badge>
            </div>
            <div className="mb-4">
              <Segmented
                value={d.status === "draft" ? "draft" : "active"}
                onChange={(v) => set("status", v as Discount["status"])}
                options={[
                  { value: "active", label: t("ds_active") },
                  { value: "draft", label: t("ds_draft") },
                ]}
              />
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <IcDiscount className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">
                  {(d.method === "code" ? d.code || d.title : d.title) ||
                    (lang === "ar" ? "بدون عنوان" : "No title")}
                </div>
                <div className="text-xs text-ink-soft">{t(typeKey[d.discountType])}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink-muted">
              <li className="flex gap-2">
                <span className="text-ink-soft">•</span>
                {summaryLine(d, lang) || "—"}
              </li>
              <li className="flex gap-2">
                <span className="text-ink-soft">•</span>
                {d.minRequirement === "none"
                  ? t("min_none")
                  : d.minRequirement === "minimum_amount"
                    ? `${t("min_amount")}: ${egp(d.minAmount ?? 0, lang)}`
                    : `${t("min_quantity")}: ${d.minQuantity ?? 0}`}
              </li>
              <li className="flex gap-2">
                <span className="text-ink-soft">•</span>
                {d.eligibility === "all" ? t("elig_all") : t("elig_customers")}
              </li>
              <li className="flex gap-2">
                <span className="text-ink-soft">•</span>
                {[
                  d.combineProduct && t("combine_product"),
                  d.combineOrder && t("combine_order"),
                  d.combineShipping && t("combine_shipping"),
                ]
                  .filter(Boolean)
                  .join("، ") || t("combine_none")}
              </li>
            </ul>
          </Card>

          {err && (
            <Card className="border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {err}
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/discounts")}
              className="btn-outline"
            >
              {t("discard")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? t("saving") : t("save_discount")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
