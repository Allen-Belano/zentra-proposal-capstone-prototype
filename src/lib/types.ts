export type Role = "super_admin" | "dept_head" | "employee";
export type ModuleAccess = "none" | "view" | "edit";
/** The five Operations positions. Each Department Employee holds exactly one. */
export type Position = "accounting" | "purchasing" | "inventory" | "invoicing" | "delivery";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  status: "active" | "disabled";
  lastActiveAt: string;
  /** Operations position for Department Employees; it decides their module access and order steps. */
  position?: Position;
  /** Explicit grant from the Super Admin to see amounts, costs, and receivables. */
  financialAccess?: boolean;
  /** Explicit grant from the Department Head to see colleagues' and department KPIs. */
  teamKpiAccess?: boolean;
  /** Access to modules registered after the baseline, set by their Department Head. */
  moduleAccess: Record<string, ModuleAccess>;
}

export type FieldType = "text" | "number" | "currency" | "date" | "select";

export interface ModuleField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Shown as the record's title in lists and logs. */
  primary?: boolean;
  /** Hidden on small screens to keep tables readable. */
  hideOnMobile?: boolean;
  /** Hidden below extra-large screens. */
  hideOnTablet?: boolean;
  /** Money that only users with financial access may see. */
  financial?: boolean;
}

export type AdapterType = "native" | "api" | "database" | "webhook" | "file";
export type SyncFrequency = "realtime" | "every_15_min" | "hourly" | "daily" | "weekly";

export interface ModuleDef {
  id: string;
  name: string;
  recordName: string;
  description: string;
  icon: string;
  kind: "native" | "external";
  source?: string;
  /** Team responsible for the module, so issues have an owner. */
  owner?: string;
  adapter: {
    type: AdapterType;
    endpoint?: string;
    frequency: SyncFrequency;
    /** Adapter connection settings (sample values only in the prototype). */
    connection?: Record<string, string>;
    /** Zentra field key → column or property in the source system. */
    mapping?: Record<string, string>;
  };
  active: boolean;
  baseline?: boolean;
  fields: ModuleField[];
  registeredAt: string;
  registeredBy: string;
  lastSyncedAt?: string;
}

export type SyncState = "local" | "synced" | "pending" | "conflict" | "failed";

/** Documents produced along the order flow. */
export interface OrderDocs {
  clientPo?: string;
  supplierPo?: string;
  rr?: string;
  si?: string;
  wr?: string;
  dr?: string;
  /** Official receipt or reference for the payment. */
  payment?: string;
}

/** One completed step in an order's life, written in plain business language. */
export interface OrderLogEntry {
  id: string;
  /** Stage the order was in when this happened. */
  stage: string;
  description: string;
  by: string;
  position?: Position;
  role: Role | "system";
  at: string;
  note?: string;
}

export interface OrderProcess {
  docs: OrderDocs;
  log: OrderLogEntry[];
}

export interface RecordItem {
  id: string;
  moduleId: string;
  data: Record<string, string | number>;
  /** Present on Operations orders: documents and the step-by-step history. */
  order?: OrderProcess;
  archived: boolean;
  syncState: SyncState;
  externalId?: string;
  /** Version of the external record at the last successful sync. */
  syncedVersion?: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type RuleKind = "required" | "number" | "min" | "pattern" | "unique" | "oneOf";

export interface ValidationRule {
  id: string;
  moduleId: string;
  field: string;
  kind: RuleKind;
  value?: string;
  enabled: boolean;
}

export interface PipelineRun {
  id: string;
  number: number;
  moduleId: string;
  source: string;
  status: "completed" | "completed_with_errors" | "failed";
  total: number;
  loaded: number;
  rejected: number;
  startedAt: string;
  endedAt: string;
  runBy: string;
}

export interface RejectedRow {
  id: string;
  runId: string;
  moduleId: string;
  rowIndex: number;
  errors: string[];
  raw: Record<string, string>;
  status: "open" | "reloaded" | "dismissed";
  createdAt: string;
}

export type SyncOpStatus = "pending" | "success" | "conflict" | "failed";

export interface SyncOperation {
  id: string;
  moduleId: string;
  recordId: string;
  recordLabel: string;
  direction: "inbound" | "outbound";
  status: SyncOpStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  local?: Record<string, string | number>;
  remote?: Record<string, string | number>;
}

export type EventLevel = "info" | "success" | "warning" | "error";

export interface ActivityEvent {
  id: string;
  moduleId?: string;
  recordId?: string;
  title: string;
  detail?: string;
  actor: string;
  level: EventLevel;
  at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  at: string;
}

export interface Backup {
  id: string;
  createdAt: string;
  sizeMb: number;
  type: "scheduled" | "manual";
  status: "available" | "verified";
}

/** Mirror of the external system (mock Bitrix24) used to simulate two-way sync. */
export interface RemoteRecord {
  data: Record<string, string | number>;
  version: number;
}

/** A heads-up for a position or role, e.g. when an order is forwarded to them. */
export interface AppNotification {
  id: string;
  to: { position?: Position; role?: Role };
  title: string;
  detail?: string;
  /** The record this notification is about. */
  recordId?: string;
  /** Which system that record belongs to, so the right page opens. */
  moduleId?: string;
  at: string;
  readBy: string[];
}

export type BatchItemKind = "writeback" | "conflict" | "rejected";

export interface BatchOutcome {
  label: string;
  type: string;
  result: "success" | "failed" | "action";
  message: string;
}

export interface BatchRun {
  id: string;
  at: string;
  by: string;
  outcomes: BatchOutcome[];
}

export type ChartKind = "bar" | "line" | "pie";

/** A Department Head's Overview layout: which widgets show, in order, and each chart's type. */
export interface DashboardPrefs {
  widgets: string[];
  charts: Record<string, ChartKind>;
}
