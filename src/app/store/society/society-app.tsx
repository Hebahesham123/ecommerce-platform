"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { getMyLoyalty, redeemMyReward, openMyVault, getMyLoyaltyHistory } from "../loyalty-actions";
import type { LoyaltySummary, RewardView, Transaction, VaultView } from "@/lib/loyalty/types";
import {
  DEFAULT_LOYALTY_THEME,
  loyaltyVars,
  tabLabel,
  type LoyaltyTheme,
} from "@/lib/loyalty/theme";

const ThemeContext = createContext<LoyaltyTheme>(DEFAULT_LOYALTY_THEME);
/** The merchant's wording, wherever in the hub you are. */
const useWords = () => useContext(ThemeContext).words;

// A self-contained, mobile-shaped preview of the Beauty Bar Society so a
// customer can see every part of the loyalty system working end to end. Styling
// is deliberately standalone (the luxury brown/beige palette from the design) so
// it can be lifted into the real app shell later without depending on it.

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

const TABS = [
  "overview",
  "levels",
  "vault",
  "rewards",
  "privileges",
  "events",
  "streak",
  "activity",
] as const;
type Tab = (typeof TABS)[number];

type Toast = { text: string; tone: "ok" | "err" } | null;

export default function SocietyApp({
  summary,
  theme = DEFAULT_LOYALTY_THEME,
}: {
  summary: LoyaltySummary;
  theme?: LoyaltyTheme;
}) {
  const [data, setData] = useState<LoyaltySummary>(summary);
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [reveal, setReveal] = useState<{ title: string; code: string | null; type: string } | null>(null);
  const [pending, start] = useTransition();

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3200);
  }
  async function refresh() {
    const res = await getMyLoyalty();
    if (res.ok) setData(res.data);
  }

  function onRedeem(r: RewardView) {
    start(async () => {
      const res = await redeemMyReward(r.id);
      if (res.ok) {
        flash(`Claimed ${r.titleEn}${res.data.code ? ` · ${res.data.code}` : ""}`);
        await refresh();
      } else {
        flash(errorText(res.error), "err");
      }
    });
  }
  function onOpenVault(v: VaultView) {
    if (!v.userVaultId) return;
    start(async () => {
      const res = await openMyVault(v.userVaultId!);
      if (res.ok) {
        setReveal({ title: res.data.rewardTitle, code: res.data.code, type: res.data.type });
        await refresh();
      } else {
        flash(errorText(res.error), "err");
      }
    });
  }

  const p = data.progress;
  const w = theme.words;
  const SIG = w.glyph;

  return (
    <ThemeContext.Provider value={theme}>
    <div
      className="min-h-screen bg-[var(--ls-page)] text-[var(--ls-ink)]"
      style={loyaltyVars(theme) as React.CSSProperties}
    >
      <div className="mx-auto max-w-md px-4 pb-24 pt-8">
        {/* Brand header */}
        <div className="text-center">
          <div className="text-xs font-semibold tracking-[0.35em] text-[var(--ls-ink-muted)]">{w.brandLine}</div>
          <h1 className="font-serif text-3xl tracking-wide text-[var(--ls-ink)]">{w.title}</h1>
          <p className="mt-1 text-xs text-[var(--ls-ink-soft)]">{w.tagline}</p>
        </div>

        {/* Status card */}
        <div className="mt-6 rounded-3xl bg-[var(--ls-card)] p-6 shadow-sm ring-1 ring-[var(--ls-line)]">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--ls-ink-soft)]">{w.statusLabel}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="font-serif text-2xl text-[var(--ls-ink)]">{p.currentLevelName} {SIG}</div>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-4xl font-bold text-[var(--ls-ink)]">{fmt(data.user.signatureBalance)}</div>
            <div className="pb-1 text-sm text-[var(--ls-ink-muted)]">{w.pointsWord}</div>
          </div>

          {p.nextLevel ? (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--ls-panel)]">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--ls-accent)] to-[var(--ls-accent-to)]" style={{ width: `${p.percentage}%` }} />
              </div>
              <div className="mt-2 text-xs text-[var(--ls-ink-muted)]">
                {fmt(p.remaining ?? 0)} {w.pointsWord} until {p.nextLevelName}
              </div>
            </>
          ) : (
            <div className="mt-4 text-xs font-medium text-[var(--ls-accent)]">You&apos;ve reached the highest level. ✦</div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Metric label="Balance" value={`${fmt(data.user.signatureBalance)}`} />
            <Metric label="Lifetime" value={`${fmt(data.user.lifetimeEarned)}`} />
            <Metric label="Streak" value={`${data.streak.currentStreak}`} />
          </div>
        </div>

        {/* Vault teaser */}
        {data.primaryVault && !data.primaryVault.locked && (
          <VaultTeaser vault={data.primaryVault} onOpen={() => onOpenVault(data.primaryVault!)} pending={pending} />
        )}

        {/* Tabs */}
        <div className="mt-6 -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2">
            {TABS.map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key ? "bg-[var(--ls-accent)] text-white" : "bg-[var(--ls-card)] text-[var(--ls-ink-muted)] ring-1 ring-[var(--ls-line)]"
                }`}
              >
                {tabLabel(theme, key)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {tab === "overview" && <Overview data={data} onGoto={setTab} />}
          {tab === "levels" && <Levels data={data} />}
          {tab === "vault" && <Vaults data={data} onOpen={onOpenVault} pending={pending} />}
          {tab === "rewards" && <Rewards data={data} onRedeem={onRedeem} pending={pending} />}
          {tab === "privileges" && <Privileges data={data} />}
          {tab === "events" && <Events data={data} />}
          {tab === "streak" && <Streak data={data} />}
          {tab === "activity" && <Activity initial={data.recentActivity} />}
        </div>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className={`rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === "ok" ? "bg-[var(--ls-ink)]" : "bg-rose-600"}`}>
            {toast.text}
          </div>
        </div>
      )}

      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
    </ThemeContext.Provider>
  );
}

// ---- Building blocks --------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--ls-panel)] py-2">
      <div className="text-lg font-bold text-[var(--ls-ink)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-serif text-xl text-[var(--ls-ink)]">{title}</h2>
      {children}
    </div>
  );
}

function VaultTeaser({ vault, onOpen, pending }: { vault: VaultView; onOpen: () => void; pending: boolean }) {
  const ready = vault.status === "ready_to_open";
  return (
    <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-5 text-[var(--ls-on-deep)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.2em] text-[var(--ls-on-deep-soft)]">YOUR VAULT</div>
          <div className="mt-0.5 font-serif text-lg">{vault.titleEn}</div>
        </div>
        <div className="text-3xl">{vault.icon ?? "🎁"}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: vault.requiredProgress }).map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < vault.currentProgress ? "bg-[var(--ls-gold)]" : "bg-white/15"}`} />
        ))}
      </div>
      <div className="mt-2 text-xs text-[var(--ls-on-deep-soft)]">
        {ready ? "Your reward is ready." : `${vault.requiredProgress - vault.currentProgress} more to unlock your reward.`}
      </div>
      {ready ? (
        <button onClick={onOpen} disabled={pending} className="mt-4 w-full rounded-xl bg-[var(--ls-gold)] py-3 text-sm font-semibold text-[var(--ls-deep)] disabled:opacity-60">
          {pending ? "Opening…" : "Open the Vault"}
        </button>
      ) : (
        <div className="mt-4 w-full rounded-xl bg-white/10 py-3 text-center text-sm font-medium text-[var(--ls-on-deep-soft)]">
          {vault.currentProgress} / {vault.requiredProgress}
        </div>
      )}
    </div>
  );
}

