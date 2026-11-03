import "server-only";
import { AwsClient } from "aws4fetch";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * File storage, behind one small API so the store can move from Supabase Storage to Cloudflare R2
 * by changing one setting.
 *
 *   STORAGE_DRIVER=supabase   (default) Supabase Storage, exactly as before.
 *     STORAGE_SUPABASE_URL / STORAGE_SUPABASE_SERVICE_ROLE_KEY (optional): the Supabase project that
 *     holds the files. Default: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which stay on
 *     Supabase even when the database moves (that uses DATABASE_API_URL, see supabase/server.ts).
 *   STORAGE_DRIVER=r2         Cloudflare R2. Needs:
 *     R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *     R2_BUCKET        the one R2 bucket (default "store-media")
 *     R2_PUBLIC_URL    its public address, e.g. https://media.example.com
 *
 * On R2 every Supabase bucket becomes a folder in the one R2 bucket: Supabase "themes/abc/x.css"
 * is R2 "store-media/themes/abc/x.css", served at <R2_PUBLIC_URL>/themes/abc/x.css. The bucket
 * names in the code ("themes", "files", "entity-images", "courier-proofs", "live-recordings")
 * stay the same.
 *
 * All functions take paths relative to the bucket, exactly like supabase.storage.from(bucket).
 */

export type UploadBody = Uint8Array | ArrayBuffer | Blob;
export type UploadOptions = {
  contentType?: string;
  /** Overwrite an existing file. On R2 writes always overwrite; paths here are unique anyway. */
  upsert?: boolean;
  /** Browser/CDN cache lifetime in seconds (Supabase's "cacheControl"). */
  cacheControl?: string | number;
};
export type StoredObject = { path: string; size: number; updatedAt?: string };
export type SignedUpload = { url: string; headers: Record<string, string> };

export function storageDriver(): "supabase" | "r2" {
  return process.env.STORAGE_DRIVER === "r2" ? "r2" : "supabase";
}

