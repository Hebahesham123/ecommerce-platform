// =============================================================================
// Import a Shopify "products_export.csv" into Supabase inventory_items (+levels).
//
//   node scripts/import-products.mjs --dry     # parse + preview, write nothing
//   node scripts/import-products.mjs           # actually import
//
// Reads Supabase creds from .env.local (NEXT_PUBLIC_SUPABASE_URL + service key).
// Groups rows by Handle: product-level fields come from the first row, each
// variant row becomes one inventory_item, images are collected across rows, and
// Variant Inventory Qty is written as on_hand at the default location.
// =============================================================================

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const BACKFILL = process.argv.includes("--backfill");
const CSV_PATH = "products_export.csv";

// ---- tiny .env.local loader ----
function loadEnv() {
  let txt = "";
  try {
    txt = readFileSync(".env.local", "utf8");
  } catch {
    return {};
  }
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// ---- RFC-4180 CSV parser (handles quotes, escaped quotes, newlines in fields) ----
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      // consume \r\n as one
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const stripHtml = (s) =>
  (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const numOrNull = (v) => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function main() {
  const raw = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);

  const H = {
    handle: idx("Handle"),
    title: idx("Title"),
    body: idx("Body (HTML)"),
    vendor: idx("Vendor"),
    category: idx("Product Category"),
    type: idx("Type"),
    tags: idx("Tags"),
    opt1n: idx("Option1 Name"),
    opt1v: idx("Option1 Value"),
    opt2v: idx("Option2 Value"),
    opt3v: idx("Option3 Value"),
    sku: idx("Variant SKU"),
    invTracker: idx("Variant Inventory Tracker"),
    qty: idx("Variant Inventory Qty"),
    price: idx("Variant Price"),
    compareAt: idx("Variant Compare At Price"),
    barcode: idx("Variant Barcode"),
    image: idx("Image Src"),
    imagePos: idx("Image Position"),
    cost: idx("Cost per item"),
    priceEg: idx("Price / Egypt"),
    compareEg: idx("Compare At Price / Egypt"),
    status: idx("Status"),
  };

  // Group by handle, preserving order.
  const groups = new Map();
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.length < 2) continue;
    const handle = (cells[H.handle] || "").trim();
    if (!handle) continue;
    if (!groups.has(handle)) groups.set(handle, []);
    groups.get(handle).push(cells);
  }

  const items = [];
  for (const [handle, gRows] of groups) {
    const first = gRows[0];
    const title = (first[H.title] || "").trim() || handle;
    const description = stripHtml(first[H.body]);
    const vendor = (first[H.vendor] || "").trim() || null;
    const category = (first[H.category] || first[H.type] || "").trim() || null;
    const productType = (first[H.type] || "").trim() || null;
    const tags = (first[H.tags] || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const statusRaw = (first[H.status] || "active").trim().toLowerCase();
    const status = ["active", "draft", "archived"].includes(statusRaw) ? statusRaw : "active";
    const hasOptions = (first[H.opt1n] || "").trim() && (first[H.opt1n] || "").trim().toLowerCase() !== "title";

    // Collect images across all rows (ordered by Image Position).
    const imgs = [];
    for (const c of gRows) {
      const src = (c[H.image] || "").trim();
      if (src && !imgs.some((x) => x.src === src)) {
        imgs.push({ src, pos: numOrNull(c[H.imagePos]) ?? 999 });
      }
    }
    imgs.sort((a, b) => a.pos - b.pos);
    const images = imgs.map((x) => x.src);

    // Variant rows = rows that carry a SKU or a price (skip image-only rows).
    for (const c of gRows) {
      const sku = (c[H.sku] || "").trim();
      const price = numOrNull(c[H.price]) ?? numOrNull(c[H.priceEg]);
      const optionVals = [c[H.opt1v], c[H.opt2v], c[H.opt3v]].map((v) => (v || "").trim());
      const isVariant = sku !== "" || price != null || (hasOptions && optionVals[0] !== "");
      if (!isVariant) continue;

      const variantTitle = hasOptions
        ? optionVals.filter((v) => v && v.toLowerCase() !== "default title").join(" / ") || null
        : null;

      items.push({
        product_name: title,
        description: description || null,
        image_url: images[0] || null,
        images,
        status,
        vendor,
        product_type: productType,
        tags,
        variant_title: variantTitle,
        sku: sku || null,
        barcode: (c[H.barcode] || "").trim() || null,
        category,
        price,
        compare_at_price: numOrNull(c[H.compareAt]) ?? numOrNull(c[H.compareEg]),
        cost: numOrNull(c[H.cost]),
        tracked: (c[H.invTracker] || "").trim() !== "" || numOrNull(c[H.qty]) != null,
        _qty: Math.max(0, Math.round(numOrNull(c[H.qty]) ?? 0)),
      });
    }
  }

  console.log(`Parsed ${groups.size} products → ${items.length} variants (inventory items).`);
  console.log("Sample:");
  for (const it of items.slice(0, 4)) {
    console.log(
      `  • ${it.product_name}${it.variant_title ? " · " + it.variant_title : ""} | SKU ${it.sku ?? "—"} | ${it.price ?? "—"} EGP | qty ${it._qty} | ${it.status} | imgs ${it.images.length}`,
    );
  }

  if (DRY) {
    console.log("\n[dry run] Nothing written. Re-run without --dry to import.");
    return;
  }

  if (BACKFILL) return backfill(items);
  return importToSupabase(items);
}

