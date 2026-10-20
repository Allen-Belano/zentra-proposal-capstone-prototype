import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check, FileJson, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ModuleIcon, MODULE_ICONS } from "@/components/app/module-icon";
import {
  ADAPTERS, BATCH_FREQUENCIES, buildRules, FREQUENCY_LABEL, SCHEMA_TEMPLATES, slugify, toModuleFields, type DraftField,
} from "@/lib/adapters";
import type { AdapterType, FieldType, ModuleDef, RuleKind, SyncFrequency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app-store";

export const MAX_ADDITIONAL = 6;

type ExternalAdapter = Exclude<AdapterType, "native">;
type Row = DraftField & { id: string; source: string; custom?: boolean };

interface Draft {
  name: string; key: string; keyTouched: boolean; owner: string; recordName: string; description: string; icon: string;
  kind: "native" | "external";
  source: string; adapterType: ExternalAdapter; syncMode: "realtime" | "batch"; frequency: SyncFrequency;
  connection: Record<string, string>;
  template: string; rows: Row[];
  activate: boolean;
}

const FIELD_TYPE_LABEL: Record<FieldType, string> = { text: "Text", number: "Number", currency: "Amount (₱)", date: "Date", select: "Choice list" };
const STEPS = ["Identity and adapter", "Schema and mapping", "Review and activate"];

let rowSeq = 0;
const rowsFrom = (template: string): Row[] =>
  (SCHEMA_TEMPLATES[template]?.fields ?? []).map((f) => ({ ...f, options: f.options?.slice(), id: `row-${++rowSeq}`, source: "" }));

const fresh = (): Draft => ({
  name: "", key: "", keyTouched: false, owner: "", recordName: "", description: "", icon: "cart",
  kind: "native", source: "", adapterType: "api", syncMode: "realtime", frequency: "hourly",
  connection: {}, template: "procurement", rows: rowsFrom("procurement"), activate: true,
});

/** Field keys come from the template, or from the label for fields added by hand. */
function finalFields(rows: Row[]): (DraftField & { source: string })[] {
  const used = new Set<string>();
  return rows.map((r, i) => {
    let key = r.custom ? slugify(r.label, "_") || `field_${i + 1}` : r.key;
    if (!/^[a-z]/.test(key)) key = `f_${key}`;
    let unique = key;
    for (let n = 2; used.has(unique); n++) unique = `${key}_${n}`;
    used.add(unique);
    return { key: unique, label: r.label.trim(), type: r.type, options: r.type === "select" ? r.options : undefined, required: r.required, source: r.source.trim() };
  });
}

function StepBar({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300",
              done && "bg-primary text-primary-foreground", current && "bg-primary/15 text-primary ring-2 ring-primary/30",
              !done && !current && "bg-muted text-muted-foreground",
            )}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}</span>
            <span className={cn("hidden truncate text-xs sm:block", current ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {n < 3 && <span className={cn("h-px flex-1 transition-colors duration-300", done ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Choice({ checked, onClick, title, hint, icon }: { checked: boolean; onClick: () => void; title: string; hint: string; icon?: ReactNode }) {
  return (
    <button
      type="button" role="radio" aria-checked={checked} onClick={onClick}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-200",
        checked ? "border-primary/60 bg-primary/5 shadow-soft" : "border-border hover:bg-muted",
      )}
    >
      {icon && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", checked ? "bg-primary text-primary-foreground" : "bg-muted")}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function GuidedSetup({ atLimit, onDone }: { atLimit: boolean; onDone: () => void }) {
  const modules = useApp((s) => s.modules);
  const registerModule = useApp((s) => s.registerModule);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(fresh);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setRow = (id: string, patch: Partial<Row>) => setD((x) => ({ ...x, rows: x.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const external = d.kind === "external";
  const adapter = ADAPTERS[d.adapterType];
  const fields = finalFields(d.rows);
  const rules = buildRules(fields);
  const unmapped = external ? fields.filter((f) => !f.source) : [];

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.name.trim()) e.name = "Give the module a name people will recognize.";
      if (!d.key) e.key = "A key is needed for the module's address.";
      else if (!/^[a-z][a-z0-9-]{1,30}$/.test(d.key)) e.key = "Use lowercase letters, numbers, and single dashes, starting with a letter.";
      else if (modules.some((m) => m.id === d.key)) e.key = "That key is already registered. Pick another one.";
      if (!d.owner.trim()) e.owner = "Name the owning team, so issues have someone to go to.";
      if (d.description.trim().length < 12) e.description = "Add a short description (at least 12 characters).";
      if (external) {
        if (!d.source.trim()) e.source = "Name the system this module connects to.";
        for (const f of adapter.fields) if (!String(d.connection[f.key] ?? "").trim()) e[`conn-${f.key}`] = `${f.label} is required for the ${adapter.label} adapter.`;
      }
    }
    if (step === 2) {
      if (!d.rows.length) e.rows = "Add at least one field. A module without fields has nothing to validate.";
      d.rows.forEach((r, i) => {
        if (!r.label.trim()) e[`label-${r.id}`] = "Every field needs a label.";
        if (r.type === "select" && !r.options?.length) e[`options-${r.id}`] = "List at least one option, separated by commas.";
        if (external && i === 0 && !r.source.trim()) e[`source-${r.id}`] = "Map the title field to a source column. Without it, every record looks like a duplicate.";
      });
    }
    return e;
  };

  const next = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => s + 1);
  };

  const register = () => {
    if (atLimit) return setErrors({ submit: `The registry supports up to ${MAX_ADDITIONAL} modules beyond Inventory and Operations.` });
    const template = SCHEMA_TEMPLATES[d.template];
    const connection = Object.fromEntries(Object.entries(d.connection).filter(([, v]) => v.trim()));
    const mod: ModuleDef = {
      id: d.key, name: d.name.trim(), description: d.description.trim(), icon: d.icon, owner: d.owner.trim(),
      recordName: d.recordName.trim() || template?.recordName || "Record",
      kind: d.kind, source: external ? d.source.trim() : undefined,
      adapter: external
        ? {
            type: d.adapterType, frequency: d.syncMode === "realtime" ? "realtime" : d.frequency, connection,
            endpoint: connection.endpoint ?? connection.receiver ?? connection.host ?? connection.path,
            mapping: Object.fromEntries(fields.filter((f) => f.source).map((f) => [f.key, f.source])),
          }
        : { type: "native", frequency: "realtime" },
      active: d.activate, fields: toModuleFields(fields), registeredAt: "", registeredBy: "",
    };
    const r = registerModule(mod, rules.map(({ field, kind, value }) => ({ field, kind, value })));
    if (!r.ok) return setErrors({ submit: r.errors?.[0] ?? "Couldn't register the module." });
    toast.success(`${mod.name} registered`, {
      description: `${d.activate ? `Live at /modules/${mod.id}` : "Saved as inactive"} with ${rules.length} validation rules. Give employees access under Team access.`,
    });
    onDone();
    if (d.activate) navigate({ to: "/modules/$moduleId", params: { moduleId: mod.id } });
  };

  return (
    <div className="grid gap-5">
      <StepBar step={step} />
      <div key={step} className="grid max-h-[55dvh] gap-5 overflow-y-auto pr-1 duration-300 ease-fluid animate-in fade-in-0 slide-in-from-right-2">
        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Module name" error={errors.name}>
                <Input value={d.name} placeholder="Procurement" onChange={(e) => set({ name: e.target.value, key: d.keyTouched ? d.key : slugify(e.target.value) })} />
              </Field>
              <Field label="Module key" hint={`Used in its address: /modules/${d.key || "key"}`} error={errors.key}>
                <Input value={d.key} placeholder="procurement" className="font-mono text-xs" onChange={(e) => set({ key: e.target.value.toLowerCase(), keyTouched: true })} />
              </Field>
              <Field label="Owning team" error={errors.owner}>
                <Input value={d.owner} placeholder="Operations · Purchasing" onChange={(e) => set({ owner: e.target.value })} />
              </Field>
              <Field label="One record is called" hint="Singular, e.g. Purchase order. Leave blank to use the template's.">
                <Input value={d.recordName} placeholder="Purchase order" onChange={(e) => set({ recordName: e.target.value })} />
              </Field>
              <Field label="Description" error={errors.description} className="sm:col-span-2">
                <Textarea value={d.description} placeholder="What this module tracks and where its data comes from." className="min-h-[72px]" onChange={(e) => set({ description: e.target.value })} />
              </Field>
            </div>
            <Section title="Icon">
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {Object.keys(MODULE_ICONS).map((name) => (
                  <button key={name} type="button" role="radio" aria-checked={d.icon === name} aria-label={name} onClick={() => set({ icon: name })}
                    className={cn("grid h-10 w-10 place-items-center rounded-full border transition-colors duration-200",
                      d.icon === name ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                    <ModuleIcon name={name} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Module type">
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                <Choice checked={!external} onClick={() => set({ kind: "native" })} title="Native module" hint="Records are entered directly in Zentra." />
                <Choice checked={external} onClick={() => set({ kind: "external" })} title="External module" hint="Connects to an existing system through an adapter, with two-way sync." />
              </div>
            </Section>
            {external && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Source system" error={errors.source}>
                    <Input value={d.source} placeholder="Legacy IMS" onChange={(e) => set({ source: e.target.value })} />
                  </Field>
                  <Field label="Sync" hint={d.syncMode === "realtime" ? "Changes sync as they happen, where the source supports it." : "Batch is the fallback for systems without real-time support."}>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={d.syncMode} onValueChange={(v) => set({ syncMode: v as Draft["syncMode"] })}>
                        <SelectTrigger aria-label="Sync mode"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="realtime">Real-time</SelectItem><SelectItem value="batch">Scheduled batch</SelectItem></SelectContent>
                      </Select>
                      <Select value={d.frequency} onValueChange={(v) => set({ frequency: v as SyncFrequency })} disabled={d.syncMode === "realtime"}>
                        <SelectTrigger aria-label="Batch interval"><SelectValue /></SelectTrigger>
                        <SelectContent>{BATCH_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{FREQUENCY_LABEL[f]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </Field>
                </div>
                <Section title="Adapter" hint="How Zentra talks to the source system.">
                  <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(ADAPTERS) as ExternalAdapter[]).map((t) => (
                      <Choice key={t} checked={d.adapterType === t} onClick={() => set({ adapterType: t, connection: {} })} title={ADAPTERS[t].label} hint={ADAPTERS[t].hint} />
                    ))}
                  </div>
                </Section>
                <Section title="Connection" hint={`${adapter.hint}. Saved as sample settings; the prototype never opens a real connection.`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {adapter.fields.map((f) => (
                      <Field key={`${d.adapterType}-${f.key}`} label={f.label} error={errors[`conn-${f.key}`]}>
                        {f.options ? (
                          <Select value={d.connection[f.key] ?? ""} onValueChange={(v) => set({ connection: { ...d.connection, [f.key]: v } })}>
                            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                            <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input value={d.connection[f.key] ?? ""} placeholder={f.placeholder} className="font-mono text-xs" onChange={(e) => set({ connection: { ...d.connection, [f.key]: e.target.value } })} />
                        )}
                      </Field>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Section title="Start from a template" hint="Templates fill in the field list. Validation rules are generated from the final fields.">
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {Object.entries(SCHEMA_TEMPLATES).map(([id, t]) => (
                  <Choice key={id} checked={d.template === id} onClick={() => set({ template: id, rows: rowsFrom(id), icon: d.template === id ? d.icon : t.icon })} title={t.label} hint={t.hint} icon={<ModuleIcon name={t.icon} className="h-4 w-4" />} />
                ))}
                <Choice checked={d.template === "blank"} onClick={() => set({ template: "blank", rows: [] })} title="Start blank" hint="Add every field yourself" icon={<Plus className="h-4 w-4" />} />
              </div>
            </Section>
            <Section
              title="Fields"
              hint={external ? `Map each field to a column or property in ${d.source || "the source system"}. Unmapped fields arrive empty.` : "Native modules own their fields, so records are typed directly in Zentra."}
            >
              {errors.rows && <p className="text-xs text-destructive">{errors.rows}</p>}
              <div className="grid gap-2">
                {d.rows.map((r, i) => (
                  <div key={r.id} className={cn("grid gap-3 rounded-2xl bg-muted p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]", external && !r.source && "ring-1 ring-warning/40")}>
                    <div className="grid gap-1.5">
                      <div className="flex items-center gap-2">
                        <Input value={r.label} aria-label={`Field ${i + 1} label`} className="bg-card" onChange={(e) => setRow(r.id, { label: e.target.value })} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {i === 0 ? <span className="font-medium text-foreground">Title field · must be unique</span> : r.custom ? "Custom field" : <span className="font-mono">{r.key}</span>}
                      </p>
                      {errors[`label-${r.id}`] && <p className="text-xs text-destructive">{errors[`label-${r.id}`]}</p>}
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Select value={r.type} onValueChange={(v) => setRow(r.id, { type: v as FieldType })}>
                        <SelectTrigger className="bg-card" aria-label={`Field ${i + 1} type`}><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                      </Select>
                      {r.type === "select" && (
                        <Input
                          value={(r.options ?? []).join(", ")} placeholder="Option A, Option B" className="bg-card text-xs" aria-label={`Field ${i + 1} options`}
                          onChange={(e) => setRow(r.id, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                        />
                      )}
                      {errors[`options-${r.id}`] && <p className="text-xs text-destructive">{errors[`options-${r.id}`]}</p>}
                      {external && (
                        <>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 rotate-180 text-muted-foreground" />
                            <Input value={r.source} placeholder="source_column" className="bg-card font-mono text-xs" aria-label={`Source column for field ${i + 1}`} onChange={(e) => setRow(r.id, { source: e.target.value })} />
                          </div>
                          {errors[`source-${r.id}`] && <p className="text-xs text-destructive">{errors[`source-${r.id}`]}</p>}
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch checked={r.required || i === 0} disabled={i === 0} onCheckedChange={(v) => setRow(r.id, { required: v })} aria-label={`Field ${i + 1} required`} />
                        Required
                      </label>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.label || "field"}`} onClick={() => setD((x) => ({ ...x, rows: x.rows.filter((y) => y.id !== r.id) }))}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setD((x) => ({ ...x, rows: [...x.rows, { id: `row-${++rowSeq}`, key: "", label: `New field ${x.rows.length + 1}`, type: "text", required: false, source: "", custom: true }] }))}>
                  <Plus />Add field
                </Button>
              </div>
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            {unmapped.length > 0 && (
              <div role="alert" className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-3.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">{unmapped.length} field{unmapped.length === 1 ? " isn't" : "s aren't"} mapped</p>
                  <p className="text-muted-foreground">Unmapped fields will always arrive empty{unmapped.some((f) => f.required) ? ", so their required rule will reject every synced record" : ""}.</p>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Review title="Identity">
                <ReviewRow label="Name"><span className="inline-flex items-center gap-1.5"><ModuleIcon name={d.icon} className="h-4 w-4" />{d.name}</span></ReviewRow>
                <ReviewRow label="Address"><span className="font-mono text-xs">/modules/{d.key}</span></ReviewRow>
                <ReviewRow label="Owner">{d.owner}</ReviewRow>
                <ReviewRow label="Record">{d.recordName || SCHEMA_TEMPLATES[d.template]?.recordName || "Record"}</ReviewRow>
                <ReviewRow label="Type">{external ? `External · ${adapter.label} adapter` : "Native"}</ReviewRow>
                {external && <ReviewRow label="Source">{d.source}</ReviewRow>}
                {external && <ReviewRow label="Sync">{d.syncMode === "realtime" ? "Real-time where supported" : FREQUENCY_LABEL[d.frequency]}</ReviewRow>}
              </Review>
              {external ? (
                <Review title="Connection">
                  {adapter.fields.map((f) => <ReviewRow key={f.key} label={f.label}><span className="break-all font-mono text-xs">{d.connection[f.key]}</span></ReviewRow>)}
                </Review>
              ) : (
                <Review title="Access">
                  <p className="text-sm text-muted-foreground">Employees start with no access. Grant it per person under <span className="font-medium text-foreground">Team access</span>.</p>
                </Review>
              )}
              <Review title={`Fields · ${fields.length}`}>
                {fields.map((f) => (
                  <ReviewRow key={f.key} label={f.label}>
                    <span className="text-xs">
                      <span className="font-mono">{f.key}</span> · {FIELD_TYPE_LABEL[f.type]}
                      {external && (f.source ? <span className="block font-mono text-muted-foreground">from {f.source}</span> : <span className="block text-warning">unmapped</span>)}
                    </span>
                  </ReviewRow>
                ))}
              </Review>
              <Review title={`Validation rules · ${rules.length}`}>
                <ul className="grid gap-1.5 text-sm">
                  {rules.slice(0, 8).map((r) => <li key={`${r.field}-${r.kind}`} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{r.label}</li>)}
                  {rules.length > 8 && <li className="text-xs text-muted-foreground">+{rules.length - 8} more generated from the fields</li>}
                </ul>
              </Review>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">Activate right after registering</span>
                <span className="block text-xs text-muted-foreground">It appears in the sidebar at once. You can turn it off later in the registry.</span>
              </span>
              <Switch checked={d.activate} onCheckedChange={(v) => set({ activate: v })} aria-label="Activate right after registering" />
            </label>
            {errors.submit && <p role="alert" className="text-sm text-destructive">{errors.submit}</p>}
          </>
        )}
      </div>
      <DialogFooter>
        {step === 1 ? <Button type="button" variant="outline" onClick={onDone}>Cancel</Button> : <Button type="button" variant="outline" onClick={() => { setErrors({}); setStep((s) => s - 1); }}>Back</Button>}
        {step < 3 ? <Button type="button" onClick={next}>Continue<ArrowRight /></Button> : <Button type="button" onClick={register}><Check />Register module</Button>}
      </DialogFooter>
    </div>
  );
}

function Review({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2 rounded-2xl bg-muted p-4">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// JSON manifest (FR-04): the same registration, submitted as a manifest.

const SAMPLE_MANIFEST = `{
  "id": "procurement",
  "name": "Procurement",
  "recordName": "Purchase order",
  "description": "Purchase orders sent to suppliers.",
  "owner": "Operations · Purchasing",
  "icon": "cart",
  "kind": "native",
  "fields": [
    { "key": "po_no", "label": "PO no.", "type": "text", "primary": true },
    { "key": "supplier", "label": "Supplier", "type": "text" },
    { "key": "total", "label": "Total", "type": "currency" },
    { "key": "status", "label": "Status", "type": "select", "options": ["Draft", "Sent", "Received"] },
    { "key": "expected", "label": "Expected", "type": "date", "hideOnMobile": true }
  ],
  "rules": [
    { "field": "po_no", "kind": "required" },
    { "field": "po_no", "kind": "unique" },
    { "field": "supplier", "kind": "required" }
  ]
}`;

const FIELD_TYPES: FieldType[] = ["text", "number", "currency", "date", "select"];
const RULE_KINDS: RuleKind[] = ["required", "number", "min", "pattern", "unique", "oneOf"];

function parseManifest(text: string): { mod?: ModuleDef; rules?: { field: string; kind: RuleKind; value?: string }[]; errors: string[] } {
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch (e) { return { errors: [`The manifest isn't valid JSON: ${(e as Error).message}`] }; }
  const errors: string[] = [];
  const str = (k: string) => (typeof json[k] === "string" && (json[k] as string).trim() ? (json[k] as string).trim() : undefined);
  const id = str("id");
  if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id)) errors.push(`"id" must be lowercase letters, numbers, or dashes (e.g. "procurement").`);
  if (!str("name")) errors.push(`"name" is required.`);
  const kind = json.kind === "external" ? "external" : json.kind === "native" ? "native" : undefined;
  if (!kind) errors.push(`"kind" must be "native" or "external".`);
  const fields = Array.isArray(json.fields) ? (json.fields as Record<string, unknown>[]) : [];
  if (!fields.length) errors.push(`"fields" needs at least one field.`);
  fields.forEach((f, i) => {
    if (typeof f.key !== "string" || typeof f.label !== "string") errors.push(`Field ${i + 1} needs a "key" and a "label".`);
    if (!FIELD_TYPES.includes(f.type as FieldType)) errors.push(`Field ${i + 1} has an unknown type. Use one of: ${FIELD_TYPES.join(", ")}.`);
    if (f.type === "select" && !Array.isArray(f.options)) errors.push(`Field ${i + 1} is a select and needs "options".`);
  });
  const keys = new Set(fields.map((f) => f.key));
  const rules = (Array.isArray(json.rules) ? json.rules : []) as { field: string; kind: RuleKind; value?: string }[];
  rules.forEach((r, i) => {
    if (!keys.has(r.field)) errors.push(`Rule ${i + 1} refers to a field that doesn't exist ("${r.field}").`);
    if (!RULE_KINDS.includes(r.kind)) errors.push(`Rule ${i + 1} has an unknown kind.`);
  });
  if (errors.length) return { errors };
  const hasPrimary = fields.some((f) => f.primary);
  const adapterJson = (json.adapter ?? {}) as { type?: string; endpoint?: string; mapping?: Record<string, string> };
  const mod: ModuleDef = {
    id: id!, name: str("name")!, recordName: str("recordName") ?? "Record", description: str("description") ?? "", owner: str("owner"),
    icon: typeof json.icon === "string" && json.icon in MODULE_ICONS ? json.icon : "boxes",
    kind: kind!, source: kind === "external" ? str("source") ?? "External system" : undefined,
    adapter: kind === "external"
      ? { type: (adapterJson.type as ModuleDef["adapter"]["type"]) ?? "api", endpoint: adapterJson.endpoint, frequency: "hourly", mapping: adapterJson.mapping }
      : { type: "native", frequency: "realtime" },
    active: true,
    fields: fields.map((f, i) => ({
      key: String(f.key), label: String(f.label), type: f.type as FieldType,
      options: Array.isArray(f.options) ? (f.options as string[]) : undefined,
      primary: Boolean(f.primary) || (!hasPrimary && i === 0), hideOnMobile: Boolean(f.hideOnMobile), hideOnTablet: Boolean(f.hideOnTablet),
    })),
    registeredAt: "", registeredBy: "",
  };
  return { mod, rules, errors: [] };
}

function ManifestImport({ atLimit, onDone }: { atLimit: boolean; onDone: () => void }) {
  const registerModule = useApp((s) => s.registerModule);
  const [text, setText] = useState(SAMPLE_MANIFEST);
  const [errors, setErrors] = useState<string[]>([]);
  const submit = () => {
    if (atLimit) return setErrors([`The registry supports up to ${MAX_ADDITIONAL} modules beyond Inventory and Operations.`]);
    const { mod, rules, errors } = parseManifest(text);
    if (!mod) return setErrors(errors);
    const r = registerModule(mod, rules);
    if (!r.ok) return setErrors(r.errors ?? []);
    toast.success(`${mod.name} registered`, { description: "It's in the sidebar now. Grant employees access under Team access." });
    setErrors([]);
    onDone();
  };
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Paste the module's JSON manifest. It's activated immediately, with no redeployment.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-[300px] font-mono text-xs leading-relaxed" />
      {errors.length > 0 && (
        <ul role="alert" className="list-disc rounded-xl border border-destructive/40 bg-destructive/10 p-3 pl-7 text-sm text-destructive">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => setText(SAMPLE_MANIFEST)}>Reset to sample</Button>
        <Button onClick={submit}><FileJson />Register module</Button>
      </DialogFooter>
    </div>
  );
}

export function RegisterModuleDialog({ open, onOpenChange, atLimit }: { open: boolean; onOpenChange: (o: boolean) => void; atLimit: boolean }) {
  // A new key each time the dialog opens starts every registration from a clean draft.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Register a module</DialogTitle>
          <DialogDescription>Add a native module or connect an existing system. It goes live without redeploying.</DialogDescription>
        </DialogHeader>
        <Tabs key={session} defaultValue="guided" className="min-w-0">
          <TabsList>
            <TabsTrigger value="guided">Guided setup</TabsTrigger>
            <TabsTrigger value="json"><FileJson className="h-3.5 w-3.5" />JSON manifest</TabsTrigger>
          </TabsList>
          <TabsContent value="guided"><GuidedSetup atLimit={atLimit} onDone={close} /></TabsContent>
          <TabsContent value="json"><ManifestImport atLimit={atLimit} onDone={close} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
