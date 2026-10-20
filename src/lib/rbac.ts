import type { ModuleAccess, Role, User } from "./types";

export type Permission =
  | "dashboard.view"
  | "activity.view"
  | "records.view"
  | "records.edit"
  | "pipeline.manage"
  | "sync.manage"
  | "modules.manage"
  | "backups.manage"
  | "access.manage"
  | "users.manage"
  | "audit.view";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  dept_head: "Department Head",
  employee: "Department Employee",
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ["dashboard.view", "activity.view", "users.manage", "audit.view"],
  dept_head: [
    "dashboard.view", "activity.view", "records.view", "records.edit", "pipeline.manage",
    "sync.manage", "modules.manage", "backups.manage", "access.manage",
  ],
  employee: ["dashboard.view", "activity.view", "records.view", "records.edit"],
};

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || user.status !== "active") return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/** Module-level access. Department Heads have full access; employees follow their access grid. */
export function moduleAccess(user: User | null | undefined, moduleId: string): ModuleAccess {
  if (!user) return "none";
  if (user.role === "dept_head") return "edit";
  if (user.role === "employee") return user.moduleAccess[moduleId] ?? "none";
  return "none";
}

export const PERMISSION_MATRIX: { label: string; roles: Record<Role, boolean> }[] = [
  { label: "Manage accounts and assign Department Heads", roles: { super_admin: true, dept_head: false, employee: false } },
  { label: "Review the audit log", roles: { super_admin: true, dept_head: false, employee: false } },
  { label: "Register, activate, and configure modules", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Run the ETL pipeline and set validation rules", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Review rejected records and sync issues", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Manage backups and restore points", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "Grant employees module access", roles: { super_admin: false, dept_head: true, employee: false } },
  { label: "View, add, edit, and archive records", roles: { super_admin: false, dept_head: true, employee: true } },
  { label: "Monitor orders and activity", roles: { super_admin: true, dept_head: true, employee: true } },
];
