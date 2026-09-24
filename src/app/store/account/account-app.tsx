"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { isLight, levelPalette, withAlpha } from "@/lib/loyalty/level-colors";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import { say, type Copy } from "@/lib/page-copy";
import type { Account } from "@/lib/account-service";
import type { EarnTask, LoyaltySummary, RewardView, VaultView } from "@/lib/loyalty/types";
import { getMyLoyalty, redeemMyReward, openMyVault } from "../loyalty-actions";
import {
  getMyOrder,
  removeMyAvatar,
  saveMyAvatar,
  saveMyProfile,
  type MyOrder,
} from "../account-actions";
import { logout } from "../auth-actions";

/**
 * The customer account hub — a real, working version of the Beauty Bar Society
 * web-account design. Sidebar + panels, bilingual, every section wired to live
 * data: profile, orders (with tracking), the loyalty program (vault, rewards,
 * levels, activity), addresses and preferences. No mock values.
 */

const SIG = "✦";
const fmtN = (n: number) => new Intl.NumberFormat("en-US").format(n);

export type PageKey =
  | "overview" | "orders" | "returns" | "wishlist"
  | "addresses" | "payment"
  | "vault" | "rewards" | "levels" | "activity"
  | "profile" | "notif";

/** Each section is its own page. Overview lives at the account root. */
/**
 * The account column, from the society card down to the way out.
 *
 * It used to be one dark card and then a stack of near-white ones, so the
 * page broke in half at the second panel. Now the whole column is one fall of
 * light: it starts at the card's own brown and lifts a step with every panel,
 * reaching the page's cream by the bottom. Nothing is a different material to
 * the thing above it — it is the same surface, further from the light.
 *
 * Text is chosen from the panel it sits on rather than fixed, so the middle of
 * the ramp is as readable as either end.
 */
/**
 * The steps themselves, chosen rather than calculated.
 *
 * A straight line from the card's brown to the page's cream runs through grey:
 * the warmth drains out of the middle and the panels halfway down look dirty
 * rather than lit. These are warm the whole way, so every panel is plainly the
 * same material as the one above it.
 */
const RAMP = [
  "#241609",
  "#3C2614",
  "#5A3D22",
  "#8A6742",
  "#B99772",
  "#DCC7A8",
  "#F0E4D2",
  "#F7F1E6",
];

type Shade = {
  bg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  hover: string;
};

/**
 * Where a panel stands on the ramp, given its place in the column.
 *
 * Not evenly: the middle of any dark-to-light run is the one place where
 * neither cream nor brown text can be read against it. So the column spends
 * its steps at the two ends and crosses that band between panels instead of
 * landing a panel in it. Every panel is still lighter than the one above.
 */
function placeInRamp(t: number): number {
  return t < 0.5 ? t * 0.78 : 0.64 + (t - 0.5) * 0.72;
}