function Overview({ data, onGoto }: { data: LoyaltySummary; onGoto: (t: Tab) => void }) {
  const priv = data.privileges.filter((x) => x.unlocked).slice(0, 3);
  return (
    <div className="space-y-5">
      <Section title="Your privileges">
        {priv.length === 0 ? (
          <Empty text="Reach The Curated to unlock your first privilege." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {priv.map((p) => (
              <div key={p.id} className="rounded-2xl bg-[var(--ls-card)] p-3 text-center ring-1 ring-[var(--ls-line)]">
                <div className="text-xl">✧</div>
                <div className="mt-1 text-[11px] font-medium leading-tight text-[var(--ls-ink-muted)]">{p.titleEn}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => onGoto("privileges")} className="mt-2 text-xs font-semibold text-[var(--ls-accent)]">View all privileges →</button>
      </Section>

      <Section title="Rewards for you">
        <div className="space-y-2">
          {data.availableRewards.slice(0, 3).map((r) => (
            <RewardRow key={r.id} r={r} onRedeem={() => onGoto("rewards")} pending={false} compact />
          ))}
        </div>
        <button onClick={() => onGoto("rewards")} className="mt-2 text-xs font-semibold text-[var(--ls-accent)]">See all rewards →</button>
      </Section>

      {data.activeEvents.length > 0 && (
        <Section title="Happening now">
          {data.activeEvents.map((e) => (
            <div key={e.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]">
              <div className="text-xl">✦</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--ls-ink)]">{e.titleEn}</div>
                <div className="truncate text-xs text-[var(--ls-ink-muted)]">{e.descriptionEn}</div>
              </div>
              {e.multiplier > 1 && <div className="rounded-full bg-[var(--ls-accent)] px-2 py-0.5 text-xs font-bold text-white">×{e.multiplier}</div>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Levels({ data }: { data: LoyaltySummary }) {
  const w = useWords();
  const cur = data.levels.find((l) => l.key === data.user.currentLevel);
  const curSort = cur?.sort ?? 1;
  return (
    <Section title="The Levels">
      <div className="space-y-2">
        {data.levels.map((l) => {
          const reached = l.sort <= curSort;
          const current = l.key === data.user.currentLevel;
          return (
            <div key={l.key} className={`rounded-2xl p-4 ring-1 ${current ? "bg-gradient-to-br from-[var(--ls-accent)] to-[var(--ls-accent-to)] text-white ring-transparent" : reached ? "bg-[var(--ls-card)] ring-[var(--ls-line)]" : "bg-[var(--ls-panel)] ring-[var(--ls-line)]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[11px] tracking-widest ${current ? "text-white/70" : "text-[var(--ls-ink-soft)]"}`}>0{l.sort}</div>
                  <div className={`font-serif text-lg ${current ? "text-white" : "text-[var(--ls-ink)]"}`}>{l.nameEn}</div>
                  {l.taglineEn && <div className={`text-xs ${current ? "text-white/80" : "text-[var(--ls-ink-muted)]"}`}>{l.taglineEn}</div>}
                </div>
                <div className={`text-right ${current ? "text-white" : "text-[var(--ls-ink-muted)]"}`}>
                  <div className="text-lg font-bold">{fmt(l.threshold)}</div>
                  <div className="text-[10px] uppercase tracking-wide opacity-70">{reached ? "reached" : w.pointsWord}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Vaults({ data, onOpen, pending }: { data: LoyaltySummary; onOpen: (v: VaultView) => void; pending: boolean }) {
  return (
    <Section title="The Vaults">
      <div className="space-y-3">
        {data.vaults.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-5 text-[var(--ls-on-deep)]">
            <div className="flex items-center justify-between">
              <div className="font-serif text-lg">{v.titleEn}</div>
              <div className="text-2xl">{v.icon ?? "🎁"}</div>
            </div>
            {v.descriptionEn && <div className="mt-0.5 text-xs text-[var(--ls-on-deep-soft)]">{v.descriptionEn}</div>}
            {v.locked ? (
              <div className="mt-4 rounded-xl bg-white/10 py-3 text-center text-sm text-[var(--ls-on-deep-soft)]">
                🔒 Unlocks at {v.levelRequired}
              </div>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-1.5">
                  {Array.from({ length: v.requiredProgress }).map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < v.currentProgress ? "bg-[var(--ls-gold)]" : "bg-white/15"}`} />
                  ))}
                </div>
                <div className="mt-2 text-xs text-[var(--ls-on-deep-soft)]">{v.currentProgress} / {v.requiredProgress}</div>
                {v.status === "ready_to_open" ? (
                  <button onClick={() => onOpen(v)} disabled={pending} className="mt-3 w-full rounded-xl bg-[var(--ls-gold)] py-2.5 text-sm font-semibold text-[var(--ls-deep)] disabled:opacity-60">
                    {pending ? "Opening…" : "Open now"}
                  </button>
                ) : v.status === "opened" ? (
                  <div className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-center text-sm text-[var(--ls-on-deep-soft)]">Opened ✓</div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Rewards({ data, onRedeem, pending }: { data: LoyaltySummary; onRedeem: (r: RewardView) => void; pending: boolean }) {
  return (
    <div className="space-y-5">
      <Section title="Your rewards">
        <div className="space-y-2">
          {data.availableRewards.map((r) => (
            <RewardRow key={r.id} r={r} onRedeem={() => onRedeem(r)} pending={pending} />
          ))}
        </div>
      </Section>
      {data.myRewards.length > 0 && (
        <Section title="Claimed">
          <div className="space-y-2">
            {data.myRewards.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]">
                <div>
                  <div className="text-sm font-medium text-[var(--ls-ink)]">{r.title}</div>
                  {r.code && <div className="text-xs font-mono text-[var(--ls-accent)]">{r.code}</div>}
                </div>
                <span className="rounded-full bg-[var(--ls-panel)] px-2.5 py-1 text-[11px] font-medium capitalize text-[var(--ls-ink-muted)]">{r.status}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function RewardRow({ r, onRedeem, pending, compact }: { r: RewardView; onRedeem: () => void; pending: boolean; compact?: boolean }) {
  const SIG = useWords().glyph;
  const canRedeem = r.status === "affordable";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ls-panel)] text-lg">
        {rewardIcon(r.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--ls-ink)]">{r.titleEn}</div>
        <div className="text-xs text-[var(--ls-ink-muted)]">
          {r.signatureCost > 0 ? `${fmt(r.signatureCost)} ${SIG}` : "Level reward"}
          {r.lockedReason === "level" && r.minLevel ? ` · ${r.minLevel}+` : ""}
        </div>
      </div>
      {!compact &&
        (canRedeem ? (
          <button onClick={onRedeem} disabled={pending} className="rounded-lg bg-[var(--ls-accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {pending ? "…" : "Redeem"}
          </button>
        ) : r.lockedReason === "signatures" ? (
          <span className="rounded-lg bg-[var(--ls-panel)] px-3 py-1.5 text-xs font-medium text-[var(--ls-ink-soft)]">Locked</span>
        ) : r.lockedReason === "level" ? (
          <span className="text-lg">🔒</span>
        ) : (
          <span className="rounded-lg bg-[var(--ls-panel)] px-3 py-1.5 text-xs font-medium text-[var(--ls-ink-soft)]">—</span>
        ))}
    </div>
  );
}

function Privileges({ data }: { data: LoyaltySummary }) {
  return (
    <Section title="Your privileges">
      <div className="space-y-2">
        {data.privileges.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${p.unlocked ? "bg-[var(--ls-card)] ring-[var(--ls-line)]" : "bg-[var(--ls-panel)] ring-[var(--ls-line)]"}`}>
            <div className="text-xl">{p.unlocked ? "✧" : "🔒"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--ls-ink)]">{p.titleEn}</div>
              {p.descriptionEn && <div className="truncate text-xs text-[var(--ls-ink-muted)]">{p.descriptionEn}</div>}
            </div>
            {!p.unlocked && <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">{p.levelRequired}+</span>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Events({ data }: { data: LoyaltySummary }) {
  return (
    <Section title="Society events">
      {data.activeEvents.length === 0 ? (
        <Empty text="No events right now — check back soon." />
      ) : (
        <div className="space-y-2">
          {data.activeEvents.map((e) => (
            <div key={e.id} className="rounded-2xl bg-[var(--ls-card)] p-4 ring-1 ring-[var(--ls-line)]">
              <div className="flex items-center justify-between">
                <div className="font-serif text-lg text-[var(--ls-ink)]">{e.titleEn}</div>
                {e.multiplier > 1 && <span className="rounded-full bg-[var(--ls-accent)] px-2.5 py-1 text-xs font-bold text-white">×{e.multiplier}</span>}
              </div>
              {e.descriptionEn && <div className="mt-1 text-sm text-[var(--ls-ink-muted)]">{e.descriptionEn}</div>}
              <div className="mt-2 text-xs text-[var(--ls-ink-soft)]">Until {new Date(e.endDate).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Streak({ data }: { data: LoyaltySummary }) {
  const SIG = useWords().glyph;
  const s = data.streak;
  return (
    <Section title="Your society streak">
      <div className="rounded-3xl bg-[var(--ls-card)] p-5 ring-1 ring-[var(--ls-line)]">
        <div className="flex items-center justify-between">
          {s.months.map((m) => {
            const label = new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short" }).toUpperCase();
            return (
              <div key={m.month} className="flex flex-col items-center gap-1">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${m.qualified ? "bg-gradient-to-br from-[var(--ls-accent)] to-[var(--ls-accent-to)] text-white" : "bg-[var(--ls-panel)] text-[var(--ls-ink-soft)]"}`}>
                  {m.qualified ? SIG : "○"}
                </div>
                <div className="text-[10px] text-[var(--ls-ink-soft)]">{label}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--ls-line)] pt-4 text-center">
          <div className="flex-1">
            <div className="text-2xl font-bold text-[var(--ls-ink)]">{s.currentStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">Current</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-[var(--ls-ink)]">{s.longestStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">Longest</div>
          </div>
        </div>
        {s.nextMilestone && (
          <div className="mt-3 rounded-xl bg-[var(--ls-panel)] p-3 text-center text-sm text-[var(--ls-ink-muted)]">
            🔒 {s.nextMilestone.months}-month streak — {s.nextMilestone.titleEn}
          </div>
        )}
      </div>
    </Section>
  );
}

function Activity({ initial }: { initial: Transaction[] }) {
  const SIG = useWords().glyph;
  const [rows, setRows] = useState<Transaction[]>(initial);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  async function loadAll() {
    setBusy(true);
    const res = await getMyLoyaltyHistory(100);
    setBusy(false);
    if (res.ok) {
      setRows(res.data);
      setLoaded(true);
    }
  }
  return (
    <Section title="Your activity">
      <div className="space-y-1.5">
        {rows.map((t) => {
          const credit = t.direction !== "spend" && t.direction !== "expire";
          return (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-[var(--ls-card)] px-3 py-2.5 ring-1 ring-[var(--ls-line)]">
              <div className="min-w-0">
                <div className="truncate text-sm text-[var(--ls-ink)]">{t.description || labelFor(t.sourceType)}</div>
                <div className="text-[11px] text-[var(--ls-ink-soft)]">{new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <div className={`text-sm font-bold ${credit ? "text-[var(--ls-success)]" : "text-[var(--ls-accent)]"}`}>
                {credit ? "+" : "−"}{fmt(t.amount)} {SIG}
              </div>
            </div>
          );
        })}
      </div>
      {!loaded && (
        <button onClick={loadAll} disabled={busy} className="mt-3 w-full rounded-xl bg-[var(--ls-card)] py-2.5 text-sm font-medium text-[var(--ls-accent)] ring-1 ring-[var(--ls-line)]">
          {busy ? "Loading…" : "See full history"}
        </button>
      )}
      {rows.length === 0 && <Empty text="No signatures yet — place an order to start earning." />}
    </Section>
  );
}

function RevealModal({ reveal, onClose }: { reveal: { title: string; code: string | null; type: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-8 text-center text-[var(--ls-on-deep)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl">🎁</div>
        <div className="mt-4 text-[11px] tracking-[0.2em] text-[var(--ls-on-deep-soft)]">YOU UNLOCKED</div>
        <div className="mt-1 font-serif text-2xl">{reveal.title}</div>
        {reveal.code && <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm">{reveal.code}</div>}
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[var(--ls-gold)] py-3 text-sm font-semibold text-[var(--ls-deep)]">View reward</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-[var(--ls-card)] p-6 text-center text-sm text-[var(--ls-ink-soft)] ring-1 ring-[var(--ls-line)]">{text}</div>;
}

// ---- helpers ----------------------------------------------------------------
function rewardIcon(type: string): string {
  return { discount: "🏷️", delivery: "🚚", product: "🎁", access: "🔑", experience: "✨", signatures: "✦" }[type] ?? "★";
}
function labelFor(source: string): string {
  return (
    { order: "Order", review: "Product review", profile: "Profile completed", birthday: "Birthday bonus", event: "Event", streak: "Streak", vault: "Vault", reward: "Reward", category: "New category", admin: "Adjustment", signup: "Welcome" } as Record<string, string>
  )[source] ?? "Signatures";
}
function errorText(code: string): string {
  return (
    {
      insufficient_signatures: "Not enough signatures yet.",
      level_too_low: "This reward is for a higher level.",
      already_redeemed: "You've already claimed this.",
      reward_unavailable: "This reward is no longer available.",
      invalid_reward: "That reward can't be found.",
      vault_not_ready: "This vault isn't ready yet.",
      vault_already_opened: "You've already opened this vault.",
      not_your_vault: "That vault isn't yours.",
      not_signed_in: "Please sign in again.",
    } as Record<string, string>
  )[code] ?? "Something went wrong.";
}
