"use server";

import {
  deleteLive,
  getLive,
  hideMessage,
  listLives,
  attachRecording,
  collectionProducts,
  createRecordingUpload,
  listLiveCollections,
  listMessages,
  postMessage,
  pinLiveProduct,
  prepareLive,
  providerConfigured,
  providerMissing,
  refreshRecording,
  saveLive,
  setLiveProducts,
  setLiveStatus,
  useTestStream,
  type LiveCollection,
  type ReplayState,
  type LiveProductInput,
  type Result,
} from "@/lib/live-service";
import type { LiveMessage, LiveStream } from "@/lib/live";

/**
 * The dashboard's door onto live shopping.
 *
 * Thin on purpose: every rule lives in live-service, which the app's API calls
 * too, so the two surfaces cannot drift on what "live" means.
 */

export async function listLivesAction(): Promise<Result<LiveStream[]>> {
  return listLives();
}

export async function getLiveAction(id: string): Promise<Result<LiveStream>> {
  return getLive(id);
}

export async function saveLiveAction(input: {
  id?: string;
  title: string;
  subtitle?: string | null;
  hostName?: string | null;
  coverUrl?: string | null;
  scheduledAt?: string | null;
  replayEnabled?: boolean;
  notes?: string | null;
}): Promise<Result<LiveStream>> {
  return saveLive(input);
}

/** Create the broadcast credentials. The only call that needs Cloudflare. */
export async function prepareLiveAction(id: string): Promise<Result<LiveStream>> {
  return prepareLive(id);
}

export async function setLiveStatusAction(
  id: string,
  status: "scheduled" | "live" | "ended" | "cancelled",
): Promise<Result<LiveStream>> {
  return setLiveStatus(id, status);
}

export async function setLiveProductsAction(
  liveId: string,
  products: LiveProductInput[],
): Promise<Result<LiveStream>> {
  return setLiveProducts(liveId, products);
}

export async function pinLiveProductAction(
  liveId: string,
  productId: string | null,
): Promise<Result<LiveStream>> {
  return pinLiveProduct(liveId, productId);
}

export async function refreshRecordingAction(id: string): Promise<Result<ReplayState>> {
  return refreshRecording(id);
}

export async function deleteLiveAction(id: string): Promise<Result<void>> {
  return deleteLive(id);
}

export async function listLiveMessagesAction(liveId: string): Promise<Result<LiveMessage[]>> {
  return listMessages(liveId);
}

/** The shop's collections, so a live can be stocked from one she curates. */
export async function listLiveCollectionsAction(): Promise<Result<LiveCollection[]>> {
  return listLiveCollections();
}

/** Everything in a collection, resolved to products for this live. */
export async function collectionProductsAction(
  collectionId: string,
): Promise<Result<LiveProductInput[]>> {
  return collectionProducts(collectionId);
}

/** Somewhere for the browser to upload the recording it made. */
export async function createRecordingUploadAction(
  liveId: string,
  extension: string,
) {
  return createRecordingUpload(liveId, extension);
}

/** Point the live at the recording once it is uploaded. */
export async function attachRecordingAction(liveId: string, url: string): Promise<Result<LiveStream>> {
  return attachRecording(liveId, url);
}

/** The host speaking in her own chat, marked as the host. */
export async function postHostMessageAction(
  liveId: string,
  authorName: string,
  body: string,
): Promise<Result<LiveMessage>> {
  return postMessage({ liveId, authorName, body, isHost: true });
}

export async function hideLiveMessageAction(id: string, hidden: boolean): Promise<Result<void>> {
  return hideMessage(id, hidden);
}

/** Walk the whole flow on a sample video, while there is no account yet. */
export async function useTestStreamAction(id: string): Promise<Result<LiveStream>> {
  return useTestStream(id);
}

/** Whether the streaming account is wired up, so the page can say what to do. */
export async function providerStatusAction(): Promise<{
  configured: boolean;
  missing: string[];
}> {
  return { configured: providerConfigured(), missing: providerMissing() };
}
