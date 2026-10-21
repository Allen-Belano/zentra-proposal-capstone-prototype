import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Clock, Gauge, Hourglass, Timer, Truck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import {
  completedSteps, departmentKpis, employeeKpis, formatHours, TARGET_HOURS, type EmployeeKpis,
} from "@/lib/kpis";
import { canViewKpisOf, canViewTeamKpis, POSITION_LABEL, POSITIONS } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

const MONTH = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" });
const monthsBack = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1)).toISOString().slice(0, 7);
};
const prevOf = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
};
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);

export function useKpiData(month: string) {
  const records = useApp((s) => s.records);
  const users = useApp((s) => s.users);
  return useMemo(() => {
    const orders = records.filter((r) => r.moduleId === "operations" && !r.archived && r.order);
    const steps = completedSteps(orders);
    const prev = prevOf(month);
    const employees = users
      .filter((u) => u.role === "employee" && u.status === "active" && u.position)
      .map((u) => employeeKpis(u, orders, steps, month, prev)!)
      .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
    return { employees, department: departmentKpis(orders, steps, month, prev, POSITIONS), prevName: SHORT_MONTH.format(new Date(`${prev}-01T00:00:00Z`)) };
  }, [records, users, month]);
}

const delta = (cur: number, prev: number, prevName: string) => {
  const d = cur - prev;
  return d === 0 ? `Same as ${prevName}` : `${d > 0 ? "+" : ""}${d} vs ${prevName}`;
};

/** One employee's KPIs. Shown to that employee, their Department Head, and authorized colleagues. */
export function KpiCard({ k, prevName, className }: { k: EmployeeKpis; prevName: string; className?: string }) {
  const target = TARGET_HOURS[k.position];
  const tiles = [
    { label: "Steps completed", value: k.steps, hint: delta(k.steps, k.stepsPrev, prevName), icon: <CheckCircle2 /> },
    { label: "Average handling time", value: formatHours(k.avgHours), hint: `Target: within ${formatHours(target)}`, icon: <Timer />, warn: k.avgHours !== null && k.avgHours > target },
    { label: "Done within target", value: k.onTargetPct === null ? "—" : `${k.onTargetPct}%`, hint: `Steps finished within ${formatHours(target)}`, icon: <Gauge />, warn: k.onTargetPct !== null && k.onTargetPct < 80 },
    { label: "Waiting now", value: k.queue, hint: k.delayedInQueue ? `${k.delayedInQueue} delayed` : "None delayed", icon: <Hourglass />, warn: k.delayedInQueue > 0 },
    { label: k.roleMetric.label, value: k.roleMetric.value, hint: delta(k.roleMetric.value, k.roleMetric.prev, prevName), icon: <Truck /> },
  ];
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center gap-3">
        <Avatar className="h-10 w-10"><AvatarFallback>{initials(k.user.name)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <CardTitle className="truncate">{k.user.name}</CardTitle>
          <CardDescription>{POSITION_LABEL[k.position]}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-2xl bg-muted p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{t.icon}<span className="truncate">{t.label}</span></div>
            <div className={cn("mt-1.5 text-xl font-semibold tracking-tight tabular", t.warn && "text-warning")}>{t.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))",
};

