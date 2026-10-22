import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, CircleDot, Clock, FileText, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/app/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Money, OverdueBadge, PageHeader, PaymentBadge, StageBadge, SyncBadge } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import { actionOwner, actionsFor, delayReason, STAGE_INFO, TRACK, trackIndex, type OrderAction, type OrderStage } from "@/lib/orders";
import { overdueReasonOf, overdueStateOf, slaOf } from "@/lib/sla";
import { canActAs, moduleAccess, POSITION_LABEL, ROLE_LABEL } from "@/lib/rbac";
import { DOC_LABEL, stageLabel } from "@/lib/terms";
import type { OrderDocs, OrderLogEntry, RecordItem } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { useApp, useMe, waitForSync } from "@/store/app-store";

const DOC_ROWS: { key: keyof OrderDocs; label: string }[] = (Object.keys(DOC_LABEL) as (keyof OrderDocs)[]).map((key) => ({
  key,
  label: DOC_LABEL[key],
}));

/** What confirming an order action does: where the order goes and who hears about it. */
function outcome(rec: RecordItem, a: OrderAction) {
  const paid = a.markPaid ? "Paid" : rec.data.payment;
  const next = a.next?.({ ...rec, data: { ...rec.data, payment: paid } });
  const owner = next ? STAGE_INFO[next]?.owner : undefined;
  const moves = next && next !== rec.data.stage
    ? `The order moves to ${stageLabel(next)}${owner ? ` and ${POSITION_LABEL[owner]} is notified` : ""}.`
    : "The order stays at this stage.";
  return `${moves}${a.markPaid ? " Payment is marked Paid." : ""} The change is sent to Bitrix24.`;
}

export const whoLabel = (e: OrderLogEntry) =>
  e.position ? POSITION_LABEL[e.position] : e.role === "system" ? e.by : ROLE_LABEL[e.role];

