import { useState } from "react";
import { FileJson, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/bits";
import { ModuleIcon, MODULE_ICONS } from "@/components/app/module-icon";
import type { FieldType, ModuleDef, RuleKind, SyncFrequency } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useApp } from "@/store/app-store";

const MAX_ADDITIONAL = 6;

const SAMPLE_MANIFEST = `{
  "id": "procurement",
  "name": "Procurement",
  "recordName": "Purchase order",
  "description": "Purchase orders sent to suppliers.",
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
  const mod: ModuleDef = {
    id: id!, name: str("name")!, recordName: str("recordName") ?? "Record", description: str("description") ?? "",
    icon: typeof json.icon === "string" && json.icon in MODULE_ICONS ? json.icon : "boxes",
    kind: kind!, source: kind === "external" ? str("source") ?? "External system" : undefined,
    adapter: kind === "external"
      ? { type: ((json.adapter as { type?: string })?.type as ModuleDef["adapter"]["type"]) ?? "api", endpoint: (json.adapter as { endpoint?: string })?.endpoint, frequency: "hourly" }
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

function RegisterDialog({ open, onOpenChange, atLimit }: { open: boolean; onOpenChange: (o: boolean) => void; atLimit: boolean }) {
  const registerModule = useApp((s) => s.registerModule);
  const addRule = useApp((s) => s.addRule);
  const [text, setText] = useState(SAMPLE_MANIFEST);
  const [errors, setErrors] = useState<string[]>([]);
  const submit = () => {
    if (atLimit) return setErrors([`The registry supports up to ${MAX_ADDITIONAL} modules beyond Inventory and Operations.`]);
    const { mod, rules, errors } = parseManifest(text);
    if (!mod) return setErrors(errors);
    const r = registerModule(mod);
    if (!r.ok) return setErrors(r.errors ?? []);
    rules?.forEach((rule) => addRule({ moduleId: mod.id, ...rule }));
    toast.success(`${mod.name} registered`, { description: "It's in the sidebar now. Grant employees access under Team access." });
    onOpenChange(false);
    setErrors([]);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register a module</DialogTitle>
          <DialogDescription>Paste the module's JSON manifest. It's activated immediately, with no redeployment.</DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-[320px] font-mono text-xs leading-relaxed" />
        {errors.length > 0 && (
          <ul role="alert" className="list-disc rounded-md border border-destructive/40 bg-destructive/10 p-3 pl-7 text-sm text-destructive">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setText(SAMPLE_MANIFEST)}>Reset to sample</Button>
          <Button onClick={submit}><FileJson />Register module</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegistryPage() {
  const modules = useApp((s) => s.modules);
  const records = useApp((s) => s.records);
  const { setModuleActive, setModuleFrequency } = useApp.getState();
  const [open, setOpen] = useState(false);
  const additional = modules.filter((m) => !m.baseline).length;

  return (
    <>
      <PageHeader
        title="Module registry"
        description={`Inventory and Operations are the baseline modules. You can register up to ${MAX_ADDITIONAL} more (${additional} of ${MAX_ADDITIONAL} used).`}
        actions={<Button onClick={() => setOpen(true)}><Plus />Register module</Button>}
      />
      <div className="grid gap-4">
        {modules.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex flex-1 items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><ModuleIcon name={m.icon} className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.name}</span>
                    {m.baseline && <Badge variant="secondary">Baseline</Badge>}
                    <Badge variant="outline">{m.kind === "native" ? "Native" : `${m.source} · ${m.adapter.type.toUpperCase()} adapter`}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.fields.length} fields · {records.filter((r) => r.moduleId === m.id).length} records · Registered {formatDate(m.registeredAt)} by {m.registeredBy}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 md:justify-end">
                {m.kind === "external" && (
                  <Select value={m.adapter.frequency} onValueChange={(v) => { setModuleFrequency(m.id, v as SyncFrequency); toast.success("Sync frequency updated"); }}>
                    <SelectTrigger className="w-36" aria-label="Sync frequency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Daily batch</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={m.active} onCheckedChange={(v) => { setModuleActive(m.id, v); toast.success(v ? `${m.name} activated` : `${m.name} deactivated`); }} />
                  {m.active ? "Active" : "Inactive"}
                </label>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <RegisterDialog open={open} onOpenChange={setOpen} atLimit={additional >= MAX_ADDITIONAL} />
    </>
  );
}
