import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  Level,
  LevelKey,
  LoyaltyProgress,
  LoyaltySummary,
  Privilege,
  Reward,
  RewardView,
  SocietyEvent,
  Streak,
  Transaction,
  UserReward,
  VaultView,
} from "./types";

/**
 * The loyalty service. Every mutation goes through a Postgres function
 * (loyalty_award / loyalty_redeem / loyalty_open_vault / …) so balance changes
 * are atomic and idempotent at the database level — this layer only ever reads,
 * shapes, and delegates. It runs on the service role (RLS-bypassing) and is
 * always called with a phone the caller already proved they own.
 */

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const nn = (v: unknown): number | null => (v == null ? null : Number(v));

/** A read failed because the migration has not been applied yet. */
function isMissing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return (
    err.code === "42P01" || // undefined_table
    err.code === "PGRST205" || // PostgREST: table not in schema cache
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

export class LoyaltyUnavailable extends Error {
  constructor(public reason: "migration_missing" | "not_configured") {
    super(reason);
  }
}

// ---- Row mappers ------------------------------------------------------------
function toLevel(r: Row): Level {
  return {
    key: s(r.key) as LevelKey,
    sort: n(r.sort),
    nameEn: s(r.name_en),
    nameAr: s(r.name_ar),
    taglineEn: sn(r.tagline_en),
    taglineAr: sn(r.tagline_ar),
    threshold: n(r.threshold),
    icon: sn(r.icon),
    color: sn(r.color),
  };
}
function toReward(r: Row): Reward {
  return {
    id: s(r.id),
    titleEn: s(r.title_en),
    titleAr: sn(r.title_ar),
    descriptionEn: sn(r.description_en),
    descriptionAr: sn(r.description_ar),
    type: s(r.type) as Reward["type"],
    signatureCost: n(r.signature_cost),
    minLevel: (sn(r.min_level) as LevelKey | null) ?? null,
    discountKind: (sn(r.discount_kind) as Reward["discountKind"]) ?? null,
    discountValue: nn(r.discount_value),
    bonusSignatures: nn(r.bonus_signatures),
    minOrderValue: nn(r.min_order_value),
    expiryDays: nn(r.expiry_days),
    image: sn(r.image),
    active: r.active !== false,
  };
}

// ---- Config loaders ---------------------------------------------------------
export async function getLevels(): Promise<Level[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("loyalty_levels").select("*").order("sort");
  if (error) {
    if (isMissing(error)) throw new LoyaltyUnavailable("migration_missing");
    throw new Error(error.message);
  }
  return (data ?? []).map(toLevel);
}

// ---- Progression math -------------------------------------------------------
export function computeProgress(levels: Level[], currentLevel: LevelKey, lifetime: number): LoyaltyProgress {
  const sorted = [...levels].sort((a, b) => a.sort - b.sort);
  const cur = sorted.find((l) => l.key === currentLevel) ?? sorted[0];
  const next = sorted.find((l) => l.sort === (cur?.sort ?? 0) + 1) ?? null;
  const base = cur?.threshold ?? 0;
  const required = next?.threshold ?? null;
  const remaining = required == null ? null : Math.max(0, required - lifetime);
  const percentage =
    required == null
      ? 100
      : Math.max(0, Math.min(100, Math.round(((lifetime - base) / Math.max(1, required - base)) * 100)));
  return {
    currentLevel: cur?.key ?? "discovery",
    currentLevelName: cur?.nameEn ?? "The Discovery",
    lifetime,
    nextLevel: next?.key ?? null,
    nextLevelName: next?.nameEn ?? null,
    required,
    remaining,
    percentage,
  };
}

// ---- The one optimized dashboard read --------------------------------------
export async function getLoyaltySummary(phone: string): Promise<LoyaltySummary> {
  if (!isSupabaseConfigured()) throw new LoyaltyUnavailable("not_configured");
  const supabase = getServerSupabase();

  // Make sure a profile exists so first-time viewers see a real (zeroed) state.
  try {
    await supabase.rpc("loyalty_ensure_profile", { p_phone: phone });
  } catch {
    /* the summary reads still work off defaults if this fails */
  }

  const nowIso = new Date().toISOString();
  const [
    profileRes,
    levelsRes,
    vaultsRes,
    userVaultsRes,
    privRes,
    rewardsRes,
    eventsRes,
    streakRes,
    streakHistRes,
    milestoneRes,
    myRewardsRes,
    txRes,
  ] = await Promise.all([
    supabase.from("loyalty_profiles").select("*").eq("phone", phone).maybeSingle(),
    supabase.from("loyalty_levels").select("*").order("sort"),
    supabase.from("loyalty_vaults").select("*").eq("active", true).order("sort"),
    supabase.from("user_vaults").select("*").eq("phone", phone),
    supabase.from("loyalty_privileges").select("*").eq("active", true).order("sort"),
    supabase.from("loyalty_rewards").select("*").eq("active", true).order("signature_cost"),
    supabase
      .from("loyalty_events")
      .select("*")
      .eq("active", true)
      .lte("start_date", nowIso)
      .gte("end_date", nowIso),
    supabase.from("loyalty_streaks").select("*").eq("phone", phone).maybeSingle(),
    supabase.from("loyalty_streak_history").select("year_month").eq("phone", phone),
    supabase.from("loyalty_streak_milestones").select("*").eq("active", true).order("months"),
    supabase.from("user_rewards").select("*").eq("phone", phone).order("created_at", { ascending: false }).limit(50),
    supabase.from("signature_transactions").select("*").eq("phone", phone).order("created_at", { ascending: false }).limit(10),
  ]);

  if (profileRes.error && isMissing(profileRes.error)) throw new LoyaltyUnavailable("migration_missing");
  if (levelsRes.error && isMissing(levelsRes.error)) throw new LoyaltyUnavailable("migration_missing");

  const levels = (levelsRes.data ?? []).map(toLevel);
  const levelSort = new Map(levels.map((l) => [l.key, l.sort]));

  const p = (profileRes.data ?? {}) as Row;
  const currentLevel = (s(p.current_level) || "discovery") as LevelKey;
  const balance = n(p.available_balance);
  const lifetimeEarned = n(p.lifetime_earned);
  const lifetimeSpent = n(p.lifetime_spent);
  const mySort = levelSort.get(currentLevel) ?? 1;

  const progress = computeProgress(levels, currentLevel, lifetimeEarned);

  // Vaults: merge config with the viewer's progress rows.
  const uvByVault = new Map((userVaultsRes.data ?? []).map((r: Row) => [s(r.vault_id), r]));
  const vaults: VaultView[] = (vaultsRes.data ?? []).map((v: Row): VaultView => {
    const uv = uvByVault.get(s(v.id));
    const levelReq = (sn(v.level_required) as LevelKey | null) ?? null;
    const locked = levelReq != null && (levelSort.get(levelReq) ?? 99) > mySort;
    const required = n(v.required_progress);
    const current = uv ? n(uv.current_progress) : 0;
    const rawStatus = uv ? s(uv.status) : "locked";
    const status = (current >= required && rawStatus !== "opened" ? "ready_to_open" : rawStatus) as VaultView["status"];
    return {
      id: s(v.id),
      userVaultId: uv ? s(uv.id) : null,
      vaultType: s(v.vault_type) as VaultView["vaultType"],
      titleEn: s(v.title_en),
      titleAr: sn(v.title_ar),
      descriptionEn: sn(v.description_en),
      requiredProgress: required,
      currentProgress: current,
      levelRequired: levelReq,
      status,
      icon: sn(v.icon),
      locked,
    };
  });
  const primaryVault =
    vaults.find((v) => v.status === "ready_to_open" && !v.locked) ??
    vaults.find((v) => v.vaultType === "signature") ??
    vaults[0] ??
    null;

  const privileges: Privilege[] = (privRes.data ?? []).map((r: Row): Privilege => {
    const req = s(r.level_required) as LevelKey;
    return {
      id: s(r.id),
      titleEn: s(r.title_en),
      titleAr: sn(r.title_ar),
      descriptionEn: sn(r.description_en),
      descriptionAr: sn(r.description_ar),
      levelRequired: req,
      sort: n(r.sort),
      unlocked: (levelSort.get(req) ?? 99) <= mySort,
    };
  });

  const availableRewards: RewardView[] = (rewardsRes.data ?? []).map((r: Row): RewardView => {
    const reward = toReward(r);
    const levelOk = reward.minLevel == null || (levelSort.get(reward.minLevel) ?? 99) <= mySort;
    const affordable = reward.signatureCost <= balance;
    let status: RewardView["status"] = "available";
    let lockedReason: RewardView["lockedReason"] = null;
    if (!levelOk) {
      status = "locked";
      lockedReason = "level";
    } else if (reward.signatureCost > 0 && !affordable) {
      status = "locked";
      lockedReason = "signatures";
    } else if (reward.signatureCost > 0) {
      status = "affordable";
    }
    return { ...reward, status, lockedReason };
  });

  const activeEvents: SocietyEvent[] = (eventsRes.data ?? [])
    .filter((e: Row) => {
      const targets = (e.target_levels as string[] | null) ?? null;
      return !targets || targets.length === 0 || targets.includes(currentLevel);
    })
    .map((e: Row): SocietyEvent => ({
      id: s(e.id),
      titleEn: s(e.title_en),
      titleAr: sn(e.title_ar),
      descriptionEn: sn(e.description_en),
      eventType: s(e.event_type) as SocietyEvent["eventType"],
      multiplier: n(e.multiplier) || 1,
      targetLevels: (e.target_levels as LevelKey[] | null) ?? null,
      startDate: s(e.start_date),
      endDate: s(e.end_date),
    }));

  const myRewards: UserReward[] = (myRewardsRes.data ?? []).map((r: Row): UserReward => ({
    id: s(r.id),
    rewardId: s(r.reward_id),
    title: s((r.metadata as Row)?.title ?? "") || "Reward",
    type: s((r.metadata as Row)?.type ?? "discount") as UserReward["type"],
    status: s(r.status) as UserReward["status"],
    code: sn(r.code),
    source: s(r.source),
    expiresAt: sn(r.expires_at),
    createdAt: s(r.created_at),
  }));

  const recentActivity: Transaction[] = (txRes.data ?? []).map((r: Row): Transaction => ({
    id: s(r.id),
    direction: s(r.direction) as Transaction["direction"],
    amount: n(r.amount),
    balanceAfter: n(r.balance_after),
    sourceType: s(r.source_type) as Transaction["sourceType"],
    sourceId: sn(r.source_id),
    description: sn(r.description),
    createdAt: s(r.created_at),
  }));

  const streak = buildStreak(
    (streakRes.data ?? {}) as Row,
    (streakHistRes.data ?? []) as Row[],
    (milestoneRes.data ?? []) as Row[],
  );

  return {
    enrolled: Boolean(profileRes.data),
    user: {
      phone,
      signatureBalance: balance,
      lifetimeEarned,
      lifetimeSpent,
      currentLevel,
    },
    progress,
    levels,
    primaryVault,
    vaults,
    privileges,
    availableRewards,
    myRewards,
    activeEvents,
    streak,
    recentActivity,
  };
}

// ---- Streak assembly (last 6 months for the UI strip) ----------------------
function buildStreak(row: Row, history: Row[], milestones: Row[]): Streak {
  const qualified = new Set(history.map((h) => s(h.year_month)));
  const months: { month: string; qualified: boolean }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: ym, qualified: qualified.has(ym) });
  }
  const current = n(row.current_streak);
  const next = milestones.map((m) => n(m.months)).sort((a, b) => a - b).find((m) => m > current) ?? null;
  const nextRow = next != null ? milestones.find((m) => n(m.months) === next) : null;
  return {
    currentStreak: current,
    longestStreak: n(row.longest_streak),
    lastQualifiedMonth: sn(row.last_qualified_month),
    months,
    nextMilestone: nextRow ? { months: n(nextRow.months), titleEn: s(nextRow.title_en), titleAr: sn(nextRow.title_ar) } : null,
  };
}

