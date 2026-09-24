import { readThemeCartItems } from "@/lib/checkout-handoff";
import { getPageCopy } from "@/lib/page-copy-server";
import { getPaymentMethods } from "@/lib/payments-server";
import { PAGE_COPY } from "@/lib/page-copy";
import { getCheckoutIdentity } from "../actions";
import { getMyLoyalty } from "../loyalty-actions";
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
 * who they are again - and with the session comes her Society standing, so a
 * gift she has earned is offered here rather than left behind on another page.
 */
export default async function CheckoutPage() {
  const [initialItems, identity, copy, methods, loyalty] = await Promise.all([
    readThemeCartItems(),
    getCheckoutIdentity(),
    getPageCopy(PAGE_COPY["web-checkout"].section),
    getPaymentMethods(),
    // Costs nothing for a guest: it returns before touching the database when
    // there is no session, and a shop without a loyalty programme fails soft.
    getMyLoyalty(),
  ]);
  return (
    <CheckoutClient
      initialItems={initialItems}
      identity={identity}
      copy={copy}
      methods={methods}
      loyalty={loyalty.ok ? loyalty.data : null}
    />
  );
}
