import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Loader2, Play, Plus, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/app/confirm";
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
import { TERM_HELP } from "@/lib/terms";
import { useApp } from "@/store/app-store";

const STAGES = [
  { key: "ingest", label: "Read the file", desc: "Take the rows out of the file" },
  { key: "staging", label: "Check the rows", desc: "Set aside rows that don't pass your rules" },
  { key: "load", label: "Save to Zentra", desc: "Save the rows that passed" },
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
    if (!parsed.length) { toast.error("No rows found", { description: "The file needs a heading row and at least one row of data." }); return; }
    const target = modules.find((m) => m.id === moduleId);
    if (!(await confirmAction({
      title: `Import ${file.name}?`,
      description: "Rows that pass your rules are saved in Zentra. Rows that fail are set aside for you to fix.",
      details: [["Module", target?.name ?? moduleId], ["Rows", String(parsed.length)]],
      confirmLabel: "Import file",
    }))) return;
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
          <DialogTitle>Import a file</DialogTitle>
          <DialogDescription>Rows that fail your rules are set aside for you to fix, instead of being dropped.</DialogDescription>
        </DialogHeader>

        {stage < 0 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Where to save the records</Label>
              <Select value={moduleId} onValueChange={(v) => { setModuleId(v); setFile(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>File to import</Label>
              <input
                ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFile({ name: f.name, text: await f.text() }); e.target.value = ""; }}
              />
              <button
                type="button" onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors duration-200 hover:border-primary/40 hover:bg-muted"
              >
                <FileUp className="h-5 w-5 text-muted-foreground" />
                {file ? <span className="font-medium">{file.name}</span> : <span>Choose a file to import</span>}
                <span className="text-xs text-muted-foreground">The column headings in the file must match the field names</span>
              </button>
              {SAMPLE_CSV[moduleId] && (
                <Button variant="link" className="h-auto justify-start p-0 text-sm" onClick={() => setFile({ name: `sample_${moduleId}.csv`, text: SAMPLE_CSV[moduleId] })}>
                  Use the sample file (includes rows that need fixing)
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!file} onClick={start}><Play />Start import</Button>
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
                <div><div className="text-2xl font-semibold tabular text-success">{result.loaded}</div><div className="text-xs text-muted-foreground">Saved</div></div>
                <div><div className={cn("text-2xl font-semibold tabular", result.rejected && "text-warning")}>{result.rejected}</div><div className="text-xs text-muted-foreground">Needs fixing</div></div>
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
        <p className="text-sm text-muted-foreground">Correct a record and load it again, or dismiss it if it shouldn't be imported.</p>
        <Select value={status} onValueChange={(v) => setStatus(v as "open" | "all")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nothing to fix" description="Every record from recent imports passed your rules." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Record</TableHead>
              <TableHead className="hidden sm:table-cell">What needs fixing</TableHead>
              <TableHead className="hidden md:table-cell">Where it came from</TableHead>
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
                  {r.status === "open" ? "Open" : r.status === "reloaded" ? "Loaded" : "Dismissed"}
                </Badge>
              );
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{recordLabel(m, r.raw) || "(blank)"}</div>
                    <div className="text-xs text-muted-foreground">{m?.name} · record {r.rowIndex}</div>
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
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setFixing(r)}><Wrench />Fix</Button>
                        {/* Dismiss sits apart from Fix, and is the smaller target, so it isn't hit by accident. */}
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={async () => {
                          if (!(await confirmAction({ title: `Dismiss record ${r.rowIndex}?`, description: "It won't be imported. It stays in the list marked Dismissed.", confirmLabel: "Dismiss", destructive: true }))) return;
                          dismissRejected(r.id); toast("Record dismissed");
                        }}><X />Dismiss</Button>
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
          title={`Fix record ${fixing.rowIndex}`}
          description="Correct the values, then load the record again."
          submitLabel="Load again"
          onSubmit={async (data) => {
            if (!(await confirmAction({ title: `Load record ${fixing.rowIndex} again?`, description: "The corrected record is checked against your rules again. If it passes, it's saved in Zentra.", confirmLabel: "Load again" }))) return null;
            const r = reloadRejected(fixing.id, data);
            if (r.ok) { setFixing(null); toast.success("Record loaded", { description: "It passed your rules and was saved." }); }
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
          <CardTitle>Rules for checking records</CardTitle>
          <CardDescription>Applied to files you import, updates from Bitrix24, and records you type in.</CardDescription>
        </div>
        <Select value={mod.id} onValueChange={(v) => { setModuleId(v); setField(""); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        <div className="divide-y divide-border/70 rounded-2xl bg-muted">
          {list.length === 0 && <EmptyState title="No rules yet" description="Add a rule below. Without rules, every record is accepted." />}
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Switch checked={r.enabled} onCheckedChange={() => {
                const name = mod.fields.find((f) => f.key === r.field)?.label ?? r.field;
                toggleRule(r.id);
                toast.success(r.enabled ? `Rule turned off for ${name}` : `Rule turned on for ${name}`, {
                  description: "New imports, updates from Bitrix24, and records you type in are affected.",
                  action: { label: "Undo", onClick: () => toggleRule(r.id) },
                });
              }} aria-label={`Turn the rule for ${mod.fields.find((f) => f.key === r.field)?.label ?? r.field} on or off`} />
              <div className={cn("min-w-0 flex-1", !r.enabled && "opacity-50")}>
                <div className="text-sm font-medium">{mod.fields.find((f) => f.key === r.field)?.label ?? r.field}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {RULE_LABEL[r.kind]}{r.value ? `: ${r.kind === "oneOf" ? r.value.split("|").join(", ") : r.value}` : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove rule" onClick={async () => {
                if (!(await confirmAction({ title: "Remove this rule?", description: `${RULE_LABEL[r.kind]} on ${mod.fields.find((f) => f.key === r.field)?.label ?? r.field} will no longer be checked.`, confirmLabel: "Remove rule", destructive: true }))) return;
                removeRule(r.id); toast("Rule removed");
              }}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-dashed p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label>Field</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue placeholder="Choose a field" /></SelectTrigger>
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
              placeholder={kind === "min" ? "0" : kind === "pattern" ? "ABC-1234" : kind === "oneOf" ? "A, B, C" : "Not needed"}
            />
          </div>
          <Button
            disabled={!field || (needsValue && !value)}
            onClick={async () => {
              if (!(await confirmAction({
                title: "Add this rule?",
                description: "New imports, updates from Bitrix24, and records you type in will be checked against it. Existing records aren't changed.",
                details: [["Field", mod.fields.find((f) => f.key === field)?.label ?? field], ["Rule", RULE_LABEL[kind]], ...(needsValue ? [["Value", value] as [string, string]] : [])],
                confirmLabel: "Add rule",
              }))) return;
              addRule({ moduleId: mod.id, field, kind, value: needsValue ? value : undefined }); setValue(""); toast.success("Rule added");
            }}
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
        help={TERM_HELP.pipeline}
        description="Files you upload and updates from Bitrix24 are checked against your rules before they're saved. Rows that don't pass are set aside for you to fix."
        actions={<Button onClick={() => setOpen(true)}><Play />Import a file</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="runs">Imports</TabsTrigger>
          <TabsTrigger value="rejected">
            <span>Needs fixing<span className="hidden sm:inline"> records</span></span>
            {openRejected > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{openRejected}</span>}
          </TabsTrigger>
          <TabsTrigger value="rules"><span className="sm:hidden">Rules</span><span className="hidden sm:inline">Rules for checking records</span></TabsTrigger>
        </TabsList>
        <TabsContent value="runs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Import</TableHead>
                  <TableHead>Where it came from</TableHead>
                  <TableHead className="text-right">Saved</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Needs fixing</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Started</TableHead>
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
                      <div className="max-w-[7rem] truncate min-[360px]:max-w-[9rem] xl:max-w-[12rem]">{r.source}</div>
                      <div className="text-xs text-muted-foreground">{r.runBy}</div>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {r.loaded}
                      {r.rejected > 0 && <div className="whitespace-nowrap text-xs text-warning sm:hidden">{r.rejected} need fixing</div>}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular sm:table-cell", r.rejected > 0 && "text-warning")}>{r.rejected}</TableCell>
                    <TableCell className="hidden sm:table-cell"><RunStatus run={r} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{formatDateTime(r.startedAt)}</TableCell>
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
