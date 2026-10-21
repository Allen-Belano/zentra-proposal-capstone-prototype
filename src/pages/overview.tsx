import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, CheckCircle2, Clock, GitMerge, Hourglass, PackageX, ShieldOff, Truck, UserCheck, Wallet, Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LevelDot, Money, PageHeader, StageBadge, StatCard } from "@/components/app/bits";
import { delayReason, STAGE_INFO, type OrderStage } from "@/lib/orders";
import { ROLE_LABEL, can, canViewDailySummary, canViewMonthlyMetrics, moduleAccess, POSITION_LABEL, POSITIONS, titleOf } from "@/lib/rbac";
import type { RecordItem } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";
import { CustomizableGeneral } from "@/components/app/dashboard";
import { KpiCard, useKpiData } from "./performance";

const PHT_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
const PHT_LABEL = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const LONG_DAY = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" });

/** Calendar day (YYYY-MM-DD) and month (YYYY-MM) in Philippine time. */
const dayKey = (d: string | Date) => PHT_DAY.format(new Date(d));
const monthKey = (d: string | Date) => dayKey(d).slice(0, 7);
const DAY_MS = 86_400_000;

function useOrders() {
  const records = useApp((s) => s.records);
  return useMemo(() => records.filter((r) => r.moduleId === "operations" && !r.archived && r.order), [records]);
}

function useLowStock() {
  const records = useApp((s) => s.records);
  return useMemo(() => records.filter((r) => r.moduleId === "ims" && !r.archived && Number(r.data.on_hand) <= Number(r.data.reorder_level)), [records]);
}

/** When a document was issued, found by its number in the order's history. */
const docAt = (o: RecordItem, key: "si" | "dr" | "payment") => {
  const no = o.order?.docs[key];
  return no ? o.order!.log.find((e) => e.description.includes(no))?.at : undefined;
};

const open = (o: RecordItem) => o.data.stage !== "Done";

// ---------------------------------------------------------------------------------------
// Daily process summary

export function DailySummary({ className }: { className?: string }) {
  if (!canViewDailySummary(useMe())) return null;
  return <DailySummaryCard className={className} />;
}