/** Department-wide KPIs: Department Head and authorized employees only. */
export function DepartmentKpis({ month }: { month: string }) {
  const { department: d, prevName } = useKpiData(month);
  const chart = d.byPosition.map((p) => ({ role: POSITION_LABEL[p.position], Steps: p.steps }));
  return (
    <div className="grid gap-4">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Orders completed" value={d.completed} icon={<CheckCircle2 />} tone="success" hint={delta(d.completed, d.completedPrev, prevName)} />
        <StatCard label="Average order cycle" value={d.avgCycleDays === null ? "—" : `${d.avgCycleDays.toFixed(1)} days`} icon={<Clock />} hint="Won deal to payment" />
        <StatCard label="On-time deliveries" value={d.onTimeDeliveryPct === null ? "—" : `${d.onTimeDeliveryPct}%`} icon={<Truck />} tone={d.onTimeDeliveryPct !== null && d.onTimeDeliveryPct < 80 ? "warning" : "default"} hint="Delivered by the due date" />
        <StatCard label="Steps within target" value={d.onTargetPct === null ? "—" : `${d.onTargetPct}%`} icon={<Gauge />} hint={`${d.steps} steps · ${delta(d.steps, d.stepsPrev, prevName)}`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Steps completed by role</CardTitle>
          <CardDescription>{d.open} orders open now, {d.delayed} delayed</CardDescription>
        </CardHeader>
        <CardContent className="h-60 pl-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="role" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} />
              <Bar dataKey="Steps" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeTable({ rows, selected, onSelect }: { rows: EmployeeKpis[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employees</CardTitle>
        <CardDescription>Select an employee to see their full KPIs</CardDescription>
      </CardHeader>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="hidden text-right md:table-cell">Avg handling</TableHead>
              <TableHead className="text-right">Within target</TableHead>
              <TableHead className="text-right">Waiting</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((k) => (
              <TableRow key={k.user.id} className={cn("cursor-pointer", selected === k.user.id && "[&>td]:bg-primary/5")} onClick={() => onSelect(k.user.id)}>
                <TableCell>
                  <span className="font-medium">{k.user.name}</span>
                  <span className="block text-xs text-muted-foreground">{POSITION_LABEL[k.position]}</span>
                </TableCell>
                <TableCell className="text-right tabular">{k.steps}</TableCell>
                <TableCell className="hidden text-right tabular md:table-cell">{formatHours(k.avgHours)}</TableCell>
                <TableCell className={cn("text-right tabular", k.onTargetPct !== null && k.onTargetPct < 80 && "text-warning")}>{k.onTargetPct === null ? "—" : `${k.onTargetPct}%`}</TableCell>
                <TableCell className="text-right tabular">
                  {k.queue}{k.delayedInQueue > 0 && <Badge variant="warning" className="ml-1.5">{k.delayedInQueue} late</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y sm:hidden">
        {rows.map((k) => (
          <li key={k.user.id}>
            <button type="button" onClick={() => onSelect(k.user.id)} className={cn("flex w-full items-center justify-between gap-3 px-4 py-3 text-left", selected === k.user.id && "bg-primary/5")}>
              <span className="min-w-0">
                <span className="block font-medium">{k.user.name}</span>
                <span className="block text-xs text-muted-foreground">{POSITION_LABEL[k.position]} · {k.steps} steps · {k.onTargetPct === null ? "—" : `${k.onTargetPct}%`} on target</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{k.queue} waiting</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PerformancePage() {
  const me = useMe();
  const months = useMemo(() => [0, 1, 2].map(monthsBack), []);
  const [month, setMonth] = useState(months[0]);
  const { employees, prevName } = useKpiData(month);
  const [selected, setSelected] = useState<string | undefined>();

  if (!me || me.role === "super_admin") return <Forbidden message="KPIs are for the Operations department: each employee and their Department Head." />;
  const team = canViewTeamKpis(me);
  const mine = employees.find((k) => k.user.id === me.id);
  const visible = employees.filter((k) => canViewKpisOf(me, k.user));
  const focus = visible.find((k) => k.user.id === selected) ?? (team ? visible[0] : mine);

  return (
    <>
      <PageHeader
        title="Performance"
        description={team
          ? "KPIs for each Operations employee and the department, measured from completed order steps."
          : "Your KPIs, measured from the order steps you complete. Only you and your Department Head can see them."}
        actions={
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-44" aria-label="Month"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{MONTH.format(new Date(`${m}-01T00:00:00Z`))}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <div className="grid gap-4">
        {mine && (team ? me.role === "employee" : true) && (
          <section className="grid gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">My KPIs</h2>
            <KpiCard k={mine} prevName={prevName} />
          </section>
        )}
        {!mine && !team && <Card><EmptyState title="No KPIs yet" description="Ask your Department Head to assign your Operations role." /></Card>}
        {team && (
          <>
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Operations department</h2>
              <DepartmentKpis month={month} />
            </section>
            <section className="grid gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Individual KPIs</h2>
              <EmployeeTable rows={visible} selected={focus?.user.id} onSelect={setSelected} />
              {focus && <KpiCard key={focus.user.id} k={focus} prevName={prevName} className="duration-300 ease-fluid animate-in fade-in-0 slide-in-from-bottom-1" />}
            </section>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          How it's measured: a step's handling time runs from when the order reached that step to when the employee completed it.
          Targets: {(Object.keys(TARGET_HOURS) as (keyof typeof TARGET_HOURS)[]).map((p) => `${POSITION_LABEL[p]} ${formatHours(TARGET_HOURS[p])}`).join(", ")}.
        </p>
      </div>
    </>
  );
}
