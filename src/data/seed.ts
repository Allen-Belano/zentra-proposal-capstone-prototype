import type {
  ActivityEvent, AuditEntry, Backup, ModuleDef, PipelineRun, RecordItem, RejectedRow,
  RemoteRecord, SyncOperation, User, ValidationRule,
} from "@/lib/types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

export const DEMO_PASSWORD = "zentra2026";

export const ORDER_STAGES = ["Confirmed", "Preparing", "Ready for dispatch", "In transit", "Delivered"];

export function makeSeed() {
  const users: User[] = [
    { id: "u-admin", name: "Maria Santos", email: "superadmin@ifixz.com", password: DEMO_PASSWORD, role: "super_admin", department: "IT", status: "active", lastActiveAt: ago(30), moduleAccess: {} },
    { id: "u-head", name: "Carlo Reyes", email: "depthead@ifixz.com", password: DEMO_PASSWORD, role: "dept_head", department: "Operations", status: "active", lastActiveAt: ago(12), moduleAccess: {} },
    { id: "u-emp", name: "Jessa Cruz", email: "employee@ifixz.com", password: DEMO_PASSWORD, role: "employee", department: "Operations", status: "active", lastActiveAt: ago(5), moduleAccess: { ims: "edit", operations: "edit" } },
    { id: "u-4", name: "Mark Dizon", email: "mark.dizon@ifixz.com", password: DEMO_PASSWORD, role: "employee", department: "Operations", status: "active", lastActiveAt: ago(190), moduleAccess: { ims: "view", operations: "edit" } },
    { id: "u-5", name: "Ana Lim", email: "ana.lim@ifixz.com", password: DEMO_PASSWORD, role: "employee", department: "Operations", status: "active", lastActiveAt: ago(1500), moduleAccess: { ims: "edit", operations: "none" } },
    { id: "u-6", name: "Paolo Garcia", email: "paolo.garcia@ifixz.com", password: DEMO_PASSWORD, role: "employee", department: "Operations", status: "disabled", lastActiveAt: ago(60 * 24 * 40), moduleAccess: { ims: "view", operations: "view" } },
  ];

  const modules: ModuleDef[] = [
    {
      id: "ims", name: "Inventory", recordName: "Item", icon: "package",
      description: "Stock levels, reorder points, and storage locations.",
      kind: "native", adapter: { type: "native", frequency: "realtime" }, active: true, baseline: true,
      registeredAt: ago(60 * 24 * 30), registeredBy: "Carlo Reyes",
      fields: [
        { key: "sku", label: "SKU", type: "text" },
        { key: "name", label: "Item name", type: "text", primary: true },
        { key: "category", label: "Category", type: "select", options: ["Displays", "Batteries", "Components", "Accessories", "Consumables"], hideOnMobile: true },
        { key: "on_hand", label: "On hand", type: "number" },
        { key: "reorder_level", label: "Reorder at", type: "number", hideOnMobile: true },
        { key: "unit_cost", label: "Unit cost", type: "currency", hideOnMobile: true },
        { key: "location", label: "Location", type: "text", hideOnMobile: true, hideOnTablet: true },
      ],
    },
    {
      id: "operations", name: "Operations", recordName: "Order", icon: "truck",
      description: "Orders that start fulfillment once a deal is won in Bitrix24.",
      kind: "external", source: "Bitrix24",
      adapter: { type: "api", endpoint: "https://ifixz.bitrix24.com/rest/crm.deal", frequency: "realtime" },
      active: true, baseline: true, registeredAt: ago(60 * 24 * 30), registeredBy: "Carlo Reyes", lastSyncedAt: ago(8),
      fields: [
        { key: "order_no", label: "Order no.", type: "text", primary: true },
        { key: "customer", label: "Customer", type: "text" },
        { key: "items", label: "Items", type: "text", hideOnMobile: true, hideOnTablet: true },
        { key: "amount", label: "Amount", type: "currency", hideOnMobile: true },
        { key: "stage", label: "Stage", type: "select", options: ORDER_STAGES },
        { key: "due_date", label: "Due", type: "date", hideOnMobile: true },
        { key: "assigned_to", label: "Assigned to", type: "text", hideOnMobile: true, hideOnTablet: true },
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

  const ops: [string, string, string, number, number, number, string][] = [
    ["ORD-1041", "Lumen Mobile Hub", "40x Battery pack 3240mAh", 31200, 0, 4, "Jessa Cruz"],
    ["ORD-1040", "QuickFix Antipolo", "15x 6.1in LCD screen assembly", 35250, 1, 3, "Mark Dizon"],
    ["ORD-1039", "TechNest Marikina", "60x Tempered glass 6.1in", 2700, 2, 2, "Jessa Cruz"],
    ["ORD-1038", "Gadget Clinic Pasig", "10x Rear camera module 12MP", 16500, 3, 1, "Mark Dizon"],
    ["ORD-1037", "Repair Bay Taytay", "25x USB-C charging port flex", 5250, 3, 1, "Jessa Cruz"],
    ["ORD-1036", "CellCare Cainta", "8x 6.7in OLED screen assembly", 38400, 4, -2, "Mark Dizon"],
    ["ORD-1035", "Lumen Mobile Hub", "30x 20W USB-C charger", 11700, 4, -3, "Jessa Cruz"],
    ["ORD-1034", "FixPoint Angono", "12x Battery pack 4325mAh", 11040, 4, -5, "Mark Dizon"],
  ];

  const records: RecordItem[] = [
    ...ims.map(([sku, name, category, on_hand, reorder_level, unit_cost, location], i) => ({
      id: `ims-${i + 1}`, moduleId: "ims",
      data: { sku, name, category, on_hand, reorder_level, unit_cost, location },
      archived: false, syncState: "local" as const,
      createdAt: ago(60 * 24 * 20), updatedAt: ago(60 * (i + 2)), updatedBy: i % 2 ? "Jessa Cruz" : "Carlo Reyes",
    })),
    ...ops.map(([order_no, customer, items, amount, stage, due, assigned_to], i) => ({
      id: `ops-${i + 1}`, moduleId: "operations",
      data: { order_no, customer, items, amount, stage: ORDER_STAGES[stage], due_date: daysFromNow(due), assigned_to },
      archived: false, syncState: (i === 2 ? "conflict" : i === 4 ? "failed" : "synced") as RecordItem["syncState"],
      externalId: `DEAL-${7710 + i}`, syncedVersion: 1,
      createdAt: ago(60 * 24 * (i + 1)), updatedAt: ago(30 * (i + 1)), updatedBy: assigned_to,
    })),
  ];

  // The mock Bitrix24 copy of each Operations record.
  const remote: Record<string, RemoteRecord> = {};
  for (const r of records.filter((r) => r.moduleId === "operations")) remote[r.id] = { data: { ...r.data }, version: 1 };
  // ORD-1039 was changed in Bitrix24 while a Zentra edit was pending: a seeded conflict.
  remote["ops-3"] = { data: { ...remote["ops-3"].data, items: "80x Tempered glass 6.1in", amount: 3600 }, version: 2 };

  /** Deals won in Bitrix24 that haven't been pulled into Zentra yet. One is incomplete on purpose. */
  const remoteInbox: Record<string, string>[] = [
    { order_no: "ORD-1042", customer: "Mobile Doctor Binangonan", items: "20x Loudspeaker unit", amount: "5200", stage: "Confirmed", due_date: daysFromNow(6), assigned_to: "Jessa Cruz" },
    { order_no: "ORD-1043", customer: "", items: "5x 10.2in tablet digitizer", amount: "15500", stage: "Confirmed", due_date: daysFromNow(7), assigned_to: "Mark Dizon" },
    { order_no: "ORD-1044", customer: "TechNest Marikina", items: "50x Adhesive strips (pack of 50)", amount: "7500", stage: "Confirmed", due_date: daysFromNow(5), assigned_to: "Jessa Cruz" },
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
    { id: "rej-3", runId: "run-4", moduleId: "operations", rowIndex: 3, errors: ["Customer is required"], raw: { order_no: "ORD-1031", customer: "", items: "4x 20W USB-C charger", amount: "1560", stage: "Confirmed", due_date: daysFromNow(-6), assigned_to: "Mark Dizon" }, status: "dismissed", createdAt: ago(60 * 24 * 3) },
  ];

  const syncOps: SyncOperation[] = [
    { id: "s1", moduleId: "operations", recordId: "ops-3", recordLabel: "ORD-1039", direction: "outbound", status: "conflict", attempts: 1, createdAt: ago(42), error: "The order changed in Bitrix24 after Zentra's last sync.", local: { ...records.find((r) => r.id === "ops-3")!.data }, remote: { ...remote["ops-3"].data } },
    { id: "s2", moduleId: "operations", recordId: "ops-5", recordLabel: "ORD-1037", direction: "outbound", status: "failed", attempts: 3, createdAt: ago(95), error: "Bitrix24 didn't respond after 3 attempts (timeout)." },
    { id: "s3", moduleId: "operations", recordId: "ops-6", recordLabel: "ORD-1036", direction: "outbound", status: "success", attempts: 1, createdAt: ago(130), resolvedAt: ago(130) },
    { id: "s4", moduleId: "operations", recordId: "ops-2", recordLabel: "ORD-1040", direction: "inbound", status: "success", attempts: 1, createdAt: ago(240), resolvedAt: ago(240) },
  ];

  const activity: ActivityEvent[] = [
    { id: "e1", moduleId: "operations", recordId: "ops-3", title: "Sync conflict on ORD-1039", detail: "Changed in both Zentra and Bitrix24. Waiting for review.", actor: "System", level: "warning", at: ago(42) },
    { id: "e2", moduleId: "operations", recordId: "ops-4", title: "ORD-1038 moved to In transit", actor: "Mark Dizon", level: "info", at: ago(70) },
    { id: "e3", moduleId: "operations", recordId: "ops-5", title: "Write-back failed for ORD-1037", detail: "Bitrix24 didn't respond after 3 attempts.", actor: "System", level: "error", at: ago(95) },
    { id: "e4", moduleId: "ims", title: "Pipeline run #107 finished", detail: "20 loaded, 2 rejected from receiving_oct20.csv", actor: "Carlo Reyes", level: "warning", at: ago(178) },
    { id: "e5", moduleId: "operations", recordId: "ops-6", title: "ORD-1036 moved to Delivered", actor: "Mark Dizon", level: "success", at: ago(130) },
    { id: "e6", moduleId: "ims", recordId: "ims-12", title: "Thermal paste 5g is below reorder level", detail: "4 on hand, reorder at 6", actor: "System", level: "warning", at: ago(300) },
    { id: "e7", moduleId: "operations", recordId: "ops-2", title: "ORD-1040 moved to Preparing", actor: "Mark Dizon", level: "info", at: ago(240) },
    { id: "e8", moduleId: "operations", title: "Bitrix24 sync completed", detail: "9 orders pulled", actor: "Scheduled sync", level: "success", at: ago(60 * 24) },
    { id: "e9", moduleId: "operations", recordId: "ops-1", title: "ORD-1041 received from Bitrix24", detail: "Deal won, fulfillment started", actor: "Bitrix24", level: "info", at: ago(35) },
  ];

  const audit: AuditEntry[] = [
    { id: "a1", actor: "Jessa Cruz", role: "employee", action: "Signed in", target: "Session", at: ago(5) },
    { id: "a2", actor: "Carlo Reyes", role: "dept_head", action: "Ran ETL pipeline", target: "Inventory · receiving_oct20.csv", at: ago(180) },
    { id: "a3", actor: "Mark Dizon", role: "employee", action: "Updated record", target: "Operations · ORD-1038", at: ago(70) },
    { id: "a4", actor: "Maria Santos", role: "super_admin", action: "Disabled account", target: "Paolo Garcia", at: ago(60 * 24 * 2) },
    { id: "a5", actor: "Carlo Reyes", role: "dept_head", action: "Changed module access", target: "Ana Lim · Operations: none", at: ago(60 * 24 * 3) },
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
    users, modules, records, remote, remoteInbox, rules, pipelineRuns, rejected, syncOps, activity, audit, backups,
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
  operations: `order_no,customer,items,amount,stage,due_date,assigned_to
ORD-1050,FixPoint Angono,10x Battery pack 3240mAh,7800,Confirmed,2026-10-28,Jessa Cruz
ORD-1051,Gadget Clinic Pasig,5x 20W USB-C charger,1950,Confirmed,2026-10-29,Mark Dizon
ORD-1052,,8x Loudspeaker unit,2080,Confirmed,2026-10-29,Jessa Cruz
ORD-1053,Repair Bay Taytay,12x Tempered glass 6.1in,540,Shipped,2026-10-30,Mark Dizon`,
};