// ---- Mutations (thin wrappers over the atomic RPCs) -------------------------
export type AwardInput = {
  direction?: "earn" | "spend" | "bonus" | "adjustment";
  amount: number;
  sourceType: Transaction["sourceType"];
  sourceId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
};

export async function awardSignatures(phone: string, input: AwardInput) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("loyalty_award", {
    p_phone: phone,
    p_direction: input.direction ?? "earn",
    // Sign is preserved: the RPC abs()es the magnitude but reads the sign to
    // decide whether an `adjustment` is a credit or a debit.
    p_amount: Math.trunc(input.amount),
    p_source_type: input.sourceType,
    p_source_id: input.sourceId ?? null,
    p_description: input.description ?? null,
    p_metadata: input.metadata ?? {},
    p_dedupe_key: input.dedupeKey ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    applied: boolean;
    duplicate: boolean;
    balance: number;
    lifetime_earned: number;
    level: LevelKey;
    level_changed: boolean;
    level_before?: LevelKey;
  };
}

export async function redeemReward(phone: string, rewardId: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("loyalty_redeem", { p_phone: phone, p_reward_id: rewardId });
  if (error) throw new Error(mapRpcError(error.message));
  return data as { ok: boolean; balance: number; user_reward: Row };
}

export async function openVault(phone: string, userVaultId: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("loyalty_open_vault", { p_phone: phone, p_user_vault_id: userVaultId });
  if (error) throw new Error(mapRpcError(error.message));
  return data as { ok: boolean; reward: Row; user_reward: Row };
}

