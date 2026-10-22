import type {
  ActivityEvent, AppNotification, AuditEntry, Backup, ModuleDef, OrderDocs, OrderLogEntry, PipelineRun, Position,
  RecordItem, RejectedRow, RemoteRecord, SyncOperation, User, ValidationRule,
} from "@/lib/types";
import { ORDER_STAGES, PAYMENT_STATUSES, type OrderStage } from "@/lib/orders";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const H = 60;
const D = 24 * H;

export const DEMO_PASSWORD = "zentra2026";

/** One employee per Operations position, named firstname.position@ifixz.com. */
export const STAFF: Record<Position, { id: string; name: string; email: string }> = {
  accounting: { id: "u-acc", name: "Jessa Cruz", email: "jessa.accounting@ifixz.com" },
  purchasing: { id: "u-pur", name: "Mark Dizon", email: "mark.purchasing@ifixz.com" },
  inventory: { id: "u-inv", name: "Ana Lim", email: "ana.inventory@ifixz.com" },
  invoicing: { id: "u-ivc", name: "Paolo Garcia", email: "paolo.invoicing@ifixz.com" },
  delivery: { id: "u-del", name: "Lea Mendoza", email: "lea.delivery@ifixz.com" },
};

type Step = [stage: OrderStage, description: string, who: Position | "bitrix", minutesAgo: number, docs?: Partial<OrderDocs>];

