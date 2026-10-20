import { ArrowDownLeft, ArrowUpRight, CloudOff, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSyncNowToast } from "@/components/app/app-shell";
import { EmptyState, PageHeader } from "@/components/app/bits";
import type { SyncOperation } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatPeso, timeAgo } from "@/lib/utils";
import { useApp } from "@/store/app-store";

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
          <CardTitle className="flex items-center gap-2">{op.recordLabel}<Badge variant="warning">Conflict</Badge></CardTitle>
          <CardDescription>Changed in both Zentra and {mod.source} since the last sync. Nothing was overwritten. {timeAgo(op.createdAt)}.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium sm:px-3">Field</th><th className="px-2 py-2 font-medium sm:px-3">Zentra</th><th className="px-2 py-2 font-medium sm:px-3">{mod.source}</th>
            </tr></thead>
            <tbody>
              {diff.map((f) => (
                <tr key={f.key} className="border-b last:border-0">
                  <td className="px-2 py-2 text-muted-foreground sm:px-3">{f.label}</td>
                  <td className="px-2 py-2 font-medium sm:px-3">{fmt(f.key, local[f.key])}</td>
                  <td className="px-2 py-2 font-medium sm:px-3">{fmt(f.key, remote[f.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => { resolveConflict(op.id, "external"); toast.success(`Kept the ${mod.source} version`); }}>Keep {mod.source} version</Button>
          <Button onClick={() => { resolveConflict(op.id, "zentra"); toast.success("Kept the Zentra version", { description: `Pushed to ${mod.source}.` }); }}>Keep Zentra version</Button>
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
        <Button variant="outline" onClick={() => { retrySync(op.id); toast(outage ? "Retrying while Bitrix24 is unreachable" : "Retrying write-back"); }}>
          <RotateCw />Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function SyncPage() {
  const ops = useApp((s) => s.syncOps);
  const outage = useApp((s) => s.outage);
  const setOutage = useApp((s) => s.setOutage);
  const ops_mod = useApp((s) => s.modules.find((m) => m.id === "operations"));
  const syncNow = useSyncNowToast();
  const review = ops.filter((o) => o.status === "conflict" || o.status === "failed");
  const pending = ops.filter((o) => o.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Sync center"
        description="Two-way sync with Bitrix24. Edits are saved in Zentra first, then written back. Conflicts wait for your decision."
        actions={<Button variant="outline" onClick={() => syncNow("operations")}><RefreshCw />Sync now</Button>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 rounded-full", outage ? "bg-destructive" : "bg-success")} />
              <div>
                <div className="font-medium">Bitrix24 {outage ? "unreachable" : "connected"}</div>
                <div className="text-xs text-muted-foreground">API adapter · {ops_mod?.adapter.frequency === "realtime" ? "Real-time" : ops_mod?.adapter.frequency} sync</div>
              </div>
            </div>
            <div className="text-sm"><div className="font-medium">{ops_mod?.lastSyncedAt ? timeAgo(ops_mod.lastSyncedAt) : "—"}</div><div className="text-xs text-muted-foreground">Last synced</div></div>
            <div className="text-sm"><div className="font-medium tabular">{pending}</div><div className="text-xs text-muted-foreground">Writing back</div></div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium">Simulate Bitrix24 outage</div>
              <div className="text-xs text-muted-foreground">Demo control. Write-backs retry 3 times, then fail.</div>
            </div>
            <Switch checked={outage} onCheckedChange={(v) => { setOutage(v); toast(v ? "Bitrix24 is now unreachable" : "Bitrix24 connection restored"); }} aria-label="Simulate outage" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">
            Needs review
            {review.length > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{review.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="grid gap-4">
          {review.length === 0 ? (
            <Card><EmptyState title="Everything is in sync" description="Conflicts and failed write-backs will appear here for review." /></Card>
          ) : review.map((op) => (op.status === "conflict" ? <ConflictCard key={op.id} op={op} /> : <FailedCard key={op.id} op={op} />))}
        </TabsContent>
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
