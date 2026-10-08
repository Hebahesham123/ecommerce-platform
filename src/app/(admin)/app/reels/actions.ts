"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  attachRecording,
  createRecordingUpload,
  deleteLive,
  deleteRecording,
  listLives,
  saveLive,
  setLiveProducts,
  type Result,
} from "@/lib/live-service";
import { getCatalog } from "@/lib/storefront-data";
import type { LiveStream } from "@/lib/live";

/**
 * Reels as the dashboard manages them: every kept live and every uploaded
 * video, with how often each was watched and liked.
 *
 * An uploaded reel is stored exactly as a kept live is — a finished live with
 * a recording — so the app, the website, likes, products and the streaming
 * conversion all treat the two the same. Only `kind` tells them apart.
 */

export type ReelRow = {
  id: string;
  title: string;
  kind: "live" | "upload";
  thumb: string | null;
  /** Converted for fast streaming; until then the original file plays. */
  ready: boolean;
  hasVideo: boolean;
  visible: boolean;
  views: number;
  likes: number;
  products: { itemId: string | null; productName: string; imageUrl: string | null; price: number | null }[];
  createdAt: string;
};

export type ProductOption = { itemId: string; name: string; image: string | null; price: number };

function thumbOf(l: LiveStream): string | null {
  const u = l.streamUrl ?? "";
  const at = u.indexOf("/manifest/");
  if (u.includes("cloudflarestream.com") && at > 0) return u.slice(0, at) + "/thumbnails/thumbnail.jpg?time=2s&height=480";
  return l.coverUrl;
}

function imageOf(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  const src = (img as { src?: unknown }).src;
  return typeof src === "string" ? src : null;
}

export async function listReelsAction(): Promise<Result<ReelRow[]>> {
  const res = await listLives();
  if (!res.ok) return res;
  return {
    ok: true,
    data: res.data
      .filter((l) => l.kind === "upload" || (l.status === "ended" && Boolean(l.recordingUrl)))
      .sort((a, b) => String(b.endedAt ?? b.createdAt).localeCompare(String(a.endedAt ?? a.createdAt)))
      .map((l) => ({
        id: l.id,
        title: l.title,
        kind: l.kind,
        thumb: thumbOf(l),
        ready: Boolean(l.streamUrl),
        hasVideo: Boolean(l.recordingUrl),
        visible: l.replayEnabled,
        views: l.views,
        likes: l.likes,
        products: l.products.map((p) => ({ itemId: p.itemId, productName: p.productName, imageUrl: p.imageUrl, price: p.price })),
        createdAt: l.createdAt,
      })),
  };
}

/** Every product variant in the shop, to attach to a reel. */
export async function productOptionsAction(): Promise<ProductOption[]> {
  try {
    const catalog = await getCatalog();
    return catalog.products.flatMap((p) =>
      p.variants.map((v) => ({
        itemId: v.id,
        name: p.title + (v.title && v.title !== "Default Title" && v.title !== p.title ? " - " + v.title : ""),
        image: imageOf(v.featured_image) ?? imageOf(p.featured_image),
        price: v.price / 100,
      })),
    );
  } catch {
    return [];
  }
}

async function productsFor(itemIds: string[]) {
  const options = await productOptionsAction();
  const byId = new Map(options.map((o) => [o.itemId, o]));
  return itemIds
    .map((id) => byId.get(id))
    .filter((o): o is ProductOption => Boolean(o))
    .map((o) => ({ itemId: o.itemId, productName: o.name, imageUrl: o.image, price: o.price, discountCode: null }));
}

/** A new reel, ready for its video: a finished "live" that never went on air. */
export async function createReelAction(input: { title: string; itemIds: string[] }): Promise<Result<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const saved = await saveLive({ title: input.title, replayEnabled: true });
  if (!saved.ok) return saved;
  const id = saved.data.id;
  const now = new Date().toISOString();
  const { error } = await getServerSupabase()
    .from("live_streams")
    .update({ status: "ended", started_at: now, ended_at: now, kind: "upload" })
    .eq("id", id);
  if (error) {
    await deleteLive(id);
    return { ok: false, error: /kind/.test(error.message) ? "migration_missing" : error.message };
  }
  if (input.itemIds.length) {
    const products = await setLiveProducts(id, await productsFor(input.itemIds));
    if (!products.ok) return products;
  }
  return { ok: true, data: { id } };
}

/** Somewhere for the browser to upload the video straight to storage. */
export async function reelUploadAction(id: string, extension: string) {
  return createRecordingUpload(id, extension);
}

/** The video is uploaded: attach it, and start converting it for streaming. */
export async function attachReelVideoAction(id: string, url: string): Promise<Result<void>> {
  const res = await attachRecording(id, url);
  if (!res.ok) return res;
  revalidatePath("/app/reels");
  return { ok: true, data: undefined };
}

export async function setReelVisibleAction(id: string, visible: boolean): Promise<Result<void>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const { error } = await getServerSupabase().from("live_streams").update({ replay_enabled: visible }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function setReelProductsAction(id: string, itemIds: string[]): Promise<Result<void>> {
  const res = await setLiveProducts(id, await productsFor(itemIds));
  return res.ok ? { ok: true, data: undefined } : res;
}

export async function renameReelAction(id: string, title: string): Promise<Result<void>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  if (!title.trim()) return { ok: false, error: "missing_title" };
  const { error } = await getServerSupabase().from("live_streams").update({ title: title.trim() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

/** Delete the reel and its video, from storage and from the streaming service. */
export async function deleteReelAction(id: string): Promise<Result<void>> {
  await deleteRecording(id);
  return deleteLive(id);
}