let storageClient: SupabaseClient | null = null;
/** Supabase client used ONLY for files. Separate from the database client on purpose. */
function filesSupabase(): SupabaseClient {
  if (storageClient) return storageClient;
  const url = process.env.STORAGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Storage not configured: set STORAGE_SUPABASE_URL / STORAGE_SUPABASE_SERVICE_ROLE_KEY");
  storageClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return storageClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function upload(
  bucket: string,
  path: string,
  body: UploadBody,
  opts: UploadOptions = {},
): Promise<{ error: string | null }> {
  if (storageDriver() === "r2") return r2Upload(bucket, path, body, opts);
  const { error } = await filesSupabase()
    .storage.from(bucket)
    .upload(path, body, {
      contentType: opts.contentType,
      upsert: opts.upsert ?? false,
      ...(opts.cacheControl !== undefined ? { cacheControl: String(opts.cacheControl) } : {}),
    });
  return { error: error?.message ?? null };
}

/** The public address of a file. A path ending in "/" gives a folder address (for asset bases). */
export function publicUrl(bucket: string, path: string): string {
  if (storageDriver() === "r2") return `${r2Config().publicUrl}/${encodePath(`${bucket}/${path}`)}`;
  return filesSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function download(
  bucket: string,
  path: string,
): Promise<{ data: Blob | null; error: string | null }> {
  if (storageDriver() === "r2") {
    const res = await r2Fetch(objectUrl(bucket, path), { method: "GET" });
    if (!res.ok) return { data: null, error: res.status === 404 ? "not_found" : `r2_${res.status}` };
    return { data: await res.blob(), error: null };
  }
  const { data, error } = await filesSupabase().storage.from(bucket).download(path);
  return { data: data ?? null, error: error?.message ?? null };
}

export async function remove(bucket: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (storageDriver() === "r2") {
    // One delete per file, 20 at a time. Missing files are fine.
    for (let i = 0; i < paths.length; i += 20) {
      await Promise.all(
        paths.slice(i, i + 20).map((p) => r2Fetch(objectUrl(bucket, p), { method: "DELETE" })),
      );
    }
    return;
  }
  // Supabase accepts up to 1000 paths per call.
  for (let i = 0; i < paths.length; i += 1000) {
    await filesSupabase().storage.from(bucket).remove(paths.slice(i, i + 1000));
  }
}

/** Every file under `prefix` (all sub-folders included), sorted by path. Paths are bucket-relative. */
export async function listAll(bucket: string, prefix: string): Promise<StoredObject[]> {
  const clean = prefix.replace(/\/+$/, "");
  const out = storageDriver() === "r2" ? await r2List(bucket, clean) : await supabaseList(bucket, clean);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * A one-time address the BROWSER can upload one file to directly (for files too big to pass
 * through a server function). The browser sends:  fetch(url, { method: "PUT", headers, body }).
 */
export async function createSignedUpload(
  bucket: string,
  path: string,
  opts: { contentType?: string; cacheControl?: string | number; expiresInSeconds?: number } = {},
): Promise<{ data: SignedUpload | null; error: string | null }> {
  const headers: Record<string, string> = {};
  if (opts.contentType) headers["content-type"] = opts.contentType;
  if (opts.cacheControl !== undefined) headers["cache-control"] = `max-age=${opts.cacheControl}`;

  if (storageDriver() === "r2") {
    const url = new URL(objectUrl(bucket, path));
    url.searchParams.set("X-Amz-Expires", String(opts.expiresInSeconds ?? 3600));
    // Only cache-control is signed (content-type never is), so the browser must send it unchanged.
    const signed = await r2Client().sign(url.toString(), {
      method: "PUT",
      headers: headers["cache-control"] ? { "cache-control": headers["cache-control"] } : {},
      aws: { signQuery: true },
    });
    return { data: { url: signed.url, headers }, error: null };
  }

  const { data, error } = await filesSupabase().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { data: null, error: error?.message ?? "no_signed_url" };
  return { data: { url: data.signedUrl, headers }, error: null };
}

/**
 * Which bucket and path a saved public address points at, for both Supabase addresses
 * (…/storage/v1/object/public/<bucket>/<path>) and R2 addresses (<R2_PUBLIC_URL>/<bucket>/<path>).
 * Null when it's not one of ours.
 */
export function locateUrl(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  const supa = url.match(/\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/);
  if (supa) return { bucket: supa[1], path: decodeURIComponent(supa[2]) };
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  if (base && url.startsWith(`${base}/`)) {
    const rest = url.slice(base.length + 1).split(/[?#]/)[0];
    const slash = rest.indexOf("/");
    if (slash > 0) return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase driver details
// ---------------------------------------------------------------------------

async function supabaseList(bucket: string, prefix: string): Promise<StoredObject[]> {
  const store = filesSupabase().storage.from(bucket);
  type Item = {
    name: string;
    id: string | null;
    updated_at?: string;
    metadata?: { size?: number; lastModified?: string } | null;
  };
  async function walk(dir: string): Promise<StoredObject[]> {
    const out: StoredObject[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data } = await store.list(dir, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (!data?.length) break;
      for (const item of data as Item[]) {
        const full = dir ? `${dir}/${item.name}` : item.name;
        // Folders have a null id in Supabase listings.
        if (item.id === null) out.push(...(await walk(full)));
        else
          out.push({
            path: full,
            size: item.metadata?.size ?? 0,
            updatedAt: item.updated_at ?? item.metadata?.lastModified ?? undefined,
          });
      }
      if (data.length < 1000) break;
    }
    return out;
  }
  return walk(prefix);
}

// ---------------------------------------------------------------------------
// R2 driver details
// ---------------------------------------------------------------------------

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  const bucket = process.env.R2_BUCKET || "store-media";
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error(
      "STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL",
    );
  }
  return { accountId, accessKeyId, secretAccessKey, publicUrl, bucket };
}

let client: AwsClient | null = null;
function r2Client(): AwsClient {
  if (client) return client;
  const c = r2Config();
  client = new AwsClient({
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return client;
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function endpoint(): string {
  const c = r2Config();
  return `https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}`;
}

function objectUrl(bucket: string, path: string): string {
  return `${endpoint()}/${encodePath(`${bucket}/${path}`)}`;
}

function r2Fetch(url: string, init: RequestInit): Promise<Response> {
  return r2Client().fetch(url, init);
}

async function r2Upload(
  bucket: string,
  path: string,
  body: UploadBody,
  opts: UploadOptions,
): Promise<{ error: string | null }> {
  const headers: Record<string, string> = {
    "content-type": opts.contentType || "application/octet-stream",
  };
  if (opts.cacheControl !== undefined) headers["cache-control"] = `max-age=${opts.cacheControl}`;
  const data = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body;
  const res = await r2Fetch(objectUrl(bucket, path), { method: "PUT", headers, body: data as BodyInit });
  return { error: res.ok ? null : `r2_upload_${res.status}: ${(await res.text()).slice(0, 200)}` };
}

function xmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** S3 ListObjectsV2, following pages until done. */
async function r2List(bucket: string, prefix: string): Promise<StoredObject[]> {
  const keyPrefix = prefix ? `${bucket}/${prefix}/` : `${bucket}/`;
  const strip = bucket.length + 1;
  const out: StoredObject[] = [];
  let token: string | null = null;
  do {
    const url = new URL(endpoint());
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", keyPrefix);
    url.searchParams.set("max-keys", "1000");
    if (token) url.searchParams.set("continuation-token", token);
    const res = await r2Fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error(`r2_list_${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1];
      const key = xmlText(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "");
      if (!key || key.endsWith("/")) continue;
      out.push({
        path: key.slice(strip),
        size: Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0),
        updatedAt: block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1],
      });
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    token = truncated ? xmlText(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "") || null : null;
  } while (token);
  return out;
}
