"use server";

import { revalidatePath } from "next/cache";
import {
  audienceSize,
  deleteNotification,
  listNotifications,
  sendNotification,
  type AppNotification,
  type Audience,
  type NotificationLink,
  type Result,
} from "@/lib/app-notifications";
import { getCatalog } from "@/lib/storefront-data";

/** Notifications as the dashboard writes and follows them. */

/** The shop's collections, as the link picker lists them (it finds products itself). */
export type CollectionOption = { handle: string; title: string; count: number; image: string | null };

const AUDIENCES: Audience[] = ["all", "signed_in", "buyers", "cart", "phones"];
const audienceOf = (a: string): Audience => (AUDIENCES.includes(a as Audience) ? (a as Audience) : "all");

/** Pasted phone numbers: one per line, or separated by commas — a number may have spaces inside it. */
const phonesOf = (text: string) => text.split(/[\n\r,;]+/).map((s) => s.trim()).filter(Boolean);

export async function listNotificationsAction(): Promise<Result<AppNotification[]>> {
  return listNotifications();
}

export async function audienceSizeAction(audience: string, phones: string): Promise<Result<{ installs: number; popups: number }>> {
  return audienceSize(audienceOf(audience), phonesOf(phones));
}

export async function collectionsAction(): Promise<CollectionOption[]> {
  try {
    const catalog = await getCatalog();
    return catalog.collections.map((c) => ({ handle: c.handle, title: c.title, count: c.products_count ?? 0, image: null }));
  } catch {
    return [];
  }
}

export async function sendNotificationAction(input: {
  title: string;
  body: string;
  imageUrl: string;
  link: NotificationLink;
  audience: string;
  phones: string;
}): Promise<Result<AppNotification>> {
  const res = await sendNotification({
    title: input.title,
    body: input.body,
    imageUrl: input.imageUrl || null,
    link: input.link,
    audience: audienceOf(input.audience),
    audiencePhones: phonesOf(input.phones),
  });
  revalidatePath("/app/notifications");
  return res;
}

export async function deleteNotificationAction(id: string): Promise<Result<{ deleted: true }>> {
  const res = await deleteNotification(id);
  revalidatePath("/app/notifications");
  return res;
}
