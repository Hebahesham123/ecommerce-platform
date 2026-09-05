"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSessionPhone } from "@/lib/store-session";
import { normalizePhone } from "@/lib/phone";
import type { ActionResult } from "../actions";

/**
 * The "something else" branch of the Requests page.
 *
 * Returns and exchanges go through submitReturnRequest, which has stock and
 * money to protect. A general enquiry has neither, so it only needs to reach
 * the dashboard — which is exactly what the old static widget failed to do: it
 * carried another project's anon key in a public page and wrote there.
 *
 * Attachments go to the existing public `files` bucket under a `requests/`
 * prefix, deliberately WITHOUT a content_files row, so customer uploads never
 * show up in the merchant's own media library.
 */

const BUCKET = "files";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 4;

export type RequestAttachment = { url: string; kind: "image" | "video"; name: string };

function sanitize(name: string): string {
  const dot = name.lastIndexOf(".");
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "upload";
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.\w]/g, "") : "";
  return `${base.slice(0, 60)}${ext}`;
}

const text = (v: FormDataEntryValue | null, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function submitGeneralRequest(
  form: FormData,
  opts?: { viewerPhone?: string | null; channel?: string },
): Promise<ActionResult<{ reference: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };

  const name = text(form.get("name"), 120);
  const message = text(form.get("message"), 4000);
  if (!name) return { ok: false, error: "missing_name" };
  if (!message) return { ok: false, error: "missing_message" };

  const email = text(form.get("email"), 160);
  const typedPhone = text(form.get("phone"), 40);
  const subject = text(form.get("subject"), 120);
  const orderNumber = text(form.get("orderNumber"), 40);

  try {
    const supabase = getServerSupabase();
    // A signed-in shopper is recorded from their session, never from the page.
    const sessionPhone = opts?.viewerPhone ?? (await getSessionPhone());

    // ---- Attachments -------------------------------------------------------
    const attachments: RequestAttachment[] = [];
    const files = form
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_FILES);

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      // Anything that isn't obviously a photo or a clip is dropped rather than
      // stored — this bucket is public.
      if (!isImage && !isVideo) continue;
      if (file.size > MAX_FILE_BYTES) continue;

      const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Uint8Array(await file.arrayBuffer()), {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      // A failed upload must not lose the request itself — the words matter
      // more than the photo.
      if (upErr) continue;
      attachments.push({
        url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
        kind: isImage ? "image" : "video",
        name: file.name.slice(0, 120),
      });
    }

    const reference = `RQ${Date.now().toString().slice(-8)}`;
    const { error } = await supabase.from("store_requests").insert({
      reference,
      name,
      email: email || null,
      phone: typedPhone ? normalizePhone(typedPhone) : (sessionPhone ?? null),
      session_phone: sessionPhone,
      subject: subject || null,
      message,
      order_number: orderNumber || null,
      attachments,
      source: "storefront",
      channel: opts?.channel ?? "web",
    });

    if (error) {
      const missing = (error.message || "").includes("store_requests");
      return { ok: false, error: missing ? "migration_missing" : error.message };
    }
    return { ok: true, data: { reference } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
