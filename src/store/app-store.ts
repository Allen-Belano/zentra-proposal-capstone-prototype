import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { makeSeed } from "@/data/seed";
import { actionOwner, actionsFor, ORDER_ACTIONS, parseItems, STAGE_INFO, type OrderStage } from "@/lib/orders";
import { isOpenOverdue, overdueReasonOf, paymentDueOf, slaOf } from "@/lib/sla";
import { can, canActAs, canExport, canViewFinancials, moduleAccess, POSITION_LABEL } from "@/lib/rbac";
import { recordLabel, transformRow, validateRow } from "@/lib/validation";
import { stageLabel } from "@/lib/terms";
import type {
  ActivityEvent, AppNotification, DashboardPrefs, AuditEntry, Backup, BatchItemKind, BatchOutcome, BatchRun, EventLevel, ModuleAccess,
  ModuleDef, OrderDocs, OrderLogEntry, PipelineRun, Position, RecordItem, RejectedRow, RemoteRecord, Role, SyncFrequency,
  SyncOperation, SyncState, User, ValidationRule,
} from "@/lib/types";
import { uid } from "@/lib/utils";

type Seed = ReturnType<typeof makeSeed>;
type Row = Record<string, string | number>;
export type BackupSchedule = "every_4_hours" | "daily" | "weekly";

interface Result { ok: boolean; errors?: string[]; id?: string }
export type ConflictPolicy = "skip" | "zentra" | "external";

/** Who gets told when an order arrives at a stage, and what they read. */
const ARRIVAL: Partial<Record<OrderStage, { to: AppNotification["to"]; title: (no: string) => string }>> = {
  "On hold": { to: { role: "dept_head" }, title: (no) => `${no} is on hold` },
  Purchasing: { to: { position: "purchasing" }, title: (no) => `${no} is ready for purchasing` },
  "Order basis": { to: { position: "purchasing" }, title: (no) => `${no} is waiting for a supplier` },
  Receiving: { to: { position: "inventory" }, title: (no) => `${no} is waiting for a supplier delivery` },
  Invoicing: { to: { position: "invoicing" }, title: (no) => `${no} is ready for invoicing` },
  Delivery: { to: { position: "delivery" }, title: (no) => `${no} is ready for delivery` },
  Collection: { to: { position: "accounting" }, title: (no) => `${no} was delivered unpaid` },
};

interface AppState extends Omit<Seed, "backupSchedule"> {
  sessionUserId: string | null;
  /** Overview layouts, per user. */
  dashboards: Record<string, DashboardPrefs>;
  setDashboard: (prefs: DashboardPrefs | null) => void;
  backupSchedule: BackupSchedule;

  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  resetDemo: () => void;

  /** Validation errors a save would hit, without saving. */
  checkRecord: (moduleId: string, data: Row, recordId?: string) => string[];
  addRecord: (moduleId: string, data: Row) => Result;
  updateRecord: (recordId: string, data: Row) => Result;
  setArchived: (recordId: string, archived: boolean) => Result;
  logExport: (moduleId: string, count: number) => void;
  reportDelay: (recordId: string, note: string) => Result;
  /** Alerts on orders that just passed their delivery limit. Runs on load and every minute. */
  checkOverdue: () => void;
  advanceOrder: (recordId: string, actionId: string, docs: Partial<Record<keyof OrderDocs, string>>) => Result;

  runPipeline: (moduleId: string, source: string, rows: Row[]) => PipelineRun;
  reloadRejected: (rowId: string, data: Row) => Result;
  dismissRejected: (rowId: string) => void;

  syncNow: (moduleId: string) => { pulled: number; updated: number; rejected: number; failed: boolean };
  simulateRemoteEdit: (recordId: string) => void;
  resolveConflict: (opId: string, keep: "zentra" | "external") => void;
  retrySync: (opId: string) => void;
  batchProcess: (items: { kind: BatchItemKind; id: string }[], conflictPolicy: ConflictPolicy) => BatchRun | null;
  setOutage: (on: boolean) => void;

  toggleRule: (ruleId: string) => void;
  addRule: (rule: Omit<ValidationRule, "id" | "enabled">) => void;
  removeRule: (ruleId: string) => void;

  registerModule: (mod: ModuleDef, rules?: { field: string; kind: ValidationRule["kind"]; value?: string }[]) => Result;
  setModuleActive: (moduleId: string, active: boolean) => void;
  setModuleFrequency: (moduleId: string, f: SyncFrequency) => void;

  setUserStatus: (userId: string, status: User["status"]) => void;
  setUserRole: (userId: string, role: Role) => void;
  setModuleAccess: (userId: string, moduleId: string, access: ModuleAccess) => void;
  setUserPosition: (userId: string, position: Position) => Result;
  setFinancialAccess: (userId: string, on: boolean) => Result;
  setTeamKpiAccess: (userId: string, on: boolean) => Result;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  createBackup: () => void;
  testRestore: (backupId: string) => void;
  setBackupSchedule: (s: BackupSchedule) => void;
}

