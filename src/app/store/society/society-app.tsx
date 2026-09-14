"use client";

import { useState, useTransition } from "react";
import { getMyLoyalty, redeemMyReward, openMyVault, getMyLoyaltyHistory } from "../loyalty-actions";
import type { LoyaltySummary, RewardView, Transaction, VaultView } from "@/lib/loyalty/types";

// A self-contained, mobile-shaped preview of the Beauty Bar Society so a
// customer can see every part of the loyalty system working end to end. Styling
// is deliberately standalone (the luxury brown/beige palette from the design) so
// it can be lifted into the real app shell later without depending on it.

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const SIG = "✦";

const TABS = [
  ["overview", "Society"],
  ["levels", "Levels"],
  ["vault", "Vault"],
  ["rewards", "Rewards"],
  ["privileges", "Privileges"],
  ["events", "Events"],
  ["streak", "Streak"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

type Toast = { text: string; tone: "ok" | "err" } | null;

export default function SocietyApp({ summary }: { summary: LoyaltySummary }) {
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

  return (
    <div className="min-h-screen bg-[#f4ece1] text-[#4a3524]">
      <div className="mx-auto max-w-md px-4 pb-24 pt-8">
        {/* Brand header */}
        <div className="text-center">
          <div className="text-xs font-semibold tracking-[0.35em] text-[#8a6e57]">BEAUTY BAR</div>
          <h1 className="font-serif text-3xl tracking-wide text-[#3b2a1e]">SOCIETY</h1>
          <p className="mt-1 text-xs text-[#a0876d]">Collect Signatures. Unlock Privileges.</p>
        </div>

        {/* Status card */}
        <div className="mt-6 rounded-3xl bg-[#fffaf3] p-6 shadow-sm ring-1 ring-[#e7d8c4]">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-[#a0876d]">YOUR STATUS</div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="font-serif text-2xl text-[#3b2a1e]">{p.currentLevelName} {SIG}</div>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-4xl font-bold text-[#3b2a1e]">{fmt(data.user.signatureBalance)}</div>
            <div className="pb-1 text-sm text-[#8a6e57]">signatures</div>
          </div>

          {p.nextLevel ? (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#ece0cf]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#8a5a2b] to-[#c79a5b]" style={{ width: `${p.percentage}%` }} />
              </div>
              <div className="mt-2 text-xs text-[#8a6e57]">
                {fmt(p.remaining ?? 0)} signatures until {p.nextLevelName}
              </div>
            </>
          ) : (
            <div className="mt-4 text-xs font-medium text-[#8a5a2b]">You&apos;ve reached the highest level. ✦</div>
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
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key ? "bg-[#8a5a2b] text-white" : "bg-[#fffaf3] text-[#8a6e57] ring-1 ring-[#e7d8c4]"
                }`}
              >
                {label}
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
          <div className={`rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === "ok" ? "bg-[#3b2a1e]" : "bg-rose-600"}`}>
            {toast.text}
          </div>
        </div>
      )}

      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

// ---- Building blocks --------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6ede0] py-2">
      <div className="text-lg font-bold text-[#3b2a1e]">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[#a0876d]">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-serif text-xl text-[#3b2a1e]">{title}</h2>
      {children}
    </div>
  );
}

function VaultTeaser({ vault, onOpen, pending }: { vault: VaultView; onOpen: () => void; pending: boolean }) {
  const ready = vault.status === "ready_to_open";
  return (
    <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b2119] to-[#43301f] p-5 text-[#f0e6d8]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.2em] text-[#c9b79f]">YOUR VAULT</div>
          <div className="mt-0.5 font-serif text-lg">{vault.titleEn}</div>
        </div>
        <div className="text-3xl">{vault.icon ?? "🎁"}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: vault.requiredProgress }).map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < vault.currentProgress ? "bg-[#e0b877]" : "bg-white/15"}`} />
        ))}
      </div>
      <div className="mt-2 text-xs text-[#c9b79f]">
        {ready ? "Your reward is ready." : `${vault.requiredProgress - vault.currentProgress} more to unlock your reward.`}
      </div>
      {ready ? (
        <button onClick={onOpen} disabled={pending} className="mt-4 w-full rounded-xl bg-[#e0b877] py-3 text-sm font-semibold text-[#2b2119] disabled:opacity-60">
          {pending ? "Opening…" : "Open the Vault"}
        </button>
      ) : (
        <div className="mt-4 w-full rounded-xl bg-white/10 py-3 text-center text-sm font-medium text-[#c9b79f]">
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
              <div key={p.id} className="rounded-2xl bg-[#fffaf3] p-3 text-center ring-1 ring-[#e7d8c4]">
                <div className="text-xl">✧</div>
                <div className="mt-1 text-[11px] font-medium leading-tight text-[#5b4635]">{p.titleEn}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => onGoto("privileges")} className="mt-2 text-xs font-semibold text-[#8a5a2b]">View all privileges →</button>
      </Section>

      <Section title="Rewards for you">
        <div className="space-y-2">
          {data.availableRewards.slice(0, 3).map((r) => (
            <RewardRow key={r.id} r={r} onRedeem={() => onGoto("rewards")} pending={false} compact />
          ))}
        </div>
        <button onClick={() => onGoto("rewards")} className="mt-2 text-xs font-semibold text-[#8a5a2b]">See all rewards →</button>
      </Section>

      {data.activeEvents.length > 0 && (
        <Section title="Happening now">
          {data.activeEvents.map((e) => (
            <div key={e.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-[#fffaf3] p-3 ring-1 ring-[#e7d8c4]">
              <div className="text-xl">✦</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#3b2a1e]">{e.titleEn}</div>
                <div className="truncate text-xs text-[#8a6e57]">{e.descriptionEn}</div>
              </div>
              {e.multiplier > 1 && <div className="rounded-full bg-[#8a5a2b] px-2 py-0.5 text-xs font-bold text-white">×{e.multiplier}</div>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Levels({ data }: { data: LoyaltySummary }) {
  const cur = data.levels.find((l) => l.key === data.user.currentLevel);
  const curSort = cur?.sort ?? 1;
  return (
    <Section title="The Levels">
      <div className="space-y-2">
        {data.levels.map((l) => {
          const reached = l.sort <= curSort;
          const current = l.key === data.user.currentLevel;
          return (
            <div key={l.key} className={`rounded-2xl p-4 ring-1 ${current ? "bg-gradient-to-br from-[#8a5a2b] to-[#b98a4b] text-white ring-transparent" : reached ? "bg-[#fffaf3] ring-[#e7d8c4]" : "bg-[#f6ede0] ring-[#ece0cf]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[11px] tracking-widest ${current ? "text-white/70" : "text-[#a0876d]"}`}>0{l.sort}</div>
                  <div className={`font-serif text-lg ${current ? "text-white" : "text-[#3b2a1e]"}`}>{l.nameEn}</div>
                  {l.taglineEn && <div className={`text-xs ${current ? "text-white/80" : "text-[#8a6e57]"}`}>{l.taglineEn}</div>}
                </div>
                <div className={`text-right ${current ? "text-white" : "text-[#5b4635]"}`}>
                  <div className="text-lg font-bold">{fmt(l.threshold)}</div>
                  <div className="text-[10px] uppercase tracking-wide opacity-70">{reached ? "reached" : "signatures"}</div>
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
          <div key={v.id} className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b2119] to-[#43301f] p-5 text-[#f0e6d8]">
            <div className="flex items-center justify-between">
              <div className="font-serif text-lg">{v.titleEn}</div>
              <div className="text-2xl">{v.icon ?? "🎁"}</div>
            </div>
            {v.descriptionEn && <div className="mt-0.5 text-xs text-[#c9b79f]">{v.descriptionEn}</div>}
            {v.locked ? (
              <div className="mt-4 rounded-xl bg-white/10 py-3 text-center text-sm text-[#c9b79f]">
                🔒 Unlocks at {v.levelRequired}
              </div>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-1.5">
                  {Array.from({ length: v.requiredProgress }).map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < v.currentProgress ? "bg-[#e0b877]" : "bg-white/15"}`} />
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#c9b79f]">{v.currentProgress} / {v.requiredProgress}</div>
                {v.status === "ready_to_open" ? (
                  <button onClick={() => onOpen(v)} disabled={pending} className="mt-3 w-full rounded-xl bg-[#e0b877] py-2.5 text-sm font-semibold text-[#2b2119] disabled:opacity-60">
                    {pending ? "Opening…" : "Open now"}
                  </button>
                ) : v.status === "opened" ? (
                  <div className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-center text-sm text-[#c9b79f]">Opened ✓</div>
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
              <div key={r.id} className="flex items-center justify-between rounded-2xl bg-[#fffaf3] p-3 ring-1 ring-[#e7d8c4]">
                <div>
                  <div className="text-sm font-medium text-[#3b2a1e]">{r.title}</div>
                  {r.code && <div className="text-xs font-mono text-[#8a5a2b]">{r.code}</div>}
                </div>
                <span className="rounded-full bg-[#f6ede0] px-2.5 py-1 text-[11px] font-medium capitalize text-[#8a6e57]">{r.status}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function RewardRow({ r, onRedeem, pending, compact }: { r: RewardView; onRedeem: () => void; pending: boolean; compact?: boolean }) {
  const canRedeem = r.status === "affordable";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#fffaf3] p-3 ring-1 ring-[#e7d8c4]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0e2cf] text-lg">
        {rewardIcon(r.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#3b2a1e]">{r.titleEn}</div>
        <div className="text-xs text-[#8a6e57]">
          {r.signatureCost > 0 ? `${fmt(r.signatureCost)} ${SIG}` : "Level reward"}
          {r.lockedReason === "level" && r.minLevel ? ` · ${r.minLevel}+` : ""}
        </div>
      </div>
      {!compact &&
        (canRedeem ? (
          <button onClick={onRedeem} disabled={pending} className="rounded-lg bg-[#8a5a2b] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {pending ? "…" : "Redeem"}
          </button>
        ) : r.lockedReason === "signatures" ? (
          <span className="rounded-lg bg-[#f6ede0] px-3 py-1.5 text-xs font-medium text-[#a0876d]">Locked</span>
        ) : r.lockedReason === "level" ? (
          <span className="text-lg">🔒</span>
        ) : (
          <span className="rounded-lg bg-[#f6ede0] px-3 py-1.5 text-xs font-medium text-[#a0876d]">—</span>
        ))}
    </div>
  );
}

function Privileges({ data }: { data: LoyaltySummary }) {
  return (
    <Section title="Your privileges">
      <div className="space-y-2">
        {data.privileges.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${p.unlocked ? "bg-[#fffaf3] ring-[#e7d8c4]" : "bg-[#f6ede0] ring-[#ece0cf]"}`}>
            <div className="text-xl">{p.unlocked ? "✧" : "🔒"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#3b2a1e]">{p.titleEn}</div>
              {p.descriptionEn && <div className="truncate text-xs text-[#8a6e57]">{p.descriptionEn}</div>}
            </div>
            {!p.unlocked && <span className="text-[11px] font-medium text-[#a0876d]">{p.levelRequired}+</span>}
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
            <div key={e.id} className="rounded-2xl bg-[#fffaf3] p-4 ring-1 ring-[#e7d8c4]">
              <div className="flex items-center justify-between">
                <div className="font-serif text-lg text-[#3b2a1e]">{e.titleEn}</div>
                {e.multiplier > 1 && <span className="rounded-full bg-[#8a5a2b] px-2.5 py-1 text-xs font-bold text-white">×{e.multiplier}</span>}
              </div>
              {e.descriptionEn && <div className="mt-1 text-sm text-[#8a6e57]">{e.descriptionEn}</div>}
              <div className="mt-2 text-xs text-[#a0876d]">Until {new Date(e.endDate).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Streak({ data }: { data: LoyaltySummary }) {
  const s = data.streak;
  return (
    <Section title="Your society streak">
      <div className="rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e7d8c4]">
        <div className="flex items-center justify-between">
          {s.months.map((m) => {
            const label = new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short" }).toUpperCase();
            return (
              <div key={m.month} className="flex flex-col items-center gap-1">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${m.qualified ? "bg-gradient-to-br from-[#8a5a2b] to-[#c79a5b] text-white" : "bg-[#f0e2cf] text-[#c2ab90]"}`}>
                  {m.qualified ? SIG : "○"}
                </div>
                <div className="text-[10px] text-[#a0876d]">{label}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#efe2d1] pt-4 text-center">
          <div className="flex-1">
            <div className="text-2xl font-bold text-[#3b2a1e]">{s.currentStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#a0876d]">Current</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-[#3b2a1e]">{s.longestStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#a0876d]">Longest</div>
          </div>
        </div>
        {s.nextMilestone && (
          <div className="mt-3 rounded-xl bg-[#f6ede0] p-3 text-center text-sm text-[#5b4635]">
            🔒 {s.nextMilestone.months}-month streak — {s.nextMilestone.titleEn}
          </div>
        )}
      </div>
    </Section>
  );
}

function Activity({ initial }: { initial: Transaction[] }) {
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
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-[#fffaf3] px-3 py-2.5 ring-1 ring-[#e7d8c4]">
              <div className="min-w-0">
                <div className="truncate text-sm text-[#3b2a1e]">{t.description || labelFor(t.sourceType)}</div>
                <div className="text-[11px] text-[#a0876d]">{new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <div className={`text-sm font-bold ${credit ? "text-[#2f7d4f]" : "text-[#b0603a]"}`}>
                {credit ? "+" : "−"}{fmt(t.amount)} {SIG}
              </div>
            </div>
          );
        })}
      </div>
      {!loaded && (
        <button onClick={loadAll} disabled={busy} className="mt-3 w-full rounded-xl bg-[#fffaf3] py-2.5 text-sm font-medium text-[#8a5a2b] ring-1 ring-[#e7d8c4]">
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
      <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-[#2b2119] to-[#43301f] p-8 text-center text-[#f0e6d8]" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl">🎁</div>
        <div className="mt-4 text-[11px] tracking-[0.2em] text-[#c9b79f]">YOU UNLOCKED</div>
        <div className="mt-1 font-serif text-2xl">{reveal.title}</div>
        {reveal.code && <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm">{reveal.code}</div>}
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[#e0b877] py-3 text-sm font-semibold text-[#2b2119]">View reward</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-[#fffaf3] p-6 text-center text-sm text-[#a0876d] ring-1 ring-[#e7d8c4]">{text}</div>;
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
