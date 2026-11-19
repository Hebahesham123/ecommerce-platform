// Check the COD fee and tax arithmetic without a database.
//
// These two decide what a shopper is charged, so the cases that matter most
// are the ones where the merchant has configured nothing: an unset fee and an
// unset tax rate must both come out at zero, leaving the total exactly where
// it was before any of this was wired up.
//
//   npm run check:charges

import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const req = createRequire(path.join(repo, "package.json"));
const ts = req("typescript");

const tmp = path.join(os.tmpdir(), "bb-charges-check");
fs.mkdirSync(tmp, { recursive: true });

// Compile both files, rewriting the "@/lib/x" alias to a plain sibling
// require so this runs as ordinary CommonJS.
const build = (name) => {
  const src = fs.readFileSync(path.join(repo, "src/lib", name + ".ts"), "utf8");
  const js = ts
    .transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace(/require\("@\/lib\/([^"]+)"\)/g, 'require("./$1")');
  fs.writeFileSync(path.join(tmp, name + ".js"), js);
};
build("shipping");
build("order-charges");

const { codFeeFor, taxFrom, taxOn, rateFor } = req(path.join(tmp, "order-charges.js"));

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

console.log("cod fee:");
is("charged on a cod method", codFeeFor({ cod_fee: 20 }, "cod"), 20);
is("not charged on a card", codFeeFor({ cod_fee: 20 }, "wallet"), 0);
is("not charged with no method", codFeeFor({ cod_fee: 20 }, null), 0);
is("unset fee -> 0", codFeeFor({}, "cod"), 0);
is("garbage fee -> 0 not NaN", codFeeFor({ cod_fee: "abc" }, "cod"), 0);

console.log("\ntax, added on top (prices exclude tax):");
const add = taxFrom({ prices_include_tax: false, regions: [{ region: "*", rate: 14 }] });
is("14% of 1000 goods", taxOn(add, { goods: 1000, shipping: 0 }).amount, 140);
is("shipping excluded by default", taxOn(add, { goods: 1000, shipping: 100 }).amount, 140);
const addShip = taxFrom({ prices_include_tax: false, tax_on_shipping: true, regions: [{ region: "*", rate: 14 }] });
is("shipping included when asked", taxOn(addShip, { goods: 1000, shipping: 100 }).amount, 154);
is("not flagged as included", taxOn(add, { goods: 1000, shipping: 0 }).included, false);

console.log("\ntax, already inside the price:");
const inc = taxFrom({ prices_include_tax: true, regions: [{ region: "*", rate: 14 }] });
const incRes = taxOn(inc, { goods: 1140, shipping: 0 });
is("1140 gross holds 140 tax", incRes.amount, 140);
is("flagged as included", incRes.included, true);

console.log("\nregion matching:");
const byRegion = taxFrom({ regions: [{ region: "القاهرة", rate: 14 }, { region: "*", rate: 5 }] });
is("named region wins", rateFor(byRegion, "محافظة القاهرة"), 0.14);
is("elsewhere takes the catch-all", rateFor(byRegion, "أسوان"), 0.05);

console.log("\nunset / guard cases:");
const none = taxFrom({});
is("no tax settings -> 0", taxOn(none, { goods: 5000, shipping: 200 }).amount, 0);
is("no rate -> 0", taxOn(taxFrom({ regions: [] }), { goods: 5000, shipping: 0 }).amount, 0);
is("zero rate dropped", taxFrom({ regions: [{ region: "*", rate: 0 }] }).regions.length, 0);
is("garbage rate dropped", taxFrom({ regions: [{ region: "*", rate: "abc" }] }).regions.length, 0);
is("negative goods -> 0", taxOn(add, { goods: -50, shipping: 0 }).amount, 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
