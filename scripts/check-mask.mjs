// Masking for the audit log.
//
// The failure that matters is a mask that does not mask: a phone that keeps
// enough digits to be the phone, an address stored in the clear because a
// field name was not in the table. admin_audit cannot be deleted from, so a
// leak here is permanent — which is why the default for an unknown field is
// to keep nothing, and why that is tested.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "src/lib/mask.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { maskPhone, maskEmail, maskText, maskedChange } =
  await import("data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64"));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

// ---- phones ----------------------------------------------------------------
const PHONE = "+201064114932";
ok("a phone keeps only its last three digits", maskPhone(PHONE) === "•••932", maskPhone(PHONE));
ok("the rest of the number is gone", !maskPhone(PHONE).includes("1064114"), maskPhone(PHONE));
ok("formatting does not leak digits", maskPhone("+20 106 411 4932") === "•••932", maskPhone("+20 106 411 4932"));
ok("a short number is hidden entirely", maskPhone("12") === "••", maskPhone("12"));
ok("no phone is empty, not a mask of nothing", maskPhone("") === "" && maskPhone(null) === "");

// ---- emails ----------------------------------------------------------------
ok("an email keeps one letter and the domain",
   maskEmail("heba.hassan@gmail.com") === "h•••@gmail.com", maskEmail("heba.hassan@gmail.com"));
ok("the local part is gone", !maskEmail("heba.hassan@gmail.com").includes("hassan"));
ok("a plus-address does not leak the tag",
   !maskEmail("heba+orders@gmail.com").includes("orders"), maskEmail("heba+orders@gmail.com"));
ok("something that is not an email is still masked",
   maskEmail("notanemail") === "•••il", maskEmail("notanemail"));
ok("no email is empty", maskEmail("") === "" && maskEmail(undefined) === "");

// ---- free text -------------------------------------------------------------
ok("an address keeps nothing but its length",
   maskText("12 شارع التحرير، الدقي") === "22 chars", maskText("12 شارع التحرير، الدقي"));
ok("no word of the address survives", !/شارع|التحرير/.test(maskText("12 شارع التحرير، الدقي")));
ok("cleared is distinguishable from filled", maskText("") === "" && maskText("x") === "1 chars");

// ---- maskedChange ----------------------------------------------------------
ok("no change returns null", maskedChange("phone", PHONE, PHONE) === null);
ok("whitespace is not a change", maskedChange("city", " Cairo ", "Cairo") === null);

const p = maskedChange("phone", "+201064114932", "+201092900337");
ok("a phone change is masked both sides", p.before === "•••932" && p.after === "•••337", JSON.stringify(p));
ok("the field name stays in the clear", p.field === "phone");

const a = maskedChange("address", "old street", "12 شارع التحرير");
ok("an address change keeps no text", a.before === "10 chars" && a.after === "15 chars", JSON.stringify(a));

// The important default: a field nobody added to the table must not fall
// through into the clear.
const unknown = maskedChange("national_id", "28001011234567", "29002022345678");
ok("an UNKNOWN field is masked, not passed through",
   !unknown.before.includes("2800") && !unknown.after.includes("2900"), JSON.stringify(unknown));
ok("the unknown field is treated as free text", unknown.before === "14 chars", JSON.stringify(unknown));

// ---- nothing recognisable survives a whole customer edit -------------------
{
  const fields = [
    maskedChange("name", "hams assem", "Heba Hassan"),
    maskedChange("phone", "+201064114932", "+201092900337"),
    maskedChange("email", "hmsasmahmd@gmail.com", "heba@beautybar.eg"),
    maskedChange("address", "A. hay gharb", "12 شارع التحرير"),
  ].filter(Boolean);
  const blob = JSON.stringify(fields);
  const secrets = ["hams", "assem", "Heba Hassan", "1064114", "1092900", "hmsasmahmd", "hay gharb", "التحرير"];
  const leaked = secrets.filter((s) => blob.includes(s));
  ok("a full customer edit leaks nothing recognisable", leaked.length === 0, "leaked: " + leaked.join(", "));
  ok("but it still says which fields moved",
     fields.map((f) => f.field).join(",") === "name,phone,email,address");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
