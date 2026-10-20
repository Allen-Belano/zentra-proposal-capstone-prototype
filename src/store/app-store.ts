import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { makeSeed } from "@/data/seed";
import { recordLabel, transformRow, validateRow } from "@/lib/validation";
import type {
  ActivityEvent, AuditEntry, Backup, EventLevel, ModuleAccess, ModuleDef, PipelineRun, RecordItem,
  RejectedRow, RemoteRecord, Role, SyncFrequency, SyncOperation, User, ValidationRule,
} from "@/lib/types";
import { uid } from "@/lib/utils";

type Seed = ReturnType<typeof makeSeed>;
type Row = Record<string, string | number>;
export type BackupSchedule = "every_4_hours" | "daily" | "weekly";

interface Result { ok: boolean; errors?: string[] }

interface AppState extends Omit<Seed, "backupSchedule"> {
  sessionUserId: string | null;
  backupSchedule: BackupSchedule;

  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  resetDemo: () => void;

  addRecord: (moduleId: string, data: Row) => Result;
  updateRecord: (recordId: string, data: Row) => Result;
  setArchived: (recordId: string, archived: boolean) => void;

  runPipeline: (moduleId: string, source: string, rows: Row[]) => PipelineRun;
  reloadRejected: (rowId: string, data: Row) => Result;
  dismissRejected: (rowId: string) => void;

  syncNow: (moduleId: string) => { pulled: number; updated: number; rejected: number; failed: boolean };
  simulateRemoteEdit: (recordId: string) => void;
  resolveConflict: (opId: string, keep: "zentra" | "external") => void;
  retrySync: (opId: string) => void;
  setOutage: (on: boolean) => void;

  toggleRule: (ruleId: string) => void;
  addRule: (rule: Omit<ValidationRule, "id" | "enabled">) => void;
  removeRule: (ruleId: string) => void;

  registerModule: (mod: ModuleDef) => Result;
  setModuleActive: (moduleId: string, active: boolean) => void;
  setModuleFrequency: (moduleId: string, f: SyncFrequency) => void;

  setUserStatus: (userId: string, status: User["status"]) => void;
  setUserRole: (userId: string, role: Role) => void;
  setModuleAccess: (userId: string, moduleId: string, access: ModuleAccess) => void;

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

