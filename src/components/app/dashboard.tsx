import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDown, ArrowUp, BarChart3, CheckCircle2, Clock, Gauge, LineChart as LineIcon, PackageX, PieChart as PieIcon,
  Receipt, RotateCcw, SlidersHorizontal, Truck, UserCheck, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { HelpTip, Money, StatCard } from "@/components/app/bits";
import { confirmAction } from "@/components/app/confirm";
import { completedSteps, dayKey, departmentKpis, formatHours, monthKey } from "@/lib/kpis";
import { delayReason, ORDER_STAGES } from "@/lib/orders";
import { POSITION_LABEL, POSITIONS } from "@/lib/rbac";
import type { ChartKind, DashboardPrefs, RecordItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";
import { useKpiData } from "@/pages/performance";

// ---------------------------------------------------------------------------------------
// Widget catalog

interface WidgetDef {
  id: string;
  kind: "stat" | "panel";
  label: string;
  hint: string;
  /** Columns a panel spans on wide screens (of 3). */
  span?: 1 | 2 | 3;
  /** Chart types the panel can switch between; the first is its default. */
  charts?: ChartKind[];
}

export const WIDGETS: WidgetDef[] = [
  { id: "stat-in-progress", kind: "stat", label: "Orders in progress", hint: "Open orders and how many are on track" },
  { id: "stat-completed", kind: "stat", label: "Completed this month", hint: "Delivered and paid" },
  { id: "stat-awaiting", kind: "stat", label: "Awaiting payment", hint: "Delivered, unpaid, and the money owed to us" },
  { id: "stat-delayed", kind: "stat", label: "Delayed orders", hint: "Past due, on hold, or stuck" },
  { id: "stat-invoiced", kind: "stat", label: "Invoiced this month", hint: "" },
  { id: "stat-ontime", kind: "stat", label: "On-time deliveries", hint: "" },
  { id: "stat-target", kind: "stat", label: "Stages within target", hint: "Department key numbers this month" },
  { id: "stat-low-stock", kind: "stat", label: "Low-stock items", hint: "At or below reorder level" },
  { id: "daily-summary", kind: "panel", label: "Daily process summary", hint: "Paid and unpaid orders handled on a day", span: 2 },
  { id: "orders-by-step", kind: "panel", label: "Open orders by stage", hint: "Where active orders are waiting", span: 1, charts: ["bar", "pie", "line"] },
  { id: "orders-trend", kind: "panel", label: "Orders received and completed", hint: "Last 14 days", span: 2, charts: ["line", "bar"] },
  { id: "payment-status", kind: "panel", label: "Paid vs unpaid", hint: "All orders by payment status", span: 1, charts: ["pie", "bar"] },
  { id: "steps-by-role", kind: "panel", label: "Stages completed by role", hint: "This month, per Operations role", span: 1, charts: ["bar", "pie", "line"] },
  { id: "team-kpis", kind: "panel", label: "Team performance", hint: "Each employee's key numbers this month", span: 2 },
  { id: "monthly-metrics", kind: "panel", label: "Monthly metrics", hint: "Shared monthly business numbers", span: 3 },
];
const BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

export const DEFAULT_DASHBOARD: DashboardPrefs = {
  widgets: ["stat-in-progress", "stat-completed", "stat-awaiting", "stat-delayed", "daily-summary", "orders-by-step", "monthly-metrics"],
  charts: Object.fromEntries(WIDGETS.filter((w) => w.charts).map((w) => [w.id, w.charts![0]])),
};

const CHART_ICON: Record<ChartKind, ReactNode> = { bar: <BarChart3 />, line: <LineIcon />, pie: <PieIcon /> };
const CHART_LABEL: Record<ChartKind, string> = { bar: "Bar", line: "Line", pie: "Pie" };

// ---------------------------------------------------------------------------------------
// One chart that can be drawn as bar, line, or pie

const SERIES = (i: number) => `var(--series-${(i % 8) + 1})`;
const tooltipStyle = {
  background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))",
};

interface Series { key: string; label: string }

