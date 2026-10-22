import type { ModuleAccess, Position, Role, User } from "./types";

export type Permission =
  | "dashboard.view"
  | "activity.view"
  | "pipeline.manage"
  | "sync.manage"
  | "modules.manage"
  | "backups.manage"
  | "access.manage"
  | "users.manage"
  | "audit.view";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  dept_head: "Operations Department Head",
  employee: "Department Employee",
};

/** Compact names for tight spaces such as phone-width tables. */
export const ROLE_SHORT_LABEL: Record<Role, string> = {
  super_admin: "Admin",
  dept_head: "Operations Department Head",
  employee: "Employee",
};

export const POSITIONS: Position[] = ["accounting", "purchasing", "inventory", "invoicing", "delivery"];

export const POSITION_LABEL: Record<Position, string> = {
  accounting: "Accounting",
  purchasing: "Purchasing",
  inventory: "Inventory",
  invoicing: "Invoicing",
  delivery: "Delivery",
};

/** Positions that see amounts, costs, and receivables without an explicit grant. */
const FINANCIAL_POSITIONS: Position[] = ["accounting", "invoicing"];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ["dashboard.view", "activity.view", "users.manage", "audit.view"],
  dept_head: [
    "dashboard.view", "activity.view", "pipeline.manage",
    "sync.manage", "modules.manage", "backups.manage", "access.manage",
  ],
  employee: ["dashboard.view", "activity.view"],
};

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || user.status !== "active") return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * The title shown for a person across the app. It names the scope they actually
 * own, so a Department Head of Operations reads "Operations Department Head" rather than a
 * generic role name.
 */
export function titleOf(user: User): string {
  if (user.role === "super_admin") return "IT Administration";
  if (user.role === "dept_head") return `${user.department} Department Head`;
  return "My work";
}

/** The job title shown next to someone's name. */
export function jobTitleOf(user: User): string {
  if (user.role === "employee" && user.position) return POSITION_LABEL[user.position];
  if (user.role === "super_admin") return "Administrator";
  return `${user.department} Department Head`;
}

/**
 * Module-level access. Department Heads have full access. For the baseline modules an
 * employee's position decides it: everyone can view Inventory and orders, only the
 * Inventory position changes Inventory, and orders move through role-owned steps rather
 * than direct edits. Modules registered later follow the Department Head's access grid.
 */
export function moduleAccess(user: User | null | undefined, moduleId: string): ModuleAccess {
  if (!user || user.status !== "active") return "none";
  if (user.role === "dept_head") return "edit";
  // IT Administration reads the baseline lists (for exports and data requests) but never edits them.
  if (user.role === "super_admin") return moduleId === "ims" || moduleId === "operations" ? "view" : "none";
  if (user.role !== "employee") return "none";
  if (moduleId === "ims") return user.position === "inventory" ? "edit" : "view";
  if (moduleId === "operations") return user.position ? "view" : "none";
  return user.moduleAccess[moduleId] ?? "none";
}

/** Export CSV: the Operations Department Head and IT Administration. */
export function canExport(user: User | null | undefined): boolean {
  return !!user && user.status === "active" && (user.role === "dept_head" || user.role === "super_admin");
}

/** Whether the user may see order amounts, unit costs, payments, and receivables. */
export function canViewFinancials(user: User | null | undefined): boolean {
  if (!user || user.status !== "active") return false;
  if (user.role === "super_admin" || user.role === "dept_head") return true;
  return !!user.financialAccess || (!!user.position && FINANCIAL_POSITIONS.includes(user.position));
}

/** Financial access that comes with the position itself, so it can't be revoked separately. */
export const financialByPosition = (user: User) => !!user.position && FINANCIAL_POSITIONS.includes(user.position);

/** Daily Process Summary: Accounting and Department Heads only. */
export function canViewDailySummary(user: User | null | undefined): boolean {
  if (!user || user.status !== "active") return false;
  return user.role === "dept_head" || (user.role === "employee" && user.position === "accounting");
}

/** Monthly Metrics: Department Heads only. */
export function canViewMonthlyMetrics(user: User | null | undefined): boolean {
  return !!user && user.status === "active" && user.role === "dept_head";
}

/**
 * KPIs: everyone sees their own; the Department Head sees every employee and the department
 * total; other employees only when the Department Head has explicitly granted team KPI access.
 */
export function canViewTeamKpis(user: User | null | undefined): boolean {
  if (!user || user.status !== "active") return false;
  return user.role === "dept_head" || (user.role === "employee" && !!user.teamKpiAccess);
}

export function canViewKpisOf(viewer: User | null | undefined, target: User): boolean {
  if (!viewer || viewer.status !== "active") return false;
  return viewer.id === target.id || (canViewTeamKpis(viewer) && viewer.department === target.department);
}

/** Whether the user holds the position that must act on an order step. */
export function canActAs(user: User | null | undefined, position: Position | undefined): boolean {
  return !!user && user.status === "active" && user.role === "employee" && !!position && user.position === position;
}

export const PERMISSION_MATRIX: { label: string; roles: Record<Role, boolean> }[] = [
  { label: "Manage accounts and assign Operations Department Heads", roles: { super_admin: true, dept_head: false, employee: false } },
  { label: "Grant access to financial data", roles: { super_admin: true, dept_head: false, employee: false } },
  { label: "Review the audit log", roles: { super_admin: true, dept_head: false, employee: false } },
  { label: "Register, activate, and configure modules", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Import files and set the rules that check records", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Review update issues and process many records at once", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Manage backups and restore points", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "View monthly metrics and set up the Overview", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "View every employee's key numbers and the department totals", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Assign employees to an Operations role", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Work on orders at the stage assigned to them", roles: { super_admin: false, dept_head: false, employee: true } },
  { label: "Monitor orders and activity", roles: { super_admin: true, dept_head: true, employee: true } },
];

/** What each Operations position can do. Shown on Team Access and enforced in the store. */
export const POSITION_MATRIX: { label: string; positions: Position[] }[] = [
  { label: "View inventory quantities and item details", positions: POSITIONS },
  { label: "Add, edit, or remove inventory items", positions: ["inventory"] },
  { label: "View orders, documents, and order activity", positions: POSITIONS },
  { label: "Clear orders and record payments", positions: ["accounting"] },
  { label: "Issue vendor P.Os and follow up vendors", positions: ["purchasing"] },
  { label: "Receive supplier deliveries and post receiving reports (RR)", positions: ["inventory"] },
  { label: "Issue sales invoices (SI) and sales reports (WR)", positions: ["invoicing"] },
  { label: "Deliver orders and record delivery receipts (DR)", positions: ["delivery"] },
  { label: "See amounts, costs, and receivables", positions: FINANCIAL_POSITIONS },
  { label: "See the Daily process summary", positions: ["accounting"] },
  { label: "See their own key numbers", positions: POSITIONS },
];
