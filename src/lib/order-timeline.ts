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
/**
 * Whether a timeline line can be corrected at all.
 *
 * Off until the dashboard has staff sign-ins (security plan 3.1/3.3). The
 * rule was always meant to be "whoever wrote it may correct it", and with no
 * sign-in there is no whoever — every edit would be anonymous and
 * indistinguishable from anyone else's. Nobody editing is the honest version
 * of that.
 *
 * Both sides read this one constant: the screen draws no pencil, and
 * updateOrderEvent refuses regardless of what the screen offers. Turning it
 * on restores both at once, and the author check goes in beside it.
 */
export const TIMELINE_EDITING_ENABLED = false;

const DERIVED = /^(placed|pay|ful)-/;

export function isEditableEntry(id: string): boolean {
  return id.length > 0 && !DERIVED.test(id);
}
