import {
  listMyRequestsFor,
  submitReturnRequestFor,
  type SubmitPayload,
} from "@/lib/returns-service";
import { bodyOf, channelOf, fail, fromResult, int, ok, str, viewerOf } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The shopper's own return and exchange requests, newest first. */
export async function GET(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const res = await listMyRequestsFor(viewer);
  if (!res.ok) return fromResult(res);
  return ok({ requests: res.data });
}

type Line = { orderItemId: string; quantity: number };

function lines(v: unknown, key: "orderItemId" | "itemId"): { id: string; quantity: number }[] {
  return (Array.isArray(v) ? v : [])
    .map((l) => {
      const line = (l ?? {}) as Record<string, unknown>;
      return { id: str(line[key], 64), quantity: int(line.quantity, 0) };
    })
    .filter((l) => l.id && l.quantity > 0);
}

/**
 * Open a return or an exchange.
 *
 * Nothing the app sends is taken on trust: `submitReturnRequest` re-reads the
 * order, re-checks that it belongs to this shopper, re-derives the 14-day
 * window from the order's own timestamp, and re-prices both sides of an
 * exchange. This route only decides who is asking and from which channel.
 */
export async function POST(request: Request) {
  const viewer = viewerOf(request);
  if (!viewer) return fail("not_signed_in", 401);

  const body = await bodyOf(request);
  const orderId = str(body.orderId, 64);
  if (!orderId) return fail("missing_order");

  const returnLines: Line[] = lines(body.returnLines, "orderItemId").map((l) => ({
    orderItemId: l.id,
    quantity: l.quantity,
  }));
  if (!returnLines.length) return fail("no_items");

  const payload: SubmitPayload = {
    kind: str(body.kind, 16) === "exchange" ? "exchange" : "return",
    orderId,
    returnLines,
    replacementLines: lines(body.replacementLines, "itemId").map((l) => ({
      itemId: l.id,
      quantity: l.quantity,
    })),
    reason: str(body.reason, 200),
    note: str(body.note, 2000),
  };

  return fromResult(await submitReturnRequestFor(viewer, payload, channelOf(request)));
}
