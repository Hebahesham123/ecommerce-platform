import { AppRequests } from "./app-requests";

/**
 * Returns, exchanges and enquiries from the app, together.
 *
 * `?tab=enquiries` opens on the second one, so the cards on the App overview
 * can link straight to the thing they are counting.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <AppRequests initialTab={tab === "enquiries" ? "enquiries" : "returns"} />;
}
