"use server";

import { getSessionPhone } from "@/lib/store-session";
import {
  listMyRequestsFor,
  listReturnableOrdersFor,
  submitReturnRequestFor,
  type SubmitPayload,
} from "@/lib/returns-service";
import type { ActionResult } from "../actions";
import type { ReturnRequest } from "@/lib/returns";
import type { ReturnableOrder } from "@/lib/returns-service";

/**
 * The website's returns actions.
 *
 * These take no shopper argument on purpose. A Server Action is a public
 * endpoint whose arguments the caller supplies, and its id ships in the client
 * bundle — so an action that accepted "whose returns?" would hand anyone
 * anyone else's orders for the cost of one fetch. The phone comes from the
 * signed session cookie here and nowhere else.
 *
 * The work itself lives in lib/returns-service.ts, shared with the mobile API,
 * which authenticates with a bearer token instead.
 */

export type { ReturnableLine, ReturnableOrder, SubmitPayload } from "@/lib/returns-service";

export async function listReturnableOrders(): Promise<ActionResult<ReturnableOrder[]>> {
  return listReturnableOrdersFor(await getSessionPhone());
}

export async function submitReturnRequest(
  payload: SubmitPayload,
): Promise<ActionResult<{ reference: string }>> {
  return submitReturnRequestFor(await getSessionPhone(), payload, "web");
}

export async function listMyRequests(): Promise<ActionResult<ReturnRequest[]>> {
  return listMyRequestsFor(await getSessionPhone());
}
