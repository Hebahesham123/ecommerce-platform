// Customer segmentation: a small rule engine over the real audience.
// Pure + client-safe so both the Audiences UI and the campaign flow can filter
// the same way. The audience itself is loaded server-side (audience-actions).

export type AudienceCustomer = {
  phone: string;
  name: string;
  email: string | null;
  governorate: string | null;
  birthday: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
};

export type RuleField =
  | "totalSpent"
  | "ordersCount"
  | "lastOrderDays" // days since last order
  | "governorate"
  | "hasEmail";

export type RuleOp = "gte" | "lte" | "is";

export type SegmentRule = {
  field: RuleField;
  op: RuleOp;
  value: string | number | boolean;
};

export type Segment = {
  id: string;
  name: string;
  match: "all" | "any";
  rules: SegmentRule[];
  updatedAt: number;
};

export const FIELD_LABELS: Record<RuleField, string> = {
  totalSpent: "Total spent (EGP)",
  ordersCount: "Number of orders",
  lastOrderDays: "Days since last order",
  governorate: "Governorate",
  hasEmail: "Has email",
};

function daysSince(date: string | null): number {
  if (!date) return Infinity;
  const t = new Date(date + "T00:00:00").getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function evalRule(c: AudienceCustomer, r: SegmentRule): boolean {
  switch (r.field) {
    case "totalSpent":
      return r.op === "lte" ? c.totalSpent <= Number(r.value) : c.totalSpent >= Number(r.value);
    case "ordersCount":
      return r.op === "lte" ? c.ordersCount <= Number(r.value) : c.ordersCount >= Number(r.value);
    case "lastOrderDays": {
      const d = daysSince(c.lastOrderDate);
      return r.op === "lte" ? d <= Number(r.value) : d >= Number(r.value);
    }
    case "governorate":
      return (c.governorate ?? "").toLowerCase() === String(r.value).toLowerCase();
    case "hasEmail":
      return Boolean(c.email) === Boolean(r.value);
    default:
      return true;
  }
}

export function matchesSegment(c: AudienceCustomer, seg: Pick<Segment, "match" | "rules">): boolean {
  if (!seg.rules.length) return true;
  return seg.match === "all"
    ? seg.rules.every((r) => evalRule(c, r))
    : seg.rules.some((r) => evalRule(c, r));
}

export function filterAudience(audience: AudienceCustomer[], seg: Pick<Segment, "match" | "rules">): AudienceCustomer[] {
  return audience.filter((c) => matchesSegment(c, seg));
}

/** Ready-made segments so the merchant gets value before building any rules. */
export function presetSegments(): Segment[] {
  const mk = (id: string, name: string, match: Segment["match"], rules: SegmentRule[]): Segment => ({
    id,
    name,
    match,
    rules,
    updatedAt: 0,
  });
  return [
    mk("has_email", "Everyone with email", "all", [{ field: "hasEmail", op: "is", value: true }]),
    mk("repeat", "Repeat buyers (2+)", "all", [{ field: "ordersCount", op: "gte", value: 2 }]),
    mk("vip", "VIP (spent 1000+)", "all", [{ field: "totalSpent", op: "gte", value: 1000 }]),
    mk("new", "New (1 order)", "all", [{ field: "ordersCount", op: "lte", value: 1 }]),
    mk("lapsed", "Lapsed (60+ days)", "all", [{ field: "lastOrderDays", op: "gte", value: 60 }]),
  ];
}