export function makeSeed() {
  const users: User[] = [
    { id: "u-admin", name: "Maria Santos", email: "superadmin@ifixz.com", password: DEMO_PASSWORD, role: "super_admin", department: "IT", status: "active", lastActiveAt: ago(30), moduleAccess: {} },
    { id: "u-head", name: "Carlo Reyes", email: "depthead@ifixz.com", password: DEMO_PASSWORD, role: "dept_head", department: "Operations", status: "active", lastActiveAt: ago(12), moduleAccess: {} },
    ...(Object.entries(STAFF) as [Position, (typeof STAFF)[Position]][]).map(([position, p], i): User => ({
      id: p.id, name: p.name, email: p.email, password: DEMO_PASSWORD, role: "employee", department: "Operations",
      position, status: "active", lastActiveAt: ago(5 + i * 37), moduleAccess: {},
    })),
  ];

  const modules: ModuleDef[] = [
    {
      id: "operations", name: "Operations", recordName: "Order", icon: "truck",
      description: "Orders confirmed in Bitrix24, from Accounting to Collection.",
      kind: "external", source: "Bitrix24", owner: "Operations",
      adapter: {
        type: "api", endpoint: "https://ifixz.bitrix24.com/rest/crm.deal", frequency: "realtime",
        connection: { endpoint: "https://ifixz.bitrix24.com/rest/crm.deal", auth: "OAuth 2.0 client", pageSize: "50" },
        mapping: {
          order_no: "TITLE", customer: "COMPANY_TITLE", client_po: "UF_CRM_CLIENT_PO", items: "UF_CRM_ITEMS",
          amount: "OPPORTUNITY", stage: "STAGE_ID", payment: "UF_CRM_PAYMENT", due_date: "CLOSEDATE",
        },
      },
      active: true, baseline: true, registeredAt: ago(60 * 24 * 30), registeredBy: "Carlo Reyes", lastSyncedAt: ago(8),
      fields: [
        { key: "order_no", label: "Order no.", type: "text", primary: true },
        { key: "customer", label: "Customer", type: "text" },
        { key: "client_po", label: "Supplier P.O", type: "text", hideOnMobile: true, hideOnTablet: true },
        { key: "items", label: "Items", type: "text", hideOnMobile: true, hideOnTablet: true },
        { key: "amount", label: "Amount", type: "currency", hideOnMobile: true, financial: true },
        { key: "stage", label: "Stage", type: "select", options: [...ORDER_STAGES] },
        { key: "payment", label: "Payment", type: "select", options: [...PAYMENT_STATUSES] },
        { key: "due_date", label: "Deliver by", type: "date", hideOnMobile: true },
      ],
    },
    {
      id: "ims", name: "Inventory", recordName: "Item", icon: "package",
      description: "Stock levels, reorder points, and storage locations.",
      kind: "native", owner: "Operations · Inventory", adapter: { type: "native", frequency: "realtime" }, active: true, baseline: true,
      registeredAt: ago(60 * 24 * 30), registeredBy: "Carlo Reyes",
      fields: [
        { key: "sku", label: "Item code", type: "text" },
        { key: "name", label: "Item name", type: "text", primary: true },
        { key: "category", label: "Category", type: "select", options: ["Computers", "Networking", "Peripherals", "Security", "Power"], hideOnMobile: true },
        { key: "on_hand", label: "On hand", type: "number" },
        { key: "reorder_level", label: "Reorder at", type: "number", hideOnMobile: true },
        { key: "unit_cost", label: "Unit cost", type: "currency", hideOnMobile: true, financial: true },
        { key: "location", label: "Location", type: "text", hideOnMobile: true, hideOnTablet: true },
      ],
    },
  ];

  // IT hardware for business and government clients. Two items sit at or below their reorder level.
  const ims: [string, string, string, number, number, number, string][] = [
    ["CMP-1001", "Business laptop 14in", "Computers", 18, 8, 42500, "Rack A1"],
    ["CMP-1002", "Desktop PC (Core i5, 16GB)", "Computers", 6, 8, 38900, "Rack A2"],
    ["NET-2001", "24-port PoE network switch", "Networking", 3, 4, 18500, "Rack B1"],
    ["NET-2002", "Wi-Fi 6 access point", "Networking", 25, 10, 6200, "Rack B2"],
    ["PER-3001", "27in IPS monitor", "Peripherals", 30, 10, 11800, "Shelf C1"],
    ["PER-3002", "Wireless keyboard and mouse set", "Peripherals", 60, 20, 1450, "Shelf C2"],
    ["SEC-4001", "4-camera IP security kit", "Security", 12, 5, 24500, "Shelf D1"],
    ["SEC-4002", "Biometric door access reader", "Security", 9, 4, 8900, "Shelf D2"],
    ["PWR-5001", "1500VA UPS", "Power", 15, 6, 7800, "Shelf E1"],
    ["PWR-5002", "Surge-protected power strip", "Power", 40, 15, 950, "Shelf E2"],
  ];

  const wonAt = (minutesAgo: number): Step => ["Accounting", "Order confirmed in Bitrix24; order created in Zentra", "bitrix", minutesAgo];
  // Three orders, each with a job in the demo:
  // ORD-1041 just arrived for Accounting and is walked through every stage live.
  // ORD-1042 has waited for a hard-to-source supplier for 6 days, past the 5-day limit, with a reason on record.
  // ORD-1043 was delivered 5 days after entering Purchasing, past the 3-day limit with no reason, and is now in Collection.
  const orderSpecs: { no: string; customer: string; clientPo: string; items: string; amount: number; stage: OrderStage; payment: "Paid" | "Unpaid"; due: number; steps: Step[] }[] = [
    { no: "ORD-1041", customer: "Northgate Logistics Inc.", clientPo: "CPO-60311", items: "8x Desktop PC (Core i5, 16GB)", amount: 364000, stage: "Accounting", payment: "Unpaid", due: 5,
      steps: [wonAt(40)] },
    { no: "ORD-1042", customer: "Marikina City Hall IT Office", clientPo: "CPO-60287", items: "4x 24-port PoE network switch", amount: 88000, stage: "Order basis", payment: "Unpaid", due: 2,
      steps: [wonAt(6.4 * D), ["Accounting", "Cleared by Accounting: no unpaid balance", "accounting", 6.2 * D],
        ["Purchasing", "Vendor P.O SPO-3331 issued; the order waits for the supplier (long lead time)", "purchasing", 6 * D, { supplierPo: "SPO-3331" }]] },
    { no: "ORD-1043", customer: "Summit Ridge Accounting Firm", clientPo: "CPO-60254", items: "6x 4-camera IP security kit", amount: 177000, stage: "Collection", payment: "Unpaid", due: -3,
      steps: [wonAt(9.5 * D), ["Accounting", "Cleared by Accounting: no unpaid balance", "accounting", 9.3 * D],
        ["Purchasing", "Vendor P.O SPO-3324 issued for the missing items", "purchasing", 9 * D, { supplierPo: "SPO-3324" }],
        ["Receiving", "Supplier delivery received; receiving report RR-2231 posted", "inventory", 6.5 * D, { rr: "RR-2231" }],
        ["Invoicing", "Sales invoice SI-4490 and sales report WR-1201 issued", "invoicing", 5.2 * D, { si: "SI-4490", wr: "WR-1201" }],
        ["Delivery", "Items delivered; delivery receipt DR-7740 signed by the client", "delivery", 4.3 * D, { dr: "DR-7740" }]] },
  ];

  const toOrder = (o: (typeof orderSpecs)[number], i: number): RecordItem => {
    const docs: OrderDocs = { clientPo: o.clientPo };
    const log: OrderLogEntry[] = o.steps.map(([stage, description, who, min, d], k) => {
      Object.assign(docs, d);
      return who === "bitrix"
        ? { id: `log-${i}-${k}`, stage, description, by: "Bitrix24", role: "system", at: ago(min) }
        : { id: `log-${i}-${k}`, stage, description, by: STAFF[who].name, position: who, role: "employee", at: ago(min) };
    });
    const last = log.at(-1)!;
    return {
      id: `ops-${i + 1}`, moduleId: "operations",
      data: { order_no: o.no, customer: o.customer, client_po: o.clientPo, items: o.items, amount: o.amount, stage: o.stage, payment: o.payment, due_date: daysFromNow(o.due) },
      order: { docs, log },
      archived: false, syncState: (i === 1 ? "conflict" : "synced") as RecordItem["syncState"],
      externalId: `DEAL-${7710 + i}`, syncedVersion: 1,
      createdAt: log[0].at, updatedAt: last.at, updatedBy: last.by,
    };
  };

  const records: RecordItem[] = [
    ...ims.map(([sku, name, category, on_hand, reorder_level, unit_cost, location], i) => ({
      id: `ims-${i + 1}`, moduleId: "ims",
      data: { sku, name, category, on_hand, reorder_level, unit_cost, location },
      archived: false, syncState: "local" as const,
      createdAt: ago(60 * 24 * 20), updatedAt: ago(60 * (i + 2)), updatedBy: i % 2 ? STAFF.inventory.name : "Carlo Reyes",
    })),
    ...orderSpecs.map(toOrder),
  ];

  // The mock Bitrix24 copy of each Operations record.
  const remote: Record<string, RemoteRecord> = {};
  for (const r of records.filter((r) => r.moduleId === "operations")) remote[r.id] = { data: { ...r.data }, version: 1 };
  // ORD-1042 was changed in Bitrix24 while a Zentra edit was pending: the one seeded conflict.
  remote["ops-2"] = { data: { ...remote["ops-2"].data, items: "5x 24-port PoE network switch", amount: 110000 }, version: 2 };

  /** A deal won in Bitrix24 that hasn't been pulled into Zentra yet. It's incomplete on purpose, so "Update now" shows a record that needs fixing without adding a fourth order. */
  const remoteInbox: Record<string, string>[] = [
    { order_no: "ORD-1044", customer: "", client_po: "CPO-60330", items: "12x Wireless keyboard and mouse set", amount: "21600", stage: "Accounting", payment: "Unpaid", due_date: daysFromNow(7) },
  ];

  const rules: ValidationRule[] = [
    { id: "r1", moduleId: "ims", field: "sku", kind: "required", enabled: true },
    { id: "r2", moduleId: "ims", field: "sku", kind: "pattern", value: "^[A-Z]{3}-\\d{4}$", enabled: true },
    { id: "r3", moduleId: "ims", field: "sku", kind: "unique", enabled: true },
    { id: "r4", moduleId: "ims", field: "name", kind: "required", enabled: true },
    { id: "r5", moduleId: "ims", field: "on_hand", kind: "number", enabled: true },
    { id: "r6", moduleId: "ims", field: "on_hand", kind: "min", value: "0", enabled: true },
    { id: "r7", moduleId: "ims", field: "unit_cost", kind: "min", value: "0", enabled: true },
    { id: "r8", moduleId: "operations", field: "order_no", kind: "required", enabled: true },
    { id: "r9", moduleId: "operations", field: "order_no", kind: "pattern", value: "^ORD-\\d{4}$", enabled: true },
    { id: "r10", moduleId: "operations", field: "order_no", kind: "unique", enabled: true },
    { id: "r11", moduleId: "operations", field: "customer", kind: "required", enabled: true },
    { id: "r12", moduleId: "operations", field: "amount", kind: "min", value: "0", enabled: true },
    { id: "r13", moduleId: "operations", field: "stage", kind: "oneOf", value: ORDER_STAGES.join("|"), enabled: true },
    { id: "r14", moduleId: "operations", field: "payment", kind: "oneOf", value: PAYMENT_STATUSES.join("|"), enabled: true },
  ];

  // One import run, with two records that need fixing.
  const runSpec: [string, string, number, number, number][] = [
    ["ims", "stock_count_oct21.csv", 10, 2, 20 * H],
  ];
  const pipelineRuns: PipelineRun[] = runSpec.map(([moduleId, source, total, rejected, minAgo], i) => ({
    id: `run-${i + 1}`, number: 101 + i, moduleId, source, total, rejected, loaded: total - rejected,
    status: rejected ? "completed_with_errors" : "completed",
    startedAt: ago(minAgo), endedAt: ago(minAgo - 1), runBy: source.startsWith("Bitrix") ? "Scheduled sync" : "Carlo Reyes",
  }));

  const rejected: RejectedRow[] = [
    { id: "rej-1", runId: "run-1", moduleId: "ims", rowIndex: 4, errors: ["Item code \"net2003\" doesn't look like the expected format"], raw: { sku: "net2003", name: "Gigabit network card", category: "Networking", on_hand: "20", reorder_level: "8", unit_cost: "1650", location: "Bin B3" }, status: "open", createdAt: ago(20 * H) },
    { id: "rej-2", runId: "run-1", moduleId: "ims", rowIndex: 8, errors: ["On hand can't be below 0"], raw: { sku: "PWR-5003", name: "Rack-mount PDU", category: "Power", on_hand: "-2", reorder_level: "4", unit_cost: "5400", location: "Shelf E2" }, status: "open", createdAt: ago(20 * H) },
  ];

  const syncOps: SyncOperation[] = [
    { id: "s1", moduleId: "operations", recordId: "ops-2", recordLabel: "ORD-1042", direction: "outbound", status: "conflict", attempts: 1, createdAt: ago(42), error: "The order changed in Bitrix24 after Zentra's last sync.", local: { ...records.find((r) => r.id === "ops-2")!.data }, remote: { ...remote["ops-2"].data } },
    { id: "s2", moduleId: "operations", recordId: "ops-3", recordLabel: "ORD-1043", direction: "outbound", status: "success", attempts: 1, createdAt: ago(4.3 * D), resolvedAt: ago(4.3 * D) },
    { id: "s3", moduleId: "operations", recordId: "ops-1", recordLabel: "ORD-1041", direction: "inbound", status: "success", attempts: 1, createdAt: ago(40), resolvedAt: ago(40) },
  ];

  const activity: ActivityEvent[] = [
    { id: "e1", moduleId: "operations", recordId: "ops-2", title: "ORD-1042 changed in both systems", detail: "Changed in both Zentra and Bitrix24. Waiting for review.", actor: "System", level: "warning", at: ago(42) },
    { id: "e4", moduleId: "ims", title: "File import #101 finished", detail: "8 validated, 2 need fixing, from stock_count_oct21.csv", actor: "Carlo Reyes", level: "warning", at: ago(20 * H) },
    { id: "e6", moduleId: "ims", recordId: "ims-3", title: "24-port PoE network switch is below reorder level", detail: "3 on hand, reorder at 4", actor: "System", level: "warning", at: ago(300) },
    { id: "e8", moduleId: "operations", title: "Bitrix24 update finished", detail: "1 order pulled", actor: "Scheduled update", level: "success", at: ago(40) },
    { id: "e9", moduleId: "operations", recordId: "ops-1", title: "ORD-1041 received from Bitrix24", detail: "Order confirmed; the order is waiting on Accounting", actor: "Bitrix24", level: "info", at: ago(40) },
  ];

  const note = (id: string, to: AppNotification["to"], title: string, detail: string, recordId: string | undefined, min: number): AppNotification =>
    ({ id, to, title, detail, recordId, moduleId: "operations", at: ago(min), readBy: [] });
  const notifications: AppNotification[] = [
    note("n1", { position: "accounting" }, "ORD-1041 is ready for Accounting", "New order from Northgate Logistics Inc.", "ops-1", 40),
    note("n2", { position: "purchasing" }, "ORD-1042 is ready for purchasing", "Cleared by Accounting (Jessa Cruz)", "ops-2", 6.2 * D),
    note("n3", { role: "dept_head" }, "ORD-1042 changed in both systems", "Changed in both Zentra and Bitrix24", "ops-2", 42),
    note("n4", { position: "accounting" }, "ORD-1043 was delivered unpaid", "Collect the payment from Summit Ridge Accounting Firm", "ops-3", 4.3 * D),
    note("n5", { position: "delivery" }, "ORD-1043 is past its delivery limit", "1 day past the 3-day limit. No reason recorded yet.", "ops-3", 5.3 * D),
    note("n6", { role: "dept_head" }, "ORD-1043 is past its delivery limit", "1 day past the 3-day limit. No reason recorded yet.", "ops-3", 5.3 * D),
  ];

  const audit: AuditEntry[] = [
    { id: "a1", actor: "Jessa Cruz", role: "employee", action: "Signed in", target: "Session", at: ago(5) },
    { id: "a2", actor: "Carlo Reyes", role: "dept_head", action: "Imported a file", target: "Inventory · stock_count_oct21.csv", at: ago(20 * H) },
    { id: "a3", actor: "Lea Mendoza", role: "employee", action: "Updated order", target: "Operations · ORD-1043: delivered", at: ago(4.3 * D) },
    { id: "a4", actor: "Mark Dizon", role: "employee", action: "Updated order", target: "Operations · ORD-1042: vendor P.O issued, waiting for supplier", at: ago(6 * D) },
    { id: "a5", actor: "Carlo Reyes", role: "dept_head", action: "Assigned Operations role", target: "Lea Mendoza: Delivery", at: ago(60 * 24 * 12) },
    { id: "a6", actor: "Carlo Reyes", role: "dept_head", action: "Created backup", target: "Manual restore point", at: ago(60 * 24 * 4) },
  ];

  const backups: Backup[] = [
    { id: "b1", createdAt: ago(60 * 4), sizeMb: 184, type: "scheduled", status: "available" },
    { id: "b2", createdAt: ago(60 * 8), sizeMb: 183, type: "scheduled", status: "available" },
    { id: "b3", createdAt: ago(60 * 24 * 4), sizeMb: 176, type: "manual", status: "verified" },
    { id: "b4", createdAt: ago(60 * 24 * 7), sizeMb: 171, type: "scheduled", status: "verified" },
  ];

  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    users, modules, records, remote, remoteInbox, rules, pipelineRuns, rejected, syncOps, activity, audit, backups, notifications,
    batches: [] as import("@/lib/types").BatchRun[],
    /** Orders the overdue check has already alerted on. */
    overdueNotified: ["ops-3"] as string[],
    backupSchedule: "every_4_hours" as const,
    outage: false,
  };
}