async function importToSupabase(items) {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Detect which columns inventory_items actually has (migrations may lag).
  const { data: sample, error: sErr } = await supabase.from("inventory_items").select("*").limit(1);
  if (sErr) { console.error("Cannot read inventory_items:", sErr.message); process.exit(1); }
  const cols = new Set(sample && sample[0] ? Object.keys(sample[0]) : []);
  // If the table is empty we can't introspect from a row — fall back to base cols.
  if (cols.size === 0) {
    ["product_name","description","image_url","variant_title","sku","barcode","category","price","cost","tracked"].forEach((c) => cols.add(c));
  }
  const desired = ["compare_at_price","status","vendor","product_type","tags","images","description","image_url"];
  const missing = desired.filter((c) => !cols.has(c));
  if (missing.length) {
    console.log(`⚠ These columns are missing (apply migrations 0007/0008 for them): ${missing.join(", ")}`);
    console.log("  Importing the remaining fields now; you can backfill the rest after applying migrations.\n");
  }
  const filterRow = (row) => {
    const out = {};
    for (const k of Object.keys(row)) if (cols.has(k)) out[k] = row[k];
    return out;
  };

  // Resolve the default location (create one if none exist).
  let { data: locs } = await supabase.from("locations").select("id,is_default").order("is_default", { ascending: false });
  if (!locs || locs.length === 0) {
    const { data: created, error } = await supabase
      .from("locations")
      .insert({ name: "المخزن الرئيسي", code: "MAIN", is_default: true })
      .select("id")
      .single();
    if (error) { console.error("Could not create a location:", error.message); process.exit(1); }
    locs = [{ id: created.id, is_default: true }];
  }
  const defaultLoc = (locs.find((l) => l.is_default) ?? locs[0]).id;

  const BATCH = 100;
  let inserted = 0;
  let leveled = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const payload = slice.map(({ _qty, ...row }) => filterRow(row));
    const { data, error } = await supabase.from("inventory_items").insert(payload).select("id");
    if (error) {
      console.error(`Batch ${i / BATCH + 1} insert failed:`, error.message);
      process.exit(1);
    }
    inserted += data.length;

    // Set on_hand at the default location for this batch (trigger already seeded 0-rows).
    for (let j = 0; j < data.length; j++) {
      const qty = slice[j]._qty;
      if (qty > 0) {
        const { error: le } = await supabase
          .from("inventory_levels")
          .update({ on_hand: qty })
          .eq("item_id", data[j].id)
          .eq("location_id", defaultLoc);
        if (!le) leveled++;
      }
    }
    console.log(`  imported ${inserted}/${items.length}…`);
  }
  console.log(`\n✅ Done. Inserted ${inserted} items; set stock on ${leveled} of them.`);
}

// ---- Backfill rich fields (images, description, status, tags, …) by SKU ----
async function backfill(items) {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: sample, error } = await supabase.from("inventory_items").select("*").limit(1);
  if (error) { console.error(error.message); process.exit(1); }
  const cols = new Set(sample && sample[0] ? Object.keys(sample[0]) : []);
  const rich = ["description", "image_url", "images", "status", "vendor", "product_type", "tags", "compare_at_price"].filter((c) => cols.has(c));
  if (rich.length === 0) {
    console.log("No rich columns present yet — apply migrations 0007 and 0008 first.");
    process.exit(1);
  }
  console.log(`Backfilling columns: ${rich.join(", ")}`);

  let updated = 0, skipped = 0;
  for (const it of items) {
    if (!it.sku) { skipped++; continue; }
    const patch = {};
    for (const c of rich) patch[c] = it[c];
    const { error: ue, count } = await supabase
      .from("inventory_items")
      .update(patch, { count: "exact" })
      .eq("sku", it.sku);
    if (ue) { console.error(`  ${it.sku}: ${ue.message}`); continue; }
    if (count) updated += count; else skipped++;
  }
  console.log(`\n✅ Backfill done. Updated ${updated} rows (skipped ${skipped}).`);
}

main();