      const mod = (id: string) => get().modules.find((m) => m.id === id)!;
      const patchRecord = (id: string, patch: Partial<RecordItem>) =>
        set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
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
          if (s.outage) {
            if (attempt < 3) {
              patchOp(opId, { attempts: attempt });
              pushOutbound(recordId, opId, attempt + 1);
              return;
            }
            patchOp(opId, { status: "failed", attempts: 3, error: "Bitrix24 didn't respond after 3 attempts (timeout)." });
            patchRecord(recordId, { syncState: "failed" });
            event({ moduleId: rec.moduleId, recordId, title: `Write-back failed for ${label}`, detail: "Bitrix24 didn't respond after 3 attempts.", level: "error", actor: "System" });
            return;
          }
          const remote = s.remote[recordId];
          if (remote && rec.syncedVersion !== undefined && remote.version !== rec.syncedVersion) {
            patchOp(opId, { status: "conflict", attempts: attempt, error: "The order changed in Bitrix24 after Zentra's last sync.", local: { ...rec.data }, remote: { ...remote.data } });
            patchRecord(recordId, { syncState: "conflict" });
            event({ moduleId: rec.moduleId, recordId, title: `Sync conflict on ${label}`, detail: "Changed in both Zentra and Bitrix24. Waiting for review.", level: "warning", actor: "System" });
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

      const load = (moduleId: string, data: Row): RecordItem => {
        const m = mod(moduleId);
        const rec: RecordItem = {
          id: uid(`${moduleId}-`), moduleId, data: transformRow(m, data), archived: false,
          syncState: m.kind === "external" ? "pending" : "local",
          createdAt: now(), updatedAt: now(), updatedBy: actorName(),
        };
        set((s) => ({ records: [rec, ...s.records] }));
        return rec;
      };

      return {
        ...makeSeed(),
        sessionUserId: null,

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
        resetDemo: () => set({ ...makeSeed(), sessionUserId: get().sessionUserId }),

        addRecord: (moduleId, data) => {
          const m = mod(moduleId);
          const errors = validateRow(m, get().rules, data, get().records);
          if (errors.length) return { ok: false, errors };
          const rec = load(moduleId, data);
          const label = recordLabel(m, rec.data);
          event({ moduleId, recordId: rec.id, title: `${m.recordName} ${label} added`, level: "info" });
          audit("Added record", `${m.name}: ${label}`);
          if (m.kind === "external") queueOutbound(rec);
          return { ok: true };
        },

        updateRecord: (recordId, data) => {
          const rec = get().records.find((r) => r.id === recordId)!;
          const m = mod(rec.moduleId);
          const errors = validateRow(m, get().rules, data, get().records, recordId);
          if (errors.length) return { ok: false, errors };
          const next = transformRow(m, data);
          const updated = { ...rec, data: next, updatedAt: now(), updatedBy: actorName() };
          patchRecord(recordId, updated);
          const label = recordLabel(m, next);
          const stageChanged = rec.data.stage !== undefined && rec.data.stage !== next.stage;
          event({
            moduleId: m.id, recordId,
            title: stageChanged ? `${label} moved to ${next.stage}` : `${m.recordName} ${label} updated`,
            level: next.stage === "Delivered" && stageChanged ? "success" : "info",
          });
          audit("Updated record", `${m.name}: ${label}`);
          if (m.kind === "native" && Number(next.on_hand) <= Number(next.reorder_level) && Number(rec.data.on_hand) > Number(rec.data.reorder_level)) {
            event({ moduleId: m.id, recordId, title: `${label} is below reorder level`, detail: `${next.on_hand} on hand, reorder at ${next.reorder_level}`, level: "warning", actor: "System" });
          }
          if (m.kind === "external") queueOutbound(updated);
          return { ok: true };
        },

        setArchived: (recordId, archived) => {
          const rec = get().records.find((r) => r.id === recordId)!;
          const m = mod(rec.moduleId);
          patchRecord(recordId, { archived, updatedAt: now(), updatedBy: actorName() });
          audit(archived ? "Archived record" : "Restored record", `${m.name}: ${recordLabel(m, rec.data)}`);
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
          const loaded = accepted.map((row) => load(moduleId, row));
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
            moduleId, title: `Pipeline run #${run.number} finished`,
            detail: `${run.loaded} loaded, ${run.rejected} rejected from ${source}`,
            level: run.rejected ? "warning" : "success",
          });
          audit("Ran ETL pipeline", `${m.name}: ${source}`);
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
          const rec = load(row.moduleId, data);
          if (m.kind === "external") queueOutbound(rec);
          set((s) => ({ rejected: s.rejected.map((r) => (r.id === rowId ? { ...r, status: "reloaded", raw: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) } : r)) }));
          audit("Fixed and reloaded rejected row", `${m.name}: ${recordLabel(m, rec.data)}`);
          event({ moduleId: m.id, recordId: rec.id, title: `Rejected row fixed: ${recordLabel(m, rec.data)}`, detail: "Passed validation and loaded", level: "success" });
          return { ok: true };
        },

        dismissRejected: (rowId) => {
          const row = get().rejected.find((r) => r.id === rowId)!;
          set((s) => ({ rejected: s.rejected.map((r) => (r.id === rowId ? { ...r, status: "dismissed" } : r)) }));
          audit("Dismissed rejected row", `${mod(row.moduleId).name}: row ${row.rowIndex}`);
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
          // 2) New deals won in Bitrix24 enter through the ETL pipeline.
          const inbox = get().remoteInbox;
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
          const resolution = keep === "zentra" ? "Kept Zentra version and pushed it" : `Kept ${m.source} version`;
          patchOp(opId, { status: "success", resolution, resolvedAt: now(), resolvedBy: actorName() });
          event({ moduleId: m.id, recordId: rec.id, title: `Conflict on ${op.recordLabel} resolved`, detail: resolution, level: "success" });
          audit("Resolved sync conflict", `${op.recordLabel}: ${resolution}`);
        },

        retrySync: (opId) => {
          const op = get().syncOps.find((o) => o.id === opId)!;
          const rec = get().records.find((r) => r.id === op.recordId)!;
          patchOp(opId, { status: "success", resolution: "Retried", resolvedAt: now(), resolvedBy: actorName() });
          audit("Retried write-back", op.recordLabel);
          queueOutbound(rec);
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

        registerModule: (m) => {
          if (get().modules.some((x) => x.id === m.id)) return { ok: false, errors: [`A module with id "${m.id}" already exists.`] };
          const full: ModuleDef = { ...m, registeredAt: now(), registeredBy: actorName() };
          set((s) => ({
            modules: [...s.modules, full],
            users: s.users.map((u) => (u.role === "employee" ? { ...u, moduleAccess: { ...u.moduleAccess, [m.id]: "none" } } : u)),
          }));
          event({ moduleId: m.id, title: `${m.name} module registered`, detail: "Activated from manifest without redeploying", level: "success" });
          audit("Registered module", m.name);
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
        setModuleAccess: (userId, moduleId, access) => {
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, moduleAccess: { ...u.moduleAccess, [moduleId]: access } } : u)) }));
          audit("Changed module access", `${get().users.find((u) => u.id === userId)!.name}: ${mod(moduleId).name} ${access}`);
        },

        createBackup: () => {
          const b: Backup = { id: uid("b-"), createdAt: now(), sizeMb: 180 + Math.round(Math.random() * 12), type: "manual", status: "available" };
          set((s) => ({ backups: [b, ...s.backups] }));
          audit("Created backup", "Manual restore point");
        },
        testRestore: (backupId) => {
          set((s) => ({ backups: s.backups.map((b) => (b.id === backupId ? { ...b, status: "verified" } : b)) }));
          audit("Tested restore", "Restore point verified");
        },
        setBackupSchedule: (backupSchedule) => {
          set({ backupSchedule });
          audit("Changed backup schedule", backupSchedule.replace(/_/g, " "));
        },
      };
    },
    {
      name: "zentra-demo-v1",
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
export type { EventLevel };
