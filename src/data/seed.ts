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
      id: "ims", name: "Inventory", recordName: "Item", icon: "package",
      description: "Stock levels, reorder points, and storage locations.",
      kind: "native", owner: "Operations · Inventory", adapter: { type: "native", frequency: "realtime" }, active: true, baseline: true,
      registeredAt: ago(60 * 24 * 30), registeredBy: "Carlo Reyes",
      fields: [
        { key: "sku", label: "SKU", type: "text" },
        { key: "name", label: "Item name", type: "text", primary: true },
        { key: "category", label: "Category", type: "select", options: ["Displays", "Batteries", "Components", "Accessories", "Consumables"], hideOnMobile: true },
        { key: "on_hand", label: "On hand", type: "number" },
        { key: "reorder_level", label: "Reorder at", type: "number", hideOnMobile: true },
        { key: "unit_cost", label: "Unit cost", type: "currency", hideOnMobile: true, financial: true },
        { key: "location", label: "Location", type: "text", hideOnMobile: true, hideOnTablet: true },
      ],
    },
    {
      id: "operations", name: "Operations", recordName: "Order", icon: "truck",
      description: "Orders from won Bitrix24 deals, from credit check to payment.",
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
        { key: "client_po", label: "Client PO", type: "text", hideOnMobile: true, hideOnTablet: true },
        { key: "items", label: "Items", type: "text", hideOnMobile: true, hideOnTablet: true },
        { key: "amount", label: "Amount", type: "currency", hideOnMobile: true, financial: true },
        { key: "stage", label: "Step", type: "select", options: [...ORDER_STAGES] },
        { key: "payment", label: "Payment", type: "select", options: [...PAYMENT_STATUSES] },
        { key: "due_date", label: "Due", type: "date", hideOnMobile: true },
      ],
    },
  ];

  const ims: [string, string, string, number, number, number, string][] = [
    ["DSP-1001", "6.1in LCD screen assembly", "Displays", 42, 15, 2350, "Rack A1"],
    ["DSP-1002", "6.7in OLED screen assembly", "Displays", 9, 10, 4800, "Rack A1"],
    ["DSP-1010", "10.2in tablet digitizer", "Displays", 14, 6, 3100, "Rack A2"],
    ["BAT-2001", "Battery pack 3240mAh", "Batteries", 64, 20, 780, "Rack B1"],
    ["BAT-2002", "Battery pack 4325mAh", "Batteries", 18, 20, 920, "Rack B1"],
    ["CMP-3001", "USB-C charging port flex", "Components", 120, 40, 210, "Bin C3"],
    ["CMP-3004", "Rear camera module 12MP", "Components", 7, 8, 1650, "Bin C4"],
    ["CMP-3008", "Loudspeaker unit", "Components", 55, 20, 260, "Bin C5"],
    ["ACC-4001", "Tempered glass 6.1in", "Accessories", 310, 100, 45, "Shelf D1"],
    ["ACC-4003", "20W USB-C charger", "Accessories", 76, 30, 390, "Shelf D2"],
    ["CON-5001", "Adhesive strips (pack of 50)", "Consumables", 25, 10, 150, "Shelf E1"],
    ["CON-5003", "Thermal paste 5g", "Consumables", 4, 6, 120, "Shelf E1"],
  ];

  const wonAt = (minutesAgo: number): Step => ["Credit check", "Deal won in Bitrix24; order created in Zentra", "bitrix", minutesAgo];
  const orderSpecs: { no: string; customer: string; clientPo: string; items: string; amount: number; stage: OrderStage; payment: "Paid" | "Unpaid"; due: number; steps: Step[] }[] = [
    { no: "ORD-1041", customer: "Lumen Mobile Hub", clientPo: "CPO-55821", items: "40x Battery pack 3240mAh", amount: 31200, stage: "Credit check", payment: "Unpaid", due: 4,
      steps: [wonAt(35)] },
    { no: "ORD-1040", customer: "QuickFix Antipolo", clientPo: "CPO-55790", items: "15x 6.1in LCD screen assembly", amount: 35250, stage: "Purchasing", payment: "Unpaid", due: 3,
      steps: [wonAt(26 * H), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 20 * H]] },
    { no: "ORD-1039", customer: "TechNest Marikina", clientPo: "CPO-55744", items: "60x Tempered glass 6.1in", amount: 2700, stage: "Invoicing", payment: "Paid", due: 2,
      steps: [wonAt(2 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 46 * H],
        ["Purchasing", "Payment received early (OR OR-8812)", "accounting", 40 * H, { payment: "OR-8812" }],
        ["Purchasing", "All items reserved from stock", "purchasing", 30 * H]] },
    { no: "ORD-1038", customer: "Gadget Clinic Pasig", clientPo: "CPO-55702", items: "10x Rear camera module 12MP", amount: 16500, stage: "Delivery", payment: "Unpaid", due: 1,
      steps: [wonAt(4 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 3.8 * D],
        ["Purchasing", "Supplier PO SPO-3317 issued for the missing items", "purchasing", 3.5 * D, { supplierPo: "SPO-3317" }],
        ["Receiving", "Supplier delivery received; receiving report RR-2210 posted", "inventory", 1 * D, { rr: "RR-2210" }],
        ["Invoicing", "Sales invoice SI-4471 and written report WR-1182 issued", "invoicing", 6 * H, { si: "SI-4471", wr: "WR-1182" }]] },
    { no: "ORD-1037", customer: "Repair Bay Taytay", clientPo: "CPO-55688", items: "25x USB-C charging port flex", amount: 5250, stage: "Delivery", payment: "Unpaid", due: -1,
      steps: [wonAt(5 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 4.9 * D],
        ["Purchasing", "All items reserved from stock", "purchasing", 4.5 * D],
        ["Invoicing", "Sales invoice SI-4466 and written report WR-1179 issued", "invoicing", 2 * D, { si: "SI-4466", wr: "WR-1179" }]] },
    { no: "ORD-1036", customer: "CellCare Cainta", clientPo: "CPO-55650", items: "8x 6.7in OLED screen assembly", amount: 38400, stage: "Collection", payment: "Unpaid", due: -2,
      steps: [wonAt(9 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 8.8 * D],
        ["Purchasing", "Supplier PO SPO-3290 issued for the missing items", "purchasing", 8 * D, { supplierPo: "SPO-3290" }],
        ["Receiving", "Supplier delivery received; receiving report RR-2198 posted", "inventory", 4 * D, { rr: "RR-2198" }],
        ["Invoicing", "Sales invoice SI-4458 and written report WR-1170 issued", "invoicing", 2.5 * D, { si: "SI-4458", wr: "WR-1170" }],
        ["Delivery", "Items delivered; delivery receipt DR-7712 signed by the client", "delivery", 3 * H, { dr: "DR-7712" }]] },
    { no: "ORD-1035", customer: "Lumen Mobile Hub", clientPo: "CPO-55611", items: "30x 20W USB-C charger", amount: 11700, stage: "Done", payment: "Paid", due: -3,
      steps: [wonAt(10 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 9.9 * D],
        ["Purchasing", "All items reserved from stock", "purchasing", 9 * D],
        ["Invoicing", "Sales invoice SI-4452 and written report WR-1166 issued", "invoicing", 6 * D, { si: "SI-4452", wr: "WR-1166" }],
        ["Delivery", "Items delivered; delivery receipt DR-7705 signed by the client", "delivery", 1 * D, { dr: "DR-7705" }],
        ["Collection", "Payment collected (OR OR-8820); order closed", "accounting", 2 * H, { payment: "OR-8820" }]] },
    { no: "ORD-1034", customer: "FixPoint Angono", clientPo: "CPO-55598", items: "12x Battery pack 4325mAh", amount: 11040, stage: "Done", payment: "Paid", due: -5,
      steps: [wonAt(12 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 11.9 * D],
        ["Purchasing", "Payment received early (OR OR-8790)", "accounting", 11.5 * D, { payment: "OR-8790" }],
        ["Purchasing", "All items reserved from stock", "purchasing", 11 * D],
        ["Invoicing", "Sales invoice SI-4440 and written report WR-1158 issued", "invoicing", 8 * D, { si: "SI-4440", wr: "WR-1158" }],
        ["Delivery", "Items delivered; delivery receipt DR-7698 signed by the client", "delivery", 6 * D, { dr: "DR-7698" }]] },
    { no: "ORD-1033", customer: "GadgetWorks Cainta", clientPo: "CPO-55570", items: "6x 10.2in tablet digitizer", amount: 18600, stage: "On hold", payment: "Unpaid", due: 5,
      steps: [wonAt(2 * D), ["Credit check", "Put on hold: the client has an unpaid balance", "accounting", 1.5 * D]] },
    { no: "ORD-1032", customer: "iRepair Taytay", clientPo: "CPO-55540", items: "20x Loudspeaker unit", amount: 5200, stage: "Order basis", payment: "Unpaid", due: 8,
      steps: [wonAt(6 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 5.8 * D],
        ["Purchasing", "Supplier PO SPO-3301 issued; the order waits for the supplier (long lead time)", "purchasing", 5 * D, { supplierPo: "SPO-3301" }]] },
    { no: "ORD-1031", customer: "Fone Fix Pasig", clientPo: "CPO-55522", items: "50x Adhesive strips (pack of 50)", amount: 7500, stage: "Receiving", payment: "Unpaid", due: 2,
      steps: [wonAt(3 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 2.9 * D],
        ["Purchasing", "Supplier PO SPO-3320 issued for the missing items", "purchasing", 2 * D, { supplierPo: "SPO-3320" }]] },
    { no: "ORD-1028", customer: "QuickFix Antipolo", clientPo: "CPO-55402", items: "20x 6.1in LCD screen assembly", amount: 47000, stage: "Done", payment: "Paid", due: -24,
      steps: [wonAt(32 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 31.8 * D],
        ["Purchasing", "All items reserved from stock", "purchasing", 31 * D],
        ["Invoicing", "Sales invoice SI-4398 and written report WR-1121 issued", "invoicing", 29 * D, { si: "SI-4398", wr: "WR-1121" }],
        ["Delivery", "Items delivered; delivery receipt DR-7650 signed by the client", "delivery", 27 * D, { dr: "DR-7650" }],
        ["Collection", "Payment collected (OR OR-8701); order closed", "accounting", 25 * D, { payment: "OR-8701" }]] },
    { no: "ORD-1025", customer: "CellCare Cainta", clientPo: "CPO-55360", items: "40x Tempered glass 6.1in", amount: 1800, stage: "Done", payment: "Paid", due: -30,
      steps: [wonAt(36 * D), ["Credit check", "Credit check cleared: no unpaid balance", "accounting", 35.9 * D],
        ["Purchasing", "All items reserved from stock", "purchasing", 35 * D],
        ["Invoicing", "Sales invoice SI-4380 and written report WR-1109 issued", "invoicing", 34 * D, { si: "SI-4380", wr: "WR-1109" }],
        ["Delivery", "Items delivered; delivery receipt DR-7631 signed by the client", "delivery", 31 * D, { dr: "DR-7631" }],
        ["Collection", "Payment collected (OR OR-8688); order closed", "accounting", 29 * D, { payment: "OR-8688" }]] },
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
      archived: false, syncState: (i === 2 ? "conflict" : i === 4 ? "failed" : "synced") as RecordItem["syncState"],
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
  // ORD-1039 was changed in Bitrix24 while a Zentra edit was pending: a seeded conflict.
  remote["ops-3"] = { data: { ...remote["ops-3"].data, items: "80x Tempered glass 6.1in", amount: 3600 }, version: 2 };

  /** Deals won in Bitrix24 that haven't been pulled into Zentra yet. One is incomplete on purpose. */
  const remoteInbox: Record<string, string>[] = [
    { order_no: "ORD-1042", customer: "Mobile Doctor Binangonan", client_po: "CPO-55840", items: "20x Loudspeaker unit", amount: "5200", stage: "Credit check", payment: "Unpaid", due_date: daysFromNow(6) },
    { order_no: "ORD-1043", customer: "", client_po: "CPO-55843", items: "5x 10.2in tablet digitizer", amount: "15500", stage: "Credit check", payment: "Unpaid", due_date: daysFromNow(7) },
    { order_no: "ORD-1044", customer: "TechNest Marikina", client_po: "CPO-55851", items: "50x Adhesive strips (pack of 50)", amount: "7500", stage: "Credit check", payment: "Unpaid", due_date: daysFromNow(5) },
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

  const runSpec: [string, string, number, number, number][] = [
    ["ims", "inventory_oct14.csv", 48, 2, 60 * 24 * 6],
    ["operations", "Bitrix24 sync", 12, 0, 60 * 24 * 5],
    ["ims", "inventory_oct16.csv", 36, 3, 60 * 24 * 4],
    ["operations", "Bitrix24 sync", 15, 1, 60 * 24 * 3],
    ["ims", "stock_count_oct18.csv", 52, 0, 60 * 24 * 2],
    ["operations", "Bitrix24 sync", 9, 0, 60 * 24 * 1],
    ["ims", "receiving_oct20.csv", 22, 2, 60 * 3],
  ];
  const pipelineRuns: PipelineRun[] = runSpec.map(([moduleId, source, total, rejected, minAgo], i) => ({
    id: `run-${i + 1}`, number: 101 + i, moduleId, source, total, rejected, loaded: total - rejected,
    status: rejected ? "completed_with_errors" : "completed",
    startedAt: ago(minAgo), endedAt: ago(minAgo - 1), runBy: source.startsWith("Bitrix") ? "Scheduled sync" : "Carlo Reyes",
  }));

  const rejected: RejectedRow[] = [
    { id: "rej-1", runId: "run-7", moduleId: "ims", rowIndex: 7, errors: ["SKU \"bat2003\" doesn't match the expected format"], raw: { sku: "bat2003", name: "Battery pack 5000mAh", category: "Batteries", on_hand: "30", reorder_level: "10", unit_cost: "1050", location: "Rack B2" }, status: "open", createdAt: ago(60 * 3) },
    { id: "rej-2", runId: "run-7", moduleId: "ims", rowIndex: 15, errors: ["On hand can't be below 0"], raw: { sku: "CMP-3011", name: "Vibration motor", category: "Components", on_hand: "-4", reorder_level: "10", unit_cost: "95", location: "Bin C6" }, status: "open", createdAt: ago(60 * 3) },
    { id: "rej-3", runId: "run-4", moduleId: "operations", rowIndex: 3, errors: ["Customer is required"], raw: { order_no: "ORD-1029", customer: "", client_po: "CPO-55470", items: "4x 20W USB-C charger", amount: "1560", stage: "Credit check", payment: "Unpaid", due_date: daysFromNow(-6) }, status: "dismissed", createdAt: ago(60 * 24 * 3) },
  ];

  const syncOps: SyncOperation[] = [
    { id: "s1", moduleId: "operations", recordId: "ops-3", recordLabel: "ORD-1039", direction: "outbound", status: "conflict", attempts: 1, createdAt: ago(42), error: "The order changed in Bitrix24 after Zentra's last sync.", local: { ...records.find((r) => r.id === "ops-3")!.data }, remote: { ...remote["ops-3"].data } },
    { id: "s2", moduleId: "operations", recordId: "ops-5", recordLabel: "ORD-1037", direction: "outbound", status: "failed", attempts: 3, createdAt: ago(95), error: "Bitrix24 didn't respond after 3 attempts (timeout)." },
    { id: "s3", moduleId: "operations", recordId: "ops-6", recordLabel: "ORD-1036", direction: "outbound", status: "success", attempts: 1, createdAt: ago(130), resolvedAt: ago(130) },
    { id: "s4", moduleId: "operations", recordId: "ops-2", recordLabel: "ORD-1040", direction: "inbound", status: "success", attempts: 1, createdAt: ago(240), resolvedAt: ago(240) },
  ];

  const activity: ActivityEvent[] = [
    { id: "e1", moduleId: "operations", recordId: "ops-3", title: "Sync conflict on ORD-1039", detail: "Changed in both Zentra and Bitrix24. Waiting for review.", actor: "System", level: "warning", at: ago(42) },
    { id: "e3", moduleId: "operations", recordId: "ops-5", title: "Write-back failed for ORD-1037", detail: "Bitrix24 didn't respond after 3 attempts.", actor: "System", level: "error", at: ago(95) },
    { id: "e4", moduleId: "ims", title: "Pipeline run #107 finished", detail: "20 loaded, 2 rejected from receiving_oct20.csv", actor: "Carlo Reyes", level: "warning", at: ago(178) },
    { id: "e6", moduleId: "ims", recordId: "ims-12", title: "Thermal paste 5g is below reorder level", detail: "4 on hand, reorder at 6", actor: "System", level: "warning", at: ago(300) },
    { id: "e8", moduleId: "operations", title: "Bitrix24 sync completed", detail: "9 orders pulled", actor: "Scheduled sync", level: "success", at: ago(60 * 24) },
    { id: "e9", moduleId: "operations", recordId: "ops-1", title: "ORD-1041 received from Bitrix24", detail: "Deal won; the order is waiting for its credit check", actor: "Bitrix24", level: "info", at: ago(35) },
  ];

  const note = (id: string, to: AppNotification["to"], title: string, detail: string, orderId: string | undefined, min: number): AppNotification =>
    ({ id, to, title, detail, orderId, at: ago(min), readBy: [] });
  const notifications: AppNotification[] = [
    note("n1", { position: "accounting" }, "ORD-1041 needs a credit check", "New order from Lumen Mobile Hub", "ops-1", 35),
    note("n2", { position: "purchasing" }, "ORD-1040 is ready for purchasing", "Credit check cleared by Jessa Cruz", "ops-2", 20 * H),
    note("n3", { position: "invoicing" }, "ORD-1039 is ready for invoicing", "All items reserved from stock by Mark Dizon", "ops-3", 30 * H),
    note("n4", { position: "delivery" }, "ORD-1038 is ready for delivery", "SI-4471 and WR-1182 issued by Paolo Garcia", "ops-4", 6 * H),
    note("n5", { position: "accounting" }, "ORD-1036 was delivered unpaid", "Collect the payment from CellCare Cainta", "ops-6", 3 * H),
    note("n6", { position: "inventory" }, "ORD-1031 is waiting for a supplier delivery", "Supplier PO SPO-3320 issued by Mark Dizon", "ops-11", 2 * D),
    note("n7", { role: "dept_head" }, "ORD-1033 is on hold", "GadgetWorks Cainta has an unpaid balance", "ops-9", 1.5 * D),
    note("n8", { role: "dept_head" }, "Write-back failed for ORD-1037", "Bitrix24 didn't respond after 3 attempts", "ops-5", 95),
    note("n9", { role: "dept_head" }, "Sync conflict on ORD-1039", "Changed in both Zentra and Bitrix24", "ops-3", 42),
  ];

  const audit: AuditEntry[] = [
    { id: "a1", actor: "Jessa Cruz", role: "employee", action: "Signed in", target: "Session", at: ago(5) },
    { id: "a7", actor: "Lea Mendoza", role: "employee", action: "Updated order", target: "Operations · ORD-1036: delivered", at: ago(3 * H) },
    { id: "a2", actor: "Carlo Reyes", role: "dept_head", action: "Ran ETL pipeline", target: "Inventory · receiving_oct20.csv", at: ago(180) },
    { id: "a3", actor: "Paolo Garcia", role: "employee", action: "Updated order", target: "Operations · ORD-1038: SI and WR issued", at: ago(6 * H) },
    { id: "a5", actor: "Carlo Reyes", role: "dept_head", action: "Assigned Operations role", target: "Lea Mendoza: Delivery", at: ago(60 * 24 * 3) },
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
    backupSchedule: "every_4_hours" as const,
    outage: false,
  };
}

