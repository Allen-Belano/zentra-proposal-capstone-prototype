import type { OrderStage } from "./orders";
import type { OrderDocs } from "./types";

/**
 * The vocabulary the app shows to people. Stored values never change — stages and
 * document keys are persisted to localStorage — so every user-facing name for them
 * lives here instead of in the components.
 */

/** The six stages of an order, in the order they happen. */
export const STAGE_TRACK = [
  "Accounting", "Purchasing", "Receiving", "Invoicing", "Delivery", "Collection",
] as const;

/**
 * How each stored stage is shown. "On hold" and "Waiting for supplier" are
 * sub-states of a stage and keep their own name, but sit on the track at the
 * stage they belong to.
 */
export const STAGE_LABEL: Record<OrderStage, string> = {
  Accounting: "Accounting",
  "On hold": "On hold",
  Purchasing: "Purchasing",
  "Order basis": "Waiting for supplier",
  Receiving: "Receiving",
  Invoicing: "Invoicing",
  Delivery: "Delivery",
  Collection: "Collection",
  Done: "Collection done",
};

/** The stage a sub-state belongs to, for the progress track. */
export const STAGE_TRACK_OF: Record<OrderStage, number> = {
  Accounting: 0,
  "On hold": 0,
  Purchasing: 1,
  "Order basis": 1,
  Receiving: 2,
  Invoicing: 3,
  Delivery: 4,
  Collection: 5,
  Done: 6,
};

/** Display name of a stage, for badges, charts and tables. */
export const stageLabel = (stage: string) => STAGE_LABEL[stage as OrderStage] ?? stage;

/** The documents produced along the order flow, and the label for each. */
export const DOC_LABEL: Record<keyof OrderDocs, string> = {
  clientPo: "Supplier P.O",
  supplierPo: "Vendor P.O",
  rr: "Receiving report (RR)",
  si: "Sales invoice (SI)",
  wr: "Sales report (WR)",
  dr: "Delivery receipt (DR)",
  payment: "Official receipt (OR)",
};

/** The label for the number field of a document, e.g. "Sales invoice number". */
export const DOC_INPUT_LABEL: Record<keyof OrderDocs, string> = {
  clientPo: "Supplier P.O number",
  supplierPo: "Vendor P.O number",
  rr: "Receiving report number",
  si: "Sales invoice number",
  wr: "Sales report number",
  dr: "Delivery receipt number",
  payment: "Official receipt number",
};

/**
 * Short help for words that stay technical. Shown on hover and focus, and read
 * out by screen readers.
 */
export const TERM_HELP = {
  bitrix: "Bitrix24 is the customer relationship system where sales deals are recorded.",
  sending: "Saving a change in Zentra and pushing it to Bitrix24.",
  review: "The same record changed in both Zentra and Bitrix24. You choose which version to keep.",
  needsFixing: "Rows from a file that didn't pass your rules. Fix one and load it again, or dismiss it.",
  keyNumbers: "Measures that show how the work is going, such as how many orders were finished on time.",
  connection: "How Zentra connects to another system.",
  pipeline: "For files you upload and data from connected apps.",
  stage: "One of the six stages an order goes through, from Accounting to Collection.",
} as const;

/** A one-line definition for a module, used in help text and empty states. */
export const MODULE_HELP = {
  inventory: "Stock levels, reorder points, and storage locations.",
  operations: "Orders from won Bitrix24 deals, from Accounting to Collection.",
} as const;
