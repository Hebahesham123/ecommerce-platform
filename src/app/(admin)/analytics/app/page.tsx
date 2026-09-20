import { report } from "@/lib/analytics";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { AppAnalytics } from "../views";

export const dynamic = "force-dynamic";

/** Orders placed in the last 30 days, split by the surface that took them. */
async function ordersByChannel(): Promise<{ app: number; web: number }> {
  if (!isSupabaseConfigured()) return { app: 0, web: 0 };
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await getServerSupabase()
      .from("store_orders")
      .select("channel,lifecycle,created_at")
      .gte("created_at", since)
      .limit(5000);
    const live = (data ?? []).filter((o) => String(o.lifecycle ?? "") !== "cancelled");
    return {
      app: live.filter((o) => String(o.channel ?? "web") === "app").length,
      web: live.filter((o) => String(o.channel ?? "web") !== "app").length,
    };
  } catch {
    return { app: 0, web: 0 };
  }
}

export default async function AppAnalyticsPage() {
  const [data, orders] = await Promise.all([report("app", 30), ordersByChannel()]);
  return <AppAnalytics report={data} appOrders={orders.app} webOrders={orders.web} />;
}