function FlexChart({ kind, data, series }: { kind: ChartKind; data: Record<string, string | number>[]; series: Series[] }) {
  const multi = series.length > 1;
  // A single series uses the brand color; several series take categorical slots in fixed order.
  const color = (i: number) => (multi ? SERIES(i) : "hsl(var(--primary))");
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" minTickGap={8} />
      <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
    </>
  );
  const pieTotal = data.reduce((a, d) => a + Number(d[series[0].key] ?? 0), 0);

  return (
    <div className="grid gap-3">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "pie" ? (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Pie data={data} dataKey={series[0].key} nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={1}
                stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive animationDuration={600}>
                {data.map((d, i) => <Cell key={String(d.name)} fill={SERIES(i)} />)}
              </Pie>
            </PieChart>
          ) : kind === "line" ? (
            <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              {axes}
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--border))" }} />
              {series.map((s, i) => (
                <Line key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={color(i)} strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: color(i) }} activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} barCategoryGap="28%" barGap={2} margin={{ left: 4, right: 8, top: 8 }}>
              {axes}
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
              {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* Legend with values: identity never depends on color alone, and low-contrast slices still read. */}
      {kind === "pie" ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={String(d.name)} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES(i) }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium tabular">{d[series[0].key]}</span>
              <span className="text-muted-foreground">({pieTotal ? Math.round((Number(d[series[0].key]) / pieTotal) * 100) : 0}%)</span>
            </li>
          ))}
        </ul>
      ) : multi && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={cn("rounded-full", kind === "line" ? "h-0.5 w-3" : "h-2.5 w-2.5")} style={{ background: color(i) }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular">{data.reduce((a, d) => a + Number(d[s.key] ?? 0), 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Data

function useDashboardData() {
  const records = useApp((s) => s.records);
  return useMemo(() => {
    const orders = records.filter((r) => r.moduleId === "operations" && !r.archived && r.order);
    const items = records.filter((r) => r.moduleId === "ims" && !r.archived);
    const month = monthKey(new Date());
    const steps = completedSteps(orders);
    const dept = departmentKpis(orders, steps, month, "", POSITIONS);
    const open = orders.filter((o) => o.data.stage !== "Done");
    const delayed = open.filter((o) => delayReason(o));
    const awaiting = orders.filter((o) => o.data.stage === "Collection");
    const docAt = (o: RecordItem, key: "si") => {
      const no = o.order?.docs[key];
      return no ? o.order!.log.find((e) => e.description.includes(no))?.at : undefined;
    };
    const invoiced = orders.filter((o) => { const at = docAt(o, "si"); return at && monthKey(at) === month; });
    const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(Date.now() - (13 - i) * 86_400_000)));
    const SHORT = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
    return {
      open, delayed, awaiting, dept, invoiced,
      lowStock: items.filter((r) => Number(r.data.on_hand) <= Number(r.data.reorder_level)),
      byStep: ORDER_STAGES.filter((s) => s !== "Done").map((stage) => ({ name: stage, Orders: open.filter((o) => o.data.stage === stage).length })),
      trend: days.map((d) => ({
        name: SHORT.format(new Date(`${d}T00:00:00Z`)),
        Received: orders.filter((o) => dayKey(o.order!.log[0].at) === d).length,
        Completed: orders.filter((o) => o.data.stage === "Done" && dayKey(o.order!.log.at(-1)!.at) === d).length,
      })),
      payment: [
        { name: "Paid", Orders: orders.filter((o) => o.data.payment === "Paid").length },
        { name: "Unpaid", Orders: orders.filter((o) => o.data.payment !== "Paid").length },
      ],
      byRole: dept.byPosition.map((p) => ({ name: POSITION_LABEL[p.position], Stages: p.steps })),
    };
  }, [records]);
}

// ---------------------------------------------------------------------------------------
// Widgets

function StatWidget({ id }: { id: string }) {
  const d = useDashboardData();
  switch (id) {
    case "stat-in-progress": return <StatCard label="Orders in progress" value={d.open.length} icon={<Truck />} hint={`${d.open.length - d.delayed.length} on track`} />;
    case "stat-completed": return <StatCard label="Completed this month" value={d.dept.completed} icon={<UserCheck />} tone="success" hint="Delivered and paid" />;
    case "stat-awaiting": return <StatCard label="Awaiting payment" value={d.awaiting.length} icon={<Wallet />} tone={d.awaiting.length ? "warning" : "default"} hint={<><Money value={d.awaiting.reduce((a, o) => a + Number(o.data.amount), 0)} /> receivable</>} />;
    case "stat-delayed": return <StatCard label="Delayed orders" value={d.delayed.length} icon={<Clock />} tone={d.delayed.length ? "warning" : "success"} hint="See Needs attention" />;
    case "stat-invoiced": return <StatCard label="Invoiced this month" value={<Money value={d.invoiced.reduce((a, o) => a + Number(o.data.amount), 0)} />} icon={<Receipt />} hint={`${d.invoiced.length} sales invoices`} />;
    case "stat-ontime": return <StatCard label="On-time deliveries" value={d.dept.onTimeDeliveryPct === null ? "—" : `${d.dept.onTimeDeliveryPct}%`} icon={<CheckCircle2 />} hint="Delivered by the due date" />;
    case "stat-target": return <StatCard label="Stages within target" value={d.dept.onTargetPct === null ? "—" : `${d.dept.onTargetPct}%`} icon={<Gauge />} hint={`${d.dept.steps} stages this month`} />;
    case "stat-low-stock": return <StatCard label="Low-stock items" value={d.lowStock.length} icon={<PackageX />} tone={d.lowStock.length ? "warning" : "success"} hint="At or below reorder level" />;
    default: return null;
  }
}

