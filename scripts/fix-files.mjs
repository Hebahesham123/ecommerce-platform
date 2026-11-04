// Re-copies a list of files (one bucket/path per line, file given as argv[2]) from Supabase's public
// storage into our file store: deletes any half-saved entry first, uploads, then checks the public copy.
// The upload key comes on stdin as the server's s3-keys.txt. Slow on purpose: pauses + retries.
import { AwsClient } from "aws4fetch";
import fs from "node:fs";

const t = fs.readFileSync(0, "utf8");
const get = (k) => (t.match(new RegExp(`^${k}=(.+)$`, "m")) || [])[1]?.trim();
const s3 = new AwsClient({ accessKeyId: get("S3_ACCESS_KEY_ID"), secretAccessKey: get("S3_SECRET_ACCESS_KEY"), service: "s3", region: "us-east-1" });
const keys = fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(Boolean);
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 6) throw e; await sleep(3000 * i * i); }
  }
}

let ok = 0;
for (const key of keys) {
  try {
    const src = `https://jvjnpfaoqfeodzujsngf.supabase.co/storage/v1/object/public/${enc(key)}`;
    const url = `https://srv2120209.hstgr.cloud:9443/store-media/${enc(key)}`;
    const r = await retry(() => fetch(src));
    const body = new Uint8Array(await r.arrayBuffer());
    await retry(() => s3.fetch(url, { method: "DELETE" }));
    await sleep(500);
    const put = await retry(() => s3.fetch(url, {
      method: "PUT",
      headers: { "content-type": r.headers.get("content-type") || "application/octet-stream", "cache-control": r.headers.get("cache-control") || "max-age=31536000" },
      body,
    }));
    const putText = put.ok ? "" : (await put.text()).replace(/\s+/g, " ").slice(0, 120);
    await sleep(500);
    const chk = await retry(() => fetch(`https://srv2120209.hstgr.cloud/media/${enc(key)}`, { method: "HEAD" }));
    if (put.ok && chk.ok && Number(chk.headers.get("content-length")) === body.length) ok++;
    else console.log("FAILED", key, "put", put.status, putText, "check", chk.status);
  } catch (e) {
    console.log("FAILED", key, String(e?.cause?.code || e?.message || e));
  }
  await sleep(1500);
}
console.log(`fixed ${ok} of ${keys.length}`);
