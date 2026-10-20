import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ChevronRight, Clock, GitMerge, PackageX, ShieldOff, Truck, UserCheck, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LevelDot, PageHeader, StatCard } from "@/components/app/bits";
import { ORDER_STAGES } from "@/data/seed";
import { ROLE_LABEL, can, moduleAccess } from "@/lib/rbac";
import type { RecordItem } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

const PHT_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
const PHT_LABEL = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

function useOpsMetrics() {
  const records = useApp((s) => s.records);
  return useMemo(() => {
    const live = (r: RecordItem) => !r.archived;
    const orders = records.filter((r) => r.moduleId === "operations" && live(r));
    const items = records.filter((r) => r.moduleId === "ims" && live(r));
    const inProgress = orders.filter((o) => o.data.stage !== "Delivered");
    const soon = Date.now() + 2 * 86_400_000;
    const dueSoon = inProgress.filter((o) => new Date(String(o.data.due_date)).getTime() <= soon);
    const lowStock = items.filter((i) => Number(i.data.on_hand) <= Number(i.data.reorder_level));
    const byStage = ORDER_STAGES.map((stage) => ({ stage, count: orders.filter((o) => o.data.stage === stage).length }));
    return { orders, inProgress, dueSoon, lowStock, byStage };
  }, [records]);
}

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

function OrdersByStage({ className }: { className?: string }) {
  const { byStage } = useOpsMetrics();
  const max = Math.max(1, ...byStage.map((s) => s.count));
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Orders by stage</CardTitle>
        <CardDescription>Where every active order is right now</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {byStage.map((s) => (
          <div key={s.stage} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{s.stage}</span>
            <div className="h-2 rounded-full bg-muted">
              <div className={cn("h-2 rounded-full", s.stage === "Delivered" ? "bg-success" : "bg-primary")} style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            <span className="text-right tabular">{s.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AttentionList() {
  const syncOps = useApp((s) => s.syncOps);
  const rejected = useApp((s) => s.rejected);
  const { lowStock } = useOpsMetrics();
  const conflicts = syncOps.filter((o) => o.status === "conflict").length;
  const failed = syncOps.filter((o) => o.status === "failed").length;
  const open = rejected.filter((r) => r.status === "open").length;
  const items = [
    { show: conflicts > 0, to: "/sync", icon: <GitMerge />, text: `${conflicts} sync conflict${conflicts > 1 ? "s" : ""} to review`, tone: "warning" },
    { show: failed > 0, to: "/sync", icon: <AlertTriangle />, text: `${failed} failed write-back${failed > 1 ? "s" : ""} to Bitrix24`, tone: "danger" },
    { show: open > 0, to: "/pipeline", icon: <Workflow />, text: `${open} rejected row${open > 1 ? "s" : ""} in the ledger`, tone: "warning" },
    { show: lowStock.length > 0, to: "/modules/ims", icon: <PackageX />, text: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} at or below reorder level`, tone: "warning" },
  ].filter((i) => i.show);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>{items.length ? "Resolve these to keep data accurate" : "Nothing needs your review"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.map((i) => (
          <Link key={i.text} to={i.to} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-muted [&_svg]:size-4">
            <span className={i.tone === "danger" ? "text-destructive" : "text-warning"}>{i.icon}</span>
            <span className="flex-1">{i.text}</span>
            <ChevronRight className="text-muted-foreground transition-transform duration-200 ease-fluid group-hover:translate-x-0.5" />
          </Link>
        ))}
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
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest changes across your modules</CardDescription>
        </div>
        <Link to="/activity" className="text-sm text-primary hover:underline">View all</Link>
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
  const { inProgress, dueSoon, lowStock, orders } = useOpsMetrics();
  const runs = useApp((s) => s.pipelineRuns);
  const syncOps = useApp((s) => s.syncOps);
  const week = Date.now() - 7 * 86_400_000;
  const recentRuns = runs.filter((r) => new Date(r.startedAt).getTime() > week);
  const total = recentRuns.reduce((a, r) => a + r.total, 0);
  const loaded = recentRuns.reduce((a, r) => a + r.loaded, 0);
  const issues = syncOps.filter((o) => o.status === "conflict" || o.status === "failed").length;
  const hour = Number(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = me.name.split(" ")[0];

  if (me.role === "super_admin") {
    return (
      <>
        <PageHeader title={`${greeting}, ${first}`} description="Account status and recent activity across Zentra." />
        <AdminOverview />
      </>
    );
  }

  const isHead = can(me, "sync.manage");
  const delivered = orders.filter((o) => o.data.stage === "Delivered").length;
  return (
    <>
      <PageHeader title={`${greeting}, ${first}`} description={isHead ? "Operations at a glance and anything that needs your review." : "Your orders and stock at a glance."} />
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Orders in progress" value={inProgress.length} icon={<Truck />} hint={`${dueSoon.length} due within 2 days`} />
        <StatCard label="Low-stock items" value={lowStock.length} icon={<PackageX />} tone={lowStock.length ? "warning" : "default"} hint="At or below reorder level" />
        {isHead ? (
          <>
            <StatCard label="Pipeline success" value={total ? `${Math.round((loaded / total) * 100)}%` : "—"} icon={<Workflow />} hint={`${total - loaded} of ${total} rows rejected this week`} />
            <StatCard label="Sync issues" value={issues} icon={<GitMerge />} tone={issues ? "warning" : "success"} hint="Conflicts and failed write-backs" />
          </>
        ) : (
          <>
            <StatCard label="Due within 2 days" value={dueSoon.length} icon={<Clock />} tone={dueSoon.length ? "warning" : "default"} hint="Not yet delivered" />
            <StatCard label="Delivered" value={delivered} icon={<UserCheck />} tone="success" hint="Completed orders" />
          </>
        )}
      </div>
      <div className="stagger mt-4 grid gap-4 lg:grid-cols-3">
        {isHead ? (
          <>
            <PipelineChart />
            <AttentionList />
            <OrdersByStage />
            <RecentActivity className="lg:col-span-2" />
            <ModuleHealth />
          </>
        ) : (
          <>
            <OrdersByStage className="lg:col-span-1" />
            <RecentActivity className="lg:col-span-2" />
          </>
        )}
      </div>
    </>
  );
}
