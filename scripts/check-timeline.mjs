// Timeline entries: which ones may be edited or deleted.
//
// The interesting failure is not the regex itself, it is drift: getOrderTimeline
// invents ids for the entries it derives from the order, the payments and the
// fulfillments, and isEditableEntry has to reject every one of those prefixes.
// Rename `pay-` to `payment-` in one file and forget the other, and the screen
// starts offering a delete button that would throw at the database, or worse
// would match a real row. So the prefixes are read back out of the source and
// checked, rather than retyped here.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64"));
}

const { isEditableEntry } = await load("src/lib/order-timeline.ts");

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};

// A real order_events row is a uuid, and those are editable.
ok("uuid is editable", isEditableEntry("3f0b1a52-9c4e-4d1f-b2a7-6e5d4c3b2a19"));
ok("empty id is not editable", !isEditableEntry(""));

// Every id the timeline derives must be refused.
ok("placed- refused", !isEditableEntry("placed-3f0b1a52-9c4e-4d1f-b2a7-6e5d4c3b2a19"));
ok("pay- refused", !isEditableEntry("pay-3f0b1a52-9c4e-4d1f-b2a7-6e5d4c3b2a19"));
ok("ful- refused", !isEditableEntry("ful-3f0b1a52-9c4e-4d1f-b2a7-6e5d4c3b2a19"));

// A uuid that merely starts with those letters is still a row.
ok("payload-like uuid still editable", isEditableEntry("payc1a52-9c4e-4d1f-b2a7-6e5d4c3b2a19"));

// ---- the drift check -------------------------------------------------------
// Pull the literal prefixes out of getOrderTimeline: `id: \`placed-${...}\`` etc.
const actions = fs.readFileSync(path.join(ROOT, "src/app/(admin)/orders/actions.ts"), "utf8");
const timeline = actions.slice(
  actions.indexOf("export async function getOrderTimeline"),
  actions.indexOf("/** Post a staff comment onto the timeline. */"),
);
if (!timeline) throw new Error("could not find getOrderTimeline in actions.ts");

const prefixes = [...timeline.matchAll(/id: `([a-z]+)-\$\{/g)].map((m) => m[1]);
ok("found the derived id prefixes in getOrderTimeline", prefixes.length >= 3);
for (const p of new Set(prefixes)) {
  ok(`derived prefix "${p}-" is refused by isEditableEntry`, !isEditableEntry(`${p}-abc`));
}

// And the one entry built from a real row must stay editable: it is pushed
// with the row's own id, no prefix.
ok(
  "order_events rows are pushed with a bare id",
  /id: s\(e\.id\),/.test(timeline),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