function rampAt(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  const part = (from: string, to: string, k: number) =>
    Math.round(
      parseInt(from.slice(k, k + 2), 16) +
        (parseInt(to.slice(k, k + 2), 16) - parseInt(from.slice(k, k + 2), 16)) * f,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${part(a, b, 1)}${part(a, b, 3)}${part(a, b, 5)}`;
}

/** Two colours, mixed. */
function blend(a: string, b: string, amount: number): string {
  const part = (k: number) =>
    Math.round(
      parseInt(a.slice(k, k + 2), 16) +
        (parseInt(b.slice(k, k + 2), 16) - parseInt(a.slice(k, k + 2), 16)) * amount,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${part(1)}${part(3)}${part(5)}`;
}

/**
 * The Society's panel: its place in the ramp, wearing her tier's colour.
 *
 * Lifting it out of the ramp altogether left a near-white block between two
 * brown ones, which read as a mistake rather than as emphasis. Pushing its own
 * step towards the tier colour keeps the fall of light unbroken and still says
 * which level she is on — which is the only thing that colour is there to say.
 */
function tintedShade(t: number, accent: string): Shade {
  const bg = blend(rampAt(t), accent, 0.22);
  const light = isLight(bg);
  return {
    bg,
    border: blend(rampAt(Math.max(0, t - 0.1)), accent, 0.45),
    text: light ? "#3C2A1A" : "#F6EDE0",
    muted: light ? "#7E6A54" : "#CBB69A",
    accent: light ? blend(accent, "#3A2614", 0.35) : blend(accent, "#FBF7F1", 0.55),
    hover: light ? "rgba(60,42,26,0.09)" : "rgba(255,255,255,0.1)",
  };
}

function shadeAt(t: number): Shade {
  const bg = rampAt(t);
  const light = isLight(bg);
  return {
    bg,
    // One step back up the ramp, so a panel keeps an edge against the page
    // even once it has nearly become the page.
    border: rampAt(Math.max(0, t - 0.1)),
    text: light ? "#4A3524" : "#F6EDE0",
    muted: light ? "#8A745C" : "#C6AE90",
    accent: light ? "#A46C3C" : "#E4BC74",
    hover: light ? "rgba(74,53,36,0.08)" : "rgba(255,255,255,0.09)",
  };
}
function hrefFor(p: PageKey): string {
  return p === "overview" ? "/store/account" : `/store/account/${p}`;
}

export default function AccountApp({
  account,
  loyalty: initialLoyalty,
  section,
  orderNumber,
  copy = {},
}: {
  account: Account;
  loyalty: LoyaltySummary | null;
  section: PageKey;
  orderNumber?: string;
  /** The merchant's wording for this page, from the Pages screen. */
  copy?: Copy;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const money = (n: number) => egp(n, lang);

  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(initialLoyalty);
  const [avatar, setAvatar] = useState<string | null>(account.avatarUrl);
  // The active section IS the URL now, so it comes in as a prop.
  const page = section;
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [reveal, setReveal] = useState<{ title: string; code: string | null } | null>(null);
  const [pending, start] = useTransition();

  // Loyalty is re-seeded from the server on navigation; keep it fresh after an
  // action too (redeem/open) without a full reload.
  useEffect(() => { setLoyalty(initialLoyalty); }, [initialLoyalty]);

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3200);
  }
  const refreshLoyalty = useCallback(async () => {
    const r = await getMyLoyalty();
    if (r.ok) setLoyalty(r.data);
  }, []);

  /** Navigate to a section's own page. */
  function go(p: PageKey) {
    router.push(hrefFor(p));
  }
  function openOrderNav(num: string) {
    router.push(`/store/account/orders/${num}`);
  }

  function onRedeem(r: RewardView) {
    start(async () => {
      const res = await redeemMyReward(r.id);
      if (res.ok) {
        flash(`${ar ? "تم استبدال" : "Claimed"} ${r.titleEn}${res.data.code ? ` · ${res.data.code}` : ""}`);
        await refreshLoyalty();
      } else flash(loyaltyError(res.error, ar), "err");
    });
  }
  function onOpenVault(v: VaultView) {
    if (!v.userVaultId) return;
    start(async () => {
      const res = await openMyVault(v.userVaultId!);
      if (res.ok) {
        setReveal({ title: res.data.rewardTitle, code: res.data.code });
        await refreshLoyalty();
      } else flash(loyaltyError(res.error, ar), "err");
    });
  }

  const nav: { title: string | null; society?: boolean; items: [PageKey, string, string][] }[] = [
    { title: null, items: [
      ["overview", "Overview", "نظرة عامة"],
      ["orders", "My Orders", "طلباتي"],
      ["returns", "Returns & Exchanges", "الإرجاع والاستبدال"],
      ["wishlist", "Wishlist", "المفضلة"],
    ]},
    { title: ar ? "الدفع والتوصيل" : "Payment & delivery", items: [
      ["addresses", "My Addresses", "عناويني"],
      ["payment", "Payment & Wallet", "الدفع والمحفظة"],
    ]},
    ...(loyalty ? [{ title: "Beauty Bar Society", society: true, items: [
      ["vault", "The Vault", "الفولت"],
      ["rewards", "My Rewards", "مكافآتي"],
      ["levels", "The Levels", "المستويات"],
      ["activity", "Activity", "النشاط"],
    ] as [PageKey, string, string][] }] : []),
    { title: ar ? "الحساب" : "Account", items: [
      ["profile", "Personal Details", "بياناتي"],
      ["notif", "Notifications", "الإشعارات"],
    ]},
  ];
  const navValue: Partial<Record<PageKey, string>> = {
    orders: account.orders.length ? String(account.orders.length) : "",
    wishlist: "",
    vault: loyalty?.primaryVault ? `${loyalty.primaryVault.currentProgress}/${loyalty.primaryVault.requiredProgress}` : "",
    rewards: loyalty ? String(loyalty.availableRewards.filter((r) => r.status === "affordable").length) : "",
  };

  const initials = (account.name || account.phone).trim().slice(0, 2).toUpperCase();

  // The society panels only exist for a member, so a shop without loyalty
  // does not leave two steps of the ramp unwalked.
  const panelRows = loyalty ? 2 : 0;
  const steps = panelRows + nav.length + 1;
  const shade = (i: number) => shadeAt(placeInRamp((i + 1) / steps));
  // Every stage of the Society has its own colour. The Society's own menu
  // wears the one she has reached, so the page quietly changes as she climbs.
  const tier = loyalty ? levelPalette(loyalty.levels, loyalty.progress.currentLevel) : null;

  return (
    <div className="min-h-screen bg-[#F2E8DA] text-[#3A291B]" dir={ar ? "rtl" : "ltr"}>
      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar / account menu. On mobile it IS the account home; a section
            page hides it and shows only that section (with a Menu link). */}
        <aside className={`${section === "overview" ? "flex" : "hidden lg:flex"} flex-col gap-1.5`}>
          {/*
            The society card, built like the Society screens themselves.

            Everything here is the composition those screens use: light thrown
            from one side rather than an even fill, her name small beside a
            small portrait, and the tier set large in serif capitals — because
            the tier is the headline, not a caption under an avatar. The stack
            below it reads the way the Society page reads: what is being
            counted, the bar, then the count.
          */}
          <SocietyCard
            ar={ar}
            name={account.name || (ar ? "عميلة" : "Customer")}
            email={account.email}
            initials={initials}
            orders={account.orders.length}
            loyalty={loyalty}
            avatar={avatar}
            onAvatar={setAvatar}
          />

          {loyalty && <SocietyPanels ar={ar} loyalty={loyalty} tones={[shade(0), shade(1)]} />}

          {nav.map((g, gi) => {
            // Two panels of society above these, so the ramp carries on from
            // where they left it rather than starting again.
            // Only the Society group is coloured. A page where every panel is
            // coloured says nothing; one panel that is says exactly one thing —
            // which level she has reached. It keeps its place in the ramp.
            const step = placeInRamp((gi + panelRows + 1) / steps);
            const tone =
              g.society && tier ? tintedShade(step, tier.accent) : shadeAt(step);
            const t = g.society ? tier : null;
            return (
              <div
                key={gi}
                className="rounded-2xl border p-1 shadow-sm"
                style={
                  {
                    backgroundColor: tone.bg,
                    borderColor: tone.border,
                    "--row-hover": tone.hover,
                  } as React.CSSProperties
                }
              >
                {g.title && (
                  <div
                    className="px-2.5 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: tone.accent }}
                  >
                    {g.title}
                  </div>
                )}
                {g.items.map(([key, en, arLbl]) => {
                  const on = page === key;
                  return (
                    <Link
                      key={key}
                      href={hrefFor(key)}
                      aria-current={on}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-1 text-start text-sm leading-5 transition-colors ${
                        on
                          ? "text-[#FFF6EA]"
                          : "hover:bg-[var(--row-hover)]"
                      }`}
                      style={
                        on
                          ? {
                              backgroundColor: t ? t.accent : undefined,
                              backgroundImage: t
                                ? undefined
                                : "linear-gradient(135deg, #C08E5C, #7A4B27)",
                            }
                          : { color: tone.text }
                      }
                    >
                      <span className="flex-1">{ar ? arLbl : en}</span>
                      {navValue[key] ? (
                        <span
                          className="text-[10px]"
                          style={{ color: on ? "#F1D9BE" : tone.muted }}
                        >
                          {navValue[key]}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {/* The last step of the ramp, and the palest. */}
          <div
            className="rounded-2xl border p-1 shadow-sm"
            style={{
              backgroundColor: shade(panelRows + nav.length).bg,
              borderColor: shade(panelRows + nav.length).border,
            }}
          >
            <button
              onClick={() => start(async () => { await logout(); (window.top ?? window).location.assign("/shop"); })}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1 text-start text-sm leading-5 text-[#9B4B41] hover:bg-[#F3E9DC]"
            >
              {ar ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Main. On mobile the overview panel is the menu's job, so hide it there
            (the menu is the home); section pages show their content full-width. */}
        <main className={`min-w-0 ${section === "overview" ? "hidden lg:block" : ""}`}>
          {/* Mobile: a section page hides the nav, so give a way back to it. */}
          {section !== "overview" && (
            <Link href="/store/account" className="mb-4 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-[#A46C3C] lg:hidden">
              ← {ar ? "القائمة" : "Menu"}
            </Link>
          )}
          {orderNumber && page === "orders" ? (
            <OrderDetail orderNumber={orderNumber} ar={ar} money={money} onBack={() => router.push("/store/account/orders")} />
          ) : (
            <>
              {page === "overview" && <Overview account={account} loyalty={loyalty} ar={ar} money={money} go={go} openOrderFn={openOrderNav} onOpenVault={onOpenVault} pending={pending} copy={copy} />}
              {page === "orders" && <Orders account={account} ar={ar} money={money} open={openOrderNav} />}
              {page === "returns" && <Returns ar={ar} />}
              {page === "wishlist" && <Wishlist ar={ar} money={money} />}
              {page === "addresses" && <Addresses account={account} ar={ar} onSaved={() => router.refresh()} />}
              {page === "payment" && <Payment loyalty={loyalty} ar={ar} money={money} />}
              {loyalty && page === "vault" && <Vaults loyalty={loyalty} ar={ar} onOpen={onOpenVault} pending={pending} />}
              {loyalty && page === "rewards" && <Rewards loyalty={loyalty} ar={ar} onRedeem={onRedeem} pending={pending} />}
              {loyalty && page === "levels" && <Levels loyalty={loyalty} ar={ar} />}
              {loyalty && page === "activity" && <Activity loyalty={loyalty} ar={ar} />}
              {page === "profile" && <Profile account={account} ar={ar} onSaved={() => router.refresh()} />}
              {page === "notif" && <Notifications ar={ar} />}
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className={`rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === "ok" ? "bg-[#3A291B]" : "bg-rose-600"}`}>{toast.text}</div>
        </div>
      )}
      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setReveal(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-[#2B1B10] to-[#150D07] p-8 text-center text-[#F0E6D8]" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl">🎁</div>
            <div className="mt-4 text-[11px] tracking-[0.2em] text-[#C9B79F]">{ar ? "لقد فتحتِ" : "YOU UNLOCKED"}</div>
            <div className="mt-1 font-serif text-2xl">{reveal.title}</div>
            {reveal.code && <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm">{reveal.code}</div>}
            <button onClick={() => setReveal(null)} className="mt-6 w-full rounded-xl bg-[#C9974F] py-3 text-sm font-semibold text-[#2B1B10]">{ar ? "عرض المكافأة" : "View reward"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- small shared bits ------------------------------------------------------
/* ------------------------------ society card ------------------------------ */

/**
 * The Society is gold. Every level of it.
 *
 * The tier's own colour says which level she is on, and it says that in the
 * menu below — one place, once. Spending it here as well would make this card
 * change its whole character between tiers, when the thing it is for is the
 * opposite: the Society looking like the Society, whoever is reading it.
 *
 * The bar is lit along its whole length rather than only at the end, so the
 * figure sitting on it reads from the first signature to the last.
 */
const GOLD = {
  accent: "#8A5A24",
  bright: "#E4BC74",
  glow: "#FFF3D0",
  fill: "linear-gradient(90deg, #C9A05A 0%, #E9CB8A 55%, #FBF0D2 100%)",
};

/**
 * Where the light falls, and the dust it catches.
 *
 * The Society screens are not an even brown fill — they are lit from one side,
 * with the glow strongest behind the tier's name and falling away across the
 * card. Fixed positions, not random ones: a server and a browser that disagree
 * about where a speck of dust goes is a hydration error, and nobody can see
 * the difference anyway.
 */
const MOTES = [
  { x: 14, y: 22, s: 1.5, o: 0.35 },
  { x: 32, y: 12, s: 1, o: 0.25 },
  { x: 58, y: 28, s: 2, o: 0.45 },
  { x: 71, y: 16, s: 1, o: 0.3 },
  { x: 84, y: 34, s: 1.5, o: 0.5 },
  { x: 92, y: 58, s: 1, o: 0.3 },
  { x: 66, y: 62, s: 1.5, o: 0.28 },
  { x: 44, y: 46, s: 1, o: 0.22 },
  { x: 22, y: 64, s: 1.5, o: 0.3 },
  { x: 8, y: 48, s: 1, o: 0.2 },
];

function SocietyCard({
  ar,
  name,
  email,
  initials,
  orders,
  loyalty,
  avatar,
  onAvatar,
}: {
  ar: boolean;
  name: string;
  email: string | null;
  initials: string;
  orders: number;
  loyalty: LoyaltySummary | null;
  avatar: string | null;
  onAvatar: (url: string | null) => void;
}) {
  const vault = loyalty?.primaryVault ?? null;
  const p = loyalty?.progress ?? null;

  // The top of the ladder has nothing above it, so the bar is full and the
  // number beside it says so rather than counting towards nothing.
  const atTop = !!p && !p.nextLevel;
  const pct = p ? (atTop ? 100 : Math.min(100, Math.max(4, p.percentage))) : 0;
  const target = p ? p.lifetime + (p.remaining ?? 0) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#241609] p-4 shadow-[0_16px_38px_-18px_rgba(36,22,9,0.75)]">
      {/* The light, thrown from the side the tier's name sits on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(110% 130% at 88% 42%, ${withAlpha(
            GOLD.glow,
            0.42,
          )} 0%, ${withAlpha(GOLD.accent, 0.24)} 34%, transparent 72%)`,
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: m.s,
              height: m.s,
              opacity: m.o,
              boxShadow: `0 0 ${m.s * 3}px ${withAlpha("#ffffff", m.o)}`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        {/* Her, small, the way a byline sits above a headline. */}
        <div className="flex items-center gap-2.5">
          <AvatarPicker ar={ar} initials={initials} avatar={avatar} onAvatar={onAvatar} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[#EFE3D0]">{name}</span>
            {email && <span className="block truncate text-[10px] text-[#A88D6C]">{email}</span>}
          </span>
        </div>

        {/* The headline: the tier, in capitals, the size the Society sets it. */}
        {p && (
          <h2 className="mt-3 font-serif text-[23px] uppercase leading-[1.1] tracking-[0.01em] text-[#F8F0E2]">
            {p.currentLevelName}{" "}
            <span style={{ color: GOLD.bright }}>{SIG}</span>
          </h2>
        )}

        {p && (
          <>
            <div className="mt-2.5 text-[11px] font-medium text-[#C2A882]">
              {ar ? "التوقيعات" : "Signatures"}
            </div>

            {/*
              The bar the Society page uses: tall enough to hold its own
              numbers, lit at the point it has reached — which is the bit that
              makes it feel like a level and not a loading indicator.
            */}
            <div className="relative mt-1.5 h-[20px] w-full overflow-hidden rounded-full bg-[#38240F] ring-1 ring-inset ring-[#4E361C]">
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  insetInlineStart: 0,
                  width: `${pct}%`,
                  background: GOLD.fill,
                }}
              />
              {/* Where it has got to, catching the light. */}
              <div
                aria-hidden
                className="absolute top-1/2 h-[24px] w-[24px] -translate-y-1/2 rounded-full"
                style={{
                  insetInlineStart: `calc(${pct}% - 12px)`,
                  background: `radial-gradient(circle, ${withAlpha("#FFFDF6", 0.95)} 0%, ${withAlpha(
                    GOLD.glow,
                    0.6,
                  )} 42%, transparent 70%)`,
                }}
              />
              <div className="relative flex h-full items-center justify-between px-3">
                <span className="text-[10px] font-bold text-[#3A2410]">{fmtN(p.lifetime)}</span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: pct > 78 ? "#6B4A18" : "#C2A882" }}
                >
                  {atTop
                    ? ar ? "أعلى مستوى" : "Top tier"
                    : ar ? `من ${fmtN(target)}` : `out of ${fmtN(target)}`}
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="font-serif text-[26px] leading-none text-[#F8F0E2]">
                  {fmtN(p.lifetime)} <span style={{ color: GOLD.bright }}>{SIG}</span>
                </div>
                <div className="mt-1 text-[10px] text-[#A88D6C]">
                  {atTop
                    ? ar ? "توقيعات مكتسبة حتى الآن" : "Signatures earned to date"
                    : ar
                      ? `${fmtN(p.remaining ?? 0)} للوصول إلى ${p.nextLevelName}`
                      : `${fmtN(p.remaining ?? 0)} until ${p.nextLevelName}`}
                </div>
              </div>

              <Link
                href={hrefFor("vault")}
                className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: withAlpha(GOLD.bright, 0.4),
                  color: GOLD.bright,
                  backgroundColor: withAlpha(GOLD.bright, 0.08),
                }}
              >
                {ar ? "الفولت" : "The Vault"}
                {vault && (
                  <span className="ms-1.5 opacity-70">
                    {fmtN(vault.currentProgress)}/{fmtN(vault.requiredProgress)}
                  </span>
                )}
              </Link>
            </div>
          </>
        )}

        <div className="mt-3 flex border-t border-[#4A331C] pt-2.5 text-center">
          <Stat v={loyalty ? fmtN(loyalty.user.signatureBalance) : "—"} k={ar ? "توقيع" : "Signatures"} />
          <Stat v={String(orders)} k={ar ? "طلبات" : "Orders"} border />
          <Stat v={loyalty ? String(loyalty.streak.currentStreak) : "0"} k={ar ? "ستريك" : "Streak"} border />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ avatar picker ----------------------------- */

/**
 * Two initials are what you show when you have nothing. This is how she gives
 * the page something: tap the circle, choose a photo.
 *
 * The browser does the work first — the image is cropped square and drawn down
 * to 512 pixels here, before it is sent. A photo straight off a phone is four
 * or five megabytes and would not survive the request; the same picture at 512
 * is nearer eighty kilobytes, and at the size it is displayed nobody could tell
 * the two apart. It also means no upload URL has to be handed to the browser.
 */
function AvatarPicker({
  ar,
  initials,
  avatar,
  onAvatar,
}: {
  ar: boolean;
  initials: string;
  avatar: string | null;
  onAvatar: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const [menu, setMenu] = useState(false);

  async function squareDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(512, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas");
    // Centre crop: a portrait is nearly always framed in the middle.
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setState("working");
    try {
      const res = await saveMyAvatar(await squareDataUrl(file));
      if (!res.ok) throw new Error(res.error);
      onAvatar(res.data);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="relative shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => (avatar ? setMenu((v) => !v) : fileRef.current?.click())}
        disabled={state === "working"}
        className="relative block h-8 w-8 overflow-hidden rounded-full"
        style={{ background: `linear-gradient(140deg, ${GOLD.bright}, ${GOLD.accent})` }}
        aria-label={ar ? "تغيير صورتك" : "Change your picture"}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-serif text-[11px] text-[#241609]">
            {initials}
          </span>
        )}
        {state === "working" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
          </span>
        )}
      </button>

      {/* A camera is the one mark everybody reads as "you can change this". */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px]"
        style={{ backgroundColor: GOLD.bright, color: "#241609" }}
      >
        ✎
      </span>

      {menu && (
        <span className="absolute top-9 z-20 flex w-36 flex-col overflow-hidden rounded-xl bg-[#2C1D0F] text-[11px] shadow-xl ring-1 ring-inset ring-[#4A331C]" style={{ insetInlineStart: 0 }}>
          <button
            onClick={() => {
              setMenu(false);
              fileRef.current?.click();
            }}
            className="px-3 py-2 text-start text-[#F0E4D2] hover:bg-[#3A2714]"
          >
            {ar ? "تغيير الصورة" : "Change picture"}
          </button>
          <button
            onClick={async () => {
              setMenu(false);
              setState("working");
              const res = await removeMyAvatar();
              if (res.ok) onAvatar(null);
              setState(res.ok ? "idle" : "failed");
            }}
            className="px-3 py-2 text-start text-[#D9877C] hover:bg-[#3A2714]"
          >
            {ar ? "إزالة الصورة" : "Remove picture"}
          </button>
        </span>
      )}

      {state === "failed" && (
        <span className="absolute top-9 z-20 w-36 rounded-lg bg-[#5A2A24] px-2 py-1 text-[10px] text-[#FBD9D3]" style={{ insetInlineStart: 0 }}>
          {ar ? "تعذّر حفظ الصورة." : "That picture could not be saved."}
        </span>
      )}
    </span>
  );
}

/* ----------------------------- society panels ----------------------------- */

/**
 * A panel on the society card's own terms: gold on the same deep brown, and
 * shut until it is asked for.
 *
 * All three of these are lists, and three open lists is a page nobody scrolls
 * to the end of. Closed, they read as a short contents page — which is what
 * somebody glancing at their account actually wants — and any one of them
 * opens where it stands, under its own heading.
 */
function SocietyPanel({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  /** Shown beside the title while shut, so it is worth opening. */
  count?: string | number;
  tone: Shade;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ backgroundColor: tone.bg, borderColor: tone.border }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start"
      >
        <span
          className="min-w-0 flex-1 truncate text-[12px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: tone.text }}
        >
          {title}
        </span>
        {count != null && count !== "" && (
          <span className="shrink-0 text-[11px] font-semibold" style={{ color: tone.accent }}>
            {count}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke={tone.accent}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  );
}

/** The bottom line of a panel — where the whole list lives. */
function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: GOLD.bright }}
    >
      {label}
      <span aria-hidden>›</span>
    </Link>
  );
}

