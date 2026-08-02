import type { DictKey } from "./i18n";
import { tone } from "./data";

// ---- Enums (mirror the Supabase schema) -------------------------------------
export type DiscountMethod = "code" | "automatic";
export type DiscountType =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";
export type DiscountValueType = "percentage" | "fixed_amount";
export type DiscountStatus = "active" | "scheduled" | "expired" | "draft";
export type AppliesTo = "all" | "collections" | "products";
export type MinRequirement = "none" | "minimum_amount" | "minimum_quantity";
export type Eligibility = "all" | "segments" | "customers";

export type RefItem = { id: string; label: string };

export type Discount = {
  id: string;
  title: string;
  method: DiscountMethod;
  code: string | null;
  discountType: DiscountType;
  status: DiscountStatus;

  valueType: DiscountValueType | null;
  value: number | null;

  appliesTo: AppliesTo;
  appliesToIds: RefItem[];

  // Buy X Get Y
  buyType: MinRequirement | null;
  buyValue: number | null;
  buyItemScope: AppliesTo | null;
  buyItemIds: RefItem[];
  getQuantity: number | null;
  getItemScope: AppliesTo | null;
  getItemIds: RefItem[];
  getValueType: DiscountValueType | null;
  getValue: number | null;
  getIsFree: boolean;
  maxUsesPerOrder: number | null;

  // Free shipping
  shipCountries: RefItem[];
  shipExcludeOverAmount: number | null;

  // Minimum requirement
  minRequirement: MinRequirement;
  minAmount: number | null;
  minQuantity: number | null;

  // Eligibility
  eligibility: Eligibility;
  eligibilityIds: RefItem[];

  // Usage limits
  usageLimitTotal: number | null;
  usageLimitOncePerCustomer: boolean;

  // Combinations
  combineProduct: boolean;
  combineOrder: boolean;
  combineShipping: boolean;

  // Dates
  startsAt: string;
  endsAt: string | null;

  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

// ---- i18n key maps ----------------------------------------------------------
export const methodKey: Record<DiscountMethod, DictKey> = {
  code: "dm_code",
  automatic: "dm_automatic",
};

export const typeKey: Record<DiscountType, DictKey> = {
  amount_off_products: "dt_amount_products",
  amount_off_order: "dt_amount_order",
  buy_x_get_y: "dt_bxgy",
  free_shipping: "dt_free_shipping",
};

export const statusKey: Record<DiscountStatus, DictKey> = {
  active: "ds_active",
  scheduled: "ds_scheduled",
  expired: "ds_expired",
  draft: "ds_draft",
};

// ---- Tone maps (reuse the shared tone palette from lib/data) ----------------
export const statusTone: Record<DiscountStatus, string> = {
  active: tone.green,
  scheduled: tone.blue,
  expired: tone.slate,
  draft: tone.amber,
};

// ---- Helpers ----------------------------------------------------------------
/** Derive status from active dates (draft is set explicitly elsewhere). */
export function deriveStatus(
  startsAt: string,
  endsAt: string | null,
  current: DiscountStatus,
): DiscountStatus {
  if (current === "draft") return "draft";
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (end !== null && end < now) return "expired";
  if (start > now) return "scheduled";
  return "active";
}

export const DISCOUNT_TYPES: DiscountType[] = [
  "amount_off_products",
  "amount_off_order",
  "buy_x_get_y",
  "free_shipping",
];

/** Empty draft used by the create form. */
export function emptyDiscount(method: DiscountMethod = "code"): Discount {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    method,
    code: "",
    discountType: "amount_off_products",
    status: "active",
    valueType: "percentage",
    value: null,
    appliesTo: "all",
    appliesToIds: [],
    buyType: "minimum_quantity",
    buyValue: null,
    buyItemScope: "all",
    buyItemIds: [],
    getQuantity: null,
    getItemScope: "all",
    getItemIds: [],
    getValueType: "percentage",
    getValue: null,
    getIsFree: true,
    maxUsesPerOrder: null,
    shipCountries: [],
    shipExcludeOverAmount: null,
    minRequirement: "none",
    minAmount: null,
    minQuantity: null,
    eligibility: "all",
    eligibilityIds: [],
    usageLimitTotal: null,
    usageLimitOncePerCustomer: false,
    combineProduct: false,
    combineOrder: false,
    combineShipping: false,
    startsAt: now,
    endsAt: null,
    usedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Random Shopify-style discount code. */
export function randomCode(len = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
