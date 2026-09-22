import { redirect } from "next/navigation";
import { getAccount } from "../../auth-actions";
import { getMyLoyalty } from "../../loyalty-actions";
import { getPageCopy } from "@/lib/page-copy-server";
import { PAGE_COPY } from "@/lib/page-copy";
import AccountApp, { type PageKey } from "../account-app";

// The session lives in a cookie, so this can never be static.
export const dynamic = "force-dynamic";

// Each account section is its own page/URL (/store/account/orders,
// /store/account/vault, …). This optional catch-all serves them all with the
// shared account shell; the section (and any order number) comes from the path.
const SECTIONS: PageKey[] = [
  "overview", "orders", "returns", "wishlist",
  "addresses", "payment",
  "vault", "rewards", "levels", "activity",
  "profile", "notif",
];

export default async function AccountSectionPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const first = section[0] || "overview";
  const key = (SECTIONS.includes(first as PageKey) ? first : "overview") as PageKey;
  const orderNumber = key === "orders" ? section[1] : undefined;

  const account = await getAccount();
  if (!account) redirect("/store/login?next=/store/account");

  const [loyaltyRes, copy] = await Promise.all([
    getMyLoyalty(),
    getPageCopy(PAGE_COPY["web-account"].section),
  ]);
  const loyalty = loyaltyRes.ok ? loyaltyRes.data : null;

  return (
    <AccountApp
      account={account}
      loyalty={loyalty}
      section={key}
      orderNumber={orderNumber}
      copy={copy}
    />
  );
}
