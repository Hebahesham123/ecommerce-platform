"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, egp } from "@/lib/i18n";
import type { Account } from "@/lib/account-service";
import type { LoyaltySummary, RewardView, VaultView } from "@/lib/loyalty/types";
import { getMyLoyalty, redeemMyReward, openMyVault } from "../loyalty-actions";
import { getMyOrder, saveMyProfile, type MyOrder } from "../account-actions";
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
function hrefFor(p: PageKey): string {
  return p === "overview" ? "/store/account" : `/store/account/${p}`;
}

export default function AccountApp({
  account,
  loyalty: initialLoyalty,
  section,
  orderNumber,
}: {
  account: Account;
  loyalty: LoyaltySummary | null;
  section: PageKey;
  orderNumber?: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const money = (n: number) => egp(n, lang);

  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(initialLoyalty);
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

  const nav: { title: string | null; items: [PageKey, string, string][] }[] = [
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
    ...(loyalty ? [{ title: "Beauty Bar Society", items: [
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

  return (
    <div className="min-h-screen bg-[#F2E8DA] text-[#3A291B]" dir={ar ? "rtl" : "ltr"}>
      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] p-5 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#CDB99F] bg-gradient-to-br from-[#D9BFA2] to-[#A8764A] font-serif text-2xl text-white">
              {initials}
            </div>
            <div className="mt-3 font-serif text-lg">{account.name || (ar ? "عميلة" : "Customer")}</div>
            {account.email && <div className="text-xs text-[#7C6450]">{account.email}</div>}
            {loyalty && (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A46C3C]">
                {loyalty.progress.currentLevelName} {SIG}
              </div>
            )}
            <div className="mt-4 flex border-t border-[#E4D7C5] pt-3 text-center">
              <Stat v={loyalty ? `${fmtN(loyalty.user.signatureBalance)}` : "—"} k={ar ? "توقيع" : "Signatures"} />
              <Stat v={String(account.orders.length)} k={ar ? "طلبات" : "Orders"} border />
              <Stat v={loyalty ? String(loyalty.streak.currentStreak) : "0"} k={ar ? "ستريك" : "Streak"} border />
            </div>
            {loyalty && loyalty.progress.nextLevel && (
              <div className="mt-4 border-t border-dashed border-[#E4D7C5] pt-3 text-start">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#7C6450]">
                  <span>{ar ? "التقدّم" : "Progress"}</span>
                  <span className="font-serif text-sm text-[#A46C3C]">{fmtN(loyalty.user.signatureBalance)} {SIG}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded bg-[#E4D7C5]">
                  <div className="h-full bg-gradient-to-r from-[#C08E5C] to-[#7A4B27]" style={{ width: `${loyalty.progress.percentage}%` }} />
                </div>
                <div className="mt-1.5 text-[10px] text-[#7C6450]">
                  {fmtN(loyalty.progress.remaining ?? 0)} {ar ? `للوصول إلى ${loyalty.progress.nextLevelName}` : `until ${loyalty.progress.nextLevelName}`}
                </div>
              </div>
            )}
          </div>

          {nav.map((g, gi) => (
            <div key={gi} className="rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] p-1.5 shadow-sm">
              {g.title && <div className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#A08972]">{g.title}</div>}
              {g.items.map(([key, en, arLbl]) => {
                const on = page === key;
                return (
                  <Link
                    key={key}
                    href={hrefFor(key)}
                    aria-current={on}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${
                      on ? "bg-gradient-to-br from-[#C08E5C] to-[#7A4B27] text-[#FFF6EA]" : "text-[#7C6450] hover:bg-[#F3E9DC]"
                    }`}
                  >
                    <span className="flex-1">{ar ? arLbl : en}</span>
                    {navValue[key] ? <span className={`text-[10px] ${on ? "text-[#F1D9BE]" : "text-[#A08972]"}`}>{navValue[key]}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="rounded-2xl border border-[#E4D7C5] bg-[#FBF7F1] p-1.5 shadow-sm">
            <button
              onClick={() => start(async () => { await logout(); router.push("/shop"); })}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-[#9B4B41] hover:bg-[#F3E9DC]"
            >
              {ar ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {orderNumber && page === "orders" ? (
            <OrderDetail orderNumber={orderNumber} ar={ar} money={money} onBack={() => router.push("/store/account/orders")} />
          ) : (
            <>
              {page === "overview" && <Overview account={account} loyalty={loyalty} ar={ar} money={money} go={go} openOrderFn={openOrderNav} onOpenVault={onOpenVault} pending={pending} />}
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
function Stat({ v, k, border }: { v: string; k: string; border?: boolean }) {
  return (
    <div className={`flex-1 ${border ? "border-s border-[#E4D7C5]" : ""}`}>
      <div className="font-serif text-lg">{v}</div>
      <div className="text-[8.5px] uppercase tracking-wide text-[#7C6450]">{k}</div>
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
function Overview({ account, loyalty, ar, money, go, openOrderFn, onOpenVault, pending }: {
  account: Account; loyalty: LoyaltySummary | null; ar: boolean; money: (n: number) => string;
  go: (p: PageKey) => void; openOrderFn: (n: string) => void; onOpenVault: (v: VaultView) => void; pending: boolean;
}) {
  const v = loyalty?.primaryVault;
  return (
    <>
      <PageHead title={ar ? `أهلاً، ${account.name?.split(" ")[0] || ""}` : `Hello, ${account.name?.split(" ")[0] || "there"}`} sub={ar ? "نظرة سريعة على حسابك وعضويتك" : "A quick look at your account and membership"} />

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
      {cta && <div className="mt-3"><a href={cta.href} className={btn}>{cta.label}</a></div>}
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
              <a href="/store/returns" className={`${btnGhost} block text-center`}>{ar ? "إرجاع أو استبدال" : "Return or exchange"}</a>
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
          <a href="/store/returns" className={`${btn} mt-4`}>{ar ? "بدء طلب إرجاع" : "Start a request"}</a>
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
