"use server";

import { getSettingsSection } from "@/lib/settings-server";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

/**
 * The merchant's own "running low" line, from Settings → Notifications.
 *
 * Its own small action because the three screens that colour a stock badge —
 * Inventory, Products and the dashboard — are client components that each
 * load their rows a different way, and threading a number through all three
 * data paths would be a bigger change than the number is worth.
 *
 * Anything unset or nonsensical returns the shipped default, so a store that
 * has never opened the Notifications screen sees exactly what it saw before.
 */
export async function getLowStockThreshold(): Promise<number> {
  try {
    const s = await getSettingsSection("notifications");
    const n = Number(s.low_stock_threshold);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : LOW_STOCK_THRESHOLD;
  } catch {
    return LOW_STOCK_THRESHOLD;
  }
}
