import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "../auth-actions";
import LogoutButton from "./logout-button";

// The session lives in a cookie, so this page can never be static.
export const dynamic = "force-dynamic";

const money = (n: number) =>
  `E£${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

export default async function AccountPage() {
  const account = await getAccount();
  if (!account) redirect("/store/login");

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {account.name ? `Hi, ${account.name}` : "Your account"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted" dir="ltr">{account.phone}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-ink">Details</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-2xl border border-line p-5 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-ink-muted">Name</dt>
            <dd className="text-ink sm:mt-0.5">{account.name || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-ink-muted">Phone</dt>
            <dd className="text-ink sm:mt-0.5" dir="ltr">{account.phone}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-ink-muted">Email</dt>
            <dd className="text-ink sm:mt-0.5">{account.email || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-ink-muted">Address</dt>
            <dd className="text-ink sm:mt-0.5">
              {[account.address, account.city, account.governorate].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-ink">
          Orders {account.orders.length > 0 && <span className="text-ink-soft">({account.orders.length})</span>}
        </h2>

        {account.orders.length === 0 ? (
          <div className="rounded-2xl border border-line p-8 text-center">
            <p className="text-sm text-ink-muted">No orders yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {account.orders.map((o) => (
              <li key={o.orderNumber}>
                <Link
                  href={`/store/order/${o.orderNumber}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{o.orderNumber}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{day(o.createdAt)}</div>
                  </div>
                  <span className="hidden rounded-full bg-surface-page px-2.5 py-1 text-xs font-medium capitalize text-ink-muted sm:inline">
                    {o.lifecycle}
                  </span>
                  <div className="text-sm font-semibold text-ink" dir="ltr">{money(o.total)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
