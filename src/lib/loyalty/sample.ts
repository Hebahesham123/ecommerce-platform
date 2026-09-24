import type { LoyaltySummary } from "./types";

/**
 * A shopper who does not exist, so the merchant can see their own screens.
 *
 * The Society hub needs a signed-in shopper with a balance, a level, vaults and
 * a streak before it will draw anything — which makes it exactly the thing a
 * merchant cannot look at while they are designing it. This is that shopper: far
 * enough along that every state on every screen has something to show, including
 * the ones a real account would have to wait months for.
 *
 * The numbers match the design's own screens, so the preview and the drawings
 * can be held up against each other.
 */
export const SAMPLE_SUMMARY: LoyaltySummary = {
  enrolled: true,
  user: {
    phone: "",
    signatureBalance: 340,
    lifetimeEarned: 1240,
    lifetimeSpent: 900,
    currentLevel: "curated",
  },
  progress: {
    currentLevel: "curated",
    currentLevelName: "The Curated",
    lifetime: 340,
    nextLevel: "insider",
    nextLevelName: "The Insider",
    required: 500,
    remaining: 160,
    percentage: 68,
  },
  levels: [
    { key: "discovery", sort: 1, nameEn: "The Discovery", nameAr: "", taglineEn: "Every great collection starts somewhere.", taglineAr: null, threshold: 0, icon: null, color: "#7E7364" },
    { key: "curated", sort: 2, nameEn: "The Curated", nameAr: "", taglineEn: "Your taste is taking shape.", taglineAr: null, threshold: 500, icon: null, color: "#A46C3C" },
    { key: "insider", sort: 3, nameEn: "The Insider", nameAr: "", taglineEn: "You know where the good things are.", taglineAr: null, threshold: 1500, icon: null, color: "#8F7226" },
    { key: "icon", sort: 4, nameEn: "The Icon", nameAr: "", taglineEn: "More than a member. Part of the story.", taglineAr: null, threshold: 4000, icon: null, color: "#9B4B41" },
    { key: "muse", sort: 5, nameEn: "The Muse", nameAr: "", taglineEn: "The highest expression of exceptional taste.", taglineAr: null, threshold: 10000, icon: null, color: "#6C5375" },
  ],
  primaryVault: {
    id: "v1",
    userVaultId: "uv1",
    vaultType: "daily",
    titleEn: "The Daily Vault",
    titleAr: null,
    descriptionEn: "Small rewards, big joy.",
    requiredProgress: 10,
    currentProgress: 7,
    levelRequired: null,
    status: "locked",
    icon: "🎁",
    locked: false,
  },
  vaults: [
    { id: "v1", userVaultId: "uv1", vaultType: "daily", titleEn: "The Daily Vault", titleAr: null, descriptionEn: "Small rewards, big joy.", requiredProgress: 10, currentProgress: 7, levelRequired: null, status: "locked", icon: "🎁", locked: false },
    { id: "v2", userVaultId: "uv2", vaultType: "signature", titleEn: "The Signature Vault", titleAr: null, descriptionEn: "For our most loved members.", requiredProgress: 6, currentProgress: 6, levelRequired: null, status: "ready_to_open", icon: "✦", locked: false },
    { id: "v3", userVaultId: null, vaultType: "private", titleEn: "The Private Vault", titleAr: null, descriptionEn: "Reserved for Insiders and above.", requiredProgress: 8, currentProgress: 0, levelRequired: "insider", status: "locked", icon: "👑", locked: true },
    { id: "v4", userVaultId: null, vaultType: "gold", titleEn: "The Gold Vault", titleAr: null, descriptionEn: "The ultimate experience.", requiredProgress: 12, currentProgress: 0, levelRequired: "muse", status: "locked", icon: "◈", locked: true },
  ],
  privileges: [
    { id: "p1", titleEn: "Early Access", titleAr: null, descriptionEn: "To new collections", descriptionAr: null, levelRequired: "discovery", sort: 1, unlocked: true },
    { id: "p2", titleEn: "Private Offers", titleAr: null, descriptionEn: "Members only", descriptionAr: null, levelRequired: "curated", sort: 2, unlocked: true },
    { id: "p3", titleEn: "Birthday Surprise", titleAr: null, descriptionEn: "Every year", descriptionAr: null, levelRequired: "curated", sort: 3, unlocked: true },
    { id: "p4", titleEn: "Private Reward", titleAr: null, descriptionEn: "Reach The Insider to unlock", descriptionAr: null, levelRequired: "insider", sort: 4, unlocked: false },
  ],
  tasks: [
    { id: "t1", actionType: "profile_complete", title: "Complete profile", signatures: 100, ratePerEgp: 0, oneTime: true },
    { id: "t2", actionType: "review", title: "Post a review", signatures: 20, ratePerEgp: 0, oneTime: false },
    { id: "t3", actionType: "order", title: null, signatures: 0, ratePerEgp: 1, oneTime: false },
  ],
  availableRewards: [
    { id: "r1", titleEn: "Complimentary Delivery", titleAr: null, descriptionEn: "Valid for 3 days", descriptionAr: null, type: "delivery", signatureCost: 200, minLevel: null, discountKind: "free_shipping", discountValue: null, bonusSignatures: null, minOrderValue: null, expiryDays: 3, image: null, active: true, status: "affordable", lockedReason: null },
    { id: "r2", titleEn: "15% Off", titleAr: null, descriptionEn: "On your next order", descriptionAr: null, type: "discount", signatureCost: 400, minLevel: null, discountKind: "percent", discountValue: 15, bonusSignatures: null, minOrderValue: null, expiryDays: 7, image: null, active: true, status: "available", lockedReason: null },
    { id: "r3", titleEn: "Free Gift", titleAr: null, descriptionEn: "With any purchase", descriptionAr: null, type: "product", signatureCost: 600, minLevel: null, discountKind: null, discountValue: null, bonusSignatures: null, minOrderValue: null, expiryDays: 7, image: null, active: true, status: "locked", lockedReason: "signatures" },
    { id: "r4", titleEn: "Private Reward", titleAr: null, descriptionEn: "Reach THE INSIDER to unlock", descriptionAr: null, type: "access", signatureCost: 0, minLevel: "insider", discountKind: null, discountValue: null, bonusSignatures: null, minOrderValue: null, expiryDays: null, image: null, active: true, status: "locked", lockedReason: "level" },
  ],
  myRewards: [
    { id: "ur1", rewardId: "r2", title: "15% Off", type: "discount", status: "claimed", code: "BB-15-A7X", source: "reward", expiresAt: null, createdAt: "2026-09-01T10:00:00.000Z" },
  ],
  activeEvents: [
    { id: "e1", titleEn: "Signature Weekend", titleAr: null, descriptionEn: "Double Signatures on every order.", eventType: "multiplier", multiplier: 2, targetLevels: null, startDate: "2026-09-10T00:00:00.000Z", endDate: "2026-09-20T00:00:00.000Z" },
    { id: "e2", titleEn: "Private Hours", titleAr: null, descriptionEn: "Society members only.", eventType: "moment", multiplier: 1, targetLevels: null, startDate: "2026-09-12T00:00:00.000Z", endDate: "2026-09-16T00:00:00.000Z" },
    { id: "e3", titleEn: "The Secret Drop", titleAr: null, descriptionEn: "A new reward just entered your Vault.", eventType: "drop", multiplier: 1, targetLevels: null, startDate: "2026-09-11T00:00:00.000Z", endDate: "2026-09-18T00:00:00.000Z" },
  ],
  streak: {
    currentStreak: 3,
    longestStreak: 4,
    lastQualifiedMonth: "2026-03",
    months: [
      { month: "2026-01", qualified: true },
      { month: "2026-02", qualified: true },
      { month: "2026-03", qualified: true },
      { month: "2026-04", qualified: false },
    ],
    nextMilestone: { months: 6, titleEn: "Unlock Private Vault.", titleAr: null },
  },
  recentActivity: [
    { id: "t1", direction: "earn", amount: 120, balanceAfter: 340, sourceType: "order", sourceId: null, description: null, createdAt: "2026-09-13T10:00:00.000Z" },
    { id: "t2", direction: "earn", amount: 50, balanceAfter: 220, sourceType: "review", sourceId: null, description: null, createdAt: "2026-09-09T10:00:00.000Z" },
    { id: "t3", direction: "spend", amount: 200, balanceAfter: 170, sourceType: "reward", sourceId: null, description: null, createdAt: "2026-09-04T10:00:00.000Z" },
  ],
};