const now = () => new Date().toISOString();

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const me = () => get().users.find((u) => u.id === get().sessionUserId);
      const actorName = () => me()?.name ?? "System";

      const audit = (action: string, target: string) => {
        const u = me();
        if (!u) return;
        const entry: AuditEntry = { id: uid("a-"), actor: u.name, role: u.role, action, target, at: now() };
        set((s) => ({ audit: [entry, ...s.audit].slice(0, 300) }));
      };

      const event = (e: Omit<ActivityEvent, "id" | "at" | "actor"> & { actor?: string }) => {
        const full: ActivityEvent = { id: uid("e-"), at: now(), actor: e.actor ?? actorName(), ...e };
        set((s) => ({ activity: [full, ...s.activity].slice(0, 300) }));
      };

      const notify = (to: AppNotification["to"], title: string, detail?: string, recordId?: string, moduleId?: string) => {
        const n: AppNotification = { id: uid("n-"), to, title, detail, recordId, moduleId, at: now(), readBy: [] };
        set((s) => ({ notifications: [n, ...s.notifications].slice(0, 200) }));
      };

      /** Role checks happen here as well as in the UI, so a hidden button is never the only guard. */
      const denied = (moduleId: string): Result | null => {
        const m = mod(moduleId);
        return moduleAccess(me(), moduleId) === "edit" ? null : { ok: false, errors: [`Your role can view ${m.name} but can't change it.`] };
      };

      const logEntry = (stage: string, description: string, by?: User | string): OrderLogEntry => {
        const u = typeof by === "string" || by === undefined ? undefined : by;
        return {
          id: uid("log-"), stage, description, at: now(),
          by: u ? u.name : (typeof by === "string" ? by : actorName()),
          position: u?.position, role: u ? u.role : "system",
        };
      };

      const mod = (id: string) => get().modules.find((m) => m.id === id)!;
      const patchRecord = (id: string, patch: Partial<RecordItem>) =>
        set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      /** Adds received order items to the matching Inventory items, matched by item name. */
      const receiveStock = (items: string, orderNo: string) => {
        for (const { qty, name } of parseItems(items)) {
          const item = get().records.find((r) => r.moduleId === "ims" && !r.archived && String(r.data.name).toLowerCase() === name.toLowerCase());
          if (!item) continue;
          const before = Number(item.data.on_hand) || 0;
          patchRecord(item.id, { data: { ...item.data, on_hand: before + qty }, updatedAt: now(), updatedBy: actorName() });
          event({ moduleId: "ims", recordId: item.id, title: `${name}: ${qty} received`, detail: `Stock ${before} → ${before + qty}, from ${orderNo}`, level: "success" });
        }
      };
      const patchOp = (id: string, patch: Partial<SyncOperation>) =>
        set((s) => ({ syncOps: s.syncOps.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

      /**
       * Outbound write-back to the external system. The change is already committed in
       * Zentra; this pushes it to Bitrix24 with conflict detection and retries.
       */
      const pushOutbound = (recordId: string, opId: string, attempt = 1) => {
        setTimeout(() => {
          const s = get();
          const rec = s.records.find((r) => r.id === recordId);
          const op = s.syncOps.find((o) => o.id === opId);
          if (!rec || !op) return;
          const label = recordLabel(mod(rec.moduleId), rec.data);
          const source = mod(rec.moduleId).source ?? "The source system";
          if (s.outage) {
            if (attempt < 3) {
              patchOp(opId, { attempts: attempt });
              pushOutbound(recordId, opId, attempt + 1);
              return;
            }
            patchOp(opId, { status: "failed", attempts: 3, error: `${source} didn't respond after 3 attempts (timeout).` });
            patchRecord(recordId, { syncState: "failed" });
            event({ moduleId: rec.moduleId, recordId, title: `Couldn't send ${label} to ${source}`, detail: `${source} didn't respond after 3 attempts.`, level: "error", actor: "System" });
            notify({ role: "dept_head" }, `Couldn't send ${label} to ${source}`, `${source} didn't respond after 3 attempts`, recordId, rec.moduleId);
            return;
          }
          const remote = s.remote[recordId];
          if (remote && rec.syncedVersion !== undefined && remote.version !== rec.syncedVersion) {
            patchOp(opId, { status: "conflict", attempts: attempt, error: `The record changed in ${source} after Zentra's last update.`, local: { ...rec.data }, remote: { ...remote.data } });
            patchRecord(recordId, { syncState: "conflict" });
            event({ moduleId: rec.moduleId, recordId, title: `${label} changed in both systems`, detail: `Changed in both Zentra and ${source}. Waiting for review.`, level: "warning", actor: "System" });
            notify({ role: "dept_head" }, `${label} changed in both systems`, `Changed in both Zentra and ${source}`, recordId, rec.moduleId);
            return;
          }
          const version = (remote?.version ?? 0) + 1;
          set((st) => ({ remote: { ...st.remote, [recordId]: { data: { ...rec.data }, version } } }));
          patchRecord(recordId, { syncState: "synced", syncedVersion: version, externalId: rec.externalId ?? `DEAL-${7700 + Math.floor(Math.random() * 300)}` });
          patchOp(opId, { status: "success", attempts: attempt, resolvedAt: now() });
          set((st) => ({ modules: st.modules.map((m) => (m.id === rec.moduleId ? { ...m, lastSyncedAt: now() } : m)) }));
        }, attempt === 1 ? 1400 : 900);
      };

      const queueOutbound = (rec: RecordItem) => {
        const op: SyncOperation = {
          id: uid("s-"), moduleId: rec.moduleId, recordId: rec.id, recordLabel: recordLabel(mod(rec.moduleId), rec.data),
          direction: "outbound", status: "pending", attempts: 0, createdAt: now(),
        };
        // A newer write-back replaces older unresolved ones for the same record.
        set((s) => ({
          syncOps: [op, ...s.syncOps.map((o) => (o.recordId === rec.id && o.status !== "success" && o.status !== "pending" ? { ...o, status: "success" as const, resolution: "Superseded by a newer change", resolvedAt: now() } : o))],
        }));
        patchRecord(rec.id, { syncState: "pending" });
        pushOutbound(rec.id, op.id);
      };

      const load = (moduleId: string, data: Row, source?: string): RecordItem => {
        const m = mod(moduleId);
        const clean = transformRow(m, data);
        const rec: RecordItem = {
          id: uid(`${moduleId}-`), moduleId, data: clean, archived: false,
          syncState: m.kind === "external" ? "pending" : "local",
          createdAt: now(), updatedAt: now(), updatedBy: actorName(),
        };
        if (moduleId === "operations") {
          const fromBitrix = source?.startsWith("Bitrix24");
          const description = fromBitrix ? "Order confirmed in Bitrix24; order created in Zentra"
            : source ? `Order imported from ${source}` : "Order created in Zentra";
          rec.order = {
            docs: { clientPo: String(clean.client_po || "") || undefined },
            log: [logEntry(String(clean.stage), description, fromBitrix ? "Bitrix24" : me())],
          };
          const no = String(clean.order_no);
          notify({ position: "accounting" }, `${no} is ready for Accounting`, `New order from ${clean.customer || "a client"}`, rec.id, "operations");
        }
        set((s) => ({ records: [rec, ...s.records] }));
        return rec;
      };

      return {
        ...makeSeed(),
        sessionUserId: null,
        dashboards: {},

        setDashboard: (prefs) => {
          const u = me();
          if (!u || u.role !== "dept_head") return;
          set((s) => {
            const next = { ...s.dashboards };
            if (prefs) next[u.id] = prefs; else delete next[u.id];
            return { dashboards: next };
          });
          audit(prefs ? "Customized Overview" : "Reset Overview layout", prefs ? `${prefs.widgets.length} widgets` : "Default layout");
        },

        login: (email, password) => {
          const u = get().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
          if (!u || u.password !== password) return { ok: false, error: "Email or password is incorrect." };
          if (u.status === "disabled") return { ok: false, error: "This account is disabled. Contact your Super Admin." };
          set((s) => ({ sessionUserId: u.id, users: s.users.map((x) => (x.id === u.id ? { ...x, lastActiveAt: now() } : x)) }));
          audit("Signed in", "Session");
          return { ok: true };
        },
        logout: () => {
          audit("Signed out", "Session");
          set({ sessionUserId: null });
        },
        resetDemo: () => set({ ...makeSeed(), sessionUserId: get().sessionUserId, dashboards: {} }),

        checkRecord: (moduleId, data, recordId) => {
          const m = mod(moduleId);
          const rec = recordId ? get().records.find((r) => r.id === recordId) : undefined;
          const merged = { ...data };
          if (rec && !canViewFinancials(me())) for (const f of m.fields) if (f.financial) merged[f.key] = rec.data[f.key];
          return validateRow(m, get().rules, merged, get().records, recordId);
        },

        addRecord: (moduleId, data) => {
          const block = denied(moduleId);
          if (block) return block;
          const m = mod(moduleId);
          const errors = validateRow(m, get().rules, data, get().records);
          if (errors.length) return { ok: false, errors };
          const rec = load(moduleId, data);
          const label = recordLabel(m, rec.data);
          event({ moduleId, recordId: rec.id, title: `${m.recordName} ${label} added`, level: "info" });
          audit("Added record", `${m.name}: ${label}`);
          if (m.kind === "external") queueOutbound(rec);
          return { ok: true, id: rec.id };
        },

        updateRecord: (recordId, data) => {
          const rec = get().records.find((r) => r.id === recordId)!;
          const block = denied(rec.moduleId);
          if (block) return block;
          const m = mod(rec.moduleId);
          // Fields the user can't see keep their stored values instead of being blanked.
          const merged = { ...data };
          if (!canViewFinancials(me())) for (const f of m.fields) if (f.financial) merged[f.key] = rec.data[f.key];
          const errors = validateRow(m, get().rules, merged, get().records, recordId);
          if (errors.length) return { ok: false, errors };
          const next = transformRow(m, merged);
          const stageChanged = rec.data.stage !== undefined && rec.data.stage !== next.stage;
          const paymentChanged = rec.data.payment !== undefined && rec.data.payment !== next.payment;
          const notes = [
            stageChanged && `stage changed from ${stageLabel(String(rec.data.stage))} to ${stageLabel(String(next.stage))}`,
            paymentChanged && `payment marked ${next.payment}`,
          ].filter(Boolean);
          const order = rec.order && notes.length
            ? { ...rec.order, log: [...rec.order.log, logEntry(String(rec.data.stage), `Order details edited: ${notes.join(", ")}`, me())] }
            : rec.order;
          const updated = { ...rec, data: next, order, updatedAt: now(), updatedBy: actorName() };
          patchRecord(recordId, updated);
          const label = recordLabel(m, next);
          event({ moduleId: m.id, recordId, title: `${m.recordName} ${label} updated`, level: "info" });
          audit("Updated record", `${m.name}: ${label}`);
          if (m.kind === "native" && Number(next.on_hand) <= Number(next.reorder_level) && Number(rec.data.on_hand) > Number(rec.data.reorder_level)) {
            event({ moduleId: m.id, recordId, title: `${label} is below reorder level`, detail: `${next.on_hand} on hand, reorder at ${next.reorder_level}`, level: "warning", actor: "System" });
          }
          if (m.kind === "external") queueOutbound(updated);
          return { ok: true };
        },

        setArchived: (recordId, archived) => {
          const rec = get().records.find((r) => r.id === recordId)!;
          const block = denied(rec.moduleId);
          if (block) return block;
          const m = mod(rec.moduleId);
          patchRecord(recordId, { archived, updatedAt: now(), updatedBy: actorName() });
          audit(archived ? "Archived record" : "Restored record", `${m.name}: ${recordLabel(m, rec.data)}`);
          return { ok: true };
        },

        logExport: (moduleId, count) => {
          if (!canExport(me())) return;
          audit("Exported a CSV file", `${mod(moduleId).name}: ${count} record${count === 1 ? "" : "s"}`);
        },

        reportDelay: (recordId, note) => {
          const u = me();
          const rec = get().records.find((r) => r.id === recordId);
          if (!u || !rec?.order) return { ok: false, errors: ["This order no longer exists."] };
          const owner = STAGE_INFO[rec.data.stage as OrderStage]?.owner;
          if (!canActAs(u, owner)) return { ok: false, errors: [`Only ${owner ? POSITION_LABEL[owner] : "the assigned role"} can report a delay on this order.`] };
          const sla = slaOf(rec);
          const payLate = rec.data.stage === "Collection" && paymentDueOf(rec)?.state !== "on_track" && !!paymentDueOf(rec);
          if (rec.data.stage === "Collection" ? !payLate : (rec.data.stage === "Done" || !sla || (!sla.late && !sla.hardToSource)))
            return { ok: false, errors: [rec.data.stage === "Collection" ? "This payment isn't overdue." : "This order is within its delivery limit."] };
          const text = note.trim();
          if (!text) return { ok: false, errors: ["Write a short note about the delay"] };
          const m = mod(rec.moduleId);
          const no = recordLabel(m, rec.data);
          const entry: OrderLogEntry = { ...logEntry(String(rec.data.stage), "Delay reported: outside our control", u), note: text, delay: true };
          patchRecord(recordId, { updatedAt: now(), updatedBy: u.name, order: { ...rec.order, log: [...rec.order.log, entry] } });
          notify({ role: "dept_head" }, `${no}: delay reported`, `${text} (${u.name})`, recordId, "operations");
          event({ moduleId: "operations", recordId, title: `Delay reported on ${no}`, detail: text, level: "info" });
          audit("Reported a delay", `${m.name} · ${no}`);
          return { ok: true };
        },

        checkOverdue: () => {
          const seen = new Set(get().overdueNotified);
          const fresh = get().records.filter((r) => r.moduleId === "operations" && !r.archived && !seen.has(r.id) && isOpenOverdue(r));
          if (!fresh.length) return;
          for (const r of fresh) {
            const sla = slaOf(r)!;
            const no = String(r.data.order_no);
            const reason = overdueReasonOf(r);
            const owner = STAGE_INFO[r.data.stage as OrderStage]?.owner;
            const detail = `${sla.lateDays} day${sla.lateDays === 1 ? "" : "s"} past the ${sla.days}-day limit. ${reason ?? "No reason recorded yet."}`;
            if (owner) notify({ position: owner }, `${no} is past its delivery limit`, detail, r.id, "operations");
            notify({ role: "dept_head" }, `${no} is past its delivery limit`, detail, r.id, "operations");
            event({ moduleId: "operations", recordId: r.id, title: `${no} is past its delivery limit`, detail, level: reason ? "warning" : "error", actor: "System" });
          }
          set((s) => ({ overdueNotified: [...s.overdueNotified, ...fresh.map((r) => r.id)] }));
        },

        advanceOrder: (recordId, actionId, docs) => {
          const u = me();
          const rec = get().records.find((r) => r.id === recordId);
          const action = ORDER_ACTIONS.find((a) => a.id === actionId);
          if (!u || !rec?.order || !action) return { ok: false, errors: ["This order or stage no longer exists."] };
          if (!actionsFor(rec).includes(action)) return { ok: false, errors: [`"${action.label}" isn't available at the ${stageLabel(String(rec.data.stage))} stage.`] };
          const owner = actionOwner(rec, action);
          if (!canActAs(u, owner)) return { ok: false, errors: [`Only ${owner ? POSITION_LABEL[owner] : "the assigned role"} can do this.`] };
          const missing = (action.docs ?? []).filter((d) => !String(docs[d.key] ?? "").trim());
          if (missing.length) return { ok: false, errors: missing.map((d) => `${d.label} is required`) };
          const clean = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, String(v).trim().toUpperCase()]));
          const m = mod(rec.moduleId);
          const paid = action.markPaid ? "Paid" : rec.data.payment;
          const stage = action.next ? action.next({ ...rec, data: { ...rec.data, payment: paid } }) : rec.data.stage;
          const data = { ...rec.data, stage, payment: paid };
          const errors = validateRow(m, get().rules, data, get().records, recordId);
          if (errors.length) return { ok: false, errors };
          const description = action.describe(clean);
          const updated: RecordItem = {
            ...rec, data, updatedAt: now(), updatedBy: u.name,
            order: { docs: { ...rec.order.docs, ...clean }, log: [...rec.order.log, logEntry(String(rec.data.stage), description, u)] },
          };
          patchRecord(recordId, updated);
          const no = recordLabel(m, data);
          if (action.addsStock) receiveStock(String(rec.data.items ?? ""), no);
          const arrival = stage !== rec.data.stage ? ARRIVAL[stage as OrderStage] : undefined;
          if (arrival) notify(arrival.to, arrival.title(no), `${description} (${u.name})`, recordId, "operations");
          audit("Updated order", `${m.name} · ${no}: ${action.label.toLowerCase()}`);
          queueOutbound(updated);
          return { ok: true };
        },

        runPipeline: (moduleId, source, rows) => {
          const m = mod(moduleId);
          const accepted: Row[] = [];
          const rejectedRows: RejectedRow[] = [];
          const runId = uid("run-");
          rows.forEach((row, i) => {
            const errors = validateRow(m, get().rules, row, get().records, undefined, accepted);
            if (errors.length) {
              rejectedRows.push({
                id: uid("rej-"), runId, moduleId, rowIndex: i + 2, errors,
                raw: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)])), status: "open", createdAt: now(),
              });
            } else accepted.push(row);
          });
          const loaded = accepted.map((row) => load(moduleId, row, source));
          if (m.kind === "external") loaded.forEach((r) => queueOutbound(r));
          const runs = get().pipelineRuns;
          const run: PipelineRun = {
            id: runId, number: (runs.at(-1)?.number ?? 100) + 1, moduleId, source,
            status: rows.length === 0 ? "failed" : rejectedRows.length ? "completed_with_errors" : "completed",
            total: rows.length, loaded: loaded.length, rejected: rejectedRows.length,
            startedAt: now(), endedAt: now(), runBy: actorName(),
          };
          set((s) => ({ pipelineRuns: [...s.pipelineRuns, run], rejected: [...rejectedRows, ...s.rejected] }));
          event({
            moduleId, title: `File import #${run.number} finished`,
            detail: `${run.loaded} validated, ${run.rejected} need fixing, from ${source}`,
            level: run.rejected ? "warning" : "success",
          });
          audit("Imported a file", `${m.name}: ${source}`);
          return run;
        },

        reloadRejected: (rowId, data) => {
          const row = get().rejected.find((r) => r.id === rowId)!;
          const m = mod(row.moduleId);
          const errors = validateRow(m, get().rules, data, get().records);
          if (errors.length) {
            set((s) => ({ rejected: s.rejected.map((r) => (r.id === rowId ? { ...r, errors } : r)) }));
            return { ok: false, errors };
          }
          const rec = load(row.moduleId, data, "the list of records to fix");
          if (m.kind === "external") queueOutbound(rec);
          set((s) => ({ rejected: s.rejected.map((r) => (r.id === rowId ? { ...r, status: "reloaded", raw: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) } : r)) }));
          audit("Fixed and validated a record that needed fixing", `${m.name}: ${recordLabel(m, rec.data)}`);
          event({ moduleId: m.id, recordId: rec.id, title: `Rejected row fixed: ${recordLabel(m, rec.data)}`, detail: "Passed validation and loaded", level: "success" });
          return { ok: true };
        },

        dismissRejected: (rowId) => {
          const row = get().rejected.find((r) => r.id === rowId)!;
          set((s) => ({ rejected: s.rejected.map((r) => (r.id === rowId ? { ...r, status: "dismissed" } : r)) }));
          audit("Dismissed a record that needed fixing", `${mod(row.moduleId).name}: row ${row.rowIndex}`);
        },

        syncNow: (moduleId) => {
          const m = mod(moduleId);
          if (get().outage) {
            event({ moduleId, title: `${m.source} sync failed`, detail: `${m.source} is unreachable. Showing the last synced data.`, level: "error", actor: "System" });
            return { pulled: 0, updated: 0, rejected: 0, failed: true };
          }
          // 1) Pull changes made in Bitrix24 to records that have no pending Zentra edit.
          let updated = 0;
          const s = get();
          const inboundOps: SyncOperation[] = [];
          const records = s.records.map((r) => {
            const remote: RemoteRecord | undefined = s.remote[r.id];
            if (r.moduleId !== moduleId || !remote || r.syncState !== "synced" || remote.version === r.syncedVersion) return r;
            updated++;
            inboundOps.push({ id: uid("s-"), moduleId, recordId: r.id, recordLabel: recordLabel(m, remote.data), direction: "inbound", status: "success", attempts: 1, createdAt: now(), resolvedAt: now() });
            return { ...r, data: { ...remote.data }, syncedVersion: remote.version, updatedAt: now(), updatedBy: `${m.source} sync` };
          });
          set({ records, syncOps: [...inboundOps, ...s.syncOps] });
          // 2) New deals won in Bitrix24 enter through the ETL pipeline. The mock inbox only holds Bitrix24 deals.
          const inbox = moduleId === "operations" ? get().remoteInbox : [];
          let pulled = 0;
          let rejectedCount = 0;
          if (inbox.length) {
            const run = get().runPipeline(moduleId, `${m.source} sync`, inbox);
            pulled = run.loaded;
            rejectedCount = run.rejected;
            set({ remoteInbox: [] });
          }
          set((st) => ({ modules: st.modules.map((x) => (x.id === moduleId ? { ...x, lastSyncedAt: now() } : x)) }));
          if (updated) event({ moduleId, title: `${m.source} sync completed`, detail: `${updated} order${updated > 1 ? "s" : ""} updated from ${m.source}`, level: "success", actor: "System" });
          return { pulled, updated, rejected: rejectedCount, failed: false };
        },

        simulateRemoteEdit: (recordId) => {
          const r = get().remote[recordId];
          const rec = get().records.find((x) => x.id === recordId);
          if (!r || !rec) return;
          const due = new Date(String(r.data.due_date || new Date().toISOString().slice(0, 10)));
          due.setDate(due.getDate() + 2);
          const data = { ...r.data, due_date: due.toISOString().slice(0, 10) };
          set((s) => ({ remote: { ...s.remote, [recordId]: { data, version: r.version + 1 } } }));
          event({ moduleId: rec.moduleId, recordId, title: `${recordLabel(mod(rec.moduleId), data)} changed in Bitrix24`, detail: "Due date moved by 2 days", level: "info", actor: "Bitrix24" });
        },

        resolveConflict: (opId, keep) => {
          const op = get().syncOps.find((o) => o.id === opId)!;
          const rec = get().records.find((r) => r.id === op.recordId)!;
          const remote = get().remote[op.recordId];
          const m = mod(op.moduleId);
          if (keep === "zentra") {
            const version = (remote?.version ?? 0) + 1;
            set((s) => ({ remote: { ...s.remote, [rec.id]: { data: { ...rec.data }, version } } }));
            patchRecord(rec.id, { syncState: "synced", syncedVersion: version });
          } else {
            patchRecord(rec.id, { data: { ...remote.data }, syncState: "synced", syncedVersion: remote.version, updatedAt: now(), updatedBy: `${m.source} sync` });
          }
          const resolution = keep === "zentra" ? "Kept the Zentra version and sent it" : `Kept the ${m.source} version`;
          patchOp(opId, { status: "success", resolution, resolvedAt: now(), resolvedBy: actorName() });
          event({ moduleId: m.id, recordId: rec.id, title: `${op.recordLabel} reviewed and kept`, detail: resolution, level: "success" });
          audit("Resolved sync conflict", `${op.recordLabel}: ${resolution}`);
        },

        retrySync: (opId) => {
          const op = get().syncOps.find((o) => o.id === opId)!;
          const rec = get().records.find((r) => r.id === op.recordId)!;
          patchOp(opId, { status: "success", resolution: "Retried", resolvedAt: now(), resolvedBy: actorName() });
          audit("Sent to the source again", op.recordLabel);
          queueOutbound(rec);
        },

        batchProcess: (items, conflictPolicy) => {
          const u = me();
          if (!can(u, "sync.manage")) return null;
          const outcomes: BatchOutcome[] = [];
          for (const item of items) {
            if (item.kind === "rejected") {
              const row = get().rejected.find((r) => r.id === item.id && r.status === "open");
              if (!row) continue;
              const m = mod(row.moduleId);
              const label = recordLabel(m, row.raw) || `Row ${row.rowIndex}`;
              if (moduleAccess(u, m.id) !== "edit") {
                outcomes.push({ label, type: m.recordName, result: "failed", message: `No permission to load ${m.name} records` });
                continue;
              }
              const errors = validateRow(m, get().rules, row.raw, get().records);
              if (errors.length) {
                set((s) => ({ rejected: s.rejected.map((r) => (r.id === row.id ? { ...r, errors } : r)) }));
                outcomes.push({ label, type: m.recordName, result: "failed", message: errors.join("; ") });
                continue;
              }
              const rec = load(m.id, row.raw, "batch processing");
              if (m.kind === "external") queueOutbound(rec);
              set((s) => ({ rejected: s.rejected.map((r) => (r.id === row.id ? { ...r, status: "reloaded" } : r)) }));
              outcomes.push({ label, type: m.recordName, result: "success", message: "Passed validation and loaded" });
              continue;
            }
            const op = get().syncOps.find((o) => o.id === item.id);
            const rec = op && get().records.find((r) => r.id === op.recordId);
            if (!op || !rec) continue;
            const type = mod(op.moduleId).recordName;
            if (item.kind === "conflict") {
              if (op.status !== "conflict") continue;
              if (conflictPolicy === "skip") {
                outcomes.push({ label: op.recordLabel, type, result: "action", message: "Needs a decision: choose which version to keep" });
              } else {
                get().resolveConflict(op.id, conflictPolicy);
                outcomes.push({ label: op.recordLabel, type, result: "success", message: conflictPolicy === "zentra" ? "Kept the Zentra version and pushed it" : "Kept the Bitrix24 version" });
              }
              continue;
            }
            if (op.status !== "failed") continue;
            if (get().outage) {
              outcomes.push({ label: op.recordLabel, type, result: "failed", message: "Bitrix24 is unreachable; try again later" });
              continue;
            }
            patchOp(op.id, { status: "success", resolution: "Retried in a batch", resolvedAt: now(), resolvedBy: actorName() });
            queueOutbound(rec);
            outcomes.push({ label: op.recordLabel, type, result: "success", message: "Sent to Bitrix24 again" });
          }
          const run: BatchRun = { id: uid("batch-"), at: now(), by: actorName(), outcomes };
          set((s) => ({ batches: [run, ...s.batches].slice(0, 20) }));
          const count = (r: BatchOutcome["result"]) => outcomes.filter((o) => o.result === r).length;
          audit("Ran batch processing", `${outcomes.length} records: ${count("success")} succeeded, ${count("failed")} failed, ${count("action")} need action`);
          return run;
        },

        setOutage: (on) => {
          set({ outage: on });
          event({ moduleId: "operations", title: on ? "Bitrix24 is unreachable" : "Bitrix24 connection restored", level: on ? "error" : "success", actor: "System" });
        },

        toggleRule: (ruleId) => {
          set((s) => ({ rules: s.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)) }));
          const r = get().rules.find((x) => x.id === ruleId)!;
          audit(r.enabled ? "Enabled validation rule" : "Disabled validation rule", `${mod(r.moduleId).name}: ${r.field} (${r.kind})`);
        },
        addRule: (rule) => {
          set((s) => ({ rules: [...s.rules, { ...rule, id: uid("r-"), enabled: true }] }));
          audit("Added validation rule", `${mod(rule.moduleId).name}: ${rule.field} (${rule.kind})`);
        },
        removeRule: (ruleId) => {
          const r = get().rules.find((x) => x.id === ruleId)!;
          set((s) => ({ rules: s.rules.filter((x) => x.id !== ruleId) }));
          audit("Removed validation rule", `${mod(r.moduleId).name}: ${r.field} (${r.kind})`);
        },

        registerModule: (m, rules = []) => {
          if (!can(me(), "modules.manage")) return { ok: false, errors: ["Only the Super Admin or the Operations Department Head can connect systems."] };
          if (get().modules.some((x) => x.id === m.id)) return { ok: false, errors: [`A module with the key "${m.id}" already exists.`] };
          const full: ModuleDef = { ...m, registeredAt: now(), registeredBy: actorName(), lastSyncedAt: m.kind === "external" ? now() : undefined };
          set((s) => ({
            modules: [...s.modules, full],
            rules: [...s.rules, ...rules.map((r) => ({ ...r, id: uid("r-"), moduleId: m.id, enabled: true }))],
            users: s.users.map((u) => (u.role === "employee" ? { ...u, moduleAccess: { ...u.moduleAccess, [m.id]: "none" } } : u)),
          }));
          event({
            moduleId: m.id, title: `${m.name} module registered`, level: "success",
            detail: `${m.active ? "Activated" : "Saved inactive"} without redeploying · ${rules.length} validation rule${rules.length === 1 ? "" : "s"}`,
          });
          audit("Registered module", `${m.name} (${m.kind === "native" ? "native" : `${m.adapter.type} adapter`})`);
          return { ok: true };
        },
        setModuleActive: (moduleId, active) => {
          set((s) => ({ modules: s.modules.map((m) => (m.id === moduleId ? { ...m, active } : m)) }));
          audit(active ? "Activated module" : "Deactivated module", mod(moduleId).name);
        },
        setModuleFrequency: (moduleId, f) => {
          set((s) => ({ modules: s.modules.map((m) => (m.id === moduleId ? { ...m, adapter: { ...m.adapter, frequency: f } } : m)) }));
          audit("Changed sync frequency", `${mod(moduleId).name}: ${f}`);
        },

        setUserStatus: (userId, status) => {
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, status } : u)) }));
          audit(status === "active" ? "Enabled account" : "Disabled account", get().users.find((u) => u.id === userId)!.name);
        },
        setUserRole: (userId, role) => {
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, role } : u)) }));
          audit("Changed role", `${get().users.find((u) => u.id === userId)!.name}: ${role}`);
        },
        setUserPosition: (userId, position) => {
          const u = me();
          const target = get().users.find((x) => x.id === userId);
          if (!can(u, "access.manage") || !target || target.role !== "employee" || target.department !== u?.department) {
            return { ok: false, errors: ["You can only assign roles to employees in your department."] };
          }
          set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, position } : x)) }));
          audit("Assigned Operations role", `${target.name}: ${POSITION_LABEL[position]}`);
          return { ok: true };
        },
        setFinancialAccess: (userId, on) => {
          const target = get().users.find((x) => x.id === userId);
          if (!can(me(), "users.manage") || !target) return { ok: false, errors: ["Only the Super Admin can grant financial access."] };
          set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, financialAccess: on } : x)) }));
          audit(on ? "Granted financial data access" : "Revoked financial data access", target.name);
          return { ok: true };
        },

        setTeamKpiAccess: (userId, on) => {
          const u = me();
          const target = get().users.find((x) => x.id === userId);
          if (!can(u, "access.manage") || !target || target.role !== "employee" || target.department !== u?.department) {
            return { ok: false, errors: ["Only the Operations Department Head can let the team see key numbers."] };
          }
          set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, teamKpiAccess: on } : x)) }));
          audit(on ? "Shared the team's key numbers" : "Stopped sharing the team's key numbers", target.name);
          return { ok: true };
        },

        markNotificationRead: (id) => {
          const u = me();
          if (!u) return;
          set((s) => ({ notifications: s.notifications.map((n) => (n.id === id && !n.readBy.includes(u.id) ? { ...n, readBy: [...n.readBy, u.id] } : n)) }));
        },
        markAllNotificationsRead: () => {
          const u = me();
          if (!u) return;
          set((s) => ({ notifications: s.notifications.map((n) => (isFor(n, u) && !n.readBy.includes(u.id) ? { ...n, readBy: [...n.readBy, u.id] } : n)) }));
        },

        setModuleAccess: (userId, moduleId, access) => {
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, moduleAccess: { ...u.moduleAccess, [moduleId]: access } } : u)) }));
          audit("Changed module access", `${get().users.find((u) => u.id === userId)!.name}: ${mod(moduleId).name} ${access}`);
        },

        createBackup: () => {
          const b: Backup = { id: uid("b-"), createdAt: now(), sizeMb: 180 + Math.round(Math.random() * 12), type: "manual", status: "available" };
          set((s) => ({ backups: [b, ...s.backups] }));
          audit("Created backup", "Manual backup copy");
        },
        testRestore: (backupId) => {
          set((s) => ({ backups: s.backups.map((b) => (b.id === backupId ? { ...b, status: "verified" } : b)) }));
          audit("Tested restore", "Backup copy checked");
        },
        setBackupSchedule: (backupSchedule) => {
          set({ backupSchedule });
          audit("Changed backup schedule", backupSchedule.replace(/_/g, " "));
        },
      };
    },
    {
      // v11: payment terms. Older saved demos start fresh.
      name: "zentra-demo-v13",
      storage: createJSONStorage(() => {
        try {
          localStorage.setItem("__t", "1");
          localStorage.removeItem("__t");
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
      // Pending write-backs can't survive a reload, so they're settled on rehydrate.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.records = state.records.map((r) => (r.syncState === "pending" ? { ...r, syncState: "synced" } : r));
        state.syncOps = state.syncOps.map((o) => (o.status === "pending" ? { ...o, status: "success", resolvedAt: new Date().toISOString() } : o));
      },
    },
  ),
);

export const useMe = () => useApp((s) => s.users.find((u) => u.id === s.sessionUserId) ?? null);

/**
 * Waits until a record has finished being sent to the source system, and reports
 * how it went. Records that never go out (a module typed inside Zentra) settle
 * immediately.
 */
export function waitForSync(recordId: string, timeoutMs = 8000): Promise<SyncState> {
  const current = useApp.getState().records.find((r) => r.id === recordId)?.syncState;
  if (current !== "pending") return Promise.resolve(current ?? "synced");
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const state = useApp.getState().records.find((r) => r.id === recordId)?.syncState;
      if (state && state !== "pending") return resolve(state);
      if (Date.now() - started > timeoutMs) return resolve("synced");
      setTimeout(tick, 150);
    };
    tick();
  });
}

/** Whether a notification is addressed to this user's position or role. */
export function isFor(n: AppNotification, u: User) {
  return (!!n.to.position && n.to.position === u.position) || (!!n.to.role && n.to.role === u.role);
}
export type { EventLevel };
