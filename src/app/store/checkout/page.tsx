import { readThemeCartItems } from "@/lib/checkout-handoff";
import CheckoutClient from "./checkout-client";

// The theme's cart lives in a cookie, so this page can never be static.
export const dynamic = "force-dynamic";

/**
 * Server shell for checkout.
 *
 * Shoppers arriving from the theme's "Buy it now" have their cart in the
 * `sf_cart` cookie, not in localStorage. Resolving it here means the very first
 * paint already shows the order summary — no interstitial handoff page, and no
 * "loading" state while the client reads storage back.
 */
export default async function CheckoutPage() {
  const initialItems = await readThemeCartItems();
  return <CheckoutClient initialItems={initialItems} />;
}