function ChartPanel({ id, kind, className }: { id: string; kind: ChartKind; className?: string }) {
  const d = useDashboardData();
  const def = BY_ID[id];
  const chart =
    id === "orders-by-step" ? <FlexChart kind={kind} data={d.byStep} series={[{ key: "Orders", label: "Orders" }]} />
    : id === "orders-trend" ? <FlexChart kind={kind} data={d.trend} series={[{ key: "Received", label: "Received" }, { key: "Completed", label: "Completed" }]} />
    : id === "payment-status" ? <FlexChart kind={kind} data={d.payment} series={[{ key: "Orders", label: "Orders" }]} />
    : <FlexChart kind={kind} data={d.byRole} series={[{ key: "Stages", label: "Stages" }]} />;
  return (
    <Card className={className}>
      <CardHeader><CardTitle>{def.label}</CardTitle><CardDescription>{def.hint}</CardDescription></CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  );
}

function TeamKpisPanel({ className }: { className?: string }) {
  const month = useMemo(() => monthKey(new Date()), []);
  const { employees } = useKpiData(month);
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1"><CardTitle>Team performance</CardTitle><CardDescription>Each employee's key numbers this month</CardDescription></div>
        <Link to="/performance" className="text-sm text-primary hover:underline">Open Performance</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {employees.map((k) => (
          <div key={k.user.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted">
            <span className="min-w-0">
              <span className="block truncate font-medium">{k.user.name}</span>
              <span className="block text-xs text-muted-foreground">{POSITION_LABEL[k.position]}</span>
            </span>
            <span className="flex shrink-0 gap-4 text-right text-xs">
              <span><span className="block font-medium tabular">{k.steps}</span><span className="text-muted-foreground">stages</span></span>
              <span><span className="block font-medium tabular">{formatHours(k.avgHours)}</span><span className="text-muted-foreground">average</span></span>
              <span><span className={cn("block font-medium tabular", k.onTargetPct !== null && k.onTargetPct < 80 && "text-warning")}>{k.onTargetPct === null ? "—" : `${k.onTargetPct}%`}</span><span className="text-muted-foreground">on target</span></span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const SPAN = { 1: "", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

// ---------------------------------------------------------------------------------------
// The customizable General tab

export function CustomizableGeneral({ renderers }: { renderers: Record<string, (className: string) => ReactNode> }) {
  const me = useMe()!;
  const saved = useApp((s) => s.dashboards[me.id]);
  const prefs = saved ?? DEFAULT_DASHBOARD;
  const [open, setOpen] = useState(false);
  const shown = prefs.widgets.filter((id) => BY_ID[id]);
  const stats = shown.filter((id) => BY_ID[id].kind === "stat");
  const panels = shown.filter((id) => BY_ID[id].kind === "panel");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{saved ? "Your custom layout" : "Default layout"} · {shown.length} panels</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><SlidersHorizontal />Customize</Button>
      </div>
      {stats.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{stats.map((id) => <StatWidget key={id} id={id} />)}</div>
      )}
      {panels.length > 0 && (
        <div className="stagger grid grid-flow-row-dense gap-4 lg:grid-cols-3">
          {panels.map((id) => {
            const def = BY_ID[id];
            const cls = SPAN[def.span ?? 1];
            if (renderers[id]) return <div key={id} className={cn("grid min-w-0", cls)}>{renderers[id]("")}</div>;
            if (id === "team-kpis") return <TeamKpisPanel key={id} className={cls} />;
            return <ChartPanel key={id} id={id} kind={prefs.charts[id] ?? def.charts![0]} className={cls} />;
          })}
        </div>
      )}
      {shown.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nothing is shown. Use <span className="font-medium text-foreground">Customize</span> to add widgets.</Card>
      )}
      <CustomizeDialog open={open} onOpenChange={setOpen} prefs={prefs} hasSaved={!!saved} />
    </div>
  );
}

function CustomizeDialog({ open, onOpenChange, prefs, hasSaved }: { open: boolean; onOpenChange: (o: boolean) => void; prefs: DashboardPrefs; hasSaved: boolean }) {
  const setDashboard = useApp((s) => s.setDashboard);
  const [draft, setDraft] = useState(prefs);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(prefs);
  }
  const on = (id: string) => draft.widgets.includes(id);
  const toggle = (id: string) => setDraft((d) => ({ ...d, widgets: on(id) ? d.widgets.filter((x) => x !== id) : [...d.widgets, id] }));
  const move = (id: string, dir: -1 | 1) => setDraft((d) => {
    // Reorder among visible widgets of the same kind.
    const kind = BY_ID[id].kind;
    const same = d.widgets.filter((x) => BY_ID[x]?.kind === kind);
    const i = same.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= same.length) return d;
    const swapped = [...same];
    [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
    let k = 0;
    return { ...d, widgets: d.widgets.map((x) => (BY_ID[x]?.kind === kind ? swapped[k++] : x)) };
  });
  // Shown widgets in their order first, then the hidden ones.
  const ordered = (kind: WidgetDef["kind"]) => [
    ...draft.widgets.filter((id) => BY_ID[id]?.kind === kind),
    ...WIDGETS.filter((w) => w.kind === kind && !on(w.id)).map((w) => w.id),
  ];

  const save = async () => {
    const changed = WIDGETS.filter((w) => on(w.id) !== prefs.widgets.includes(w.id));
    const ok = await confirmAction({
      title: "Apply this layout?",
      description: "Your Overview tab will show the panels and chart types you picked. Only your own Overview changes.",
      details: [
        ["Widgets shown", String(draft.widgets.length)],
        ...(changed.length ? [["Changed", changed.map((w) => `${on(w.id) ? "+" : "−"} ${w.label}`).join(", ")] as [string, string]] : []),
      ],
      confirmLabel: "Apply",
    });
    if (!ok) return;
    setDashboard(draft);
    onOpenChange(false);
    toast.success("Overview updated");
  };
  const reset = async () => {
    const ok = await confirmAction({ title: "Reset your Overview to the default?", description: "Your custom panels, order, and chart types are removed.", confirmLabel: "Reset", destructive: true });
    if (!ok) return;
    setDashboard(null);
    onOpenChange(false);
    toast.success("Overview reset to the default");
  };

  const row = (id: string, list: string[]) => {
    const w = BY_ID[id];
    const shown = on(id);
    const idx = list.indexOf(id);
    const visibleCount = draft.widgets.filter((x) => BY_ID[x]?.kind === w.kind).length;
    return (
      <li key={id} className={cn("flex flex-col gap-2 rounded-2xl p-3 transition-colors duration-200 sm:flex-row sm:items-center", shown ? "bg-muted" : "border border-dashed")}>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <Switch checked={shown} onCheckedChange={() => toggle(id)} aria-label={`Show ${w.label}`} />
          <span className="flex min-w-0 items-center gap-2">
            <span className="block truncate text-sm font-medium">{w.label}</span>
            {/* The panel's explanation is a tooltip, not a second line of small text. */}
            {w.hint && <HelpTip text={w.hint} label={`About ${w.label}`} />}
          </span>
        </label>
        {shown && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {w.charts && (
              <div role="radiogroup" aria-label={`${w.label} chart style`} className="flex rounded-full bg-card p-0.5 shadow-soft">
                {w.charts.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={(draft.charts[id] ?? w.charts![0]) === c} title={CHART_LABEL[c]}
                    onClick={() => setDraft((d) => ({ ...d, charts: { ...d.charts, [id]: c } }))}
                    className={cn("grid h-9 w-9 place-items-center rounded-full transition-colors duration-200 [&_svg]:size-3.5",
                      (draft.charts[id] ?? w.charts![0]) === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {CHART_ICON[c]}<span className="sr-only">{CHART_LABEL[c]} chart</span>
                  </button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-10 w-10" disabled={idx === 0} onClick={() => move(id, -1)} aria-label={`Move ${w.label} up`}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" disabled={idx >= visibleCount - 1} onClick={() => move(id, 1)} aria-label={`Move ${w.label} down`}><ArrowDown /></Button>
          </div>
        )}
      </li>
    );
  };

  const stats = ordered("stat");
  const panels = ordered("panel");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize your Overview</DialogTitle>
          <DialogDescription>Choose the key numbers and panels to show, their order, and how each chart is drawn.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60dvh] gap-5 overflow-y-auto pr-1">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Key numbers <span className="font-normal text-muted-foreground">· shown as cards across the top</span></h3>
            <ul className="grid gap-2">{stats.map((id) => row(id, stats))}</ul>
          </section>
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Panels and charts <span className="font-normal text-muted-foreground">· bar, line, or pie where it fits the data</span></h3>
            <ul className="grid gap-2">{panels.map((id) => row(id, panels))}</ul>
          </section>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={reset} disabled={!hasSaved}><RotateCcw />Reset to default</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save layout</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
