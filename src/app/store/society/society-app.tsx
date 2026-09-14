"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { getMyLoyalty, redeemMyReward, openMyVault, getMyLoyaltyHistory } from "../loyalty-actions";
import type { LoyaltySummary, RewardView, Transaction, VaultView } from "@/lib/loyalty/types";
import {
  DEFAULT_LOYALTY_THEME,
  loyaltyVars,
  sectionText,
  tabLabel,
  headingClass,
  type LoyaltyTheme,
  type SectionScope,
} from "@/lib/loyalty/theme";

const ThemeContext = createContext<LoyaltyTheme>(DEFAULT_LOYALTY_THEME);
/** The merchant's wording, wherever in the hub you are. */
const useWords = () => useContext(ThemeContext).words;

/** The shape of things, straight from the theme. */
const useDesign = () => useContext(ThemeContext).design;

/** The display face and the capitals the design sets its headings in. */
function useHeading() {
  const theme = useContext(ThemeContext);
  return {
    face: headingClass(theme),
    caps: theme.design.headingUppercase ? "uppercase tracking-[0.14em]" : "",
  };
}

/**
 * One section's wording.
 *
 * Returns a reader rather than an object so a component names the field it
 * wants at the point it draws it - t("title") reads as the heading, and a
 * field nobody has set falls back to the word the page shipped with.
 */
function useText(scope: SectionScope) {
  const theme = useContext(ThemeContext);
  return (key: string) => sectionText(theme, scope, key);
}

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
  preview = false,
}: {
  summary: LoyaltySummary;
  theme?: LoyaltyTheme;
  /**
   * Draw the screens without letting anything happen.
   *
   * The dashboard renders this hub to show the merchant their own design,
   * against a shopper who does not exist. Redeeming a reward for them would
   * reach a server action and fail, so in preview the buttons are there to
   * be looked at and do nothing when pressed.
   */
  preview?: boolean;
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
    if (preview) return;
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
    if (preview || !v.userVaultId) return;
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
  const shared = (key: string) => sectionText(theme, "shared", key);

  return (
    <ThemeContext.Provider value={theme}>
    <div
      dir={theme.design.direction}
      className={`${preview ? "" : "min-h-screen"} bg-[var(--ls-page)] text-[var(--ls-ink)]`}
      style={loyaltyVars(theme) as React.CSSProperties}
    >
      <div className={`mx-auto max-w-md px-4 ${preview ? "pb-6 pt-6" : "pb-24 pt-8"}`}>
        {/* Brand header */}
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--ls-ink-muted)]">
            {w.brandLine}
          </div>
          <h1
            className={`mt-1 text-[34px] leading-none tracking-[0.12em] text-[var(--ls-ink)] ${headingClass(theme)} ${
              theme.design.headingUppercase ? "uppercase" : ""
            }`}
          >
            {w.title}
          </h1>
          <p className="mt-2 text-xs text-[var(--ls-ink-soft)]">{w.tagline}</p>
        </div>

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
          {tab === "overview" && (
            <Overview
              data={data}
              onGoto={setTab}
              onOpenVault={onOpenVault}
              pending={pending}
            />
          )}
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
/**
 * The levels as a row of marks, the way the design shows them.
 *
 * One mark per level, filled up to the one the shopper has reached. It says
 * the same thing a progress bar does and says it in the language of the
 * rest of the page, which is circles and signatures rather than bars.
 */
function LevelDots({ data }: { data: LoyaltySummary }) {
  const reachedAt = data.levels.findIndex((l) => l.key === data.progress.currentLevel);
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {data.levels.map((l, i) => (
        <span
          key={l.key}
          title={l.nameEn}
          className="h-3.5 w-3.5 rounded-full"
          style={{
            background:
              i <= reachedAt
                ? "var(--ls-accent)"
                : "transparent",
            boxShadow: i <= reachedAt ? "none" : "inset 0 0 0 1px var(--ls-line)",
          }}
        />
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--ls-panel)] py-2">
      <div className="text-lg font-bold text-[var(--ls-ink)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">{label}</div>
    </div>
  );
}

