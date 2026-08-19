/**
 * Spreadsheet → inventory import.
 *
 * Pure helpers shared by the import UI and the server action: which columns a
 * sheet can supply, how to guess the mapping from its header row, and how to
 * turn a raw row into something safe to write.
 *
 * No assumption is made about column names — the guess is only a starting
 * point that the merchant can override.
 */

export type ImportField =
  | "productName"
  | "variantTitle"
  | "sku"
  | "barcode"
  | "category"
  | "vendor"
  | "productType"
  | "tags"
  | "price"
  | "compareAtPrice"
  | "cost"
  | "imageUrl"
  | "images"
  | "status"
  | "quantity";

export type FieldSpec = {
  field: ImportField;
  label: string;
  /** Lower-cased header names that map here automatically. */
  aliases: string[];
  required?: boolean;
  hint?: string;
};

export const IMPORT_FIELDS: FieldSpec[] = [
  {
    field: "productName",
    label: "Product name",
    required: true,
    aliases: ["product name", "product", "name", "title", "product title", "item", "item name", "اسم المنتج", "المنتج"],
    hint: "Rows sharing a name become one product with several variants.",
  },
  {
    field: "variantTitle",
    label: "Variant",
    aliases: ["variant", "variant title", "option", "option1 value", "option 1", "size", "color", "colour", "اللون", "المقاس"],
  },
  { field: "sku", label: "SKU", aliases: ["sku", "variant sku", "code", "item code", "barcode sku", "كود"] },
  { field: "barcode", label: "Barcode", aliases: ["barcode", "variant barcode", "ean", "upc", "gtin"] },
  {
    field: "category",
    label: "Category",
    aliases: ["category", "collection", "product category", "type", "group", "التصنيف", "الفئة"],
    hint: "Used to group products into collections.",
  },
  { field: "vendor", label: "Vendor", aliases: ["vendor", "brand", "supplier", "manufacturer", "الماركة", "المورد"] },
  { field: "productType", label: "Product type", aliases: ["product type", "producttype", "product_type"] },
  { field: "tags", label: "Tags", aliases: ["tags", "tag", "labels", "keywords", "وسوم"], hint: "Comma separated." },
  {
    field: "price",
    label: "Price",
    required: true,
    aliases: ["price", "variant price", "selling price", "sale price", "retail price", "amount", "السعر"],
    hint: "Products without a price stay hidden on the storefront.",
  },
  {
    field: "compareAtPrice",
    label: "Compare-at price",
    aliases: ["compare at price", "compare-at price", "compare_at_price", "original price", "was price", "rrp", "msrp", "السعر قبل الخصم"],
  },
  { field: "cost", label: "Cost", aliases: ["cost", "cost per item", "unit cost", "buy price", "التكلفة"] },
  { field: "imageUrl", label: "Main image URL", aliases: ["image", "image url", "image src", "main image", "photo", "picture", "صورة"] },
  {
    field: "images",
    label: "More image URLs",
    aliases: ["images", "gallery", "image urls", "additional images", "other images"],
    hint: "Comma or newline separated.",
  },
  { field: "status", label: "Status", aliases: ["status", "published", "active", "الحالة"], hint: "active, draft or archived." },
  {
    field: "quantity",
    label: "Quantity",
    aliases: ["quantity", "qty", "stock", "inventory", "on hand", "variant inventory qty", "available", "الكمية", "المخزون"],
  },
];

export const REQUIRED_FIELDS: ImportField[] = IMPORT_FIELDS.filter((f) => f.required).map(
  (f) => f.field,
);

/** field → column index in the sheet, or null when unmapped. */
export type Mapping = Partial<Record<ImportField, number | null>>;

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Best-effort match of sheet headers onto import fields. */
export function autoMap(headers: unknown[]): Mapping {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: Mapping = {};

  // Exact alias matches first, so "price" never loses to "compare at price".
  for (const spec of IMPORT_FIELDS) {
    const i = norm.findIndex((h, idx) => !used.has(idx) && h && spec.aliases.includes(h));
    if (i !== -1) {
      mapping[spec.field] = i;
      used.add(i);
    }
  }
  // Then loose contains-matching for anything still unmapped.
  for (const spec of IMPORT_FIELDS) {
    if (mapping[spec.field] != null) continue;
    const i = norm.findIndex(
      (h, idx) => !used.has(idx) && h && spec.aliases.some((a) => h.includes(a)),
    );
    if (i !== -1) {
      mapping[spec.field] = i;
      used.add(i);
    }
  }
  return mapping;
}

// ---- Row parsing ------------------------------------------------------------
export type ImportRow = {
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  price: number | null;
  compareAtPrice: number | null;
  cost: number | null;
  imageUrl: string | null;
  images: string[];
  status: "active" | "draft" | "archived";
  quantity: number;
};

const text = (v: unknown): string => (v == null ? "" : String(v)).trim();
const orNull = (v: unknown): string | null => text(v) || null;

