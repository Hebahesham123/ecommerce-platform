// The packing slip travels with the parcel and tells a courier what to
// collect, so the things worth pinning down are: every product is on it, the
// line maths is right, the summary adds up to the stored total, and the
// collect box never asks for money on an order that is already paid.
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The slip imports "@/lib/order-edit"; resolve that one alias by hand rather
// than dragging the bundler in.
async function load(rel) {
  const src = fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/from\s+"@\/lib\/([a-z0-9-]+)"/g, (_m, name) => `from "./${name}.mjs"`);
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return js;
}

// Write both modules side by side in a temp dir so the relative import works.
const tmp = path.join(ROOT, "node_modules", ".cache", "slip-check");
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "order-edit.mjs"), await load("src/lib/order-edit.ts"));
fs.writeFileSync(path.join(tmp, "packing-slip.mjs"), await load("src/lib/packing-slip.ts"));
const { packingSlipHtml } = await import(pathToFileURL(path.join(tmp, "packing-slip.mjs")).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

const base = {
  orderNumber: "29",
  customerName: "dwdw ddewewe",
  phone: "+201064114932",
  address: "fserwtrggrqg t St4t",
  city: "4rttgtgth",
  governorate: "القاهرة",
  note: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  subtotal: 4999,
  shipping: 0,
  total: 4999,
  discountAmount: 0,
  discountCode: null,
  amountPaid: 0,
  balance: 4999,
  items: [
    {
      productName: "Nike Mind Lace-Up Fastening Sneakers | Black",
      variantTitle: "42",
      sku: "N-N-S-54233224675541-F10-42",
      price: 4999,
      quantity: 1,
    },
  ],
};

// ---- the unpaid COD case, which is the common one -------------------------
{
  const html = packingSlipHtml(base, false, { paymentLabel: "Cash on delivery" });
  ok("the product is on the slip", html.includes("Nike Mind Lace-Up Fastening Sneakers"));
  ok("so is its SKU", html.includes("N-N-S-54233224675541-F10-42"));
  ok("the variant shows", html.includes("42"));
  ok("the unit price shows", html.includes("LE 4,999.00"));
  ok("the payment method shows", html.includes("Cash on delivery"));
  ok("it asks the courier to collect", html.includes("Collect on delivery"));
  ok("it does not claim to be paid", !html.includes("Paid in full"));
  ok("free shipping is spelled out", html.includes("Free"));
}

// ---- paid online: the courier must not collect ----------------------------
{
  const html = packingSlipHtml({ ...base, amountPaid: 4999, balance: 0 }, false, { paymentLabel: "Card" });
  ok("a paid order says so", html.includes("Paid in full"));
  ok("and asks for nothing", html.includes("Collect nothing"));
  ok("it never says collect on delivery", !html.includes("Collect on delivery"));
  ok("what was paid is shown", html.includes("Paid"));
}

// ---- part paid: only the remainder is collected ---------------------------
{
  const html = packingSlipHtml({ ...base, amountPaid: 2000, balance: 2999 }, false, { paymentLabel: "Cash on delivery" });
  ok("part paid still collects", html.includes("Collect on delivery"));
  ok("it collects the balance, not the total", html.includes("LE 2,999.00"));
}

// ---- the full money picture, with a discount, shipping and a COD fee ------
{
  // 3 x 500 goods, 150 off, 100 shipping, 20 fee => 1470 stored total.
  const o = {
    ...base,
    subtotal: 1500,
    discountAmount: 150,
    discountCode: "EID10",
    shipping: 100,
    total: 1470,
    balance: 1470,
    items: [{ productName: "Serum", variantTitle: null, sku: "SRM-1", price: 500, quantity: 3 }],
  };
  const html = packingSlipHtml(o, false, { paymentLabel: "Cash on delivery" });
  ok("the line total is price x qty", html.includes("LE 1,500.00"));
  ok("the discount is shown", html.includes("−LE 150.00"));
  ok("the discount code is shown", html.includes("EID10"));
  ok("shipping is shown", html.includes("LE 100.00"));
  ok("the carried-over fee is shown", html.includes("LE 20.00"), "fee line missing");
  ok("the total matches what is stored", html.includes("LE 1,470.00"));
  ok("3 items are counted", html.includes("3 items in this order"));
}

// ---- the sheet must be safe and well formed -------------------------------
{
  const nasty = {
    ...base,
    customerName: 'Mr <script>alert("x")</script>',
    note: "leave it with the doorman & ring",
    items: [{ productName: "A & B <b>bold</b>", variantTitle: null, sku: null, price: 10, quantity: 1 }],
  };
  const html = packingSlipHtml(nasty, false, { paymentLabel: "Cash on delivery" });
  ok("a script tag cannot get in", !html.includes("<script>alert"));
  ok("ampersands are escaped", html.includes("A &amp; B"));
  ok("the customer note is printed", html.includes("leave it with the doorman &amp; ring"));
  ok("no SKU prints as a dash", html.includes("—"));

  const opens = (html.match(/<tr[ >]/g) || []).length;
  const closes = (html.match(/<\/tr>/g) || []).length;
  ok("every table row is closed", opens === closes, `${opens} open / ${closes} closed`);
  ok("the document is complete", html.startsWith("<!doctype html>") && html.trimEnd().endsWith("</html>"));
}

// ---- Arabic ----------------------------------------------------------------
{
  const html = packingSlipHtml(base, true, { paymentLabel: "الدفع عند الاستلام" });
  ok("Arabic sets the language", html.includes('lang="ar"'));
  ok("Arabic collect wording", html.includes("يُحصّل عند التسليم"));
  const paidHtml = packingSlipHtml({ ...base, amountPaid: 4999, balance: 0 }, true, { paymentLabel: "بطاقة" });
  ok("Arabic paid wording", paidHtml.includes("لا تُحصّل أي مبلغ"));
}

// Leave a copy to open in a browser when something looks off.
const out = path.join(tmp, "sample.html");
fs.writeFileSync(out, packingSlipHtml(base, false, { paymentLabel: "Cash on delivery" }));
console.log("\nsample slip: " + out);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