function DailySummaryCard({ className }: { className?: string }) {
  const orders = useOrders();
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);
  const { processes, byRole, paid, unpaid } = useMemo(() => {
    const processes = orders.flatMap((o) => o.order!.log.filter((e) => dayKey(e.at) === day).map((e) => ({ e, o })));
    const byRole = [
      ...POSITIONS.map((p) => ({ label: POSITION_LABEL[p], n: processes.filter((x) => x.e.position === p).length })),
      { label: "New from Bitrix24", n: processes.filter((x) => x.e.by === "Bitrix24").length },
    ].filter((r) => r.n > 0);
    const touched = new Map<string, { o: RecordItem; last: string }>();
    for (const { e, o } of processes) touched.set(o.id, { o, last: e.description });
    const list = [...touched.values()];
    return { processes, byRole, paid: list.filter((x) => x.o.data.payment === "Paid"), unpaid: list.filter((x) => x.o.data.payment !== "Paid") };
  }, [orders, day]);
  const label = LONG_DAY.format(new Date(`${day}T00:00:00Z`));

  const column = (title: string, tone: "success" | "warning", rows: typeof paid) => (
    <div className="min-w-0 rounded-2xl bg-muted p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("h-2 w-2 rounded-full", tone === "success" ? "bg-success" : "bg-warning")} />{title}
        </span>
        <span className="text-xs text-muted-foreground">
          {rows.length} order{rows.length === 1 ? "" : "s"} · <Money value={rows.reduce((a, x) => a + Number(x.o.data.amount), 0)} />
        </span>
      </div>
      {rows.length === 0 ? <p className="py-2 text-xs text-muted-foreground">None on this day</p> : (
        <ul className="flex flex-col gap-1">
          {rows.map(({ o, last }) => (
            <li key={o.id}>
              <Link to="/orders/$orderId" params={{ orderId: o.id }} className="flex items-start justify-between gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-card">
                <span className="min-w-0 flex-1">
                  <span className="block truncate"><span className="font-medium">{o.data.order_no}</span> <span className="text-muted-foreground">{o.data.customer}</span></span>
                  <span className="block truncate text-xs text-muted-foreground">{last}</span>
                </span>
                <Money value={o.data.amount} className="shrink-0 text-xs" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Daily process summary</CardTitle>
          <CardDescription>Steps completed and orders handled on {label}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {day !== today && <Button variant="ghost" size="sm" onClick={() => setDay(today)}>Today</Button>}
          <Input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 w-40" aria-label="Summary date" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground">{processes.length} step{processes.length === 1 ? "" : "s"} completed</span>
          {byRole.map((r) => <span key={r.label} className="rounded-full bg-muted px-3 py-1"><span className="font-medium">{r.n}</span> {r.label}</span>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {column("Paid", "success", paid)}
          {column("Unpaid", "warning", unpaid)}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Shared monthly metrics

function monthStats(orders: RecordItem[], m: string) {
  const delivered = orders.filter((o) => { const at = docAt(o, "dr"); return at && monthKey(at) === m; });
  const onTime = delivered.filter((o) => dayKey(docAt(o, "dr")!) <= String(o.data.due_date)).length;
  const completed = orders.filter((o) => o.data.stage === "Done" && monthKey(o.order!.log.at(-1)!.at) === m);
  const cycle = completed.map((o) => (new Date(o.order!.log.at(-1)!.at).getTime() - new Date(o.order!.log[0].at).getTime()) / DAY_MS);
  return {
    received: orders.filter((o) => monthKey(o.order!.log[0].at) === m).length,
    completed: completed.length,
    delivered: delivered.length,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : null,
    avgDays: cycle.length ? cycle.reduce((a, b) => a + b, 0) / cycle.length : null,
    invoiced: orders.filter((o) => { const at = docAt(o, "si"); return at && monthKey(at) === m; }).reduce((a, o) => a + Number(o.data.amount), 0),
    collected: orders.filter((o) => { const at = docAt(o, "payment"); return at && monthKey(at) === m; }).reduce((a, o) => a + Number(o.data.amount), 0),
  };
}

export function MonthlyMetrics({ className }: { className?: string }) {
  if (!canViewMonthlyMetrics(useMe())) return null;
  return <MonthlyMetricsCard className={className} />;
}

function MonthlyMetricsCard({ className }: { className?: string }) {
  const orders = useOrders();
  const lowStock = useLowStock();
  const months = useMemo(() => {
    const d = new Date();
    return [0, 1, 2].map((back) => {
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
      return first.toISOString().slice(0, 7);
    });
  }, []);
  const [month, setMonth] = useState(months[0]);
  const prevKey = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  }, [month]);
  const cur = useMemo(() => monthStats(orders, month), [orders, month]);
  const prev = useMemo(() => monthStats(orders, prevKey), [orders, prevKey]);
  const prevName = SHORT_MONTH.format(new Date(`${prevKey}-01T00:00:00Z`));
  const delta = (a: number, b: number) => {
    const d = a - b;
    return d === 0 ? `Same as ${prevName}` : `${d > 0 ? "+" : ""}${d} vs ${prevName}`;
  };

  const tiles: { label: string; value: React.ReactNode; hint: string }[] = [
    { label: "Orders received", value: cur.received, hint: delta(cur.received, prev.received) },
    { label: "Orders completed", value: cur.completed, hint: delta(cur.completed, prev.completed) },
    { label: "On-time deliveries", value: cur.onTimePct === null ? "—" : `${cur.onTimePct}%`, hint: `${cur.delivered} delivered this month` },
    { label: "Average time to complete", value: cur.avgDays === null ? "—" : `${cur.avgDays.toFixed(1)} days`, hint: "From won deal to payment" },
    { label: "Invoiced sales", value: <Money value={cur.invoiced} />, hint: "Sales invoices issued" },
    { label: "Payments collected", value: <Money value={cur.collected} />, hint: "Official receipts issued" },
    { label: "Low-stock items", value: lowStock.length, hint: "At or below reorder level now" },
  ];
  return (
    <Card className={className}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Monthly metrics</CardTitle>
          <CardDescription>Shared business and operations numbers for {MONTH.format(new Date(`${month}-01T00:00:00Z`))}</CardDescription>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-44" aria-label="Month"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{MONTH.format(new Date(`${m}-01T00:00:00Z`))}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-muted p-4">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="mt-1.5 text-xl font-semibold tracking-tight tabular">{t.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Business overview pieces

function OrderRow({ o, extra, warning }: { o: RecordItem; extra?: React.ReactNode; warning?: string | null }) {
  const owner = STAGE_INFO[o.data.stage as OrderStage]?.owner;
  return (
    <Link to="/orders/$orderId" params={{ orderId: o.id }} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-muted">
      <span className="min-w-0 flex-1">
        <span className="block truncate"><span className="font-medium">{o.data.order_no}</span> <span className="text-muted-foreground">{o.data.customer}</span></span>
        <span className="block truncate text-xs text-muted-foreground">
          {o.data.stage === "Done" ? "Completed" : `${o.data.stage} · waiting on ${owner ? POSITION_LABEL[owner] : "—"}`}
        </span>
        {warning && <span className="mt-0.5 flex items-center gap-1 text-xs text-warning"><Clock className="h-3 w-3 shrink-0" /><span className="truncate">{warning}</span></span>}
      </span>
      {extra && <span className="flex shrink-0 items-center gap-2">{extra}</span>}
    </Link>
  );
}

function AttentionCard({ title, description, empty, children, count, action }: {
  title: string; description: string; empty: string; count: number; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            {title}
            {count > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs tabular text-warning">{count}</span>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-success/5 px-3 py-2.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{empty}</p>
        ) : <div className="flex flex-col gap-0.5">{children}</div>}
      </CardContent>
    </Card>
  );
}

function useAttention() {
  const orders = useOrders();
  const lowStock = useLowStock();
  const syncOps = useApp((s) => s.syncOps);
  const rejected = useApp((s) => s.rejected);
  const batches = useApp((s) => s.batches);
  return useMemo(() => {
    const active = orders.filter(open);
    const delayed = active.filter((o) => delayReason(o)).map((o) => ({ o, why: delayReason(o)! }));
    const unpaid = orders.filter((o) => o.data.payment !== "Paid").sort((a, b) => Number(b.data.stage === "Collection") - Number(a.data.stage === "Collection"));
    const syncIssues = syncOps.filter((o) => o.status === "conflict" || o.status === "failed");
    const openRejected = rejected.filter((r) => r.status === "open");
    const lastBatch = batches[0];
    const batchIssues = lastBatch ? lastBatch.outcomes.filter((x) => x.result !== "success") : [];
    const queues = POSITIONS.map((p) => ({ p, orders: active.filter((o) => STAGE_INFO[o.data.stage as OrderStage]?.owner === p) }));
    const total = delayed.length + unpaid.filter((o) => o.data.stage === "Collection").length + syncIssues.length + openRejected.length + batchIssues.length + lowStock.length;
    return { active, delayed, unpaid, syncIssues, openRejected, lastBatch, batchIssues, queues, lowStock, total };
  }, [orders, lowStock, syncOps, rejected, batches]);
}

function NeedsAttention() {
  const a = useAttention();
  const receivable = a.unpaid.filter((o) => o.data.stage === "Collection");
  const technical = a.syncIssues.length + a.openRejected.length + a.batchIssues.length;
  return (
    <div className="grid gap-4">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Delayed orders" value={a.delayed.length} icon={<Clock />} tone={a.delayed.length ? "warning" : "success"} hint={`${a.active.length - a.delayed.length} of ${a.active.length} on track`} />
        <StatCard label="Unpaid orders" value={a.unpaid.length} icon={<Wallet />} tone={receivable.length ? "warning" : "default"} hint={<>{receivable.length} delivered, awaiting payment</>} />
        <StatCard label="Sync and batch issues" value={technical} icon={<GitMerge />} tone={technical ? "danger" : "success"} hint="Conflicts, failures, rejected rows" />
        <StatCard label="Low-stock items" value={a.lowStock.length} icon={<PackageX />} tone={a.lowStock.length ? "warning" : "success"} hint="At or below reorder level" />
      </div>
      <div className="stagger grid gap-4 lg:grid-cols-2">
        <AttentionCard title="Pending tasks by role" description="Open orders waiting for each Operations role" empty="No pending tasks" count={a.active.length}>
          {a.queues.map(({ p, orders }) => (
            <div key={p} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-sm">
              <span className="font-medium">{POSITION_LABEL[p]}</span>
              <span className="flex flex-wrap justify-end gap-1.5">
                {orders.length === 0 ? <span className="text-xs text-muted-foreground">Nothing waiting</span> : orders.map((o) => (
                  <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors", delayReason(o) ? "bg-warning/15 text-warning hover:bg-warning/25" : "bg-muted hover:bg-accent")}>
                    {o.data.order_no}
                  </Link>
                ))}
              </span>
            </div>
          ))}
        </AttentionCard>
        <AttentionCard title="Delayed orders" description="Past due, on hold, or stuck in one step" empty="Every order is on schedule" count={a.delayed.length}>
          {a.delayed.map(({ o, why }) => <OrderRow key={o.id} o={o} warning={why} />)}
        </AttentionCard>
        <AttentionCard title="Unpaid transactions" description="Delivered orders awaiting payment are listed first" empty="Every order is paid" count={a.unpaid.length}>
          {a.unpaid.map((o) => (
            <OrderRow key={o.id} o={o} extra={<>{o.data.stage === "Collection" && <Badge variant="warning">Delivered</Badge>}<Money value={o.data.amount} className="text-xs" /></>} />
          ))}
        </AttentionCard>
        <AttentionCard
          title="Sync and batch issues" description="Records that failed to sync, load, or process" empty="Everything synced and processed" count={technical}
          action={technical > 0 ? <Button asChild variant="outline" size="sm"><Link to="/sync">Open Sync center</Link></Button> : undefined}
        >
          {a.syncIssues.map((op) => (
            <Link key={op.id} to="/sync" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted">
              <span><span className="font-medium">{op.recordLabel}</span> <span className="text-muted-foreground">{op.status === "conflict" ? "changed in both systems" : "write-back failed"}</span></span>
              <Badge variant={op.status === "conflict" ? "warning" : "destructive"}>{op.status === "conflict" ? "Conflict" : "Failed"}</Badge>
            </Link>
          ))}
          {a.openRejected.map((r) => (
            <Link key={r.id} to="/pipeline" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted">
              <span className="min-w-0"><span className="font-medium">Rejected row {r.rowIndex}</span> <span className="block truncate text-xs text-muted-foreground">{r.errors[0]}</span></span>
              <Badge variant="warning">Rejected</Badge>
            </Link>
          ))}
          {a.batchIssues.map((x, i) => (
            <Link key={`${x.label}-${i}`} to="/sync" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted">
              <span className="min-w-0"><span className="font-medium">{x.label}</span> <span className="block truncate text-xs text-muted-foreground">Last batch: {x.message}</span></span>
              <Badge variant={x.result === "failed" ? "destructive" : "warning"}>{x.result === "failed" ? "Failed" : "Needs action"}</Badge>
            </Link>
          ))}
        </AttentionCard>
        <AttentionCard title="Low stock" description="Items to reorder before they run out" empty="Stock levels are healthy" count={a.lowStock.length}>
          {a.lowStock.map((r) => (
            <Link key={r.id} to="/modules/$moduleId" params={{ moduleId: "ims" }} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted">
              <span><span className="font-medium">{r.data.name}</span> <span className="text-muted-foreground">{r.data.sku}</span></span>
              <span className="text-xs text-muted-foreground"><span className="font-medium text-warning tabular">{r.data.on_hand}</span> left · reorder at {r.data.reorder_level}</span>
            </Link>
          ))}
        </AttentionCard>
      </div>
    </div>
  );
}

function MyKpis({ className }: { className?: string }) {
  const me = useMe()!;
  const { employees, prevName } = useKpiData(monthKey(new Date()));
  const mine = employees.find((k) => k.user.id === me.id);
  if (!mine) return null;
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">My KPIs this month</h2>
        <Link to="/performance" className="text-sm text-primary hover:underline">Details</Link>
      </div>
      <KpiCard k={mine} prevName={prevName} />
    </div>
  );
}

function WaitingOnYou({ className }: { className?: string }) {
  const me = useMe()!;
  const orders = useOrders();
  const mine = orders.filter((o) => open(o) && STAGE_INFO[o.data.stage as OrderStage]?.owner === me.position);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Waiting on you
          {mine.length > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs tabular text-primary-foreground">{mine.length}</span>}
        </CardTitle>
        <CardDescription>Orders at a step your role ({me.position ? POSITION_LABEL[me.position] : "unassigned"}) completes</CardDescription>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-success/5 px-3 py-2.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Nothing is waiting on you right now</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {mine.map((o) => <OrderRow key={o.id} o={o} warning={delayReason(o)} extra={<StageBadge stage={String(o.data.stage)} />} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Reused system pieces

const tooltipStyle = {
  background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))",
};

function PipelineChart() {
  const runs = useApp((s) => s.pipelineRuns);
  const data = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000);
      const key = PHT_DAY.format(d);
      const dayRuns = runs.filter((r) => PHT_DAY.format(new Date(r.startedAt)) === key);
      return {
        day: PHT_LABEL.format(d),
        Loaded: dayRuns.reduce((a, r) => a + r.loaded, 0),
        Rejected: dayRuns.reduce((a, r) => a + r.rejected, 0),
      };
    });
  }, [runs]);
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Pipeline throughput</CardTitle>
        <CardDescription>Rows loaded and rejected over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="h-64 pl-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} />
            <Bar dataKey="Loaded" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Rejected" stackId="a" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ className }: { className?: string }) {
  const activity = useApp((s) => s.activity);
  const modules = useApp((s) => s.modules);
  const me = useMe();
  const visible = activity.filter((e) => !e.moduleId || moduleAccess(me, e.moduleId) !== "none").slice(0, 6);
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>System activity</CardTitle>
          <CardDescription>Syncs, pipeline runs, and alerts</CardDescription>
        </div>
        </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {visible.map((e) => (
          <div key={e.id} className="flex gap-3 text-sm">
            <LevelDot level={e.level} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {modules.find((m) => m.id === e.moduleId)?.name ?? "System"} · {e.actor} · {timeAgo(e.at)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ModuleHealth() {
  const modules = useApp((s) => s.modules.filter((m) => m.active));
  const records = useApp((s) => s.records);
  const outage = useApp((s) => s.outage);
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Module health</CardTitle>
        <CardDescription>Connection and last sync for each active module</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const down = m.kind === "external" && outage;
          return (
            <Link key={m.id} to={`/modules/${m.id}`} className="rounded-2xl bg-muted p-4 transition-[background-color,transform] duration-200 ease-fluid hover:-translate-y-0.5 hover:bg-accent">
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.name}</span>
                {m.kind === "native"
                  ? <Badge variant="secondary">Native</Badge>
                  : <Badge variant={down ? "destructive" : "success"}>{down ? "Unreachable" : `${m.source} connected`}</Badge>}
              </div>
              <div className="mt-3 flex gap-6 text-sm">
                <div><div className="tabular font-semibold">{records.filter((r) => r.moduleId === m.id && !r.archived).length}</div><div className="text-xs text-muted-foreground">records</div></div>
                <div><div className="font-semibold">{m.lastSyncedAt ? timeAgo(m.lastSyncedAt) : "Live"}</div><div className="text-xs text-muted-foreground">{m.kind === "native" ? "stored in Zentra" : "last synced"}</div></div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AdminOverview() {
  const users = useApp((s) => s.users);
  const audit = useApp((s) => s.audit);
  const day = Date.now() - 86_400_000;
  const signIns = audit.filter((a) => a.action === "Signed in" && new Date(a.at).getTime() > day).length;
  const events = audit.filter((a) => new Date(a.at).getTime() > day).length;
  const active = users.filter((u) => u.status === "active");
  return (
    <>
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active accounts" value={active.length} icon={<UserCheck />} hint={`${users.length} total`} />
        <StatCard label="Disabled accounts" value={users.length - active.length} icon={<ShieldOff />} hint="Can't sign in" />
        <StatCard label="Sign-ins today" value={signIns} icon={<Clock />} hint="Last 24 hours" />
        <StatCard label="Audit events today" value={events} icon={<Workflow />} hint="Last 24 hours" />
      </div>
      <div className="stagger mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Accounts by role</CardTitle><CardDescription>Active accounts only</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(["super_admin", "dept_head", "employee"] as const).map((r) => (
              <div key={r} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ROLE_LABEL[r]}</span>
                <span className="tabular font-medium">{active.filter((u) => u.role === r).length}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1"><CardTitle>Latest audit events</CardTitle><CardDescription>Who changed what</CardDescription></div>
            <Link to="/audit" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {audit.slice(0, 6).map((a) => (
              <div key={a.id} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-medium">{a.actor}</span> <span className="text-muted-foreground">{a.action.toLowerCase()}</span> {a.target}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}


export function OverviewPage() {
  const me = useMe()!;
  const orders = useOrders();
  const lowStock = useLowStock();
  const runs = useApp((s) => s.pipelineRuns);
  const syncOps = useApp((s) => s.syncOps);
  const rejected = useApp((s) => s.rejected);
  const outage = useApp((s) => s.outage);
  const attention = useAttention();
  // Headings name the role, not the person: the same screen reads the same for whoever holds it.
  const role = titleOf(me);

  if (me.role === "super_admin") {
    return (
      <>
        <PageHeader title={role} description="Account status and recent activity across Zentra." />
        <AdminOverview />
      </>
    );
  }

  const active = orders.filter(open);
  const thisMonth = monthKey(new Date());
  const completedThisMonth = orders.filter((o) => o.data.stage === "Done" && monthKey(o.order!.log.at(-1)!.at) === thisMonth).length;

  if (!can(me, "sync.manage")) {
    const mine = active.filter((o) => STAGE_INFO[o.data.stage as OrderStage]?.owner === me.position);
    return (
      <>
        <PageHeader title={role} description="Your tasks and today's numbers" />
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Waiting on you" value={mine.length} icon={<Hourglass />} tone={mine.length ? "warning" : "success"} hint="Orders at your step" />
          <StatCard label="Orders in progress" value={active.length} icon={<Truck />} hint="Across all roles" />
          <StatCard label="Completed this month" value={completedThisMonth} icon={<UserCheck />} tone="success" hint="Delivered and paid" />
          <StatCard label="Low-stock items" value={lowStock.length} icon={<PackageX />} tone={lowStock.length ? "warning" : "default"} hint="At or below reorder level" />
        </div>
        <div className="stagger mt-4 grid gap-4 lg:grid-cols-3">
          <WaitingOnYou className={canViewDailySummary(me) ? "lg:col-span-1" : "lg:col-span-3"} />
          {canViewDailySummary(me) && <DailySummary className="lg:col-span-2" />}
          <MyKpis className="lg:col-span-3" />
        </div>
      </>
    );
  }

  const week = Date.now() - 7 * DAY_MS;
  const recentRuns = runs.filter((r) => new Date(r.startedAt).getTime() > week);
  const total = recentRuns.reduce((a, r) => a + r.total, 0);
  const loaded = recentRuns.reduce((a, r) => a + r.loaded, 0);
  const issues = syncOps.filter((o) => o.status === "conflict" || o.status === "failed").length;
  const openRejected = rejected.filter((r) => r.status === "open").length;

  return (
    <>
      <PageHeader title={role} description="Business performance, operations, and what needs your decision." />
      <Tabs defaultValue="general">
        <TabsList className="mb-0">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="attention">
            <span className="sm:hidden">Attention</span><span className="hidden sm:inline">Needs attention</span>
            {attention.total > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs tabular text-warning">{attention.total}</span>}
          </TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <CustomizableGeneral renderers={{
            "daily-summary": (cls) => <DailySummary className={cls} />,
            "monthly-metrics": (cls) => <MonthlyMetrics className={cls} />,
          }} />
        </TabsContent>

        <TabsContent value="attention"><NeedsAttention /></TabsContent>

        <TabsContent value="technical" className="grid gap-4">
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Pipeline success" value={total ? `${Math.round((loaded / total) * 100)}%` : "—"} icon={<Workflow />} hint={`${total - loaded} of ${total} rows rejected this week`} />
            <StatCard label="Sync issues" value={issues} icon={<GitMerge />} tone={issues ? "warning" : "success"} hint="Conflicts and failed write-backs" />
            <StatCard label="Rejected rows" value={openRejected} icon={<AlertTriangle />} tone={openRejected ? "warning" : "success"} hint="Waiting in the ledger" />
            <StatCard label="Bitrix24" value={outage ? "Offline" : "Online"} icon={<ShieldOff />} tone={outage ? "danger" : "success"} hint="API adapter, two-way sync" />
          </div>
          <div className="stagger grid gap-4 lg:grid-cols-3">
            <PipelineChart />
            <RecentActivity />
            <ModuleHealth />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
