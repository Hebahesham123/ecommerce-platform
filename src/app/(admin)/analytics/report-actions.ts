"use server";

import {
  getBreakdowns,
  getLive,
  getOverview,
  getTopProducts,
  type Breakdowns,
  type Live,
  type Overview,
  type ProductRow,
  type ReportChannel,
  type Result,
} from "@/lib/analytics-reports";

/** The Analytics overview page's reads. Periods arrive as ISO times; channel as all/web/app. */

const channelOf = (c: string): ReportChannel => (c === "web" || c === "app" ? c : "all");
const isoOf = (v: string) => {
  const t = new Date(v);
  return Number.isFinite(t.getTime()) ? t.toISOString() : new Date().toISOString();
};

export async function overviewAction(from: string, to: string, channel: string): Promise<Result<{ now: Overview; before: Overview }>> {
  return getOverview(isoOf(from), isoOf(to), channelOf(channel));
}

export async function breakdownsAction(from: string, to: string, channel: string): Promise<Result<Breakdowns>> {
  return getBreakdowns(isoOf(from), isoOf(to), channelOf(channel));
}

export async function productsAction(from: string, to: string, channel: string): Promise<Result<ProductRow[]>> {
  return getTopProducts(isoOf(from), isoOf(to), channelOf(channel));
}

export async function liveAction(): Promise<Result<Live>> {
  return getLive();
}
