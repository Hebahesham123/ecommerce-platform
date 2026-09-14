"use server";

import { revalidatePath } from "next/cache";
import {
  getLoyaltyTheme as read,
  saveLoyaltyTheme as write,
} from "@/lib/loyalty/theme-service";
import { normalizeLoyaltyTheme, type LoyaltyTheme } from "@/lib/loyalty/theme";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function loadLoyaltyTheme(): Promise<Result<LoyaltyTheme>> {
  return { ok: true, data: await read() };
}

export async function storeLoyaltyTheme(theme: LoyaltyTheme): Promise<Result> {
  // Normalised here as well as in the service: this is a server action, so the
  // shape that arrives is whatever the network sent, not whatever the editor
  // meant to send.
  const res = await write(normalizeLoyaltyTheme(theme));
  if (!res.ok) return { ok: false, error: res.error };

  // The customer pages are force-dynamic, but the account page that carries the
  // summary card is not, so it has to be told the colours moved.
  revalidatePath("/store/society");
  revalidatePath("/store/account");
  revalidatePath("/loyalty/theme");
  return { ok: true, data: undefined };
}
