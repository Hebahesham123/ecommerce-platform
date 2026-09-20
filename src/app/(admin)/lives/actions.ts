"use server";

import {
  deleteLive,
  getLive,
  hideMessage,
  listLives,
  listMessages,
  pinLiveProduct,
  prepareLive,
  providerConfigured,
  refreshRecording,
  saveLive,
  setLiveProducts,
  setLiveStatus,
  useTestStream,
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

export async function refreshRecordingAction(id: string): Promise<Result<string | null>> {
  return refreshRecording(id);
}

export async function deleteLiveAction(id: string): Promise<Result<void>> {
  return deleteLive(id);
}

export async function listLiveMessagesAction(liveId: string): Promise<Result<LiveMessage[]>> {
  return listMessages(liveId);
}

export async function hideLiveMessageAction(id: string, hidden: boolean): Promise<Result<void>> {
  return hideMessage(id, hidden);
}

/** Walk the whole flow on a sample video, while there is no account yet. */
export async function useTestStreamAction(id: string): Promise<Result<LiveStream>> {
  return useTestStream(id);
}

/** Whether the streaming account is wired up, so the page can say what to do. */
export async function providerStatusAction(): Promise<{ configured: boolean }> {
  return { configured: providerConfigured() };
}
