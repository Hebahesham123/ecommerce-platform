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
import {
  getJourney,
  getPageTime,
  getTopClicks,
  getTopSearches,
  getVisitorList,
  visitorIdsForPhone,
  type ClickRow,
  type Journey,
  type PageTimeRow,
  type SearchRow,
  type VisitorRow,
} from "@/lib/analytics-reports";
import { getCohorts, getSellThrough, type CohortRow, type SellThroughRow } from "@/lib/analytics-reports";
import { phoneVariants } from "@/lib/phone";

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

/* ---- Visitors and journeys ---- */


export async function visitorsAction(input: {
  from: string;
  to: string;
  channel: string;
  who: string;
  search: string;
  page: number;
}): Promise<Result<{ total: number; rows: VisitorRow[] }>> {
  const who = input.who === "known" || input.who === "anonymous" ? input.who : "all";
  const limit = 50;
  return getVisitorList({
    from: isoOf(input.from),
    to: isoOf(input.to),
    channel: channelOf(input.channel),
    who,
    search: input.search,
    limit,
    offset: Math.max(0, Math.floor(input.page)) * limit,
  });
}

export async function journeyAction(visitorId: string): Promise<Result<Journey>> {
  return getJourney([visitorId]);
}

/** A customer's journey across every browser and phone she has been seen on. */
export async function customerJourneyAction(phone: string): Promise<Result<Journey>> {
  const ids = await visitorIdsForPhone(phoneVariants(phone));
  return getJourney(ids);
}

export async function searchesAction(from: string, to: string, channel: string): Promise<Result<SearchRow[]>> {
  return getTopSearches(isoOf(from), isoOf(to), channelOf(channel));
}

export async function clicksAction(from: string, to: string, channel: string, importantOnly: boolean): Promise<Result<ClickRow[]>> {
  return getTopClicks(isoOf(from), isoOf(to), channelOf(channel), importantOnly);
}

export async function pageTimeAction(from: string, to: string, channel: string): Promise<Result<PageTimeRow[]>> {
  return getPageTime(isoOf(from), isoOf(to), channelOf(channel));
}

export async function cohortsAction(): Promise<Result<CohortRow[]>> {
  return getCohorts(8);
}

export async function sellThroughAction(from: string, to: string, channel: string): Promise<Result<SellThroughRow[]>> {
  return getSellThrough(isoOf(from), isoOf(to), channelOf(channel));
}
