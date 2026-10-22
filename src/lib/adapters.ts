import type { AdapterType, FieldType, ModuleField, RuleKind, SyncFrequency } from "./types";

/** Connection settings each adapter needs. Stored as sample configuration; the prototype never connects. */
export interface AdapterField { key: string; label: string; placeholder?: string; options?: string[] }

export const ADAPTERS: Record<Exclude<AdapterType, "native">, { label: string; hint: string; fields: AdapterField[] }> = {
  api: {
    label: "API", hint: "Records are pulled from, and written back to, a documented endpoint",
    fields: [
      { key: "endpoint", label: "Base endpoint", placeholder: "https://ifixz.bitrix24.com/rest/crm.deal" },
      { key: "auth", label: "Authentication", options: ["OAuth 2.0 client", "Bearer token", "API key header"] },
      { key: "pageSize", label: "Page size", options: ["50", "100", "250"] },
    ],
  },
  database: {
    label: "Database", hint: "A connection to an existing system of record over the site-to-site VPN",
    fields: [
      { key: "host", label: "Host", placeholder: "10.20.4.18" },
      { key: "port", label: "Port", options: ["3306", "5432", "1433"] },
      { key: "database", label: "Database name", placeholder: "legacy_ims" },
      { key: "user", label: "Database user", placeholder: "zentra_sync" },
    ],
  },
  file: {
    label: "Upload",
    hint: "Records come from files you upload in the Data pipeline. The columns in your file are matched to the fields below.",
    // Nothing to connect to: the file itself is uploaded later, and its columns
    // are matched to the fields here, so there is no path or delimiter to set.
    fields: [],
  },
  webhook: {
    label: "Webhook", hint: "The source system pushes events to a Zentra receiver",
    fields: [
      { key: "receiver", label: "Receiver URL", placeholder: "https://workspace.ifixz.com/hooks/service" },
      { key: "secret", label: "Signing secret", placeholder: "whsec_sample_3f81" },
      { key: "events", label: "Subscribed events", options: ["All events", "Created and updated", "Created only"] },
    ],
  },
};

export const ADAPTER_LABEL: Record<AdapterType, string> = {
  native: "Native", api: "API", database: "Database", file: "Upload", webhook: "Webhook",
};

export const FREQUENCY_LABEL: Record<SyncFrequency, string> = {
  realtime: "Real-time",
  every_15_min: "Every 15 minutes",
  hourly: "Every hour",
  daily: "Daily batch",
  weekly: "Weekly batch",
};

export const BATCH_FREQUENCIES: SyncFrequency[] = ["every_15_min", "hourly", "daily", "weekly"];

/** A field being designed in the registration wizard. */
export interface DraftField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required: boolean;
}

/** Starting schemas for modules iFixz is likely to add next. */
export const SCHEMA_TEMPLATES: Record<string, { label: string; hint: string; recordName: string; icon: string; fields: DraftField[] }> = {
  procurement: {
    label: "Purchase orders", hint: "Orders sent to suppliers", recordName: "Purchase order", icon: "cart",
    fields: [
      { key: "po_no", label: "PO no.", type: "text", required: true },
      { key: "supplier", label: "Supplier", type: "text", required: true },
      { key: "total", label: "Total", type: "currency", required: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Received"], required: true },
      { key: "expected", label: "Expected", type: "date", required: false },
    ],
  },
  service: {
    label: "Repair service requests", hint: "Devices brought in for repair", recordName: "Service request", icon: "wrench",
    fields: [
      { key: "ticket_no", label: "Ticket no.", type: "text", required: true },
      { key: "customer", label: "Customer", type: "text", required: true },
      { key: "device", label: "Device", type: "text", required: true },
      { key: "priority", label: "Priority", type: "select", options: ["Urgent", "High", "Normal", "Low"], required: true },
      { key: "received", label: "Received", type: "date", required: true },
    ],
  },
  assets: {
    label: "Asset register", hint: "Tools, equipment, and licences", recordName: "Asset", icon: "boxes",
    fields: [
      { key: "asset_tag", label: "Asset tag", type: "text", required: true },
      { key: "description", label: "Description", type: "text", required: true },
      { key: "category", label: "Category", type: "select", options: ["Hardware", "Software", "Furniture", "Network"], required: true },
      { key: "unit_value", label: "Unit value", type: "currency", required: true },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Good", "Fair", "Retired"], required: true },
    ],
  },
};

export const slugify = (text: string, sep = "-") =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^\\${sep}+|\\${sep}+$`, "g"), "");

/**
 * Rules for checking records, generated from the fields: the first field must be unique, required fields
 * can't be empty, selects only accept their options, amounts can't be negative, and dates
 * must be YYYY-MM-DD.
 */
export function buildRules(fields: DraftField[]): { field: string; kind: RuleKind; value?: string; label: string }[] {
  const rules: { field: string; kind: RuleKind; value?: string; label: string }[] = [];
  fields.forEach((f, i) => {
    if (i === 0) rules.push({ field: f.key, kind: "unique", label: `${f.label} must be unique` });
    if (f.required) rules.push({ field: f.key, kind: "required", label: `${f.label} is required` });
    if (f.type === "select" && f.options?.length) rules.push({ field: f.key, kind: "oneOf", value: f.options.join("|"), label: `${f.label} must be one of ${f.options.join(", ")}` });
    if (f.type === "number" || f.type === "currency") {
      rules.push({ field: f.key, kind: "number", label: `${f.label} must be a number` });
      rules.push({ field: f.key, kind: "min", value: "0", label: `${f.label} can't be negative` });
    }
    if (f.type === "date") rules.push({ field: f.key, kind: "pattern", value: "^\\d{4}-\\d{2}-\\d{2}$", label: `${f.label} must be a date (YYYY-MM-DD)` });
  });
  return rules;
}

/** Turn wizard fields into module fields: the first field is the record's title. */
export const toModuleFields = (fields: DraftField[]): ModuleField[] =>
  fields.map((f, i) => ({
    key: f.key, label: f.label, type: f.type, options: f.type === "select" ? f.options : undefined,
    primary: i === 0, hideOnMobile: i >= 3, hideOnTablet: i >= 5,
  }));