/**
 * A heading and what sits under it.
 *
 * It reads the display face and the capitals from the theme rather than
 * hard-coding a serif, so a heading written here and one written in a screen
 * that draws its own cannot drift apart.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const h = useHeading();
  return (
    <div>
      <h2 className={`mb-3 text-xl text-[var(--ls-ink)] ${h.face} ${h.caps}`}>{title}</h2>
      {children}
    </div>
  );
}

function VaultTeaser({ vault, onOpen, pending }: { vault: VaultView; onOpen: () => void; pending: boolean }) {
  const t = useText("vault");
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
        {ready ? t("readyText") : `${vault.requiredProgress - vault.currentProgress} more to unlock your reward.`}
      </div>
      {ready ? (
        <button onClick={onOpen} disabled={pending} className="mt-4 w-full rounded-xl bg-[var(--ls-gold)] py-3 text-sm font-semibold text-[var(--ls-deep)] disabled:opacity-60">
          {pending ? t("openingLabel") : t("openCta")}
        </button>
      ) : (
        <div className="mt-4 w-full rounded-xl bg-white/10 py-3 text-center text-sm font-medium text-[var(--ls-on-deep-soft)]">
          {vault.currentProgress} / {vault.requiredProgress}
        </div>
      )}
    </div>
  );
}

/**
 * Where the shopper stands, as the design leads with it.
 *
 * A level, a row of marks for the ladder, the count against the next rung,
 * and the one button that explains the whole programme. The three totals sit
 * under it because a shopper who wants the number wants it here, not two
 * screens away.
 */
function StatusCard({
  data,
  onLevels,
}: {
  data: LoyaltySummary;
  onLevels: () => void;
}) {
  const theme = useContext(ThemeContext);
  const w = theme.words;
  const SIG = w.glyph;
  const shared = (key: string) => sectionText(theme, "shared", key);
  const p = data.progress;

  return (
      <div className="mt-6 bg-[var(--ls-card)] p-6 shadow-sm ring-1 ring-[var(--ls-line)]" style={{ borderRadius: "var(--ls-radius)" }}>
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--ls-ink-soft)]">{w.statusLabel}</div>
        <div
          className={`mt-1 text-2xl text-[var(--ls-ink)] ${headingClass(theme)} ${
            theme.design.headingUppercase ? "uppercase tracking-[0.12em]" : ""
          }`}
        >
          {p.currentLevelName} {SIG}
        </div>

        {/* The row of marks the design uses instead of a bar. */}
        <LevelDots data={data} />

        <div className="mt-3 text-xl font-semibold text-[var(--ls-ink)]">
          {fmt(data.user.signatureBalance)}
          {p.required ? (
            <span className="text-[var(--ls-ink-soft)]"> / {fmt(p.required)}</span>
          ) : null}{" "}
          <span className="text-[var(--ls-accent)]">{SIG}</span>
        </div>

        {p.nextLevel ? (
          <div className="mt-1 text-xs text-[var(--ls-ink-muted)]">
            {fmt(p.remaining ?? 0)} {w.pointsWord} until {p.nextLevelName}
          </div>
        ) : (
          <div className="mt-1 text-xs font-medium text-[var(--ls-accent)]">
            {shared("topLevelText")} {SIG}
          </div>
        )}


        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Metric label={shared("balanceLabel")} value={fmt(data.user.signatureBalance)} />
          <Metric label={shared("lifetimeLabel")} value={fmt(data.user.lifetimeEarned)} />
          <Metric label={shared("streakLabel")} value={String(data.streak.currentStreak)} />
        </div>

        <button
          onClick={() => onLevels()}
          className="mt-5 w-full bg-[var(--ls-accent)] py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white"
          style={{ borderRadius: "var(--ls-button-radius)" }}
        >
          {shared("viewLevelsCta")}
        </button>
      </div>
  );
}
/**
 * The first screen, in the order the merchant arranged it.
 *
 * Every piece is optional and every piece can move, because which of these a
 * shopper should meet first is a question about the programme rather than
 * about the code: a store whose vault is the draw wants it above the status,
 * and a store with no events wants that gap gone.
 */