export function ProgressTrack({ rec }: { rec: RecordItem }) {
  const idx = trackIndex(String(rec.data.stage));
  const skippedReceiving = idx > 2 && !rec.order?.docs.rr;
  return (
    <ol className="flex" aria-label={`Stage: ${stageLabel(String(rec.data.stage))}`}>
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
    toast.promise(waitForSync(rec.id), {
      loading: `${rec.data.order_no} saved. Sending to Bitrix24…`,
      success: (state) => state === "synced"
        ? `${rec.data.order_no} sent to Bitrix24`
        : state === "conflict"
          ? `${rec.data.order_no} saved, but it also changed in Bitrix24`
          : `${rec.data.order_no} saved, but it couldn't be sent to Bitrix24`,
      error: `Couldn't reach Bitrix24. ${rec.data.order_no} is saved in Zentra and we'll try again.`,
    });
    close();
  };
  return (
    <Dialog open={!!action} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action?.label}?</DialogTitle>
          <DialogDescription>{action ? `${rec.data.order_no} · ${action.hint} ${outcome(rec, action)}` : ""}</DialogDescription>
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
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The stage owner explains why an order is running late. The note goes into the order's history. */
function ReportDelayDialog({ rec, open, onOpenChange }: { rec: RecordItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const reportDelay = useApp((s) => s.reportDelay);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const close = () => { setNote(""); setErrors([]); onOpenChange(false); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = reportDelay(rec.id, note);
    if (!r.ok) return setErrors(r.errors ?? ["Couldn't save the delay."]);
    toast.success(`Delay reported on ${rec.data.order_no}`, { description: "It's in the order's history, and the Operations Department Head is notified." });
    close();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a delay on {String(rec.data.order_no)}</DialogTitle>
          <DialogDescription>
            Use this when the delay is outside our control. The order still counts as overdue, but it shows as justified (orange) instead of red.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {errors.length > 0 && (
            <ul role="alert" className="list-disc rounded-xl border border-destructive/40 bg-destructive/10 p-3 pl-7 text-sm text-destructive">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="grid gap-2">
            <Label htmlFor="delay-note">What's causing the delay?</Label>
            <Textarea id="delay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: the supplier's truck broke down; delivery moved to Friday." maxLength={240} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit">Report delay</Button>
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
  const [reporting, setReporting] = useState(false);
  const stage = rec.data.stage as OrderStage;
  const info = STAGE_INFO[stage];
  const onHold = stage === "On hold" ? delayReason(rec) : null;
  const overdue = overdueStateOf(rec);
  const reason = overdueReasonOf(rec);
  const sla = slaOf(rec);

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
  // Any overdue order, or a hard-to-source one, can get a note from its stage owner.
  const canReport = canActAs(me, owner) && !!sla && (sla.late || sla.hardToSource);
  const run = async (a: OrderAction) => {
    if (a.docs?.length) return setPending(a);
    if (!(await confirmAction({ title: `${a.label}?`, description: `${rec.data.order_no} · ${a.hint} ${outcome(rec, a)}`, confirmLabel: a.label }))) return;
    const r = advanceOrder(rec.id, a.id, {});
    if (!r.ok) return toast.error(r.errors?.[0] ?? "Couldn't update this order");
    toast.promise(waitForSync(rec.id), {
      loading: `${rec.data.order_no} saved. Sending to Bitrix24…`,
      success: (state) => state === "synced"
        ? `${rec.data.order_no} sent to Bitrix24`
        : state === "conflict"
          ? `${rec.data.order_no} saved, but it also changed in Bitrix24`
          : `${rec.data.order_no} saved, but it couldn't be sent to Bitrix24`,
      error: `Couldn't reach Bitrix24. ${rec.data.order_no} is saved in Zentra and we'll try again.`,
    });
  };

  return (
    <Card className={cn("p-5", overdue === "overdue" ? "border-destructive/40" : (overdue === "justified" || onHold) && "border-warning/40")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Hourglass className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Waiting on <span className="font-medium text-foreground">{owner ? POSITION_LABEL[owner] : "—"}</span>
              {assignees.length > 0 && <> · {assignees.join(", ")}</>}
            </p>
            <p className="font-medium">{info.pending}</p>
            {onHold && <Badge variant="warning" className="mt-1.5 whitespace-normal">{onHold}</Badge>}
            {sla && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <OverdueBadge rec={rec} />
                <span>
                  {sla.deliveredAt
                    ? `Delivered ${formatDate(sla.deliveredAt)}; the limit was ${formatDate(sla.deadline)}.`
                    : `Deliver by ${formatDate(sla.deadline)} (${sla.days} days from Purchasing${sla.hardToSource ? ", hard to source" : ""}).`}
                </span>
              </div>
            )}
            {sla?.late && <p className="mt-1.5 text-sm"><span className="font-medium">Reason:</span> <span className="text-muted-foreground">{reason ?? "None recorded yet."}</span></p>}
          </div>
        </div>
        {mine.length > 0 || canReport ? (
          <div className="flex flex-wrap gap-2">
            {mine.map((a) => (
              <Button key={a.id} variant={a.primary ? "default" : "outline"} onClick={() => run(a)} title={a.hint}>{a.label}</Button>
            ))}
            {canReport && <Button variant="outline" onClick={() => setReporting(true)} title="Record a delay that's outside our control"><AlertTriangle />Report delay</Button>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground lg:max-w-xs lg:text-right">
            {me?.role === "employee" ? `Only ${owner ? POSITION_LABEL[owner] : "the assigned role"} can move this order forward.` : "The assigned role moves this order forward."}
          </p>
        )}
      </div>
      <ActionDialog rec={rec} action={pending} onClose={() => setPending(null)} />
      <ReportDelayDialog rec={rec} open={reporting} onOpenChange={setReporting} />
    </Card>
  );
}

/** Chronological, plain-language history with the open stage at the end. */
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
          {e.delay
            ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/10 text-warning"><AlertTriangle className="h-4 w-4" /></span>
            : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success"><Check className="h-4 w-4" /></span>}
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-sm font-medium">{e.description}</p>
              {e.delay ? <Badge variant="warning" className="w-fit shrink-0">Delay</Badge> : <Badge variant="success" className="w-fit shrink-0">Done</Badge>}
            </div>
            {e.note && <p className="mt-1 text-sm text-muted-foreground">"{e.note}"</p>}
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
              <p className="text-sm font-medium">{stageLabel(stage)}: {STAGE_INFO[stage].pending.toLowerCase()}</p>
              <Badge variant={stage === "On hold" ? "warning" : "default"} className="w-fit shrink-0">{stage === "On hold" ? "On hold" : "In progress"}</Badge>
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
  const sla = slaOf(rec);

  return (
    <>
      <Link to="/activity" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Order tracking
      </Link>
      <PageHeader
        title={String(rec.data.order_no)}
        description={`${rec.data.customer} · ${rec.data.items}`}
        actions={<><OverdueBadge rec={rec} /><StageBadge stage={String(rec.data.stage)} /><PaymentBadge status={String(rec.data.payment)} /><SyncBadge state={rec.syncState} /></>}
      />
      <div className="grid gap-4">
        <NextStep rec={rec} />
        <Card className="px-3 py-5 sm:px-5"><ProgressTrack rec={rec} /></Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Order activity</CardTitle>
              <CardDescription>Every stage, from the confirmed order to the latest update</CardDescription>
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
                    {docs[d.key] ? <span className="shrink-0 font-medium tabular">{docs[d.key]}</span> : <span className="shrink-0 text-xs text-muted-foreground">Not created yet</span>}
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
                <Row label="Deliver by">{sla ? `${formatDate(sla.deadline)} (${sla.days} days${sla.hardToSource ? ", hard to source" : ""})` : "Starts when the order reaches Purchasing"}</Row>
                {sla?.deliveredAt && <Row label="Delivered">{formatDateTime(sla.deliveredAt)}</Row>}
                <Row label="Order confirmed">{formatDateTime(rec.createdAt)}</Row>
                <Row label="Bitrix24 order number">{rec.externalId ?? "—"}</Row>
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