/** Sample CSV used by "Use sample file" in the pipeline. Rows 4, 7, and 9 fail validation on purpose. */
export const SAMPLE_CSV: Record<string, string> = {
  ims: `sku,name,category,on_hand,reorder_level,unit_cost,location
DSP-1020,5.8in LCD screen assembly,Displays,20,8,2100,Rack A3
BAT-2010,Battery pack 2815mAh,Batteries,35,15,690,Rack B2
CMP-3020,Proximity sensor flex,Components,48,20,180,Bin C6
cmp3021,Earpiece speaker,Components,30,10,140,Bin C6
ACC-4010,Phone case 6.1in,Accessories,150,50,85,Shelf D3
ACC-4011,USB-C cable 1m,Accessories,200,60,95,Shelf D3
CON-5010,Isopropyl alcohol 500ml,Consumables,-3,5,160,Shelf E2
CON-5011,Precision screwdriver set,Consumables,12,4,450,Shelf E2
DSP-1001,6.1in LCD screen assembly,Displays,10,15,2350,Rack A1
CMP-3022,Power button flex,Components,40,15,120,Bin C7`,
  operations: `order_no,customer,client_po,items,amount,stage,payment,due_date
ORD-1050,FixPoint Angono,CPO-55901,10x Battery pack 3240mAh,7800,Credit check,Unpaid,2026-10-28
ORD-1051,Gadget Clinic Pasig,CPO-55902,5x 20W USB-C charger,1950,Credit check,Unpaid,2026-10-29
ORD-1052,,CPO-55903,8x Loudspeaker unit,2080,Credit check,Unpaid,2026-10-29
ORD-1053,Repair Bay Taytay,CPO-55904,12x Tempered glass 6.1in,540,Shipped,Unpaid,2026-10-30`,
};
