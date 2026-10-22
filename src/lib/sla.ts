import type { RecordItem } from "./types";

/**
 * The delivery time limit (SLA). The clock starts when an order enters Purchasing and
 * stops at the signed delivery receipt. Orders that had to wait for a hard-to-source
 * supplier get longer.
 */
export const SLA_DAYS = { standard: 3, hardToSource: 5 } as const;

const DAY = 86_400_000;
const BEFORE_PURCHASING = new Set(["Accounting", "On hold"]);

export interface Sla {
  /** When the order entered Purchasing. */
  startedAt: string;
  /** The day the items must be delivered by. */
  deadline: string;
  days: number;
  /** The order went through Waiting for supplier, which extends the limit. */
  hardToSource: boolean;
  /** When the delivery receipt was signed, if it was. */
  deliveredAt?: string;
  /** Past the limit: delivered late, or still not delivered after it. */
  late: boolean;
  /** Whole days past the limit, rounded up; 0 when on time. */
  lateDays: number;
}

/** When the order entered Purchasing: the last Accounting or On hold step before it moved on. */
function purchasingStartedAt(rec: RecordItem): string | undefined {
  if (BEFORE_PURCHASING.has(String(rec.data.stage))) return undefined;
  const log = rec.order?.log ?? [];
  const firstAfter = log.findIndex((e) => !BEFORE_PURCHASING.has(e.stage));
  return (firstAfter === -1 ? log : log.slice(0, firstAfter)).at(-1)?.at;
}

/** When the delivery receipt was signed, found by its number in the order's history. */
export function deliveredAt(rec: RecordItem): string | undefined {
  const dr = rec.order?.docs.dr;
  return dr ? rec.order!.log.find((e) => e.description.includes(dr))?.at : undefined;
}

/** The order's delivery time limit, or null before it reaches Purchasing. */
export function slaOf(rec: RecordItem, now = Date.now()): Sla | null {
  const startedAt = purchasingStartedAt(rec);
  if (!startedAt || !rec.order) return null;
  const hardToSource = rec.data.stage === "Order basis" || rec.order.log.some((e) => e.stage === "Order basis");
  const days = hardToSource ? SLA_DAYS.hardToSource : SLA_DAYS.standard;
  const deadline = new Date(new Date(startedAt).getTime() + days * DAY).toISOString();
  const done = deliveredAt(rec);
  const over = (done ? new Date(done).getTime() : now) - new Date(deadline).getTime();
  return { startedAt, deadline, days, hardToSource, deliveredAt: done, late: over > 0, lateDays: over > 0 ? Math.ceil(over / DAY) : 0 };
}

/** Days from entering Purchasing to the signed delivery receipt, for delivered orders. */
export function purchasingToDeliveryDays(rec: RecordItem): number | null {
  const sla = slaOf(rec);
  return sla?.deliveredAt ? (new Date(sla.deliveredAt).getTime() - new Date(sla.startedAt).getTime()) / DAY : null;
}
