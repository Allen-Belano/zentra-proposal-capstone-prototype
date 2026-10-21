import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Check, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/app/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { ModuleIcon } from "@/components/app/module-icon";
import { MAX_ADDITIONAL, RegisterModuleDialog } from "@/components/app/register-wizard";
import { ADAPTER_LABEL, ADAPTERS, FREQUENCY_LABEL } from "@/lib/adapters";
import type { ModuleDef, SyncFrequency } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { useApp } from "@/store/app-store";

const FILTERS = [
  { id: "all", label: "All modules", match: () => true },
  { id: "active", label: "Active", match: (m: ModuleDef) => m.active },
  { id: "inactive", label: "Deactivated", match: (m: ModuleDef) => !m.active },
  { id: "native", label: "Native", match: (m: ModuleDef) => m.kind === "native" },
  { id: "external", label: "External", match: (m: ModuleDef) => m.kind === "external" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

function ModuleCard({ m, onDeactivate }: { m: ModuleDef; onDeactivate: (m: ModuleDef) => void }) {
  const records = useApp((s) => s.records.filter((r) => r.moduleId === m.id).length);
  const rules = useApp((s) => s.rules.filter((r) => r.moduleId === m.id).length);
  const outage = useApp((s) => s.outage);
  const { setModuleActive, setModuleFrequency } = useApp.getState();
  const external = m.kind === "external";
  const connection = Object.entries(m.adapter.connection ?? {});
  const mapping = Object.entries(m.adapter.mapping ?? {});
  const label = (key: string) => m.fields.find((f) => f.key === key)?.label ?? key;
  const connLabel = (key: string) => (m.adapter.type !== "native" && ADAPTERS[m.adapter.type].fields.find((f) => f.key === key)?.label) || key;

  return (
    <Card className={cn("p-5 transition-opacity duration-300", !m.active && "opacity-75")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><ModuleIcon name={m.icon} className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{m.name}</span>
              {m.baseline && <Badge variant="secondary">Baseline</Badge>}
              <Badge variant="outline">{external ? `External · ${ADAPTER_LABEL[m.adapter.type]}` : "Native"}</Badge>
              <Badge variant={m.active ? "success" : "secondary"}>{m.active ? "Active" : "Deactivated"}</Badge>
              {external && outage && m.active && <Badge variant="warning">Source unreachable</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {m.active && (
            <Button asChild variant="secondary" size="sm"><Link to="/modules/$moduleId" params={{ moduleId: m.id }}><Eye />Open</Link></Button>
          )}
          {external && (
            <Select value={m.adapter.frequency} onValueChange={async (v) => {
              if (!(await confirmAction({ title: `Change how often ${m.name} syncs?`, description: `Zentra will sync with ${m.source} on the new schedule.`, details: [["From", FREQUENCY_LABEL[m.adapter.frequency]], ["To", FREQUENCY_LABEL[v as SyncFrequency]]], confirmLabel: "Change sync" }))) return;
              setModuleFrequency(m.id, v as SyncFrequency); toast.success("Sync frequency updated");
            }}>
              <SelectTrigger className="h-8 w-40" aria-label="Sync frequency"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(FREQUENCY_LABEL) as SyncFrequency[]).map((f) => <SelectItem key={f} value={f}>{FREQUENCY_LABEL[f]}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {m.active ? (
            <Button variant="ghost" size="sm" onClick={() => onDeactivate(m)}><Ban />Deactivate</Button>
          ) : (
            <Button size="sm" onClick={async () => {
              if (!(await confirmAction({ title: `Activate ${m.name}?`, description: "It returns to the sidebar with its records, and anyone with access can use it again.", confirmLabel: "Activate" }))) return;
              setModuleActive(m.id, true); toast.success(`${m.name} activated`, { description: "It's back in the sidebar with its records." }); }}><Check />Activate</Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <dl className="rounded-2xl bg-muted px-4 py-2.5">
          <KV label="Address"><span className="font-mono text-xs">/modules/{m.id}</span></KV>
          <KV label="Owner">{m.owner ?? "—"}</KV>
          <KV label="Adapter">{external ? `${ADAPTER_LABEL[m.adapter.type]} · ${m.source}` : "Native: entered in Zentra"}</KV>
          {external && <KV label="Sync">{FREQUENCY_LABEL[m.adapter.frequency]}</KV>}
          <KV label="Records">{records}</KV>
          {external && <KV label="Last synced">{m.lastSyncedAt ? timeAgo(m.lastSyncedAt) : "Not yet"}</KV>}
          <KV label="Registered">{formatDate(m.registeredAt)} by {m.registeredBy}</KV>
        </dl>
        <div className="grid content-start gap-3">
          {connection.length > 0 && (
            <dl className="rounded-2xl bg-muted px-4 py-2.5">
              <p className="pb-1 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Connection</p>
              {connection.map(([k, v]) => <KV key={k} label={connLabel(k)}><span className="break-all font-mono text-xs">{v}</span></KV>)}
            </dl>
          )}
          <dl className="rounded-2xl bg-muted px-4 py-2.5">
            <p className="pb-1 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Field mapping</p>
            {!external ? (
              <p className="py-1.5 text-sm text-muted-foreground">Records are typed directly in this module.</p>
            ) : mapping.length === 0 ? (
              <p className="py-1.5 text-sm text-muted-foreground">No fields mapped yet.</p>
            ) : (
              <>
                {mapping.slice(0, 5).map(([k, col]) => <KV key={k} label={label(k)}><span className="font-mono text-xs">← {col}</span></KV>)}
                {mapping.length > 5 && <p className="py-1.5 text-right text-xs text-muted-foreground">+{mapping.length - 5} more mapped fields</p>}
              </>
            )}
          </dl>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{m.fields.length} fields · {rules} validation rule{rules === 1 ? "" : "s"}{m.recordName ? ` · records are called "${m.recordName.toLowerCase()}s"` : ""}</p>
    </Card>
  );
}

export function RegistryPage() {
  const modules = useApp((s) => s.modules);
  const setModuleActive = useApp((s) => s.setModuleActive);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const deactivate = async (m: ModuleDef) => {
    const ok = await confirmAction({
      title: `Deactivate ${m.name}?`,
      description: `It disappears from the sidebar and its page stops opening${m.kind === "external" ? ", and syncing pauses" : ""}. Its records stay in the central database, and you can activate it again at any time.`,
      confirmLabel: "Deactivate", destructive: true,
    });
    if (!ok) return;
    setModuleActive(m.id, false);
    toast(`${m.name} deactivated`, { description: "Its records are kept. Activate it again from the registry." });
  };
  const additional = modules.filter((m) => !m.baseline).length;
  const current = FILTERS.find((f) => f.id === filter)!;
  const list = modules.filter(current.match);

  return (
    <>
      <PageHeader
        title="Module registry"
        description={`Inventory and Operations are the baseline modules. You can register up to ${MAX_ADDITIONAL} more (${additional} of ${MAX_ADDITIONAL} used). A registered module appears in the sidebar at once, with its own page and validation rules.`}
        actions={<Button onClick={() => setOpen(true)} disabled={additional >= MAX_ADDITIONAL}><Plus />Register module</Button>}
      />
      <div role="group" aria-label="Filter modules" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = modules.filter(f.match).length;
          const on = filter === f.id;
          return (
            <button key={f.id} type="button" aria-pressed={on} onClick={() => setFilter(f.id)}
              className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors duration-200",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular", on ? "bg-primary-foreground/20" : "bg-muted")}>{count}</span>
            </button>
          );
        })}
      </div>
      {list.length === 0 ? (
        <Card><EmptyState title="No modules match this filter" description="Pick another filter or register a new module." /></Card>
      ) : (
        <div className="stagger grid gap-4">{list.map((m) => <ModuleCard key={m.id} m={m} onDeactivate={deactivate} />)}</div>
      )}

      <RegisterModuleDialog open={open} onOpenChange={setOpen} atLimit={additional >= MAX_ADDITIONAL} />

    </>
  );
}
