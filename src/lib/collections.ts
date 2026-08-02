import type { DictKey } from "./i18n";
import { tone } from "./data";

/** How a collection decides which products belong to it. */
export type CollectionRuleType = "manual" | "category" | "vendor" | "tag";

/** One product inside a manual collection (see 0010_collections.sql). */
export type CollectionMember = {
  itemId: string | null; // representative inventory_items.id
  productName: string;
  position: number;
};

export type Collection = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  ruleType: CollectionRuleType;
  ruleValue: string | null;
  products: CollectionMember[];
  createdAt: string;
  updatedAt: string;
};

export const ruleTypeKey: Record<CollectionRuleType, DictKey> = {
  manual: "coll_rule_manual",
  category: "coll_rule_category",
  vendor: "coll_rule_vendor",
  tag: "coll_rule_tag",
};

export const publishedTone = {
  published: tone.green,
  hidden: tone.slate,
};

/** "all" is the built-in every-product collection the theme always gets. */
export const RESERVED_HANDLES = new Set(["all", "collections", "products", "cart", "search"]);

/**
 * URL handle for a collection. Latin and Arabic characters are kept; anything
 * else becomes a separator. Mirrors `handleize` in storefront-data.ts.
 */
export function collectionHandle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "") || "collection"
  );
}

export function emptyCollection(): Collection {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    handle: "",
    description: "",
    imageUrl: "",
    isPublished: true,
    sortOrder: 0,
    ruleType: "manual",
    ruleValue: null,
    products: [],
    createdAt: now,
    updatedAt: now,
  };
}
