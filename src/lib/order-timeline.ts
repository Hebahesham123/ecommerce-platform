/**
 * Which timeline entries are rows of their own.
 *
 * `getOrderTimeline` merges three sources into one list: real rows from
 * `order_events` (comments, holds, cancels, invoices, courier notes), and
 * entries it *derives* from the order itself, from the payments ledger and
 * from the fulfillment log. A derived entry is given a prefixed id because
 * there is no row behind it — "placed this order" is the order, and a payment
 * line is a row in `order_payments`. Editing one of those from the timeline
 * would change nothing, so they stay read-only; refunds and undo-fulfillment
 * are the flows that change them.
 *
 * The screen and the server action both ask this one function, so they can
 * never disagree about which entries offer an edit. (Nothing deletes a
 * timeline entry — see the note where deleteOrderEvent used to be.)
 */
const DERIVED = /^(placed|pay|ful)-/;

export function isEditableEntry(id: string): boolean {
  return id.length > 0 && !DERIVED.test(id);
}
