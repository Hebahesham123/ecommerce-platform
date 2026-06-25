import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IcOverview = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
export const IcOrders = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
    <path d="M14 2v5h5M9 13h6M9 17h6M9 9h2" />
  </svg>
);
export const IcProducts = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8M12 13v8" />
  </svg>
);
export const IcCustomers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17 20a5.5 5.5 0 0 0-2.5-4.6" />
  </svg>
);
export const IcCourier = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h10v9H3zM13 9h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);
export const IcInbox = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </svg>
);
export const IcMarketing = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" />
    <path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12" />
  </svg>
);
export const IcSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 13H4.4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6V4.4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-1.2 2.9h.2a2 2 0 1 1 0 4h-.2Z" />
  </svg>
);
export const IcSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const IcBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.5 21a2 2 0 0 0 3 0" />
  </svg>
);
export const IcWhatsApp = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M8.5 9c0 4 2.5 6.5 6.5 6.5 .6 0 1-.6 1-1l-1.6-1-1 .8c-1.2-.5-2.2-1.5-2.7-2.7l.8-1L10 9c0-.5-.4-1-1-1s-1 .5-1 1Z" />
  </svg>
);
export const IcChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12Z" />
    <path d="M9 11h6M9 14h4" />
  </svg>
);
export const IcUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
export const IcDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 7 17 17M17 9v8H9" />
  </svg>
);
export const IcAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5M12 17h.01" />
  </svg>
);
export const IcCash = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);
export const IcPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IcSend = (p: P) => (
  <svg {...base(p)}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </svg>
);
export const IcMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const IcGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);
