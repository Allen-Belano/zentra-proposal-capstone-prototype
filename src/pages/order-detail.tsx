import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleDot, Clock, FileText, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money, PageHeader, PaymentBadge, StageBadge, SyncBadge } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import { actionOwner, actionsFor, delayReason, STAGE_INFO, TRACK, trackIndex, type OrderAction, type OrderStage } from "@/lib/orders";
import { canActAs, moduleAccess, POSITION_LABEL, ROLE_LABEL } from "@/lib/rbac";
import type { OrderDocs, OrderLogEntry, RecordItem } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { useApp, useMe } from "@/store/app-store";

const DOC_ROWS: { key: keyof OrderDocs; label: string }[] = [
  { key: "clientPo", label: "Client P.O." },
  { key: "supplierPo", label: "Supplier P.O." },
  { key: "rr", label: "Receiving report (RR)" },
  { key: "si", label: "Sales invoice (SI)" },
  { key: "wr", label: "Written report (WR)" },
  { key: "dr", label: "Delivery receipt (DR)" },
  { key: "payment", label: "Official receipt (OR)" },
];

export const whoLabel = (e: OrderLogEntry) =>
  e.position ? POSITION_LABEL[e.position] : e.role === "system" ? e.by : ROLE_LABEL[e.role];

export function ProgressTrack({ rec }: { rec: RecordItem }) {
  const idx = trackIndex(String(rec.data.stage));
  const skippedReceiving = idx > 2 && !rec.order?.docs.rr;
  return (
    <ol className="flex" aria-label={`Step: ${rec.data.stage}`}>
      {TRACK.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={s} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cn("absolute left-0 right-1/2 h-0.5 transition-colors duration-500", i <= idx ? "bg-primary" : "bg-border")} />}
              {i < TRACK.length - 1 && <span className={cn("absolute left-1/2 right-0 h-0.5 transition-colors duration-500", i < idx ? "bg-primary" : "bg-border")} />}
              <span className={cn(
                "relative grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] font-semibold transition-colors duration-500",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary bg-card text-primary ring-4 ring-primary/15",
                !done && !current && "border-border bg-card text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
            </div>
            <span className={cn("hidden text-center text-xs sm:block", current ? "font-medium text-foreground" : "text-muted-foreground")}>
              {s}{s === "Receiving" && skippedReceiving && <span className="block text-[11px]">from stock</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ActionDialog({ rec, action, onClose }: { rec: RecordItem; action: OrderAction | null; onClose: () => void }) {
  const advanceOrder = useApp((s) => s.advanceOrder);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const close = () => { setLastId(null); onClose(); };
  if (action && action.id !== lastId) {
    setLastId(action.id);
    setErrors([]);
    setValues(Object.fromEntries((action.docs ?? []).map((d) => [d.key, `${d.prefix}${4000 + Math.floor(Math.random() * 900)}`])));
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    const r = advanceOrder(rec.id, action.id, values);
    if (!r.ok) return setErrors(r.errors ?? ["Couldn't update this order."]);
    toast.success(action.label, { description: `${rec.data.order_no} updated and sent to Bitrix24.` });
    close();
  };
  return (
    <Dialog open={!!action} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action?.label}</DialogTitle>
          <DialogDescription>{rec.data.order_no} · {action?.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {errors.length > 0 && (
            <ul role="alert" className="list-disc rounded-xl border border-destructive/40 bg-destructive/10 p-3 pl-7 text-sm text-destructive">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          {(action?.docs ?? []).map((d) => (
            <div key={d.key} className="grid gap-2">
              <Label htmlFor={`doc-${d.key}`}>{d.label}</Label>
              <Input id={`doc-${d.key}`} value={values[d.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NextStep({ rec }: { rec: RecordItem }) {
  const me = useMe();
  const users = useApp((s) => s.users);
  const advanceOrder = useApp((s) => s.advanceOrder);
  const [pending, setPending] = useState<OrderAction | null>(null);
  const stage = rec.data.stage as OrderStage;
  const info = STAGE_INFO[stage];
  const delay = delayReason(rec);

  if (stage === "Done") {
    const closed = rec.order?.log.at(-1)?.at;
    return (
      <Card className="border-success/30 bg-success/5 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success"><Check className="h-5 w-5" /></span>
          <div>
            <p className="font-medium">Order complete</p>
            <p className="text-sm text-muted-foreground">Delivered and paid{closed ? `, closed ${formatDate(closed)}` : ""}.</p>
          </div>
        </div>
      </Card>
    );
  }

  const owner = info.owner;
  const assignees = users.filter((u) => u.role === "employee" && u.status === "active" && u.position === owner).map((u) => u.name);
  const actions = actionsFor(rec);
  const mine = actions.filter((a) => canActAs(me, actionOwner(rec, a)));
  const run = (a: OrderAction) => {
    if (a.docs?.length) return setPending(a);
    const r = advanceOrder(rec.id, a.id, {});
    if (r.ok) toast.success(a.label, { description: `${rec.data.order_no} updated and sent to Bitrix24.` });
    else toast.error(r.errors?.[0] ?? "Couldn't update this order");
  };

  return (
    <Card className={cn("p-5", delay && "border-warning/40")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Hourglass className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Waiting on <span className="font-medium text-foreground">{owner ? POSITION_LABEL[owner] : "—"}</span>
              {assignees.length > 0 && <> · {assignees.join(", ")}</>}
            </p>
            <p className="font-medium">{info.pending}</p>
            {delay && <Badge variant="warning" className="mt-1.5 whitespace-normal">{delay}</Badge>}
          </div>
        </div>
        {mine.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mine.map((a) => (
              <Button key={a.id} variant={a.primary ? "default" : "outline"} onClick={() => run(a)} title={a.hint}>{a.label}</Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground lg:max-w-xs lg:text-right">
            {me?.role === "employee" ? `Only ${owner ? POSITION_LABEL[owner] : "the assigned role"} can move this order forward.` : "The assigned role moves this order forward."}
          </p>
        )}
      </div>
      <ActionDialog rec={rec} action={pending} onClose={() => setPending(null)} />
    </Card>
  );
}

/** Chronological, plain-language history with the open step at the end. */
export function OrderTimeline({ rec }: { rec: RecordItem }) {
  const log = rec.order?.log ?? [];
  const stage = rec.data.stage as OrderStage;
  const open = stage !== "Done";
  const owner = STAGE_INFO[stage]?.owner;
  const since = log.at(-1)?.at;
  return (
    <ol className="relative">
      {log.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
          {(i < log.length - 1 || open) && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border" />}
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success"><Check className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-sm font-medium">{e.description}</p>
              <Badge variant="success" className="w-fit shrink-0">Done</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{e.by}</span> · {whoLabel(e)} · {formatDateTime(e.at)}
            </p>
          </div>
        </li>
      ))}
      {open && (
        <li className="relative flex gap-4">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 motion-reduce:hidden" />
            <CircleDot className="relative h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-sm font-medium">{stage}: {STAGE_INFO[stage].pending.toLowerCase()}</p>
              <Badge variant={stage === "On hold" ? "destructive" : "default"} className="w-fit shrink-0">{stage === "On hold" ? "On hold" : "In progress"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{owner ? POSITION_LABEL[owner] : "—"}</span>
              {since && <> · waiting since {formatDateTime(since)} ({timeAgo(since)})</>}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
              <Clock className="h-3 w-3" /> Pending action: {STAGE_INFO[stage].pending}
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const me = useMe();
  const rec = useApp((s) => s.records.find((r) => r.id === orderId && r.moduleId === "operations"));
  if (moduleAccess(me, "operations") === "none" && me?.role !== "super_admin") return <Forbidden />;
  if (!rec?.order) return <Forbidden message="This order doesn't exist or was archived." />;
  const docs = rec.order.docs;
  const overdue = rec.data.stage !== "Done" && new Date(String(rec.data.due_date)).getTime() < Date.now() - 86_400_000;

  return (
    <>
      <Link to="/activity" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Order tracking
      </Link>
      <PageHeader
        title={String(rec.data.order_no)}
        description={`${rec.data.customer} · ${rec.data.items}`}
        actions={<><StageBadge stage={String(rec.data.stage)} /><PaymentBadge status={String(rec.data.payment)} /><SyncBadge state={rec.syncState} /></>}
      />
      <div className="grid gap-4">
        <NextStep rec={rec} />
        <Card className="px-3 py-5 sm:px-5"><ProgressTrack rec={rec} /></Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Order activity</CardTitle>
              <CardDescription>Every step from the won deal to the latest update</CardDescription>
            </CardHeader>
            <CardContent><OrderTimeline rec={rec} /></CardContent>
          </Card>
          <div className="grid grid-cols-1 content-start gap-4">
            <Card>
              <CardHeader><CardTitle>Documents</CardTitle><CardDescription>Supporting records for this order</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 gap-1.5">
                {DOC_ROWS.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{d.label}</span></span>
                    {docs[d.key] ? <span className="shrink-0 font-medium tabular">{docs[d.key]}</span> : <span className="shrink-0 text-xs text-muted-foreground">Not issued yet</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Row label="Customer">{rec.data.customer}</Row>
                <Row label="Items">{rec.data.items}</Row>
                <Row label="Amount"><Money value={rec.data.amount} /></Row>
                <Row label="Payment"><PaymentBadge status={String(rec.data.payment)} /></Row>
                <Row label="Due">{formatDate(String(rec.data.due_date))}{overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}</Row>
                <Row label="Deal won">{formatDateTime(rec.createdAt)}</Row>
                <Row label="Bitrix24 deal">{rec.externalId ?? "—"}</Row>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
