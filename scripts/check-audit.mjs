// The audit helper and its table have to agree.
//
// writeAudit is deliberately fail-open until AUDIT_ENFORCE is set, so a
// mismatched column name would not break anything visibly — refunds would
// keep working and the record would quietly be empty. That is the worst shape
// of bug for an audit log, so the agreement is checked here instead: every
// key the helper inserts must be a column the migration creates.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/0065_admin_audit.sql"), "utf8");
const ts = fs.readFileSync(path.join(ROOT, "src/lib/audit.ts"), "utf8");

// Comments explain the grants in prose, so checking the text as a whole finds
// the words "grant", "update" and "delete" in paragraphs about them. Strip the
// commentary and test the statements.
const code = sql.replace(/^\s*--.*$/gm, "");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

// ---- the table's columns ---------------------------------------------------
const body = sql.slice(
  sql.indexOf("create table if not exists public.admin_audit"),
  sql.indexOf("create index"),
);
const columns = [...body.matchAll(/^\s{2}([a-z_]+)\s+[a-z]/gm)].map((m) => m[1]);
ok("found the table's columns", columns.length >= 8, columns.join(","));

// ---- the keys the helper inserts -------------------------------------------
const insert = ts.slice(ts.indexOf('.from("admin_audit").insert({'), ts.indexOf("if (error) throw"));
// Both `key: value` and the shorthand `key,` — missing the shorthand is how a
// renamed column would slip past this very check.
const inserted = [...insert.matchAll(/^\s{6}([a-z_]+)\s*[:,]/gm)].map((m) => m[1]);
ok("found the inserted keys", inserted.length >= 7, inserted.join(","));
ok("the actor is among them", inserted.includes("actor"), inserted.join(","));

for (const k of inserted) {
  ok(`"${k}" is a real column`, columns.includes(k), "columns: " + columns.join(","));
}

// ---- the things that make it append-only must still be there ---------------
ok("update and delete are refused by a trigger", /before update or delete on public\.admin_audit/.test(code));
ok("truncate is refused too", /before truncate on public\.admin_audit/.test(code));
ok("the trigger function is not SECURITY DEFINER",
   !/function public\.admin_audit_append_only[\s\S]{0,200}security definer/.test(code));
ok("anon and authenticated are revoked", /revoke all on table public\.admin_audit from public, anon, authenticated/.test(code));
ok("service_role may insert and select, nothing more",
   /grant insert, select on table public\.admin_audit to service_role/.test(code)
   && !/grant all on table public\.admin_audit/.test(code));
ok("no update or delete is granted to anyone",
   !/grant[^;]*\b(update|delete)\b[^;]*admin_audit/i.test(code));
ok("row level security is on", /alter table public\.admin_audit enable row level security/.test(code));
ok("PostgREST is told to reload", /notify pgrst/.test(code));

// ---- the helper's own contract ---------------------------------------------
ok("it is server-only", /^import "server-only";/m.test(ts));
ok("a failed write is logged loudly", /console\.error\(\s*"\[audit\]/.test(ts));
ok("AUDIT_ENFORCE can make it fail closed", /AUDIT_ENFORCE/.test(ts));
ok("the actor comes from the header, not the caller", /x-admin-user/.test(ts));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
