// The money an edited order comes to.
//
// This is the arithmetic that decides what a customer is charged after a
// merchant adds a product, drops one, or applies a discount — and it is
// written twice, here in TypeScript for the preview and again in plpgsql in
// migration 0062 for the save. These cases pin down the behaviour the two
// have to share: the fee carry-over, the discount cap, and the rounding.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64"));
}

const { feesIn, editedTotals } = await load("src/lib/order-edit.ts");

let pass = 0, fail = 0;
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log(`  FAIL ${name}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

// ---- feesIn: what the stored total holds beyond its own lines --------------
ok("a plain order has no fees", feesIn({ total: 1100, subtotal: 1000, discount: 0, shipping: 100 }), 0);
ok("a COD fee is recovered", feesIn({ total: 1120, subtotal: 1000, discount: 0, shipping: 100 }), 20);
ok("fees are found behind a discount", feesIn({ total: 970, subtotal: 1000, discount: 150, shipping: 100 }), 20);
ok("free shipping, fee still found", feesIn({ total: 1020, subtotal: 1000, discount: 0, shipping: 0 }), 20);
ok("a total below its parts is not a negative fee", feesIn({ total: 900, subtotal: 1000, discount: 0, shipping: 100 }), 0);

// ---- editedTotals ----------------------------------------------------------
const lines = (...xs) => xs.map(([price, quantity]) => ({ price, quantity }));

ok(
  "one line, nothing else",
  editedTotals({ lines: lines([100, 2]), discount: 0, shipping: 50, fees: 0 }),
  { subtotal: 200, discount: 0, total: 250 },
);

ok(
  "a removed line simply is not in the list",
  editedTotals({ lines: lines([100, 2], [0, 0]), discount: 0, shipping: 50, fees: 0 }),
  { subtotal: 200, discount: 0, total: 250 },
);

ok(
  "the COD fee survives the edit",
  editedTotals({ lines: lines([100, 3]), discount: 0, shipping: 50, fees: 20 }),
  { subtotal: 300, discount: 0, total: 370 },
);

ok(
  "a discount comes off the goods, not the shipping",
  editedTotals({ lines: lines([100, 3]), discount: 50, shipping: 50, fees: 20 }),
  { subtotal: 300, discount: 50, total: 320 },
);

// A merchant typing a discount larger than the basket must not end up
// giving away the delivery fee as well.
ok(
  "a discount cannot exceed the goods",
  editedTotals({ lines: lines([100, 1]), discount: 999, shipping: 50, fees: 20 }),
  { subtotal: 100, discount: 100, total: 70 },
);

ok(
  "a discount is never negative",
  editedTotals({ lines: lines([100, 1]), discount: -40, shipping: 50, fees: 0 }),
  { subtotal: 100, discount: 0, total: 150 },
);

ok(
  "an empty order is zero, not NaN",
  editedTotals({ lines: [], discount: 0, shipping: 50, fees: 20 }),
  { subtotal: 0, discount: 0, total: 70 },
);

// Prices are numeric(12,2) in the database; the preview must land on the
// same grid or it will show a number the save does not produce.
ok(
  "thirds of a pound do not drift",
  editedTotals({ lines: lines([33.33, 3]), discount: 0, shipping: 0, fees: 0 }),
  { subtotal: 99.99, discount: 0, total: 99.99 },
);
ok(
  "classic float noise is rounded away",
  editedTotals({ lines: lines([0.1, 1], [0.2, 1]), discount: 0, shipping: 0, fees: 0 }),
  { subtotal: 0.3, discount: 0, total: 0.3 },
);

ok(
  "rubbish quantities count as none",
  editedTotals({ lines: lines([100, -2], [100, 1.7]), discount: 0, shipping: 0, fees: 0 }),
  { subtotal: 100, discount: 0, total: 100 },
);

ok(
  "a negative price is not a credit",
  editedTotals({ lines: lines([-100, 1], [50, 1]), discount: 0, shipping: 0, fees: 0 }),
  { subtotal: 50, discount: 0, total: 50 },
);

// ---- the round trip the feature actually performs --------------------------
// An order of 1000 + 100 shipping + 20 COD fee, discounted 150, then edited
// up to 1500 of goods: the fee and the shipping must both still be there.
{
  const before = { total: 970, subtotal: 1000, discount: 150, shipping: 100 };
  const fees = feesIn(before);
  const after = editedTotals({ lines: lines([500, 3]), discount: 150, shipping: before.shipping, fees });
  ok("edit keeps shipping and fee intact", after, { subtotal: 1500, discount: 150, total: 1470 });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
