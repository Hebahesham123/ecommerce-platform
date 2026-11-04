// Copies every file from Supabase Storage into an S3 store (our MinIO), keeping folders, names,
// content types and cache headers. Files already copied (same size) are skipped, so it is safe to
// run again: the second run only copies what is new.
//
// Settings come on stdin as JSON, so no secret ever appears on the command line:
//   { supabaseUrl, supabaseKey, s3Endpoint, s3Bucket, accessKeyId, secretAccessKey, region }
// Run:  <json> | node --use-system-ca scripts/copy-storage-to-s3.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const cfg = JSON.parse(readFileSync(0, "utf8"));
const BUCKETS = ["themes", "entity-images", "files", "courier-proofs", "live-recordings"];
// Rebuilt automatically by the theme renderer; copying them would carry old Supabase addresses.
const SKIP = [/^themes\/_bundles\//];

const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false } });
const s3 = new AwsClient({
  accessKeyId: cfg.accessKeyId,
  secretAccessKey: cfg.secretAccessKey,
  service: "s3",
  region: cfg.region || "us-east-1",
});
const base = `${cfg.s3Endpoint.replace(/\/+$/, "")}/${cfg.s3Bucket}`;
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

async function listAll(bucket) {
  const store = sb.storage.from(bucket);
  const out = [];
  async function walk(dir) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await store.list(dir, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`${bucket}/${dir}: ${error.message}`);
      if (!data?.length) break;
      for (const it of data) {
        const full = dir ? `${dir}/${it.name}` : it.name;
        if (it.id === null) await walk(full);
        else out.push({ path: full, size: it.metadata?.size ?? 0, type: it.metadata?.mimetype, cache: it.metadata?.cacheControl });
      }
      if (data.length < 1000) break;
    }
  }
  await walk("");
  return out;
}

const CONCURRENCY = Number(process.env.COPY_CONCURRENCY) || 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Network hiccups (the server limits bursts of new connections): retry with growing pauses.
async function withRetry(fn) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt >= 6 || !/fetch failed|ECONNRESET|ETIMEDOUT|socket|network/i.test(String(e?.message || e) + String(e?.cause || ""))) throw e;
      await sleep(2000 * attempt * attempt);
    }
  }
}

const stats = { found: 0, copied: 0, skipped: 0, failed: 0, bytes: 0 };
const failures = [];

async function copyOne(bucket, f) {
  const key = `${bucket}/${f.path}`;
  if (SKIP.some((r) => r.test(key))) return;
  const url = `${base}/${enc(key)}`;
  const head = await s3.fetch(url, { method: "HEAD" });
  if (head.ok && Number(head.headers.get("content-length")) === f.size) { stats.skipped++; return; }
  const { data, error } = await sb.storage.from(bucket).download(f.path);
  if (error || !data) throw new Error(error?.message || "download failed");
  const body = new Uint8Array(await data.arrayBuffer());
  const headers = { "content-type": f.type || data.type || "application/octet-stream" };
  if (f.cache) headers["cache-control"] = String(f.cache).startsWith("max-age") ? f.cache : `max-age=${f.cache}`;
  const put = await s3.fetch(url, { method: "PUT", headers, body });
  if (!put.ok) throw new Error(`upload ${put.status}: ${(await put.text()).slice(0, 150)}`);
  stats.copied++;
  stats.bytes += body.byteLength;
}

for (const bucket of BUCKETS) {
  let files;
  try { files = await listAll(bucket); } catch (e) { console.log(`${bucket}: skipped (${e.message})`); continue; }
  console.log(`${bucket}: ${files.length} files`);
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map(async (f) => {
      if (!SKIP.some((r) => r.test(`${bucket}/${f.path}`))) stats.found++;
      try { await withRetry(() => copyOne(bucket, f)); } catch (e) { stats.failed++; failures.push(`${bucket}/${f.path}: ${e.message}`); }
    }));
    if ((i / CONCURRENCY) % 50 === 0) console.log(`  ${bucket}: ${Math.min(i + CONCURRENCY, files.length)}/${files.length}`);
  }
}
console.log(`\nfound ${stats.found}, copied ${stats.copied} (${(stats.bytes / 1048576).toFixed(1)} MB), already there ${stats.skipped}, failed ${stats.failed}`);
for (const f of failures.slice(0, 20)) console.log("  FAILED " + f);
process.exit(stats.failed ? 1 : 0);
