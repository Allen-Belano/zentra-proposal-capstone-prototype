import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Archive, ArchiveRestore, CloudOff, Eye, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSyncNowToast } from "@/components/app/app-shell";
import { EmptyState, Money, PageHeader, PaymentBadge, StageBadge, SyncBadge, useCanSeeMoney } from "@/components/app/bits";
import { Forbidden } from "@/components/app/guard";
import { confirmAction } from "@/components/app/confirm";
import { RecordForm } from "@/components/app/record-form";
import { can, moduleAccess } from "@/lib/rbac";
import type { ModuleField, RecordItem } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { recordLabel } from "@/lib/validation";
import { useApp, useMe, waitForSync } from "@/store/app-store";

// With the sidebar open, a 1280px laptop leaves about as much room as a tablet, so tablet-hidden columns wait for xl.
const hideCls = (f: ModuleField) =>
  cn(f.hideOnTablet ? "hidden xl:table-cell" : f.hideOnMobile && "hidden lg:table-cell");

function Cell({ field, rec }: { field: ModuleField; rec: RecordItem }) {
  const v = rec.data[field.key];
  if (v === "" || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (field.type === "currency") return <Money value={v} />;
  if (field.type === "date") return <span className="whitespace-nowrap">{formatDate(String(v))}</span>;
  if (field.key === "on_hand") {
    const low = Number(v) <= Number(rec.data.reorder_level);
    return (
      <span className="flex items-center gap-2 tabular">
        {String(v)}
        {low && <Badge variant="warning">Low stock</Badge>}
      </span>
    );
  }
  if (field.key === "stage" && rec.order) return <StageBadge stage={String(v)} />;
  if (field.key === "payment" && rec.order) return <PaymentBadge status={String(v)} />;
  if (field.primary && rec.order) {
    return (
      <Link
        to="/orders/$orderId"
        params={{ orderId: rec.id }}
        onClick={(e) => e.stopPropagation()}
        className="whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline"
      >
        {String(v)}
      </Link>
    );
  }
  if (field.type === "number") return <span className="tabular">{String(v)}</span>;
  return <span className={cn("block max-w-[8rem] truncate whitespace-nowrap xl:max-w-[12rem]", field.primary && "font-medium")} title={String(v)}>{String(v)}</span>;
}

export function RecordsPage() {
  const { moduleId } = useParams({ strict: false }) as { moduleId: string };
  const navigate = useNavigate();
  const me = useMe();
  const mod = useApp((s) => s.modules.find((m) => m.id === moduleId));
  const allRecords = useApp((s) => s.records);
  const outage = useApp((s) => s.outage);
  const { addRecord, updateRecord, setArchived, simulateRemoteEdit, checkRecord } = useApp.getState();
  const syncNow = useSyncNowToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [creating, setCreating] = useState(false);
  const seeMoney = useCanSeeMoney();

  const filterField = mod?.fields.find((f) => f.type === "select");
  const records = useMemo(() => {
    if (!mod) return [];
    const q = query.trim().toLowerCase();
    return allRecords
      .filter((r) => r.moduleId === mod.id && (view === "archived" ? r.archived : !r.archived))
      .filter((r) => (filter === "all" || !filterField ? true : r.data[filterField.key] === filter))
      // Restricted amounts aren't searchable, so a search can't reveal them.
      .filter((r) => !q || mod.fields.some((f) => (seeMoney || !f.financial) && String(r.data[f.key] ?? "").toLowerCase().includes(q)));
  }, [allRecords, mod, query, filter, filterField, view, seeMoney]);

  const access = moduleAccess(me, moduleId);
  if (!mod || !mod.active) return <Forbidden message="This system doesn't exist, or it was turned off by a Department Head." />;
  if (access === "none") return <Forbidden />;
  const canEdit = access === "edit";
  const isHead = can(me, "sync.manage");
  const external = mod.kind === "external";
  // Phone cards lead with the primary field and show the rest of the always-visible columns beneath it.
  const primaryField = mod.fields.find((f) => f.primary) ?? mod.fields[0];
  const cardFields = mod.fields.filter((f) => f !== primaryField && !f.hideOnMobile && !f.hideOnTablet);

  const actions = (r: RecordItem) => canEdit && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Record actions"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!r.archived && <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil />Edit</DropdownMenuItem>}
        <DropdownMenuItem onSelect={async () => {
          const ok = await confirmAction(r.archived
            ? { title: `Restore ${recordLabel(mod, r.data)}?`, description: `It returns to the active ${mod.name} list.`, confirmLabel: "Restore" }
            : { title: `Archive ${recordLabel(mod, r.data)}?`, description: `It's hidden from the active ${mod.name} list. You can restore it from Archived at any time.`, confirmLabel: "Archive", destructive: true });
          if (!ok) return;
          const res = setArchived(r.id, !r.archived);
          if (res.ok) toast.success(r.archived ? "Record restored" : "Record archived");
          else toast.error(res.errors?.[0] ?? "Couldn't change this record");
        }}>
          {r.archived ? <><ArchiveRestore />Restore</> : <><Archive />Archive</>}
        </DropdownMenuItem>
        {external && isHead && !r.archived && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={async () => {
              if (!(await confirmAction({ title: "Simulate a Bitrix24 edit?", description: `For the demo only: the copy of ${recordLabel(mod, r.data)} in Bitrix24 changes (due date moves 2 days).`, confirmLabel: "Simulate edit" }))) return;
              simulateRemoteEdit(r.id); toast("Changed in Bitrix24", { description: "Edit this order in Zentra now to see a conflict, or press Update now to pull the change." }); }}>
              <Zap />Demo: simulate a Bitrix24 edit
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader
        title={mod.name}
        description={external ? `${mod.description} Changes you make here are sent to ${mod.source}.` : mod.description}
        actions={
          <>
            {external && (
              <Button variant="outline" onClick={() => syncNow(mod.id)}><RefreshCw />Update now</Button>
            )}
            {canEdit && <Button onClick={() => setCreating(true)}><Plus />Add {mod.recordName.toLowerCase()}</Button>}
            {!canEdit && (
              <Badge variant="secondary" className="h-9 gap-1.5 px-3.5 text-sm [&_svg]:size-4">
                <Eye />{external ? "Orders move through each stage" : "View only"}
              </Badge>
            )}
          </>
        }
      />

      {external && outage && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">{mod.source} can't be reached right now</p>
            <p className="text-muted-foreground">
              Showing the last data we received{mod.lastSyncedAt ? `, from ${timeAgo(mod.lastSyncedAt)}` : ""}. Your changes are saved in Zentra and sent again automatically.
            </p>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${mod.name.toLowerCase()}`} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {filterField?.options && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any {filterField.label.toLowerCase()}</SelectItem>
                  {filterField.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {records.length === 0 ? (
          <EmptyState
            title={query || filter !== "all" ? "No matching records" : view === "archived" ? "No archived records" : `No ${mod.recordName.toLowerCase()}s yet`}
            description={query || filter !== "all" ? "Try a different search or filter." : canEdit && view === "active" ? `Add the first ${mod.recordName.toLowerCase()}, or import a file from the Data pipeline.` : view === "archived" ? "Records you archive will show up here." : undefined}
            action={canEdit && view === "active" && !query && filter === "all"
              ? <Button onClick={() => setCreating(true)}><Plus />Add {mod.recordName.toLowerCase()}</Button>
              : undefined}
          />
        ) : (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {mod.fields.map((f) => (
                      <TableHead key={f.key} className={hideCls(f)}>{f.label}</TableHead>
                    ))}
                    {external && <TableHead className="hidden xl:table-cell">Bitrix24</TableHead>}
                    <TableHead className="hidden 2xl:table-cell">Updated</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={r.order ? () => navigate({ to: "/orders/$orderId", params: { orderId: r.id } }) : undefined}
                      className={r.order ? "cursor-pointer" : undefined}
                    >
                      {mod.fields.map((f) => (
                        <TableCell key={f.key} className={hideCls(f)}><Cell field={f} rec={r} /></TableCell>
                      ))}
                      {external && <TableCell className="hidden xl:table-cell"><SyncBadge state={r.syncState} /></TableCell>}
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">
                        <div>{timeAgo(r.updatedAt)}</div>
                        <div className="text-xs">{r.updatedBy}</div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>{actions(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y sm:hidden">
              {records.map((r) => (
                <li
                  key={r.id}
                  onClick={r.order ? () => navigate({ to: "/orders/$orderId", params: { orderId: r.id } }) : undefined}
                  className={r.order ? "flex cursor-pointer items-start gap-2 py-3 pl-4 pr-2" : "flex items-start gap-2 py-3 pl-4 pr-2"}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm [&>span]:max-w-full"><Cell field={primaryField} rec={r} /></div>
                    <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      {cardFields.map((f) => (
                        <div key={f.key} className="flex min-w-0 items-center gap-1.5">
                          <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                          <dd className="min-w-0"><Cell field={f} rec={r} /></dd>
                        </div>
                      ))}
                      {external && <div><dt className="sr-only">Bitrix24</dt><dd><SyncBadge state={r.syncState} /></dd></div>}
                    </dl>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>{actions(r)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          {records.length} {mod.recordName.toLowerCase()}{records.length === 1 ? "" : "s"}
          {external && mod.lastSyncedAt && <> · Last updated from {mod.source} {timeAgo(mod.lastSyncedAt)}</>}
        </div>
      </Card>

      <RecordForm
        open={creating}
        onOpenChange={setCreating}
        module={mod}
        hiddenFields={seeMoney ? [] : mod.fields.filter((f) => f.financial).map((f) => f.key)}
        title={`Add ${mod.recordName.toLowerCase()}`}
        description="Every entry is checked against your rules before it's saved."
        submitLabel={`Add ${mod.recordName.toLowerCase()}`}
        onSubmit={async (data) => {
          const errors = checkRecord(mod.id, data);
          if (errors.length) return { ok: false, errors };
          const ok = await confirmAction({
            title: `Add this ${mod.recordName.toLowerCase()}?`,
            description: external ? `It's saved in Zentra, then sent to ${mod.source}.` : `It's saved to ${mod.name}.`,
            details: [[mod.fields.find((f) => f.primary)?.label ?? "Record", String(data[(mod.fields.find((f) => f.primary) ?? mod.fields[0]).key] ?? "")]],
            confirmLabel: `Add ${mod.recordName.toLowerCase()}`,
          });
          if (!ok) return null;
          const r = addRecord(mod.id, data);
          if (r.ok) {
            setCreating(false);
            if (external && r.id) {
              toast.promise(waitForSync(r.id), {
                loading: `Sending to ${mod.source}…`,
                success: (state) => state === "synced"
                  ? `Sent to ${mod.source}`
                  : state === "conflict"
                    ? `Saved, but it also changed in ${mod.source}`
                    : `Saved, but it couldn't be sent to ${mod.source}`,
                error: `Couldn't reach ${mod.source}. It's saved in Zentra and we'll try again.`,
              });
            } else {
              toast.success(`${mod.recordName} added`);
            }
          }
          return r;
        }}
      />
      <RecordForm
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        module={mod}
        hiddenFields={seeMoney ? [] : mod.fields.filter((f) => f.financial).map((f) => f.key)}
        initial={editing?.data}
        title={`Edit ${mod.recordName.toLowerCase()}`}
        description={external ? `Saved in Zentra first, then sent to ${mod.source}.` : undefined}
        submitLabel="Save changes"
        onSubmit={async (data) => {
          const errors = checkRecord(mod.id, data, editing!.id);
          if (errors.length) return { ok: false, errors };
          const changed = mod.fields.filter((f) => data[f.key] !== undefined && String(data[f.key]) !== String(editing!.data[f.key] ?? ""));
          if (external && changed.length) {
            const ok = await confirmAction({
              title: `Save changes to ${recordLabel(mod, editing!.data)}?`,
              description: `The changes are saved in Zentra, then sent to ${mod.source}.`,
              details: changed.slice(0, 5).map((f) => [f.label, `${editing!.data[f.key] ?? "—"} → ${data[f.key] || "—"}`] as [string, string]),
              confirmLabel: "Save and send",
            });
            if (!ok) return null;
          }
          const r = updateRecord(editing!.id, data);
          if (r.ok) {
            setEditing(null);
            if (external && changed.length) {
              toast.promise(waitForSync(editing!.id), {
                loading: `Sending to ${mod.source}…`,
                success: (state) => state === "synced"
                  ? `Sent to ${mod.source}`
                  : state === "conflict"
                    ? `Saved, but it also changed in ${mod.source}`
                    : `Saved, but it couldn't be sent to ${mod.source}`,
                error: `Couldn't reach ${mod.source}. It's saved in Zentra and we'll try again.`,
              });
            } else {
              toast.success("Changes saved");
            }
          }
          return r;
        }}
      />
    </>
  );
}
