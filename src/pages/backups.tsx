import { useState } from "react";
import { DatabaseBackup, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatCard } from "@/components/app/bits";
import { formatDateTime, sleep, timeAgo } from "@/lib/utils";
import { useApp, type BackupSchedule } from "@/store/app-store";

const SCHEDULE_LABEL: Record<BackupSchedule, string> = { every_4_hours: "Every 4 hours", daily: "Daily at 2:00 AM", weekly: "Weekly on Sunday" };

export function BackupsPage() {
  const backups = useApp((s) => s.backups);
  const schedule = useApp((s) => s.backupSchedule);
  const { createBackup, testRestore, setBackupSchedule } = useApp.getState();
  const [busy, setBusy] = useState<string | null>(null);
  const latest = backups[0];
  const verified = backups.filter((b) => b.status === "verified").length;

  const backup = async () => {
    setBusy("new"); await sleep(1200); createBackup(); setBusy(null);
    toast.success("Backup created", { description: "A new restore point is available." });
  };
  const test = async (id: string) => {
    setBusy(id); await sleep(1500); testRestore(id); setBusy(null);
    toast.success("Restore test passed", { description: "The restore point opened and its record counts matched." });
  };

  return (
    <>
      <PageHeader
        title="Backups"
        description="Restore points of the central database. Test a restore point to confirm it can be used in an outage."
        actions={<Button onClick={backup} disabled={busy === "new"}>{busy === "new" ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}Back up now</Button>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Latest restore point" value={latest ? timeAgo(latest.createdAt) : "—"} hint={latest ? formatDateTime(latest.createdAt) : undefined} />
        <StatCard label="Tested restore points" value={`${verified} of ${backups.length}`} icon={<ShieldCheck />} tone="success" hint="Confirmed usable" />
        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
            <span className="text-sm text-muted-foreground">Automatic schedule</span>
            <Select value={schedule} onValueChange={(v) => { setBackupSchedule(v as BackupSchedule); toast.success("Schedule updated"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(SCHEDULE_LABEL) as BackupSchedule[]).map((k) => <SelectItem key={k} value={k}>{SCHEDULE_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Created</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.id}>
                <TableCell><div className="font-medium">{formatDateTime(b.createdAt)}</div><div className="text-xs text-muted-foreground">{timeAgo(b.createdAt)}</div></TableCell>
                <TableCell className="hidden capitalize sm:table-cell">{b.type}</TableCell>
                <TableCell className="hidden text-right tabular sm:table-cell">{b.sizeMb} MB</TableCell>
                <TableCell><Badge variant={b.status === "verified" ? "success" : "secondary"}>{b.status === "verified" ? "Tested" : "Not tested"}</Badge></TableCell>
                <TableCell className="text-right">
                  {b.status !== "verified" && (
                    <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => test(b.id)}>
                      {busy === b.id && <Loader2 className="animate-spin" />}Test restore
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
