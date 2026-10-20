import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LevelDot, PageHeader, SyncBadge } from "@/components/app/bits";
import { ORDER_STAGES } from "@/data/seed";
import { moduleAccess } from "@/lib/rbac";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

const DAY = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });

function StageTrack({ stage }: { stage: string }) {
  const idx = stage === "Delivered" ? ORDER_STAGES.length : ORDER_STAGES.indexOf(stage);
  return (
    <ol className="flex" aria-label={`Stage: ${stage}`}>
      {ORDER_STAGES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={s} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cn("absolute left-0 right-1/2 h-0.5", i <= idx ? "bg-primary" : "bg-border")} />}
              {i < ORDER_STAGES.length - 1 && <span className={cn("absolute left-1/2 right-0 h-0.5", i < idx ? "bg-primary" : "bg-border")} />}
              <span className={cn(
                "relative flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary bg-card text-primary",
                !done && !current && "border-border bg-card text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
            </div>
            <span className={cn("hidden text-center text-xs sm:block", current ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityPage() {
  const me = useMe();
  const records = useApp((s) => s.records);
  const activity = useApp((s) => s.activity);
  const modules = useApp((s) => s.modules);
  const [scope, setScope] = useState("all");
  const [show, setShow] = useState<"open" | "delivered">("open");

  const canSeeOps = moduleAccess(me, "operations") !== "none" || me?.role === "super_admin";
  const orders = useMemo(
    () => records
      .filter((r) => r.moduleId === "operations" && !r.archived)
      .filter((r) => (show === "open" ? r.data.stage !== "Delivered" : r.data.stage === "Delivered"))
      .sort((a, b) => String(a.data.due_date).localeCompare(String(b.data.due_date))),
    [records, show],
  );

  const feed = useMemo(() => {
    const visible = activity.filter((e) => !e.moduleId || me?.role === "super_admin" || moduleAccess(me, e.moduleId) !== "none");
    const filtered = scope === "all" ? visible : visible.filter((e) => e.moduleId === scope);
    const groups = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const k = DAY.format(new Date(e.at));
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()];
  }, [activity, scope, me]);

  return (
    <>
      <PageHeader title="Order tracking" description="Follow each order from confirmation to delivery, and every change recorded along the way." />
      <Tabs defaultValue={canSeeOps ? "orders" : "feed"}>
        <TabsList>
          {canSeeOps && <TabsTrigger value="orders">Orders</TabsTrigger>}
          <TabsTrigger value="feed">Activity timeline</TabsTrigger>
        </TabsList>

        {canSeeOps && (
          <TabsContent value="orders">
            <div className="mb-4 flex justify-end">
              <Select value={show} onValueChange={(v) => setShow(v as "open" | "delivered")}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">In progress</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {orders.length === 0 ? (
              <Card><EmptyState title={show === "open" ? "No orders in progress" : "No delivered orders yet"} /></Card>
            ) : (
              <div className="grid gap-3">
                {orders.map((o) => {
                  const last = activity.find((e) => e.recordId === o.id);
                  const overdue = o.data.stage !== "Delivered" && new Date(String(o.data.due_date)).getTime() < Date.now() - 86_400_000;
                  return (
                    <Card key={o.id} className="p-5">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{o.data.order_no}</span>
                            <span className="text-muted-foreground">{o.data.customer}</span>
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">{o.data.items}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                          <SyncBadge state={o.syncState} />
                        </div>
                      </div>
                      <StageTrack stage={String(o.data.stage)} />
                      <p className="mt-2 text-xs text-muted-foreground sm:hidden">Stage: <span className="font-medium text-foreground">{String(o.data.stage)}</span></p>
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                        <span>Due {formatDate(String(o.data.due_date))}</span>
                        <span>Assigned to {o.data.assigned_to || "—"}</span>
                        {last && <span>Last update: {last.title} ({formatDateTime(last.at)})</span>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="feed">
          <div className="mb-4 flex justify-end">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.filter((m) => me?.role === "super_admin" || moduleAccess(me, m.id) !== "none").map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="p-5">
            {feed.length === 0 ? <EmptyState title="No activity yet" /> : feed.map(([day, events]) => (
              <section key={day} className="mb-6 last:mb-0">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">{day}</h2>
                <ol className="relative ml-1 border-l pl-5">
                  {events.map((e) => (
                    <li key={e.id} className="relative pb-5 last:pb-0">
                      <span className="absolute -left-[25px] top-0 flex h-4 w-2 items-center justify-center bg-card"><LevelDot level={e.level} /></span>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        <p className="text-sm font-medium">{e.title}</p>
                        <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.at)}</time>
                      </div>
                      {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{modules.find((m) => m.id === e.moduleId)?.name ?? "System"} · {e.actor}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
