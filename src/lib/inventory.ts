import type { DictKey } from "./i18n";
import { tone } from "./data";

// ---- Domain types (mirror the Supabase schema in 0006_inventory.sql) --------

export type Location = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  governorate: string | null;
  country: string;
  phone: string | null;
  isActive: boolean;
  isDefault: boolean;
  fulfillsOnlineOrders: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Quantity of one item at one location. */
export type Level = {
  locationId: string;
  onHand: number;
  committed: number;
  incoming: number;
  available: number; // on_hand - committed (generated column)
};

/** A stock-keeping unit with its per-location levels. */
export type ProductStatus = "active" | "draft" | "archived";

export type InventoryItem = {
  id: string;
  productName: string; // acts as the product title
  description: string | null;
  imageUrl: string | null; // primary image (= images[0])
  images: string[]; // full media gallery
  status: ProductStatus;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  price: number | null;
  compareAtPrice: number | null;
  cost: number | null;
  tracked: boolean;
  levels: Level[];
  createdAt: string;
  updatedAt: string;
};

// ---- Pricing math (drives the profit/margin recommendations) ----------------
export function profit(price: number | null, cost: number | null): number | null {
  if (price == null || cost == null) return null;
  return Math.round((price - cost) * 100) / 100;
}
export function margin(price: number | null, cost: number | null): number | null {
  if (price == null || cost == null || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10; // one decimal %
}

export const statusTone: Record<ProductStatus, string> = {
  active: tone.green,
  draft: tone.amber,
  archived: tone.slate,
};
export const statusKey: Record<ProductStatus, DictKey> = {
  active: "st_active",
  draft: "st_draft",
  archived: "st_archived",
};

// ---- Stock status (matches the products page badge language) ----------------
export type StockStatus = "in_stock" | "low_stock" | "out_stock";

export const LOW_STOCK_THRESHOLD = 10;

export function stockStatus(available: number): StockStatus {
  if (available <= 0) return "out_stock";
  if (available <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export const stockStatusKey: Record<StockStatus, DictKey> = {
  in_stock: "in_stock",
  low_stock: "low_stock",
  out_stock: "out_stock",
};

export const stockStatusTone: Record<StockStatus, string> = {
  in_stock: tone.green,
  low_stock: tone.amber,
  out_stock: tone.rose,
};

// ---- Aggregates across locations --------------------------------------------
export function totalAvailable(item: InventoryItem): number {
  return item.levels.reduce((s, l) => s + l.available, 0);
}
export function totalOnHand(item: InventoryItem): number {
  return item.levels.reduce((s, l) => s + l.onHand, 0);
}
export function totalCommitted(item: InventoryItem): number {
  return item.levels.reduce((s, l) => s + l.committed, 0);
}

/** The level for a given location, or a zeroed placeholder. */
export function levelAt(item: InventoryItem, locationId: string): Level {
  return (
    item.levels.find((l) => l.locationId === locationId) ?? {
      locationId,
      onHand: 0,
      committed: 0,
      incoming: 0,
      available: 0,
    }
  );
}

// ---- Empty drafts used by the create forms ----------------------------------
export function emptyLocation(): Location {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    code: "",
    address: "",
    city: "",
    governorate: "",
    country: "EG",
    phone: "",
    isActive: true,
    isDefault: false,
    fulfillsOnlineOrders: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyItem(): InventoryItem {
  const now = new Date().toISOString();
  return {
    id: "",
    productName: "",
    description: "",
    imageUrl: "",
    images: [],
    status: "active",
    vendor: "",
    productType: "",
    tags: [],
    variantTitle: "",
    sku: "",
    barcode: "",
    category: "",
    price: null,
    compareAtPrice: null,
    cost: null,
    tracked: true,
    levels: [],
    createdAt: now,
    updatedAt: now,
  };
}
