/**
 * The five marks along the bottom of the app.
 *
 * They were geometric characters — a quarter circle for the basket, a half
 * square for orders — picked because a string is easy to keep in a settings
 * object. Nobody reads those as a basket or a receipt; they read as a font
 * that failed to load, which is the worst thing a row of navigation can look
 * like. These are drawn instead, stroked to match the rest of the app's icons
 * and filled when the tab is the one you are on, so the selected tab is
 * legible as a shape and not only as a colour.
 */
import type { TabKey } from "@/lib/app-theme";

type Props = { className?: string; on?: boolean };

const box = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A shopfront: an awning over a door. */
function IcShop({ className, on }: Props) {
  return (
    <svg {...box} className={className}>
      <path d="M3.6 9.2 5 4.8h14l1.4 4.4" />
      <path d="M3.6 9.2a2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0" />
      <path d="M5 11.4V19h14v-7.6" fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.14 : 0} />
      <path d="M10 19v-4.2h4V19" />
    </svg>
  );
}

/** On air: a lens with a signal coming off it. */
function IcLive({ className, on }: Props) {
  return (
    <svg {...box} className={className}>
      <circle cx="12" cy="12" r="3.1" fill={on ? "currentColor" : "none"} />
      <path d="M7.8 7.8a5.9 5.9 0 0 0 0 8.4M16.2 16.2a5.9 5.9 0 0 0 0-8.4" />
      <path d="M5 5a9.9 9.9 0 0 0 0 14M19 19a9.9 9.9 0 0 0 0-14" opacity={0.55} />
    </svg>
  );
}

/** A shopping bag, the one every shop uses. */
function IcCart({ className, on }: Props) {
  return (
    <svg {...box} className={className}>
      <path
        d="M5.4 8.4h13.2l-1 11.1a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5Z"
        fill={on ? "currentColor" : "none"}
        fillOpacity={on ? 0.14 : 0}
      />
      <path d="M8.9 10.4V7.2a3.1 3.1 0 0 1 6.2 0v3.2" />
    </svg>
  );
}

/** A receipt, torn off at the foot. */
function IcOrders({ className, on }: Props) {
  return (
    <svg {...box} className={className}>
      <path
        d="M6 3.6h12v15.8l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z"
        fill={on ? "currentColor" : "none"}
        fillOpacity={on ? 0.12 : 0}
      />
      <path d="M9 8h6M9 11.6h6M9 15.2h3.5" />
    </svg>
  );
}

/** A person. */
function IcAccount({ className, on }: Props) {
  return (
    <svg {...box} className={className}>
      <circle cx="12" cy="8.4" r="3.4" fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.18 : 0} />
      <path d="M4.9 20.1a7.6 7.6 0 0 1 14.2 0" />
    </svg>
  );
}

const ICONS: Record<TabKey, (p: Props) => React.ReactElement> = {
  shop: IcShop,
  live: IcLive,
  cart: IcCart,
  orders: IcOrders,
  account: IcAccount,
};

/** The mark for a tab. `on` is the tab the shopper is looking at. */
export function TabIcon({ tab, className, on }: { tab: TabKey } & Props) {
  const Mark = ICONS[tab] ?? IcShop;
  return <Mark className={className} on={on} />;
}