export async function addVaultProgress(phone: string, vaultId: string, amount = 1, dedupeKey?: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("loyalty_add_vault_progress", {
    p_phone: phone,
    p_vault_id: vaultId,
    p_amount: amount,
    p_dedupe_key: dedupeKey ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { applied: boolean; progress?: number; required?: number; status?: string };
}

export async function touchStreak(phone: string, month?: string, source = "order") {
  const supabase = getServerSupabase();
  const ym = month ?? new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase.rpc("loyalty_touch_streak", {
    p_phone: phone,
    p_month: ym,
    p_source: source,
  });
  if (error) throw new Error(error.message);
  return data as { current_streak: number; longest_streak: number; month_counted: boolean };
}

export async function getHistory(phone: string, limit = 100): Promise<Transaction[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("signature_transactions")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissing(error)) throw new LoyaltyUnavailable("migration_missing");
    throw new Error(error.message);
  }
  return (data ?? []).map((r: Row) => ({
    id: s(r.id),
    direction: s(r.direction) as Transaction["direction"],
    amount: n(r.amount),
    balanceAfter: n(r.balance_after),
    sourceType: s(r.source_type) as Transaction["sourceType"],
    sourceId: sn(r.source_id),
    description: sn(r.description),
    createdAt: s(r.created_at),
  }));
}

