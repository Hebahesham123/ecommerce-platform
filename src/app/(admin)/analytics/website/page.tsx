import { report } from "@/lib/analytics";
import { WebsiteAnalytics } from "../views";

export const dynamic = "force-dynamic";

/** What the storefront did this month, counted by the storefront itself. */
export default async function WebsiteAnalyticsPage() {
  return <WebsiteAnalytics report={await report("web", 30)} />;
}
