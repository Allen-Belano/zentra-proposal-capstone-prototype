import type { ModuleDef, RecordItem, ValidationRule } from "./types";

export const RULE_LABEL: Record<ValidationRule["kind"], string> = {
  required: "Required",
  number: "Must be a number",
  min: "Minimum value",
  pattern: "Format (regex)",
  unique: "No duplicates",
  oneOf: "Allowed values",
};

function fieldLabel(mod: ModuleDef, key: string) {
  return mod.fields.find((f) => f.key === key)?.label ?? key;
}

/**
 * The validation stage of the ETL pipeline. Every write — CSV import, external sync,
 * or a form edit — passes through here before it reaches the central database.
 */
export function validateRow(
  mod: ModuleDef,
  rules: ValidationRule[],
  row: Record<string, string | number>,
  existing: RecordItem[],
  ignoreId?: string,
  batch: Record<string, string | number>[] = [],
): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.moduleId !== mod.id) continue;
    const raw = row[rule.field];
    const value = raw === undefined || raw === null ? "" : String(raw).trim();
    const label = fieldLabel(mod, rule.field);
    if (rule.kind === "required" && value === "") errors.push(`${label} is required`);
    if (value === "") continue;
    if (rule.kind === "number" && Number.isNaN(Number(value))) errors.push(`${label} must be a number`);
    if (rule.kind === "min" && !Number.isNaN(Number(value)) && Number(value) < Number(rule.value ?? 0))
      errors.push(`${label} can't be below ${rule.value}`);
    if (rule.kind === "pattern" && rule.value) {
      try {
        if (!new RegExp(rule.value).test(value)) errors.push(`${label} "${value}" doesn't match the expected format`);
      } catch {
        /* invalid regex is ignored */
      }
    }
    if (rule.kind === "oneOf" && rule.value) {
      const allowed = rule.value.split("|").map((s) => s.trim().toLowerCase());
      if (!allowed.includes(value.toLowerCase())) errors.push(`${label} "${value}" isn't an allowed value`);
    }
    if (rule.kind === "unique") {
      const dupInDb = existing.some(
        (r) => r.moduleId === mod.id && r.id !== ignoreId && !r.archived && String(r.data[rule.field]).toLowerCase() === value.toLowerCase(),
      );
      const dupInBatch = batch.some((b) => String(b[rule.field] ?? "").trim().toLowerCase() === value.toLowerCase());
      if (dupInDb || dupInBatch) errors.push(`${label} "${value}" already exists`);
    }
  }
  return errors;
}

/** The transform stage: trims text, converts numbers, and normalizes dates to YYYY-MM-DD. */
export function transformRow(mod: ModuleDef, row: Record<string, string | number>) {
  const out: Record<string, string | number> = {};
  for (const f of mod.fields) {
    const v = row[f.key];
    if (v === undefined || v === null || v === "") {
      out[f.key] = f.type === "number" || f.type === "currency" ? 0 : "";
      continue;
    }
    if (f.type === "number" || f.type === "currency") out[f.key] = Number(String(v).replace(/[₱,\s]/g, ""));
    else if (f.type === "date") {
      const d = new Date(String(v));
      out[f.key] = Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
    } else if (f.type === "select" && f.options) {
      const match = f.options.find((o) => o.toLowerCase() === String(v).trim().toLowerCase());
      out[f.key] = match ?? String(v).trim();
    } else out[f.key] = String(v).trim();
  }
  return out;
}

/** Minimal CSV parser that handles quoted values. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === "," && !q) { cells.push(cur); cur = ""; } else cur += c;
    }
    cells.push(cur);
    return cells.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

export function recordLabel(mod: ModuleDef | undefined, data: Record<string, string | number>) {
  if (!mod) return "Record";
  const primary = mod.fields.find((f) => f.primary) ?? mod.fields[0];
  return String(data[primary.key] ?? "Record");
}
