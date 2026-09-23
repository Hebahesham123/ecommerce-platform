import { readThemeCartItems } from "@/lib/checkout-handoff";
import { getPageCopy } from "@/lib/page-copy-server";
import { getPaymentMethods } from "@/lib/payments-server";
import { PAGE_COPY } from "@/lib/page-copy";
import { getCheckoutIdentity } from "../actions";
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
 *
 * The session cookie is read here too: a signed-in shopper should meet a
 * checkout that already knows them, not a blank form that asks them to prove
 * who they are again.
 */
export default async function CheckoutPage() {
  const [initialItems, identity, copy, methods] = await Promise.all([
    readThemeCartItems(),
    getCheckoutIdentity(),
    getPageCopy(PAGE_COPY["web-checkout"].section),
    getPaymentMethods(),
  ]);
  return (
    <CheckoutClient
      initialItems={initialItems}
      identity={identity}
      copy={copy}
      methods={methods}
    />
  );
}
