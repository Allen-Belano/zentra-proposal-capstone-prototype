import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, PaymentBadge, StageBadge, SyncBadge } from "@/components/app/bits";
import { delayReason, STAGE_INFO, type OrderStage } from "@/lib/orders";
import { moduleAccess, POSITION_LABEL, POSITIONS } from "@/lib/rbac";
import type { OrderLogEntry, Position, RecordItem } from "@/lib/types";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";
import { ProgressTrack, whoLabel } from "./order-detail";

const DAY = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });

function OrderCard({ o }: { o: RecordItem }) {
  const stage = o.data.stage as OrderStage;
  const info = STAGE_INFO[stage];
  const delay = delayReason(o);
  const last = o.order?.log.at(-1);
  return (
    <Link
      to="/orders/$orderId" params={{ orderId: o.id }}
      className="group block min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-[box-shadow,transform,border-color] duration-200 ease-fluid hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-float dark:border-border"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold">{o.data.order_no}</span>
            <span className="text-muted-foreground">{o.data.customer}</span>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">{o.data.items}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {delay && <Badge variant="warning">{delay}</Badge>}
          <StageBadge stage={stage} />
          <PaymentBadge status={String(o.data.payment)} />
          <SyncBadge state={o.syncState} />
          <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform duration-200 ease-fluid group-hover:translate-x-0.5 sm:block" />
        </div>
      </div>
      <ProgressTrack rec={o} />
      <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
        {stage === "Done" ? (
          <span className="font-medium text-success">Completed and paid</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Hourglass className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{info.owner ? POSITION_LABEL[info.owner] : "—"}:</span>
            <span className="text-muted-foreground">{info.pending}</span>
          </span>
        )}
        <span className="text-muted-foreground">Due {formatDate(String(o.data.due_date))}{last && <> · updated {timeAgo(last.at)}</>}</span>
      </div>
    </Link>
  );
}

export function ActivityPage() {
  const me = useMe();
  const records = useApp((s) => s.records);
  const [show, setShow] = useState<"open" | "done" | "all">("open");
  const [owner, setOwner] = useState<"all" | Position>("all");

  const canSeeOps = moduleAccess(me, "operations") !== "none" || me?.role === "super_admin";
  const allOrders = useMemo(() => records.filter((r) => r.moduleId === "operations" && !r.archived && r.order), [records]);
  const orders = useMemo(
    () => allOrders
      .filter((r) => (show === "open" ? r.data.stage !== "Done" : show === "done" ? r.data.stage === "Done" : true))
      .filter((r) => owner === "all" || STAGE_INFO[r.data.stage as OrderStage]?.owner === owner)
      // Orders that need attention first, then by due date.
      .sort((a, b) => Number(!!delayReason(b)) - Number(!!delayReason(a)) || String(a.data.due_date).localeCompare(String(b.data.due_date))),
    [allOrders, show, owner],
  );

  const feed = useMemo(() => {
    const entries: { e: OrderLogEntry; o: RecordItem; latest: boolean }[] = [];
    for (const o of allOrders) o.order!.log.forEach((e, i, all) => entries.push({ e, o, latest: i === all.length - 1 }));
    entries.sort((a, b) => b.e.at.localeCompare(a.e.at));
    const groups = new Map<string, typeof entries>();
    for (const x of entries.slice(0, 80)) {
      const k = DAY.format(new Date(x.e.at));
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    return [...groups.entries()];
  }, [allOrders]);

  if (!canSeeOps) return <EmptyState title="Order tracking isn't available for your role" />;

  return (
    <>
      <PageHeader title="Order tracking" description="Follow each order from the won deal to payment. Open an order to see its documents and full history." />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="feed">Order activity</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Select value={owner} onValueChange={(v) => setOwner(v as typeof owner)}>
              <SelectTrigger className="sm:w-48" aria-label="Waiting on"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Waiting on anyone</SelectItem>
                {POSITIONS.map((p) => <SelectItem key={p} value={p}>Waiting on {POSITION_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
              <SelectTrigger className="sm:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">In progress</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="all">All orders</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {orders.length === 0 ? (
            <Card><EmptyState title={show === "done" ? "No completed orders" : "No orders here"} description="Try a different filter." /></Card>
          ) : (
            <div className="stagger grid gap-3">{orders.map((o) => <OrderCard key={o.id} o={o} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="feed">
          <Card className="p-5">
            {feed.length === 0 ? <EmptyState title="No order activity yet" /> : feed.map(([day, items]) => (
              <section key={day} className="mb-6 last:mb-0">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">{day}</h2>
                <ol className="grid gap-2">
                  {items.map(({ e, o, latest }) => {
                    const stage = o.data.stage as OrderStage;
                    const next = latest && stage !== "Done" ? STAGE_INFO[stage] : null;
                    return (
                      <li key={e.id}>
                        <Link
                          to="/orders/$orderId" params={{ orderId: o.id }}
                          className="flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-muted sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{e.description}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{o.data.order_no}</span> · {o.data.customer} · {e.by} ({whoLabel(e)})
                            </p>
                            {next && (
                              <p className="mt-1 text-xs">
                                <span className="text-muted-foreground">Next: </span>
                                <span className="font-medium">{next.owner ? POSITION_LABEL[next.owner] : "—"}</span>
                                <span className="text-muted-foreground"> · {next.pending}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            <Badge variant="success">Done</Badge>
                            <time className="text-xs text-muted-foreground">{formatDateTime(e.at)}</time>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
