// Shared loyalty types — client-safe (no server-only imports), so UI, API and
// service all speak the same shapes. Mirrors 0027_loyalty.sql.

export type LevelKey = "discovery" | "curated" | "insider" | "icon" | "muse";

export type Level = {
  key: LevelKey;
  sort: number;
  nameEn: string;
  nameAr: string;
  taglineEn: string | null;
  taglineAr: string | null;
  threshold: number;
  icon: string | null;
  /** Hex, set in the loyalty programme. Null until one is chosen. */
  color: string | null;
};

export type SignatureDirection = "earn" | "spend" | "expire" | "adjustment" | "bonus";
export type SignatureSource =
  | "order" | "review" | "profile" | "birthday" | "event"
  | "streak" | "vault" | "reward" | "category" | "admin" | "signup";

export type Transaction = {
  id: string;
  direction: SignatureDirection;
  amount: number;
  balanceAfter: number;
  sourceType: SignatureSource;
  sourceId: string | null;
  description: string | null;
  createdAt: string;
};

export type RewardType = "discount" | "delivery" | "product" | "access" | "experience" | "signatures";

export type Reward = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  type: RewardType;
  signatureCost: number;
  minLevel: LevelKey | null;
  discountKind: "percent" | "amount" | "free_shipping" | null;
  discountValue: number | null;
  bonusSignatures: number | null;
  minOrderValue: number | null;
  expiryDays: number | null;
  image: string | null;
  active: boolean;
};

/** A reward as the current user sees it — with an availability status. */
export type RewardView = Reward & {
  status: "available" | "locked" | "affordable";
  lockedReason: "level" | "signatures" | null;
};

export type UserRewardStatus = "available" | "locked" | "claimed" | "redeemed" | "expired";
export type UserReward = {
  id: string;
  rewardId: string;
  title: string;
  type: RewardType;
  status: UserRewardStatus;
  code: string | null;
  source: string;
  expiresAt: string | null;
  createdAt: string;
};

export type Privilege = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  levelRequired: LevelKey;
  sort: number;
  /** Computed for the viewer. */
  unlocked: boolean;
};

export type VaultType = "daily" | "signature" | "private" | "gold";
export type VaultStatus = "locked" | "ready_to_open" | "opened" | "expired";

export type VaultView = {
  id: string; // loyalty_vaults.id
  userVaultId: string | null; // user_vaults.id once progress exists
  vaultType: VaultType;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  requiredProgress: number;
  currentProgress: number;
  levelRequired: LevelKey | null;
  status: VaultStatus;
  icon: string | null;
  locked: boolean; // gated by level
};

export type SocietyEvent = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  eventType: "multiplier" | "offer" | "drop" | "moment";
  multiplier: number;
  targetLevels: LevelKey[] | null;
  startDate: string;
  endDate: string;
};

export type Streak = {
  currentStreak: number;
  longestStreak: number;
  lastQualifiedMonth: string | null;
  months: { month: string; qualified: boolean }[];
  nextMilestone: { months: number; titleEn: string; titleAr: string | null } | null;
};

export type LoyaltyProgress = {
  currentLevel: LevelKey;
  currentLevelName: string;
  lifetime: number;
  nextLevel: LevelKey | null;
  nextLevelName: string | null;
  required: number | null; // threshold of next level
  remaining: number | null;
  percentage: number; // 0..100 within the current band
};

export type LoyaltySummary = {
  enrolled: boolean;
  user: {
    phone: string;
    signatureBalance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    currentLevel: LevelKey;
  };
  progress: LoyaltyProgress;
  levels: Level[];
  primaryVault: VaultView | null;
  vaults: VaultView[];
  privileges: Privilege[];
  availableRewards: RewardView[];
  myRewards: UserReward[];
  activeEvents: SocietyEvent[];
  streak: Streak;
  recentActivity: Transaction[];
};

/** Structured error codes the service/RPCs can surface. */
export type LoyaltyError =
  | "not_signed_in"
  | "insufficient_signatures"
  | "invalid_reward"
  | "level_too_low"
  | "already_redeemed"
  | "reward_unavailable"
  | "vault_not_ready"
  | "vault_already_opened"
  | "not_your_vault"
  | "vault_empty"
  | "migration_missing"
  | "not_configured";
