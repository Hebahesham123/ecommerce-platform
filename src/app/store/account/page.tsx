import { redirect } from "next/navigation";
import { getAccount } from "../auth-actions";
import { getMyLoyalty } from "../loyalty-actions";
import AccountApp from "./account-app";

// The session lives in a cookie, so this page can never be static.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await getAccount();
  if (!account) redirect("/store/login?next=/store/account");

  // Loyalty is optional: if the migration isn't applied yet the account still
  // works, just without the Society sections.
  const loyaltyRes = await getMyLoyalty();
  const loyalty = loyaltyRes.ok ? loyaltyRes.data : null;

  return <AccountApp account={account} loyalty={loyalty} />;
}
