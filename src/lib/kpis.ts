import { delayReason, STAGE_INFO, type OrderStage } from "./orders";
import type { OrderLogEntry, Position, RecordItem, User } from "./types";

/**
 * Employee and department KPIs, computed from each order's step history. Every completed
 * step records who did it and when, so performance follows directly from the real work.
 */

const PHT_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
export const dayKey = (d: string | Date) => PHT_DAY.format(new Date(d));
export const monthKey = (d: string | Date) => dayKey(d).slice(0, 7);
const HOUR = 3_600_000;

/** Target time to finish a step once an order reaches it, per role. */
export const TARGET_HOURS: Record<Position, number> = {
  accounting: 24,  // clearing an order or following up a payment within a day
  purchasing: 24,  // reserve stock or raise the vendor P.O within a day
  inventory: 72,   // supplier deliveries can take a few days to arrive and be received
  invoicing: 24,   // SI and WR within a day of receiving
  delivery: 48,    // delivered within two days of invoicing
};

/** The role-specific measure shown alongside the shared KPIs. */
export const ROLE_METRIC: Record<Position, { label: string; hint: string; match: (e: OrderLogEntry) => boolean }> = {
  accounting: { label: "Payments collected", hint: "Official receipts recorded", match: (e) => /^Payment (collected|received)/.test(e.description) },
  purchasing: { label: "Vendor P.Os issued", hint: "Including order-basis POs", match: (e) => e.description.startsWith("Vendor P.O") },
  inventory: { label: "Receiving reports posted", hint: "Supplier deliveries received", match: (e) => e.description.includes("receiving report") },
  invoicing: { label: "Sales invoices issued", hint: "SI and WR pairs", match: (e) => e.description.startsWith("Sales invoice") },
  delivery: { label: "Deliveries completed", hint: "Signed delivery receipts", match: (e) => e.description.startsWith("Items delivered") },
};

export interface StepDone { entry: OrderLogEntry; order: RecordItem; hours: number }

/** Every step completed by Operations employees, with how long the order waited for it. */
export function completedSteps(orders: RecordItem[]): StepDone[] {
  const out: StepDone[] = [];
  for (const order of orders) {
    const log = order.order?.log ?? [];
    log.forEach((entry, i) => {
      if (i === 0 || entry.role !== "employee" || !entry.position) return;
      out.push({ entry, order, hours: (new Date(entry.at).getTime() - new Date(log[i - 1].at).getTime()) / HOUR });
    });
  }
  return out;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface EmployeeKpis {
  user: User;
  position: Position;
  steps: number;
  stepsPrev: number;
  avgHours: number | null;
  onTargetPct: number | null;
  queue: number;
  delayedInQueue: number;
  roleMetric: { label: string; hint: string; value: number; prev: number };
}

export function employeeKpis(user: User, orders: RecordItem[], steps: StepDone[], month: string, prevMonth: string): EmployeeKpis | null {
  const position = user.position;
  if (!position) return null;
  const mine = steps.filter((s) => s.entry.by === user.name && s.entry.position === position);
  const inMonth = mine.filter((s) => monthKey(s.entry.at) === month);
  const inPrev = mine.filter((s) => monthKey(s.entry.at) === prevMonth);
  const target = TARGET_HOURS[position];
  const queue = orders.filter((o) => o.data.stage !== "Done" && STAGE_INFO[o.data.stage as OrderStage]?.owner === position);
  const metric = ROLE_METRIC[position];
  return {
    user, position,
    steps: inMonth.length,
    stepsPrev: inPrev.length,
    avgHours: avg(inMonth.map((s) => s.hours)),
    onTargetPct: pct(inMonth.filter((s) => s.hours <= target).length, inMonth.length),
    queue: queue.length,
    delayedInQueue: queue.filter((o) => delayReason(o)).length,
    roleMetric: {
      label: metric.label, hint: metric.hint,
      value: inMonth.filter((s) => metric.match(s.entry)).length,
      prev: inPrev.filter((s) => metric.match(s.entry)).length,
    },
  };
}

export interface DepartmentKpis {
  steps: number;
  stepsPrev: number;
  completed: number;
  completedPrev: number;
  avgCycleDays: number | null;
  onTimeDeliveryPct: number | null;
  onTargetPct: number | null;
  open: number;
  delayed: number;
  byPosition: { position: Position; steps: number; avgHours: number | null }[];
}

export function departmentKpis(orders: RecordItem[], steps: StepDone[], month: string, prevMonth: string, positions: Position[]): DepartmentKpis {
  const inMonth = steps.filter((s) => monthKey(s.entry.at) === month);
  const doneIn = (m: string) => orders.filter((o) => o.data.stage === "Done" && monthKey(o.order!.log.at(-1)!.at) === m);
  const completed = doneIn(month);
  const deliveries = inMonth.filter((s) => ROLE_METRIC.delivery.match(s.entry));
  const open = orders.filter((o) => o.data.stage !== "Done");
  return {
    steps: inMonth.length,
    stepsPrev: steps.filter((s) => monthKey(s.entry.at) === prevMonth).length,
    completed: completed.length,
    completedPrev: doneIn(prevMonth).length,
    avgCycleDays: avg(completed.map((o) => (new Date(o.order!.log.at(-1)!.at).getTime() - new Date(o.order!.log[0].at).getTime()) / (24 * HOUR))),
    onTimeDeliveryPct: pct(deliveries.filter((s) => dayKey(s.entry.at) <= String(s.order.data.due_date)).length, deliveries.length),
    onTargetPct: pct(inMonth.filter((s) => s.hours <= TARGET_HOURS[s.entry.position!]).length, inMonth.length),
    open: open.length,
    delayed: open.filter((o) => delayReason(o)).length,
    byPosition: positions.map((p) => {
      const ps = inMonth.filter((s) => s.entry.position === p);
      return { position: p, steps: ps.length, avgHours: avg(ps.map((s) => s.hours)) };
    }),
  };
}

/** "5 hours", "1.5 days" — handling times read better in days past 48 hours. */
export function formatHours(h: number | null) {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}
