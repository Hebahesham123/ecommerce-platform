import type { LoyaltySummary, RewardView, UserReward } from "./types";

/**
 * The rewards worth showing at checkout, and what tapping one does.
 *
 * A shopper who has earned something should not have to leave the checkout,
 * find the Society, redeem, copy a code and come back. Two kinds belong here:
 * the ones already redeemed and still unused, which only need applying, and
 * the ones she can afford right now, which are redeemed and applied in one
 * tap. Everything else - locked rewards, rewards she cannot afford, and the
 * ones the staff fulfil by hand - is noise in the middle of paying.
 */

export type CheckoutReward = {
  /** The user_reward id for one already redeemed, else the reward id. */
  id: string;
  title: string;
  /** Empty until it is redeemed. */
  code: string;
  /** What it does, in the shopper's words. */
  detail: string;
  /** Signatures it will cost. Zero for something already redeemed. */
  cost: number;
  /** True when it only needs applying, false when it has to be redeemed. */
  ready: boolean;
};

const money = (n: number) => `EGP ${Math.round(n).toLocaleString("en-US")}`;

/** A reward's promise, in one line. */
export function rewardDetail(
  kind: string | null,
  value: number | null,
  minOrder: number | null,
  ar: boolean,
): string {
  const over = minOrder ? (ar ? ` على الطلبات فوق ${money(minOrder)}` : ` on orders over ${money(minOrder)}`) : "";
  if (kind === "free_shipping") return (ar ? "شحن مجاني" : "Free delivery") + over;
  if (kind === "percent" && value) return (ar ? `خصم ${value}%` : `${value}% off`) + over;
  if (kind === "amount" && value) return (ar ? `خصم ${money(value)}` : `${money(value)} off`) + over;
  return ar ? "هدية" : "A gift";
}

/** Only a reward that becomes a code can be applied to a basket. */
const spendable = (kind: string | null) =>
  kind === "percent" || kind === "amount" || kind === "free_shipping";

export function checkoutRewards(
  loyalty: LoyaltySummary | null | undefined,
  ar: boolean,
  /**
   * What delivery costs on this order. While the shop delivers free, a
   * free-delivery reward is worth nothing - offering it would charge her
   * signatures for something she already has.
   */
  shipping = 0,
): CheckoutReward[] {
  if (!loyalty?.enrolled) return [];

  const held = (loyalty.myRewards ?? [])
    .filter((r: UserReward) => r.code && (r.status === "available" || r.status === "claimed"))
    .filter((r) => shipping > 0 || r.type !== "delivery")
    .filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now());

  // Only one code goes on an order, so three unused "10% off" codes are one
  // choice wearing three faces. The soonest to expire is the one to spend.
  const bySoonest = [...held].sort(
    (a, b) =>
      (a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity) -
      (b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity),
  );
  const seen = new Set<string>();
  const mine: CheckoutReward[] = [];
  for (const r of bySoonest) {
    if (seen.has(r.rewardId)) continue;
    seen.add(r.rewardId);
    mine.push({
      id: r.id,
      title: r.title,
      code: r.code ?? "",
      detail: ar ? "جاهزة للاستخدام" : "Ready to use",
      cost: 0,
      ready: true,
    });
  }

  const balance = loyalty.user?.signatureBalance ?? 0;
  const affordable: CheckoutReward[] = (loyalty.availableRewards ?? [])
    .filter((r: RewardView) => r.status === "affordable" || r.status === "available")
    .filter((r) => spendable(r.discountKind))
    .filter((r) => shipping > 0 || r.discountKind !== "free_shipping")
    .filter((r) => r.signatureCost <= balance)
    // Nothing is gained by spending signatures on a reward she is already
    // holding an unused code for.
    .filter((r) => !seen.has(r.id))
    .sort((a, b) => a.signatureCost - b.signatureCost)
    .map((r) => ({
      id: r.id,
      title: ar ? (r.titleAr ?? r.titleEn) : r.titleEn,
      code: "",
      detail: rewardDetail(r.discountKind, r.discountValue, r.minOrderValue, ar),
      cost: r.signatureCost,
      ready: false,
    }));

  // Already earned first: it costs nothing to use and expires if it is not.
  return [...mine, ...affordable].slice(0, 6);
}
