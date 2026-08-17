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

// ---- Rule matching ----------------------------------------------------------
/**
 * The shape any product-ish record needs to be tested against a rule. Keeping
 * this minimal lets the admin picker, the collections list and the storefront
 * renderer share one matcher instead of three copies that can drift.
 */
export type MatchableProduct = {
  category: string | null;
  vendor: string | null;
  tags: string[];
};

/**
 * A rule can name several values ("sale, new-in") and matches a product that
 * has ANY of them. Stored comma-separated, so single-value rules saved before
 * this existed keep working untouched.
 */
export function parseRuleValues(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function serializeRuleValues(values: string[]): string {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].join(", ");
}

export function matchesRule(
  product: MatchableProduct,
  ruleType: CollectionRuleType,
  ruleValue: string | null | undefined,
): boolean {
  if (ruleType === "manual") return false;
  const wanted = parseRuleValues(ruleValue).map((v) => v.toLowerCase());
  if (!wanted.length) return false;
  if (ruleType === "category")
    return wanted.includes(String(product.category ?? "").toLowerCase());
  if (ruleType === "vendor")
    return wanted.includes(String(product.vendor ?? "").toLowerCase());
  return (product.tags ?? []).some((t) => wanted.includes(t.toLowerCase()));
}

/**
 * Every tag in the catalog with how many products carry it, busiest first.
 *
 * Grouped case-insensitively to match `matchesRule` — otherwise "Sale" and
 * "SALE" would show as two chips of one, while clicking either pulls in both
 * products. The first spelling seen becomes the label.
 */
export function tagCounts(products: MatchableProduct[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const p of products) {
    // A product carrying "Sale" and "SALE" still only counts once.
    const seen = new Set<string>();
    for (const raw of p.tags ?? []) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = counts.get(key);
      if (hit) hit.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
}

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
