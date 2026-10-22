import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, CircleAlert, CloudOff, Layers, RefreshCw, RotateCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/app/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSyncNowToast } from "@/components/app/app-shell";
import { EmptyState, PageHeader } from "@/components/app/bits";
import type { BatchItemKind, BatchOutcome, BatchRun, SyncOperation } from "@/lib/types";
import { recordLabel } from "@/lib/validation";
import { TERM_HELP } from "@/lib/terms";
import { cn, formatDate, formatDateTime, formatPeso, timeAgo } from "@/lib/utils";
import { useApp, type ConflictPolicy } from "@/store/app-store";

function fmt(key: string, v: string | number | undefined) {
  if (v === undefined || v === "") return "—";
  if (key === "amount") return formatPeso(Number(v));
  if (key === "due_date") return formatDate(String(v));
  return String(v);
}

function ConflictCard({ op }: { op: SyncOperation }) {
  const mod = useApp((s) => s.modules.find((m) => m.id === op.moduleId))!;
  const resolveConflict = useApp((s) => s.resolveConflict);
  const local = op.local ?? {};
  const remote = op.remote ?? {};
  const diff = mod.fields.filter((f) => String(local[f.key] ?? "") !== String(remote[f.key] ?? ""));
  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">{op.recordLabel}<Badge variant="warning">Needs review</Badge></CardTitle>
          <CardDescription>Changed in both Zentra and {mod.source} since the last update. Nothing was overwritten. {timeAgo(op.createdAt)}.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-2xl bg-muted py-1">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-2 py-2.5 font-medium sm:px-3">Field</th><th className="px-2 py-2.5 font-medium sm:px-3">Zentra</th><th className="px-2 py-2.5 font-medium sm:px-3">{mod.source}</th>
            </tr></thead>
            <tbody>
              {diff.map((f) => (
                <tr key={f.key} className="border-b last:border-0">
                  <td className="px-2 py-2.5 text-muted-foreground sm:px-3">{f.label}</td>
                  <td className="px-2 py-2.5 font-medium sm:px-3">{fmt(f.key, local[f.key])}</td>
                  <td className="px-2 py-2.5 font-medium sm:px-3">{fmt(f.key, remote[f.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={async () => {
            if (!(await confirmAction({ title: `Keep the ${mod.source} version of ${op.recordLabel}?`, description: `Zentra's edit is replaced with the version from ${mod.source}.`, confirmLabel: `Keep ${mod.source} version` }))) return;
            resolveConflict(op.id, "external"); toast.success(`Kept the ${mod.source} version`);
          }}>Keep {mod.source} version</Button>
          <Button onClick={async () => {
            if (!(await confirmAction({ title: `Keep the Zentra version of ${op.recordLabel}?`, description: `Zentra's version is sent to ${mod.source}, replacing the change made there.`, confirmLabel: "Keep Zentra version" }))) return;
            resolveConflict(op.id, "zentra"); toast.success("Kept the Zentra version", { description: `Sent to ${mod.source}.` });
          }}>Keep Zentra version</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FailedCard({ op }: { op: SyncOperation }) {
  const retrySync = useApp((s) => s.retrySync);
  const outage = useApp((s) => s.outage);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <CloudOff className="h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <div className="flex items-center gap-2 font-medium">{op.recordLabel}<Badge variant="destructive">Failed</Badge></div>
          <p className="text-sm text-muted-foreground">{op.error} The change is saved in Zentra. {timeAgo(op.createdAt)}.</p>
        </div>
        <Button variant="outline" onClick={async () => {
          if (!(await confirmAction({ title: `Send ${op.recordLabel} to Bitrix24 again?`, description: "Zentra sends the saved change to Bitrix24 again.", confirmLabel: "Retry" }))) return;
          retrySync(op.id); toast(outage ? "Bitrix24 can't be reached right now" : "Sending to Bitrix24 again"); }}>
          <RotateCw />Retry
        </Button>
      </CardContent>
    </Card>
  );
}

const KIND_LABEL: Record<BatchItemKind, string> = { writeback: "Couldn't send", conflict: "Needs review", rejected: "Needs fixing" };

function useBatchItems() {
  const ops = useApp((s) => s.syncOps);
  const rejected = useApp((s) => s.rejected);
  const modules = useApp((s) => s.modules);
  return [
    ...ops.filter((o) => o.status === "failed" || o.status === "conflict").map((o) => ({
      kind: (o.status === "failed" ? "writeback" : "conflict") as BatchItemKind, id: o.id, label: o.recordLabel,
      type: modules.find((m) => m.id === o.moduleId)?.recordName ?? "Record", issue: o.error ?? "",
    })),
    ...rejected.filter((r) => r.status === "open").map((r) => {
      const m = modules.find((x) => x.id === r.moduleId);
      return { kind: "rejected" as BatchItemKind, id: r.id, label: recordLabel(m, r.raw) || `Record ${r.rowIndex}`, type: m?.recordName ?? "Record", issue: r.errors.join("; ") };
    }),
  ];
}

const RESULT: Record<BatchOutcome["result"], { label: string; icon: React.ReactNode; tone: string }> = {
  success: { label: "Succeeded", icon: <CheckCircle2 className="h-4 w-4" />, tone: "text-success" },
  failed: { label: "Failed", icon: <XCircle className="h-4 w-4" />, tone: "text-destructive" },
  action: { label: "Needs action", icon: <CircleAlert className="h-4 w-4" />, tone: "text-warning" },
};

function BatchSummary({ run }: { run: BatchRun }) {
  return (
    <Card className="duration-300 ease-fluid animate-in fade-in-0 slide-in-from-bottom-2">
      <CardHeader>
        <CardTitle>Processing summary</CardTitle>
        <CardDescription>{run.outcomes.length} record{run.outcomes.length === 1 ? "" : "s"} processed by {run.by} · {formatDateTime(run.at)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {(["success", "failed", "action"] as const).map((r) => {
          const rows = run.outcomes.filter((o) => o.result === r);
          return (
            <div key={r} className="rounded-2xl bg-muted p-4">
              <div className={cn("mb-2 flex items-center gap-2 text-sm font-medium", RESULT[r].tone)}>
                {RESULT[r].icon}{RESULT[r].label}<span className="ml-auto tabular text-foreground">{rows.length}</span>
              </div>
              {rows.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                <ul className="grid gap-1.5">
                  {rows.map((o, i) => (
                    <li key={`${o.label}-${i}`} className="text-sm">
                      <span className="font-medium">{o.label}</span> <span className="text-xs text-muted-foreground">{o.type}</span>
                      <span className="block text-xs text-muted-foreground">{o.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BatchPanel() {
  const items = useBatchItems();
  const batches = useApp((s) => s.batches);
  const batchProcess = useApp((s) => s.batchProcess);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [policy, setPolicy] = useState<ConflictPolicy>("skip");
  const [last, setLast] = useState<BatchRun | null>(null);
  const chosen = items.filter((i) => selected.has(`${i.kind}:${i.id}`));
  const allOn = items.length > 0 && chosen.length === items.length;
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const run = async () => {
    const count = (k: string) => chosen.filter((i) => i.kind === k).length;
    const go = await confirmAction({
      title: `Process ${chosen.length} record${chosen.length === 1 ? "" : "s"}?`,
      description: "Each record is checked against your access and your rules. You'll get a summary when it's done.",
      details: [
        ...(count("writeback") ? [["Couldn't send", `${count("writeback")} sent again`] as [string, string]] : []),
        ...(count("conflict") ? [["Needs review", policy === "skip" ? `${count("conflict")} left for review` : `${count("conflict")} resolved (${policy === "zentra" ? "keep Zentra" : "keep Bitrix24"})`] as [string, string]] : []),
        ...(count("rejected") ? [["Needs fixing", `${count("rejected")} checked again`] as [string, string]] : []),
      ],
      confirmLabel: "Process records",
    });
    if (!go) return;
    const result = batchProcess(chosen.map(({ kind, id }) => ({ kind, id })), policy);
    if (!result) return toast.error("Only a Department Head can process records in bulk");
    setLast(result);
    setSelected(new Set());
    const ok = result.outcomes.filter((o) => o.result === "success").length;
    toast.success("Records processed", { description: `${ok} of ${result.outcomes.length} records went through.` });
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Process many records at once</CardTitle>
            <CardDescription>Each record is still checked against your access and your rules.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={policy} onValueChange={(v) => setPolicy(v as ConflictPolicy)}>
              <SelectTrigger className="h-10 sm:w-60" aria-label="What to do when both systems changed a record"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Ask me each time</SelectItem>
                <SelectItem value="zentra">Always keep mine</SelectItem>
                <SelectItem value="external">Always keep Bitrix24's</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={run} disabled={chosen.length === 0}><Layers />{chosen.length ? `Process ${chosen.length} selected` : "Process selected"}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Nothing to process" description="Records that couldn't be sent, records that need review, and records that need fixing will appear here." />
          ) : (
            <div className="grid gap-1">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={allOn}
                  onChange={() => setSelected(allOn ? new Set() : new Set(items.map((i) => `${i.kind}:${i.id}`)))} />
                Select all ({items.length})
              </label>
              {items.map((i) => {
                const key = `${i.kind}:${i.id}`;
                return (
                  <label key={key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-muted", selected.has(key) && "bg-primary/5")}>
                    <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={selected.has(key)} onChange={() => toggle(key)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{i.label}</span>
                        <span className="text-xs text-muted-foreground">{i.type}</span>
                        <Badge variant={i.kind === "conflict" ? "warning" : i.kind === "writeback" ? "destructive" : "secondary"}>{KIND_LABEL[i.kind]}</Badge>
                      </span>
                      {i.issue && <span className="mt-0.5 block text-xs text-muted-foreground">{i.issue}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {(last ?? batches[0]) && <BatchSummary run={(last ?? batches[0])!} />}
    </div>
  );
}

export function SyncPage() {
  const ops = useApp((s) => s.syncOps);
  const outage = useApp((s) => s.outage);
  const setOutage = useApp((s) => s.setOutage);
  const ops_mod = useApp((s) => s.modules.find((m) => m.id === "operations"));
  const syncNow = useSyncNowToast();
  const review = ops.filter((o) => o.status === "conflict" || o.status === "failed");
  const batchCount = useBatchItems().length;
  const pending = ops.filter((o) => o.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Sync"
        help={TERM_HELP.bitrix}
        description="Changes you make are saved in Zentra first, then sent to Bitrix24. When both systems change the same record, you decide which one to keep."
        actions={<Button variant="outline" onClick={() => syncNow("operations")}><RefreshCw />Update now</Button>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 rounded-full", outage ? "bg-destructive" : "bg-success")} />
              <div>
                <div className="font-medium">Bitrix24 {outage ? "not reachable" : "connected"}</div>
                <div className="text-xs text-muted-foreground">Connected to Bitrix24</div>
              </div>
            </div>
            <div className="text-sm"><div className="font-medium">{ops_mod?.lastSyncedAt ? timeAgo(ops_mod.lastSyncedAt) : "—"}</div><div className="text-xs text-muted-foreground">Last updated</div></div>
            <div className="text-sm"><div className="font-medium tabular">{pending}</div><div className="text-xs text-muted-foreground">Sending to Bitrix24</div></div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium"><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide">Demo</span> Simulate a Bitrix24 outage</div>
              <div className="text-xs text-muted-foreground">For the demo only. Changes to Bitrix24 are tried 3 times, then fail.</div>
            </div>
            <Switch checked={outage} onCheckedChange={async (v) => {
              if (!(await confirmAction(v
                ? { title: "Simulate a Bitrix24 outage?", description: "For the demo only: Bitrix24 becomes unreachable. Changes are tried 3 times, then fail.", confirmLabel: "Start outage", destructive: true }
                : { title: "Restore the Bitrix24 connection?", description: "Demo control: Bitrix24 becomes reachable again.", confirmLabel: "Restore" }))) return;
              setOutage(v); toast(v ? "Bitrix24 can't be reached right now" : "Bitrix24 is reachable again"); }} aria-label="Simulate outage" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">
            Needs review
            {review.length > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{review.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="batch">
            <span>Process in bulk</span>
            {batchCount > 0 && <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular">{batchCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="grid gap-4">
          {review.length === 0 ? (
            <Card><EmptyState title="Everything is up to date" description="Records that need review, and changes that couldn't be sent, will appear here." /></Card>
          ) : review.map((op) => (op.status === "conflict" ? <ConflictCard key={op.id} op={op} /> : <FailedCard key={op.id} op={op} />))}
        </TabsContent>
        <TabsContent value="batch"><BatchPanel /></TabsContent>
        <TabsContent value="history">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Record</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Outcome</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.recordLabel}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground [&_svg]:size-4">
                        {o.direction === "outbound"
                          ? <><ArrowUpRight className="text-primary" /><span>To<span className="hidden sm:inline"> Bitrix24</span></span></>
                          : <><ArrowDownLeft className="text-success" /><span>From<span className="hidden sm:inline"> Bitrix24</span></span></>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.status === "success" ? "success" : o.status === "pending" ? "default" : o.status === "conflict" ? "warning" : "destructive"}>
                        {o.status === "success" ? "Done" : o.status === "pending" ? "Writing back" : o.status === "conflict" ? "Conflict" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {o.resolution ?? (o.status === "success" ? `Completed in ${o.attempts} attempt${o.attempts > 1 ? "s" : ""}` : o.error ?? "—")}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatDateTime(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
