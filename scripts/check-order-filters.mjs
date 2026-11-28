// The orders list's date and discount filters.
//
// Date windows are where this kind of code goes wrong: "yesterday" quietly
// meaning "everything before today", "last 7 days" covering 8, "this month"
// meaning 30 days. Each boundary is pinned here against a fixed clock, so the
// tests mean the same thing in June as in December.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "src/lib/order-filters.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { inDateWindow, matchesDiscount, dateWindow } =
  await import("data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64"));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

// A fixed clock: Wednesday 26 November 2026, 14:30 local.
const NOW = new Date(2026, 10, 26, 14, 30, 0);
const at = (y, m, d, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

// ---- today -----------------------------------------------------------------
ok("this morning is today", inDateWindow(at(2026, 10, 26, 0, 1), "today", NOW));
ok("a minute ago is today", inDateWindow(at(2026, 10, 26, 14, 29), "today", NOW));
ok("last night is not today", !inDateWindow(at(2026, 10, 25, 23, 59), "today", NOW));
ok("exactly midnight is today", inDateWindow(new Date(2026, 10, 26, 0, 0).toISOString(), "today", NOW));

// ---- yesterday is a day, not "before today" --------------------------------
ok("yesterday afternoon counts", inDateWindow(at(2026, 10, 25), "yesterday", NOW));
ok("today does NOT count as yesterday", !inDateWindow(at(2026, 10, 26, 9), "yesterday", NOW));
ok("the day before yesterday does not either", !inDateWindow(at(2026, 10, 24), "yesterday", NOW));
ok("yesterday's first minute counts", inDateWindow(new Date(2026, 10, 25, 0, 0).toISOString(), "yesterday", NOW));
ok("midnight today is NOT yesterday", !inDateWindow(new Date(2026, 10, 26, 0, 0).toISOString(), "yesterday", NOW));

// ---- 7 days includes today, so it spans 7 days and not 8 -------------------
ok("today is inside last 7 days", inDateWindow(at(2026, 10, 26, 9), "7d", NOW));
ok("6 days back is inside", inDateWindow(at(2026, 10, 20, 9), "7d", NOW));
ok("7 days back is outside", !inDateWindow(at(2026, 10, 19, 23), "7d", NOW));

// ---- 30 days ---------------------------------------------------------------
ok("29 days back is inside last 30", inDateWindow(at(2026, 10, 28 - 30 + 1, 9), "30d", NOW));
ok("31 days back is outside", !inDateWindow(at(2026, 9, 25, 9), "30d", NOW));

// ---- this month means the 1st, not 30 days ---------------------------------
ok("the 1st of this month is in", inDateWindow(at(2026, 10, 1, 0, 30), "month", NOW));
ok("the last day of last month is out", !inDateWindow(at(2026, 9, 31, 23), "month", NOW));
ok("last 30 days reaches further back than this month on the 26th",
   dateWindow("30d", NOW).from < dateWindow("month", NOW).from);

// ---- "all" and rubbish input -----------------------------------------------
ok("all keeps everything", inDateWindow(at(2019, 0, 1), "all", NOW));
ok("all keeps even an unreadable date", inDateWindow("not a date", "all", NOW));
ok("a filtered view drops an unreadable date", !inDateWindow("not a date", "today", NOW));
ok("an empty date is dropped when filtering", !inDateWindow("", "7d", NOW));

// ---- discount --------------------------------------------------------------
const plain  = { discountAmount: 0, discountCode: null };
const manual = { discountAmount: 150, discountCode: null };   // typed in the order editor
const coded  = { discountAmount: 100, discountCode: "EID10" };
const zeroCode = { discountAmount: 0, discountCode: "FREESHIP" };

ok("all keeps a plain order", matchesDiscount("all", plain));
ok("any keeps a manual discount", matchesDiscount("any", manual));
ok("any keeps a coded discount", matchesDiscount("any", coded));
ok("any keeps a code that came to zero", matchesDiscount("any", zeroCode));
ok("any drops a plain order", !matchesDiscount("any", plain));
ok("none keeps only the plain order", matchesDiscount("none", plain) && !matchesDiscount("none", manual));
ok("a code matches itself", matchesDiscount("EID10", coded));
ok("a code does not match another", !matchesDiscount("EID10", zeroCode));
ok("a code does not match a manual discount", !matchesDiscount("EID10", manual));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