function Overview({
  data,
  onGoto,
  onOpenVault,
  pending,
}: {
  data: LoyaltySummary;
  onGoto: (t: Tab) => void;
  onOpenVault: (v: VaultView) => void;
  pending: boolean;
}) {
  const theme = useContext(ThemeContext);
  const t = useText("overview");
  const d = useDesign();
  const w = useWords();
  const priv = data.privileges.filter((x) => x.unlocked).slice(0, d.privilegeColumns);

  const block = (key: string) => {
    switch (key) {
      case "status":
        return <StatusCard data={data} onLevels={() => onGoto("levels")} />;
      case "vault":
        return data.primaryVault && !data.primaryVault.locked ? (
          <VaultTeaser
            vault={data.primaryVault}
            onOpen={() => onOpenVault(data.primaryVault!)}
            pending={pending}
          />
        ) : null;
      case "privileges":
        return (
          <Section title={t("privilegesTitle")}>
            {priv.length === 0 ? (
              <Empty text={t("privilegesEmpty")} />
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${d.privilegeColumns}, minmax(0, 1fr))` }}
              >
                {priv.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[var(--ls-card)] p-3 text-center ring-1 ring-[var(--ls-line)]"
                    style={{ borderRadius: "var(--ls-radius)" }}
                  >
                    <div className="text-lg text-[var(--ls-accent)]">{w.glyph}</div>
                    <div className="mt-1 text-[11px] font-medium leading-tight text-[var(--ls-ink)]">
                      {p.titleEn}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onGoto("privileges")}
              className="mt-2 text-xs font-semibold text-[var(--ls-accent)]"
            >
              {t("privilegesLink")}
            </button>
          </Section>
        );
      case "rewards":
        return (
          <Section title={t("rewardsTitle")}>
            <div className="space-y-2">
              {data.availableRewards.slice(0, 3).map((r) => (
                <RewardRow
                  key={r.id}
                  r={r}
                  onRedeem={() => onGoto("rewards")}
                  pending={false}
                  compact
                />
              ))}
            </div>
            <button
              onClick={() => onGoto("rewards")}
              className="mt-2 text-xs font-semibold text-[var(--ls-accent)]"
            >
              {t("rewardsLink")}
            </button>
          </Section>
        );
      default:
        return data.activeEvents.length > 0 ? (
          <Section title={t("eventsTitle")}>
            <div className="space-y-2">
              {data.activeEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]"
                  style={{ borderRadius: "var(--ls-radius)" }}
                >
                  <div className="text-xl text-[var(--ls-accent)]">{w.glyph}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--ls-ink)]">{e.titleEn}</div>
                    <div className="truncate text-xs text-[var(--ls-ink-muted)]">
                      {e.descriptionEn}
                    </div>
                  </div>
                  {e.multiplier > 1 && (
                    <span
                      className="shrink-0 px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: "var(--ls-accent)", borderRadius: "var(--ls-button-radius)" }}
                    >
                      ×{e.multiplier}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : null;
    }
  };

  return (
    <div className="space-y-5">
      {theme.overview
        .filter((o) => o.visible)
        .map((o) => (
          <div key={o.key}>{block(o.key)}</div>
        ))}
    </div>
  );
}
function Levels({ data }: { data: LoyaltySummary }) {
  const w = useWords();
  const t = useText("levels");
  const d = useDesign();
  const h = useHeading();
  const cur = data.levels.find((l) => l.key === data.user.currentLevel);
  const curSort = cur?.sort ?? 1;
  const last = Math.max(1, data.levels.length - 1);

  return (
    <Section title={t("title")}>
      <div className="space-y-2.5">
        {data.levels.map((l, i) => {
          const reached = l.sort <= curSort;
          const current = l.key === data.user.currentLevel;
          // How far down the flight this card sits, 0 to 1.
          const depth = d.levelGradient ? i / last : 0;
          const mix = Math.round(depth * 100);
          const dark = depth > 0.45;
          return (
            <div
              key={l.key}
              className="p-4"
              style={{
                borderRadius: "var(--ls-radius)",
                background: d.levelGradient
                  ? `linear-gradient(135deg, color-mix(in srgb, var(--ls-deep) ${mix}%, var(--ls-card)), color-mix(in srgb, var(--ls-deep) ${Math.min(100, mix + 12)}%, var(--ls-card)))`
                  : reached
                    ? "var(--ls-card)"
                    : "var(--ls-panel)",
                boxShadow: dark ? "none" : "inset 0 0 0 1px var(--ls-line)",
                color: dark ? "var(--ls-on-deep)" : "var(--ls-ink)",
              }}
            >
              <div className="flex items-start gap-3">
                {d.levelNumerals && (
                  <div
                    className={`${h.face} shrink-0 text-2xl italic leading-none`}
                    style={{ opacity: dark ? 0.6 : 0.35 }}
                  >
                    {String(l.sort).padStart(2, "0")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`${h.face} ${h.caps} text-base`}>{l.nameEn}</div>
                  {l.taglineEn && (
                    <div
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ opacity: 0.72 }}
                    >
                      {l.taglineEn}
                    </div>
                  )}
                  <div className="mt-2 text-sm font-semibold">
                    {fmt(l.threshold)}{" "}
                    <span style={{ color: dark ? "var(--ls-gold)" : "var(--ls-accent)" }}>
                      {w.glyph}
                    </span>
                  </div>
                </div>
                {/* The mark on the right: filled once the level is reached. */}
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px]"
                  title={reached ? t("reachedLabel") : w.pointsWord}
                  style={{
                    background: reached ? (dark ? "var(--ls-gold)" : "var(--ls-accent)") : "transparent",
                    color: reached ? (dark ? "var(--ls-deep)" : "#fff") : "inherit",
                    boxShadow: reached ? "none" : `inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.35)" : "var(--ls-line)"}`,
                  }}
                >
                  {current ? w.glyph : reached ? "✓" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
/**
 * The vault, as the design stages it.
 *
 * One dark panel for the vault in hand — its own marks, its own countdown, its
 * own button — and then the rest as a quiet list beneath. The design leads with
 * the one the shopper can actually do something about rather than showing four
 * equal cards and leaving them to work out which one matters.
 */
function Vaults({ data, onOpen, pending }: { data: LoyaltySummary; onOpen: (v: VaultView) => void; pending: boolean }) {
  const t = useText("vault");
  const d = useDesign();
  const h = useHeading();
  const w = useWords();
  const hero = data.vaults.find((v) => !v.locked) ?? data.vaults[0];
  const rest = data.vaults.filter((v) => v.id !== hero?.id);

  return (
    <div className="space-y-5">
      {hero && (
        <div
          className="relative overflow-hidden p-6 text-[var(--ls-on-deep)]"
          style={{
            borderRadius: "var(--ls-radius)",
            background: d.vaultHeroImage
              ? `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url(${d.vaultHeroImage}) center/cover`
              : "linear-gradient(150deg, var(--ls-deep), var(--ls-deep-to))",
          }}
        >
          <div className="text-center">
            <div className="text-3xl">{hero.icon ?? "🎁"}</div>
            <div className={`mt-3 text-2xl ${h.face} ${h.caps}`}>{t("title")}</div>
            <div className="mt-1 text-xs text-[var(--ls-on-deep-soft)]">{t("subtitle")}</div>
          </div>

          {/* One mark per step, the way the design counts them. */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {Array.from({ length: hero.requiredProgress }).map((_, i) => (
              <span
                key={i}
                className="text-sm"
                style={{
                  color: i < hero.currentProgress ? "var(--ls-gold)" : "rgba(255,255,255,0.28)",
                }}
              >
                {w.glyph}
              </span>
            ))}
          </div>
          <div className="mt-3 text-center text-sm font-semibold">
            {hero.currentProgress} / {hero.requiredProgress}
          </div>
          {hero.currentProgress < hero.requiredProgress && (
            <div className="mt-1 text-center text-xs text-[var(--ls-on-deep-soft)]">
              {hero.requiredProgress - hero.currentProgress} {t("remainingText")}
            </div>
          )}

          {hero.status === "ready_to_open" ? (
            <button
              onClick={() => onOpen(hero)}
              disabled={pending}
              className="mt-5 w-full bg-[var(--ls-accent)] py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
              style={{ borderRadius: "var(--ls-button-radius)" }}
            >
              {pending ? t("openingLabel") : t("openCta")}
            </button>
          ) : hero.status === "opened" ? (
            <div
              className="mt-5 w-full bg-white/10 py-3 text-center text-xs uppercase tracking-[0.18em] text-[var(--ls-on-deep-soft)]"
              style={{ borderRadius: "var(--ls-button-radius)" }}
            >
              {t("openedLabel")}
            </div>
          ) : null}
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ls-ink-soft)]">
            {t("collectionsTitle")}
          </div>
          <div className="mt-2 space-y-2">
            {rest.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]"
                style={{ borderRadius: "var(--ls-radius)", opacity: v.locked ? 0.6 : 1 }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ls-panel)] text-lg">
                  {v.locked ? "🔒" : v.icon ?? "🎁"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${h.face} text-[var(--ls-ink)]`}>{v.titleEn}</span>
                  <span className="block truncate text-xs text-[var(--ls-ink-muted)]">
                    {v.locked ? `${t("lockedPrefix")} ${v.levelRequired}` : v.descriptionEn}
                  </span>
                </span>
                <span className="shrink-0 text-[var(--ls-ink-soft)]">→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
/**
 * The rewards, sorted by what the shopper can do about them.
 *
 * The design splits them across filters rather than mixing affordable rewards
 * in with ones three levels away: a list where most rows cannot be pressed
 * reads as a wall, and the one reward they could claim today gets lost in it.
 */
function Rewards({ data, onRedeem, pending }: { data: LoyaltySummary; onRedeem: (r: RewardView) => void; pending: boolean }) {
  const t = useText("rewards");
  const h = useHeading();
  const [filter, setFilter] = useState<"available" | "locked" | "all">("available");

  const shown = data.availableRewards.filter((r) =>
    filter === "all" ? true : filter === "available" ? r.status !== "locked" : r.status === "locked",
  );

  const filters: { key: "available" | "locked" | "all"; label: string }[] = [
    { key: "available", label: t("filterAvailable") },
    { key: "locked", label: t("filterLocked") },
    { key: "all", label: t("filterAll") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className={`text-xl ${h.face} ${h.caps} text-[var(--ls-ink)]`}>{t("title")}</div>

        <div className="mt-3 flex gap-4 border-b border-[var(--ls-line)]">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition"
              style={{
                color: filter === f.key ? "var(--ls-ink)" : "var(--ls-ink-soft)",
                borderBottom: filter === f.key ? "2px solid var(--ls-ink)" : "2px solid transparent",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {shown.map((r) => (
            <RewardRow key={r.id} r={r} onRedeem={() => onRedeem(r)} pending={pending} />
          ))}
          {shown.length === 0 && <Empty text={t("lockedLabel")} />}
        </div>
      </div>

      {data.myRewards.length > 0 && (
        <Section title={t("claimedTitle")}>
          <div className="space-y-2">
            {data.myRewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]"
                style={{ borderRadius: "var(--ls-radius)" }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--ls-ink)]">{r.title}</span>
                  {r.code && (
                    <span className="block font-mono text-[11px] text-[var(--ls-ink-muted)]">{r.code}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--ls-ink-soft)]">
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
/** One reward: a picture, what it is, and the one thing to do with it. */
function RewardRow({ r, onRedeem, pending, compact }: { r: RewardView; onRedeem: () => void; pending: boolean; compact?: boolean }) {
  const SIG = useWords().glyph;
  const t = useText("rewards");
  const d = useDesign();
  const canRedeem = r.status === "affordable" || r.status === "available";

  return (
    <div
      className="flex items-center gap-3 bg-[var(--ls-card)] p-3 ring-1 ring-[var(--ls-line)]"
      style={{ borderRadius: "var(--ls-radius)", opacity: r.status === "locked" ? 0.65 : 1 }}
    >
      {d.rewardThumbs &&
        (r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image}
            alt=""
            className="h-12 w-12 shrink-0 object-cover"
            style={{ borderRadius: "calc(var(--ls-radius) * 0.5)" }}
          />
        ) : (
          <span
            className="grid h-12 w-12 shrink-0 place-items-center bg-[var(--ls-panel)] text-lg"
            style={{ borderRadius: "calc(var(--ls-radius) * 0.5)" }}
          >
            {rewardIcon(r.type, SIG)}
          </span>
        ))}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--ls-ink)]">{r.titleEn}</div>
        <div className="truncate text-xs text-[var(--ls-ink-muted)]">
          {r.descriptionEn}
          {r.descriptionEn && (r.signatureCost > 0 || r.minLevel) ? " · " : ""}
          {r.signatureCost > 0 ? (
            <span className="font-medium text-[var(--ls-ink)]">
              {fmt(r.signatureCost)} {SIG}
            </span>
          ) : !r.descriptionEn ? (
            t("levelRewardLabel")
          ) : null}
          {r.lockedReason === "level" && r.minLevel ? ` · ${r.minLevel}+` : ""}
        </div>
      </div>

      {!compact &&
        (canRedeem ? (
          <button
            onClick={onRedeem}
            disabled={pending}
            className="shrink-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-60"
            style={{ background: "var(--ls-accent)", borderRadius: "var(--ls-button-radius)" }}
          >
            {pending ? "…" : t("redeemCta")}
          </button>
        ) : r.lockedReason === "level" ? (
          <span className="shrink-0 text-lg">🔒</span>
        ) : (
          <span
            className="shrink-0 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--ls-ink-soft)]"
            style={{ background: "var(--ls-panel)", borderRadius: "var(--ls-button-radius)" }}
          >
            {t("lockedLabel")}
          </span>
        ))}
    </div>
  );
}
/**
 * The privileges, as the grid of small tiles the design uses.
 *
 * How many sit in a row is the merchant's: three reads as a set of perks,
 * two reads as a short list of important ones, and four fits a long programme.
 */
function Privileges({ data }: { data: LoyaltySummary }) {
  const t = useText("privileges");
  const d = useDesign();
  const w = useWords();

  return (
    <Section title={t("title")}>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${d.privilegeColumns}, minmax(0, 1fr))` }}
      >
        {data.privileges.map((p) => (
          <div
            key={p.id}
            className="bg-[var(--ls-card)] p-3 text-center ring-1 ring-[var(--ls-line)]"
            style={{ borderRadius: "var(--ls-radius)", opacity: p.unlocked ? 1 : 0.6 }}
          >
            <div className="text-lg" style={{ color: p.unlocked ? "var(--ls-accent)" : "var(--ls-ink-soft)" }}>
              {p.unlocked ? w.glyph : "🔒"}
            </div>
            <div className="mt-1.5 text-[11px] font-medium leading-tight text-[var(--ls-ink)]">
              {p.titleEn}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-[var(--ls-ink-soft)]">
              {p.unlocked
                ? p.descriptionEn
                : t("lockedNote").replace("{level}", String(p.levelRequired))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
/**
 * The events, as the design's row of moments.
 *
 * A dark tile carrying the kind of thing it is, then the name and the promise.
 * The multiplier is the loudest thing on the card because it is the reason to
 * read the rest of it.
 */
function Events({ data }: { data: LoyaltySummary }) {
  const t = useText("events");
  const h = useHeading();

  const w = useWords();
  const kind: Record<string, string> = {
    multiplier: w.glyph,
    offer: "🏷️",
    drop: "🎁",
    moment: "🕐",
  };

  return (
    <div>
      <div className={`text-xl ${h.face} ${h.caps} text-[var(--ls-ink)]`}>{t("title")}</div>
      <div className="mt-1 text-xs text-[var(--ls-ink-soft)]">{t("subtitle")}</div>

      {data.activeEvents.length === 0 ? (
        <div className="mt-3">
          <Empty text={t("empty")} />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {data.activeEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-stretch gap-3 overflow-hidden bg-[var(--ls-card)] ring-1 ring-[var(--ls-line)]"
              style={{ borderRadius: "var(--ls-radius)" }}
            >
              <span
                className="grid w-20 shrink-0 place-items-center text-2xl text-[var(--ls-gold)]"
                style={{ background: "linear-gradient(150deg, var(--ls-deep), var(--ls-deep-to))" }}
              >
                {kind[e.eventType] ?? w.glyph}
              </span>
              <span className="min-w-0 flex-1 py-3 pe-3">
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${h.face} text-[var(--ls-ink)]`}>{e.titleEn}</span>
                  {e.multiplier > 1 && (
                    <span
                      className="shrink-0 px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: "var(--ls-accent)", borderRadius: "var(--ls-button-radius)" }}
                    >
                      ×{e.multiplier}
                    </span>
                  )}
                </span>
                {e.descriptionEn && (
                  <span className="mt-0.5 block truncate text-xs text-[var(--ls-ink-muted)]">
                    {e.descriptionEn}
                  </span>
                )}
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">
                  {new Date(e.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" – "}
                  {new Date(e.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/**
 * The streak, as a line of months.
 *
 * The design draws the months as marks on a thread rather than as a number,
 * because a streak is a thing you can see the shape of — three kept and one to
 * go reads immediately, "3" does not.
 */
function Streak({ data }: { data: LoyaltySummary }) {
  const SIG = useWords().glyph;
  const t = useText("streak");
  const h = useHeading();
  const s = data.streak;

  return (
    <div>
      <div className={`text-xl ${h.face} ${h.caps} text-[var(--ls-ink)]`}>{t("title")}</div>
      <div className="mt-1 text-xs text-[var(--ls-ink-soft)]">{t("subtitle")}</div>

      <div
        className="mt-3 bg-[var(--ls-card)] p-5 ring-1 ring-[var(--ls-line)]"
        style={{ borderRadius: "var(--ls-radius)" }}
      >
        <div className="relative flex items-center justify-between">
          {/* The thread the marks sit on. */}
          <span className="absolute inset-x-4 top-1/2 -z-0 h-px -translate-y-1/2 bg-[var(--ls-line)]" />
          {s.months.map((m) => {
            const label = new Date(m.month + "-01")
              .toLocaleDateString("en-US", { month: "short" })
              .toUpperCase();
            return (
              <span key={m.month} className="relative z-10 flex flex-col items-center gap-1.5">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-sm"
                  style={{
                    background: m.qualified ? "var(--ls-accent)" : "var(--ls-card)",
                    color: m.qualified ? "#fff" : "var(--ls-ink-soft)",
                    boxShadow: m.qualified ? "none" : "inset 0 0 0 1px var(--ls-line)",
                  }}
                >
                  {m.qualified ? SIG : "○"}
                </span>
                <span className="text-[10px] tracking-wide text-[var(--ls-ink-soft)]">{label}</span>
              </span>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--ls-line)] pt-4 text-center">
          <div className="flex-1">
            <div className="text-2xl font-bold text-[var(--ls-ink)]">{s.currentStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">{t("currentLabel")}</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-[var(--ls-ink)]">{s.longestStreak}</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--ls-ink-soft)]">{t("longestLabel")}</div>
          </div>
        </div>
      </div>

      {s.nextMilestone && (
        <div
          className="mt-3 flex items-center gap-3 bg-[var(--ls-panel)] p-4 ring-1 ring-[var(--ls-line)]"
          style={{ borderRadius: "var(--ls-radius)" }}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ls-card)] text-lg">
            🔒
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--ls-ink-soft)]">
              {t("milestoneKicker")}
            </span>
            <span className={`block text-sm ${h.face} text-[var(--ls-ink)]`}>
              {s.nextMilestone.months} {t("monthsWord")}
            </span>
            <span className="block text-xs text-[var(--ls-ink-muted)]">{s.nextMilestone.titleEn}</span>
          </span>
        </div>
      )}
    </div>
  );
}
function Activity({ initial }: { initial: Transaction[] }) {
  const SIG = useWords().glyph;
  const t = useText("activity");
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
    <Section title={t("title")}>
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
          {busy ? t("loadingLabel") : t("moreCta")}
        </button>
      )}
      {rows.length === 0 && <Empty text={t("empty")} />}
    </Section>
  );
}

function RevealModal({ reveal, onClose }: { reveal: { title: string; code: string | null; type: string }; onClose: () => void }) {
  const t = useText("shared");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-[var(--ls-deep)] to-[var(--ls-deep-to)] p-8 text-center text-[var(--ls-on-deep)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl">🎁</div>
        <div className="mt-4 text-[11px] tracking-[0.2em] text-[var(--ls-on-deep-soft)]">{t("revealKicker")}</div>
        <div className="mt-1 font-serif text-2xl">{reveal.title}</div>
        {reveal.code && <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm">{reveal.code}</div>}
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[var(--ls-gold)] py-3 text-sm font-semibold text-[var(--ls-deep)]">{t("revealCta")}</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-[var(--ls-card)] p-6 text-center text-sm text-[var(--ls-ink-soft)] ring-1 ring-[var(--ls-line)]">{text}</div>;
}

// ---- helpers ----------------------------------------------------------------
function rewardIcon(type: string, glyph: string): string {
  return (
    { discount: "🏷️", delivery: "🚚", product: "🎁", access: "🔑", experience: "✨", signatures: glyph }[
      type
    ] ?? glyph
  );
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