/** Sample CSV used by "Use sample file" in the pipeline. Rows 4, 7, and 9 fail validation on purpose. */
export const SAMPLE_CSV: Record<string, string> = {
  ims: `sku,name,category,on_hand,reorder_level,unit_cost,location
CMP-1010,Business laptop 15.6in,Computers,12,5,46500,Rack A1
CMP-1011,16GB DDR4 laptop RAM,Computers,40,15,2650,Bin A3
CMP-1012,1TB NVMe SSD,Computers,35,12,4200,Bin A3
cmp1013,Mini PC (Core i3),Computers,8,4,24900,Rack A2
PER-3010,24in office monitor,Peripherals,20,8,7400,Shelf C1
PER-3011,USB-C docking station,Peripherals,15,6,8900,Shelf C2
PER-3012,Wired headset with mic,Peripherals,-5,10,1250,Shelf C2
NET-2010,Cat6 patch cable 2m (pack of 10),Networking,50,20,1800,Bin B3
CMP-1001,Business laptop 14in,Computers,6,8,42500,Rack A1
PER-3013,Wireless presenter,Peripherals,25,10,1350,Shelf C3`,
  operations: `order_no,customer,client_po,items,amount,stage,payment,due_date
ORD-1050,Bayview Medical Center,CPO-60401,10x Business laptop 14in,465000,Accounting,Unpaid,2026-10-28
ORD-1051,Quezon City Treasurer's Office,CPO-60402,20x 27in IPS monitor,260000,Accounting,Unpaid,2026-10-29
ORD-1052,,CPO-60403,6x 1500VA UPS,52800,Accounting,Unpaid,2026-10-29
ORD-1053,Harborline Shipping Corp.,CPO-60404,15x Wireless keyboard and mouse set,24750,Shipped,Unpaid,2026-10-30`,
};
