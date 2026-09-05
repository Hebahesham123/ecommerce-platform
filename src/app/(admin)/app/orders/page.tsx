import { OrdersList } from "../../orders/orders-list";

/**
 * The same orders screen as /orders, with the channel pinned to the app.
 *
 * Not a copy — one component mounted twice. A forked list stops matching the
 * original within a month, and two screens that disagree about the same orders
 * are worse than one screen with a filter.
 */
export default function Page() {
  return <OrdersList lockChannel="app" />;
}
