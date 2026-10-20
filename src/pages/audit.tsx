import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/app/bits";
import { ROLE_LABEL } from "@/lib/rbac";
import type { Role } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { useApp } from "@/store/app-store";

export function AuditPage() {
  const audit = useApp((s) => s.audit);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const list = audit.filter((a) =>
    (role === "all" || a.role === role) && `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in and change, with who made it and when. Entries can't be edited." />
      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, actions, or records" className="pl-9" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as "all" | Role)}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {list.length === 0 ? <EmptyState title="No matching entries" /> : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{a.actor}</div>
                    <Badge variant="secondary" className="mt-0.5">{ROLE_LABEL[a.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {a.action}
                    <div className="text-xs text-muted-foreground md:hidden">{a.target}</div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{a.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
