/**
 * How this shop can be paid, in one place for both storefronts.
 *
 * The dashboard has had a Payments screen for a while and nothing read it:
 * the website's checkout and the app's both said "Cash on delivery" in code.
 * So a merchant could switch card payments on and change nothing at all,
 * which is worse than not offering the switch.
 *
 * The rule here is that a method is only ever *offered* if the shop can
 * honour it. Nothing on this list charges a card — the shop takes cash at the
 * door, and the instalment providers the website advertises (ValU, Sympl,
 * Halan) are arranged with the shopper after the order is placed. Each one
 * says so in its own words, so nobody reaches the end of checkout believing
 * they have already paid.
 */

export type PaymentKind = "cod" | "instalment" | "wallet" | "transfer";

export type PaymentMethod = {
  id: string;
  name: string;
  nameAr: string;
  kind: PaymentKind;
  /** What the shopper is told once they pick it. */
  note: string;
  noteAr: string;
  /** Optional mark, for a provider with a logo of its own. */
  logo: string;
  enabled: boolean;
};

/**
 * What beauty-bareg.net tells shoppers today: cash at the door, and the
 * instalment providers on the strip of marks in its footer.
 *
 * The instalment ones are all arranged after the order, so each note says so.
 * Card on delivery is the courier's machine, not a gateway: nothing in this
 * checkout charges anybody. InstaPay is a transfer the shop asks for after the
 * order and waits for before dispatch. Each of the three has its own switch on
 * the Payments screen for a shop that stops taking one of them.
 */
export const DEFAULT_METHODS: PaymentMethod[] = [
  {
    id: "cod",
    name: "Cash on delivery",
    nameAr: "الدفع عند الاستلام",
    kind: "cod",
    note: "Pay the courier when your order arrives. Available everywhere we ship.",
    noteAr: "تدفعين للمندوب عند وصول الطلب — متاح في كل المحافظات.",
    logo: "",
    enabled: true,
  },
  {
    id: "valu",
    name: "ValU",
    nameAr: "ڤاليو",
    kind: "instalment",
    note: "Up to 60 months, 0% interest on selected plans. We confirm the plan with you on WhatsApp before dispatch.",
    noteAr: "حتى ٦٠ شهرًا بدون فوائد على خطط مختارة — نؤكد الخطة معك على واتساب قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "sympl",
    name: "Sympl",
    nameAr: "سيمبل",
    kind: "instalment",
    note: "Split into 3 or 6 payments, no bank account needed. We set it up with you after the order.",
    noteAr: "قسّمي على ٣ أو ٦ دفعات بدون حساب بنكي — نرتّبها معك بعد الطلب.",
    logo: "",
    enabled: true,
  },
  {
    id: "halan",
    name: "Halan",
    nameAr: "حالًا",
    kind: "instalment",
    note: "Instalments through Halan. We confirm the plan with you before dispatch.",
    noteAr: "تقسيط عبر حالًا — نؤكد الخطة معك قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "souhoola",
    name: "Souhoola",
    nameAr: "سهولة",
    kind: "instalment",
    note: "Instalments through Souhoola. We confirm the plan with you before dispatch.",
    noteAr: "تقسيط عبر سهولة — نؤكد الخطة معك قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "aman",
    name: "Aman",
    nameAr: "أمان",
    kind: "instalment",
    note: "Instalments through Aman. We confirm the plan with you before dispatch.",
    noteAr: "تقسيط عبر أمان — نؤكد الخطة معك قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "forsa",
    name: "Forsa",
    nameAr: "فرصة",
    kind: "instalment",
    note: "Instalments through Forsa. We confirm the plan with you before dispatch.",
    noteAr: "تقسيط عبر فرصة — نؤكد الخطة معك قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "tru",
    name: "Tru Finance",
    nameAr: "ترو",
    kind: "instalment",
    note: "Instalments through Tru Finance. We confirm the plan with you before dispatch.",
    noteAr: "تقسيط عبر ترو — نؤكد الخطة معك قبل الشحن.",
    logo: "",
    enabled: true,
  },
  {
    id: "card",
    name: "Card on delivery",
    nameAr: "الدفع بالبطاقة عند الاستلام",
    kind: "cod",
    note: "Pay by card when your order arrives — the courier carries a machine.",
    noteAr: "تدفعين بالبطاقة عند وصول الطلب — المندوب معه ماكينة.",
    logo: "",
    enabled: true,
  },
  {
    id: "instapay",
    name: "InstaPay",
    nameAr: "إنستاباي",
    kind: "wallet",
    note: "We send you the account to transfer to once the order is placed, and dispatch when it lands.",
    noteAr: "نرسل لك الحساب للتحويل عليه بعد تأكيد الطلب، ونشحن فور وصوله.",
    logo: "",
    enabled: true,
  },
];

/** The two defaults their own switch on the Payments screen can withdraw. */
const CARD_ID = "card";
const WALLET_ID = "instapay";

const str = (v: unknown, fallback = ""): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
};

const KINDS: PaymentKind[] = ["cod", "instalment", "wallet", "transfer"];

/**
 * The methods to offer, from whatever the Payments screen has saved.
 *
 * A store that has never opened that screen gets the website's own set, so
 * both storefronts say something true on day one rather than nothing.
 */
export function methodsFrom(raw: unknown): PaymentMethod[] {
  const saved = (raw ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(saved.methods) ? (saved.methods as Record<string, unknown>[]) : [];

  const list: PaymentMethod[] = rows.length
    ? rows.map((r, i) => {
        const kind = str(r.kind) as PaymentKind;
        return {
          id: str(r.id) || str(r.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || `m-${i}`,
          name: str(r.name),
          nameAr: str(r.name_ar) || str(r.nameAr),
          kind: KINDS.includes(kind) ? kind : "instalment",
          note: str(r.note),
          noteAr: str(r.note_ar) || str(r.noteAr),
          logo: str(r.logo),
          // A row a merchant added is on unless they said otherwise.
          enabled: r.enabled !== false && r.enabled !== "false",
        };
      })
    : DEFAULT_METHODS;

  // The three toggles on the same screen mean what they say, and they all
  // work the same way round: the method is offered unless the merchant has
  // switched it off. A merchant who has written their own rows is never
  // second-guessed - the switches only reach the defaults.
  const off = (v: unknown) => v === false || v === "false";
  const codOff = off(saved.cod_enabled);
  const usingDefaults = rows.length === 0;
  return list
    .filter((m) => !(usingDefaults && m.id === CARD_ID && off(saved.card_enabled)))
    .filter((m) => !(usingDefaults && m.id === WALLET_ID && off(saved.wallet_enabled)))
    .filter((m) => m.enabled && m.name && !(codOff && m.kind === "cod"));
}

export const payName = (m: PaymentMethod, ar: boolean) => (ar && m.nameAr ? m.nameAr : m.name);
export const payNote = (m: PaymentMethod, ar: boolean) => (ar && m.noteAr ? m.noteAr : m.note);

/**
 * What the merchant reads on the order.
 *
 * Always in Arabic, beside the delivery and gift lines that are already
 * written that way, and always naming the kind: "تقسيط" on an order means
 * somebody has to ring the shopper before it ships.
 */
export function orderLine(m: PaymentMethod | null | undefined): string {
  if (!m) return "";
  const kind =
    m.kind === "cod" ? "دفع عند الاستلام" : m.kind === "instalment" ? "تقسيط" : m.kind === "wallet" ? "محفظة" : "تحويل";
  const name = m.nameAr || m.name;
  return `الدفع: ${name}${m.kind === "cod" ? "" : ` (${kind} — يلزم التأكيد)`}`;
}
