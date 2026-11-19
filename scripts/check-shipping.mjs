// Check the shipping zone matching without a database.
//
// `src/lib/shipping.ts` is kept pure so the rules can be exercised here:
// Arabic spelling variants fold together, a threshold waives the fee, and —
// the case that matters most — a store that has configured nothing still
// charges nothing, exactly as it did before shipping was wired up.
//
//   npm run check:shipping

import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const req = createRequire(path.join(repo, "package.json"));

// The repo's own TypeScript, so this needs no test framework and no build.
const ts = req("typescript");
const src = fs.readFileSync(path.join(repo, "src/lib/shipping.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const out = path.join(os.tmpdir(), "bb-shipping-check.cjs");
fs.writeFileSync(out, js);
const { shippingFrom, quoteShipping, foldPlace } = req(out);

let pass = 0;
let fail = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(
    (ok ? "  ok   " : "  FAIL ") +
      name +
      (ok ? "" : "\n         got " + JSON.stringify(got) + "\n        want " + JSON.stringify(want)),
  );
};

console.log("folding:");
is("محافظة الجيزة == الجيزة", foldPlace("محافظة الجيزة"), foldPlace("الجيزة"));
is("الجيزة == جيزة", foldPlace("الجيزة"), foldPlace("جيزة"));
is("القاهره == القاهرة", foldPlace("القاهره"), foldPlace("القاهرة"));
is("Cairo == cairo", foldPlace("Cairo"), foldPlace("  CAIRO "));

const cfg = shippingFrom({
  free_shipping_enabled: true,
  free_shipping_threshold: 1000,
  zones: [
    { name: "Cairo & Giza", areas: "القاهرة، الجيزة, Cairo", rate_name: "Standard", rate_price: 50 },
    { name: "Delta", areas: "الدقهلية/الغربية", rate_name: "Standard", rate_price: 75 },
    { name: "Rest of Egypt", areas: "*", rate_name: "Standard", rate_price: 110 },
  ],
});

console.log("\nquotes:");
const q = (gov, goods) => quoteShipping(cfg, { goods, governorate: gov });
is("Giza, 500 -> 50", q("محافظة الجيزة", 500).cost, 50);
is("Cairo (en), 500 -> 50", q("Cairo", 500).cost, 50);
is("Dakahlia, 500 -> 75", q("الدقهلية", 500).cost, 75);
is("Aswan falls to catch-all", q("أسوان", 500).cost, 110);
is("Giza, 1000 -> free", q("الجيزة", 1000).cost, 0);
is("Giza at 1000 is waived", q("الجيزة", 1000).waived, true);
is("Giza, 999 still charged", q("الجيزة", 999).cost, 50);

console.log("\nunset / guard cases:");
const none = shippingFrom({});
is("no settings at all -> 0", quoteShipping(none, { goods: 5000, governorate: "الجيزة" }).cost, 0);
is("no settings -> not configured", quoteShipping(none, { goods: 10, governorate: "x" }).configured, false);
const blankRow = shippingFrom({ zones: [{ name: "", areas: "", rate_name: "", rate_price: "" }] });
is("empty zone row ignored", blankRow.zones.length, 0);
is("empty zone row charges 0", quoteShipping(blankRow, { goods: 500, governorate: "الجيزة" }).cost, 0);
const noCatch = shippingFrom({ zones: [{ name: "Cairo", areas: "القاهرة", rate_name: "S", rate_price: 50 }] });
is("unmatched, no catch-all -> 0", quoteShipping(noCatch, { goods: 500, governorate: "أسوان" }).cost, 0);
is("unmatched is flagged", quoteShipping(noCatch, { goods: 500, governorate: "أسوان" }).unmatched, true);
is(
  "threshold off -> never free",
  quoteShipping(
    shippingFrom({
      free_shipping_enabled: false,
      free_shipping_threshold: 100,
      zones: [{ name: "C", areas: "*", rate_name: "S", rate_price: 50 }],
    }),
    { goods: 99999 },
  ).cost,
  50,
);
is(
  "garbage price -> 0 not NaN",
  quoteShipping(shippingFrom({ zones: [{ name: "C", areas: "*", rate_price: "abc" }] }), { goods: 10 }).cost,
  0,
);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
