/**
 * Paymob online card payments — shared shapes and URLs (no secrets, no node
 * APIs), imported by both the settings form and the server module.
 *
 * We use Paymob's current Unified Intention API: one server call with the
 * account's Secret Key creates an "intention" and returns a client secret; the
 * shopper is sent to the Unified Checkout URL built from the Public Key + that
 * client secret; a webhook later confirms the transaction.
 */

export type PaymobConfig = {
  enabled: boolean;
  /** Secret Key, egy_sk_… — server only, authorises intention creation. */
  secretKey: string;
  /** Public Key, egy_pk_… — safe in the checkout URL. */
  publicKey: string;
  /** Online-card integration id (a number, from the Paymob dashboard). */
  integrationId: string;
  /** HMAC secret, used to verify the webhook is really from Paymob. */
  hmacSecret: string;
};

export const EMPTY_PAYMOB: PaymobConfig = {
  enabled: false,
  secretKey: "",
  publicKey: "",
  integrationId: "",
  hmacSecret: "",
};

const s = (v: unknown): string => (v == null ? "" : String(v));

export function paymobFrom(raw: unknown): PaymobConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    secretKey: s(r.secretKey),
    publicKey: s(r.publicKey),
    integrationId: s(r.integrationId),
    hmacSecret: s(r.hmacSecret),
  };
}

/** Enough set to actually take a card payment. */
export function paymobReady(c: PaymobConfig): boolean {
  return !!(c.enabled && c.secretKey && c.publicKey && c.integrationId);
}

export const PAYMOB_INTENTION_URL = "https://accept.paymob.com/v1/intention/";

export function paymobCheckoutUrl(publicKey: string, clientSecret: string): string {
  return `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}
