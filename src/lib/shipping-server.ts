import "server-only";

import { getSettingsSection } from "@/lib/settings-server";
import { quoteShipping, shippingFrom, type ShippingQuote } from "@/lib/shipping";

/**
 * Price delivery for an address, from the merchant's Shipping settings.
 *
 * Server-side only, and called from the order builder rather than from a
 * checkout screen, for the same reason prices are: a cost the client works
 * out is a cost the client can set to zero.
 */
export async function quoteShippingFor(opts: {
  goods: number;
  governorate?: string;
  city?: string;
}): Promise<ShippingQuote> {
  const section = await getSettingsSection("shipping");
  return quoteShipping(shippingFrom(section), opts);
}
