import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Loader2, Play, Plus, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { RecordForm } from "@/components/app/record-form";
import { SAMPLE_CSV } from "@/data/seed";
import type { PipelineRun, RejectedRow, RuleKind } from "@/lib/types";
import { cn, formatDateTime, sleep } from "@/lib/utils";
import { parseCsv, recordLabel, RULE_LABEL } from "@/lib/validation";
import { useApp } from "@/store/app-store";

const STAGES = [
  { key: "ingest", label: "Ingest", desc: "Read rows from the source" },
  { key: "staging", label: "Staging", desc: "Hold rows apart from live data" },
  { key: "validate", label: "Validate", desc: "Apply the module's rules" },
  { key: "transform", label: "Transform", desc: "Map to the standard format" },
  { key: "load", label: "Load", desc: "Write to the central database" },
];

function RunStatus({ run }: { run: PipelineRun }) {
  if (run.status === "completed") return <Badge variant="success">Completed</Badge>;
  if (run.status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="warning">Completed with errors</Badge>;
}

function RunDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const modules = useApp((s) => s.modules.filter((m) => m.active));
  const runPipeline = useApp((s) => s.runPipeline);
  const [moduleId, setModuleId] = useState("ims");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<PipelineRun | null>(null);
  const [rows, setRows] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = stage >= 0 && !result;

  const reset = () => { setStage(-1); setResult(null); setFile(null); setRows(0); };

  const start = async () => {
    if (!file) return;
    const parsed = parseCsv(file.text);
    if (!parsed.length) { toast.error("No rows found", { description: "The file needs a header row and at least one data row." }); return; }
    setRows(parsed.length);
    for (let i = 0; i < STAGES.length; i++) { setStage(i); await sleep(550); }
    const run = runPipeline(moduleId, file.name, parsed);
    setStage(STAGES.length);
    setResult(run);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run data pipeline</DialogTitle>
          <DialogDescription>Rows that fail validation go to the rejected records ledger instead of being dropped.</DialogDescription>
        </DialogHeader>

        {stage < 0 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Target module</Label>
              <Select value={moduleId} onValueChange={(v) => { setModuleId(v); setFile(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Source file</Label>
              <input
                ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFile({ name: f.name, text: await f.text() }); e.target.value = ""; }}
              />
              <button
                type="button" onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors duration-200 hover:border-primary/40 hover:bg-muted"
              >
                <FileUp className="h-5 w-5 text-muted-foreground" />
                {file ? <span className="font-medium">{file.name}</span> : <span>Choose a CSV file</span>}
                <span className="text-xs text-muted-foreground">Column headers must match the module's field names</span>
              </button>
              {SAMPLE_CSV[moduleId] && (
                <Button variant="link" className="h-auto justify-start p-0 text-sm" onClick={() => setFile({ name: `sample_${moduleId}.csv`, text: SAMPLE_CSV[moduleId] })}>
                  Use the sample file (includes rows with errors)
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!file} onClick={start}><Play />Start run</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <ol className="grid gap-1">
              {STAGES.map((s, i) => {
                const done = stage > i;
                const active = stage === i;
                return (
                  <li key={s.key} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300", active && "bg-muted")}>
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                      done && "border-primary bg-primary text-primary-foreground", active && "border-primary text-primary",
                    )}>
                      {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                    {s.key === "ingest" && done && <span className="text-xs tabular text-muted-foreground">{rows} rows</span>}
                  </li>
                );
              })}
            </ol>
            {result && (
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted p-4 text-center">
                <div><div className="text-2xl font-semibold tabular">{result.total}</div><div className="text-xs text-muted-foreground">Rows read</div></div>
                <div><div className="text-2xl font-semibold tabular text-success">{result.loaded}</div><div className="text-xs text-muted-foreground">Loaded</div></div>
                <div><div className={cn("text-2xl font-semibold tabular", result.rejected && "text-warning")}>{result.rejected}</div><div className="text-xs text-muted-foreground">Rejected</div></div>
              </div>
            )}
            <DialogFooter>
              {result && result.rejected > 0 && (
                <Button variant="outline" onClick={() => { onOpenChange(false); reset(); onDone(); }}>Review rejected rows</Button>
              )}
              <Button disabled={!result} onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RejectedTab() {
  const rejected = useApp((s) => s.rejected);
  const modules = useApp((s) => s.modules);
  const runs = useApp((s) => s.pipelineRuns);
  const { reloadRejected, dismissRejected } = useApp.getState();
  const [status, setStatus] = useState<"open" | "all">("open");
  const [fixing, setFixing] = useState<RejectedRow | null>(null);
  const list = rejected.filter((r) => status === "all" || r.status === "open");
  const fixMod = modules.find((m) => m.id === fixing?.moduleId);
  const fixErrors = useMemo(() => fixing?.errors, [fixing]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">Fix a row and reload it, or dismiss it if it shouldn't be imported.</p>
        <Select value={status} onValueChange={(v) => setStatus(v as "open" | "all")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No rejected rows" description="Every row from recent runs passed validation." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Record</TableHead>
              <TableHead className="hidden sm:table-cell">Why it was rejected</TableHead>
              <TableHead className="hidden md:table-cell">Source</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => {
              const m = modules.find((x) => x.id === r.moduleId);
              const run = runs.find((x) => x.id === r.runId);
              const errors = <ul className="text-sm text-destructive">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>;
              const status = (
                <Badge variant={r.status === "open" ? "warning" : r.status === "reloaded" ? "success" : "secondary"}>
                  {r.status === "open" ? "Open" : r.status === "reloaded" ? "Reloaded" : "Dismissed"}
                </Badge>
              );
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{recordLabel(m, r.raw) || "(blank)"}</div>
                    <div className="text-xs text-muted-foreground">{m?.name} · row {r.rowIndex}</div>
                    <div className="mt-1.5 grid justify-items-start gap-1.5 sm:hidden">{errors}{status}</div>
                  </TableCell>
                  <TableCell className="hidden max-w-xs sm:table-cell">{errors}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {run ? `Run #${run.number} · ${run.source}` : "—"}
                    <div className="text-xs">{formatDateTime(r.createdAt)}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{status}</TableCell>
                  <TableCell>
                    {r.status === "open" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setFixing(r)}><Wrench />Fix</Button>
                        <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => { dismissRejected(r.id); toast("Row dismissed"); }}><X /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {fixMod && fixing && (
        <RecordForm
          open={!!fixing}
          onOpenChange={(o) => !o && setFixing(null)}
          module={fixMod}
          initial={fixing.raw}
          initialErrors={fixErrors}
          title={`Fix row ${fixing.rowIndex}`}
          description="Correct the values, then reload the row through validation."
          submitLabel="Reload row"
          onSubmit={(data) => {
            const r = reloadRejected(fixing.id, data);
            if (r.ok) { setFixing(null); toast.success("Row reloaded", { description: "It passed validation and was loaded." }); }
            return r;
          }}
        />
      )}
    </Card>
  );
}

function RulesTab() {
  const modules = useApp((s) => s.modules.filter((m) => m.active));
  const rules = useApp((s) => s.rules);
  const { toggleRule, addRule, removeRule } = useApp.getState();
  const [moduleId, setModuleId] = useState("ims");
  const mod = modules.find((m) => m.id === moduleId) ?? modules[0];
  const [field, setField] = useState("");
  const [kind, setKind] = useState<RuleKind>("required");
  const [value, setValue] = useState("");
  const needsValue = kind === "min" || kind === "pattern" || kind === "oneOf";
  const list = rules.filter((r) => r.moduleId === mod?.id);

  if (!mod) return <Card><EmptyState title="No active modules" /></Card>;
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Validation rules</CardTitle>
          <CardDescription>Applied to imports, Bitrix24 syncs, and form entries.</CardDescription>
        </div>
        <Select value={mod.id} onValueChange={(v) => { setModuleId(v); setField(""); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="divide-y divide-border/70 rounded-2xl bg-muted">
          {list.length === 0 && <EmptyState title="No rules yet" description="Add a rule below. Without rules, every row is accepted." />}
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r.id)} aria-label="Enable rule" />
              <div className={cn("min-w-0 flex-1", !r.enabled && "opacity-50")}>
                <div className="text-sm font-medium">{mod.fields.find((f) => f.key === r.field)?.label ?? r.field}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {RULE_LABEL[r.kind]}{r.value ? `: ${r.kind === "oneOf" ? r.value.split("|").join(", ") : r.value}` : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove rule" onClick={() => { removeRule(r.id); toast("Rule removed"); }}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border border-dashed p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label>Field</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue placeholder="Choose field" /></SelectTrigger>
              <SelectContent>{mod.fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Rule</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RuleKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(RULE_LABEL) as RuleKind[]).map((k) => <SelectItem key={k} value={k}>{RULE_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Value</Label>
            <Input
              disabled={!needsValue} value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "min" ? "0" : kind === "pattern" ? "^[A-Z]{3}-\\d{4}$" : kind === "oneOf" ? "A|B|C" : "Not needed"}
            />
          </div>
          <Button
            disabled={!field || (needsValue && !value)}
            onClick={() => { addRule({ moduleId: mod.id, field, kind, value: needsValue ? value : undefined }); setValue(""); toast.success("Rule added"); }}
          ><Plus />Add rule</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PipelinePage() {
  const runs = useApp((s) => s.pipelineRuns);
  const modules = useApp((s) => s.modules);
  const openRejected = useApp((s) => s.rejected.filter((r) => r.status === "open").length);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("runs");
  const sorted = [...runs].reverse();

  return (
    <>
      <PageHeader
        title="Data pipeline"
        description="Imports and Bitrix24 syncs go through ingest, staging, validation, transformation, and load before reaching the central database."
        actions={<Button onClick={() => setOpen(true)}><Play />Run pipeline</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="rejected">
            <span>Rejected<span className="hidden sm:inline"> records</span></span>
            {openRejected > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{openRejected}</span>}
          </TabsTrigger>
          <TabsTrigger value="rules"><span className="sm:hidden">Rules</span><span className="hidden sm:inline">Validation rules</span></TabsTrigger>
        </TabsList>
        <TabsContent value="runs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Run</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Loaded</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Rejected</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">#{r.number}</div>
                      <div className="text-xs text-muted-foreground">{modules.find((m) => m.id === r.moduleId)?.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[7rem] truncate min-[360px]:max-w-[9rem] sm:max-w-[12rem]">{r.source}</div>
                      <div className="text-xs text-muted-foreground">{r.runBy}</div>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {r.loaded}
                      {r.rejected > 0 && <div className="whitespace-nowrap text-xs text-warning sm:hidden">{r.rejected} rejected</div>}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular sm:table-cell", r.rejected > 0 && "text-warning")}>{r.rejected}</TableCell>
                    <TableCell className="hidden sm:table-cell"><RunStatus run={r} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">{formatDateTime(r.startedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="rejected"><RejectedTab /></TabsContent>
        <TabsContent value="rules"><RulesTab /></TabsContent>
      </Tabs>
      <RunDialog open={open} onOpenChange={setOpen} onDone={() => setTab("rejected")} />
    </>
  );
}