/**
 * The tiers, the tasks and the privileges, in the arrangement the Society
 * screens put them in: the ladder across the top, and beneath it what to do
 * next beside what has already been earned.
 *
 * Side by side only where there is width for it. In the desktop sidebar the
 * column is too narrow to split in two, so they stack — the arrangement is
 * worth keeping, but not at the cost of four words to a line.
 */
function SocietyPanels({
  ar,
  loyalty,
  tones,
}: {
  ar: boolean;
  loyalty: LoyaltySummary;
  /** One for the tiers, one for the pair beneath them. */
  tones: [Shade, Shade];
}) {
  const levels = loyalty.levels;
  const mySort = levels.find((l) => l.key === loyalty.progress.currentLevel)?.sort ?? 1;
  const perks = loyalty.privileges.filter((p) => p.unlocked);

  // A rule that pays per pound has no single figure to show, so it says what
  // it actually does instead.
  const worth = (t: EarnTask) =>
    t.ratePerEgp > 0
      ? ar
        ? `${t.ratePerEgp}✦ لكل جنيه`
        : `${t.ratePerEgp}✦ per EGP`
      : ar
        ? `${fmtN(t.signatures)} توقيع`
        : `${fmtN(t.signatures)} signatures`;

  return (
    <div className="flex flex-col gap-1.5">
      <SocietyPanel title={ar ? "مستوياتي" : "My Tiers"} count={`${mySort}/${levels.length}`} tone={tones[0]}>
        <ul className="space-y-1">
          {levels.map((l) => {
            const active = l.key === loyalty.progress.currentLevel;
            const locked = l.sort > mySort;
            return (
              <li
                key={l.key}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]"
                style={{
                  borderColor: active ? withAlpha(GOLD.bright, 0.5) : "transparent",
                  background: active
                    ? `linear-gradient(90deg, ${withAlpha(GOLD.bright, 0.26)}, ${withAlpha(GOLD.bright, 0.05)})`
                    : "#2C1D0F",
                  color: locked ? "#8C755A" : "#F0E4D2",
                }}
              >
                <span aria-hidden style={{ color: locked ? "#7A6448" : GOLD.bright }}>
                  {locked ? "🔒" : SIG}
                </span>
                <span className="min-w-0 flex-1 truncate uppercase tracking-[0.06em]">
                  {ar && l.nameAr ? l.nameAr : l.nameEn}
                </span>
                <span className="shrink-0 text-[10px]" style={{ color: active ? "#86CF9E" : "#8C755A" }}>
                  {active
                    ? ar ? "(الحالي)" : "(Active)"
                    : locked
                      ? ar ? "(مقفل)" : "(Locked)"
                      : ar ? "(مكتمل)" : "(Reached)"}
                </span>
              </li>
            );
          })}
        </ul>
        <SeeAll href={hrefFor("levels")} label={ar ? "كل المستويات" : "See all tiers"} />
      </SocietyPanel>

      <div className="grid grid-cols-2 items-start gap-1.5 lg:grid-cols-1">
        <SocietyPanel title={ar ? "مهام الولاء" : "Loyalty Tasks"} count={loyalty.tasks.length || ""} tone={tones[1]}>
          {loyalty.tasks.length === 0 ? (
            <p className="text-[11px] text-[#8C755A]">{ar ? "لا توجد مهام." : "Nothing listed yet."}</p>
          ) : (
            <ul className="space-y-1.5">
              {loyalty.tasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex gap-1.5 text-[12px] leading-snug text-[#F0E4D2]">
                  <span aria-hidden style={{ color: GOLD.bright }}>
                    •
                  </span>
                  <span className="min-w-0">
                    {t.title || taskName(t.actionType, ar)}
                    <span className="block text-[10px]" style={{ color: GOLD.bright }}>
                      {worth(t)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SeeAll href={hrefFor("activity")} label={ar ? "الكل" : "See all"} />
        </SocietyPanel>

        <SocietyPanel title={ar ? "المزايا المفتوحة" : "Unlocked Perks"} count={perks.length || ""} tone={tones[1]}>
          {perks.length === 0 ? (
            <p className="text-[11px] text-[#8C755A]">
              {ar ? "لم تُفتح مزايا بعد." : "None unlocked yet."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {perks.slice(0, 6).map((v) => (
                <li key={v.id} className="flex gap-1.5 text-[12px] leading-snug text-[#F0E4D2]">
                  <span aria-hidden style={{ color: GOLD.bright }}>
                    {SIG}
                  </span>
                  <span className="min-w-0">{ar && v.titleAr ? v.titleAr : v.titleEn}</span>
                </li>
              ))}
            </ul>
          )}
          <SeeAll href={hrefFor("rewards")} label={ar ? "مكافآتي" : "My rewards"} />
        </SocietyPanel>
      </div>
    </div>
  );
}

/** A readable name for a rule the merchant never titled. */
function taskName(actionType: string, ar: boolean): string {
  const names: Record<string, [string, string]> = {
    order: ["Place an order", "اطلبي طلباً"],
    profile_complete: ["Complete your profile", "أكملي ملفك"],
    review: ["Post a review", "اكتبي تقييماً"],
    birthday: ["Your birthday", "عيد ميلادك"],
    new_category: ["Try a new category", "جرّبي فئة جديدة"],
    signup: ["Join the Society", "انضمي للمجتمع"],
  };
  const hit = names[actionType];
  return hit ? (ar ? hit[1] : hit[0]) : actionType.replace(/_/g, " ");
}

/** One figure on the society card — gold on brown, like the Society screens. */
function Stat({ v, k, border }: { v: string; k: string; border?: boolean }) {
  return (
    <div className={`flex-1 ${border ? "border-s border-[#4A331C]" : ""}`}>
      <div className="font-serif text-lg text-[#F6E7CF]">{v}</div>
      <div className="text-[8.5px] uppercase tracking-[0.14em] text-[#A88D6C]">{k}</div>
    </div>
  );
}
function Card({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] shadow-sm">
      {title && (
        <div className="flex items-center justify-between border-b border-[#E4D7C5] px-4 py-3">
          <h3 className="font-serif text-base">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-3xl tracking-wide">{title}</h2>
      {sub && <p className="mt-1 text-sm text-[#7C6450]">{sub}</p>}
    </div>
  );
}
function Pill({ tone, children }: { tone: "go" | "ok" | "bad" | "muted"; children: React.ReactNode }) {
  const map = { go: "text-[#A37B2E] border-[#A37B2E]", ok: "text-[#5F7A55] border-[#5F7A55]", bad: "text-[#9B4B41] border-[#9B4B41]", muted: "text-[#7C6450] border-[#CDB99F]" };
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] ${map[tone]}`}>{children}</span>;
}
function Thumb({ label, size = "s" }: { label: string; size?: "s" | "m" }) {
  const cls = size === "m" ? "h-14 w-14 text-sm" : "h-11 w-11 text-[11px]";
  return <div className={`grid ${cls} shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#EFE2D2] to-[#DCC7AC] font-serif text-[#8A6743]`}>{label}</div>;
}
const btn = "inline-block rounded-lg bg-gradient-to-br from-[#C08E5C] to-[#7A4B27] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FFF6EA]";
const btnGhost = "inline-block rounded-lg border border-[#CDB99F] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3A291B]";

function paymentPill(status: string, ar: boolean): { tone: "go" | "ok" | "bad" | "muted"; label: string } {
  switch (status) {
    case "paid": return { tone: "ok", label: ar ? "مدفوع" : "Paid" };
    case "partially_paid": return { tone: "go", label: ar ? "مدفوع جزئياً" : "Partly paid" };
    case "refunded": case "partially_refunded": return { tone: "muted", label: ar ? "مسترجع" : "Refunded" };
    default: return { tone: "go", label: ar ? "غير مدفوع" : "Unpaid" };
  }
}
function orderStatus(o: { lifecycle: string; fulfillmentStatus: string }, ar: boolean): { tone: "go" | "ok" | "bad" | "muted"; label: string } {
  if (o.lifecycle === "cancelled") return { tone: "bad", label: ar ? "ملغي" : "Cancelled" };
  if (o.fulfillmentStatus === "fulfilled" || o.lifecycle === "completed") return { tone: "ok", label: ar ? "تم التسليم" : "Delivered" };
  if (o.fulfillmentStatus === "partial") return { tone: "go", label: ar ? "جارٍ التنفيذ" : "In progress" };
  return { tone: "go", label: ar ? "قيد المعالجة" : "Processing" };
}

// ---- Overview ---------------------------------------------------------------
function Overview({ account, loyalty, ar, money, go, openOrderFn, onOpenVault, pending, copy }: {
  account: Account; loyalty: LoyaltySummary | null; ar: boolean; money: (n: number) => string;
  go: (p: PageKey) => void; openOrderFn: (n: string) => void; onOpenVault: (v: VaultView) => void; pending: boolean;
  copy: Copy;
}) {
  const v = loyalty?.primaryVault;
  return (
    <>
      <PageHead
        title={`${say(copy, "greeting", ar) || (ar ? "أهلاً" : "Hello")}، ${account.name?.split(" ")[0] || (ar ? "" : "there")}`.replace("، ", ar ? "، " : ", ")}
        sub={say(copy, "welcome", ar) || (ar ? "نظرة سريعة على حسابك وعضويتك" : "A quick look at your account and membership")}
      />

      {v && !v.locked && (
        <div className="mb-5 flex flex-wrap items-center gap-5 rounded-2xl border border-[#4A3120] bg-gradient-to-br from-[#3E2716] to-[#150D07] p-6 text-[#F5E9DA]">
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl tracking-wide">{v.titleEn}</div>
            <div className="mt-1.5 text-xs text-[#D5BDA2]">
              {v.status === "ready_to_open" ? (ar ? "مكافأتك جاهزة." : "Your reward is ready.") : ar ? `${v.requiredProgress - v.currentProgress} تواقيع لفتح مكافأتك` : `${v.requiredProgress - v.currentProgress} more to unlock your reward`}
            </div>
            {v.status === "ready_to_open" ? (
              <button onClick={() => onOpenVault(v)} disabled={pending} className="mt-4 rounded-lg bg-[#C9974F] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2B1B10] disabled:opacity-60">
                {ar ? "افتحي الفولت" : "Unlock the Vault"}
              </button>
            ) : (
              <button onClick={() => go("vault")} className="mt-4 rounded-lg border border-[#6C4E33] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E7D3BC]">
                {ar ? "عرض الفولت" : "View the Vault"}
              </button>
            )}
          </div>
          <div className="text-center">
            <div className="flex gap-1.5">
              {Array.from({ length: v.requiredProgress }).map((_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < v.currentProgress ? "bg-gradient-to-br from-[#C08E5C] to-[#7A4B27]" : "border border-[#6C4E33]"}`} />
              ))}
            </div>
            <div className="mt-3 font-serif text-2xl text-[#C9974F]">{v.currentProgress} / {v.requiredProgress}</div>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile k={ar ? "طلبات" : "Orders"} v={String(account.orders.length)} />
        <Tile k={ar ? "التواقيع" : "Signatures"} v={loyalty ? `${fmtN(loyalty.user.signatureBalance)} ${SIG}` : "—"} />
        <Tile k={ar ? "المستوى" : "Level"} v={loyalty ? loyalty.progress.currentLevelName.replace("The ", "") : "—"} />
        <Tile k={ar ? "الستريك" : "Streak"} v={loyalty ? String(loyalty.streak.currentStreak) : "0"} />
      </div>

      <Card title={ar ? "أحدث الطلبات" : "Recent orders"} action={<button onClick={() => go("orders")} className="text-[10px] uppercase tracking-[0.16em] text-[#A46C3C]">{ar ? "عرض الكل" : "View all"}</button>}>
        {account.orders.length === 0 ? (
          <Empty text={ar ? "لا توجد طلبات بعد." : "No orders yet."} cta={{ label: ar ? "ابدئي التسوق" : "Start shopping", href: "/shop" }} />
        ) : (
          <div className="divide-y divide-[#E4D7C5]">
            {account.orders.slice(0, 4).map((o) => {
              const st = orderStatus(o, ar);
              return (
                <button key={o.orderNumber} onClick={() => openOrderFn(o.orderNumber)} className="flex w-full items-center gap-3 py-3 text-start">
                  <Thumb label="BB" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">#{o.orderNumber}</div>
                    <div className="text-xs text-[#7C6450]">{new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")} · {money(o.total)}</div>
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] p-4 shadow-sm">
      <div className="text-[9px] uppercase tracking-wide text-[#7C6450]">{k}</div>
      <div className="mt-1 font-serif text-xl">{v}</div>
    </div>
  );
}
function Empty({ text, cta }: { text: string; cta?: { label: string; href: string } }) {
  return (
    <div className="py-8 text-center text-sm text-[#A08972]">
      {text}
      {cta && <div className="mt-3"><a href={cta.href} target="_top" className={btn}>{cta.label}</a></div>}
    </div>
  );
}

// ---- Orders -----------------------------------------------------------------
function Orders({ account, ar, money, open }: { account: Account; ar: boolean; money: (n: number) => string; open: (n: string) => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "delivered" | "cancelled">("all");
  const filters: [typeof filter, string, string][] = [["all", "All", "الكل"], ["active", "Active", "جارية"], ["delivered", "Delivered", "تم التسليم"], ["cancelled", "Cancelled", "ملغية"]];
  const rows = account.orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return o.lifecycle === "cancelled";
    if (filter === "delivered") return o.fulfillmentStatus === "fulfilled" || o.lifecycle === "completed";
    return o.lifecycle !== "cancelled" && o.fulfillmentStatus !== "fulfilled" && o.lifecycle !== "completed";
  });
  return (
    <>
      <PageHead title={ar ? "طلباتي" : "My Orders"} sub={ar ? "كل طلب بيزوّدك تواقيع ✦" : "Every order earns Signatures ✦"} />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map(([k, en, arLbl]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={`rounded-full border px-4 py-1.5 text-xs ${filter === k ? "border-[#3A291B] bg-[#3A291B] text-[#F2E8DA]" : "border-[#CDB99F] bg-[#FBF7F1] text-[#7C6450]"}`}>
            {ar ? arLbl : en}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Card><Empty text={ar ? "لا توجد طلبات مطابقة." : "No matching orders."} cta={{ label: ar ? "ابدئي التسوق" : "Start shopping", href: "/shop" }} /></Card>
      ) : rows.map((o) => {
        const st = orderStatus(o, ar);
        const pp = paymentPill(o.paymentStatus, ar);
        return (
          <article key={o.orderNumber} className="mb-3 overflow-hidden rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] shadow-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E4D7C5] bg-[#F3E9DC] px-4 py-3">
              <Field k={ar ? "رقم الطلب" : "Order"} v={`#${o.orderNumber}`} />
              <Field k={ar ? "التاريخ" : "Placed"} v={new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")} />
              <Field k={ar ? "الإجمالي" : "Total"} v={money(o.total)} />
              <div className="ms-auto flex gap-2"><Pill tone={pp.tone}>{pp.label}</Pill><Pill tone={st.tone}>{st.label}</Pill></div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-[#7C6450]">{new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</span>
              <button onClick={() => open(o.orderNumber)} className={btn}>{ar ? "تفاصيل الطلب" : "Order details"}</button>
            </div>
          </article>
        );
      })}
    </>
  );
}
function Field({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[8.5px] uppercase tracking-[0.18em] text-[#A08972]">{k}</div><div className="font-serif text-sm">{v}</div></div>;
}

// ---- Order detail -----------------------------------------------------------
const LIFECYCLE_ORDER = ["placed", "confirmed", "packed", "shipped", "completed"];
function OrderDetail({ orderNumber, ar, money, onBack }: { orderNumber: string; ar: boolean; money: (n: number) => string; onBack: () => void }) {
  const [o, setO] = useState<MyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getMyOrder(orderNumber);
      if (res.ok) { setO(res.data); setErr(null); } else setErr(res.error);
      setLoading(false);
    })();
  }, [orderNumber]);

  const steps: [string, string][] = [["placed", ar ? "تم الطلب" : "Placed"], ["packed", ar ? "تم التجهيز" : "Packed"], ["shipped", ar ? "في الطريق" : "On the way"], ["completed", ar ? "تم التسليم" : "Delivered"]];
  const reached = o ? LIFECYCLE_ORDER.indexOf(o.lifecycle) : -1;
  const stepReached = (key: string) => {
    const map: Record<string, number> = { placed: 0, packed: 1, shipped: 2, completed: 3 };
    const need = { placed: 0, packed: 2, shipped: 3, completed: 4 }[key] ?? 0;
    return o?.fulfillmentStatus === "fulfilled" ? true : reached >= need || map[key] === 0;
  };

  return (
    <>
      <button onClick={onBack} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#A46C3C]">← {ar ? "رجوع للطلبات" : "Back to orders"}</button>
      {loading ? (
        <Card><div className="py-8 text-center text-sm text-[#A08972]">{ar ? "جارٍ التحميل…" : "Loading…"}</div></Card>
      ) : err || !o ? (
        <Card><div className="py-8 text-center text-sm text-[#9B4B41]">{ar ? "تعذّر تحميل الطلب." : "Couldn't load this order."}</div></Card>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">{ar ? "تفاصيل الطلب" : "Order Detail"} #{o.orderNumber}</h2>
            {(() => { const st = orderStatus(o, ar); return <Pill tone={st.tone}>{st.label}</Pill>; })()}
          </div>
          <p className="mb-4 text-sm text-[#7C6450]">{new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>

          {o.lifecycle !== "cancelled" && (
            <Card>
              <div className="flex">
                {steps.map(([key, label], i) => {
                  const done = stepReached(key);
                  return (
                    <div key={key} className="relative flex-1 text-center text-[9.5px] uppercase tracking-[0.08em] text-[#A08972]">
                      {i > 0 && <span className={`absolute top-2.5 h-px w-full ${done ? "bg-[#A46C3C]" : "bg-[#CDB99F]"}`} style={{ insetInlineStart: "-50%" }} />}
                      <span className={`relative z-10 mx-auto mb-2 grid h-5 w-5 place-items-center rounded-full text-[9px] ${done ? "bg-gradient-to-br from-[#C08E5C] to-[#7A4B27] text-white" : "border border-[#CDB99F] bg-[#FBF7F1]"}`}>{done ? "✓" : ""}</span>
                      <span className={done ? "text-[#3A291B]" : ""}>{label}</span>
                    </div>
                  );
                })}
              </div>
              {o.fulfillments.some((f) => f.tracking) && (
                <div className="mt-4 space-y-1.5 border-t border-dashed border-[#E4D7C5] pt-3">
                  {o.fulfillments.filter((f) => f.tracking).map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#7C6450]">{f.carrier || (ar ? "شحن" : "Shipment")}</span>
                      <span className="font-mono text-[#3A291B]" dir="ltr">{f.tracking}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card title={ar ? "المنتجات" : "Products"}>
              <div className="divide-y divide-[#E4D7C5]">
                {o.items.map((li, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#E4D7C5] bg-[#F3E9DC]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {li.imageUrl ? <img src={li.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{li.productName}</div>
                      <div className="text-xs text-[#7C6450]">{li.variantTitle ? `${li.variantTitle} · ` : ""}{ar ? `الكمية ${li.quantity}` : `Qty ${li.quantity}`}</div>
                    </div>
                    <div className="font-serif text-sm">{money(li.price * li.quantity)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card title={ar ? "ملخص الدفع" : "Payment summary"}>
                <Sum k={ar ? "الإجمالي الفرعي" : "Subtotal"} v={money(o.subtotal || o.total)} />
                <Sum k={ar ? "الشحن" : "Shipping"} v={o.shipping ? money(o.shipping) : (ar ? "مجاني" : "Free")} />
                <div className="mt-2 flex items-center justify-between border-t border-[#E4D7C5] pt-2"><span className="text-sm">{ar ? "الإجمالي" : "Total"}</span><span className="font-serif text-lg">{money(o.total)}</span></div>
                <Sum k={ar ? "المدفوع" : "Paid"} v={money(o.amountPaid)} muted />
                {o.balance > 0 && <Sum k={ar ? "المتبقي" : "Balance"} v={money(o.balance)} />}
              </Card>
              <Card title={ar ? "عنوان الشحن" : "Shipping address"}>
                <div className="text-sm text-[#7C6450]">
                  <div className="text-[#3A291B]">{o.customerName}</div>
                  {[o.address, o.city, o.governorate].filter(Boolean).join("، ")}
                </div>
              </Card>
              <Card title={ar ? "طريقة الدفع" : "Payment method"}>
                <div className="text-sm">{o.paymentMethod === "cod" ? (ar ? "الدفع عند الاستلام" : "Cash on delivery") : o.paymentMethod}</div>
              </Card>
              <a href="/shop/requests" target="_top" className={`${btnGhost} block text-center`}>{ar ? "إرجاع أو استبدال" : "Return or exchange"}</a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
function Sum({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return <div className={`flex items-center justify-between py-1 text-sm ${muted ? "text-[#A08972]" : "text-[#7C6450]"}`}><span>{k}</span><span className={muted ? "" : "text-[#3A291B]"}>{v}</span></div>;
}

// ---- Returns ----------------------------------------------------------------
function Returns({ ar }: { ar: boolean }) {
  return (
    <>
      <PageHead title={ar ? "الإرجاع والاستبدال" : "Returns & Exchanges"} sub={ar ? "عندك ١٤ يوم من الاستلام ترجّعي أو تستبدلي" : "You have 14 days from delivery to return or exchange"} />
      <Card>
        <div className="py-6 text-center">
          <div className="text-4xl">↩︎</div>
          <p className="mx-auto mt-3 max-w-sm text-sm text-[#7C6450]">{ar ? "ابدئي طلب إرجاع أو استبدال لأي منتج من طلباتك." : "Start a return or exchange for any item from your orders."}</p>
          <a href="/shop/requests" target="_top" className={`${btn} mt-4`}>{ar ? "بدء طلب إرجاع" : "Start a request"}</a>
        </div>
      </Card>
    </>
  );
}

// ---- Wishlist (per-device) --------------------------------------------------
type Wish = { id: string; name: string; price?: number; image?: string };
function Wishlist({ ar, money }: { ar: boolean; money: (n: number) => string }) {
  const [items, setItems] = useState<Wish[]>([]);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem("bb_wishlist") || "[]")); } catch { setItems([]); }
  }, []);
  function remove(id: string) {
    const next = items.filter((w) => w.id !== id);
    setItems(next);
    try { localStorage.setItem("bb_wishlist", JSON.stringify(next)); } catch { /* ignore */ }
  }
  return (
    <>
      <PageHead title={ar ? "المفضلة" : "Wishlist"} sub={ar ? "المنتجات اللي حفظتيها" : "The products you saved"} />
      {items.length === 0 ? (
        <Card><Empty text={ar ? "قائمة المفضلة فارغة." : "Your wishlist is empty."} cta={{ label: ar ? "تصفّحي المتجر" : "Browse the shop", href: "/shop" }} /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((w) => (
            <div key={w.id} className="overflow-hidden rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] shadow-sm">
              <div className="grid aspect-square place-items-center bg-gradient-to-br from-[#EFE2D2] to-[#D9C2A5] font-serif text-[#8A6743]">{w.name.slice(0, 2).toUpperCase()}</div>
              <div className="p-3">
                <div className="line-clamp-1 text-xs">{w.name}</div>
                {w.price != null && <div className="mt-1 font-serif text-sm">{money(w.price)}</div>}
                <button onClick={() => remove(w.id)} className="mt-2 text-[10px] uppercase tracking-wide text-[#9B4B41]">{ar ? "إزالة" : "Remove"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Addresses --------------------------------------------------------------
function Addresses({ account, ar, onSaved }: { account: Account; ar: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const has = Boolean(account.address || account.city || account.governorate);
  return (
    <>
      <PageHead title={ar ? "عناويني" : "My Addresses"} sub={ar ? "عنوان الشحن المحفوظ" : "Your saved shipping address"} />
      {editing ? (
        <AddressForm account={account} ar={ar} onDone={() => { setEditing(false); onSaved(); }} onCancel={() => setEditing(false)} />
      ) : has ? (
        <Card title={ar ? "الافتراضي" : "Default"} action={<button onClick={() => setEditing(true)} className="text-[10px] uppercase tracking-[0.16em] text-[#A46C3C]">{ar ? "تعديل" : "Edit"}</button>}>
          <div className="text-sm leading-7 text-[#7C6450]">
            <div className="text-[#3A291B]">{account.name}</div>
            {[account.address, account.city, account.governorate].filter(Boolean).join("، ")}
            <div dir="ltr">{account.phone}</div>
          </div>
        </Card>
      ) : (
        <Card><Empty text={ar ? "لا يوجد عنوان محفوظ." : "No saved address yet."} /><div className="text-center"><button onClick={() => setEditing(true)} className={btn}>{ar ? "إضافة عنوان" : "Add address"}</button></div></Card>
      )}
    </>
  );
}
function AddressForm({ account, ar, onDone, onCancel }: { account: Account; ar: boolean; onDone: () => void; onCancel: () => void }) {
  const [address, setAddress] = useState(account.address || "");
  const [city, setCity] = useState(account.city || "");
  const [governorate, setGovernorate] = useState(account.governorate || "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await saveMyProfile({ address, city, governorate });
    setBusy(false);
    onDone();
  }
  return (
    <Card title={ar ? "تعديل العنوان" : "Edit address"}>
      <div className="space-y-3">
        <Input label={ar ? "العنوان" : "Address"} value={address} onChange={setAddress} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={ar ? "المدينة" : "City"} value={city} onChange={setCity} />
          <Input label={ar ? "المحافظة" : "Governorate"} value={governorate} onChange={setGovernorate} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className={btnGhost}>{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className={`${btn} disabled:opacity-50`}>{busy ? "…" : ar ? "حفظ" : "Save"}</button>
        </div>
      </div>
    </Card>
  );
}

// ---- Payment & Wallet -------------------------------------------------------
function Payment({ loyalty, ar, money }: { loyalty: LoyaltySummary | null; ar: boolean; money: (n: number) => string }) {
  void money;
  return (
    <>
      <PageHead title={ar ? "الدفع والمحفظة" : "Payment & Wallet"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#4A3120] bg-gradient-to-br from-[#3E2716] to-[#150D07] p-6 text-[#F5E9DA]">
          <div className="text-[10px] uppercase tracking-wider text-[#C7AE93]">{ar ? "رصيد التواقيع" : "Signature balance"}</div>
          <div className="mt-1 font-serif text-4xl text-[#C9974F]">{loyalty ? `${fmtN(loyalty.user.signatureBalance)} ${SIG}` : "—"}</div>
          {loyalty?.progress.nextLevel && <div className="mt-2 text-xs text-[#D5BDA2]">{fmtN(loyalty.progress.remaining ?? 0)} {ar ? `للوصول إلى ${loyalty.progress.nextLevelName}` : `until ${loyalty.progress.nextLevelName}`}</div>}
        </div>
        <Card title={ar ? "طرق الدفع" : "Payment methods"}>
          <div className="space-y-2 text-sm text-[#7C6450]">
            <div className="rounded-lg bg-[#F3E9DC] px-3 py-2.5"><div className="text-[#3A291B]">{ar ? "الدفع عند الاستلام" : "Cash on delivery"}</div><div className="text-xs">{ar ? "متاح في كل المحافظات" : "Available in all governorates"}</div></div>
            <div className="rounded-lg bg-[#F3E9DC] px-3 py-2.5"><div className="text-[#3A291B]">{ar ? "تقسيط" : "Instalments"}</div><div className="text-xs">valU · Aman · Contact</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[#7C6450]">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#CDB99F] bg-[#FBF7F1] px-3 py-2 text-sm text-[#3A291B] outline-none focus:border-[#A46C3C]" />
    </label>
  );
}

// ---- Society: Vaults / Rewards / Levels / Activity --------------------------
function Vaults({ loyalty, ar, onOpen, pending }: { loyalty: LoyaltySummary; ar: boolean; onOpen: (v: VaultView) => void; pending: boolean }) {
  return (
    <>
      <PageHead title={ar ? "الفولت" : "The Vault"} />
      <div className="space-y-3">
        {loyalty.vaults.map((v) => (
          <div key={v.id} className="rounded-2xl border border-[#4A3120] bg-gradient-to-br from-[#2B1B10] to-[#43301F] p-5 text-[#F0E6D8]">
            <div className="font-serif text-lg">{v.titleEn}</div>
            {v.descriptionEn && <div className="mt-0.5 text-xs text-[#C9B79F]">{v.descriptionEn}</div>}
            {v.locked ? (
              <div className="mt-4 rounded-xl bg-white/10 py-3 text-center text-sm text-[#C9B79F]">🔒 {ar ? `يُفتح عند ${v.levelRequired}` : `Unlocks at ${v.levelRequired}`}</div>
            ) : (
              <>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: v.requiredProgress }).map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < v.currentProgress ? "bg-[#C9974F]" : "bg-white/15"}`} />
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#C9B79F]">{v.currentProgress} / {v.requiredProgress}</div>
                {v.status === "ready_to_open" ? (
                  <button onClick={() => onOpen(v)} disabled={pending} className="mt-3 w-full rounded-xl bg-[#C9974F] py-2.5 text-sm font-semibold text-[#2B1B10] disabled:opacity-60">{pending ? "…" : ar ? "افتحي الآن" : "Open now"}</button>
                ) : v.status === "opened" ? (
                  <div className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-center text-sm text-[#C9B79F]">{ar ? "تم الفتح ✓" : "Opened ✓"}</div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
function Rewards({ loyalty, ar, onRedeem, pending }: { loyalty: LoyaltySummary; ar: boolean; onRedeem: (r: RewardView) => void; pending: boolean }) {
  return (
    <>
      <PageHead title={ar ? "مكافآتي" : "My Rewards"} />
      <Card title={ar ? "متاح بالتواقيع" : "Redeem with signatures"}>
        <div className="space-y-2">
          {loyalty.availableRewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl bg-[#F3E9DC] p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{ar ? r.titleAr ?? r.titleEn : r.titleEn}</div>
                <div className="text-xs text-[#7C6450]">{r.signatureCost > 0 ? `${fmtN(r.signatureCost)} ${SIG}` : ar ? "مكافأة مستوى" : "Level reward"}{r.lockedReason === "level" && r.minLevel ? ` · ${r.minLevel}+` : ""}</div>
              </div>
              {r.status === "affordable" ? (
                <button onClick={() => onRedeem(r)} disabled={pending} className="rounded-lg bg-gradient-to-br from-[#C08E5C] to-[#7A4B27] px-3 py-1.5 text-xs font-semibold text-[#FFF6EA] disabled:opacity-60">{ar ? "استبدال" : "Redeem"}</button>
              ) : r.lockedReason === "level" ? <span className="text-lg">🔒</span> : <span className="rounded-lg bg-[#E4D7C5] px-3 py-1.5 text-xs text-[#A08972]">{ar ? "مقفل" : "Locked"}</span>}
            </div>
          ))}
        </div>
      </Card>
      {loyalty.myRewards.length > 0 && (
        <Card title={ar ? "مكافآتي المستبدلة" : "Claimed"}>
          <div className="space-y-2">
            {loyalty.myRewards.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#F3E9DC] p-3">
                <div><div className="text-sm">{r.title}</div>{r.code && <div className="font-mono text-xs text-[#A46C3C]">{r.code}</div>}</div>
                <span className="rounded-full bg-[#E4D7C5] px-2.5 py-1 text-[10px] capitalize text-[#7C6450]">{r.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
function Levels({ loyalty, ar }: { loyalty: LoyaltySummary; ar: boolean }) {
  const curSort = loyalty.levels.find((l) => l.key === loyalty.user.currentLevel)?.sort ?? 1;
  return (
    <>
      <PageHead title={ar ? "المستويات" : "The Levels"} />
      <div className="space-y-2">
        {loyalty.levels.map((l) => {
          const cur = l.key === loyalty.user.currentLevel;
          const reached = l.sort <= curSort;
          return (
            <div key={l.key} className={`rounded-2xl p-4 ${cur ? "bg-gradient-to-br from-[#C08E5C] to-[#7A4B27] text-white" : reached ? "border border-[#E4D7C5] bg-[#FBF7F1]" : "border border-[#E4D7C5] bg-[#F3E9DC]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[10px] tracking-widest ${cur ? "text-white/70" : "text-[#A08972]"}`}>0{l.sort}</div>
                  <div className={`font-serif text-lg ${cur ? "text-white" : ""}`}>{ar ? l.nameAr : l.nameEn}</div>
                  {(ar ? l.taglineAr : l.taglineEn) && <div className={`text-xs ${cur ? "text-white/80" : "text-[#7C6450]"}`}>{ar ? l.taglineAr : l.taglineEn}</div>}
                </div>
                <div className={`text-end ${cur ? "text-white" : ""}`}>
                  <div className="font-serif text-lg">{fmtN(l.threshold)}</div>
                  <div className="text-[9px] uppercase tracking-wide opacity-70">{reached ? (ar ? "تم" : "reached") : SIG}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
function Activity({ loyalty, ar }: { loyalty: LoyaltySummary; ar: boolean }) {
  return (
    <>
      <PageHead title={ar ? "النشاط" : "Activity"} sub={ar ? "سجل التواقيع" : "Your signature history"} />
      <Card>
        {loyalty.recentActivity.length === 0 ? (
          <Empty text={ar ? "لا يوجد نشاط بعد." : "No activity yet."} />
        ) : (
          <div className="space-y-1.5">
            {loyalty.recentActivity.map((t) => {
              const credit = t.direction !== "spend" && t.direction !== "expire";
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-[#F3E9DC] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{t.description || t.sourceType}</div>
                    <div className="text-[11px] text-[#A08972]">{new Date(t.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</div>
                  </div>
                  <div className={`text-sm font-bold ${credit ? "text-[#5F7A55]" : "text-[#9B4B41]"}`}>{credit ? "+" : "−"}{fmtN(t.amount)} {SIG}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

// ---- Profile ----------------------------------------------------------------
function Profile({ account, ar, onSaved }: { account: Account; ar: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name || "");
  const [email, setEmail] = useState(account.email || "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await saveMyProfile({ name, email });
    setBusy(false);
    setEditing(false);
    onSaved();
  }
  return (
    <>
      <PageHead title={ar ? "بياناتي" : "Personal Details"} />
      <Card title={ar ? "البيانات الشخصية" : "Personal details"} action={!editing ? <button onClick={() => setEditing(true)} className="text-[10px] uppercase tracking-[0.16em] text-[#A46C3C]">{ar ? "تعديل" : "Edit"}</button> : null}>
        {editing ? (
          <div className="space-y-3">
            <Input label={ar ? "الاسم بالكامل" : "Full name"} value={name} onChange={setName} />
            <Input label={ar ? "البريد الإلكتروني" : "Email"} value={email} onChange={setEmail} type="email" />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className={btnGhost}>{ar ? "إلغاء" : "Cancel"}</button>
              <button onClick={save} disabled={busy} className={`${btn} disabled:opacity-50`}>{busy ? "…" : ar ? "حفظ" : "Save"}</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <FieldRow k={ar ? "الاسم" : "Name"} v={account.name || "—"} />
            <FieldRow k={ar ? "الموبايل" : "Mobile"} v={account.phone} ltr />
            <FieldRow k={ar ? "البريد" : "Email"} v={account.email || "—"} />
            <FieldRow k={ar ? "المحافظة" : "Governorate"} v={account.governorate || "—"} />
          </div>
        )}
      </Card>
    </>
  );
}
function FieldRow({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="border-b border-dashed border-[#E4D7C5] py-3 last:border-0">
      <div className="text-[10px] uppercase tracking-wide text-[#7C6450]">{k}</div>
      <div className="mt-0.5 text-sm" dir={ltr ? "ltr" : undefined}>{v}</div>
    </div>
  );
}

// ---- Notifications (per-device prefs) ---------------------------------------
function Notifications({ ar }: { ar: boolean }) {
  const rows: [string, string, string][] = [
    ["orders", ar ? "تحديثات الطلب" : "Order updates", ar ? "حالة الشحنة ووقت التوصيل" : "Shipment status and delivery window"],
    ["society", ar ? "لحظات سوسايتي" : "Society moments", ar ? "الدروبات والساعات الخاصة" : "Drops and private hours"],
    ["price", ar ? "نزول سعر المفضلة" : "Wishlist price drop", ar ? "أول ما السعر ينزل" : "The moment a price falls"],
    ["stock", ar ? "رجوع منتج للمخزن" : "Back in stock", ar ? "لمّا منتج نفذ يرجع" : "When a sold-out item returns"],
  ];
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ orders: true, society: true, price: true, stock: false });
  useEffect(() => {
    try { const s = localStorage.getItem("bb_notif"); if (s) setPrefs((p) => ({ ...p, ...JSON.parse(s) })); } catch { /* ignore */ }
  }, []);
  function toggle(k: string) {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      try { localStorage.setItem("bb_notif", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  return (
    <>
      <PageHead title={ar ? "الإشعارات" : "Notifications"} sub={ar ? "اختاري إيه اللي يوصلك" : "Choose what you get"} />
      <Card>
        {rows.map(([k, t, s]) => (
          <div key={k} className="flex items-center gap-4 border-b border-dashed border-[#E4D7C5] py-3.5 last:border-0">
            <div className="min-w-0 flex-1"><div className="text-sm">{t}</div><div className="text-xs text-[#7C6450]">{s}</div></div>
            <button onClick={() => toggle(k)} aria-pressed={prefs[k]} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${prefs[k] ? "bg-gradient-to-br from-[#C08E5C] to-[#7A4B27]" : "bg-[#CDB99F]"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${prefs[k] ? "start-[18px]" : "start-0.5"}`} />
            </button>
          </div>
        ))}
      </Card>
    </>
  );
}

// ---- error text -------------------------------------------------------------
function loyaltyError(code: string, ar: boolean): string {
  const m: Record<string, { ar: string; en: string }> = {
    insufficient_signatures: { ar: "التواقيع غير كافية.", en: "Not enough signatures yet." },
    level_too_low: { ar: "هذه المكافأة لمستوى أعلى.", en: "This reward is for a higher level." },
    already_redeemed: { ar: "تم استبدالها من قبل.", en: "You've already claimed this." },
    vault_already_opened: { ar: "تم فتح الفولت من قبل.", en: "Already opened." },
    vault_not_ready: { ar: "الفولت لسه مش جاهز.", en: "This vault isn't ready yet." },
  };
  const e = m[code];
  return e ? (ar ? e.ar : e.en) : ar ? "حدث خطأ." : "Something went wrong.";
}
