import type { OrderDocs, Position, RecordItem } from "./types";
import { DOC_INPUT_LABEL, STAGE_TRACK, STAGE_TRACK_OF } from "./terms";

/**
 * The Operations order flow from the iFixz business process board. An order enters at
 * "Credit check" when the deal is won in Bitrix24, and each stage is owned by one position.
 */
export const ORDER_STAGES = [
  "Credit check", "On hold", "Purchasing", "Order basis", "Receiving", "Invoicing", "Delivery", "Collection", "Done",
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const PAYMENT_STATUSES = ["Unpaid", "Paid"] as const;

export const STAGE_INFO: Record<OrderStage, { owner?: Position; pending: string }> = {
  "Credit check": { owner: "accounting", pending: "Check the client's balance and clear the order" },
  "On hold": { owner: "accounting", pending: "Wait for the client to settle their old balance" },
  Purchasing: { owner: "purchasing", pending: "Check stock and buy any missing items" },
  "Order basis": { owner: "purchasing", pending: "Follow up with the supplier until the items arrive" },
  Receiving: { owner: "inventory", pending: "Receive the supplier delivery and post the receiving report" },
  Invoicing: { owner: "invoicing", pending: "Issue the sales invoice and sales report" },
  Delivery: { owner: "delivery", pending: "Deliver the items and get the delivery receipt signed" },
  Collection: { owner: "accounting", pending: "Collect the payment from the client" },
  Done: { pending: "" },
};

export interface DocInput { key: keyof OrderDocs; label: string; prefix: string }

export interface OrderAction {
  id: string;
  /** Stage the action is offered in; "any" means every open stage. */
  stage: OrderStage | "any";
  label: string;
  hint: string;
  primary?: boolean;
  docs?: DocInput[];
  /** Next stage; omitted when the action doesn't move the order. */
  next?: (rec: RecordItem) => OrderStage;
  markPaid?: boolean;
  describe: (docs: Partial<Record<keyof OrderDocs, string>>) => string;
}

export const ORDER_ACTIONS: OrderAction[] = [
  {
    id: "clear-credit", stage: "Credit check", primary: true, label: "Clear credit check",
    hint: "The client has no unpaid balance.", next: () => "Purchasing",
    describe: () => "Credit check cleared: no unpaid balance",
  },
  {
    id: "hold", stage: "Credit check", label: "Put on hold",
    hint: "The client still has an unpaid balance.", next: () => "On hold",
    describe: () => "Put on hold: the client has an unpaid balance",
  },
  {
    id: "release", stage: "On hold", primary: true, label: "Balance settled",
    hint: "The client paid the old balance.", next: () => "Purchasing",
    describe: () => "Client settled the old balance, so the credit check is cleared",
  },
  {
    id: "reserve", stage: "Purchasing", primary: true, label: "Reserve from stock",
    hint: "Everything is in stock, so nothing needs to be bought.", next: () => "Invoicing",
    describe: () => "All items reserved from stock",
  },
  {
    id: "supplier-po", stage: "Purchasing", label: "Issue supplier PO",
    hint: "Buy the missing items from a supplier.", next: () => "Receiving",
    docs: [{ key: "supplierPo", label: DOC_INPUT_LABEL.supplierPo, prefix: "SPO-" }],
    describe: (d) => `Supplier PO ${d.supplierPo} issued for the missing items`,
  },
  {
    id: "order-basis", stage: "Purchasing", label: "Wait for supplier",
    hint: "Items are hard to source, so the order waits for the supplier.", next: () => "Order basis",
    docs: [{ key: "supplierPo", label: DOC_INPUT_LABEL.supplierPo, prefix: "SPO-" }],
    describe: (d) => `Supplier PO ${d.supplierPo} issued; the order waits for the supplier (long lead time)`,
  },
  {
    id: "arrived", stage: "Order basis", primary: true, label: "Supplier items arrived",
    hint: "Hand the delivery over to Inventory for receiving.", next: () => "Receiving",
    describe: () => "Supplier items arrived and were handed to Inventory",
  },
  {
    id: "post-rr", stage: "Receiving", primary: true, label: "Post receiving report",
    hint: "Record the supplier delivery as received.", next: () => "Invoicing",
    docs: [{ key: "rr", label: DOC_INPUT_LABEL.rr, prefix: "RR-" }],
    describe: (d) => `Supplier delivery received; receiving report ${d.rr} posted`,
  },
  {
    id: "invoice", stage: "Invoicing", primary: true, label: "Issue sales invoice and report",
    hint: "Prepare the documents that go with the delivery.", next: () => "Delivery",
    docs: [
      { key: "si", label: DOC_INPUT_LABEL.si, prefix: "SI-" },
      { key: "wr", label: DOC_INPUT_LABEL.wr, prefix: "WR-" },
    ],
    describe: (d) => `Sales invoice ${d.si} and sales report ${d.wr} issued`,
  },
  {
    id: "deliver", stage: "Delivery", primary: true, label: "Record delivery",
    hint: "The client received the items and signed the delivery receipt.",
    next: (rec) => (rec.data.payment === "Paid" ? "Done" : "Collection"),
    docs: [{ key: "dr", label: DOC_INPUT_LABEL.dr, prefix: "DR-" }],
    describe: (d) => `Items delivered; delivery receipt ${d.dr} signed by the client`,
  },
  {
    id: "collect", stage: "Collection", primary: true, label: "Record payment",
    hint: "The client paid in full, which closes the order.", next: () => "Done", markPaid: true,
    docs: [{ key: "payment", label: DOC_INPUT_LABEL.payment, prefix: "OR-" }],
    describe: (d) => `Payment collected (${d.payment}); order closed`,
  },
  {
    id: "mark-paid", stage: "any", label: "Record early payment",
    hint: "The client paid before delivery.", markPaid: true,
    docs: [{ key: "payment", label: DOC_INPUT_LABEL.payment, prefix: "OR-" }],
    describe: (d) => `Payment received early (${d.payment})`,
  },
];

/** Actions available on an order right now, before checking who is asking. */
export function actionsFor(rec: RecordItem): OrderAction[] {
  const stage = rec.data.stage as OrderStage;
  if (stage === "Done") return [];
  return ORDER_ACTIONS.filter((a) => {
    if (a.stage === "any") return rec.data.payment !== "Paid" && stage !== "Collection";
    return a.stage === stage;
  });
}

/** Position that must act for an action: the stage owner, or Accounting for payments. */
export function actionOwner(rec: RecordItem, action: OrderAction): Position | undefined {
  if (action.markPaid) return "accounting";
  return STAGE_INFO[rec.data.stage as OrderStage]?.owner;
}

/** The simplified progress track shown on cards: branch stages map onto the main path. */
export const TRACK = STAGE_TRACK;
export const trackIndex = (stage: string) => STAGE_TRACK_OF[stage as OrderStage] ?? 0;

const DAY = 86_400_000;

/** Why an open order needs attention, if it does. */
export function delayReason(rec: RecordItem, now = Date.now()): string | null {
  const stage = rec.data.stage as OrderStage;
  if (stage === "Done") return null;
  const due = new Date(String(rec.data.due_date)).getTime();
  if (!Number.isNaN(due) && due < now - DAY) {
    const days = Math.floor((now - due) / DAY);
    return `${days} day${days > 1 ? "s" : ""} past the due date`;
  }
  if (stage === "On hold") return "On hold until the client settles their balance";
  const last = rec.order?.log.at(-1)?.at;
  if (last && now - new Date(last).getTime() > 3 * DAY) {
    const days = Math.floor((now - new Date(last).getTime()) / DAY);
    return `No progress for ${days} days`;
  }
  return null;
}

/**
 * Stage badge colour, by what the stage means: green for done, orange for
 * anything that needs attention, and quiet grey for the stages in between.
 * Red is reserved for things that actually failed.
 */
export const stageVariant = (stage: string) =>
  stage === "Done" ? "success"
    : stage === "On hold" || stage === "Collection" || stage === "Order basis" ? "warning"
    : "secondary";