/**
 * Parse a spreadsheet money cell. Copes with "1,200.50", "EGP 1200", "1.200,50"
 * and stray currency symbols, because sheets are rarely clean.
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = text(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal point.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // A lone comma is a decimal separator only when it isn't grouping digits.
    s = /,\d{3}(\D|$)/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseList(v: unknown): string[] {
  return text(v)
    .split(/[\n,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStatus(v: unknown): ImportRow["status"] {
  const s = text(v).toLowerCase();
  if (!s) return "active";
  if (["draft", "unpublished", "hidden", "false", "no", "0", "مسودة"].includes(s)) return "draft";
  if (["archived", "archive", "deleted"].includes(s)) return "archived";
  return "active";
}

/**
 * Fields that describe the PRODUCT rather than the variant.
 *
 * Exports from Shopify (and most catalogue tools) print these only on a
 * product's first row and leave them blank on its remaining variant rows, so
 * they are the ones safe to carry downwards. Variant-level cells — sku, price,
 * quantity, barcode, the variant name itself — are never inherited, or every
 * variant would end up a copy of the first.
 */
const PRODUCT_LEVEL_FIELDS: ImportField[] = [
  "productName",
  "category",
  "vendor",
  "productType",
  "tags",
  "status",
];

type Cells = Partial<Record<ImportField, unknown>>;

function readCells(row: unknown[], mapping: Mapping): Cells {
  const cells: Cells = {};
  for (const spec of IMPORT_FIELDS) {
    const i = mapping[spec.field];
    if (i != null) cells[spec.field] = row[i];
  }
  return cells;
}

function cellsToImport(cells: Cells): ImportRow {
  const at = (f: ImportField): unknown => cells[f];
  const primary = orNull(at("imageUrl"));
  const gallery = parseList(at("images"));
  return {
    productName: text(at("productName")),
    variantTitle: orNull(at("variantTitle")),
    sku: orNull(at("sku")),
    barcode: orNull(at("barcode")),
    category: orNull(at("category")),
    vendor: orNull(at("vendor")),
    productType: orNull(at("productType")),
    tags: parseList(at("tags")),
    price: parseNumber(at("price")),
    compareAtPrice: parseNumber(at("compareAtPrice")),
    cost: parseNumber(at("cost")),
    imageUrl: primary ?? gallery[0] ?? null,
    images: [...new Set([...(primary ? [primary] : []), ...gallery])],
    status: parseStatus(at("status")),
    quantity: Math.max(0, Math.round(parseNumber(at("quantity")) ?? 0)),
  };
}

export type RowIssue = { row: number; problem: string };

export type ParsedSheet = {
  rows: ImportRow[];
  /** Rows dropped because they can't produce a usable product. */
  skipped: RowIssue[];
  /** Rows imported but that will not show on the storefront. */
  warnings: RowIssue[];
  /** Rows rescued by inheriting product-level cells from the row above. */
  filledDown: number;
};

/** Single row conversion, kept for callers that don't need fill-down. */
export function rowToImport(row: unknown[], mapping: Mapping): ImportRow {
  return cellsToImport(readCells(row, mapping));
}

/**
 * Turn raw sheet rows into import rows, separating the unusable ones.
 *
 * With `fillDown` (the default), a row whose product-level cells are blank
 * continues the product above it — which is how multi-variant exports are
 * shaped. Without it those rows have no product name and are dropped.
 */
export function prepareRows(
  raw: unknown[][],
  mapping: Mapping,
  opts: { fillDown?: boolean } = {},
): ParsedSheet {
  const fillDown = opts.fillDown !== false;
  const rows: ImportRow[] = [];
  const skipped: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  let filledDown = 0;

  const carried: Cells = {};

  raw.forEach((r, i) => {
    // +2 = one for the header row, one for 1-based spreadsheet numbering.
    const line = i + 2;
    if (r.every((c) => text(c) === "")) return; // blank row

    const cells = readCells(r, mapping);

    if (fillDown) {
      const hadName = text(cells.productName) !== "";
      if (hadName) {
        // A named row starts a new product: it becomes the source to inherit
        // from, and stale values from the previous product are dropped.
        for (const f of PRODUCT_LEVEL_FIELDS) carried[f] = cells[f];
      } else {
        for (const f of PRODUCT_LEVEL_FIELDS)
          if (text(cells[f]) === "" && text(carried[f]) !== "") cells[f] = carried[f];
        if (text(cells.productName) !== "") filledDown++;
      }
    }

    const parsed = cellsToImport(cells);
    if (!parsed.productName) {
      skipped.push({ row: line, problem: "no product name" });
      return;
    }
    if (parsed.price == null || parsed.price <= 0)
      warnings.push({ row: line, problem: `"${parsed.productName}" has no price — it stays hidden` });
    rows.push(parsed);
  });

  return { rows, skipped, warnings, filledDown };
}

/** Products (grouped by name) and variants a prepared sheet would produce. */
export function importStats(rows: ImportRow[]): { products: number; variants: number; withImages: number } {
  const names = new Set(rows.map((r) => r.productName.trim().toLowerCase()));
  return {
    products: names.size,
    variants: rows.length,
    withImages: rows.filter((r) => r.images.length > 0).length,
  };
}
