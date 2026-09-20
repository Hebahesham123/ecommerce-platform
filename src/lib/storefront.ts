/**
 * Where "home" is for a shopper.
 *
 * The published theme at /shop is the shop — /store is the bare internal
 * product list this app renders for its own flows (checkout, account,
 * returns), and a customer should never be dropped there. Every "continue
 * shopping", logo and log-out lands here.
 *
 * One constant rather than one per file: each local copy has eventually been
 * the one that still said /store, and the shopper is the one who finds out.
 */
export const STOREFRONT_HOME = "/shop";