/** Highest active event multiplier for a level (multipliers do not stack). */
export async function activeMultiplier(level: LevelKey): Promise<{ multiplier: number; eventId: string | null }> {
  const supabase = getServerSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("loyalty_events")
    .select("id, multiplier, target_levels, event_type")
    .eq("active", true)
    .eq("event_type", "multiplier")
    .lte("start_date", nowIso)
    .gte("end_date", nowIso);
  if (error || !data) return { multiplier: 1, eventId: null };
  let best = 1;
  let id: string | null = null;
  for (const e of data as Row[]) {
    const targets = (e.target_levels as string[] | null) ?? null;
    if (targets && targets.length && !targets.includes(level)) continue;
    const m = n(e.multiplier) || 1;
    if (m > best) {
      best = m;
      id = s(e.id);
    }
  }
  return { multiplier: best, eventId: id };
}

function mapRpcError(message: string): string {
  const m = (message || "").toLowerCase();
  for (const code of [
    "insufficient_signatures",
    "invalid_reward",
    "level_too_low",
    "already_redeemed",
    "reward_unavailable",
    "vault_not_ready",
    "vault_already_opened",
    "not_your_vault",
    "vault_empty",
  ]) {
    if (m.includes(code)) return code;
  }
  if (isMissing({ message })) return "migration_missing";
  return message;
}
